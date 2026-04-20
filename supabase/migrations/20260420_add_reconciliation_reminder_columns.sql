-- Add exclusion verification tracking to reconciliation_reviews
ALTER TABLE reconciliation_reviews
ADD COLUMN IF NOT EXISTS exclusion_verified_at TIMESTAMPTZ;

-- Backfill: set exclusion_verified_at for existing exclusions
UPDATE reconciliation_reviews
SET exclusion_verified_at = COALESCE(updated_date, created_date)
WHERE exclusion_count > 0 AND exclusion_verified_at IS NULL;

-- Add reminder dedup tracking to reconciliation_sign_offs
ALTER TABLE reconciliation_sign_offs
ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;
