-- PortalIT Database Schema
-- Migrated from Base44 platform to Supabase PostgreSQL

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- Auto-update trigger for updated_date
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_date()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_date = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- CORE TABLES
-- ============================================================

-- Users (extends Supabase auth.users)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT DEFAULT '',
  role TEXT DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  customer_id UUID,
  customer_name TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

-- Customers
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  external_id TEXT,
  source TEXT,
  primary_contact TEXT,
  notes TEXT,
  logo_url TEXT,
  ai_support_instructions TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

-- Contacts
CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  name TEXT,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  title TEXT,
  role TEXT,
  status TEXT DEFAULT 'active',
  source TEXT,
  external_id TEXT,
  halopsa_id TEXT,
  is_primary BOOLEAN DEFAULT FALSE,
  spanning_status TEXT,
  spanning_email TEXT,
  spanning_assigned BOOLEAN DEFAULT FALSE,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

-- Devices
CREATE TABLE devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  name TEXT,
  hostname TEXT,
  device_type TEXT,
  operating_system TEXT,
  os_version TEXT,
  serial_number TEXT,
  manufacturer TEXT,
  model TEXT,
  status TEXT DEFAULT 'active',
  online_status TEXT,
  last_seen TIMESTAMPTZ,
  external_id TEXT,
  source TEXT,
  datto_site_id TEXT,
  datto_site_uid TEXT,
  ip_address TEXT,
  notes TEXT,
  assigned_contact_id UUID REFERENCES contacts(id),
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

-- Tickets
CREATE TABLE tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  subject TEXT,
  description TEXT,
  status TEXT DEFAULT 'new',
  priority TEXT,
  ticket_type TEXT,
  category TEXT,
  external_id TEXT,
  source TEXT,
  assigned_to TEXT,
  contact_name TEXT,
  contact_email TEXT,
  resolved_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

-- Contracts
CREATE TABLE contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  name TEXT,
  contract_type TEXT,
  status TEXT DEFAULT 'active',
  start_date TEXT,
  end_date TEXT,
  value NUMERIC,
  billing_cycle TEXT,
  external_id TEXT,
  source TEXT,
  notes TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

-- Contract Items
CREATE TABLE contract_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE,
  name TEXT,
  description TEXT,
  quantity NUMERIC DEFAULT 1,
  unit_price NUMERIC DEFAULT 0,
  total NUMERIC DEFAULT 0,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

-- Invoices
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  invoice_number TEXT,
  status TEXT DEFAULT 'unpaid',
  amount NUMERIC DEFAULT 0,
  tax NUMERIC DEFAULT 0,
  total NUMERIC DEFAULT 0,
  due_date TEXT,
  invoice_date TEXT,
  paid_date TEXT,
  external_id TEXT,
  source TEXT,
  notes TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

-- Invoice Line Items
CREATE TABLE invoice_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
  description TEXT,
  quantity NUMERIC DEFAULT 1,
  unit_price NUMERIC DEFAULT 0,
  total NUMERIC DEFAULT 0,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

-- Recurring Bills
CREATE TABLE recurring_bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  name TEXT,
  status TEXT DEFAULT 'active',
  amount NUMERIC DEFAULT 0,
  billing_cycle TEXT,
  next_billing_date TEXT,
  external_id TEXT,
  source TEXT,
  notes TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

-- Recurring Bill Line Items
CREATE TABLE recurring_bill_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recurring_bill_id UUID REFERENCES recurring_bills(id) ON DELETE CASCADE,
  description TEXT,
  quantity NUMERIC DEFAULT 1,
  unit_price NUMERIC DEFAULT 0,
  total NUMERIC DEFAULT 0,
  tax NUMERIC DEFAULT 0,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

-- Quotes
CREATE TABLE quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  quote_number TEXT,
  status TEXT DEFAULT 'draft',
  amount NUMERIC DEFAULT 0,
  valid_until TEXT,
  external_id TEXT,
  source TEXT,
  notes TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

