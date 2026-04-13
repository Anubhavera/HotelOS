-- ═══════════════════════════════════════════════════════════
-- KOT billing + room pre-booking support
-- ═══════════════════════════════════════════════════════════

-- Restaurant billing details for final customer bill and UPI/card receipt reference.
ALTER TABLE restaurant_orders
  ADD COLUMN IF NOT EXISTS customer_name TEXT,
  ADD COLUMN IF NOT EXISTS payment_reference TEXT,
  ADD COLUMN IF NOT EXISTS bill_group_id UUID;

-- Query performance helpers for booking overlap checks and kitchen dashboards.
CREATE INDEX IF NOT EXISTS idx_bookings_room_status_window
  ON bookings (room_id, status, check_in, expected_check_out);

CREATE INDEX IF NOT EXISTS idx_restaurant_orders_status_created
  ON restaurant_orders (org_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_restaurant_orders_bill_group
  ON restaurant_orders (org_id, bill_group_id);
