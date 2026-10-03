-- Preserve same-organization pre-booking edits under atomic room synchronization.
BEGIN;
CREATE OR REPLACE FUNCTION public.guard_booking_room() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE room_status TEXT;
BEGIN
  IF NOT public.has_org_role(NEW.org_id, ARRAY['owner','manager','staff']) THEN
    RAISE EXCEPTION 'Organization access required' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.org_id IS DISTINCT FROM OLD.org_id THEN
      RAISE EXCEPTION 'A booking cannot move between organizations' USING ERRCODE = '22023';
    END IF;
    IF NEW.room_id IS DISTINCT FROM OLD.room_id AND
       (NEW.status IS DISTINCT FROM 'prebooked' OR OLD.status IS DISTINCT FROM 'prebooked') THEN
      RAISE EXCEPTION 'Only a pre-booking can move rooms' USING ERRCODE = '22023';
    END IF;
    -- Opposite room reassignments acquire locks in the same order.
    PERFORM id FROM public.rooms WHERE id IN (OLD.room_id, NEW.room_id) AND org_id = NEW.org_id ORDER BY id FOR UPDATE;
  ELSE
    PERFORM id FROM public.rooms WHERE id = NEW.room_id AND org_id = NEW.org_id FOR UPDATE;
  END IF;
  SELECT status INTO room_status FROM public.rooms WHERE id = NEW.room_id AND org_id = NEW.org_id;
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

CREATE OR REPLACE FUNCTION public.sync_booking_room() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE old_rid UUID; new_rid UUID;
BEGIN
  IF TG_OP <> 'INSERT' THEN old_rid := OLD.room_id; END IF;
  IF TG_OP <> 'DELETE' THEN new_rid := NEW.room_id; END IF;
  UPDATE public.rooms r SET status = CASE WHEN EXISTS (
    SELECT 1 FROM public.bookings b WHERE b.room_id = r.id AND b.status = 'checked_in'
  ) THEN 'occupied' ELSE 'available' END WHERE r.id IN (old_rid, new_rid) AND r.status <> 'maintenance';
  RETURN NULL;
END; $$;
REVOKE ALL ON FUNCTION public.sync_booking_room() FROM PUBLIC;

COMMIT;
