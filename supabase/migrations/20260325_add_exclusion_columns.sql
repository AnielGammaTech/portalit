-- Add exclusion tracking to reconciliation reviews
-- Allows marking vendor accounts as service accounts, free accounts, etc.
-- so they don't count against the licence total

ALTER TABLE reconciliation_reviews
  ADD COLUMN IF NOT EXISTS exclusion_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS exclusion_reason text;
