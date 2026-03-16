-- Add missing columns to dark_web_id_reports for AI-extracted PDF data
ALTER TABLE dark_web_id_reports
  ADD COLUMN IF NOT EXISTS report_period_start TEXT,
  ADD COLUMN IF NOT EXISTS report_period_end TEXT,
  ADD COLUMN IF NOT EXISTS pdf_url TEXT,
  ADD COLUMN IF NOT EXISTS total_compromises INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS new_compromises INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS critical_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS high_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS medium_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS low_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS compromised_emails JSONB,
  ADD COLUMN IF NOT EXISTS breach_sources JSONB,
  ADD COLUMN IF NOT EXISTS compromises_detail JSONB;

-- Add missing column to dark_web_id_mappings for API sync
ALTER TABLE dark_web_id_mappings
  ADD COLUMN IF NOT EXISTS darkweb_organization_uuid TEXT;

-- 3CX Reports (manual PDF upload, AI-extracted)
CREATE TABLE IF NOT EXISTS threecx_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  customer_name TEXT,
  report_date TEXT,
  report_period_start TEXT,
  report_period_end TEXT,
  pdf_url TEXT,
  -- Key metrics
  total_extensions INTEGER DEFAULT 0,
  user_extensions INTEGER DEFAULT 0,
  ring_groups INTEGER DEFAULT 0,
  queues INTEGER DEFAULT 0,
  trunks INTEGER DEFAULT 0,
  total_calls INTEGER DEFAULT 0,
  inbound_calls INTEGER DEFAULT 0,
  outbound_calls INTEGER DEFAULT 0,
  missed_calls INTEGER DEFAULT 0,
  avg_call_duration TEXT,
  -- Detailed breakdown
  extensions_detail JSONB,
  call_stats JSONB,
  report_data JSONB,
  notes TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE threecx_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage threecx_reports"
  ON threecx_reports FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_threecx_reports_customer_id ON threecx_reports(customer_id);
