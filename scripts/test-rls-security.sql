-- =====================================================
-- RLS Security Test Script
-- Run in Supabase SQL Editor to verify policies work
-- =====================================================
-- Updated 2026-04-28: now flags ANY permissive policy regardless of
-- name. The old version only matched "Authenticated users can manage"
-- and missed broad policies created with other names (e.g.
-- "admin_all_snapshots" with USING auth.uid() IS NOT NULL).

-- Test 1: Every public table has RLS enabled.
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename NOT LIKE 'pg_%'
ORDER BY rowsecurity ASC, tablename;
-- EXPECT: All tables show rowsecurity = true.

-- Test 2: List every policy.
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual::text
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
-- EXPECT: Every table has at least one policy.

-- Test 3: ANY policy whose USING clause is broadly permissive.
-- These are tenant-isolation breakers regardless of policy name.
SELECT tablename, policyname, qual::text AS using_clause
FROM pg_policies
WHERE schemaname = 'public'
  AND (
    qual::text = 'true'
    OR qual::text ILIKE '%auth.uid() IS NOT NULL%'
    OR qual::text ILIKE '%(true)%'
  )
  AND policyname NOT ILIKE '%admin%'
  AND policyname NOT ILIKE '%service%'
ORDER BY tablename, policyname;
-- EXPECT: Zero rows. Any row here is a tenant-data leak.

-- Test 4: Tables that hold customer data must NOT have an "Authenticated read"
-- style policy that ignores customer_id.
SELECT p.tablename, p.policyname, p.qual::text
FROM pg_policies p
WHERE p.schemaname = 'public'
  AND p.tablename IN (
    'invoices','invoice_line_items',
    'recurring_bills','recurring_bill_line_items',
    'contracts','contract_items',
    'quotes','quote_items',
    'tickets','contacts','devices','saas_licenses',
    'reconciliation_snapshots','reconciliation_excluded_items',
    'reconciliation_reviews','reconciliation_sign_offs',
    'pax8_line_item_overrides','billing_anomalies'
  )
  AND p.qual::text ILIKE '%auth.uid() IS NOT NULL%'
ORDER BY p.tablename, p.policyname;
-- EXPECT: Zero rows.

-- Test 5: Columns whose name suggests a credential, exposed to authenticated.
-- Catches future regressions where a vendor secret is added without
-- being moved to an admin-only table.
SELECT
  c.table_name,
  c.column_name,
  has_column_privilege('authenticated', c.table_schema || '.' || c.table_name, c.column_name, 'SELECT') AS authenticated_can_read
FROM information_schema.columns c
WHERE c.table_schema = 'public'
  AND (
    c.column_name ILIKE '%api_key%'
    OR c.column_name ILIKE '%secret%'
    OR c.column_name ILIKE '%password%'
    OR (c.column_name ILIKE '%token%' AND c.column_name NOT ILIKE 'mapbox%')
  )
ORDER BY c.table_name, c.column_name;
-- EXPECT: Either the row is missing entirely (column moved to admin-only
-- table) OR authenticated_can_read = false.

-- Test 6: Sub-item tables must use parent-join policies (no auth.uid IS NOT NULL).
SELECT tablename, policyname, qual::text
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('contract_items','invoice_line_items','recurring_bill_line_items','quote_items')
ORDER BY tablename, policyname;
-- EXPECT: Customer-read policy uses EXISTS join to parent on customer_id.
