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
    console.error(`[CIPP] Token request failed: ${response.status} | ${errorText}`);
    throw new Error(`CIPP auth failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  console.log(`[CIPP] Token obtained, expires_in: ${data.expires_in}`);
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

  console.log(`[CIPP] Calling: ${url.toString()}`);
  console.log(`[CIPP] Token (first 20 chars): ${token?.substring(0, 20)}...`);

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[CIPP] API error: ${response.status} | Headers: ${JSON.stringify(Object.fromEntries(response.headers))} | Body: ${errorText}`);
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

  // Fetch users + enrichment data in parallel
  const [users, mfaData, licenseSKUs, signIns] = await Promise.all([
    cippApiCall('ListUsers', { tenantFilter: tenantId }),
    safeApiCall('ListPerUserMFA', { tenantFilter: tenantId }),
    safeApiCall('ListLicenses', { tenantFilter: tenantId }),
    safeApiCall('ListSignIns', { tenantFilter: tenantId, filter: 'createdDateTime ge ' + new Date(Date.now() - 30 * 86400000).toISOString() }),
  ]);

  const userList = Array.isArray(users) ? users : [];
  const mfaList = Array.isArray(mfaData) ? mfaData : [];
  const skuList = Array.isArray(licenseSKUs) ? licenseSKUs : [];
  const signInList = Array.isArray(signIns) ? signIns : [];

  // Build MFA lookup by UPN
  const mfaMap = {};
  for (const m of mfaList) {
    const upn = m.userPrincipalName || m.UserPrincipalName || '';
    if (upn) {
      mfaMap[upn.toLowerCase()] = {
        status: m.accountEnabled === false ? 'disabled'
          : m.perUser || m.PerUser || m.MFAState || 'unknown',
        methods: m.MFAMethods || m.authMethods || [],
      };
    }
  }

  // Build SKU name lookup (skuId → friendly name)
  const skuMap = {};
  for (const sku of skuList) {
    const skuId = sku.skuId || sku.SkuId || '';
    if (skuId) {
      skuMap[skuId] = sku.skuName || sku.SkuName || sku.skuPartNumber || sku.SkuPartNumber || skuId;
    }
  }

  // Build last sign-in lookup by UPN (most recent)
  const signInMap = {};
  for (const s of signInList) {
    const upn = (s.userPrincipalName || s.UserPrincipalName || '').toLowerCase();
    if (!upn) continue;
    const dt = s.createdDateTime || s.CreatedDateTime || '';
    if (!signInMap[upn] || dt > signInMap[upn].date) {
      signInMap[upn] = {
        date: dt,
        ip: s.ipAddress || s.IPAddress || null,
        location: [s.location?.city, s.location?.state, s.location?.countryOrRegion].filter(Boolean).join(', ') || null,
        app: s.appDisplayName || s.AppDisplayName || null,
        status: s.status?.errorCode === 0 ? 'success' : 'failed',
        error: s.status?.failureReason || null,
      };
    }
  }

  const records = userList.map((u) => {
    const upn = (u.userPrincipalName || u.UserPrincipalName || '').toLowerCase();
    const mfa = mfaMap[upn] || { status: 'unknown', methods: [] };
    const lastSignIn = signInMap[upn] || null;

    // Resolve license SKU IDs to friendly names
    const rawLicenses = u.assignedLicenses || [];
    const resolvedLicenses = rawLicenses
      .map(l => skuMap[l.skuId || l.SkuId] || l.skuId || l.SkuId || '')
      .filter(Boolean);

    // Also use LicJoined as fallback
    const licJoined = u.LicJoined || '';
    const licenseString = resolvedLicenses.length > 0
      ? resolvedLicenses.join(', ')
      : licJoined;

    return {
      customer_id: customerId,
      cipp_tenant_id: tenantId,
      user_principal_name: u.userPrincipalName || u.UserPrincipalName || '',
      display_name: u.displayName || u.DisplayName || '',
      mail: u.mail || u.Mail || '',
      job_title: u.jobTitle || u.JobTitle || null,
      department: u.department || u.Department || null,
      account_enabled: u.accountEnabled ?? u.AccountEnabled ?? true,
      user_type: u.userType || u.UserType || 'Member',
      assigned_licenses: rawLicenses,
      created_date_time: u.createdDateTime || u.CreatedDateTime || null,
      last_sign_in: lastSignIn?.date || u.lastSignInDateTime || u.LastSignIn || null,
      on_premises_sync_enabled: u.onPremisesSyncEnabled ?? u.OnPremisesSyncEnabled ?? false,
      external_id: u.id || u.Id || u.ObjectId || '',
      cached_data: {
        licenses: licenseString,
        mfa_status: mfa.status,
        mfa_methods: mfa.methods,
        last_sign_in_details: lastSignIn,
        given_name: u.givenName || null,
        surname: u.surname || null,
        city: u.city || null,
        state: u.state || null,
        country: u.country || null,
        mobile_phone: u.mobilePhone || null,
        business_phones: u.businessPhones || [],
        office_location: u.officeLocation || null,
        company_name: u.companyName || null,
        on_premises_domain: u.onPremisesDomainName || null,
        on_premises_last_sync: u.onPremisesLastSyncDateTime || null,
        aliases: u.Aliases || null,
        created: u.createdDateTime || null,
        usage_location: u.usageLocation || null,
        manager: u.manager?.displayName || null,
      },
    };
  });

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

