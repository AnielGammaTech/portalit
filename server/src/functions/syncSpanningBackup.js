import { getServiceSupabase } from '../lib/supabase.js';

const UNITRENDS_API_BASE = 'https://public-api.backup.net';
const UNITRENDS_AUTH_URL = 'https://login.backup.net/connect/token';

let cachedToken = null;
let tokenExpiry = 0;

async function getUnitrendsToken() {
  const now = Date.now();
  if (cachedToken && tokenExpiry > now) {
    return cachedToken;
  }

  const clientId = process.env.UNITRENDS_CLIENT_ID;
  const clientSecret = process.env.UNITRENDS_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Unitrends credentials not configured');
  }

  // Basic auth with Base64 encoded client_id:client_secret
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const response = await fetch(UNITRENDS_AUTH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${basicAuth}`,
      'Accept': '*/*'
    },
    body: 'grant_type=client_credentials'
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Auth failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  cachedToken = data.access_token;
  tokenExpiry = now + ((data.expires_in || 3600) - 60) * 1000;
  return cachedToken;
}

async function unitrendsApiCall(endpoint) {
  const token = await getUnitrendsToken();
  const response = await fetch(`${UNITRENDS_API_BASE}${endpoint}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Unitrends API error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

function formatStorage(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(2)} GB`;
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(2)} MB`;
  return `${(bytes / 1024).toFixed(2)} KB`;
}

function parseUsersResponse(usersResponse) {
  let users = [];
  if (Array.isArray(usersResponse)) {
    if (usersResponse[0]?.users) {
      users = usersResponse[0].users;
    } else {
      users = usersResponse;
    }
  } else if (usersResponse?.users) {
    if (Array.isArray(usersResponse.users) && usersResponse.users[0]?.users) {
      users = usersResponse.users[0].users;
    } else {
      users = usersResponse.users;
    }
  }
  return users;
}

async function fetchAllUsers(tenantId) {
  const resp = await unitrendsApiCall(
    `/v2/spanning/domains/${tenantId}/users?page_size=1000`
  );
  return parseUsersResponse(resp);
}

function formatUser(u) {
  const storageInfo = u.storageInformation || {};
  const mailBytes = storageInfo.protectedMailBytes || u.mailStorageBytes || u.exchangeStorageBytes || 0;
  const driveBytes = storageInfo.protectedBytes || u.driveStorageBytes || u.oneDriveStorageBytes || 0;
  const totalBytes = mailBytes + driveBytes;

  const hasBackupData = totalBytes > 0;
  const isAssigned = u.isAssigned === true || u.assigned === true || u.isLicensed === true;
  const hasSuccessBackup = u.lastBackupStatusTotal === 'success';
  const isProtected = hasBackupData || isAssigned || hasSuccessBackup;

  return {
    email: u.email || u.userPrincipalName || 'Unknown',
    displayName: u.displayName || u.email || 'Unknown',
    isProtected,
    backupStatus: u.lastBackupStatusTotal || 'unknown',
    mailStorage: formatStorage(mailBytes),
    driveStorage: formatStorage(driveBytes),
    totalStorage: formatStorage(totalBytes),
    totalStorageBytes: totalBytes,
    mailStorageBytes: mailBytes,
    driveStorageBytes: driveBytes,
    userType: u.userType || u.type || 'standard',
    lastBackupDate: u.lastBackupDate || null
  };
}

function buildContactTitle(spUser) {
  const storageInfo = spUser.storageInformation || {};
  const mailStorageBytes = storageInfo.protectedMailBytes || spUser.mailStorageBytes || spUser.exchangeStorageBytes || 0;
  const driveStorageBytes = storageInfo.protectedBytes || spUser.driveStorageBytes || spUser.oneDriveStorageBytes || 0;
  const totalStorageBytes = mailStorageBytes + driveStorageBytes;

  const isProtected = spUser.isAssigned === true || spUser.assigned === true || spUser.isLicensed === true;
  const hasBackup = spUser.lastBackupStatusTotal === 'success';

  const storageStr = totalStorageBytes > 0 ? formatStorage(totalStorageBytes) : null;
  const backupStatus = spUser.lastBackupStatusTotal || (isProtected ? 'protected' : 'not_protected');

  const titleParts = [];
  if (storageStr) titleParts.push(storageStr);
  titleParts.push(backupStatus);
  if (isProtected || hasBackup) titleParts.push('PROTECTED');
  return titleParts.join(' | ');
}

