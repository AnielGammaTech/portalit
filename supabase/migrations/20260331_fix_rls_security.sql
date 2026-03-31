-- ============================================================
-- SECURITY FIX: Restrict overpermissive RLS policies
-- Date: 2026-03-31
-- Audit: .planning/SECURITY-AUDIT.md (C-1, C-2, C-3)
-- ============================================================

-- Helper: admin check subquery
-- Checks if the current user is an admin via the users table
-- Also allows service_role (backend server calls)

-- ── pax8_mappings ──
DROP POLICY IF EXISTS "Authenticated users can manage pax8_mappings" ON pax8_mappings;
CREATE POLICY "Admin only pax8_mappings" ON pax8_mappings FOR ALL
  USING (
    auth.jwt() ->> 'role' = 'service_role'
    OR EXISTS (SELECT 1 FROM users WHERE users.auth_id = auth.uid() AND users.role = 'admin')
  )
  WITH CHECK (
    auth.jwt() ->> 'role' = 'service_role'
    OR EXISTS (SELECT 1 FROM users WHERE users.auth_id = auth.uid() AND users.role = 'admin')
  );

-- ── inky_reports ──
DROP POLICY IF EXISTS "Authenticated users can manage inky_reports" ON inky_reports;
CREATE POLICY "Admin only inky_reports" ON inky_reports FOR ALL
  USING (
    auth.jwt() ->> 'role' = 'service_role'
    OR EXISTS (SELECT 1 FROM users WHERE users.auth_id = auth.uid() AND users.role = 'admin')
  )
  WITH CHECK (
    auth.jwt() ->> 'role' = 'service_role'
    OR EXISTS (SELECT 1 FROM users WHERE users.auth_id = auth.uid() AND users.role = 'admin')
  );

-- ── threecx_mappings ──
DROP POLICY IF EXISTS "Authenticated users can manage threecx_mappings" ON threecx_mappings;
CREATE POLICY "Admin only threecx_mappings" ON threecx_mappings FOR ALL
  USING (
    auth.jwt() ->> 'role' = 'service_role'
    OR EXISTS (SELECT 1 FROM users WHERE users.auth_id = auth.uid() AND users.role = 'admin')
  )
  WITH CHECK (
    auth.jwt() ->> 'role' = 'service_role'
    OR EXISTS (SELECT 1 FROM users WHERE users.auth_id = auth.uid() AND users.role = 'admin')
  );

-- ── threecx_reports ──
DROP POLICY IF EXISTS "Authenticated users can manage threecx_reports" ON threecx_reports;
CREATE POLICY "Admin only threecx_reports" ON threecx_reports FOR ALL
  USING (
    auth.jwt() ->> 'role' = 'service_role'
    OR EXISTS (SELECT 1 FROM users WHERE users.auth_id = auth.uid() AND users.role = 'admin')
  )
  WITH CHECK (
    auth.jwt() ->> 'role' = 'service_role'
    OR EXISTS (SELECT 1 FROM users WHERE users.auth_id = auth.uid() AND users.role = 'admin')
  );

-- ── vultr_mappings ──
DROP POLICY IF EXISTS "Authenticated users can manage vultr_mappings" ON vultr_mappings;
CREATE POLICY "Admin only vultr_mappings" ON vultr_mappings FOR ALL
  USING (
    auth.jwt() ->> 'role' = 'service_role'
    OR EXISTS (SELECT 1 FROM users WHERE users.auth_id = auth.uid() AND users.role = 'admin')
  )
  WITH CHECK (
    auth.jwt() ->> 'role' = 'service_role'
    OR EXISTS (SELECT 1 FROM users WHERE users.auth_id = auth.uid() AND users.role = 'admin')
  );

-- ── dmarc_report_mappings ──
DROP POLICY IF EXISTS "Authenticated users can manage dmarc_report_mappings" ON dmarc_report_mappings;
CREATE POLICY "Admin only dmarc_report_mappings" ON dmarc_report_mappings FOR ALL
  USING (
    auth.jwt() ->> 'role' = 'service_role'
    OR EXISTS (SELECT 1 FROM users WHERE users.auth_id = auth.uid() AND users.role = 'admin')
  )
  WITH CHECK (
    auth.jwt() ->> 'role' = 'service_role'
    OR EXISTS (SELECT 1 FROM users WHERE users.auth_id = auth.uid() AND users.role = 'admin')
  );

-- ── vpentest_mappings ──
DROP POLICY IF EXISTS "Authenticated users can manage vpentest_mappings" ON vpentest_mappings;
CREATE POLICY "Admin only vpentest_mappings" ON vpentest_mappings FOR ALL
  USING (
    auth.jwt() ->> 'role' = 'service_role'
    OR EXISTS (SELECT 1 FROM users WHERE users.auth_id = auth.uid() AND users.role = 'admin')
  )
  WITH CHECK (
    auth.jwt() ->> 'role' = 'service_role'
    OR EXISTS (SELECT 1 FROM users WHERE users.auth_id = auth.uid() AND users.role = 'admin')
  );

-- ── cron_job_runs ──
DROP POLICY IF EXISTS "Service role can manage cron_job_runs" ON cron_job_runs;
CREATE POLICY "Admin only cron_job_runs" ON cron_job_runs FOR ALL
  USING (
    auth.jwt() ->> 'role' = 'service_role'
    OR EXISTS (SELECT 1 FROM users WHERE users.auth_id = auth.uid() AND users.role = 'admin')
  )
  WITH CHECK (
    auth.jwt() ->> 'role' = 'service_role'
    OR EXISTS (SELECT 1 FROM users WHERE users.auth_id = auth.uid() AND users.role = 'admin')
  );

-- ── settings (restrict from all-authenticated to admin-only) ──
DROP POLICY IF EXISTS "Authenticated read" ON settings;
CREATE POLICY "Admin only settings read" ON settings FOR SELECT
  USING (
    auth.jwt() ->> 'role' = 'service_role'
    OR EXISTS (SELECT 1 FROM users WHERE users.auth_id = auth.uid() AND users.role = 'admin')
  );

-- Keep write as admin-only (should already exist but ensure)
DROP POLICY IF EXISTS "Admin write" ON settings;
CREATE POLICY "Admin only settings write" ON settings FOR ALL
  USING (
    auth.jwt() ->> 'role' = 'service_role'
    OR EXISTS (SELECT 1 FROM users WHERE users.auth_id = auth.uid() AND users.role = 'admin')
  )
  WITH CHECK (
    auth.jwt() ->> 'role' = 'service_role'
    OR EXISTS (SELECT 1 FROM users WHERE users.auth_id = auth.uid() AND users.role = 'admin')
  );
