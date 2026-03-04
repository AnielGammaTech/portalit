import { getServiceSupabase } from '../lib/supabase.js';

const DARKWEB_BASE_URL = 'https://secure.darkwebid.com';

function getDarkWebIDAuth() {
  const username = process.env.DARKWEBID_USERNAME;
  const password = process.env.DARKWEBID_PASSWORD;

  if (!username || !password) {
    throw new Error('Dark Web ID credentials not configured');
  }

  return 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');
}

async function fetchCompromises(organizationUuid, authHeader) {
  const response = await fetch(
    `${DARKWEB_BASE_URL}/api/compromises/organization/${organizationUuid}.json`,
    {
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/json'
      }
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Dark Web ID API error: ${response.status} - ${text}`);
  }

  return response.json();
}

export async function syncDarkWebID(body, user) {
  const supabase = getServiceSupabase();
  const { action, customer_id } = body;
  const authHeader = getDarkWebIDAuth();

  if (action === 'test_connection') {
    // First get our outgoing IP
    let outgoingIP = 'unknown';
    try {
      const ipResponse = await fetch('https://api.ipify.org?format=json');
      const ipData = await ipResponse.json();
      outgoingIP = ipData.ip;
    } catch (e) {
      // ignore
    }

    // Test the API connection
    try {
      const response = await fetch(`${DARKWEB_BASE_URL}/api/organizations.json`, {
        headers: {
          'Authorization': authHeader,
          'Accept': 'application/json'
        }
      });

      const text = await response.text();

      if (!response.ok) {
        return {
          success: false,
          error: `API returned ${response.status}`,
          outgoing_ip: outgoingIP,
          hint: 'Make sure this IP is whitelisted in Dark Web ID settings'
        };
      }

      try {
        const data = JSON.parse(text);
        return {
          success: true,
          organizations: data,
          outgoing_ip: outgoingIP
        };
      } catch (parseError) {
        const preview = text.substring(0, 500);
        return {
          success: false,
          error: 'Received HTML instead of JSON - likely not authenticated',
          outgoing_ip: outgoingIP,
          response_preview: preview,
          hint: 'Make sure this IP is whitelisted in Dark Web ID settings and API access is enabled for your user'
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
        outgoing_ip: outgoingIP
      };
    }
  }

  if (action === 'list_organizations') {
    const response = await fetch(`${DARKWEB_BASE_URL}/api/organizations.json`, {
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch organizations: ${response.status}`);
    }

    const organizations = await response.json();
    return { success: true, organizations };
  }

  if (action === 'sync_customer') {
    if (!customer_id) {
      const err = new Error('customer_id required');
      err.statusCode = 400;
      throw err;
    }

    // Get the mapping for this customer
    const { data: mappings } = await supabase
      .from('dark_web_id_mappings')
      .select('*')
      .eq('customer_id', customer_id);

    if (!mappings || mappings.length === 0) {
      const err = new Error('No Dark Web ID mapping found for this customer');
      err.statusCode = 404;
      throw err;
    }

    const mapping = mappings[0];
    const compromises = await fetchCompromises(mapping.darkweb_organization_uuid, authHeader);

    // Get existing compromises for this customer
    const { data: existingCompromises } = await supabase
      .from('dark_web_compromises')
      .select('*')
      .eq('customer_id', customer_id);

    const existingIds = new Set((existingCompromises || []).map(c => c.darkweb_id));

    let synced = 0;
    let skipped = 0;

    const compromiseList = Array.isArray(compromises) ? compromises : (compromises.compromises || []);

    for (const compromise of compromiseList) {
      const compromiseId = compromise.id || compromise.uuid || `${compromise.email}-${compromise.source}`;

      if (existingIds.has(compromiseId)) {
        skipped++;
        continue;
      }

      const { error } = await supabase
        .from('dark_web_compromises')
        .insert({
          customer_id,
          darkweb_id: compromiseId,
          email: compromise.email || compromise.username,
          domain: compromise.domain,
          password: compromise.password,
          source: compromise.source || compromise.breach_name,
          breach_date: compromise.breach_date || compromise.published_date,
          discovered_date: compromise.discovered_date || new Date().toISOString().split('T')[0],
          status: 'new',
          severity: compromise.severity || 'medium'
        });

      if (error) {
        console.error(`Failed to insert compromise ${compromiseId}:`, error.message);
      }
      synced++;
    }

    // Update last sync time
    await supabase
      .from('dark_web_id_mappings')
      .update({ last_sync: new Date().toISOString() })
      .eq('id', mapping.id);

    return {
      success: true,
      synced,
      skipped,
      total: compromiseList.length
    };
  }

  const err = new Error('Invalid action');
  err.statusCode = 400;
  throw err;
}