-- Quote Items
CREATE TABLE quote_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID REFERENCES quotes(id) ON DELETE CASCADE,
  description TEXT,
  quantity NUMERIC DEFAULT 1,
  unit_price NUMERIC DEFAULT 0,
  total NUMERIC DEFAULT 0,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SAAS / LICENSE TABLES
-- ============================================================

-- SaaS Licenses
CREATE TABLE saas_licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  application_name TEXT,
  vendor TEXT,
  license_type TEXT,
  status TEXT DEFAULT 'active',
  quantity INTEGER DEFAULT 1,
  assigned_users INTEGER DEFAULT 0,
  cost_per_license NUMERIC DEFAULT 0,
  total_cost NUMERIC DEFAULT 0,
  billing_cycle TEXT,
  renewal_date TEXT,
  card_last_four TEXT,
  notes TEXT,
  source TEXT,
  external_id TEXT,
  icon_url TEXT,
  category TEXT,
  parent_license_id UUID,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

-- License Assignments
CREATE TABLE license_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_id UUID REFERENCES saas_licenses(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  customer_id UUID,
  status TEXT DEFAULT 'active',
  renewal_date TEXT,
  assigned_date TIMESTAMPTZ DEFAULT NOW(),
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

-- Applications
CREATE TABLE applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  vendor TEXT,
  category TEXT,
  description TEXT,
  icon_url TEXT,
  website_url TEXT,
  status TEXT DEFAULT 'active',
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SETTINGS TABLES
-- ============================================================

-- Settings (global app settings, includes integration credentials)
CREATE TABLE settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  halopsa_client_id TEXT,
  halopsa_client_secret TEXT,
  halopsa_auth_url TEXT,
  halopsa_api_url TEXT,
  halopsa_excluded_ids TEXT,
  datto_api_key TEXT,
  datto_api_secret TEXT,
  datto_api_url TEXT,
  jumpcloud_api_key TEXT,
  jumpcloud_provider_id TEXT,
  rocketcyber_api_token TEXT,
  cove_api_partner TEXT,
  cove_api_username TEXT,
  cove_api_token TEXT,
  unitrends_client_id TEXT,
  unitrends_client_secret TEXT,
  darkwebid_username TEXT,
  darkwebid_password TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

-- Portal Settings (branding/customization)
CREATE TABLE portal_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  primary_color TEXT DEFAULT '#8b5cf6',
  logo_url TEXT,
  show_logo_always BOOLEAN DEFAULT FALSE,
  portal_name TEXT DEFAULT 'PortalIT',
  support_email TEXT,
  support_phone TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

-- Customer Portal Settings
CREATE TABLE customer_portal_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  logo_url TEXT,
  primary_color TEXT,
  portal_name TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

-- Loot Settings
CREATE TABLE loot_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id),
  settings JSONB DEFAULT '{}',
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INTEGRATION MAPPING TABLES
-- ============================================================

-- Datto Site Mapping
CREATE TABLE datto_site_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  customer_name TEXT,
  datto_site_id TEXT,
  datto_site_uid TEXT,
  datto_site_name TEXT,
  cached_data JSONB,
  last_synced TIMESTAMPTZ,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

-- Datto EDR Mapping
CREATE TABLE datto_edr_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  customer_name TEXT,
  edr_tenant_id TEXT,
  edr_tenant_name TEXT,
  cached_data JSONB,
  last_synced TIMESTAMPTZ,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

-- JumpCloud Mapping
CREATE TABLE jump_cloud_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  customer_name TEXT,
  jumpcloud_org_id TEXT,
  jumpcloud_org_name TEXT,
  cached_data JSONB,
  last_synced TIMESTAMPTZ,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

-- Spanning Mapping
CREATE TABLE spanning_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  customer_name TEXT,
  spanning_tenant_id TEXT,
  spanning_tenant_name TEXT,
  spanning_api_key TEXT,
  spanning_region TEXT,
  cached_data JSONB,
  last_synced TIMESTAMPTZ,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

