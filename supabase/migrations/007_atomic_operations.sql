-- Review existing overlapping/invalid bookings before applying this migration.
BEGIN;
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE public.rooms ADD CONSTRAINT rooms_id_org_unique UNIQUE (id, org_id);
ALTER TABLE public.bookings ADD CONSTRAINT booking_room_tenant
  FOREIGN KEY (room_id, org_id) REFERENCES public.rooms(id, org_id);
ALTER TABLE public.bookings ADD CONSTRAINT booking_valid_window CHECK (
  coalesce(check_out, expected_check_out, 'infinity'::timestamptz) > check_in
);
ALTER TABLE public.bookings ADD CONSTRAINT booking_no_overlap
  EXCLUDE USING gist (room_id WITH =,
    tstzrange(check_in, coalesce(check_out, expected_check_out, 'infinity'::timestamptz), '[)') WITH &&)
  WHERE (status IN ('checked_in', 'prebooked'));

CREATE FUNCTION public.guard_booking_room() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE room_status TEXT;
BEGIN
  IF NOT public.has_org_role(NEW.org_id, ARRAY['owner','manager','staff']) THEN
    RAISE EXCEPTION 'Organization access required' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'UPDATE' AND (NEW.room_id IS DISTINCT FROM OLD.room_id OR NEW.org_id IS DISTINCT FROM OLD.org_id) THEN
    RAISE EXCEPTION 'A booking cannot move between rooms or organizations' USING ERRCODE = '22023';
  END IF;
  SELECT status INTO room_status FROM public.rooms WHERE id = NEW.room_id AND org_id = NEW.org_id FOR UPDATE;
  IF room_status IS NULL THEN RAISE EXCEPTION 'Room not found' USING ERRCODE = '22023'; END IF;
  IF NEW.status IN ('checked_in','prebooked') AND room_status = 'maintenance' THEN
    RAISE EXCEPTION 'Room is under maintenance' USING ERRCODE = '22023';
  END IF;
  IF NEW.status = 'checked_in' AND EXISTS (
    SELECT 1 FROM public.bookings WHERE room_id = NEW.room_id AND status = 'checked_in' AND id <> NEW.id
  ) THEN RAISE EXCEPTION 'Room already has a checked-in guest' USING ERRCODE = '23P01'; END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.guard_booking_room() FROM PUBLIC;
CREATE TRIGGER booking_room_guard BEFORE INSERT OR UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.guard_booking_room();

CREATE FUNCTION public.sync_booking_room() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE rid UUID;
BEGIN
  rid := CASE WHEN TG_OP = 'DELETE' THEN OLD.room_id ELSE NEW.room_id END;
  UPDATE public.rooms SET status = CASE WHEN EXISTS (
    SELECT 1 FROM public.bookings WHERE room_id = rid AND status = 'checked_in'
  ) THEN 'occupied' ELSE 'available' END WHERE id = rid AND status <> 'maintenance';
  RETURN NULL;
END; $$;
REVOKE ALL ON FUNCTION public.sync_booking_room() FROM PUBLIC;
CREATE TRIGGER booking_room_sync AFTER INSERT OR UPDATE OR DELETE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.sync_booking_room();

CREATE FUNCTION public.create_restaurant_order(oid UUID, table_label TEXT, customer TEXT, kind TEXT, items JSONB)
RETURNS public.restaurant_orders LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE ticket public.restaurant_orders; entry JSONB; menu public.menu_items; qty INTEGER; amount NUMERIC := 0;
BEGIN
  IF NOT public.has_org_role(oid, ARRAY['owner','manager','staff']) THEN
    RAISE EXCEPTION 'Organization access required' USING ERRCODE = '42501';
  END IF;
  IF kind IS NULL OR kind NOT IN ('dine_in','takeaway','delivery')
    OR items IS NULL OR jsonb_typeof(items) <> 'array' OR jsonb_array_length(items) NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'Invalid order' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.restaurant_orders(org_id,table_number,customer_name,order_type,status,created_by)
    VALUES(oid,nullif(trim(table_label),''),nullif(trim(customer),''),kind,'active',auth.uid()) RETURNING * INTO ticket;
  FOR entry IN SELECT value FROM jsonb_array_elements(items) LOOP
    qty := (entry->>'quantity')::INTEGER;
    IF qty IS NULL OR qty NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'Invalid quantity' USING ERRCODE = '22023'; END IF;
    SELECT * INTO menu FROM public.menu_items WHERE id = (entry->>'menu_item_id')::UUID AND org_id = oid AND is_available;
    IF menu.id IS NULL OR menu.price < 0 THEN RAISE EXCEPTION 'Menu item unavailable' USING ERRCODE = '22023'; END IF;
    INSERT INTO public.order_items(order_id,menu_item_id,item_name,quantity,unit_price,total_price)
      VALUES(ticket.id,menu.id,menu.name,qty,menu.price,qty*menu.price);
    amount := amount + qty*menu.price;
  END LOOP;
  UPDATE public.restaurant_orders SET total_amount = amount WHERE id = ticket.id RETURNING * INTO ticket;
  RETURN ticket;
END; $$;
REVOKE ALL ON FUNCTION public.create_restaurant_order(UUID,TEXT,TEXT,TEXT,JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_restaurant_order(UUID,TEXT,TEXT,TEXT,JSONB) TO authenticated;
COMMIT;
