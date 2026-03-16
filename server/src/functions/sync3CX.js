import { getServiceSupabase } from '../lib/supabase.js';

/**
 * 3CX VoIP Integration
 *
 * Each customer has their own 3CX instance with per-customer API credentials.
 * The 3CX API (v18+) uses OAuth2 or API key authentication.
 *
 * Actions:
 *   test_connection  – Validate credentials for a specific customer mapping
 *   sync_extensions  – Fetch extensions from a customer's 3CX instance
 *   sync_all         – Sync all mapped customers
 */

// Validate instance URL to prevent SSRF
function validateInstanceUrl(url) {
  let parsed;
  try { parsed = new URL(url); } catch { throw new Error('Invalid instance URL'); }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Only http/https URLs are allowed');
  }
  const hostname = parsed.hostname.toLowerCase();
  const blocked = [
    /^localhost$/, /^127\./, /^10\./, /^172\.(1[6-9]|2\d|3[01])\./,
    /^192\.168\./, /^169\.254\./, /^0\./, /^\[::1\]/, /^metadata\./, /\.internal$/,
  ];
  if (blocked.some(re => re.test(hostname))) {
    throw new Error('Instance URL points to a restricted address');
  }
  return url;
}

async function get3CXToken(instanceUrl, apiKey, apiSecret) {
  validateInstanceUrl(instanceUrl);
  // 3CX v18+ uses /webclient/api/ endpoints with bearer token
  // Try API key auth first (3CX Connect / Cloud)
  const loginUrl = `${instanceUrl.replace(/\/$/, '')}/webclient/api/Login/GetAccessToken`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  let response;
  try {
    response = await fetch(loginUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        SecurityCode: apiKey,
        ...(apiSecret ? { Password: apiSecret } : {})
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`3CX auth failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.Token?.access_token || data.access_token || data.Token || data.token;
}

async function threecxApiCall(instanceUrl, token, endpoint) {
  const baseUrl = instanceUrl.replace(/\/$/, '');
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  let response;
  try {
    response = await fetch(`${baseUrl}/webclient/api${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      },
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') throw new Error(`3CX API timeout for ${endpoint}`);
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`3CX API error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

export async function sync3CX(body, user) {
  const supabase = getServiceSupabase();
  const { action, customer_id, mapping_id } = body;

  // ── Test Connection ──────────────────────────────────────────────
  if (action === 'test_connection') {
    const { instance_url, api_key, api_secret } = body;

    if (!instance_url || !api_key) {
      return { success: false, error: 'Instance URL and API key are required' };
    }

    try {
      const token = await get3CXToken(instance_url, api_key, api_secret);
      if (!token) {
        return { success: false, error: 'No token received from 3CX' };
      }

      // Try fetching system status or extension list to validate
      let extensionCount = 0;
      try {
        const extensions = await threecxApiCall(instance_url, token, '/ExtensionList');
        extensionCount = Array.isArray(extensions) ? extensions.length
          : extensions?.list ? extensions.list.length
          : 0;
      } catch {
        // Some 3CX versions use different endpoints
        try {
          const sysStatus = await threecxApiCall(instance_url, token, '/SystemStatus');
          extensionCount = sysStatus?.ExtensionsRegistered || sysStatus?.Extensions || 0;
        } catch {
          // Connection works but couldn't get extension count
        }
      }

      return {
        success: true,
        extensionCount,
        message: `Connected! Found ${extensionCount} extensions.`
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ── Sync Extensions for a Customer ───────────────────────────────
  if (action === 'sync_extensions') {
    if (!customer_id) {
      return { success: false, error: 'customer_id is required' };
    }

    // Get the mapping with credentials
    const { data: mapping, error: mapErr } = await supabase
      .from('threecx_mappings')
      .select('*')
      .eq('customer_id', customer_id)
      .single();

    if (mapErr || !mapping) {
      return { success: false, error: '3CX mapping not found for this customer' };
    }

    if (!mapping.instance_url || !mapping.api_key) {
      return { success: false, error: '3CX credentials not configured for this customer' };
    }

    try {
      const token = await get3CXToken(mapping.instance_url, mapping.api_key, mapping.api_secret);

      // Fetch extensions
      let extensions = [];
      try {
        const extResponse = await threecxApiCall(mapping.instance_url, token, '/ExtensionList');
        extensions = Array.isArray(extResponse) ? extResponse
          : extResponse?.list ? extResponse.list
          : [];
      } catch {
        // Try alternative endpoint
        try {
          const extResponse = await threecxApiCall(mapping.instance_url, token, '/extensions');
          extensions = Array.isArray(extResponse) ? extResponse
            : extResponse?.value ? extResponse.value
            : [];
        } catch (e) {
          return { success: false, error: `Failed to fetch extensions: ${e.message}` };
        }
      }

      // Categorize extensions
      const userExtensions = extensions.filter(ext => {
        const type = (ext.Type || ext.extensionType || ext.type || '').toLowerCase();
        return type === 'user' || type === '' || type === 'extension';
      });

      const ringGroups = extensions.filter(ext => {
        const type = (ext.Type || ext.extensionType || ext.type || '').toLowerCase();
        return type === 'ring group' || type === 'ringgroup';
      });

      const ivrMenus = extensions.filter(ext => {
        const type = (ext.Type || ext.extensionType || ext.type || '').toLowerCase();
        return type === 'ivr' || type === 'digital receptionist';
      });

      const queues = extensions.filter(ext => {
        const type = (ext.Type || ext.extensionType || ext.type || '').toLowerCase();
        return type === 'queue' || type === 'call queue';
      });

      // Build cached data
      const cachedData = {
        total_extensions: extensions.length,
        user_extensions: userExtensions.length,
        ring_groups: ringGroups.length,
        ivr_menus: ivrMenus.length,
        queues: queues.length,
        extensions: extensions.map(ext => ({
          number: ext.Number || ext.number || ext.Id || ext.id,
          name: ext.Name || ext.name || ext.DisplayName || ext.displayName || '',
          firstName: ext.FirstName || ext.firstName || '',
          lastName: ext.LastName || ext.lastName || '',
          email: ext.Email || ext.email || ext.EmailAddress || '',
          type: ext.Type || ext.extensionType || ext.type || 'User',
          status: ext.CurrentProfile || ext.Status || ext.status || 'Unknown',
          registered: ext.Registered !== undefined ? ext.Registered : ext.IsRegistered,
        })),
        synced_at: new Date().toISOString()
      };

      // Update mapping with cached data
      await supabase
        .from('threecx_mappings')
        .update({
          cached_data: cachedData,
          last_synced: new Date().toISOString(),
          updated_date: new Date().toISOString()
        })
        .eq('id', mapping.id);

      return {
        success: true,
        totalExtensions: extensions.length,
        userExtensions: userExtensions.length,
        ringGroups: ringGroups.length,
        ivrMenus: ivrMenus.length,
        queues: queues.length
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ── Sync All ─────────────────────────────────────────────────────
  if (action === 'sync_all') {
    const { data: allMappings, error } = await supabase
      .from('threecx_mappings')
      .select('*');

    if (error) {
      return { success: false, error: error.message };
    }

    let synced = 0;
    let failed = 0;
    const errors = [];

    for (const mapping of allMappings || []) {
      if (!mapping.instance_url || !mapping.api_key) {
        failed++;
        errors.push(`${mapping.customer_name}: No credentials`);
        continue;
      }

      try {
        const result = await sync3CX({
          action: 'sync_extensions',
          customer_id: mapping.customer_id
        }, user);

        if (result.success) {
          synced++;
        } else {
          failed++;
          errors.push(`${mapping.customer_name}: ${result.error}`);
        }
      } catch (e) {
        failed++;
        errors.push(`${mapping.customer_name}: ${e.message}`);
      }
    }

    return {
      success: true,
      synced,
      failed,
      total: (allMappings || []).length,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  return { success: false, error: `Unknown action: ${action}` };
}