// Safe API call that returns empty array on failure (non-critical enrichment)
async function safeApiCall(endpoint, params) {
  try {
    return await cippApiCall(endpoint, params);
  } catch (err) {
    console.warn(`[CIPP] ${endpoint} failed (non-critical): ${err.message}`);
    return [];
  }
}

async function syncGroups(customerId, tenantId) {
  const supabase = getServiceSupabase();
  const groups = await cippApiCall('ListGroups', { tenantFilter: tenantId });
  const groupList = Array.isArray(groups) ? groups : [];

  // Fetch members for each group (batch 5 at a time to avoid rate limits)
  const MEMBER_BATCH = 5;
  const groupMembersMap = {};
  for (let i = 0; i < groupList.length; i += MEMBER_BATCH) {
    const batch = groupList.slice(i, i + MEMBER_BATCH);
    const results = await Promise.allSettled(
      batch.map(async (g) => {
        try {
          const members = await cippApiCall('ListGroupMembers', {
            tenantFilter: tenantId,
            groupId: g.id || g.Id,
          });
          const memberList = Array.isArray(members) ? members : [];
          return {
            groupId: g.id || g.Id,
            members: memberList.map(m => m.displayName || m.userPrincipalName || m.mail || 'Unknown'),
          };
        } catch {
          return { groupId: g.id || g.Id, members: [] };
        }
      })
    );
    for (const r of results) {
      if (r.status === 'fulfilled') {
        groupMembersMap[r.value.groupId] = r.value.members;
      }
    }
  }

  const records = groupList.map((g) => {
    const groupType = g.calculatedGroupType || g.groupType || (() => {
      const types = g.groupTypes || [];
      const mailEnabled = g.mailEnabled ?? false;
      const secEnabled = g.securityEnabled ?? false;
      if (types.includes('Unified')) return 'M365 Group';
      if (mailEnabled && secEnabled) return 'Mail-Enabled Security';
      if (mailEnabled && !secEnabled) return 'Distribution List';
      return 'Security';
    })();

    // Use fetched members, fall back to CSV
    const groupId = g.id || g.Id || '';
    const fetchedMembers = groupMembersMap[groupId] || [];
    const csvMembers = (g.membersCsv || '').split(',').map(m => m.trim()).filter(Boolean);
    const members = fetchedMembers.length > 0 ? fetchedMembers : csvMembers;

    return {
      customer_id: customerId,
      cipp_tenant_id: tenantId,
      display_name: g.displayName || g.DisplayName || '',
      description: g.description || g.Description || null,
      mail: g.mail || g.Mail || null,
      group_type: groupType,
      member_count: members.length,
      external_id: groupId,
      cached_data: {
        members,
        teams_enabled: g.teamsEnabled ?? false,
        on_premises_sync: g.onPremisesSyncEnabled ?? false,
        visibility: g.visibility || null,
        dynamic: g.dynamicGroupBool ?? false,
        membership_rule: g.membershipRule || null,
      },
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
  console.log(`[CIPP] syncCustomer called: customerId=${customerId}, tenantId=${tenantId}`);
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
  console.log(`[CIPP] Handler called with:`, JSON.stringify(body));
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
