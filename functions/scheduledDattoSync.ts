import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const DATTO_API_KEY = Deno.env.get('DATTO_RMM_API_KEY');
const DATTO_API_SECRET = Deno.env.get('DATTO_RMM_API_SECRET');
const DATTO_API_URL = Deno.env.get('DATTO_RMM_API_URL');

async function getDattoAccessToken() {
  const baseUrl = DATTO_API_URL.replace(/\/$/, '');
  const authUrl = `${baseUrl}/auth/oauth/token`;
  
  const params = new URLSearchParams();
  params.append('grant_type', 'password');
  params.append('username', DATTO_API_KEY);
  params.append('password', DATTO_API_SECRET);
  
  const basicAuth = btoa('public-client:public');
  
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

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    if (!DATTO_API_KEY || !DATTO_API_SECRET || !DATTO_API_URL) {
      return Response.json({ success: false, error: 'Datto RMM credentials not configured' });
    }

    const accessToken = await getDattoAccessToken();

    // Get all Datto site mappings
    const allMappings = await base44.asServiceRole.entities.DattoSiteMapping.list();

    if (!allMappings || allMappings.length === 0) {
      return Response.json({ success: true, message: 'No Datto site mappings found', synced: 0 });
    }

    let totalSynced = 0;
    let errors = 0;
    const results = [];

    for (const mapping of allMappings) {
      try {
        const siteUid = mapping.datto_site_id;

        // Get devices for this site
        const devicesData = await dattoApiCall(accessToken, `/site/${siteUid}/devices`);
        const devices = devicesData.devices || [];

        // Get existing devices
        const existingDevices = await base44.asServiceRole.entities.Device.filter({ 
          customer_id: mapping.customer_id,
          datto_site_id: siteUid 
        });
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
            await base44.asServiceRole.entities.Device.update(existing.id, deviceData);
          } else {
            await base44.asServiceRole.entities.Device.create(deviceData);
          }
          siteSynced++;
        }

        // Delete devices no longer in Datto
        for (const existing of existingDevices) {
          if (!dattoDeviceIds.has(existing.datto_id)) {
            await base44.asServiceRole.entities.Device.delete(existing.id);
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

    return Response.json({
      success: true,
      totalSynced,
      errors,
      totalMappings: allMappings.length,
      results
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});