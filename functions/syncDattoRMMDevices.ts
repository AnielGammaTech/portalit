import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const DATTO_API_KEY = Deno.env.get('DATTO_RMM_API_KEY');
const DATTO_API_SECRET = Deno.env.get('DATTO_RMM_API_SECRET');
const DATTO_API_URL = Deno.env.get('DATTO_RMM_API_URL');

async function getDattoAccessToken() {
  const authUrl = `${DATTO_API_URL}/auth/oauth/token`;
  const credentials = btoa(`${DATTO_API_KEY}:${DATTO_API_SECRET}`);
  
  const response = await fetch(authUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get Datto access token: ${error}`);
  }

  const data = await response.json();
  return data.access_token;
}

async function dattoApiCall(accessToken, endpoint) {
  const response = await fetch(`${DATTO_API_URL}/api/v2${endpoint}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Datto API error: ${error}`);
  }

  return response.json();
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { action, customer_id, datto_site_id } = await req.json();

    if (!DATTO_API_KEY || !DATTO_API_SECRET || !DATTO_API_URL) {
      return Response.json({ error: 'Datto RMM credentials not configured' }, { status: 400 });
    }

    const accessToken = await getDattoAccessToken();

    // Action: List all Datto sites (for mapping)
    if (action === 'list_sites') {
      const sitesData = await dattoApiCall(accessToken, '/account/sites');
      const sites = sitesData.sites || [];
      
      return Response.json({
        success: true,
        sites: sites.map(site => ({
          id: site.id,
          uid: site.uid,
          name: site.name,
          description: site.description,
          deviceCount: site.devicesStatus?.numberOfDevices || 0
        }))
      });
    }

    // Action: Test connection
    if (action === 'test_connection') {
      const accountData = await dattoApiCall(accessToken, '/account');
      return Response.json({
        success: true,
        account: {
          name: accountData.name,
          uid: accountData.uid
        }
      });
    }

    // Action: Sync devices for a specific customer
    if (action === 'sync_devices') {
      if (!customer_id) {
        return Response.json({ error: 'customer_id is required' }, { status: 400 });
      }

      // Get the Datto site mapping for this customer
      const mappings = await base44.asServiceRole.entities.DattoSiteMapping.filter({ customer_id });
      
      if (mappings.length === 0) {
        return Response.json({ error: 'No Datto site mapped to this customer' }, { status: 400 });
      }

      let totalSynced = 0;
      
      for (const mapping of mappings) {
        // Get devices for this site
        const devicesData = await dattoApiCall(accessToken, `/site/${mapping.datto_site_id}/devices`);
        const devices = devicesData.devices || [];

        // Get existing devices for this customer
        const existingDevices = await base44.asServiceRole.entities.Device.filter({ 
          customer_id,
          datto_site_id: mapping.datto_site_id 
        });
        const existingByDattoId = {};
        existingDevices.forEach(d => { existingByDattoId[d.datto_id] = d; });

        for (const device of devices) {
          const deviceData = {
            customer_id,
            datto_id: String(device.id || device.uid),
            datto_site_id: mapping.datto_site_id,
            hostname: device.hostname || device.name || 'Unknown',
            description: device.description || '',
            device_type: mapDeviceType(device.deviceType?.category),
            os: device.operatingSystem || '',
            manufacturer: device.manufacturer || '',
            model: device.model || '',
            serial_number: device.serialNumber || '',
            ip_address: device.intIpAddress || device.extIpAddress || '',
            mac_address: device.macAddresses?.[0] || '',
            last_seen: device.lastSeen || null,
            status: device.online ? 'online' : 'offline',
            agent_version: device.agentVersion || ''
          };

          const existing = existingByDattoId[deviceData.datto_id];
          if (existing) {
            await base44.asServiceRole.entities.Device.update(existing.id, deviceData);
          } else {
            await base44.asServiceRole.entities.Device.create(deviceData);
          }
          totalSynced++;
        }
      }

      return Response.json({
        success: true,
        recordsSynced: totalSynced
      });
    }

    // Action: Full sync all mapped customers
    if (action === 'sync_all') {
      const allMappings = await base44.asServiceRole.entities.DattoSiteMapping.list();
      let totalSynced = 0;

      for (const mapping of allMappings) {
        try {
          const devicesData = await dattoApiCall(accessToken, `/site/${mapping.datto_site_id}/devices`);
          const devices = devicesData.devices || [];

          const existingDevices = await base44.asServiceRole.entities.Device.filter({ 
            customer_id: mapping.customer_id,
            datto_site_id: mapping.datto_site_id 
          });
          const existingByDattoId = {};
          existingDevices.forEach(d => { existingByDattoId[d.datto_id] = d; });

          for (const device of devices) {
            const deviceData = {
              customer_id: mapping.customer_id,
              datto_id: String(device.id || device.uid),
              datto_site_id: mapping.datto_site_id,
              hostname: device.hostname || device.name || 'Unknown',
              description: device.description || '',
              device_type: mapDeviceType(device.deviceType?.category),
              os: device.operatingSystem || '',
              manufacturer: device.manufacturer || '',
              model: device.model || '',
              serial_number: device.serialNumber || '',
              ip_address: device.intIpAddress || device.extIpAddress || '',
              mac_address: device.macAddresses?.[0] || '',
              last_seen: device.lastSeen || null,
              status: device.online ? 'online' : 'offline',
              agent_version: device.agentVersion || ''
            };

            const existing = existingByDattoId[deviceData.datto_id];
            if (existing) {
              await base44.asServiceRole.entities.Device.update(existing.id, deviceData);
            } else {
              await base44.asServiceRole.entities.Device.create(deviceData);
            }
            totalSynced++;
          }
        } catch (err) {
          console.error(`Error syncing site ${mapping.datto_site_id}:`, err.message);
        }
      }

      return Response.json({
        success: true,
        recordsSynced: totalSynced
      });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('Datto sync error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

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