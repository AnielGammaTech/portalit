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

export async function scheduledDattoSync(body, user) {
  const supabase = getServiceSupabase();

  if (!DATTO_API_KEY || !DATTO_API_SECRET || !DATTO_API_URL) {
    return { success: false, error: 'Datto RMM credentials not configured' };
  }

  const accessToken = await getDattoAccessToken();

  // Get all Datto site mappings
  const { data: allMappingsData } = await supabase.from('datto_site_mappings').select('*');
  const allMappings = allMappingsData || [];

  if (!allMappings || allMappings.length === 0) {
    return { success: true, message: 'No Datto site mappings found', synced: 0 };
  }

  let totalSynced = 0;
  let errors = 0;
  const results = [];

  for (const mapping of allMappings) {
    try {
      const siteUid = mapping.datto_site_id;

      // Get ALL devices for this site with pagination
      let allDevices = [];
      let page = 1;
      const pageSize = 250;

      while (true) {
        const devicesData = await dattoApiCall(accessToken, `/site/${siteUid}/devices?max=${pageSize}&page=${page}`);
        const devices = devicesData.devices || [];

        if (!devices || devices.length === 0) break;
        allDevices = allDevices.concat(devices);

        if (devices.length < pageSize) break;
        page++;
        if (page > 50) break; // Safety limit
      }

      const devices = allDevices;

      // Get existing devices
      const { data: existingDevicesData } = await supabase
        .from('devices')
        .select('*')
        .eq('customer_id', mapping.customer_id)
        .eq('datto_site_id', siteUid);
      const existingDevices = existingDevicesData || [];

      const existingByDattoId = {};
      existingDevices.forEach(d => { existingByDattoId[d.datto_id] = d; });

      const dattoDeviceIds = new Set();
      let siteSynced = 0;

      for (const device of devices) {
        const deviceUid = device.uid || device.id;
        const dattoId = String(deviceUid);
        dattoDeviceIds.add(dattoId);
        const existing = existingByDattoId[dattoId];

        let lastSeenStr = null;
        const lastSeen = device.lastSeen;
        if (lastSeen) {
          lastSeenStr = typeof lastSeen === 'number' ? new Date(lastSeen).toISOString() : lastSeen;
        }

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

        if (existing && !hasDeviceChanged(existing, deviceData)) {
          continue;
        }

        if (existing) {
          await supabase.from('devices').update(deviceData).eq('id', existing.id);
        } else {
          const { data: created, error } = await supabase.from('devices').insert(deviceData).select().single();
          if (error) throw new Error(error.message);
        }
        siteSynced++;
      }

      // Delete devices no longer in Datto
      for (const existing of existingDevices) {
        if (!dattoDeviceIds.has(existing.datto_id)) {
          await supabase.from('devices').delete().eq('id', existing.id);
          siteSynced++;
        }
      }

      totalSynced += siteSynced;
      results.push({
        site: mapping.datto_site_name,
        customer_id: mapping.customer_id,
        devicesInDatto: devices.length,
        synced: siteSynced
      });
    } catch (e) {
      console.error(`Failed to sync site ${mapping.datto_site_id}:`, e.message);
      errors++;
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
    errors,
    totalMappings: allMappings.length,
    results
  };
}
