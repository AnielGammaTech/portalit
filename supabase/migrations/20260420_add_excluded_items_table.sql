-- Dynamic item-level exclusions for LootIT reconciliation
-- Replaces static exclusion_count for integrations with item-level vendor data

CREATE TABLE IF NOT EXISTS reconciliation_excluded_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL,
  rule_id TEXT NOT NULL,
  vendor_item_id TEXT NOT NULL,
  vendor_item_label TEXT NOT NULL,
  reason TEXT,
  excluded_by UUID,
  excluded_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(customer_id, rule_id, vendor_item_id)
);

-- Index for fast lookups by customer + rule
CREATE INDEX idx_excluded_items_customer_rule
  ON reconciliation_excluded_items(customer_id, rule_id);

-- RLS: authenticated users can read/write
ALTER TABLE reconciliation_excluded_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage excluded items"
  ON reconciliation_excluded_items
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
