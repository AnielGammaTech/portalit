-- CIPP Integration: mapping table + synced users table

-- Customer ↔ CIPP tenant mapping
CREATE TABLE IF NOT EXISTS cipp_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  customer_name TEXT,
  cipp_tenant_id TEXT NOT NULL,
  cipp_tenant_name TEXT,
  cipp_default_domain TEXT,
  cached_data JSONB,
  last_synced TIMESTAMPTZ,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cipp_mappings_customer_id ON cipp_mappings(customer_id);

-- Synced CIPP users (M365 users per tenant)
CREATE TABLE IF NOT EXISTS cipp_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  cipp_tenant_id TEXT NOT NULL,
  user_principal_name TEXT,
  display_name TEXT,
  mail TEXT,
  job_title TEXT,
  department TEXT,
  account_enabled BOOLEAN DEFAULT TRUE,
  user_type TEXT, -- 'Member', 'Guest'
  assigned_licenses JSONB DEFAULT '[]',
  created_date_time TEXT,
  last_sign_in TEXT,
  on_premises_sync_enabled BOOLEAN DEFAULT FALSE,
  external_id TEXT, -- Azure AD object ID
  cached_data JSONB,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cipp_users_customer_id ON cipp_users(customer_id);
CREATE INDEX idx_cipp_users_tenant ON cipp_users(cipp_tenant_id);
CREATE UNIQUE INDEX idx_cipp_users_ext ON cipp_users(cipp_tenant_id, external_id);

-- Synced CIPP groups
CREATE TABLE IF NOT EXISTS cipp_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  cipp_tenant_id TEXT NOT NULL,
  display_name TEXT,
  description TEXT,
  mail TEXT,
  group_type TEXT, -- 'Security', 'Distribution', 'M365', 'MailEnabledSecurity'
  member_count INTEGER DEFAULT 0,
  external_id TEXT,
  cached_data JSONB,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cipp_groups_customer_id ON cipp_groups(customer_id);
CREATE UNIQUE INDEX idx_cipp_groups_ext ON cipp_groups(cipp_tenant_id, external_id);

-- Synced CIPP mailboxes
CREATE TABLE IF NOT EXISTS cipp_mailboxes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  cipp_tenant_id TEXT NOT NULL,
  display_name TEXT,
  user_principal_name TEXT,
  primary_smtp_address TEXT,
  mailbox_type TEXT, -- 'UserMailbox', 'SharedMailbox', 'RoomMailbox', 'EquipmentMailbox'
  external_id TEXT,
  cached_data JSONB,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cipp_mailboxes_customer_id ON cipp_mailboxes(customer_id);
CREATE UNIQUE INDEX idx_cipp_mailboxes_ext ON cipp_mailboxes(cipp_tenant_id, external_id);

-- Updated date triggers
CREATE TRIGGER update_cipp_mappings_updated_date BEFORE UPDATE ON cipp_mappings FOR EACH ROW EXECUTE FUNCTION update_updated_date();
CREATE TRIGGER update_cipp_users_updated_date BEFORE UPDATE ON cipp_users FOR EACH ROW EXECUTE FUNCTION update_updated_date();
CREATE TRIGGER update_cipp_groups_updated_date BEFORE UPDATE ON cipp_groups FOR EACH ROW EXECUTE FUNCTION update_updated_date();
CREATE TRIGGER update_cipp_mailboxes_updated_date BEFORE UPDATE ON cipp_mailboxes FOR EACH ROW EXECUTE FUNCTION update_updated_date();

-- RLS
ALTER TABLE cipp_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE cipp_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE cipp_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE cipp_mailboxes ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY admin_cipp_mappings ON cipp_mappings FOR ALL USING (is_admin());
CREATE POLICY admin_cipp_users ON cipp_users FOR ALL USING (is_admin());
CREATE POLICY admin_cipp_groups ON cipp_groups FOR ALL USING (is_admin());
CREATE POLICY admin_cipp_mailboxes ON cipp_mailboxes FOR ALL USING (is_admin());

-- Customer read own data
CREATE POLICY customer_cipp_users ON cipp_users FOR SELECT USING (customer_id = user_customer_id());
CREATE POLICY customer_cipp_groups ON cipp_groups FOR SELECT USING (customer_id = user_customer_id());
CREATE POLICY customer_cipp_mailboxes ON cipp_mailboxes FOR SELECT USING (customer_id = user_customer_id());
