-- Apply after 005. Never apply to production before reviewing existing memberships.
BEGIN;

CREATE OR REPLACE FUNCTION public.get_user_org_ids(uid UUID)
RETURNS SETOF UUID LANGUAGE sql SECURITY DEFINER STABLE SET search_path = ''
AS $$ SELECT org_id FROM public.org_members WHERE user_id = uid AND uid = auth.uid(); $$;
REVOKE ALL ON FUNCTION public.get_user_org_ids(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_org_ids(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.has_org_role(oid UUID, allowed_roles TEXT[])
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path = ''
AS $$ SELECT EXISTS (SELECT 1 FROM public.org_members
  WHERE org_id = oid AND user_id = auth.uid() AND role = ANY(allowed_roles)); $$;
REVOKE ALL ON FUNCTION public.has_org_role(UUID, TEXT[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_org_role(UUID, TEXT[]) TO authenticated;

DROP POLICY IF EXISTS org_select ON public.organizations;
CREATE POLICY org_select ON public.organizations FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR id IN (SELECT public.get_user_org_ids(auth.uid())));
DROP POLICY IF EXISTS orgmem_insert ON public.org_members;
DROP POLICY IF EXISTS orgmem_select ON public.org_members;
CREATE POLICY orgmem_select ON public.org_members FOR SELECT TO authenticated USING (
  org_id IN (SELECT public.get_user_org_ids(auth.uid()))
  OR EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = org_id AND o.owner_id = auth.uid())
);
DROP POLICY IF EXISTS "Users can create org memberships" ON public.org_members;
CREATE POLICY orgmem_insert ON public.org_members FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = org_id AND o.owner_id = auth.uid())
  AND ((role = 'owner' AND user_id = auth.uid()) OR role IN ('manager', 'staff'))
);

-- A transaction gives registration either both rows or neither. Retries return
-- the same owner organization; the advisory lock also serializes double-clicks.
CREATE OR REPLACE FUNCTION public.create_owner_organization(org_name TEXT, org_slug TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE oid UUID;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  IF length(trim(org_name)) NOT BETWEEN 1 AND 120 OR length(trim(org_slug)) NOT BETWEEN 1 AND 150
    OR org_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' THEN
    RAISE EXCEPTION 'Invalid organization name or slug' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::TEXT, 0));
  SELECT id INTO oid FROM public.organizations WHERE owner_id = auth.uid() ORDER BY created_at LIMIT 1;
  IF oid IS NULL THEN
    INSERT INTO public.organizations(name, slug, owner_id) VALUES (trim(org_name), org_slug, auth.uid()) RETURNING id INTO oid;
  END IF;
  INSERT INTO public.org_members(org_id, user_id, role, department)
    VALUES (oid, auth.uid(), 'owner', 'management') ON CONFLICT (org_id, user_id) DO NOTHING;
  RETURN oid;
END; $$;
REVOKE ALL ON FUNCTION public.create_owner_organization(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_owner_organization(TEXT, TEXT) TO authenticated;

-- The owner adds an existing, verified account. Browser signUp would replace
-- the owner's session with the new staff account and cannot safely do this.
CREATE OR REPLACE FUNCTION public.add_org_member(oid UUID, member_email TEXT, member_role TEXT, member_department TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE member_uid UUID;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = oid AND owner_id = auth.uid()) THEN
    RAISE EXCEPTION 'Only the organization owner can add staff' USING ERRCODE = '42501';
  END IF;
  IF member_role IS NULL OR member_role NOT IN ('manager', 'staff') THEN
    RAISE EXCEPTION 'Invalid staff role' USING ERRCODE = '22023';
  END IF;
  SELECT id INTO member_uid FROM auth.users WHERE lower(email) = lower(trim(member_email)) AND email_confirmed_at IS NOT NULL;
  IF member_uid IS NULL THEN RAISE EXCEPTION 'Ask the staff member to create and verify an account first'; END IF;
  IF member_uid = auth.uid() THEN RAISE EXCEPTION 'The owner cannot be added as staff'; END IF;
  INSERT INTO public.org_members(org_id, user_id, role, department)
    VALUES (oid, member_uid, member_role, member_department);
END; $$;
REVOKE ALL ON FUNCTION public.add_org_member(UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_org_member(UUID, TEXT, TEXT, TEXT) TO authenticated;

-- Keep operational staff workflows, enforce the documented privileged writes.
DO $$
DECLARE entry RECORD;
BEGIN
  FOR entry IN SELECT * FROM (VALUES
    ('rooms', 'rooms_all'), ('menu_items', 'menu_items_all'),
    ('expenses', 'expenses_all'), ('utility_bills', 'utility_bills_all')
  ) AS x(table_name, old_policy) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', entry.old_policy, entry.table_name);
    EXECUTE format('CREATE POLICY member_read ON public.%I FOR SELECT TO authenticated USING (org_id IN (SELECT public.get_user_org_ids(auth.uid())))', entry.table_name);
    EXECUTE format('CREATE POLICY manager_write ON public.%I FOR ALL TO authenticated USING (public.has_org_role(org_id, ARRAY[''owner'', ''manager''])) WITH CHECK (public.has_org_role(org_id, ARRAY[''owner'', ''manager'']))', entry.table_name);
  END LOOP;
END; $$;
DROP POLICY IF EXISTS salaries_all ON public.salaries;
CREATE POLICY owner_salaries ON public.salaries FOR ALL TO authenticated
  USING (public.has_org_role(org_id, ARRAY['owner'])) WITH CHECK (public.has_org_role(org_id, ARRAY['owner']));
COMMIT;
