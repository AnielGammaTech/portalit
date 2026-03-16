-- 3CX VoIP mappings (per-customer API credentials)
CREATE TABLE IF NOT EXISTS threecx_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  customer_name TEXT,
  instance_url TEXT,           -- e.g. https://mycompany.3cx.us:5001
  api_key TEXT,                -- 3CX API key or client credentials
  api_secret TEXT,             -- 3CX API secret (if needed)
  instance_name TEXT,          -- Friendly name for the instance
  cached_data JSONB,           -- Cached extension counts, user data
  last_synced TIMESTAMPTZ,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE threecx_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage threecx_mappings"
  ON threecx_mappings FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_threecx_mappings_customer_id ON threecx_mappings(customer_id);
