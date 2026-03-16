-- Inky email protection reports (manual PDF upload, AI-extracted)
CREATE TABLE IF NOT EXISTS inky_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  customer_name TEXT,
  report_date TEXT,
  report_period_start TEXT,
  report_period_end TEXT,
  pdf_url TEXT,
  -- Key metrics
  total_users INTEGER DEFAULT 0,
  total_emails_processed INTEGER DEFAULT 0,
  total_threats_blocked INTEGER DEFAULT 0,
  total_phishing_blocked INTEGER DEFAULT 0,
  total_spam_blocked INTEGER DEFAULT 0,
  total_malware_blocked INTEGER DEFAULT 0,
  total_impersonation_blocked INTEGER DEFAULT 0,
  threat_rate NUMERIC(5,2) DEFAULT 0,
  -- Detailed breakdown stored as JSONB
  threat_categories JSONB,
  top_targeted_users JSONB,
  report_data JSONB,
  notes TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE inky_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage inky_reports"
  ON inky_reports FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Index for customer lookup
CREATE INDEX IF NOT EXISTS idx_inky_reports_customer_id ON inky_reports(customer_id);
