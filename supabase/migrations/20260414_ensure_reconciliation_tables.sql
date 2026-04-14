-- Ensure reconciliation_reviews table exists with all required columns
CREATE TABLE IF NOT EXISTS reconciliation_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  rule_id TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  notes TEXT,
  psa_qty NUMERIC,
  vendor_qty NUMERIC,
  exclusion_count INTEGER DEFAULT 0,
  exclusion_reason TEXT,
  created_date TIMESTAMPTZ DEFAULT now(),
  updated_date TIMESTAMPTZ DEFAULT now()
);

-- The upsert constraint the code depends on
CREATE UNIQUE INDEX IF NOT EXISTS idx_recon_reviews_customer_rule
  ON reconciliation_reviews(customer_id, rule_id);

CREATE INDEX IF NOT EXISTS idx_recon_reviews_customer ON reconciliation_reviews(customer_id);

ALTER TABLE reconciliation_reviews ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Admin full access reconciliation_reviews" ON reconciliation_reviews FOR ALL
    USING (
      auth.jwt() ->> 'role' = 'service_role'
      OR EXISTS (SELECT 1 FROM users WHERE users.auth_id = auth.uid() AND users.role = 'admin')
    )
    WITH CHECK (
      auth.jwt() ->> 'role' = 'service_role'
      OR EXISTS (SELECT 1 FROM users WHERE users.auth_id = auth.uid() AND users.role = 'admin')
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add missing columns if table already existed
ALTER TABLE reconciliation_reviews ADD COLUMN IF NOT EXISTS exclusion_count INTEGER DEFAULT 0;
ALTER TABLE reconciliation_reviews ADD COLUMN IF NOT EXISTS exclusion_reason TEXT;
ALTER TABLE reconciliation_reviews ADD COLUMN IF NOT EXISTS psa_qty NUMERIC;
ALTER TABLE reconciliation_reviews ADD COLUMN IF NOT EXISTS vendor_qty NUMERIC;

-- Ensure reconciliation_review_history table exists
CREATE TABLE IF NOT EXISTS reconciliation_review_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID,
  customer_id UUID NOT NULL,
  rule_id TEXT,
  action TEXT,
  status TEXT,
  notes TEXT,
  psa_qty NUMERIC,
  vendor_qty NUMERIC,
  created_by UUID,
  created_date TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recon_history_customer ON reconciliation_review_history(customer_id);
CREATE INDEX IF NOT EXISTS idx_recon_history_review ON reconciliation_review_history(review_id);

ALTER TABLE reconciliation_review_history ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Admin full access reconciliation_review_history" ON reconciliation_review_history FOR ALL
    USING (
      auth.jwt() ->> 'role' = 'service_role'
      OR EXISTS (SELECT 1 FROM users WHERE users.auth_id = auth.uid() AND users.role = 'admin')
    )
    WITH CHECK (
      auth.jwt() ->> 'role' = 'service_role'
      OR EXISTS (SELECT 1 FROM users WHERE users.auth_id = auth.uid() AND users.role = 'admin')
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Ensure reconciliation_rules table exists
CREATE TABLE IF NOT EXISTS reconciliation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_key TEXT,
  label TEXT,
  description TEXT,
  match_field TEXT DEFAULT 'description',
  match_pattern TEXT,
  is_active BOOLEAN DEFAULT true,
  created_date TIMESTAMPTZ DEFAULT now(),
  updated_date TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE reconciliation_rules ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Admin full access reconciliation_rules" ON reconciliation_rules FOR ALL
    USING (
      auth.jwt() ->> 'role' = 'service_role'
      OR EXISTS (SELECT 1 FROM users WHERE users.auth_id = auth.uid() AND users.role = 'admin')
    )
    WITH CHECK (
      auth.jwt() ->> 'role' = 'service_role'
      OR EXISTS (SELECT 1 FROM users WHERE users.auth_id = auth.uid() AND users.role = 'admin')
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
