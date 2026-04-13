-- ═══════════════════════════════════════════════════════════
-- Track kitchen serve timing for KOTs
-- ═══════════════════════════════════════════════════════════

ALTER TABLE restaurant_orders
  ADD COLUMN IF NOT EXISTS prepared_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_restaurant_orders_org_prepared
  ON restaurant_orders (org_id, prepared_at DESC);
