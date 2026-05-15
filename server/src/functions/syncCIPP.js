import { getServiceSupabase } from '../lib/supabase.js';
import { fetchWithTimeout, runWithConcurrency } from '../lib/sync-utils.js';

// ── Helpers ─────────────────────────────────────────────────────────────

function chunks(array, size) {
  const result = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

function asArray(payload, keys = []) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  const candidates = [
    ...keys,
    'value',
    'Value',
    'results',
    'Results',
    'data',
    'Data',
    'items',
    'Items',
    'rows',
    'Rows',
  ];
  for (const key of candidates) {
    if (Array.isArray(payload[key])) return payload[key];
  }
  return [];
}

function firstValue(source, keys) {
  for (const key of keys) {
    const value = source?.[key];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return null;
}

function numberValue(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function getSkuId(sku) {
  return firstValue(sku, ['skuId', 'SkuId', 'id', 'Id', 'accountSkuId', 'AccountSkuId']);
}

function getSkuName(sku) {
  return firstValue(sku, [
    'skuName',
    'SkuName',
    'displayName',
    'DisplayName',
    'productName',
    'ProductName',
    'skuPartNumber',
    'SkuPartNumber',
    'accountSkuId',
    'AccountSkuId',
  ]);
}

function getSkuTotal(sku) {
  const prepaid = sku?.prepaidUnits || sku?.PrepaidUnits || {};
  return numberValue(firstValue(prepaid, ['enabled', 'Enabled']))
    ?? numberValue(firstValue(sku, [
      'totalLicenses',
      'TotalLicenses',
      'activeUnits',
      'ActiveUnits',
      'enabled',
      'Enabled',
      'purchased',
      'Purchased',
    ]));
}

function getSkuConsumed(sku) {
  return numberValue(firstValue(sku, [
    'consumedUnits',
    'ConsumedUnits',
    'assigned',
    'Assigned',
    'assignedUnits',
    'AssignedUnits',
    'used',
    'Used',
  ]));
}

function buildLicenseSummary(skuList, userLicenseCounts) {
  const summary = new Map();

  for (const sku of skuList) {
    const id = getSkuId(sku);
    const name = getSkuName(sku) || id;
    if (!name) continue;
    const consumed = getSkuConsumed(sku);
    const total = getSkuTotal(sku);
    summary.set(name, {
      sku_id: id || null,
      name,
      assigned: consumed ?? userLicenseCounts.get(name) ?? 0,
      total,
      available: total === null ? null : Math.max(total - (consumed ?? userLicenseCounts.get(name) ?? 0), 0),
    });
  }

  for (const [name, assigned] of userLicenseCounts.entries()) {
    if (!summary.has(name)) {
      summary.set(name, {
        sku_id: null,
        name,
        assigned,
        total: null,
        available: null,
      });
    }
  }

  return [...summary.values()].sort((a, b) => (b.assigned || 0) - (a.assigned || 0));
}

async function upsertAndPrune(supabase, table, records, conflictKey, customerId) {
  const upsertedIds = new Set();

  for (const batch of chunks(records, 50)) {
    const { data, error } = await supabase
      .from(table)
      .upsert(batch, { onConflict: conflictKey })
      .select('id');
    if (error) throw new Error(`Upsert ${table} failed: ${error.message}`);
    for (const row of (data || [])) upsertedIds.add(row.id);
  }

  // Remove stale records that weren't in this sync batch
  if (upsertedIds.size > 0) {
    const idList = `(${[...upsertedIds].join(',')})`;
    const { error: deleteError } = await supabase
      .from(table)
      .delete()
      .eq('customer_id', customerId)
      .not('id', 'in', idList);
    if (deleteError) {
      console.warn(`[CIPP] Stale cleanup for ${table} failed (non-critical): ${deleteError.message}`);
    }
  }

  return upsertedIds.size;
}

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

  const response = await fetchWithTimeout(tokenUrl, {
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

  const response = await fetchWithTimeout(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    const safeError = errorText.replace(/\s+/g, ' ').slice(0, 300);
    console.error(`[CIPP] API error: ${response.status} (${endpoint})${safeError ? ` | ${safeError}` : ''}`);
    throw new Error(`CIPP API error (${endpoint}): ${response.status}`);
  }

  return response.json();
}

// ── Actions ─────────────────────────────────────────────────────────────

async function testConnection() {
  const tenants = await cippApiCall('ListTenants');
  const tenantList = asArray(tenants, ['tenants', 'Tenants']);
  return {
    success: true,
    totalTenants: tenantList.length,
    message: `Connected! Found ${tenantList.length} tenants.`,
  };
}

async function listTenants() {
  const tenants = await cippApiCall('ListTenants');
  const tenantList = asArray(tenants, ['tenants', 'Tenants']);
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
  const [users, mfaData, licenseSKUs, signIns, inactiveAccounts] = await Promise.all([
    cippApiCall('ListUsers', { tenantFilter: tenantId }),
    safeFirstApiCall(['ListPerUserMFA', 'ListMFAUsers'], { tenantFilter: tenantId }),
    safeApiCall('ListLicenses', { tenantFilter: tenantId }),
    safeApiCall('ListSignIns', { tenantFilter: tenantId, Days: 30, filter: 'createdDateTime ge ' + new Date(Date.now() - 30 * 86400000).toISOString() }),
    safeApiCall('ListInactiveAccounts', { tenantFilter: tenantId }),
  ]);

  const userList = asArray(users, ['users', 'Users']);
  const mfaList = asArray(mfaData, ['users', 'Users']);
  const skuList = asArray(licenseSKUs, ['licenses', 'Licenses', 'skus', 'Skus']);
  const signInList = asArray(signIns, ['signIns', 'SignIns']);
  const inactiveList = asArray(inactiveAccounts, ['users', 'Users', 'accounts', 'Accounts']);

  // Build MFA lookup by UPN
  const mfaMap = {};
  for (const m of mfaList) {
    const upn = m.userPrincipalName || m.UserPrincipalName || m.UPN || m.upn || '';
    if (upn) {
      const accountEnabled = m.accountEnabled ?? m.AccountEnabled;
      const accountDisabled = accountEnabled === false || String(accountEnabled).toLowerCase() === 'false';
      const conditionalAccessCovered = m.CoveredByCA === true || String(m.CoveredByCA).toLowerCase() === 'true';
      const securityDefaultsCovered = m.CoveredBySD === true || String(m.CoveredBySD).toLowerCase() === 'true';
      mfaMap[upn.toLowerCase()] = {
        status: accountDisabled ? 'disabled'
          : m.perUser || m.PerUser || m.MFAState || m.MFARegistration
          || (conditionalAccessCovered ? 'conditional access' : '')
          || (securityDefaultsCovered ? 'security defaults' : '')
          || 'unknown',
        methods: m.MFAMethods || m.authMethods || m.methods || [],
      };
    }
  }

  // Build SKU name lookup (skuId → friendly name)
  const skuMap = {};
  for (const sku of skuList) {
    const skuId = getSkuId(sku) || '';
    if (skuId) {
      skuMap[skuId] = getSkuName(sku) || skuId;
    }
  }

  const userLicenseCounts = new Map();

  // Build last sign-in lookup by UPN (most recent)
  const signInMap = {};
  for (const s of signInList) {
    const upn = (s.userPrincipalName || s.UserPrincipalName || '').toLowerCase();
    if (!upn) continue;
    const dt = s.createdDateTime || s.CreatedDateTime || '';
    if (!signInMap[upn] || dt > signInMap[upn].date) {
      const errorCode = s.status?.errorCode ?? s.errorCode ?? s.ErrorCode;
      const isSuccess = errorCode === undefined || errorCode === null || Number(errorCode) === 0;
      signInMap[upn] = {
        date: dt,
        ip: s.ipAddress || s.IPAddress || null,
        location: s.locationcipp || s.LocationCipp || [s.location?.city, s.location?.state, s.location?.countryOrRegion].filter(Boolean).join(', ') || null,
        app: s.appDisplayName || s.AppDisplayName || s.clientAppUsed || s.ClientAppUsed || null,
        status: isSuccess ? 'success' : 'failed',
        error: s.status?.failureReason || s.additionalDetails || s.AdditionalDetails || null,
      };
    }
  }

  const inactiveMap = {};
  for (const account of inactiveList) {
    const upn = (account.userPrincipalName || account.UserPrincipalName || account.UPN || '').toLowerCase();
    if (!upn) continue;
    inactiveMap[upn] = {
      date: account.lastSignInDateTime || account.LastSignInDateTime || account.lastNonInteractiveSignInDateTime || null,
      refreshed: account.lastRefreshedDateTime || null,
      assignedLicenses: account.numberOfAssignedLicenses ?? null,
    };
  }

  const records = userList.map((u) => {
    const upn = (u.userPrincipalName || u.UserPrincipalName || '').toLowerCase();
    const mfa = mfaMap[upn] || { status: 'unknown', methods: [] };
    const lastSignIn = signInMap[upn] || null;
    const inactiveAccount = inactiveMap[upn] || null;
    const lastSignInDate = lastSignIn?.date
      || u.lastSignInDateTime
      || u.LastSignIn
      || u.signInActivity?.lastSignInDateTime
      || inactiveAccount?.date
      || null;

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

    for (const licenseName of licenseString.split(',').map(l => l.trim()).filter(Boolean)) {
      userLicenseCounts.set(licenseName, (userLicenseCounts.get(licenseName) || 0) + 1);
    }

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
      last_sign_in: lastSignInDate,
      on_premises_sync_enabled: u.onPremisesSyncEnabled ?? u.OnPremisesSyncEnabled ?? false,
      external_id: u.id || u.Id || u.ObjectId || '',
      cached_data: {
        licenses: licenseString,
        mfa_status: mfa.status,
        mfa_methods: mfa.methods,
        last_sign_in_details: lastSignIn || (inactiveAccount ? {
          date: inactiveAccount.date,
          status: 'inactive',
          refreshed: inactiveAccount.refreshed,
          assigned_licenses: inactiveAccount.assignedLicenses,
        } : null),
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

  // Upsert records, then prune stale entries
  const count = records.length > 0
    ? await upsertAndPrune(supabase, 'cipp_users', records, 'cipp_tenant_id,external_id', customerId)
    : 0;

  return { success: true, count, licenseSummary: buildLicenseSummary(skuList, userLicenseCounts) };
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

async function safeFirstApiCall(endpoints, params) {
  for (const endpoint of endpoints) {
    try {
      return await cippApiCall(endpoint, params);
    } catch (err) {
      console.warn(`[CIPP] ${endpoint} failed (non-critical): ${err.message}`);
    }
  }
  return [];
}

function getGroupId(group) {
  return group?.id || group?.Id || group?.groupId || group?.GroupId || group?.idTxt || '';
}

function getGroupMemberName(member) {
  if (typeof member === 'string') return member;
  return member?.displayName ||
    member?.DisplayName ||
    member?.userPrincipalName ||
    member?.UserPrincipalName ||
    member?.mail ||
    member?.Mail ||
    member?.id ||
    '';
}

function getGroupMembersFromPayload(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) {
    return payload.map(getGroupMemberName).filter(Boolean);
  }
  const members = asArray(payload.members || payload.Members || payload.memberList || payload.MemberList);
  return members.map(getGroupMemberName).filter(Boolean);
}

async function syncGroups(customerId, tenantId) {
  const supabase = getServiceSupabase();
  const groups = await cippApiCall('ListGroups', { tenantFilter: tenantId });
  const groupList = asArray(groups, ['groups', 'Groups']);

  // CIPP's ListGroups detail endpoint returns members when groupID + members=true are provided.
  const MEMBER_BATCH = 5;
  const groupMembersMap = {};
  const groupDetailsMap = {};
  for (let i = 0; i < groupList.length; i += MEMBER_BATCH) {
    const batch = groupList.slice(i, i + MEMBER_BATCH);
    const results = await Promise.allSettled(
      batch.map(async (g) => {
        const groupId = getGroupId(g);
        if (!groupId) return { groupId, detail: null, members: [] };
        try {
          const detail = await cippApiCall('ListGroups', {
            tenantFilter: tenantId,
            groupID: groupId,
            members: true,
            owners: true,
          });
          return {
            groupId,
            detail,
            members: getGroupMembersFromPayload(detail),
          };
        } catch {
          return { groupId, detail: null, members: [] };
        }
      })
    );
    for (const r of results) {
      if (r.status === 'fulfilled') {
        groupMembersMap[r.value.groupId] = r.value.members;
        groupDetailsMap[r.value.groupId] = r.value.detail;
      }
    }
  }

  const records = groupList.map((g) => {
    const groupId = getGroupId(g);
    const detail = groupDetailsMap[groupId] || {};
    const groupInfo = detail.groupInfo || detail.GroupInfo || detail;
    const groupType = g.calculatedGroupType || g.groupType || groupInfo.calculatedGroupType || groupInfo.groupType || (() => {
      const types = g.groupTypes || groupInfo.groupTypes || [];
      const mailEnabled = g.mailEnabled ?? groupInfo.mailEnabled ?? false;
      const secEnabled = g.securityEnabled ?? groupInfo.securityEnabled ?? false;
      if (types.includes('Unified')) return 'M365 Group';
      if (mailEnabled && secEnabled) return 'Mail-Enabled Security';
      if (mailEnabled && !secEnabled) return 'Distribution List';
      return 'Security';
    })();

    // Use fetched members from group details, fall back to any list-level CSV/detail payload.
    const fetchedMembers = groupMembersMap[groupId] || [];
    const detailMembers = getGroupMembersFromPayload(g);
    const csvMembers = (g.membersCsv || groupInfo.membersCsv || '').split(',').map(m => m.trim()).filter(Boolean);
    const members = fetchedMembers.length > 0 ? fetchedMembers : csvMembers;
    const resolvedMembers = members.length > 0 ? members : detailMembers;

    return {
      customer_id: customerId,
      cipp_tenant_id: tenantId,
      display_name: g.displayName || g.DisplayName || groupInfo.displayName || groupInfo.DisplayName || '',
      description: g.description || g.Description || groupInfo.description || groupInfo.Description || null,
      mail: g.mail || g.Mail || groupInfo.mail || groupInfo.Mail || null,
      group_type: groupType,
      member_count: resolvedMembers.length,
      external_id: groupId,
      cached_data: {
        members: resolvedMembers,
        teams_enabled: g.teamsEnabled ?? groupInfo.teamsEnabled ?? false,
        on_premises_sync: g.onPremisesSyncEnabled ?? groupInfo.onPremisesSyncEnabled ?? false,
        visibility: g.visibility || groupInfo.visibility || null,
        dynamic: g.dynamicGroupBool ?? groupInfo.dynamicGroupBool ?? false,
        membership_rule: g.membershipRule || groupInfo.membershipRule || null,
      },
    };
  });

  // Upsert records, then prune stale entries
  const count = records.length > 0
    ? await upsertAndPrune(supabase, 'cipp_groups', records, 'cipp_tenant_id,external_id', customerId)
    : 0;

  return { success: true, count };
}

async function syncMailboxes(customerId, tenantId) {
  const supabase = getServiceSupabase();
  const mailboxes = await cippApiCall('ListMailboxes', { tenantFilter: tenantId });
  const mailboxList = asArray(mailboxes, ['mailboxes', 'Mailboxes']);

  const records = mailboxList.map((m) => ({
    customer_id: customerId,
    cipp_tenant_id: tenantId,
    display_name: m.displayName || m.DisplayName || '',
    user_principal_name: m.userPrincipalName || m.UserPrincipalName || '',
    primary_smtp_address: m.primarySmtpAddress || m.PrimarySmtpAddress || m.UPN || '',
    mailbox_type: m.recipientTypeDetails || m.RecipientTypeDetails || m.recipientType || 'UserMailbox',
    external_id: m.externalDirectoryObjectId || m.ExternalDirectoryObjectId || m.ObjectId || '',
  }));

  // Upsert records, then prune stale entries
  const count = records.length > 0
    ? await upsertAndPrune(supabase, 'cipp_mailboxes', records, 'cipp_tenant_id,external_id', customerId)
    : 0;

  return { success: true, count };
}

async function syncCustomer(customerId, tenantId) {
  console.log(`[CIPP] syncCustomer called: customerId=${customerId}, tenantId=${tenantId}`);
  const supabase = getServiceSupabase();
  const results = { users: 0, groups: 0, mailboxes: 0, licenses: [], errors: [] };

  try {
    const userResult = await syncUsers(customerId, tenantId);
    results.users = userResult.count;
    results.licenses = userResult.licenseSummary || [];
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
      cached_data: {
        users: results.users,
        groups: results.groups,
        mailboxes: results.mailboxes,
        licenses: results.licenses,
      },
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

  // Concurrency 4 — CIPP per-customer hits multiple downstream MS Graph
  // endpoints (users, groups+members, mailboxes, SKUs, signins). 4 in flight
  // keeps the CIPP proxy from rate-limiting / queueing.
  const startedAt = Date.now();
  const settled = await runWithConcurrency(mappings, 4, async (mapping) => {
    const result = await syncCustomer(mapping.customer_id, mapping.cipp_tenant_id);
    return { customer: mapping.customer_name, ...result };
  });
  const results = settled.map((r, i) => r.ok
    ? r.value
    : { customer: mappings[i]?.customer_name, success: false, error: r.error?.message || 'unknown' });

  const succeeded = results.filter((r) => r.success).length;
  console.log(`[CIPP] sync_all done in ${Date.now() - startedAt}ms — ${succeeded}/${results.length}`);
  return {
    success: true,
    message: `Synced ${succeeded}/${results.length} customers`,
    results,
  };
}

// ── Main handler ────────────────────────────────────────────────────────

export async function syncCIPP(body = {}) {
  const { action, customerId, tenantId } = body;
  console.log(`[CIPP] Handler called: action=${action || 'missing'} customerId=${customerId || 'none'} tenantId=${tenantId || 'none'}`);

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
