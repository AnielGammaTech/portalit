import { getServiceSupabase } from '../lib/supabase.js';

// ── Token cache ─────────────────────────────────────────────────────────

let cachedToken = null;
let tokenExpiry = 0;

async function getCIPPToken() {
  const now = Date.now();
  if (cachedToken && tokenExpiry > now) return cachedToken;

  const tokenUrl = process.env.CIPP_AUTH_TOKEN_URL;
  const clientId = process.env.CIPP_AUTH_CLIENT_ID;
  const clientSecret = process.env.CIPP_AUTH_CLIENT_SECRET;
  const scope = process.env.CIPP_AUTH_SCOPE;

  if (!tokenUrl || !clientId || !clientSecret || !scope) {
    throw new Error('CIPP credentials not configured. Set CIPP_API_URL, CIPP_AUTH_TOKEN_URL, CIPP_AUTH_CLIENT_ID, CIPP_AUTH_CLIENT_SECRET, and CIPP_AUTH_SCOPE.');
  }

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      scope,
      grant_type: 'client_credentials',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`CIPP auth failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  cachedToken = data.access_token;
  tokenExpiry = now + ((data.expires_in || 3600) - 60) * 1000;
  return cachedToken;
}

// ── API helper ──────────────────────────────────────────────────────────

async function cippApiCall(endpoint, params = {}) {
  const token = await getCIPPToken();
  const baseUrl = process.env.CIPP_API_URL;
  if (!baseUrl) throw new Error('CIPP_API_URL not configured');

  const url = new URL(`/api/${endpoint}`, baseUrl);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) url.searchParams.set(key, value);
  }

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`CIPP API error (${endpoint}): ${response.status} - ${errorText}`);
  }

  return response.json();
}

// ── Actions ─────────────────────────────────────────────────────────────

async function testConnection() {
  const tenants = await cippApiCall('ListTenants');
  const tenantList = Array.isArray(tenants) ? tenants : [];
  return {
    success: true,
    totalTenants: tenantList.length,
    message: `Connected! Found ${tenantList.length} tenants.`,
  };
}

async function listTenants() {
  const tenants = await cippApiCall('ListTenants');
  const tenantList = Array.isArray(tenants) ? tenants : [];
  return {
    success: true,
    tenants: tenantList.map((t) => ({
      id: t.customerId || t.tenantId || t.TenantId || t.CustomerId,
      name: t.displayName || t.DisplayName || t.defaultDomainName || '',
      defaultDomain: t.defaultDomainName || t.DefaultDomainName || '',
      tenantId: t.customerId || t.tenantId || t.TenantId || t.CustomerId,
    })),
  };
}

async function syncUsers(customerId, tenantId) {
  const supabase = getServiceSupabase();
  const users = await cippApiCall('ListUsers', { tenantFilter: tenantId });
  const userList = Array.isArray(users) ? users : [];

  const records = userList.map((u) => ({
    customer_id: customerId,
    cipp_tenant_id: tenantId,
    user_principal_name: u.userPrincipalName || u.UserPrincipalName || '',
    display_name: u.displayName || u.DisplayName || '',
    mail: u.mail || u.Mail || '',
    job_title: u.jobTitle || u.JobTitle || null,
    department: u.department || u.Department || null,
    account_enabled: u.accountEnabled ?? u.AccountEnabled ?? true,
    user_type: u.userType || u.UserType || 'Member',
    assigned_licenses: u.assignedLicenses || u.LicJoined || [],
    created_date_time: u.createdDateTime || u.CreatedDateTime || null,
    last_sign_in: u.lastSignInDateTime || u.LastSignIn || null,
    on_premises_sync_enabled: u.onPremisesSyncEnabled ?? u.OnPremisesSyncEnabled ?? false,
    external_id: u.id || u.Id || u.ObjectId || '',
  }));

  // Clear existing users for this tenant then bulk insert
  await supabase.from('cipp_users').delete().eq('customer_id', customerId);

  if (records.length > 0) {
    const BATCH = 50;
    for (let i = 0; i < records.length; i += BATCH) {
      const batch = records.slice(i, i + BATCH);
      const { error } = await supabase.from('cipp_users').insert(batch);
      if (error) throw new Error(`Insert users failed: ${error.message}`);
    }
  }

  return { success: true, count: records.length };
}

async function syncGroups(customerId, tenantId) {
  const supabase = getServiceSupabase();
  const groups = await cippApiCall('ListGroups', { tenantFilter: tenantId });
  const groupList = Array.isArray(groups) ? groups : [];

  const records = groupList.map((g) => {
    let groupType = 'Security';
    const types = g.groupTypes || g.GroupTypes || [];
    const mailEnabled = g.mailEnabled ?? g.MailEnabled ?? false;
    const secEnabled = g.securityEnabled ?? g.SecurityEnabled ?? false;

    if (types.includes('Unified')) groupType = 'M365';
    else if (mailEnabled && secEnabled) groupType = 'MailEnabledSecurity';
    else if (mailEnabled && !secEnabled) groupType = 'Distribution';
    else groupType = 'Security';

    return {
      customer_id: customerId,
      cipp_tenant_id: tenantId,
      display_name: g.displayName || g.DisplayName || '',
      description: g.description || g.Description || null,
      mail: g.mail || g.Mail || null,
      group_type: groupType,
      member_count: g.memberCount ?? g.MemberCount ?? g.members?.length ?? 0,
      external_id: g.id || g.Id || '',
    };
  });

  await supabase.from('cipp_groups').delete().eq('customer_id', customerId);

  if (records.length > 0) {
    const BATCH = 50;
    for (let i = 0; i < records.length; i += BATCH) {
      const batch = records.slice(i, i + BATCH);
      const { error } = await supabase.from('cipp_groups').insert(batch);
      if (error) throw new Error(`Insert groups failed: ${error.message}`);
    }
  }

  return { success: true, count: records.length };
}

async function syncMailboxes(customerId, tenantId) {
  const supabase = getServiceSupabase();
  const mailboxes = await cippApiCall('ListMailboxes', { tenantFilter: tenantId });
  const mailboxList = Array.isArray(mailboxes) ? mailboxes : [];

  const records = mailboxList.map((m) => ({
    customer_id: customerId,
    cipp_tenant_id: tenantId,
    display_name: m.displayName || m.DisplayName || '',
    user_principal_name: m.userPrincipalName || m.UserPrincipalName || '',
    primary_smtp_address: m.primarySmtpAddress || m.PrimarySmtpAddress || m.UPN || '',
    mailbox_type: m.recipientTypeDetails || m.RecipientTypeDetails || m.recipientType || 'UserMailbox',
    external_id: m.externalDirectoryObjectId || m.ExternalDirectoryObjectId || m.ObjectId || '',
  }));

  await supabase.from('cipp_mailboxes').delete().eq('customer_id', customerId);

  if (records.length > 0) {
    const BATCH = 50;
    for (let i = 0; i < records.length; i += BATCH) {
      const batch = records.slice(i, i + BATCH);
      const { error } = await supabase.from('cipp_mailboxes').insert(batch);
      if (error) throw new Error(`Insert mailboxes failed: ${error.message}`);
    }
  }

  return { success: true, count: records.length };
}

async function syncCustomer(customerId, tenantId) {
  const supabase = getServiceSupabase();
  const results = { users: 0, groups: 0, mailboxes: 0, errors: [] };

  try {
    const userResult = await syncUsers(customerId, tenantId);
    results.users = userResult.count;
  } catch (err) {
    results.errors.push(`Users: ${err.message}`);
  }

  try {
    const groupResult = await syncGroups(customerId, tenantId);
    results.groups = groupResult.count;
  } catch (err) {
    results.errors.push(`Groups: ${err.message}`);
  }

  try {
    const mailboxResult = await syncMailboxes(customerId, tenantId);
    results.mailboxes = mailboxResult.count;
  } catch (err) {
    results.errors.push(`Mailboxes: ${err.message}`);
  }

  // Update mapping last_synced
  await supabase
    .from('cipp_mappings')
    .update({
      last_synced: new Date().toISOString(),
      cached_data: { users: results.users, groups: results.groups, mailboxes: results.mailboxes },
    })
    .eq('customer_id', customerId);

  return {
    success: results.errors.length === 0,
    ...results,
    message: results.errors.length > 0
      ? `Partial sync: ${results.errors.join('; ')}`
      : `Synced ${results.users} users, ${results.groups} groups, ${results.mailboxes} mailboxes`,
  };
}

async function syncAll() {
  const supabase = getServiceSupabase();
  const { data: mappings } = await supabase.from('cipp_mappings').select('*');
  if (!mappings || mappings.length === 0) {
    return { success: true, message: 'No CIPP mappings configured' };
  }

  const results = [];
  for (const mapping of mappings) {
    try {
      const result = await syncCustomer(mapping.customer_id, mapping.cipp_tenant_id);
      results.push({ customer: mapping.customer_name, ...result });
    } catch (err) {
      results.push({ customer: mapping.customer_name, success: false, error: err.message });
    }
  }

  const succeeded = results.filter((r) => r.success).length;
  return {
    success: true,
    message: `Synced ${succeeded}/${results.length} customers`,
    results,
  };
}

// ── Main handler ────────────────────────────────────────────────────────

export async function syncCIPP(body = {}) {
  const { action, customerId, tenantId } = body;

  switch (action) {
    case 'test_connection':
      return testConnection();

    case 'list_tenants':
      return listTenants();

    case 'sync_customer':
      if (!customerId || !tenantId) throw new Error('customerId and tenantId required');
      return syncCustomer(customerId, tenantId);

    case 'sync_all':
      return syncAll();

    default:
      return { success: false, error: `Unknown action: ${action}` };
  }
}
