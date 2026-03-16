import { getServiceSupabase } from '../lib/supabase.js';

const COVE_API_URL = 'https://api.backup.management/jsonapi';

// Make JSON-RPC call to Cove API
async function coveApiCall(method, params = {}, visa = null) {
  const body = {
    jsonrpc: '2.0',
    method,
    params,
    id: Date.now().toString()
  };

  if (visa) {
    body.visa = visa;
  }

  const response = await fetch(COVE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  const data = await response.json();

  if (data.error) {
    throw new Error(data.error.message || 'Cove API error');
  }

  return data.result || data;
}

// Login and get visa token + partner ID
// NOTE: The Cove Login response puts `visa` at the TOP LEVEL of the JSON-RPC
// response (data.visa), NOT inside data.result. The coveApiCall helper strips
// the top-level fields, so we make a direct fetch here instead.
async function coveLogin(partner, username, apiToken) {
  const body = {
    jsonrpc: '2.0',
    method: 'Login',
    params: { partner, username, password: apiToken },
    id: Date.now().toString(),
  };

  const response = await fetch(COVE_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (data.error) {
    throw new Error(data.error.message || 'Cove login failed');
  }

  const visa = data.visa;
  const partnerId = data.result?.result?.PartnerId ?? null;

  if (!visa) {
    throw new Error('Login succeeded but no visa token returned');
  }

  return { visa, partnerId };
}

// Format bytes to human readable
function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Cove API column codes (from N-able documentation)
// See: https://documentation.n-able.com/covedataprotection/USERGUIDE/documentation/Content/service-management/json-api/API-column-codes.htm
// NOTE: Session columns (F-prefix) MUST be scoped to a data source.
// D9 = "Total" (aggregate across all data sources), D1 = Files & Folders, D2 = System State.
// Format: D{sourceId}F{columnId} e.g. D9F00 = Total Last Session Status
const COVE_COLUMNS = [
  'I18',    // Computer Name
  'I32',    // OS Type (1=workstation, 2=server, 0=undefined)
  'I14',    // Used Storage (bytes)
  'I6',     // Timestamp (last activity)
  'D9F00',  // Total — Last Session Status
  'D9F15',  // Total — Last Session Timestamp
  'D9F03',  // Total — Last Session Selected Size (bytes)
  'D9F06',  // Total — Last Session Errors Count
  'D1F00',  // Files & Folders — Last Session Status (fallback)
  'D1F15',  // Files & Folders — Last Session Timestamp (fallback)
];

const SESSION_STATUS_MAP = {
  1: 'InProcess', 2: 'Failed', 3: 'NoData', 5: 'Completed',
  6: 'Interrupted', 7: 'NotStarted', 8: 'CompletedWithErrors',
  9: 'InProgressWithFaults', 10: 'OverQuota', 11: 'NoSelection', 12: 'Restarted'
};

const OS_TYPE_MAP = { 0: 'Unknown', 1: 'Workstation', 2: 'Server' };

// Parse Cove API Settings array into a flat object
// Settings: [{"I18":"ComputerName"}, {"I14":"12345"}] → { I18: "ComputerName", I14: "12345" }
function parseSettings(settings) {
  if (!Array.isArray(settings)) return {};
  const flat = {};
  for (const entry of settings) {
    for (const [k, v] of Object.entries(entry)) {
      flat[k] = v;
    }
  }
  return flat;
}

export async function syncCoveData(body, user) {
  const supabase = getServiceSupabase();
  const { action, customer_id } = body;

  const partner = process.env.COVE_API_PARTNER;
  const username = process.env.COVE_API_USERNAME;
  const apiToken = process.env.COVE_API_TOKEN;

  if (!partner || !username || !apiToken) {
    return {
      success: false,
      error: 'Cove API credentials not configured. Set COVE_API_PARTNER (company name), COVE_API_USERNAME (login name/email), and COVE_API_TOKEN in Settings.'
    };
  }

  // Test connection
  if (action === 'test_connection') {
    try {
      const { visa, partnerId } = await coveLogin(partner, username, apiToken);
      return { success: true, message: `Connected to Cove API successfully (Partner ID: ${partnerId})` };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // List all partners/companies
  if (action === 'list_partners') {
    try {
      const { visa, partnerId } = await coveLogin(partner, username, apiToken);

      // EnumeratePartners returns IDs but Name is often null.
      // We must call GetPartnerInfoById per partner to get actual names.
      const enumResult = await coveApiCall('EnumeratePartners', {
        parentPartnerId: partnerId
      }, visa);

      const partnerList = enumResult.result || [];

      // Fetch full info for each partner (Name comes from GetPartnerInfoById)
      const partners = await Promise.all(
        partnerList.map(async (p) => {
          const id = p.Id;
          let name = p.Name;

          if (!name) {
            try {
              const infoResult = await coveApiCall('GetPartnerInfoById', {
                partnerId: id
              }, visa);
              name = infoResult.result?.Name || `Partner ${id}`;
            } catch {
              name = `Partner ${id}`;
            }
          }

          return {
            id: id?.toString(),
            name,
            level: p.Level,
            createdAt: p.CreationTime
          };
        })
      );

      return { success: true, partners };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Get cached data for a customer
  if (action === 'get_cached') {
    if (!customer_id) {
      return { success: false, error: 'customer_id required' };
    }

    const { data: mappings } = await supabase
      .from('cove_data_mappings')
      .select('*')
      .eq('customer_id', customer_id);

    const mapping = mappings?.[0];

    if (!mapping || !mapping.cached_data) {
      return { success: false, error: 'No cached data available' };
    }

    return {
      success: true,
      data: mapping.cached_data,
      last_synced: mapping.last_synced,
      fromCache: true
    };
  }

  // Sync customer data
  if (action === 'sync_customer') {
    if (!customer_id) {
      return { success: false, error: 'customer_id required' };
    }

    const { data: mappings } = await supabase
      .from('cove_data_mappings')
      .select('*')
      .eq('customer_id', customer_id);

    const mapping = mappings?.[0];

    if (!mapping) {
      return { success: false, error: 'Customer not mapped to Cove' };
    }

    try {
      const { visa } = await coveLogin(partner, username, apiToken);

      console.log(`[Cove] Fetching devices for partner ${mapping.cove_partner_id} (customer: ${customer_id})`);

      const devicesResult = await coveApiCall('EnumerateAccountStatistics', {
        query: {
          PartnerId: parseInt(mapping.cove_partner_id),
          SelectionMode: 'Merged',
          Columns: COVE_COLUMNS,
          RecordsCount: 250
        }
      }, visa);

      // coveApiCall returns data.result — handle both array and object formats
      const devices = Array.isArray(devicesResult)
        ? devicesResult
        : (devicesResult?.result || []);

      console.log(`[Cove] Got ${devices.length} devices for partner ${mapping.cove_partner_id}`);
      if (devices.length > 0) {
        console.log(`[Cove] Sample device keys:`, Object.keys(devices[0]));
      }

      let totalDevices = devices.length;
      let activeDevices = 0;
      let devicesWithErrors = 0;
      let devicesWithWarnings = 0;
      let totalStorageUsed = 0;
      let totalProtectedSize = 0;
      let lastBackupSuccess = 0;
      let lastBackupFailed = 0;

      const deviceDetails = devices.map(d => {
        // Parse Settings array if present (Cove returns column-coded data)
        const s = parseSettings(d.Settings);

        // Extract fields — try flat fields first, then Settings column codes
        // Session columns use data-source prefix: D9 = Total, D1 = Files & Folders (fallback)
        const computerName = d.AccountName || d.Name || d.ComputerName || s['I18'] || 'Unknown';
        const osTypeRaw = d.OsType || s['I32'];
        const osType = OS_TYPE_MAP[osTypeRaw] || osTypeRaw || 'Unknown';
        const usedStorage = parseInt(d.UsedStorage || s['I14'] || 0, 10);
        const protectedSize = parseInt(d.SelectedSize || s['D9F03'] || 0, 10);
        const lastBackupTs = d.LastSessionTimestamp || s['D9F15'] || s['D1F15'] || null;
        const statusCode = d.LastSessionStatus || s['D9F00'] || s['D1F00'];
        const lastSessionStatus = SESSION_STATUS_MAP[statusCode] || statusCode || 'Unknown';
        const errors = parseInt(d.SessionErrors || s['D9F06'] || 0, 10);

        // Determine active state — Cove devices without "Flags" containing " integrityCheckAccountMissedBackupAlertSent" are generally active
        const isActive = d.AccountState === 'Active' || d.State === 1 ||
          !(d.Flags || []).includes('integrityCheckAccountMissedBackupAlertSent');

        if (isActive) activeDevices++;

        if (errors > 0 || lastSessionStatus === 'Failed' || lastSessionStatus === 'CompletedWithErrors') {
          devicesWithErrors++;
          lastBackupFailed++;
        } else if (lastSessionStatus === 'Completed') {
          lastBackupSuccess++;
        } else if (lastSessionStatus === 'InProcess' || lastSessionStatus === 'InProgressWithFaults') {
          // In progress — don't count as success or failure
        } else if (lastSessionStatus !== 'Unknown' && lastSessionStatus !== 'NoData' && lastSessionStatus !== 'NotStarted') {
          devicesWithWarnings++;
        }

        totalStorageUsed += usedStorage;
        totalProtectedSize += protectedSize;

        return {
          id: d.AccountId || d.Id,
          name: computerName,
          osType,
          state: isActive ? 'active' : 'inactive',
          lastBackup: lastBackupTs,
          lastBackupStatus: lastSessionStatus,
          usedStorage: formatBytes(usedStorage),
          protectedSize: formatBytes(protectedSize),
          errors,
          warnings: d.SessionWarnings || 0
        };
      });

      const workstationCount = deviceDetails.filter(d => d.osType === 'Workstation').length;
      const serverCount = deviceDetails.filter(d => d.osType === 'Server').length;

      const cachedData = {
        totalDevices,
        workstation_count: workstationCount,
        server_count: serverCount,
        activeDevices,
        inactiveDevices: totalDevices - activeDevices,
        devicesWithErrors,
        devicesWithWarnings,
        healthyDevices: Math.max(0, totalDevices - devicesWithErrors - devicesWithWarnings),
        totalStorageUsed: formatBytes(totalStorageUsed),
        totalStorageUsedBytes: totalStorageUsed,
        totalProtectedSize: formatBytes(totalProtectedSize),
        totalProtectedSizeBytes: totalProtectedSize,
        lastBackupSuccess,
        lastBackupFailed,
        successRate: totalDevices > 0 ? Math.round((lastBackupSuccess / totalDevices) * 100) : 0,
        devices: deviceDetails.slice(0, 50),
        syncedAt: new Date().toISOString()
      };

      // Update mapping with cached data
      await supabase
        .from('cove_data_mappings')
        .update({
          cached_data: cachedData,
          last_synced: new Date().toISOString()
        })
        .eq('id', mapping.id);

      return {
        success: true,
        data: cachedData
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Get detailed device list
  if (action === 'list_devices') {
    if (!customer_id) {
      return { success: false, error: 'customer_id required' };
    }

    const { data: mappings } = await supabase
      .from('cove_data_mappings')
      .select('*')
      .eq('customer_id', customer_id);

    const mapping = mappings?.[0];

    if (!mapping) {
      return { success: false, error: 'Customer not mapped to Cove' };
    }

    try {
      const { visa } = await coveLogin(partner, username, apiToken);

      const devicesResult = await coveApiCall('EnumerateAccountStatistics', {
        query: {
          PartnerId: parseInt(mapping.cove_partner_id),
          SelectionMode: 'Merged',
          Columns: COVE_COLUMNS,
          RecordsCount: 250
        }
      }, visa);

      const rawDevices = Array.isArray(devicesResult)
        ? devicesResult
        : (devicesResult?.result || []);

      const devices = rawDevices.map(d => {
        const s = parseSettings(d.Settings);
        // Session columns: D9 = Total (aggregate), D1 = Files & Folders (fallback)
        const statusCode = d.LastSessionStatus || s['D9F00'] || s['D1F00'];
        return {
          id: d.AccountId || d.Id,
          name: d.AccountName || d.Name || d.ComputerName || s['I18'] || 'Unknown',
          osType: OS_TYPE_MAP[d.OsType || s['I32']] || d.OsType || s['I32'] || 'Unknown',
          state: d.AccountState || (d.State === 1 ? 'Active' : 'Inactive'),
          lastBackup: d.LastSessionTimestamp || s['D9F15'] || s['D1F15'],
          lastBackupStatus: SESSION_STATUS_MAP[statusCode] || statusCode || 'Unknown',
          usedStorage: formatBytes(parseInt(d.UsedStorage || s['I14'] || 0, 10)),
          protectedSize: formatBytes(parseInt(d.SelectedSize || s['D9F03'] || 0, 10)),
          errors: parseInt(d.SessionErrors || s['D9F06'] || 0, 10),
          warnings: d.SessionWarnings || 0
        };
      });

      return { success: true, devices };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  return { success: false, error: 'Invalid action' };
}
