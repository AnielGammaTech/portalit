-- =====================================================
-- RLS Security Test Script
-- Run in Supabase SQL Editor to verify policies work
-- =====================================================

-- Test 1: Check all tables have RLS enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename NOT LIKE 'pg_%'
ORDER BY rowsecurity ASC, tablename;
-- EXPECT: All tables should show rowsecurity = true

-- Test 2: List all RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
-- EXPECT: Every table should have at least one policy
-- Integration tables should show "Admin only" policies

-- Test 3: Check sensitive tables have admin-only policies
SELECT tablename, policyname
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'settings', 'portal_settings',
    'pax8_mappings', 'inky_reports', 'threecx_mappings', 'threecx_reports',
    'vultr_mappings', 'dmarc_report_mappings', 'vpentest_mappings',
    'cron_job_runs', 'sync_logs', 'activities',
    'billing_anomalies', 'reconciliation_sign_offs',
    'recurring_bill_line_items', 'invoice_line_items',
    'contracts', 'contract_items', 'quotes'
  )
ORDER BY tablename;
-- EXPECT: All should show "Admin only" policies, NOT "Authenticated users can manage"

-- Test 4: Check for any remaining overpermissive policies
SELECT tablename, policyname
FROM pg_policies
WHERE schemaname = 'public'
  AND policyname LIKE '%Authenticated users can manage%';
-- EXPECT: Zero rows — all these should have been replaced with admin-only policies

-- Test 5: Verify status constraint on billing_anomalies
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'billing_anomalies'::regclass
  AND contype = 'c';
-- EXPECT: Should include 'acknowledged' in the check constraint