function buildCacheData(users, domainInfo) {
  const formattedUsers = users.map(formatUser);
  const domainStorage = domainInfo?.storageInformation || {};
  const lastBackup = domainInfo?.lastBackup || {};
  const backupStatus7Days = domainInfo?.backupStatusLastSevenDays || {};

  return {
    success: true,
    total: users.length,
    users: formattedUsers,
    numberOfStandardLicensesTotal: domainInfo?.numberOfStandardLicensesTotal || 0,
    numberOfProtectedStandardUsers: domainInfo?.numberOfProtectedStandardUsers || 0,
    numberOfArchivedLicensesTotal: domainInfo?.numberOfArchivedLicensesTotal || 0,
    numberOfProtectedArchivedUsers: domainInfo?.numberOfProtectedArchivedUsers || 0,
    numberOfUsers: domainInfo?.numberOfUsers || 0,
    numberOfProtectedUsers: domainInfo?.numberOfProtectedUsers || 0,
    numberOfSharedMailboxesTotal: domainInfo?.numberOfSharedMailboxesTotal || 0,
    numberOfProtectedSharedMailboxes: domainInfo?.numberOfProtectedSharedMailboxes || 0,
    numberOfProtectedSharePointSites: domainInfo?.numberOfProtectedSharePointSites || 0,
    numberOfUnprotectedSharePointSites: domainInfo?.numberOfUnprotectedSharePointSites || 0,
    numberOfProtectedTeamChannels: domainInfo?.numberOfProtectedTeamChannels || 0,
    numberOfUnprotectedTeamChannels: domainInfo?.numberOfUnprotectedTeamChannels || 0,
    totalProtectedBytes: domainStorage.protectedBytes || 0,
    totalUsedBytes: domainStorage.usedBytes || 0,
    totalProtectedStorage: formatStorage(domainStorage.protectedBytes || 0),
    totalUsedStorage: formatStorage(domainStorage.usedBytes || 0),
    lastBackupStatus: lastBackup.status || 'unknown',
    lastBackupTimestamp: lastBackup.timestamp || null,
    sharePointBackupStatus: lastBackup.sharePoint?.status || 'unknown',
    sharePointLastBackup: lastBackup.sharePoint?.timestamp || null,
    teamsBackupStatus: lastBackup.teams?.status || 'unknown',
    teamsLastBackup: lastBackup.teams?.timestamp || null,
    backupStatus7Days: {
      mail: backupStatus7Days.totalForMail || 'unknown',
      calendar: backupStatus7Days.totalForCalendar || 'unknown',
      contacts: backupStatus7Days.totalForContact || 'unknown',
      drive: backupStatus7Days.totalForDrive || 'unknown',
      sharePoint: backupStatus7Days.totalForSharePoint || 'unknown',
      teams: backupStatus7Days.totalForTeams || 'unknown'
    },
    overallBackupStatus7Days: domainInfo?.backupStatusLastSevenDaysTotal || 'unknown',
    domainName: domainInfo?.name || 'unknown',
    domainId: domainInfo?.id || 'unknown',
    expirationDate: domainInfo?.expirationDate || null,
    origin: domainInfo?.origin || 'unknown'
  };
}