-- RocketCyber Mapping
CREATE TABLE rocket_cyber_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  customer_name TEXT,
  rc_account_id TEXT,
  rc_account_name TEXT,
  cached_data JSONB,
  last_synced TIMESTAMPTZ,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

-- Cove Data Mapping
CREATE TABLE cove_data_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  customer_name TEXT,
  cove_partner_id TEXT,
  cove_partner_name TEXT,
  cached_data JSONB,
  last_synced TIMESTAMPTZ,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

-- Dark Web ID Mapping
CREATE TABLE dark_web_id_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  customer_name TEXT,
  darkweb_org_id TEXT,
  darkweb_org_name TEXT,
  cached_data JSONB,
  last_synced TIMESTAMPTZ,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SECURITY / REPORT TABLES
-- ============================================================

-- RocketCyber Incidents
CREATE TABLE rocket_cyber_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  incident_id TEXT,
  title TEXT,
  description TEXT,
  severity TEXT,
  status TEXT DEFAULT 'open',
  event_type TEXT,
  source TEXT,
  resolved_at TIMESTAMPTZ,
  manually_closed BOOLEAN DEFAULT FALSE,
  raw_data JSONB,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

-- BullPhish ID Reports
CREATE TABLE bull_phish_id_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  customer_name TEXT,
  report_date TEXT,
  report_data JSONB,
  file_url TEXT,
  notes TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

-- Dark Web ID Reports
CREATE TABLE dark_web_id_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  customer_name TEXT,
  report_date TEXT,
  report_data JSONB,
  file_url TEXT,
  notes TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

-- Dark Web Compromises
CREATE TABLE dark_web_compromises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  email TEXT,
  source TEXT,
  breach_date TEXT,
  severity TEXT,
  data_types TEXT,
  raw_data JSONB,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ACTIVITY / LOG TABLES
-- ============================================================

-- Activity Log
CREATE TABLE activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID,
  entity_type TEXT,
  action TEXT,
  description TEXT,
  user_id UUID,
  user_name TEXT,
  metadata JSONB,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

-- Sync Log
CREATE TABLE sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT,
  sync_type TEXT,
  status TEXT DEFAULT 'pending',
  records_synced INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

-- Feedback
CREATE TABLE feedbacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id),
  customer_name TEXT,
  submitted_by TEXT,
  user_email TEXT,
  user_name TEXT,
  type TEXT,
  description TEXT,
  screenshot_urls JSONB,
  page_url TEXT,
  status TEXT DEFAULT 'new',
  admin_response TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

-- Vendor Billing
CREATE TABLE vendor_billings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id),
  vendor TEXT,
  amount NUMERIC DEFAULT 0,
  billing_period TEXT,
  details JSONB,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

