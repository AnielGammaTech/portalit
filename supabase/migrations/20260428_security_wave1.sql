-- ============================================================
-- Security Wave 1 — RLS hardening + column-level secret hiding
-- ============================================================
-- Closes findings H1, H3, H4 from the 2026-04-28 audit.
--   H1 — sub-item tables readable by all authenticated users
--   H3 — reconciliation_snapshots / reconciliation_excluded_items broken RLS
--   H4 — spanning_api_key column readable by customer users
-- No app-level changes required: frontend never read spanning_api_key,
-- and parent records (contracts, invoices, etc.) remain customer-scoped.

-- ── H1: Sub-item tables → parent-join policies ───────────────
-- contract_items
DROP POLICY IF EXISTS "Authenticated read" ON contract_items;
CREATE POLICY "Customer read own via parent"
  ON contract_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM contracts
      WHERE contracts.id = contract_items.contract_id
        AND contracts.customer_id = user_customer_id()
    )
  );

-- invoice_line_items
DROP POLICY IF EXISTS "Authenticated read" ON invoice_line_items;
CREATE POLICY "Customer read own via parent"
  ON invoice_line_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM invoices
      WHERE invoices.id = invoice_line_items.invoice_id
        AND invoices.customer_id = user_customer_id()
    )
  );

-- recurring_bill_line_items
DROP POLICY IF EXISTS "Authenticated read" ON recurring_bill_line_items;
CREATE POLICY "Customer read own via parent"
  ON recurring_bill_line_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM recurring_bills
      WHERE recurring_bills.id = recurring_bill_line_items.recurring_bill_id
        AND recurring_bills.customer_id = user_customer_id()
    )
  );

-- quote_items
DROP POLICY IF EXISTS "Authenticated read" ON quote_items;
CREATE POLICY "Customer read own via parent"
  ON quote_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM quotes
      WHERE quotes.id = quote_items.quote_id
        AND quotes.customer_id = user_customer_id()
    )
  );

-- Admin full access already exists on these tables; preserved.

-- ── H3: reconciliation_snapshots → admin write + customer-scoped read ─
DROP POLICY IF EXISTS "admin_all_snapshots" ON reconciliation_snapshots;
DROP POLICY IF EXISTS "Allow authenticated to view snapshots" ON reconciliation_snapshots;
DROP POLICY IF EXISTS "Allow authenticated to manage snapshots" ON reconciliation_snapshots;
DROP POLICY IF EXISTS "Service role full access" ON reconciliation_snapshots;

CREATE POLICY "Admin full access"
  ON reconciliation_snapshots FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Customer read own"
  ON reconciliation_snapshots FOR SELECT
  USING (customer_id = user_customer_id());

-- ── H3: reconciliation_excluded_items → same pattern ─────────
DROP POLICY IF EXISTS "Authenticated users can manage excluded items"
  ON reconciliation_excluded_items;

CREATE POLICY "Admin full access"
  ON reconciliation_excluded_items FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Customer read own"
  ON reconciliation_excluded_items FOR SELECT
  USING (customer_id = user_customer_id());

-- ── H4: Hide spanning_api_key column from non-service-role ────
-- Frontend reads SpanningMapping for existence checks but never the
-- api_key column. Backend uses service-role which bypasses GRANTs.
REVOKE SELECT (spanning_api_key) ON spanning_mappings FROM authenticated;
REVOKE SELECT (spanning_api_key) ON spanning_mappings FROM anon;

-- Verification queries (uncomment to test):
-- SELECT polname, qual::text FROM pg_policies WHERE tablename IN
--   ('contract_items','invoice_line_items','recurring_bill_line_items',
--    'quote_items','reconciliation_snapshots','reconciliation_excluded_items');
-- SELECT has_column_privilege('authenticated', 'spanning_mappings', 'spanning_api_key', 'SELECT');
