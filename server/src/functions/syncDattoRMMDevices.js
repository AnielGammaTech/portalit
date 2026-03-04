import { getServiceSupabase } from '../lib/supabase.js';

const DATTO_API_KEY = process.env.DATTO_RMM_API_KEY;
const DATTO_API_SECRET = process.env.DATTO_RMM_API_SECRET;
const DATTO_API_URL = process.env.DATTO_RMM_API_URL;

async function getDattoAccessToken() {
  // Remove trailing slash from URL if present
  const baseUrl = DATTO_API_URL.replace(/\/$/, '');
  // Datto RMM OAuth2 token endpoint
  const authUrl = `${baseUrl}/auth/oauth/token`;

  // Create URL-encoded body with password grant type
  // API Key = username, API Secret = password
  const params = new URLSearchParams();
  params.append('grant_type', 'password');
  params.append('username', DATTO_API_KEY);
  params.append('password', DATTO_API_SECRET);

  // Basic auth with public-client:public as per Datto docs
  const basicAuth = Buffer.from('public-client:public').toString('base64');

  const response = await fetch(authUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params.toString()
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get Datto access token: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.access_token;
}

async function dattoApiCall(accessToken, endpoint) {
  const baseUrl = DATTO_API_URL.replace(/\/$/, '');
  const response = await fetch(`${baseUrl}/api/v2${endpoint}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Datto API error: ${response.status} - ${error}`);
  }

  return response.json();
}

// Helper to check if device data has changed
function hasDeviceChanged(existing, newData) {
  if (!existing) return true;
  const fieldsToCheck = ['hostname', 'os', 'ip_address', 'status', 'last_seen'];
  return fieldsToCheck.some(field => existing[field] !== newData[field]);
}

function mapDeviceType(category) {
  if (!category) return 'other';
  const lower = category.toLowerCase();
  if (lower.includes('server')) return 'server';
  if (lower.includes('laptop')) return 'laptop';
  if (lower.includes('desktop') || lower.includes('workstation')) return 'desktop';
  if (lower.includes('network') || lower.includes('router') || lower.includes('switch')) return 'network';
  if (lower.includes('printer')) return 'printer';
  return 'other';
}

