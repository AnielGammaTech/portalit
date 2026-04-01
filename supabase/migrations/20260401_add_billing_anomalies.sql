-- ============================================================
-- Billing Anomaly Detection — persistent alerts table
-- Date: 2026-04-01
-- ============================================================

CREATE TABLE IF NOT EXISTS billing_anomalies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  current_amount DECIMAL(12,2) NOT NULL,
  previous_avg DECIMAL(12,2) NOT NULL,
  pct_change DECIMAL(8,2) NOT NULL,
  dollar_change DECIMAL(12,2) NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('increase', 'decrease')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewed', 'dismissed')),
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  bill_period TEXT, -- e.g. "2026-03" for the month that triggered it
  created_date TIMESTAMPTZ DEFAULT now()
);

-- Index for dashboard queries
CREATE INDEX idx_billing_anomalies_status ON billing_anomalies(status);
CREATE INDEX idx_billing_anomalies_customer ON billing_anomalies(customer_id);
CREATE INDEX idx_billing_anomalies_detected ON billing_anomalies(detected_at DESC);

-- Unique constraint: one anomaly per customer per billing period
CREATE UNIQUE INDEX idx_billing_anomalies_unique ON billing_anomalies(customer_id, bill_period);

-- RLS: admin only
ALTER TABLE billing_anomalies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin only billing_anomalies" ON billing_anomalies FOR ALL
  USING (
    auth.jwt() ->> 'role' = 'service_role'
    OR EXISTS (SELECT 1 FROM users WHERE users.auth_id = auth.uid() AND users.role = 'admin')
  )
  WITH CHECK (
    auth.jwt() ->> 'role' = 'service_role'
    OR EXISTS (SELECT 1 FROM users WHERE users.auth_id = auth.uid() AND users.role = 'admin')
  );
