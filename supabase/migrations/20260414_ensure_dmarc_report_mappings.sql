-- Ensure dmarc_report_mappings table exists with all required columns
CREATE TABLE IF NOT EXISTS dmarc_report_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  customer_name TEXT,
  dmarc_account_id TEXT,
  dmarc_account_name TEXT,
  dmarc_domain_id TEXT,
  dmarc_domain_name TEXT,
  cached_data JSONB,
  last_synced TIMESTAMPTZ,
  created_date TIMESTAMPTZ DEFAULT now(),
  updated_date TIMESTAMPTZ DEFAULT now()
);

-- Add columns if they're missing (table may already exist without them)
ALTER TABLE dmarc_report_mappings ADD COLUMN IF NOT EXISTS dmarc_account_id TEXT;
ALTER TABLE dmarc_report_mappings ADD COLUMN IF NOT EXISTS dmarc_account_name TEXT;
ALTER TABLE dmarc_report_mappings ADD COLUMN IF NOT EXISTS dmarc_domain_id TEXT;
ALTER TABLE dmarc_report_mappings ADD COLUMN IF NOT EXISTS dmarc_domain_name TEXT;
ALTER TABLE dmarc_report_mappings ADD COLUMN IF NOT EXISTS customer_name TEXT;

CREATE INDEX IF NOT EXISTS idx_dmarc_mappings_customer ON dmarc_report_mappings(customer_id);

ALTER TABLE dmarc_report_mappings ENABLE ROW LEVEL SECURITY;

-- Use admin-only policy (drop the old overpermissive one if it exists)
DO $$ BEGIN
  DROP POLICY IF EXISTS "Authenticated users can manage dmarc_report_mappings" ON dmarc_report_mappings;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY IF NOT EXISTS "Admin only dmarc_report_mappings" ON dmarc_report_mappings FOR ALL
  USING (
    auth.jwt() ->> 'role' = 'service_role'
    OR EXISTS (SELECT 1 FROM users WHERE users.auth_id = auth.uid() AND users.role = 'admin')
  )
  WITH CHECK (
    auth.jwt() ->> 'role' = 'service_role'
    OR EXISTS (SELECT 1 FROM users WHERE users.auth_id = auth.uid() AND users.role = 'admin')
  );
