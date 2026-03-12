import { getServiceSupabase } from '../lib/supabase.js';

const UNIFI_API_BASE = 'https://api.ui.com';

async function getUniFiApiKey() {
  return process.env.unifi_api_key || process.env.UNIFI_API_KEY || null;
}

async function unifiApiCall(apiKey, endpoint, method = 'GET') {
  const response = await fetch(`${UNIFI_API_BASE}${endpoint}`, {
    method,
    headers: {
      'X-API-Key': apiKey,
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`UniFi API error ${response.status}: ${errText}`);
  }

  return response.json();
}

/**
 * Categorize a device based on its shortname and isConsole flag.
 * The /ea/devices endpoint returns shortname (e.g. "UDMPRO", "U6ENT", "USWAGG").
 */
function categorizeDeviceType(device) {
  if (device.isConsole) return 'firewall';

  const shortname = (device.shortname || '').toUpperCase();
  const model = (device.model || '').toLowerCase();

  // Access Points: U6*, U7*, UAP*, nanoHD, etc.
  if (shortname.startsWith('U6') || shortname.startsWith('U7') || shortname.startsWith('UAP') ||
      shortname.startsWith('NANO') || model.includes('ap') || model.includes('access point')) {
    return 'access_point';
  }
  // Switches: USW*, US-*
  if (shortname.startsWith('USW') || shortname.startsWith('US') || model.includes('switch')) {
    return 'switch';
  }
  // Gateways/Firewalls: UDM*, UXG*, USG*, UGW*
  if (shortname.startsWith('UDM') || shortname.startsWith('UXG') ||
      shortname.startsWith('USG') || shortname.startsWith('UGW') ||
      model.includes('dream') || model.includes('gateway')) {
    return 'firewall';
  }
  return 'other';
}

function formatUptime(startupTime) {
  if (!startupTime) return null;
  const startMs = new Date(startupTime).getTime();
  if (isNaN(startMs)) return null;
  const seconds = Math.floor((Date.now() - startMs) / 1000);
  if (seconds < 0) return null;
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  if (days > 0) return `${days}d ${hours}h`;
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${mins}m`;
}

/**
 * Fetch all hosts with their devices from /ea/devices.
 * Response: { data: [{ hostId, hostName, devices: [...], updatedAt }] }
 */
async function fetchHostsWithDevices(apiKey) {
  const result = await unifiApiCall(apiKey, '/ea/devices');
  return result.data || [];
}

/**
 * Map a raw device from the API to our cached format.
 */
function mapDevice(device) {
  return {
    mac: device.mac || '',
    name: device.name || 'Unknown',
    ip: device.ip || '',
    model: device.model || '',
    shortname: device.shortname || '',
    type: categorizeDeviceType(device),
    status: device.status === 'online' ? 'online' : 'offline',
    firmware: device.version || '',
    firmware_status: device.firmwareStatus || '',
    is_console: device.isConsole || false,
    startup_time: device.startupTime || null,
    uptime: formatUptime(device.startupTime),
  };
}

export async function syncUniFiDevices(params) {
  const { action } = params;
  const supabase = getServiceSupabase();

  const apiKey = await getUniFiApiKey();
  if (!apiKey) {
    return { success: false, error: 'UniFi API key not configured. Set unifi_api_key env variable.' };
  }

  // ─── List Hosts (for mapping UI) ──────────────────────────────────────
  // Each host is a console/gateway (UDM, Cloud Key, etc.) managing devices.
  // The user maps hosts to customers.
  if (action === 'list_sites') {
    try {
      const hosts = await fetchHostsWithDevices(apiKey);
      const sites = hosts.map(host => ({
        id: host.hostId,
        name: host.hostName || 'Unknown Host',
        deviceCount: (host.devices || []).length,
        updatedAt: host.updatedAt || null,
      }));
      // Sort by name for a clean UI
      sites.sort((a, b) => a.name.localeCompare(b.name));
      return { success: true, sites };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ─── Sync Devices for One Customer ───────────────────────────────────
  if (action === 'sync_devices') {
    const { customer_id } = params;
    if (!customer_id) return { success: false, error: 'customer_id is required' };

    try {
      const { data: mappings, error: mapErr } = await supabase
        .from('unifi_mappings')
        .select('*')
        .eq('customer_id', customer_id);

      if (mapErr) throw new Error(mapErr.message);
      if (!mappings || mappings.length === 0) {
        return { success: false, error: 'No UniFi host mapped for this customer' };
      }

      const mapping = mappings[0];
      const hostId = mapping.unifi_site_id; // stores the hostId

      // Fetch all hosts with devices and find the matching one
      const hosts = await fetchHostsWithDevices(apiKey);
      const hostEntry = hosts.find(h => h.hostId === hostId);

      if (!hostEntry) {
        return { success: false, error: `Host ${hostId} not found in UniFi API` };
      }

      const rawDevices = hostEntry.devices || [];
      const devices = rawDevices.map(mapDevice);

      const summary = {
        total: devices.length,
        online: devices.filter(d => d.status === 'online').length,
        offline: devices.filter(d => d.status === 'offline').length,
        firewalls: devices.filter(d => d.type === 'firewall').length,
        switches: devices.filter(d => d.type === 'switch').length,
        access_points: devices.filter(d => d.type === 'access_point').length,
      };

      const cachedData = { devices, summary, synced_at: new Date().toISOString() };

      const { error: cacheErr } = await supabase.rpc('write_mapping_cache', {
        p_table: 'unifi_mappings',
        p_mapping_id: mapping.id,
        p_cached_data: cachedData,
        p_last_synced: new Date().toISOString(),
      });
      if (cacheErr) {
        console.error('[UniFi] cache write failed:', cacheErr.message);
      }

      return { success: true, recordsSynced: devices.length, summary };
    } catch (error) {
      console.error('UniFi sync_devices error:', error);
      return { success: false, error: error.message };
    }
  }

  // ─── Sync All Mappings ───────────────────────────────────────────────
  if (action === 'sync_all') {
    try {
      const { data: mappings, error: mapErr } = await supabase
        .from('unifi_mappings')
        .select('*');

      if (mapErr) throw new Error(mapErr.message);
      if (!mappings || mappings.length === 0) {
        return { success: true, message: 'No mappings to sync', synced: 0 };
      }

      // Fetch all hosts once, then match per mapping
      const hosts = await fetchHostsWithDevices(apiKey);
      const hostMap = Object.fromEntries(hosts.map(h => [h.hostId, h]));

      let synced = 0;
      const errors = [];

      for (const mapping of mappings) {
        try {
          const hostEntry = hostMap[mapping.unifi_site_id];
          if (!hostEntry) {
            errors.push({ customer: mapping.customer_name, error: 'Host not found in API' });
            continue;
          }

          const rawDevices = hostEntry.devices || [];
          const devices = rawDevices.map(mapDevice);

          const summary = {
            total: devices.length,
            online: devices.filter(d => d.status === 'online').length,
            offline: devices.filter(d => d.status === 'offline').length,
            firewalls: devices.filter(d => d.type === 'firewall').length,
            switches: devices.filter(d => d.type === 'switch').length,
            access_points: devices.filter(d => d.type === 'access_point').length,
          };

          const cachedData = { devices, summary, synced_at: new Date().toISOString() };

          const { error: cacheErr } = await supabase.rpc('write_mapping_cache', {
            p_table: 'unifi_mappings',
            p_mapping_id: mapping.id,
            p_cached_data: cachedData,
            p_last_synced: new Date().toISOString(),
          });

          if (cacheErr) {
            errors.push({ customer: mapping.customer_name, error: cacheErr.message });
          } else {
            synced++;
          }
        } catch (err) {
          errors.push({ customer: mapping.customer_name, error: err.message });
        }
      }

      return { success: true, synced, total: mappings.length, errors: errors.length > 0 ? errors : undefined };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  return { success: false, error: `Unknown action: ${action}` };
}