-- Conversations (for AI support chat)
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name TEXT,
  user_id UUID,
  metadata JSONB DEFAULT '{}',
  messages JSONB DEFAULT '[]',
  status TEXT DEFAULT 'active',
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_users_auth_id ON users(auth_id);
CREATE INDEX idx_users_customer_id ON users(customer_id);
CREATE INDEX idx_contacts_customer_id ON contacts(customer_id);
CREATE INDEX idx_contacts_source ON contacts(source);
CREATE INDEX idx_devices_customer_id ON devices(customer_id);
CREATE INDEX idx_tickets_customer_id ON tickets(customer_id);
CREATE INDEX idx_contracts_customer_id ON contracts(customer_id);
CREATE INDEX idx_invoices_customer_id ON invoices(customer_id);
CREATE INDEX idx_invoice_line_items_invoice_id ON invoice_line_items(invoice_id);
CREATE INDEX idx_recurring_bills_customer_id ON recurring_bills(customer_id);
CREATE INDEX idx_recurring_bill_line_items_bill_id ON recurring_bill_line_items(recurring_bill_id);
CREATE INDEX idx_quotes_customer_id ON quotes(customer_id);
CREATE INDEX idx_quote_items_quote_id ON quote_items(quote_id);
CREATE INDEX idx_saas_licenses_customer_id ON saas_licenses(customer_id);
CREATE INDEX idx_saas_licenses_source ON saas_licenses(source);
CREATE INDEX idx_license_assignments_license_id ON license_assignments(license_id);
CREATE INDEX idx_license_assignments_contact_id ON license_assignments(contact_id);
CREATE INDEX idx_license_assignments_customer_id ON license_assignments(customer_id);
CREATE INDEX idx_applications_customer_id ON applications(customer_id);
CREATE INDEX idx_customers_external_id ON customers(external_id);
CREATE INDEX idx_customers_source ON customers(source);
CREATE INDEX idx_customers_status ON customers(status);
CREATE INDEX idx_activities_entity_id ON activities(entity_id);
CREATE INDEX idx_datto_site_mappings_customer_id ON datto_site_mappings(customer_id);
CREATE INDEX idx_datto_edr_mappings_customer_id ON datto_edr_mappings(customer_id);
CREATE INDEX idx_jump_cloud_mappings_customer_id ON jump_cloud_mappings(customer_id);
CREATE INDEX idx_spanning_mappings_customer_id ON spanning_mappings(customer_id);
CREATE INDEX idx_rocket_cyber_mappings_customer_id ON rocket_cyber_mappings(customer_id);
CREATE INDEX idx_cove_data_mappings_customer_id ON cove_data_mappings(customer_id);
CREATE INDEX idx_contract_items_contract_id ON contract_items(contract_id);
CREATE INDEX idx_feedbacks_customer_id ON feedbacks(customer_id);

-- ============================================================
-- AUTO-UPDATE TRIGGERS
-- ============================================================