export async function syncDattoRMMDevices(body, user) {
  const supabase = getServiceSupabase();

  const { action, customer_id, datto_site_id } = body;

  if (!DATTO_API_KEY || !DATTO_API_SECRET || !DATTO_API_URL) {
    const err = new Error('Datto RMM credentials not configured');
    err.statusCode = 400;
    throw err;
  }

  const accessToken = await getDattoAccessToken();

  // Action: List all Datto sites (for mapping) - with pagination
  if (action === 'list_sites') {
    let allSites = [];
    let page = 0; // Datto uses 0-based page indexing
    const pageSize = 250;

    while (true) {
      const sitesData = await dattoApiCall(accessToken, `/account/sites?max=${pageSize}&page=${page}`);
      const pageSites = sitesData.sites || [];

      console.log(`Page ${page}: found ${pageSites.length} sites`);

      if (!pageSites || pageSites.length === 0) break;
      allSites = allSites.concat(pageSites);

      if (pageSites.length < pageSize) break;
      page++;
      if (page > 20) break; // Safety limit
    }

    console.log(`Total sites found: ${allSites.length}`);

    return {
      success: true,
      sites: allSites.map(site => ({
        id: site.uid, // Use uid as the primary identifier for API calls
        uid: site.uid,
        name: site.name,
        description: site.description,
        deviceCount: site.devicesStatus?.numberOfDevices || 0
      }))
    };
  }

  // Action: Auto-map sites to customers by name matching
  if (action === 'automap') {
    const sitesData = await dattoApiCall(accessToken, '/account/sites');
    const sites = sitesData.sites || [];

    const { data: customersData } = await supabase.from('customers').select('*');
    const customers = customersData || [];

    const { data: existingMappingsData } = await supabase.from('datto_site_mappings').select('*');
    const existingMappings = existingMappingsData || [];

    const existingSiteIds = new Set(existingMappings.map(m => m.datto_site_id));
    let mappedCount = 0;
    const mappedPairs = [];

    for (const site of sites) {
      const siteId = String(site.uid); // Always use uid for Datto API calls
      if (existingSiteIds.has(siteId)) continue;

      // Try to find a matching customer by name (case-insensitive, partial match)
      const siteName = (site.name || '').toLowerCase().trim();
      const matchedCustomer = customers.find(c => {
        const customerName = (c.name || '').toLowerCase().trim();
        return customerName === siteName ||
               customerName.includes(siteName) ||
               siteName.includes(customerName);
      });

      if (matchedCustomer) {
        const { data: created, error } = await supabase.from('datto_site_mappings').insert({
          customer_id: matchedCustomer.id,
          datto_site_id: siteId,
          datto_site_name: site.name
        }).select().single();
        if (error) throw new Error(error.message);

        mappedCount++;
        mappedPairs.push({ site: site.name, customer: matchedCustomer.name });
      }
    }

    return {
      success: true,
      mappedCount,
      mappedPairs,
      totalSites: sites.length
    };
  }

  // Action: Search sites by name
  if (action === 'search_sites') {
    const { search_term } = body;
    let allSites = [];
    let page = 0;
    const pageSize = 250;

    while (true) {
      const sitesData = await dattoApiCall(accessToken, `/account/sites?max=${pageSize}&page=${page}`);
      const pageSites = sitesData.sites || [];

      if (!pageSites || pageSites.length === 0) break;
      allSites = allSites.concat(pageSites);

      if (pageSites.length < pageSize) break;
      page++;
      if (page > 20) break;
    }

    const searchLower = (search_term || '').toLowerCase();
    const matchingSites = allSites.filter(site =>
      (site.name || '').toLowerCase().includes(searchLower)
    );

    return {
      success: true,
      totalSites: allSites.length,
      matchingSites: matchingSites.map(site => ({
        id: site.uid,
        uid: site.uid,
        name: site.name,
        description: site.description,
        deviceCount: site.devicesStatus?.numberOfDevices || 0
      }))
    };
  }

  // Action: Test connection
  if (action === 'test_connection') {
    const accountData = await dattoApiCall(accessToken, '/account');
    return {
      success: true,
      account: {
        name: accountData.name,
        uid: accountData.uid
      }
    };
  }

  // Action: Debug single device to see all fields
  if (action === 'debug_device') {
    const { device_uid } = body;
    if (!device_uid) {
      const err = new Error('device_uid required');
      err.statusCode = 400;
      throw err;
    }
    const deviceData = await dattoApiCall(accessToken, `/device/${device_uid}`);
    return { success: true, device: deviceData };
  }

  // Action: Get cached device data for a customer (fast, no API call)
  if (action === 'get_cached') {
    if (!customer_id) {
      const err = new Error('customer_id is required');
      err.statusCode = 400;
      throw err;
    }

    const { data: mappingsData } = await supabase.from('datto_site_mappings').select('*').eq('customer_id', customer_id);
    const mappings = mappingsData || [];

    if (mappings.length === 0) {
      return { success: true, cached: null, message: 'No mapping found' };
    }

    const mapping = mappings[0];
    if (!mapping.cached_data) {
      return { success: true, cached: null, last_synced: null };
    }

    return {
      success: true,
      cached: JSON.parse(mapping.cached_data),
      last_synced: mapping.last_synced
    };
  }

  // Action: Sync devices for a specific customer
  if (action === 'sync_devices') {
    if (!customer_id) {
      const err = new Error('customer_id is required');
      err.statusCode = 400;
      throw err;
    }

    // Get the Datto site mapping for this customer
    const { data: mappingsData } = await supabase.from('datto_site_mappings').select('*').eq('customer_id', customer_id);
    const mappings = mappingsData || [];

    if (mappings.length === 0) {
      const err = new Error('No Datto site mapped to this customer');
      err.statusCode = 400;
      throw err;
    }

    let totalSynced = 0;
    let onlineCount = 0;
    let offlineCount = 0;
    let serverCount = 0;
    let workstationCount = 0;

    for (const mapping of mappings) {
      const siteUid = mapping.datto_site_id;
      console.log(`Syncing devices for site: ${siteUid} (${mapping.datto_site_name})`);

      // Datto RMM API: /site/{siteUid}/devices - with pagination
      // Note: Datto uses 0-based page indexing
      let allDevices = [];
      let page = 0;
      const pageSize = 250;

      while (true) {
        const endpoint = `/site/${siteUid}/devices?max=${pageSize}&page=${page}`;
        console.log(`Fetching: ${endpoint}`);
        const devicesData = await dattoApiCall(accessToken, endpoint);
        const pageDevices = devicesData.devices || [];
        console.log(`Page ${page}: found ${pageDevices.length} devices`);

        if (!pageDevices || pageDevices.length === 0) break;
        allDevices = allDevices.concat(pageDevices);

        if (pageDevices.length < pageSize) break;
        page++;
        if (page > 50) break; // Safety limit
      }

      console.log(`Total devices found for site ${siteUid}: ${allDevices.length}`);
      const devices = allDevices;

      // Get existing devices for this customer
      const { data: existingDevicesData } = await supabase
        .from('devices')
        .select('*')
        .eq('customer_id', customer_id)
        .eq('datto_site_id', siteUid);
      const existingDevices = existingDevicesData || [];

      const existingByDattoId = {};
      existingDevices.forEach(d => { existingByDattoId[d.datto_id] = d; });

      const dattoDeviceIds = new Set();

      for (const device of devices) {
        const deviceUid = device.uid || device.id;
        const dattoId = String(deviceUid);
        dattoDeviceIds.add(dattoId);
        const existing = existingByDattoId[dattoId];

        // Convert lastSeen timestamp to ISO string if it's a number
        let lastSeenStr = null;
        const lastSeen = device.lastSeen;
        if (lastSeen) {
          lastSeenStr = typeof lastSeen === 'number' ? new Date(lastSeen).toISOString() : lastSeen;
        }

        const deviceType = mapDeviceType(device.deviceType?.category);
        const isOnline = device.online;

        // Track stats for cache
        if (isOnline) onlineCount++;
        else offlineCount++;
        if (deviceType === 'server') serverCount++;
        else workstationCount++;

        // Build device data from list endpoint
        const deviceData = {
          customer_id,
          datto_id: dattoId,
          datto_site_id: siteUid,
          hostname: device.hostname || device.name || 'Unknown',
          description: device.description || '',
          device_type: deviceType,
          os: device.operatingSystem || '',
          ip_address: device.intIpAddress || device.extIpAddress || '',
          last_seen: lastSeenStr,
          last_user: device.lastLoggedInUser || '',
          status: isOnline ? 'online' : 'offline'
        };

        // Skip if no changes
        if (existing && !hasDeviceChanged(existing, deviceData)) {
          continue;
        }

        if (existing) {
          await supabase.from('devices').update(deviceData).eq('id', existing.id);
        } else {
          const { data: created, error } = await supabase.from('devices').insert(deviceData).select().single();
          if (error) throw new Error(error.message);
        }
        totalSynced++;
      }

      // Delete devices no longer in Datto
      for (const existing of existingDevices) {
        if (!dattoDeviceIds.has(existing.datto_id)) {
          await supabase.from('devices').delete().eq('id', existing.id);
          totalSynced++;
        }
      }

      // Update mapping with cached data and last_synced timestamp
      const cachedData = {
        total_devices: allDevices.length,
        online_count: onlineCount,
        offline_count: offlineCount,
        server_count: serverCount,
        workstation_count: workstationCount
      };

      await supabase.from('datto_site_mappings').update({
        last_synced: new Date().toISOString(),
        cached_data: JSON.stringify(cachedData)
      }).eq('id', mapping.id);
    }

    return {
      success: true,
      recordsSynced: totalSynced,
      stats: {
        total_devices: onlineCount + offlineCount,
        online_count: onlineCount,
        offline_count: offlineCount,
        server_count: serverCount,
        workstation_count: workstationCount
      }
    };
  }

  // Action: Full sync all mapped customers
  if (action === 'sync_all') {
    const { data: allMappingsData } = await supabase.from('datto_site_mappings').select('*');
    const allMappings = allMappingsData || [];

    if (!allMappings || allMappings.length === 0) {
      return { success: true, recordsSynced: 0, message: 'No site mappings found' };
    }

    let totalSynced = 0;
    const errors = [];

    for (const mapping of allMappings) {
      try {
        const siteUid = mapping.datto_site_id;

        // Datto RMM API: /site/{siteUid}/devices - with pagination
        let allDevices = [];
        let page = 1;
        const pageSize = 250;

        while (true) {
          const devicesData = await dattoApiCall(accessToken, `/site/${siteUid}/devices?max=${pageSize}&page=${page}`);
          const pageDevices = devicesData.devices || [];

          if (!pageDevices || pageDevices.length === 0) break;
          allDevices = allDevices.concat(pageDevices);

          if (pageDevices.length < pageSize) break;
          page++;
          if (page > 50) break; // Safety limit
        }

        const devices = allDevices;

        const { data: existingDevicesData } = await supabase
          .from('devices')
          .select('*')
          .eq('customer_id', mapping.customer_id)
          .eq('datto_site_id', siteUid);
        const existingDevices = existingDevicesData || [];

        const existingByDattoId = {};
        existingDevices.forEach(d => { existingByDattoId[d.datto_id] = d; });

        const dattoDeviceIds = new Set();

        for (const device of devices) {
          const deviceUid = device.uid || device.id;
          const dattoId = String(deviceUid);
          dattoDeviceIds.add(dattoId);
          const existing = existingByDattoId[dattoId];

          // Convert lastSeen timestamp to ISO string if it's a number
          let lastSeenStr = null;
          const lastSeen = device.lastSeen;
          if (lastSeen) {
            lastSeenStr = typeof lastSeen === 'number' ? new Date(lastSeen).toISOString() : lastSeen;
          }

          // Build device data from list endpoint
          const deviceData = {
            customer_id: mapping.customer_id,
            datto_id: dattoId,
            datto_site_id: siteUid,
            hostname: device.hostname || device.name || 'Unknown',
            description: device.description || '',
            device_type: mapDeviceType(device.deviceType?.category),
            os: device.operatingSystem || '',
            ip_address: device.intIpAddress || device.extIpAddress || '',
            last_seen: lastSeenStr,
            last_user: device.lastLoggedInUser || '',
            status: device.online ? 'online' : 'offline'
          };

          // Skip if no changes
          if (existing && !hasDeviceChanged(existing, deviceData)) {
            continue;
          }

          if (existing) {
            await supabase.from('devices').update(deviceData).eq('id', existing.id);
          } else {
            const { data: created, error } = await supabase.from('devices').insert(deviceData).select().single();
            if (error) throw new Error(error.message);
          }
          totalSynced++;
        }

        // Delete devices no longer in Datto
        for (const existing of existingDevices) {
          if (!dattoDeviceIds.has(existing.datto_id)) {
            await supabase.from('devices').delete().eq('id', existing.id);
            totalSynced++;
          }
        }
      } catch (err) {
        console.error(`Error syncing site ${mapping.datto_site_id}:`, err.message);
        errors.push({ site: mapping.datto_site_name, error: err.message });
      }
    }

    return {
      success: true,
      recordsSynced: totalSynced,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  const err = new Error('Invalid action');
  err.statusCode = 400;
  throw err;
}
