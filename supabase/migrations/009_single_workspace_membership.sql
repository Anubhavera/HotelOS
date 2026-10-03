-- The current application has one organization per account (useOrg.single()).
-- Review historical duplicates; never discard memberships automatically.
BEGIN;
ALTER TABLE public.org_members ADD CONSTRAINT org_member_single_workspace UNIQUE(user_id);
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
  -- A verified staff account may be invited before its first login. Preserve
  -- that membership rather than trying to create a second workspace.
  SELECT org_id INTO oid FROM public.org_members WHERE user_id = auth.uid() LIMIT 1;
  IF oid IS NOT NULL THEN RETURN oid; END IF;
  SELECT id INTO oid FROM public.organizations WHERE owner_id = auth.uid() ORDER BY created_at LIMIT 1;
  IF oid IS NULL THEN
    INSERT INTO public.organizations(name, slug, owner_id) VALUES (trim(org_name), org_slug, auth.uid())
      ON CONFLICT (slug) DO NOTHING RETURNING id INTO oid;
    IF oid IS NULL THEN
      INSERT INTO public.organizations(name, slug, owner_id)
        VALUES (trim(org_name), org_slug || '-' || replace(auth.uid()::TEXT, '-', ''), auth.uid()) RETURNING id INTO oid;
    END IF;
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
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(member_uid::TEXT, 0));
  IF EXISTS(SELECT 1 FROM public.org_members WHERE user_id = member_uid) THEN
    RAISE EXCEPTION 'This account already belongs to an organization' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.org_members(org_id, user_id, role, department)
    VALUES (oid, member_uid, member_role, member_department);
END; $$;
REVOKE ALL ON FUNCTION public.add_org_member(UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_org_member(UUID, TEXT, TEXT, TEXT) TO authenticated;

COMMIT;
