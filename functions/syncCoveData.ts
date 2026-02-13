import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

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

// Login and get visa token using username + API token
async function coveLogin(username, apiToken) {
  const result = await coveApiCall('Login', {
    partner: username,
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

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, customer_id, partner_id } = await req.json();

    const username = Deno.env.get('COVE_API_USERNAME');
    const apiToken = Deno.env.get('COVE_API_TOKEN');

    if (!username || !apiToken) {
      return Response.json({ 
        success: false, 
        error: 'Cove API credentials not configured. Set COVE_API_USERNAME (login name) and COVE_API_TOKEN in Settings.' 
      });
    }

    // Test connection
    if (action === 'test_connection') {
      try {
        const visa = await coveLogin(username, apiToken);
        return Response.json({ success: true, message: 'Connected to Cove API successfully' });
      } catch (error) {
        return Response.json({ success: false, error: error.message });
      }
    }

    // List all partners/companies
    if (action === 'list_partners') {
      try {
        const visa = await coveLogin(username, apiToken);
        
        // Enumerate partners (customers in Cove)
        const result = await coveApiCall('EnumeratePartners', {
          parentPartnerId: null // Get all partners under your account
        }, visa);

        const partners = (result.result || []).map(p => ({
          id: p.Id?.toString() || p.PartnerId?.toString(),
          name: p.Name || p.CompanyName,
          level: p.Level,
          createdAt: p.CreationTime
        }));

        return Response.json({ success: true, partners });
      } catch (error) {
        return Response.json({ success: false, error: error.message });
      }
    }

    // Get cached data for a customer
    if (action === 'get_cached') {
      if (!customer_id) {
        return Response.json({ success: false, error: 'customer_id required' });
      }

      const mappings = await base44.asServiceRole.entities.CoveDataMapping.filter({ customer_id });
      const mapping = mappings[0];

      if (!mapping || !mapping.cached_data) {
        return Response.json({ success: false, error: 'No cached data available' });
      }

      try {
        const data = JSON.parse(mapping.cached_data);
        return Response.json({ 
          success: true, 
          data,
          last_synced: mapping.last_synced,
          fromCache: true
        });
      } catch (e) {
        return Response.json({ success: false, error: 'Invalid cached data' });
      }
    }

    // Sync customer data
    if (action === 'sync_customer') {
      if (!customer_id) {
        return Response.json({ success: false, error: 'customer_id required' });
      }

      // Get mapping
      const mappings = await base44.asServiceRole.entities.CoveDataMapping.filter({ customer_id });
      const mapping = mappings[0];

      if (!mapping) {
        return Response.json({ success: false, error: 'Customer not mapped to Cove' });
      }

      try {
        const visa = await coveLogin(username, apiToken);
        
        // Get devices for this partner
        const devicesResult = await coveApiCall('EnumerateAccountStatistics', {
          partnerId: parseInt(mapping.cove_partner_id)
        }, visa);

        const devices = devicesResult.result || [];
        
        // Calculate statistics
        let totalDevices = devices.length;
        let activeDevices = 0;
        let devicesWithErrors = 0;
        let devicesWithWarnings = 0;
        let totalStorageUsed = 0;
        let totalProtectedSize = 0;
        let lastBackupSuccess = 0;
        let lastBackupFailed = 0;

        const deviceDetails = devices.map(d => {
          // Parse device status
          const lastSessionStatus = d.LastSessionStatus || d.OsType;
          const isActive = d.AccountState === 'Active' || d.State === 1;
          
          if (isActive) activeDevices++;
          
          // Check for errors/warnings
          if (d.SessionErrors > 0 || lastSessionStatus === 'Failed') {
            devicesWithErrors++;
            lastBackupFailed++;
          } else if (d.SessionWarnings > 0) {
            devicesWithWarnings++;
            lastBackupSuccess++;
          } else if (lastSessionStatus === 'Completed') {
            lastBackupSuccess++;
          }

          // Storage
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
          devices: deviceDetails.slice(0, 50), // Store first 50 devices
          syncedAt: new Date().toISOString()
        };

        // Update mapping with cached data
        await base44.asServiceRole.entities.CoveDataMapping.update(mapping.id, {
          cached_data: JSON.stringify(cachedData),
          last_synced: new Date().toISOString()
        });

        return Response.json({ 
          success: true, 
          data: cachedData
        });
      } catch (error) {
        return Response.json({ success: false, error: error.message });
      }
    }

    // Get detailed device list
    if (action === 'list_devices') {
      if (!customer_id) {
        return Response.json({ success: false, error: 'customer_id required' });
      }

      const mappings = await base44.asServiceRole.entities.CoveDataMapping.filter({ customer_id });
      const mapping = mappings[0];

      if (!mapping) {
        return Response.json({ success: false, error: 'Customer not mapped to Cove' });
      }

      try {
        const visa = await coveLogin(username, apiToken);
        
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

        return Response.json({ success: true, devices });
      } catch (error) {
        return Response.json({ success: false, error: error.message });
      }
    }

    return Response.json({ success: false, error: 'Invalid action' });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});