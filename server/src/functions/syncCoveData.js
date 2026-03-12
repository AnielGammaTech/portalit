import { getServiceSupabase } from '../lib/supabase.js';

const COVE_API_URL = 'https://api.backup.management/jsonapi';

// Make JSON-RPC call to Cove API
async function coveApiCall(method, params = {}, visa = null) {
  const body = {
    jsonrpc: '4.0',
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

// Login and get visa token
async function coveLogin(partner, username, apiToken) {
  const result = await coveApiCall('Login', {
    partner: partner,
    username: username,
    password: apiToken
  });

  return result.visa;
}

// Format bytes to human readable
function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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
      await coveLogin(partner, username, apiToken);
      return { success: true, message: 'Connected to Cove API successfully' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // List all partners/companies
  if (action === 'list_partners') {
    try {
      const visa = await coveLogin(partner, username, apiToken);

      const result = await coveApiCall('EnumeratePartners', {
        parentPartnerId: null
      }, visa);

      const partners = (result.result || []).map(p => ({
        id: p.Id?.toString() || p.PartnerId?.toString(),
        name: p.Name || p.CompanyName,
        level: p.Level,
        createdAt: p.CreationTime
      }));

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
      const visa = await coveLogin(partner, username, apiToken);

      const devicesResult = await coveApiCall('EnumerateAccountStatistics', {
        partnerId: parseInt(mapping.cove_partner_id)
      }, visa);

      const devices = devicesResult.result || [];

      let totalDevices = devices.length;
      let activeDevices = 0;
      let devicesWithErrors = 0;
      let devicesWithWarnings = 0;
      let totalStorageUsed = 0;
      let totalProtectedSize = 0;
      let lastBackupSuccess = 0;
      let lastBackupFailed = 0;

      const deviceDetails = devices.map(d => {
        const lastSessionStatus = d.LastSessionStatus || d.OsType;
        const isActive = d.AccountState === 'Active' || d.State === 1;

        if (isActive) activeDevices++;

        if (d.SessionErrors > 0 || lastSessionStatus === 'Failed') {
          devicesWithErrors++;
          lastBackupFailed++;
        } else if (d.SessionWarnings > 0) {
          devicesWithWarnings++;
          lastBackupSuccess++;
        } else if (lastSessionStatus === 'Completed') {
          lastBackupSuccess++;
        }

        const usedStorage = d.UsedStorage || d.SelectedSize || 0;
        const protectedSize = d.SelectedSize || d.DataSourcesSelectedSize || 0;
        totalStorageUsed += usedStorage;
        totalProtectedSize += protectedSize;

        return {
          id: d.AccountId || d.Id,
          name: d.AccountName || d.Name || d.ComputerName,
          osType: d.OsType,
          state: isActive ? 'active' : 'inactive',
          lastBackup: d.LastSessionTimestamp,
          lastBackupStatus: lastSessionStatus,
          usedStorage: formatBytes(usedStorage),
          protectedSize: formatBytes(protectedSize),
          errors: d.SessionErrors || 0,
          warnings: d.SessionWarnings || 0
        };
      });

      const cachedData = {
        totalDevices,
        activeDevices,
        inactiveDevices: totalDevices - activeDevices,
        devicesWithErrors,
        devicesWithWarnings,
        healthyDevices: totalDevices - devicesWithErrors - devicesWithWarnings,
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
      const visa = await coveLogin(partner, username, apiToken);

      const devicesResult = await coveApiCall('EnumerateAccountStatistics', {
        partnerId: parseInt(mapping.cove_partner_id)
      }, visa);

      const devices = (devicesResult.result || []).map(d => ({
        id: d.AccountId || d.Id,
        name: d.AccountName || d.Name || d.ComputerName,
        osType: d.OsType,
        state: d.AccountState || (d.State === 1 ? 'Active' : 'Inactive'),
        lastBackup: d.LastSessionTimestamp,
        lastBackupStatus: d.LastSessionStatus,
        usedStorage: formatBytes(d.UsedStorage || 0),
        protectedSize: formatBytes(d.SelectedSize || 0),
        errors: d.SessionErrors || 0,
        warnings: d.SessionWarnings || 0
      }));

      return { success: true, devices };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  return { success: false, error: 'Invalid action' };
}
