-- ============================================================
-- Consolidate Datto EDR rules: merge ATP into main EDR rule
-- Date: 2026-03-31
-- ============================================================

-- Step 1: Update the main EDR rule to also match ATP patterns
UPDATE reconciliation_rules
SET match_pattern = 'EDR|Advanced Threat Protection',
    label = 'Datto EDR'
WHERE integration_key = 'datto_edr'
  AND label = 'Datto EDR'
  AND match_pattern NOT LIKE '%Advanced Threat Protection%';

-- Step 2: Deactivate the standalone ATP rule (keep for audit, don't delete)
UPDATE reconciliation_rules
SET is_active = false
WHERE integration_key = 'datto_edr'
  AND label = 'Datto EDR - ATP';

-- Step 3: If there are duplicate active EDR rules, keep only the oldest one active
-- First, find and deactivate duplicates (keep the one with the earliest created_date)
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY integration_key, label ORDER BY created_date ASC) as rn
  FROM reconciliation_rules
  WHERE integration_key = 'datto_edr'
    AND label = 'Datto EDR'
    AND is_active = true
)
UPDATE reconciliation_rules
SET is_active = false
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);
