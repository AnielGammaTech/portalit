-- Create pax8_line_item_overrides table if it doesn't exist
-- This table stores manual mappings between Pax8 subscriptions and HaloPSA line items
CREATE TABLE IF NOT EXISTS pax8_line_item_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  rule_id TEXT,
  pax8_product_name TEXT,
  line_item_id UUID,
  group_id TEXT,
  created_date TIMESTAMPTZ DEFAULT now(),
  updated_date TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_pax8_overrides_customer ON pax8_line_item_overrides(customer_id);
CREATE INDEX IF NOT EXISTS idx_pax8_overrides_rule ON pax8_line_item_overrides(rule_id);
CREATE INDEX IF NOT EXISTS idx_pax8_overrides_group ON pax8_line_item_overrides(group_id) WHERE group_id IS NOT NULL;

-- RLS
ALTER TABLE pax8_line_item_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access pax8_line_item_overrides" ON pax8_line_item_overrides FOR ALL
  USING (
    auth.jwt() ->> 'role' = 'service_role'
    OR EXISTS (SELECT 1 FROM users WHERE users.auth_id = auth.uid() AND users.role = 'admin')
  )
  WITH CHECK (
    auth.jwt() ->> 'role' = 'service_role'
    OR EXISTS (SELECT 1 FROM users WHERE users.auth_id = auth.uid() AND users.role = 'admin')
  );
