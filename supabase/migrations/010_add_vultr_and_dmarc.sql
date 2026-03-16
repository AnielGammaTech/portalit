-- Vultr cloud mappings (links Vultr instances to customers, associated with 3CX)
CREATE TABLE IF NOT EXISTS vultr_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  customer_name TEXT,
  vultr_instance_id TEXT NOT NULL,
  vultr_instance_label TEXT,
  vultr_plan TEXT,
  vultr_region TEXT,
  cached_data JSONB,
  last_synced TIMESTAMPTZ,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE vultr_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage vultr_mappings"
  ON vultr_mappings FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_vultr_mappings_customer_id ON vultr_mappings(customer_id);

-- Add RLS policy for dmarc_report_mappings (was missing)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'dmarc_report_mappings'
  ) THEN
    CREATE POLICY "Authenticated users can manage dmarc_report_mappings"
      ON dmarc_report_mappings FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
