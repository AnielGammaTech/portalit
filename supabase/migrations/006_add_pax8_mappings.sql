-- Pax8 customer mappings for M365 license tracking
CREATE TABLE IF NOT EXISTS pax8_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  customer_name TEXT,
  pax8_company_id TEXT NOT NULL,
  pax8_company_name TEXT,
  cached_data JSONB,
  last_synced TIMESTAMPTZ,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pax8_mappings_customer_id ON pax8_mappings(customer_id);
CREATE UNIQUE INDEX idx_pax8_mappings_pax8_company_id ON pax8_mappings(pax8_company_id);

ALTER TABLE pax8_mappings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage pax8_mappings" ON pax8_mappings FOR ALL USING (true) WITH CHECK (true);
