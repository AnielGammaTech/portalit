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
    lastBackupDate: u.lastBackupDate || null,
  };
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
      teams: backupStatus7Days.totalForTeams || 'unknown',
    },
    overallBackupStatus7Days: domainInfo?.backupStatusLastSevenDaysTotal || 'unknown',
    domainName: domainInfo?.name || 'unknown',
    domainId: domainInfo?.id || 'unknown',
    expirationDate: domainInfo?.expirationDate || null,
    origin: domainInfo?.origin || 'unknown',
  };
}

export async function scheduledSpanningSync(body, user) {
  const supabase = getServiceSupabase();

  // Get all Spanning mappings
  const { data: allMappings } = await supabase
    .from('spanning_mappings')
    .select('*');

  if (!allMappings || allMappings.length === 0) {
    return { success: true, message: 'No Spanning mappings found', synced: 0 };
  }

  // Pre-fetch all domains once for cache data
  let allDomains = [];
  try {
    allDomains = await unitrendsApiCall('/v2/spanning/domains?page_size=500');
  } catch (e) {
    console.error('Failed to fetch domains for cache:', e.message);
  }

  let synced = 0;
  let errors = 0;
  const results = [];

  for (const mapping of allMappings) {
    try {
      const usersResponse = await unitrendsApiCall(`/v2/spanning/domains/${mapping.spanning_tenant_id}/users?page_size=1000`);

      // Handle nested response structure
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

      const totalUsers = users.length;
      const assignedUsers = users.filter(u => u.lastBackupStatusTotal === 'success').length || totalUsers;

      // Get customer
      const { data: customers } = await supabase
        .from('customers')
        .select('*')
        .eq('id', mapping.customer_id);
      const customer = customers?.[0];

      // Update contacts with spanning status
      const { data: existingContacts } = await supabase
        .from('contacts')
        .select('*')
        .eq('customer_id', mapping.customer_id);

      const existingByEmail = {};
      (existingContacts || []).forEach(c => {
        if (c.email) existingByEmail[c.email.toLowerCase()] = c;
      });

      let contactsUpdated = 0;
      for (const spUser of users) {
        const email = spUser.email?.toLowerCase() || spUser.userPrincipalName?.toLowerCase();
        if (!email) continue;

        const isProtected = spUser.isAssigned === true || spUser.assigned === true || spUser.isLicensed === true || spUser.lastBackupStatusTotal === 'success';

        const storageInfo = spUser.storageInformation || {};
        const mailStorageBytes = storageInfo.protectedMailBytes || spUser.mailStorageBytes || 0;
        const driveStorageBytes = storageInfo.protectedBytes || spUser.driveStorageBytes || 0;
        const totalStorageBytes = mailStorageBytes + driveStorageBytes;

        const storageStr = formatStorage(totalStorageBytes);
        const backupStatus = spUser.lastBackupStatusTotal || (isProtected ? 'protected' : 'not_protected');

        const titleParts = [];
        if (storageStr) titleParts.push(storageStr);
        titleParts.push(backupStatus);
        if (isProtected) titleParts.push('PROTECTED');
        const contactTitle = titleParts.join(' | ');

        const existing = existingByEmail[email];
        if (existing) {
          await supabase
            .from('contacts')
            .update({ spanning_status: contactTitle })
            .eq('id', existing.id);
          contactsUpdated++;
        }
      }

      // Build and persist cache data using RPC for reliability
      const domainInfo = allDomains.find(d => d.id === mapping.spanning_tenant_id);
      const cacheData = buildCacheData(users, domainInfo);

      const { error: cacheErr } = await supabase.rpc('write_mapping_cache', {
        p_table: 'spanning_mappings',
        p_mapping_id: mapping.id,
        p_cached_data: cacheData,
        p_last_synced: new Date().toISOString(),
      });
      if (cacheErr) {
        console.error(`[Spanning scheduled] cache write failed for ${mapping.id}:`, cacheErr.message);
      }

      results.push({
        customer: customer?.name,
        totalUsers,
        assignedUsers,
        contactsUpdated
      });
      synced++;
    } catch (e) {
      console.error(`Failed to sync mapping ${mapping.id}:`, e.message);
      errors++;
      results.push({
        customer_id: mapping.customer_id,
        error: e.message
      });
    }
  }

  return {
    success: true,
    synced,
    errors,
    totalMappings: allMappings.length,
    results
  };
}
