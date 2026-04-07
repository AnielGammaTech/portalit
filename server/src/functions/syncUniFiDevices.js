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
  const shortname = (device.shortname || '').toUpperCase();
  const model = (device.model || '').toUpperCase();
  const name = (device.name || '').toUpperCase();

  // NAS devices: UNAS*, or name/model contains NAS — NOT firewalls even if isConsole
  if (shortname.includes('UNAS') || model.includes('UNAS') || model.includes('NAS') ||
      name.includes('NAS')) {
    return 'other';
  }

  // Console devices that aren't NAS are gateways/firewalls
  if (device.isConsole) return 'firewall';

  // Switches: USW*, US-* — check BEFORE APs (USW Lite would falsely match AP 'LITE' pattern)
  if (shortname.startsWith('USW') || shortname.startsWith('US-') ||
      model.startsWith('USW') || model.includes('SWITCH') ||
      name.includes('PSW') || name.includes('SW-')) {
    return 'switch';
  }
  // Access Points: U6*, U7*, UAP*, nanoHD, etc.
  if (shortname.startsWith('U6') || shortname.startsWith('U7') || shortname.startsWith('UAP') ||
      shortname.startsWith('NANO') ||
      model.startsWith('U6') || model.startsWith('U7') || model.startsWith('UAP') ||
      model.includes('NANOHD') || model.includes('FLEXHD') || model.includes('LITE') ||
      model.includes(' AP') || model.includes('ACCESS POINT') ||
      name.includes(' AP')) {
    return 'access_point';
  }
  // Gateways/Firewalls: UDM*, UXG*, USG*, UGW*, UCG*
  if (shortname.startsWith('UDM') || shortname.startsWith('UXG') ||
      shortname.startsWith('USG') || shortname.startsWith('UGW') || shortname.startsWith('UCG') ||
      model.startsWith('UDM') || model.startsWith('UXG') || model.startsWith('UCG') ||
      model.includes('DREAM') || model.includes('GATEWAY') || model.includes('CLOUD')) {
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
 * Fetch all sites from /ea/sites (cloud-managed sites).
 * Returns sites that can be mapped individually to customers.
 */
async function fetchSites(apiKey) {
  try {
    const result = await unifiApiCall(apiKey, '/ea/sites');
    return result.data || [];
  } catch {
    // Endpoint may not exist on all setups
    return [];
  }
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
  // Debug: inspect raw API responses
  if (action === 'debug_api') {
    try {
      const [hostsRaw, sitesRaw] = await Promise.all([
        unifiApiCall(apiKey, '/ea/devices'),
        unifiApiCall(apiKey, '/ea/sites').catch(() => ({ data: [] })),
      ]);
      const firstHost = (hostsRaw.data || [])[0];
      const firstSite = (sitesRaw.data || [])[0];
      return {
        success: true,
        hosts: { count: (hostsRaw.data || []).length, firstHostKeys: firstHost ? Object.keys(firstHost) : [], firstHost: firstHost ? { ...firstHost, devices: `[${(firstHost.devices || []).length} devices]`, allDeviceKeys: (firstHost.devices || []).slice(0, 3).map(d => ({ keys: Object.keys(d), name: d.name, mac: d.mac, siteId: d.siteId, site_id: d.site_id, hostSiteId: d.hostSiteId })) } : null },
        sites: { count: (sitesRaw.data || []).length, firstSiteKeys: firstSite ? Object.keys(firstSite) : [], firstSite: firstSite ? JSON.stringify(firstSite).slice(0, 1000) : null },
        largeHost: (() => {
          const large = (hostsRaw.data || []).find(h => (h.devices || []).length > 10);
          if (!large) return null;
          return { name: large.hostName, deviceCount: large.devices.length, sampleDevices: large.devices.slice(0, 5).map(d => ({ name: d.name, mac: d.mac, ...Object.fromEntries(Object.entries(d).filter(([k]) => /site/i.test(k))) })) };
        })(),
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  if (action === 'list_sites') {
    try {
      const [hosts, cloudSites] = await Promise.all([
        fetchHostsWithDevices(apiKey),
        fetchSites(apiKey),
      ]);

      const sites = [];

      // Add standalone hosts (direct consoles like UDM Pro)
      for (const host of hosts) {
        sites.push({
          id: host.hostId,
          name: host.hostName || 'Unknown Host',
          deviceCount: (host.devices || []).length,
          updatedAt: host.updatedAt || null,
          type: 'host',
        });
      }

      // Add cloud-managed sites (individual customer sites within a cloud console)
      for (const site of cloudSites) {
        const siteId = site.siteId;
        const meta = site.meta || {};
        const stats = site.statistics?.counts || {};
        const siteName = meta.desc || meta.name || 'Unknown Site';
        // Skip "Default" sites and sites already represented as hosts
        if (siteName === 'Default' || siteName === 'default') continue;
        if (sites.some(s => s.id === siteId)) continue;
        sites.push({
          id: siteId,
          name: siteName,
          deviceCount: stats.totalDevice || 0,
          updatedAt: site.updatedAt || null,
          type: 'site',
          hostId: site.hostId || null,
          gatewayMac: meta.gatewayMac || null,
        });
      }

      // If no cloud sites found, try to extract sites from device groupings within large hosts
      if (cloudSites.length === 0) {
        for (const host of hosts) {
          if ((host.devices || []).length <= 5) continue; // Only expand large hosts
          // Group devices by their gateway/console — each console represents a customer site
          const consoleDevices = (host.devices || []).filter(d => d.isConsole);
          if (consoleDevices.length > 1) {
            // Multiple consoles in one host = multi-site cloud setup
            for (const console of consoleDevices) {
              const consoleName = console.name || console.hostname || `Site-${console.mac?.slice(-6)}`;
              sites.push({
                id: `${host.hostId}:${console.mac}`,
                name: consoleName,
                deviceCount: 1,
                updatedAt: host.updatedAt || null,
                type: 'console',
                hostId: host.hostId,
                mac: console.mac,
              });
            }
          }
        }
      }

      sites.sort((a, b) => a.name.localeCompare(b.name));
      console.log(`[UniFi] list_sites: ${hosts.length} hosts, ${cloudSites.length} cloud sites, ${sites.length} total`);
      return { success: true, sites };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ─── List Devices for a Host (expand cloud-hosted sites) ───────────────
  if (action === 'list_host_devices') {
    const { host_id } = params;
    if (!host_id) return { success: false, error: 'host_id required' };
    try {
      const hosts = await fetchHostsWithDevices(apiKey);
      const host = hosts.find(h => h.hostId === host_id);
      if (!host) return { success: false, error: 'Host not found' };

      const devices = (host.devices || []).map(d => ({
        ...mapDevice(d),
        hostId: host.hostId,
        hostName: host.hostName,
        // Preserve raw fields for site grouping
        siteId: d.siteId || d.site_id || null,
        siteName: d.siteName || d.site_name || null,
      }));

      // Group consoles/firewalls as "sites" — each firewall represents a customer site
      const gateways = devices.filter(d => d.type === 'firewall' || d.is_console);
      const otherDevices = devices.filter(d => d.type !== 'firewall' && !d.is_console);

      return {
        success: true,
        hostName: host.hostName,
        totalDevices: devices.length,
        gateways,
        devices: otherDevices,
        allDevices: devices,
      };
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
      const siteId = mapping.unifi_site_id;

      // Fetch all hosts with devices
      const hosts = await fetchHostsWithDevices(apiKey);

      let rawDevices;

      // Try to find as a host first (standard mapping)
      const hostEntry = hosts.find(h => h.hostId === siteId);
      if (hostEntry) {
        rawDevices = hostEntry.devices || [];
      } else {
        // Cloud site — try per-site device endpoint first, fall back to gateway MAC
        let fetched = false;

        // Attempt 1: /ea/sites/{siteId}/devices (direct per-site listing)
        try {
          const siteDevices = await unifiApiCall(apiKey, `/ea/sites/${siteId}/devices`);
          rawDevices = siteDevices.data || siteDevices.devices || [];
          if (rawDevices.length > 0) fetched = true;
        } catch {
          // Endpoint may not exist — fall back
        }

        // Attempt 2: match devices by gateway MAC + name prefix
        if (!fetched) {
          const cloudSites = await fetchSites(apiKey);
          const site = cloudSites.find(s => s.siteId === siteId);
          if (!site) return { success: false, error: `Site ${siteId} not found` };

          const parentHost = hosts.find(h => h.hostId === site.hostId);
          if (!parentHost) return { success: false, error: `Parent host for site not found` };

          const gatewayMac = (site.meta?.gatewayMac || '').replace(/:/g, '').toUpperCase();
          const allHostDevices = parentHost.devices || [];

          if (gatewayMac) {
            // Find the gateway device to extract its name prefix
            const gatewayDevice = allHostDevices.find(d => (d.mac || '').toUpperCase() === gatewayMac);
            const gatewayName = gatewayDevice?.name || '';

            // Extract prefix: "EMP-FW" → "EMP", "C&E-AP-03" → "C&E", "GCBSC-AP-03" → "GCBSC"
            const prefix = gatewayName.split(/[-_]/)[0]?.trim();

            if (prefix && prefix.length >= 2) {
              // Match: gateway itself + all devices sharing the same name prefix
              rawDevices = allHostDevices.filter(d => {
                const mac = (d.mac || '').toUpperCase();
                if (mac === gatewayMac) return true;
                const devicePrefix = (d.name || '').split(/[-_]/)[0]?.trim();
                return devicePrefix && devicePrefix === prefix;
              });
              console.log(`[UniFi] Site ${site.meta?.desc}: prefix "${prefix}" matched ${rawDevices.length} devices`);
            } else {
              // No usable prefix — just include the gateway
              rawDevices = gatewayDevice ? [gatewayDevice] : [];
            }
          } else {
            rawDevices = [];
          }
        }
      }

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

      // Fetch all hosts + cloud sites once
      const [hosts, cloudSites] = await Promise.all([
        fetchHostsWithDevices(apiKey),
        fetchSites(apiKey),
      ]);
      const hostMap = Object.fromEntries(hosts.map(h => [h.hostId, h]));
      const siteMap = Object.fromEntries(cloudSites.map(s => [s.siteId, s]));

      let synced = 0;
      const errors = [];

      for (const mapping of mappings) {
        try {
          let rawDevices;
          const siteId = mapping.unifi_site_id;

          // Try host-level first
          const hostEntry = hostMap[siteId];
          if (hostEntry) {
            rawDevices = hostEntry.devices || [];
          } else {
            // Cloud site — try per-site endpoint, fall back to gateway MAC
            let fetched = false;
            try {
              const siteDevices = await unifiApiCall(apiKey, `/ea/sites/${siteId}/devices`);
              rawDevices = siteDevices.data || siteDevices.devices || [];
              if (rawDevices.length > 0) fetched = true;
            } catch { /* fall back */ }

            if (!fetched) {
              const site = siteMap[siteId];
              if (!site) {
                errors.push({ customer: mapping.customer_name, error: 'Site/host not found' });
                continue;
              }
              const parentHost = hostMap[site.hostId];
              if (!parentHost) {
                errors.push({ customer: mapping.customer_name, error: 'Parent host not found' });
                continue;
              }
              const gatewayMac = (site.meta?.gatewayMac || '').replace(/:/g, '').toUpperCase();
              const allHostDevices = parentHost.devices || [];

              if (gatewayMac) {
                const gatewayDevice = allHostDevices.find(d => (d.mac || '').toUpperCase() === gatewayMac);
                const prefix = (gatewayDevice?.name || '').split(/[-_]/)[0]?.trim();

                if (prefix && prefix.length >= 2) {
                  rawDevices = allHostDevices.filter(d => {
                    if ((d.mac || '').toUpperCase() === gatewayMac) return true;
                    const dp = (d.name || '').split(/[-_]/)[0]?.trim();
                    return dp && dp === prefix;
                  });
                } else {
                  rawDevices = gatewayDevice ? [gatewayDevice] : [];
                }
              } else {
                rawDevices = [];
              }
            }
          }

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

  // ─── Auto-Map: match unmapped hosts to customers by name ──────────────
  if (action === 'auto_map') {
    try {
      const hosts = await fetchHostsWithDevices(apiKey);

      // Get existing mappings to know what's already mapped
      const { data: existingMappings } = await supabase.from('unifi_mappings').select('unifi_site_id');
      const mappedHostIds = new Set((existingMappings || []).map(m => m.unifi_site_id));

      // Get all customers
      const { data: customers } = await supabase.from('customers').select('id, name').eq('status', 'active');
      if (!customers || customers.length === 0) {
        return { success: true, message: 'No customers found', mapped: 0 };
      }

      // Normalize for fuzzy matching
      const normalize = (s) => (s || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();

      let mapped = 0;
      let skipped = 0;
      const results = [];

      for (const host of hosts) {
        if (mappedHostIds.has(host.hostId)) {
          skipped++;
          continue;
        }

        const hostName = normalize(host.hostName || '');
        if (!hostName) continue;

        // Try exact match first, then word-overlap scoring
        let bestMatch = null;
        let bestScore = 0;

        for (const cust of customers) {
          const custName = normalize(cust.name);

          // Exact contains
          if (custName.includes(hostName) || hostName.includes(custName)) {
            bestMatch = cust;
            bestScore = 100;
            break;
          }

          // Word overlap
          const hostWords = hostName.split(/\s+/).filter(w => w.length > 2 && !['llc', 'inc', 'corp', 'ltd', 'the', 'and', 'of'].includes(w));
          const custWords = custName.split(/\s+/).filter(w => w.length > 2);
          const overlap = hostWords.filter(w => custWords.some(cw => cw.includes(w) || w.includes(cw))).length;
          const score = hostWords.length > 0 ? (overlap / hostWords.length) * 100 : 0;

          if (score > bestScore && score >= 50) {
            bestScore = score;
            bestMatch = cust;
          }
        }

        if (bestMatch) {
          const { error: insertErr } = await supabase.from('unifi_mappings').insert({
            customer_id: bestMatch.id,
            customer_name: bestMatch.name,
            unifi_site_id: host.hostId,
            unifi_site_name: host.hostName,
          });

          if (!insertErr) {
            mapped++;
            results.push({ host: host.hostName, customer: bestMatch.name, score: bestScore });
          }
        } else {
          results.push({ host: host.hostName, customer: null, score: 0 });
        }
      }

      return {
        success: true,
        mapped,
        skipped,
        total: hosts.length,
        results,
        message: `Auto-mapped ${mapped} hosts, ${skipped} already mapped, ${hosts.length - mapped - skipped} unmatched`,
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  return { success: false, error: `Unknown action: ${action}` };
}
