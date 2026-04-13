-- ═══════════════════════════════════════════════════════════
-- Restaurant Bills — separates final bill entity from KOTs
-- ═══════════════════════════════════════════════════════════
--
-- CONCEPT:
--   A KOT (restaurant_orders row) = one kitchen ticket for one send-to-kitchen event.
--   A TABLE SESSION can have MANY KOTs.
--   A BILL = the final checkout document that groups 1..N KOTs under one payment.
--
-- restaurant_orders.bill_group_id → restaurant_bills.id  (FK added below)
--
-- WHY we NULL out existing bill_group_id values first:
--   Migration 003 added bill_group_id as a plain UUID column (no FK).
--   The old finalize code stamped it with crypto.randomUUID() client-side
--   without writing any corresponding row to a bills table.
--   Those UUIDs are therefore orphaned and would violate the FK we add here.
--   Clearing them is safe — the completed_at, payment_mode, customer_name
--   fields on each KOT row still preserve all historical billing context.
-- ─────────────────────────────────────────────────────────

-- Step 1: Create the bills table
CREATE TABLE IF NOT EXISTS restaurant_bills (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID          NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  table_number  TEXT,
  customer_name TEXT          NOT NULL,
  payment_mode  TEXT          NOT NULL DEFAULT 'cash',
  payment_reference TEXT,
  notes         TEXT,
  total_amount  DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_by    UUID          REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ   DEFAULT now()
);

-- Step 2: Enable RLS on the new table
ALTER TABLE restaurant_bills ENABLE ROW LEVEL SECURITY;

-- Reuse the existing security-definer helper (defined in migration 002)
CREATE POLICY "bills_all" ON restaurant_bills FOR ALL
  USING (org_id IN (SELECT get_user_org_ids(auth.uid())));

-- Step 3: Clear orphaned bill_group_id values.
--   These are random UUIDs written by the old client-side finalize flow.
--   They cannot satisfy the FK we're about to add because restaurant_bills
--   has zero rows at this point.
UPDATE restaurant_orders
  SET bill_group_id = NULL
  WHERE bill_group_id IS NOT NULL;

-- Step 4: Drop the constraint if a previous aborted run left it half-applied,
--   then add it cleanly.
ALTER TABLE restaurant_orders
  DROP CONSTRAINT IF EXISTS fk_order_bill;

ALTER TABLE restaurant_orders
  ADD CONSTRAINT fk_order_bill
  FOREIGN KEY (bill_group_id)
  REFERENCES restaurant_bills(id)
  ON DELETE SET NULL
  DEFERRABLE INITIALLY DEFERRED;

-- Step 5: Performance index on the bills table
CREATE INDEX IF NOT EXISTS idx_restaurant_bills_org_created
  ON restaurant_bills (org_id, created_at DESC);
