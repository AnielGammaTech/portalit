-- Fix existing snapshot data:
-- 1. Set reviewed_at to the sign-off's signed_at (not old individual review dates)
-- 2. Fix review_status: 'pending' → 'auto_matched' for matches, 'reviewed' for others
-- 3. Remove no_vendor_data / no_data tiles from snapshots (not part of sign-off)

-- 1. Fix reviewed_at to match the sign-off date
UPDATE reconciliation_snapshots s
SET reviewed_at = so.signed_at
FROM reconciliation_sign_offs so
WHERE s.sign_off_id = so.id
  AND (s.reviewed_at IS NULL OR s.reviewed_at != so.signed_at);

-- 2. Fix 'pending' review_status on matched tiles
UPDATE reconciliation_snapshots
SET review_status = 'auto_matched'
WHERE (review_status IS NULL OR review_status = 'pending')
  AND status = 'match';

-- 3. Fix 'pending' review_status on non-match tiles (they were accepted at sign-off)
UPDATE reconciliation_snapshots
SET review_status = 'reviewed'
WHERE (review_status IS NULL OR review_status = 'pending')
  AND status != 'match';

-- 4. Remove no_vendor_data / no_data tiles
DELETE FROM reconciliation_snapshots
WHERE status IN ('no_vendor_data', 'no_data');
