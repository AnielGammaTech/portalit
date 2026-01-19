import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const DATTO_API_KEY = Deno.env.get('DATTO_RMM_API_KEY');
const DATTO_API_SECRET = Deno.env.get('DATTO_RMM_API_SECRET');
const DATTO_API_URL = Deno.env.get('DATTO_RMM_API_URL');

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

// Helper to check if device data has changed
function hasDeviceChanged(existing, newData) {
  if (!existing) return true;
  const fieldsToCheck = ['hostname', 'os', 'ip_address', 'status', 'last_seen', 'last_user', 'serial_number', 'manufacturer', 'model'];
  return fieldsToCheck.some(field => existing[field] !== newData[field]);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const body = await req.json();
    const { action, customer_id, datto_site_id, scheduled } = body;
    
    // For scheduled runs, skip user auth check
    if (!scheduled) {
      const user = await base44.auth.me();
      if (user?.role !== 'admin') {
        return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
      }
    }

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
          id: site.uid, // Use uid as the primary identifier for API calls
          uid: site.uid,
          name: site.name,
          description: site.description,
          deviceCount: site.devicesStatus?.numberOfDevices || 0
        }))
      });
    }

    // Action: Auto-map sites to customers by name matching
    if (action === 'automap') {
      const sitesData = await dattoApiCall(accessToken, '/account/sites');
      const sites = sitesData.sites || [];
      const customers = await base44.asServiceRole.entities.Customer.list();
      const existingMappings = await base44.asServiceRole.entities.DattoSiteMapping.list();
      
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
          await base44.asServiceRole.entities.DattoSiteMapping.create({
            customer_id: matchedCustomer.id,
            datto_site_id: siteId,
            datto_site_name: site.name
          });
          mappedCount++;
          mappedPairs.push({ site: site.name, customer: matchedCustomer.name });
        }
      }

      return Response.json({
        success: true,
        mappedCount,
        mappedPairs,
        totalSites: sites.length
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

    // Action: Debug single device to see all fields
    if (action === 'debug_device') {
      const { device_uid } = body;
      if (!device_uid) {
        return Response.json({ error: 'device_uid required' }, { status: 400 });
      }
      const deviceData = await dattoApiCall(accessToken, `/device/${device_uid}`);
      return Response.json({ success: true, device: deviceData });
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
        const siteUid = mapping.datto_site_id;

        // Datto RMM API: /site/{siteUid}/devices
        const devicesData = await dattoApiCall(accessToken, `/site/${siteUid}/devices`);
        const devices = devicesData.devices || [];

        // Get existing devices for this customer
        const existingDevices = await base44.asServiceRole.entities.Device.filter({ 
          customer_id,
          datto_site_id: siteUid 
        });
        const existingByDattoId = {};
        existingDevices.forEach(d => { existingByDattoId[d.datto_id] = d; });

        for (const device of devices) {
          const deviceUid = device.uid || device.id;
          const existing = existingByDattoId[String(deviceUid)];

          // Convert lastSeen timestamp to ISO string if it's a number
          let lastSeenStr = null;
          const lastSeen = device.lastSeen;
          if (lastSeen) {
            lastSeenStr = typeof lastSeen === 'number' ? new Date(lastSeen).toISOString() : lastSeen;
          }

          // Build basic device data from list endpoint
          const basicDeviceData = {
            customer_id,
            datto_id: String(deviceUid),
            datto_site_id: siteUid,
            hostname: device.hostname || device.name || 'Unknown',
            description: device.description || '',
            device_type: mapDeviceType(device.deviceType?.category),
            os: device.operatingSystem || '',
            ip_address: device.intIpAddress || device.extIpAddress || '',
            last_seen: lastSeenStr,
            status: device.online ? 'online' : 'offline'
          };

          // Only fetch full details if new device OR basic data changed OR missing serial number
          const needsFullFetch = !existing || 
            hasDeviceChanged(existing, basicDeviceData) || 
            !existing.serial_number;

          let deviceData = basicDeviceData;

          if (needsFullFetch) {
            try {
              const fullDevice = await dattoApiCall(accessToken, `/device/${deviceUid}`);
              const fullLastSeen = fullDevice.lastSeen || device.lastSeen;
              const fullLastSeenStr = fullLastSeen ? 
                (typeof fullLastSeen === 'number' ? new Date(fullLastSeen).toISOString() : fullLastSeen) : null;
              
              deviceData = {
                customer_id,
                datto_id: String(deviceUid),
                datto_site_id: siteUid,
                hostname: fullDevice.hostname || device.hostname || 'Unknown',
                description: fullDevice.description || device.description || '',
                device_type: mapDeviceType(fullDevice.deviceType?.category || device.deviceType?.category),
                os: fullDevice.operatingSystem || device.operatingSystem || '',
                manufacturer: fullDevice.manufacturer || '',
                model: fullDevice.model || '',
                serial_number: fullDevice.serialNumber || fullDevice.bios?.serialNumber || '',
                ip_address: fullDevice.intIpAddress || device.intIpAddress || fullDevice.extIpAddress || '',
                mac_address: fullDevice.macAddresses?.[0] || '',
                last_seen: fullLastSeenStr,
                last_user: fullDevice.lastLoggedInUser || fullDevice.lastUser || '',
                status: fullDevice.online ? 'online' : 'offline',
                agent_version: fullDevice.agentVersion || ''
              };
            } catch (e) {
              console.log(`Could not fetch details for device ${deviceUid}: ${e.message}`);
            }
          } else {
            // No changes, skip update
            continue;
          }

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
      
      if (!allMappings || allMappings.length === 0) {
        return Response.json({ success: true, recordsSynced: 0, message: 'No site mappings found' });
      }
      
      let totalSynced = 0;
      const errors = [];

      for (const mapping of allMappings) {
        try {
          const siteUid = mapping.datto_site_id;
          
          // Datto RMM API: /site/{siteUid}/devices
          const devicesData = await dattoApiCall(accessToken, `/site/${siteUid}/devices`);
          const devices = devicesData.devices || [];
          
          const existingDevices = await base44.asServiceRole.entities.Device.filter({ 
            customer_id: mapping.customer_id,
            datto_site_id: siteUid 
          });
          const existingByDattoId = {};
          existingDevices.forEach(d => { existingByDattoId[d.datto_id] = d; });

          for (const device of devices) {
            const deviceUid = device.uid || device.id;
            const existing = existingByDattoId[String(deviceUid)];

            // Convert lastSeen timestamp to ISO string if it's a number
            let lastSeenStr = null;
            const lastSeen = device.lastSeen;
            if (lastSeen) {
              lastSeenStr = typeof lastSeen === 'number' ? new Date(lastSeen).toISOString() : lastSeen;
            }

            // Build basic device data from list endpoint
            const basicDeviceData = {
              customer_id: mapping.customer_id,
              datto_id: String(deviceUid),
              datto_site_id: siteUid,
              hostname: device.hostname || device.name || 'Unknown',
              description: device.description || '',
              device_type: mapDeviceType(device.deviceType?.category),
              os: device.operatingSystem || '',
              ip_address: device.intIpAddress || device.extIpAddress || '',
              last_seen: lastSeenStr,
              status: device.online ? 'online' : 'offline'
            };

            // Only fetch full details if new device OR basic data changed OR missing serial number
            const needsFullFetch = !existing || 
              hasDeviceChanged(existing, basicDeviceData) || 
              !existing.serial_number;

            let deviceData = basicDeviceData;

            if (needsFullFetch) {
              try {
                const fullDevice = await dattoApiCall(accessToken, `/device/${deviceUid}`);
                const fullLastSeen = fullDevice.lastSeen || device.lastSeen;
                const fullLastSeenStr = fullLastSeen ? 
                  (typeof fullLastSeen === 'number' ? new Date(fullLastSeen).toISOString() : fullLastSeen) : null;
                
                deviceData = {
                  customer_id: mapping.customer_id,
                  datto_id: String(deviceUid),
                  datto_site_id: siteUid,
                  hostname: fullDevice.hostname || device.hostname || 'Unknown',
                  description: fullDevice.description || device.description || '',
                  device_type: mapDeviceType(fullDevice.deviceType?.category || device.deviceType?.category),
                  os: fullDevice.operatingSystem || device.operatingSystem || '',
                  manufacturer: fullDevice.manufacturer || '',
                  model: fullDevice.model || '',
                  serial_number: fullDevice.serialNumber || fullDevice.bios?.serialNumber || '',
                  ip_address: fullDevice.intIpAddress || device.intIpAddress || fullDevice.extIpAddress || '',
                  mac_address: fullDevice.macAddresses?.[0] || '',
                  last_seen: fullLastSeenStr,
                  last_user: fullDevice.lastLoggedInUser || fullDevice.lastUser || '',
                  status: fullDevice.online ? 'online' : 'offline',
                  agent_version: fullDevice.agentVersion || ''
                };
              } catch (e) {
                console.log(`Could not fetch details for device ${deviceUid}: ${e.message}`);
              }
            } else {
              // No changes, skip update
              continue;
            }

            if (existing) {
              await base44.asServiceRole.entities.Device.update(existing.id, deviceData);
            } else {
              await base44.asServiceRole.entities.Device.create(deviceData);
            }
            totalSynced++;
          }
        } catch (err) {
          console.error(`Error syncing site ${mapping.datto_site_id}:`, err.message);
          errors.push({ site: mapping.datto_site_name, error: err.message });
        }
      }

      return Response.json({
        success: true,
        recordsSynced: totalSynced,
        errors: errors.length > 0 ? errors : undefined
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