-- Run against a disposable PostgreSQL database after applying migrations.
GRANT USAGE ON SCHEMA public, auth TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
INSERT INTO auth.users(id,email,email_confirmed_at) VALUES
 ('00000000-0000-0000-0000-000000000001','owner-a@example.test',now()),
 ('00000000-0000-0000-0000-000000000002','owner-b@example.test',now()),
 ('00000000-0000-0000-0000-000000000003','staff@example.test',now());
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
SELECT public.create_owner_organization('Hotel A','hotel-a');
SELECT public.create_owner_organization('Hotel A','hotel-a');
DO $$ BEGIN
 IF (SELECT count(*) FROM public.organizations) <> 1 OR (SELECT count(*) FROM public.org_members) <> 1 THEN
  RAISE EXCEPTION 'Bootstrap retry created duplicate rows'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
SELECT public.create_owner_organization('Hotel B','hotel-b');
SELECT public.add_org_member((SELECT id FROM public.organizations WHERE slug='hotel-b'),'staff@example.test','staff','front-desk');
INSERT INTO public.salaries(org_id,employee_name,department,monthly_salary,payment_month)
 SELECT id,'Synthetic employee','test',100,DATE '2026-10-01' FROM public.organizations WHERE slug='hotel-b';
RESET ROLE;
SELECT set_config('test.org_a',(SELECT id::text FROM public.organizations WHERE slug='hotel-a'),false);
SELECT set_config('test.org_b',(SELECT id::text FROM public.organizations WHERE slug='hotel-b'),false);
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',false);
DO $$ BEGIN
 IF (SELECT count(*) FROM public.organizations) <> 1 THEN RAISE EXCEPTION 'Tenant scope leak'; END IF;
 IF EXISTS (SELECT 1 FROM public.salaries) THEN RAISE EXCEPTION 'Staff salary leak'; END IF;
 IF EXISTS (SELECT 1 FROM public.get_user_org_ids('00000000-0000-0000-0000-000000000001')) THEN RAISE EXCEPTION 'Helper reveals another user'; END IF;
 BEGIN
  INSERT INTO public.org_members(org_id,user_id,role) VALUES(current_setting('test.org_a')::uuid, auth.uid(),'owner');
  RAISE EXCEPTION 'Self enrollment allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  PERFORM public.add_org_member(current_setting('test.org_b')::uuid,'owner-a@example.test','manager','test');
  RAISE EXCEPTION 'Staff invitation allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  INSERT INTO public.rooms(org_id,room_number,rate_per_night) VALUES(current_setting('test.org_b')::uuid,'9',100);
  RAISE EXCEPTION 'Staff room administration allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
DO $$ BEGIN
 BEGIN
  PERFORM public.add_org_member(current_setting('test.org_b')::uuid,'owner-a@example.test','owner','test');
  RAISE EXCEPTION 'Second owner role allowed';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 BEGIN
  PERFORM public.add_org_member(current_setting('test.org_a')::uuid,'staff@example.test','staff','test');
  RAISE EXCEPTION 'Cross-org invitation allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SELECT 'membership regression checks passed';
