-- ═══════════════════════════════════════════════════════════
-- RLS FIX — Run this in Supabase SQL Editor
-- Fixes: infinite recursion in org_members policy (error 42P17)
-- ═══════════════════════════════════════════════════════════

-- Drop all existing policies first
DROP POLICY IF EXISTS "Users can view their organizations" ON organizations;
DROP POLICY IF EXISTS "Owners can update their organizations" ON organizations;
DROP POLICY IF EXISTS "Users can create organizations" ON organizations;
DROP POLICY IF EXISTS "Members can view org members" ON org_members;
DROP POLICY IF EXISTS "Users can create org memberships" ON org_members;
DROP POLICY IF EXISTS "Org access for rooms" ON rooms;
DROP POLICY IF EXISTS "Org access for bookings" ON bookings;
DROP POLICY IF EXISTS "Org access for menu_items" ON menu_items;
DROP POLICY IF EXISTS "Org access for restaurant_orders" ON restaurant_orders;
DROP POLICY IF EXISTS "Org access for order_items" ON order_items;
DROP POLICY IF EXISTS "Org access for salaries" ON salaries;
DROP POLICY IF EXISTS "Org access for expenses" ON expenses;
DROP POLICY IF EXISTS "Org access for utility_bills" ON utility_bills;

-- ─── Security definer function ───────────────────────────────────────────────
-- This breaks the recursion: function runs as the definer (postgres), not the
-- calling user, so RLS is not applied when it queries org_members internally.
CREATE OR REPLACE FUNCTION get_user_org_ids(uid UUID)
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT org_id FROM org_members WHERE user_id = uid;
$$;

-- ─── Organizations ───────────────────────────────────────────────────────────
CREATE POLICY "org_select" ON organizations
  FOR SELECT USING (id IN (SELECT get_user_org_ids(auth.uid())));

CREATE POLICY "org_insert" ON organizations
  FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "org_update" ON organizations
  FOR UPDATE USING (owner_id = auth.uid());

-- ─── Org Members ─────────────────────────────────────────────────────────────
-- Use the security definer function to avoid self-referential recursion
CREATE POLICY "orgmem_select" ON org_members
  FOR SELECT USING (org_id IN (SELECT get_user_org_ids(auth.uid())));

CREATE POLICY "orgmem_insert" ON org_members
  FOR INSERT WITH CHECK (true);  -- Controlled by server-side logic

-- ─── All other tables — reuse the safe function ──────────────────────────────
CREATE POLICY "rooms_all" ON rooms FOR ALL
  USING (org_id IN (SELECT get_user_org_ids(auth.uid())));

CREATE POLICY "bookings_all" ON bookings FOR ALL
  USING (org_id IN (SELECT get_user_org_ids(auth.uid())));

CREATE POLICY "menu_items_all" ON menu_items FOR ALL
  USING (org_id IN (SELECT get_user_org_ids(auth.uid())));

CREATE POLICY "orders_all" ON restaurant_orders FOR ALL
  USING (org_id IN (SELECT get_user_org_ids(auth.uid())));

CREATE POLICY "order_items_all" ON order_items FOR ALL
  USING (order_id IN (
    SELECT id FROM restaurant_orders
    WHERE org_id IN (SELECT get_user_org_ids(auth.uid()))
  ));

CREATE POLICY "salaries_all" ON salaries FOR ALL
  USING (org_id IN (SELECT get_user_org_ids(auth.uid())));

CREATE POLICY "expenses_all" ON expenses FOR ALL
  USING (org_id IN (SELECT get_user_org_ids(auth.uid())));

CREATE POLICY "utility_bills_all" ON utility_bills FOR ALL
  USING (org_id IN (SELECT get_user_org_ids(auth.uid())));
