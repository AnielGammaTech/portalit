-- Add AI classification columns to invoices
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS category TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS classification_confidence INTEGER DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_category ON invoices (category);
CREATE INDEX IF NOT EXISTS idx_invoices_customer_category ON invoices (customer_id, category);

-- Add category + acknowledgement columns to billing_anomalies
ALTER TABLE billing_anomalies
  ADD COLUMN IF NOT EXISTS category TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS flagged_on_customer BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS acknowledged_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS acknowledgement_notes TEXT;

-- Update status check constraint to include 'acknowledged'
ALTER TABLE billing_anomalies DROP CONSTRAINT IF EXISTS billing_anomalies_status_check;
ALTER TABLE billing_anomalies ADD CONSTRAINT billing_anomalies_status_check
  CHECK (status IN ('open', 'reviewed', 'dismissed', 'acknowledged'));

-- Update unique constraint to include category (one anomaly per customer+category+period)
DROP INDEX IF EXISTS idx_billing_anomalies_unique;
CREATE UNIQUE INDEX idx_billing_anomalies_unique ON billing_anomalies(customer_id, category, bill_period);