CREATE TRIGGER update_users_updated_date BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_date();
CREATE TRIGGER update_customers_updated_date BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_date();
CREATE TRIGGER update_contacts_updated_date BEFORE UPDATE ON contacts FOR EACH ROW EXECUTE FUNCTION update_updated_date();
CREATE TRIGGER update_devices_updated_date BEFORE UPDATE ON devices FOR EACH ROW EXECUTE FUNCTION update_updated_date();
CREATE TRIGGER update_tickets_updated_date BEFORE UPDATE ON tickets FOR EACH ROW EXECUTE FUNCTION update_updated_date();
CREATE TRIGGER update_contracts_updated_date BEFORE UPDATE ON contracts FOR EACH ROW EXECUTE FUNCTION update_updated_date();
CREATE TRIGGER update_contract_items_updated_date BEFORE UPDATE ON contract_items FOR EACH ROW EXECUTE FUNCTION update_updated_date();
CREATE TRIGGER update_invoices_updated_date BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION update_updated_date();
CREATE TRIGGER update_invoice_line_items_updated_date BEFORE UPDATE ON invoice_line_items FOR EACH ROW EXECUTE FUNCTION update_updated_date();
CREATE TRIGGER update_recurring_bills_updated_date BEFORE UPDATE ON recurring_bills FOR EACH ROW EXECUTE FUNCTION update_updated_date();
CREATE TRIGGER update_recurring_bill_line_items_updated_date BEFORE UPDATE ON recurring_bill_line_items FOR EACH ROW EXECUTE FUNCTION update_updated_date();
CREATE TRIGGER update_quotes_updated_date BEFORE UPDATE ON quotes FOR EACH ROW EXECUTE FUNCTION update_updated_date();
CREATE TRIGGER update_quote_items_updated_date BEFORE UPDATE ON quote_items FOR EACH ROW EXECUTE FUNCTION update_updated_date();
CREATE TRIGGER update_saas_licenses_updated_date BEFORE UPDATE ON saas_licenses FOR EACH ROW EXECUTE FUNCTION update_updated_date();
CREATE TRIGGER update_license_assignments_updated_date BEFORE UPDATE ON license_assignments FOR EACH ROW EXECUTE FUNCTION update_updated_date();
CREATE TRIGGER update_applications_updated_date BEFORE UPDATE ON applications FOR EACH ROW EXECUTE FUNCTION update_updated_date();
CREATE TRIGGER update_settings_updated_date BEFORE UPDATE ON settings FOR EACH ROW EXECUTE FUNCTION update_updated_date();
CREATE TRIGGER update_portal_settings_updated_date BEFORE UPDATE ON portal_settings FOR EACH ROW EXECUTE FUNCTION update_updated_date();
CREATE TRIGGER update_customer_portal_settings_updated_date BEFORE UPDATE ON customer_portal_settings FOR EACH ROW EXECUTE FUNCTION update_updated_date();
CREATE TRIGGER update_loot_settings_updated_date BEFORE UPDATE ON loot_settings FOR EACH ROW EXECUTE FUNCTION update_updated_date();
CREATE TRIGGER update_datto_site_mappings_updated_date BEFORE UPDATE ON datto_site_mappings FOR EACH ROW EXECUTE FUNCTION update_updated_date();
CREATE TRIGGER update_datto_edr_mappings_updated_date BEFORE UPDATE ON datto_edr_mappings FOR EACH ROW EXECUTE FUNCTION update_updated_date();
CREATE TRIGGER update_jump_cloud_mappings_updated_date BEFORE UPDATE ON jump_cloud_mappings FOR EACH ROW EXECUTE FUNCTION update_updated_date();
CREATE TRIGGER update_spanning_mappings_updated_date BEFORE UPDATE ON spanning_mappings FOR EACH ROW EXECUTE FUNCTION update_updated_date();
CREATE TRIGGER update_rocket_cyber_mappings_updated_date BEFORE UPDATE ON rocket_cyber_mappings FOR EACH ROW EXECUTE FUNCTION update_updated_date();
CREATE TRIGGER update_cove_data_mappings_updated_date BEFORE UPDATE ON cove_data_mappings FOR EACH ROW EXECUTE FUNCTION update_updated_date();
CREATE TRIGGER update_dark_web_id_mappings_updated_date BEFORE UPDATE ON dark_web_id_mappings FOR EACH ROW EXECUTE FUNCTION update_updated_date();
CREATE TRIGGER update_rocket_cyber_incidents_updated_date BEFORE UPDATE ON rocket_cyber_incidents FOR EACH ROW EXECUTE FUNCTION update_updated_date();
CREATE TRIGGER update_bull_phish_id_reports_updated_date BEFORE UPDATE ON bull_phish_id_reports FOR EACH ROW EXECUTE FUNCTION update_updated_date();
CREATE TRIGGER update_dark_web_id_reports_updated_date BEFORE UPDATE ON dark_web_id_reports FOR EACH ROW EXECUTE FUNCTION update_updated_date();
CREATE TRIGGER update_dark_web_compromises_updated_date BEFORE UPDATE ON dark_web_compromises FOR EACH ROW EXECUTE FUNCTION update_updated_date();
CREATE TRIGGER update_activities_updated_date BEFORE UPDATE ON activities FOR EACH ROW EXECUTE FUNCTION update_updated_date();
CREATE TRIGGER update_sync_logs_updated_date BEFORE UPDATE ON sync_logs FOR EACH ROW EXECUTE FUNCTION update_updated_date();
CREATE TRIGGER update_feedbacks_updated_date BEFORE UPDATE ON feedbacks FOR EACH ROW EXECUTE FUNCTION update_updated_date();
CREATE TRIGGER update_vendor_billings_updated_date BEFORE UPDATE ON vendor_billings FOR EACH ROW EXECUTE FUNCTION update_updated_date();
CREATE TRIGGER update_conversations_updated_date BEFORE UPDATE ON conversations FOR EACH ROW EXECUTE FUNCTION update_updated_date();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_bill_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE saas_licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE license_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_portal_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE loot_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE datto_site_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE datto_edr_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE jump_cloud_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE spanning_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE rocket_cyber_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE cove_data_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE dark_web_id_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE rocket_cyber_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE bull_phish_id_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE dark_web_id_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE dark_web_compromises ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedbacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_billings ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

