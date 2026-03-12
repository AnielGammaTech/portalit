import { getServiceSupabase } from '../lib/supabase.js';

const UNIFI_API_BASE = 'https://api.ui.com';

async function getUniFiApiKey(supabase) {
  const { data } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'unifi_api_key')
    .single();
  return data?.value || process.env.UNIFI_API_KEY || null;
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

function categorizeDeviceType(device) {
  const type = (device.type || '').toLowerCase();
  const model = (device.model || '').toLowerCase();

  if (type.includes('ugw') || type.includes('udm') || type.includes('uxg') || model.includes('dream') || model.includes('gateway')) {
    return 'firewall';
  }
  if (type.includes('usw') || type.includes('switch') || model.includes('switch')) {
    return 'switch';
  }
  if (type.includes('uap') || type.includes('u6') || type.includes('u7') || model.includes('ap') || model.includes('access')) {
    return 'access_point';
  }
  return 'other';
}

function formatUptime(seconds) {
  if (!seconds) return null;
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  if (days > 0) return `${days}d ${hours}h`;
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${mins}m`;
}

export async function syncUniFiDevices(params) {
  const { action } = params;
  const supabase = getServiceSupabase();

  const apiKey = await getUniFiApiKey(supabase);
  if (!apiKey) {
    return { success: false, error: 'UniFi API key not configured. Set it in Admin > Integrations.' };
  }

  // ─── List Sites ──────────────────────────────────────────────────────
  if (action === 'list_sites') {
    try {
      const result = await unifiApiCall(apiKey, '/ea/sites');
      const sites = (result.data || result || []).map(site => ({
        id: site.hostId || site._id || site.siteId,
        name: site.meta?.desc || site.hostname || site.name || 'Unknown Site',
        deviceCount: site.statistics?.counts?.total || 0,
      }));
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
      // Look up the mapping
      const { data: mappings, error: mapErr } = await supabase
        .from('unifi_mappings')
        .select('*')
        .eq('customer_id', customer_id);

      if (mapErr) throw new Error(mapErr.message);
      if (!mappings || mappings.length === 0) {
        return { success: false, error: 'No UniFi site mapped for this customer' };
      }

      const mapping = mappings[0];
      const siteId = mapping.unifi_site_id;

      // Fetch devices — try site-filtered first, fall back to all
      let allDevices = [];
      try {
        const result = await unifiApiCall(apiKey, `/ea/devices?hostIds=${siteId}`);
        allDevices = result.data || result || [];
      } catch {
        // Fall back to fetching all and filtering
        const result = await unifiApiCall(apiKey, '/ea/devices');
        const all = result.data || result || [];
        allDevices = all.filter(d => d.hostId === siteId || d.host?.id === siteId);
      }

      // Build cached device list
      const devices = allDevices.map(device => ({
        mac: device.mac || '',
        name: device.name || device.hostname || 'Unknown',
        ip: device.ip || device.networkAddress || '',
        model: device.model || device.shortname || '',
        model_name: device.modelName || device.productLine || '',
        type: categorizeDeviceType(device),
        status: device.state === 1 || device.status === 'online' ? 'online' : 'offline',
        firmware: device.version || device.firmwareVersion || '',
        uptime: formatUptime(device.uptime),
        uptime_seconds: device.uptime || 0,
        serial: device.serial || '',
        last_seen: device.lastSeen || device.last_seen || null,
      }));

      const summary = {
        total: devices.length,
        online: devices.filter(d => d.status === 'online').length,
        offline: devices.filter(d => d.status === 'offline').length,
        firewalls: devices.filter(d => d.type === 'firewall').length,
        switches: devices.filter(d => d.type === 'switch').length,
        access_points: devices.filter(d => d.type === 'access_point').length,
      };

      const cachedData = { devices, summary, synced_at: new Date().toISOString() };

      // Write to mapping
      const { error: updateErr } = await supabase
        .from('unifi_mappings')
        .update({ cached_data: cachedData, last_synced: new Date().toISOString() })
        .eq('id', mapping.id);

      if (updateErr) throw new Error(updateErr.message);

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

      let synced = 0;
      let errors = [];

      for (const mapping of mappings) {
        try {
          const result = await syncUniFiDevices({
            action: 'sync_devices',
            customer_id: mapping.customer_id,
          });
          if (result.success) {
            synced++;
          } else {
            errors.push({ customer: mapping.customer_name, error: result.error });
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
