import { getServiceSupabase } from '../lib/supabase.js';

const DATTO_API_KEY = process.env.DATTO_RMM_API_KEY;
const DATTO_API_SECRET = process.env.DATTO_RMM_API_SECRET;
const DATTO_API_URL = process.env.DATTO_RMM_API_URL;

async function getDattoAccessToken() {
  const baseUrl = DATTO_API_URL.replace(/\/$/, '');
  const authUrl = `${baseUrl}/auth/oauth/token`;

  const params = new URLSearchParams();
  params.append('grant_type', 'password');
  params.append('username', DATTO_API_KEY);
  params.append('password', DATTO_API_SECRET);

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

function hasDeviceChanged(existing, newData) {
  if (!existing) return true;
  const fieldsToCheck = ['hostname', 'operating_system', 'ip_address', 'status', 'last_seen', 'online_status'];
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

export async function scheduledDattoSync(_body, _user) {
  const supabase = getServiceSupabase();

  if (!DATTO_API_KEY || !DATTO_API_SECRET || !DATTO_API_URL) {
    return { success: false, error: 'Datto RMM credentials not configured' };
  }

  const accessToken = await getDattoAccessToken();

  const { data: allMappingsData } = await supabase.from('datto_site_mappings').select('*');
  const allMappings = allMappingsData || [];

  if (allMappings.length === 0) {
    return { success: true, message: 'No Datto site mappings found', synced: 0 };
  }

  let totalSynced = 0;
  let errorCount = 0;
  const results = [];

  for (const mapping of allMappings) {
    try {
      const siteUid = mapping.datto_site_id;

      // Fetch ALL devices for this site — Datto uses 0-based page indexing
      let allDevices = [];
      let page = 0;
      const pageSize = 250;

      while (true) {
        const devicesData = await dattoApiCall(accessToken, `/site/${siteUid}/devices?max=${pageSize}&page=${page}`);
        const pageDevices = devicesData.devices || [];

        if (!pageDevices || pageDevices.length === 0) break;
        allDevices = allDevices.concat(pageDevices);

        if (pageDevices.length < pageSize) break;
        page++;
        if (page > 50) break;
      }

      // Get existing devices from DB
      const { data: existingDevicesData } = await supabase
        .from('devices')
        .select('*')
        .eq('customer_id', mapping.customer_id)
        .eq('datto_site_id', siteUid);
      const existingDevices = existingDevicesData || [];

      // Build lookup by external_id (correct DB column)
      const existingByExternalId = {};
      existingDevices.forEach(d => { existingByExternalId[d.external_id] = d; });

      const dattoDeviceIds = new Set();
      let siteSynced = 0;
      let onlineCount = 0;
      let offlineCount = 0;
      let serverCount = 0;
      let workstationCount = 0;

      for (const device of allDevices) {
        const deviceUid = device.uid || device.id;
        const dattoId = String(deviceUid);
        dattoDeviceIds.add(dattoId);
        const existing = existingByExternalId[dattoId];

        let lastSeenStr = null;
        const lastSeen = device.lastSeen;
        if (lastSeen) {
          lastSeenStr = typeof lastSeen === 'number' ? new Date(lastSeen).toISOString() : lastSeen;
        }

        const deviceType = mapDeviceType(device.deviceType?.category);
        const isOnline = device.online;

        // Track stats for cached_data
        if (isOnline) onlineCount++;
        else offlineCount++;
        if (deviceType === 'server') serverCount++;
        else workstationCount++;

        // Build device data matching DB schema columns exactly
        const deviceData = {
          customer_id: mapping.customer_id,
          external_id: dattoId,
          source: 'datto_rmm',
          name: device.hostname || device.name || 'Unknown',
          datto_site_id: siteUid,
          hostname: device.hostname || device.name || 'Unknown',
          notes: device.description || '',
          device_type: deviceType,
          operating_system: device.operatingSystem || '',
          ip_address: device.intIpAddress || device.extIpAddress || '',
          last_seen: lastSeenStr,
          last_user: device.lastLoggedInUser || '',
          status: isOnline ? 'online' : 'offline',
          online_status: isOnline ? 'online' : 'offline'
        };

        if (existing && !hasDeviceChanged(existing, deviceData)) {
          continue;
        }

        if (existing) {
          await supabase.from('devices').update(deviceData).eq('id', existing.id);
        } else {
          const { error } = await supabase.from('devices').insert(deviceData).select().single();
          if (error) {
            console.error(`[DattoSync] Failed to insert device ${dattoId}: ${error.message}`);
            throw new Error(error.message);
          }
        }
        siteSynced++;
      }

      // Safety: only delete stale devices if the API actually returned data
      // Prevents wiping devices if the API had a temporary error/empty response
      if (allDevices.length > 0) {
        for (const existing of existingDevices) {
          if (!dattoDeviceIds.has(existing.external_id)) {
            await supabase.from('devices').delete().eq('id', existing.id);
            siteSynced++;
          }
        }
      }

      // Write cached_data to mapping for fast frontend reads
      const cachedData = {
        total_devices: allDevices.length,
        online_count: onlineCount,
        offline_count: offlineCount,
        server_count: serverCount,
        workstation_count: workstationCount
      };

      await supabase.from('datto_site_mappings').update({
        last_synced: new Date().toISOString(),
        cached_data: cachedData
      }).eq('id', mapping.id);

      totalSynced += siteSynced;
      results.push({
        site: mapping.datto_site_name,
        customer_id: mapping.customer_id,
        devicesInDatto: allDevices.length,
        synced: siteSynced
      });
    } catch (e) {
      console.error(`[DattoSync] Failed to sync site ${mapping.datto_site_id}:`, e.message);
      errorCount++;
      results.push({
        site: mapping.datto_site_name,
        customer_id: mapping.customer_id,
        error: e.message
      });
    }
  }

  return {
    success: true,
    totalSynced,
    errors: errorCount,
    totalMappings: allMappings.length,
    results
  };
}
