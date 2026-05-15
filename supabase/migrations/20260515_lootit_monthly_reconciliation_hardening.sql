-- LootIT monthly reconciliation hardening
-- Keeps the existing sign-off/review model, but makes the monthly period fields explicit.

ALTER TABLE reconciliation_sign_offs
  ADD COLUMN IF NOT EXISTS next_reconciliation_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_signoffs_customer_period
  ON reconciliation_sign_offs(customer_id, billing_period);

CREATE INDEX IF NOT EXISTS idx_signoffs_next_reconciliation
  ON reconciliation_sign_offs(next_reconciliation_date)
  WHERE next_reconciliation_date IS NOT NULL;

ALTER TABLE reconciliation_reviews
  ADD COLUMN IF NOT EXISTS reviewed_by_name TEXT,
  ADD COLUMN IF NOT EXISTS exclusion_verified_at TIMESTAMPTZ;

ALTER TABLE reconciliation_review_history
  ADD COLUMN IF NOT EXISTS created_by_name TEXT;

UPDATE reconciliation_reviews
SET exclusion_verified_at = COALESCE(updated_date, created_date)
WHERE exclusion_count > 0 AND exclusion_verified_at IS NULL;
