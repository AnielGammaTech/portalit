-- supabase/migrations/20260417_add_reconciliation_snapshots.sql

-- 1. Reconciliation snapshots — one row per tile per sign-off
CREATE TABLE IF NOT EXISTS reconciliation_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL,
  sign_off_id UUID NOT NULL REFERENCES reconciliation_sign_offs(id) ON DELETE CASCADE,
  rule_id TEXT NOT NULL,
  label TEXT NOT NULL,
  integration_key TEXT,
  status TEXT NOT NULL,
  psa_qty INTEGER,
  vendor_qty INTEGER,
  difference INTEGER DEFAULT 0,
  exclusion_count INTEGER DEFAULT 0,
  exclusion_reason TEXT,
  review_status TEXT,
  review_notes TEXT,
  reviewed_by UUID,
  reviewed_by_name TEXT,
  reviewed_at TIMESTAMPTZ,
  override_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recon_snapshots_customer
  ON reconciliation_snapshots(customer_id);
CREATE INDEX IF NOT EXISTS idx_recon_snapshots_sign_off
  ON reconciliation_snapshots(sign_off_id);

-- 2. Add summary columns to reconciliation_sign_offs
ALTER TABLE reconciliation_sign_offs
  ADD COLUMN IF NOT EXISTS total_rules INTEGER,
  ADD COLUMN IF NOT EXISTS matched_count INTEGER,
  ADD COLUMN IF NOT EXISTS issues_count INTEGER,
  ADD COLUMN IF NOT EXISTS force_matched_count INTEGER,
  ADD COLUMN IF NOT EXISTS dismissed_count INTEGER,
  ADD COLUMN IF NOT EXISTS excluded_count INTEGER;

-- 3. RLS for snapshots
ALTER TABLE reconciliation_snapshots ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "admin_all_snapshots" ON reconciliation_snapshots
    FOR ALL USING (
      auth.jwt() ->> 'role' = 'service_role'
      OR auth.uid() IS NOT NULL
    )
    WITH CHECK (
      auth.jwt() ->> 'role' = 'service_role'
      OR auth.uid() IS NOT NULL
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