-- Helper function: check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE auth_id = auth.uid()
    AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Helper function: get user's customer_id
CREATE OR REPLACE FUNCTION user_customer_id()
RETURNS UUID AS $$
  SELECT customer_id FROM users
  WHERE auth_id = auth.uid()
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- Admin full access policy (applied to all tables)
-- Non-admin read-only on their customer's data

-- Users
CREATE POLICY "Admin full access" ON users FOR ALL USING (is_admin());
CREATE POLICY "Users read own" ON users FOR SELECT USING (auth_id = auth.uid());

-- Customers
CREATE POLICY "Admin full access" ON customers FOR ALL USING (is_admin());
CREATE POLICY "Customer read own" ON customers FOR SELECT USING (id = user_customer_id());

-- Settings (admin only)
CREATE POLICY "Admin full access" ON settings FOR ALL USING (is_admin());
CREATE POLICY "Authenticated read" ON settings FOR SELECT USING (auth.uid() IS NOT NULL);

-- Portal Settings (readable by all authenticated)
CREATE POLICY "Admin full access" ON portal_settings FOR ALL USING (is_admin());
CREATE POLICY "Authenticated read" ON portal_settings FOR SELECT USING (auth.uid() IS NOT NULL);

-- Generic customer-scoped policies for remaining tables
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'contacts', 'devices', 'tickets', 'contracts', 'invoices',
      'recurring_bills', 'quotes', 'saas_licenses', 'license_assignments',
      'applications', 'customer_portal_settings', 'loot_settings',
      'datto_site_mappings', 'datto_edr_mappings', 'jump_cloud_mappings',
      'spanning_mappings', 'rocket_cyber_mappings', 'cove_data_mappings',
      'dark_web_id_mappings', 'rocket_cyber_incidents', 'bull_phish_id_reports',
      'dark_web_id_reports', 'dark_web_compromises', 'feedbacks',
      'vendor_billings'
    ])
  LOOP
    EXECUTE format('CREATE POLICY "Admin full access" ON %I FOR ALL USING (is_admin())', tbl);
    EXECUTE format('CREATE POLICY "Customer read own" ON %I FOR SELECT USING (customer_id = user_customer_id())', tbl);
  END LOOP;
END $$;

-- Tables without customer_id (admin-only write, authenticated read)
CREATE POLICY "Admin full access" ON activities FOR ALL USING (is_admin());
CREATE POLICY "Authenticated read" ON activities FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin full access" ON sync_logs FOR ALL USING (is_admin());
CREATE POLICY "Authenticated read" ON sync_logs FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin full access" ON conversations FOR ALL USING (is_admin());
CREATE POLICY "User own conversations" ON conversations FOR ALL USING (user_id = auth.uid()::uuid);

-- Sub-item tables (contract_items, invoice_line_items, recurring_bill_line_items, quote_items)
CREATE POLICY "Admin full access" ON contract_items FOR ALL USING (is_admin());
CREATE POLICY "Authenticated read" ON contract_items FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin full access" ON invoice_line_items FOR ALL USING (is_admin());
CREATE POLICY "Authenticated read" ON invoice_line_items FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin full access" ON recurring_bill_line_items FOR ALL USING (is_admin());
CREATE POLICY "Authenticated read" ON recurring_bill_line_items FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin full access" ON quote_items FOR ALL USING (is_admin());
CREATE POLICY "Authenticated read" ON quote_items FOR SELECT USING (auth.uid() IS NOT NULL);

-- ============================================================
-- REALTIME (enable for subscribed tables)
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE saas_licenses;
ALTER PUBLICATION supabase_realtime ADD TABLE license_assignments;
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;

-- ============================================================
-- STORAGE BUCKET
-- ============================================================

INSERT INTO storage.buckets (id, name, public) VALUES ('uploads', 'uploads', true);

CREATE POLICY "Authenticated upload" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'uploads' AND auth.uid() IS NOT NULL);

CREATE POLICY "Public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'uploads');
