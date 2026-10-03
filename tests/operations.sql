SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
INSERT INTO public.rooms(org_id,room_number,rate_per_night) VALUES(current_setting('test.org_b')::uuid,'101',100);
INSERT INTO public.menu_items(org_id,name,price) VALUES(current_setting('test.org_b')::uuid,'Tea',25);
SELECT set_config('test.room',(SELECT id::text FROM public.rooms WHERE room_number='101'),false);
SELECT set_config('test.menu',(SELECT id::text FROM public.menu_items WHERE name='Tea'),false);
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',false);
INSERT INTO public.bookings(org_id,room_id,guest_name,guest_phone,check_in,expected_check_out,rate_per_night,status)
 VALUES(current_setting('test.org_b')::uuid,current_setting('test.room')::uuid,'Guest','123','2026-10-01T12:00Z','2026-10-03T11:00Z',100,'checked_in');
DO $$ DECLARE before_count INTEGER; BEGIN
 IF (SELECT status FROM public.rooms WHERE id=current_setting('test.room')::uuid) <> 'occupied' THEN RAISE EXCEPTION 'Room not occupied atomically'; END IF;
 BEGIN
  INSERT INTO public.bookings(org_id,room_id,guest_name,guest_phone,check_in,expected_check_out,rate_per_night,status)
   VALUES(current_setting('test.org_b')::uuid,current_setting('test.room')::uuid,'Overlap','456','2026-10-02T12:00Z','2026-10-04T11:00Z',100,'prebooked');
  RAISE EXCEPTION 'Overlap accepted';
 EXCEPTION WHEN exclusion_violation THEN NULL; END;
 BEGIN
  INSERT INTO public.bookings(org_id,room_id,guest_name,guest_phone,check_in,expected_check_out,rate_per_night,status)
   VALUES(current_setting('test.org_a')::uuid,current_setting('test.room')::uuid,'Cross tenant','456','2026-10-05T12:00Z','2026-10-06T11:00Z',100,'prebooked');
  RAISE EXCEPTION 'Cross tenant booking accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 SELECT count(*) INTO before_count FROM public.restaurant_orders;
 BEGIN
  PERFORM public.create_restaurant_order(current_setting('test.org_b')::uuid,'1','Guest','dine_in',
   jsonb_build_array(jsonb_build_object('menu_item_id',current_setting('test.menu'),'quantity',2),
    jsonb_build_object('menu_item_id','00000000-0000-0000-0000-000000000099','quantity',1)));
  RAISE EXCEPTION 'Missing menu accepted';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 IF (SELECT count(*) FROM public.restaurant_orders) <> before_count OR EXISTS(SELECT 1 FROM public.order_items) THEN RAISE EXCEPTION 'Partial order remained'; END IF;
 PERFORM public.create_restaurant_order(current_setting('test.org_b')::uuid,'1','Guest','dine_in',
  jsonb_build_array(jsonb_build_object('menu_item_id',current_setting('test.menu'),'quantity',2,'unit_price',0)));
 IF (SELECT total_amount FROM public.restaurant_orders LIMIT 1) <> 50 OR (SELECT total_price FROM public.order_items LIMIT 1) <> 50 THEN RAISE EXCEPTION 'Client forged menu price'; END IF;
END $$;
UPDATE public.bookings SET status='checked_out',check_out='2026-10-02T10:00Z' WHERE guest_name='Guest';
DO $$ BEGIN
 IF (SELECT status FROM public.rooms WHERE id=current_setting('test.room')::uuid) <> 'available' THEN RAISE EXCEPTION 'Room not released atomically'; END IF;
END $$;
RESET ROLE;
SELECT 'atomic operations regression checks passed';
