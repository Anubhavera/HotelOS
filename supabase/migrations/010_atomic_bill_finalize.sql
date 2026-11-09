-- Finalise a table's bill in one transaction. The client used to insert the
-- bill and then mark its KOTs completed in a second request, so a KOT
-- cancelled (or billed) on another device in between ended up on a bill whose
-- total no longer matched sales. This locks the KOTs, refuses if any left
-- active/preparing, totals them server-side, then writes bill and KOTs together.
-- Apply before deploying the client that calls it.
BEGIN;
CREATE FUNCTION public.finalize_restaurant_bill(
  oid UUID, kot_ids UUID[], table_label TEXT, customer TEXT, mode TEXT, reference TEXT, bill_notes TEXT)
RETURNS public.restaurant_bills LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE bill public.restaurant_bills; open_count INTEGER; amount NUMERIC;
BEGIN
  IF NOT public.has_org_role(oid, ARRAY['owner','manager','staff']) THEN
    RAISE EXCEPTION 'Organization access required' USING ERRCODE = '42501';
  END IF;
  IF kot_ids IS NULL OR cardinality(kot_ids) NOT BETWEEN 1 AND 200 OR nullif(trim(customer), '') IS NULL
    OR (mode IN ('upi','card') AND nullif(trim(reference), '') IS NULL) THEN
    RAISE EXCEPTION 'Invalid bill' USING ERRCODE = '22023';
  END IF;
  -- Lock first so a concurrent cancel or second finalise waits, then count what is still open.
  PERFORM 1 FROM public.restaurant_orders WHERE id = ANY(kot_ids) AND org_id = oid FOR UPDATE;
  SELECT count(*), coalesce(sum(total_amount), 0) INTO open_count, amount
    FROM public.restaurant_orders
   WHERE id = ANY(kot_ids) AND org_id = oid AND status IN ('active','preparing');
  IF open_count <> (SELECT count(DISTINCT k) FROM unnest(kot_ids) AS k) THEN
    RAISE EXCEPTION 'Some KOTs were already billed or cancelled' USING ERRCODE = '40001';
  END IF;
  INSERT INTO public.restaurant_bills(org_id, table_number, customer_name, payment_mode,
      payment_reference, notes, total_amount, created_by)
    VALUES (oid, nullif(trim(table_label), ''), trim(customer), mode,
      nullif(trim(reference), ''), nullif(trim(bill_notes), ''), amount, auth.uid())
    RETURNING * INTO bill;
  -- Payment info is mirrored on KOTs for backward-compat queries.
  UPDATE public.restaurant_orders
     SET status = 'completed', completed_at = now(), customer_name = trim(customer),
         payment_mode = mode, payment_reference = nullif(trim(reference), ''),
         bill_group_id = bill.id, notes = nullif(trim(bill_notes), '')
   WHERE id = ANY(kot_ids) AND org_id = oid;
  RETURN bill;
END; $$;
REVOKE ALL ON FUNCTION public.finalize_restaurant_bill(UUID,UUID[],TEXT,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finalize_restaurant_bill(UUID,UUID[],TEXT,TEXT,TEXT,TEXT,TEXT) TO authenticated;
COMMIT;
