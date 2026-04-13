-- Audit trail for user management actions
CREATE TABLE IF NOT EXISTS user_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID,
  action TEXT NOT NULL,
  target_user_id UUID,
  target_email TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  created_date TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_audit_action ON user_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_user_audit_target ON user_audit_log(target_user_id);
CREATE INDEX IF NOT EXISTS idx_user_audit_date ON user_audit_log(created_date DESC);

ALTER TABLE user_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin only user_audit_log" ON user_audit_log FOR ALL
  USING (
    auth.jwt() ->> 'role' = 'service_role'
    OR EXISTS (SELECT 1 FROM users WHERE users.auth_id = auth.uid() AND users.role = 'admin')
  )
  WITH CHECK (
    auth.jwt() ->> 'role' = 'service_role'
    OR EXISTS (SELECT 1 FROM users WHERE users.auth_id = auth.uid() AND users.role = 'admin')
  );
