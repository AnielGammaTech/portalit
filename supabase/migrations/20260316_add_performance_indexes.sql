-- Performance indexes for common query patterns
-- These cover the most frequent filter/join columns used by the frontend

CREATE INDEX IF NOT EXISTS idx_contacts_customer_id
  ON contacts (customer_id);

CREATE INDEX IF NOT EXISTS idx_license_assignments_customer_license
  ON license_assignments (customer_id, license_id);

CREATE INDEX IF NOT EXISTS idx_license_assignments_contact_status
  ON license_assignments (contact_id, status);

CREATE INDEX IF NOT EXISTS idx_sync_logs_source_created
  ON sync_logs (source, created_date);

CREATE INDEX IF NOT EXISTS idx_recurring_bills_customer_id
  ON recurring_bills (customer_id);

CREATE INDEX IF NOT EXISTS idx_invoice_line_items_invoice_id
  ON invoice_line_items (invoice_id);

CREATE INDEX IF NOT EXISTS idx_devices_customer_id
  ON devices (customer_id);

CREATE INDEX IF NOT EXISTS idx_tickets_customer_id
  ON tickets (customer_id);
