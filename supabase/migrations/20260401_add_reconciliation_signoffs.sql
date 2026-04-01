-- ============================================================
-- Reconciliation Sign-Off System
-- Date: 2026-04-01
-- ============================================================

CREATE TABLE IF NOT EXISTS reconciliation_sign_offs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  signed_by UUID NOT NULL REFERENCES users(id),
  signed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'blocked', 'signed_off')),
  ai_verified BOOLEAN DEFAULT false,
  ai_confidence INTEGER DEFAULT 0,
  ai_summary TEXT,
  ai_issues JSONB DEFAULT '[]'::jsonb,
  manual_notes TEXT,
  reconciliation_snapshot JSONB,
  billing_period TEXT,
  created_date TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_signoffs_customer ON reconciliation_sign_offs(customer_id);
CREATE INDEX idx_signoffs_status ON reconciliation_sign_offs(status);
CREATE INDEX idx_signoffs_latest ON reconciliation_sign_offs(customer_id, signed_at DESC);

ALTER TABLE reconciliation_sign_offs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin only reconciliation_sign_offs" ON reconciliation_sign_offs FOR ALL
  USING (
    auth.jwt() ->> 'role' = 'service_role'
    OR EXISTS (SELECT 1 FROM users WHERE users.auth_id = auth.uid() AND users.role = 'admin')
  )
  WITH CHECK (
    auth.jwt() ->> 'role' = 'service_role'
    OR EXISTS (SELECT 1 FROM users WHERE users.auth_id = auth.uid() AND users.role = 'admin')
  );
