import { getServiceSupabase } from '../lib/supabase.js';

const VULTR_API_BASE = 'https://api.vultr.com/v2';

function getVultrApiKey() {
  return process.env.VULTR_API_KEY || null;
}

async function vultrGet(endpoint, apiKey) {
  const response = await fetch(`${VULTR_API_BASE}${endpoint}`, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Vultr API error ${response.status}: ${errText}`);
  }

  return response.json();
}

/**
 * Format bytes to human-readable (GB/TB).
 */
function formatStorage(mb) {
  if (!mb) return '0 GB';
  const gb = mb / 1024;
  if (gb >= 1024) return `${(gb / 1024).toFixed(1)} TB`;
  return `${Math.round(gb)} GB`;
}

/**
 * Format RAM in MB to human-readable.
 */
function formatRam(mb) {
  if (!mb) return '0 MB';
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb} MB`;
}

/**
 * Map a raw Vultr instance to our cached format.
 */
function mapInstance(instance) {
  return {
    id: instance.id,
    label: instance.label || 'Unnamed',
    hostname: instance.hostname || '',
    os: instance.os || '',
    ram: instance.ram || 0,
    ram_display: formatRam(instance.ram),
    vcpu_count: instance.vcpu_count || 0,
    disk: instance.disk || 0,
    disk_display: formatStorage(instance.disk),
    main_ip: instance.main_ip || '',
    v6_main_ip: instance.v6_main_ip || '',
    region: instance.region || '',
    plan: instance.plan || '',
    status: instance.status || 'unknown',
    power_status: instance.power_status || 'unknown',
    server_status: instance.server_status || 'unknown',
    date_created: instance.date_created || null,
    allowed_bandwidth: instance.allowed_bandwidth || 0,
    netmask_v4: instance.netmask_v4 || '',
    gateway_v4: instance.gateway_v4 || '',
    tags: instance.tags || [],
    features: instance.features || [],
  };
}

export async function syncVultr(body, _user) {
  const supabase = getServiceSupabase();
  const { action } = body;

  const apiKey = getVultrApiKey();
  if (!apiKey && action !== 'get_cached') {
    return { success: false, error: 'Vultr API key not configured. Set VULTR_API_KEY in environment.' };
  }

  // ── Test Connection ──────────────────────────────────────────────────
  if (action === 'test_connection') {
    try {
      const data = await vultrGet('/instances', apiKey);
      const instances = data.instances || [];
      return {
        success: true,
        message: `Vultr connected — ${instances.length} instance(s) found`,
        instanceCount: instances.length,
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ── List Instances (for mapping UI) ──────────────────────────────────
  if (action === 'list_instances') {
    try {
      const allInstances = [];
      let cursor = '';

      // Paginate through all instances
      while (true) {
        const endpoint = cursor
          ? `/instances?per_page=100&cursor=${cursor}`
          : '/instances?per_page=100';
        const data = await vultrGet(endpoint, apiKey);
        const instances = data.instances || [];
        allInstances.push(...instances);

        // Check for next page
        if (data.meta?.links?.next) {
          const nextUrl = new URL(data.meta.links.next, VULTR_API_BASE);
          cursor = nextUrl.searchParams.get('cursor') || '';
          if (!cursor) break;
        } else {
          break;
        }
      }

      const sites = allInstances.map(inst => ({
        id: inst.id,
        label: inst.label || 'Unnamed',
        hostname: inst.hostname || '',
        os: inst.os || '',
        main_ip: inst.main_ip || '',
        region: inst.region || '',
        plan: inst.plan || '',
        status: inst.status || 'unknown',
        power_status: inst.power_status || 'unknown',
        vcpu_count: inst.vcpu_count || 0,
        ram: inst.ram || 0,
        ram_display: formatRam(inst.ram),
        disk: inst.disk || 0,
        disk_display: formatStorage(inst.disk),
      }));

      sites.sort((a, b) => a.label.localeCompare(b.label));
      return { success: true, instances: sites };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ── Sync Instance for One Customer ───────────────────────────────────
  if (action === 'sync_instance') {
    const { customer_id } = body;
    if (!customer_id) return { success: false, error: 'customer_id is required' };

    try {
      const { data: mappings, error: mapErr } = await supabase
        .from('vultr_mappings')
        .select('*')
        .eq('customer_id', customer_id);

      if (mapErr) throw new Error(mapErr.message);
      if (!mappings || mappings.length === 0) {
        return { success: false, error: 'No Vultr instance mapped for this customer' };
      }

      const mapping = mappings[0];
      const instanceId = mapping.vultr_instance_id;

      // Fetch instance details
      const data = await vultrGet(`/instances/${instanceId}`, apiKey);
      const instance = data.instance;

      if (!instance) {
        return { success: false, error: `Instance ${instanceId} not found in Vultr` };
      }

      const mapped = mapInstance(instance);

      // Fetch bandwidth for this instance (current month)
      let bandwidth = null;
      try {
        const bwData = await vultrGet(`/instances/${instanceId}/bandwidth`, apiKey);
        bandwidth = bwData.bandwidth || null;
      } catch {
        // bandwidth is optional
      }

      const cachedData = {
        instance: mapped,
        bandwidth,
        synced_at: new Date().toISOString(),
      };

      const { error: cacheErr } = await supabase
        .from('vultr_mappings')
        .update({
          cached_data: cachedData,
          last_synced: new Date().toISOString(),
          vultr_instance_label: mapped.label,
          vultr_plan: mapped.plan,
          vultr_region: mapped.region,
        })
        .eq('id', mapping.id);

      if (cacheErr) {
        console.error('[Vultr] cache write failed:', cacheErr.message);
      }

      return { success: true, instance: mapped };
    } catch (error) {
      console.error('Vultr sync_instance error:', error);
      return { success: false, error: error.message };
    }
  }

  // ── Sync All Mappings ────────────────────────────────────────────────
  if (action === 'sync_all') {
    try {
      const { data: mappings, error: mapErr } = await supabase
        .from('vultr_mappings')
        .select('*');

      if (mapErr) throw new Error(mapErr.message);
      if (!mappings || mappings.length === 0) {
        return { success: true, message: 'No mappings to sync', synced: 0 };
      }

      let synced = 0;
      const errors = [];

      for (const mapping of mappings) {
        try {
          const result = await syncVultr({ action: 'sync_instance', customer_id: mapping.customer_id }, _user);
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