export async function syncSpanningBackup(body, user) {
  const supabase = getServiceSupabase();
  const { action, customer_id } = body;

  // Test connection
  if (action === 'test_connection') {
    try {
      const customers = await unitrendsApiCall('/v1/customers?page_size=5');
      return {
        success: true,
        totalCustomers: customers.length || 0
      };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  // List Spanning domains/tenants
  if (action === 'list_domains') {
    try {
      const domains = await unitrendsApiCall('/v2/spanning/domains?page_size=500');
      const domainsWithDetails = domains || [];
      return {
        success: true,
        domains: domainsWithDetails,
        sampleDomain: domainsWithDetails[0] || null
      };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  // Get cached data without calling external API
  if (action === 'get_cached') {
    if (!customer_id) {
      const err = new Error('customer_id is required');
      err.statusCode = 400;
      throw err;
    }

    const { data: mappings } = await supabase
      .from('spanning_mappings')
      .select('*')
      .eq('customer_id', customer_id);

    if (!mappings || mappings.length === 0) {
      const err = new Error('No Spanning mapping found for this customer');
      err.statusCode = 400;
      throw err;
    }

    const mapping = mappings[0];

    if (mapping.cached_data) {
      try {
        return {
          success: true,
          cached: true,
          last_synced: mapping.last_synced,
          ...mapping.cached_data
        };
      } catch (e) {
        // Cache invalid, return empty
      }
    }

    return {
      success: true,
      cached: true,
      last_synced: mapping.last_synced,
      total: 0,
      users: [],
      message: 'No cached data available. Click Sync to fetch data.'
    };
  }

  // List users for a tenant
  if (action === 'list_users') {
    if (!customer_id) {
      const err = new Error('customer_id is required');
      err.statusCode = 400;
      throw err;
    }

    const { data: mappings } = await supabase
      .from('spanning_mappings')
      .select('*')
      .eq('customer_id', customer_id);

    if (!mappings || mappings.length === 0) {
      const err = new Error('No Spanning mapping found for this customer');
      err.statusCode = 400;
      throw err;
    }

    const mapping = mappings[0];
    const users = await fetchAllUsers(mapping.spanning_tenant_id);

    // Get all domains and find this one by ID
    const allDomains = await unitrendsApiCall('/v2/spanning/domains?page_size=500');
    const domainInfo = allDomains.find(d => d.id === mapping.spanning_tenant_id);

    const responseData = buildCacheData(users, domainInfo);

    // Cache the data for future quick loads using RPC for reliability
    const { error: cacheErr } = await supabase.rpc('write_mapping_cache', {
      p_table: 'spanning_mappings',
      p_mapping_id: mapping.id,
      p_cached_data: responseData,
      p_last_synced: new Date().toISOString(),
    });
    if (cacheErr) {
      console.error('[Spanning] list_users cache write failed:', cacheErr.message);
    }

    return responseData;
  }

  // List SharePoint sites for a tenant
  if (action === 'list_sharepoint_sites') {
    if (!customer_id) {
      const err = new Error('customer_id is required');
      err.statusCode = 400;
      throw err;
    }

    const { data: mappings } = await supabase
      .from('spanning_mappings')
      .select('*')
      .eq('customer_id', customer_id);

    if (!mappings || mappings.length === 0) {
      const err = new Error('No Spanning mapping found for this customer');
      err.statusCode = 400;
      throw err;
    }

    const mapping = mappings[0];

    const { data: cred } = await supabase
      .from('spanning_credentials')
      .select('api_key')
      .eq('customer_id', customer_id)
      .maybeSingle();

    if (!cred?.api_key) {
      return {
        success: true,
        total: 0,
        sites: [],
        message: 'No tenant API key configured. Add the Spanning API key in Settings to view SharePoint sites.'
      };
    }

    try {
      const allDomains = await unitrendsApiCall('/v2/spanning/domains?page_size=500');
      const domainInfo = allDomains.find(d => d.id === mapping.spanning_tenant_id);

      if (!domainInfo) {
        return { success: false, error: 'Could not find domain info in Unitrends API' };
      }

      return {
        success: true,
        total: 0,
        sites: [],
        sharePointSummary: {
          protectedSites: domainInfo.numberOfProtectedSharePointSites || 0,
          unprotectedSites: domainInfo.numberOfUnprotectedSharePointSites || 0,
          totalSites: (domainInfo.numberOfProtectedSharePointSites || 0) + (domainInfo.numberOfUnprotectedSharePointSites || 0)
        },
        tenantName: domainInfo.name || mapping.spanning_tenant_name,
        message: 'SharePoint site details are available in the Spanning portal. Summary counts shown here.'
      };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  // List Teams channels for a tenant
  if (action === 'list_teams_channels') {
    if (!customer_id) {
      const err = new Error('customer_id is required');
      err.statusCode = 400;
      throw err;
    }

    const { data: mappings } = await supabase
      .from('spanning_mappings')
      .select('*')
      .eq('customer_id', customer_id);

    if (!mappings || mappings.length === 0) {
      const err = new Error('No Spanning mapping found for this customer');
      err.statusCode = 400;
      throw err;
    }

    const mapping = mappings[0];

    const { data: cred } = await supabase
      .from('spanning_credentials')
      .select('api_key')
      .eq('customer_id', customer_id)
      .maybeSingle();

    if (!cred?.api_key) {
      return {
        success: true,
        total: 0,
        teams: [],
        message: 'No tenant API key configured. Add the Spanning API key in Settings to view Teams channels.'
      };
    }

    try {
      const allDomains = await unitrendsApiCall('/v2/spanning/domains?page_size=500');
      const domainInfo = allDomains.find(d => d.id === mapping.spanning_tenant_id);

      if (!domainInfo) {
        return { success: false, error: 'Could not find domain info in Unitrends API' };
      }

      return {
        success: true,
        total: 0,
        teams: [],
        teamsSummary: {
          protectedChannels: domainInfo.numberOfProtectedTeamChannels || 0,
          unprotectedChannels: domainInfo.numberOfUnprotectedTeamChannels || 0,
          totalChannels: (domainInfo.numberOfProtectedTeamChannels || 0) + (domainInfo.numberOfUnprotectedTeamChannels || 0)
        },
        tenantName: domainInfo.name || mapping.spanning_tenant_name,
        message: 'Teams channel details are available in the Spanning portal. Summary counts shown here.'
      };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  // Sync users to contacts
  if (action === 'sync_users') {
    if (!customer_id) {
      const err = new Error('customer_id is required');
      err.statusCode = 400;
      throw err;
    }

    const { data: mappings } = await supabase
      .from('spanning_mappings')
      .select('*')
      .eq('customer_id', customer_id);

    if (!mappings || mappings.length === 0) {
      const err = new Error('No Spanning mapping found for this customer');
      err.statusCode = 400;
      throw err;
    }

    const mapping = mappings[0];
    const spanningUsers = await fetchAllUsers(mapping.spanning_tenant_id);

    // Get domain info for cache data
    const allDomains = await unitrendsApiCall('/v2/spanning/domains?page_size=500');
    const domainInfo = allDomains.find(d => d.id === mapping.spanning_tenant_id);

    // Get existing contacts
    const { data: existingContacts } = await supabase
      .from('contacts')
      .select('*')
      .eq('customer_id', customer_id);

    const existingByEmail = {};
    (existingContacts || []).forEach(c => {
      if (c.email) existingByEmail[c.email.toLowerCase()] = c;
    });

    let created = 0;
    let matched = 0;
    let updated = 0;

    for (const spUser of spanningUsers) {
      const email = spUser.email?.toLowerCase() || spUser.userPrincipalName?.toLowerCase();
      if (!email) continue;

      const contactTitle = buildContactTitle(spUser);

      const existing = existingByEmail[email];
      if (existing) {
        await supabase
          .from('contacts')
          .update({ spanning_status: contactTitle })
          .eq('id', existing.id);
        updated++;
        matched++;
      }
      // NEVER create new contacts - Spanning only attaches to existing contacts
    }

    // Build and persist cache data so it's available on next page load
    const cacheData = buildCacheData(spanningUsers, domainInfo);
    const { error: cacheErr } = await supabase.rpc('write_mapping_cache', {
      p_table: 'spanning_mappings',
      p_mapping_id: mapping.id,
      p_cached_data: cacheData,
      p_last_synced: new Date().toISOString(),
    });
    if (cacheErr) {
      console.error('[Spanning] sync_users cache write failed:', cacheErr.message);
    }

    return {
      success: true,
      totalSpanningUsers: spanningUsers.length,
      created,
      matched,
      updated
    };
  }

  // Sync licenses (contacts only, no SaaS license auto-creation)
  if (action === 'sync_licenses') {
    if (!customer_id) {
      return { success: false, error: 'customer_id is required' };
    }

    const { data: mappings } = await supabase
      .from('spanning_mappings')
      .select('*')
      .eq('customer_id', customer_id);

    if (!mappings || mappings.length === 0) {
      return { success: true, skipped: true, message: 'No Spanning mapping found for this customer' };
    }

    const mapping = mappings[0];

    // Get all domains and find this one by ID for accurate license counts
    const allDomains = await unitrendsApiCall('/v2/spanning/domains?page_size=500');
    const domainInfo = allDomains.find(d => d.id === mapping.spanning_tenant_id);

    const standardLicenses = domainInfo?.numberOfStandardLicensesTotal || 0;
    const protectedStandard = domainInfo?.numberOfProtectedStandardUsers || 0;
    const archivedLicenses = domainInfo?.numberOfArchivedLicensesTotal || 0;
    const protectedArchived = domainInfo?.numberOfProtectedArchivedUsers || 0;
    const sharedMailboxes = domainInfo?.numberOfSharedMailboxesTotal || 0;
    const protectedShared = domainInfo?.numberOfProtectedSharedMailboxes || 0;

    // Also get user list for contact syncing
    const users = await fetchAllUsers(mapping.spanning_tenant_id);

    // Sync contacts
    const { data: existingContacts } = await supabase
      .from('contacts')
      .select('*')
      .eq('customer_id', customer_id);

    const existingByEmail = {};
    (existingContacts || []).forEach(c => {
      if (c.email) existingByEmail[c.email.toLowerCase()] = c;
    });

    let contactsUpdated = 0;

    for (const spUser of users) {
      const email = spUser.email?.toLowerCase() || spUser.userPrincipalName?.toLowerCase();
      if (!email) continue;

      const contactTitle = buildContactTitle(spUser);

      const existing = existingByEmail[email];
      if (existing) {
        await supabase
          .from('contacts')
          .update({ spanning_status: contactTitle })
          .eq('id', existing.id);
        contactsUpdated++;
      }
    }

    // Build cache data
    const cacheData = buildCacheData(users, domainInfo);

    // Write cache using RPC for reliability
    const { error: cacheErr } = await supabase.rpc('write_mapping_cache', {
      p_table: 'spanning_mappings',
      p_mapping_id: mapping.id,
      p_cached_data: cacheData,
      p_last_synced: new Date().toISOString(),
    });
    if (cacheErr) {
      console.error('[Spanning] sync_licenses cache write failed:', cacheErr.message);
    }

    return {
      success: true,
      standardLicenses,
      protectedStandard,
      archivedLicenses,
      protectedArchived,
      sharedMailboxes,
      protectedShared,
      contactsUpdated,
      tenantName: mapping.spanning_tenant_name
    };
  }

  // Sync all mapped customers (contacts only)
  if (action === 'sync_all') {
    const { data: allMappings } = await supabase
      .from('spanning_mappings')
      .select('*');

    let synced = 0;
    let errors = 0;

    // Pre-fetch all domains once for cache data
    let allDomains = [];
    try {
      allDomains = await unitrendsApiCall('/v2/spanning/domains?page_size=500');
    } catch (e) {
      console.error('Failed to fetch domains for cache:', e.message);
    }

    for (const mapping of (allMappings || [])) {
      try {
        const users = await fetchAllUsers(mapping.spanning_tenant_id);

        // Sync contacts
        const { data: existingContacts } = await supabase
          .from('contacts')
          .select('*')
          .eq('customer_id', mapping.customer_id);

        const existingByEmail = {};
        (existingContacts || []).forEach(c => {
          if (c.email) existingByEmail[c.email.toLowerCase()] = c;
        });

        for (const spUser of users) {
          const email = spUser.email?.toLowerCase() || spUser.userPrincipalName?.toLowerCase();
          if (!email) continue;

          const contactTitle = buildContactTitle(spUser);

          const existing = existingByEmail[email];
          if (existing) {
            await supabase
              .from('contacts')
              .update({ spanning_status: contactTitle })
              .eq('id', existing.id);
          }
        }

        // Build and persist cache data using RPC
        const domainInfo = allDomains.find(d => d.id === mapping.spanning_tenant_id);
        const cacheData = buildCacheData(users, domainInfo);

        const { error: cacheErr } = await supabase.rpc('write_mapping_cache', {
          p_table: 'spanning_mappings',
          p_mapping_id: mapping.id,
          p_cached_data: cacheData,
          p_last_synced: new Date().toISOString(),
        });
        if (cacheErr) {
          console.error(`[Spanning] sync_all cache write failed for ${mapping.id}:`, cacheErr.message);
        }

        synced++;
      } catch (e) {
        console.error(`Failed to sync mapping ${mapping.id}:`, e.message);
        errors++;
      }
    }

    return { success: true, synced, errors };
  }

  const err = new Error('Invalid action');
  err.statusCode = 400;
  throw err;
}
