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

async function getOutgoingIP() {
  try {
    const ipResponse = await fetch('https://api.ipify.org?format=json');
    const ipData = await ipResponse.json();
    return ipData.ip;
  } catch {
    return 'unknown';
  }
}

export async function syncDarkWebID(body, user) {
  const supabase = getServiceSupabase();
  const { action, customer_id } = body;

  // get_outgoing_ip: no credentials needed — just returns the server's outgoing IP
  if (action === 'get_outgoing_ip') {
    const outgoingIP = await getOutgoingIP();
    return { success: true, outgoing_ip: outgoingIP };
  }

  if (action === 'test_connection') {
    // Always fetch the outgoing IP first (no credentials needed)
    const outgoingIP = await getOutgoingIP();

    // Then try auth — return IP even if credentials are missing
    let authHeader;
    try {
      authHeader = getDarkWebIDAuth();
    } catch (credError) {
      return {
        success: false,
        error: credError.message,
        outgoing_ip: outgoingIP,
        hint: 'Set DARKWEBID_USERNAME and DARKWEBID_PASSWORD environment variables, then whitelist this IP in your Dark Web ID portal settings.',
      };
    }

    // Test the API connection
    try {
      const response = await fetch(`${DARKWEB_BASE_URL}/api/organizations.json`, {
        headers: {
          'Authorization': authHeader,
          'Accept': 'application/json',
        },
      });

      const text = await response.text();
      const contentType = response.headers.get('content-type') || '';
      const statusCode = response.status;

      if (!response.ok) {
        return {
          success: false,
          error: `API returned ${statusCode}: ${text.substring(0, 200)}`,
          outgoing_ip: outgoingIP,
          status_code: statusCode,
          content_type: contentType,
          hint: statusCode === 403
            ? 'IP not whitelisted — add this IP in Dark Web ID portal settings'
            : 'Make sure this IP is whitelisted in Dark Web ID settings',
        };
      }

      // If response is JSON, parse it
      if (contentType.includes('json')) {
        try {
          const data = JSON.parse(text);
          return {
            success: true,
            organizations: data,
            outgoing_ip: outgoingIP,
          };
        } catch {
          return {
            success: false,
            error: 'Invalid JSON in response',
            outgoing_ip: outgoingIP,
            response_preview: text.substring(0, 500),
          };
        }
      }

      // Got HTML back (login page) — try Drupal REST session login + cookie-based auth
      try {
        // Step 1: Try Drupal REST Services login endpoint (returns JSON with session info)
        const restLoginResponse = await fetch(`${DARKWEB_BASE_URL}/api/user/login.json`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({
            username: process.env.DARKWEBID_USERNAME,
            password: process.env.DARKWEBID_PASSWORD,
          }),
        });

        const restLoginText = await restLoginResponse.text();
        let sessionName = '';
        let sessionId = '';
        let csrfToken = '';

        // Try to parse REST login response
        try {
          const loginData = JSON.parse(restLoginText);
          sessionName = loginData.session_name || '';
          sessionId = loginData.sessid || '';
          csrfToken = loginData.token || '';
        } catch {
          // REST login didn't return JSON, try form-based login
        }

        // If REST login didn't work, try form-based login
        if (!sessionId) {
          const formLoginResponse = await fetch(`${DARKWEB_BASE_URL}/user/login`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: `name=${encodeURIComponent(process.env.DARKWEBID_USERNAME)}&pass=${encodeURIComponent(process.env.DARKWEBID_PASSWORD)}&form_id=user_login&op=Log+in`,
            redirect: 'manual',
          });

          // Extract cookies from raw headers
          const rawSetCookie = formLoginResponse.headers.get('set-cookie') || '';
          const allCookies = typeof formLoginResponse.headers.getSetCookie === 'function'
            ? formLoginResponse.headers.getSetCookie()
            : rawSetCookie.split(/,(?=\s*\w+=)/).filter(Boolean);

          const cookieParts = allCookies.map(c => c.split(';')[0].trim()).filter(Boolean);
          if (cookieParts.length > 0) {
            sessionId = cookieParts.join('; ');
          }
        }

        const cookieHeader = sessionId.includes('=') ? sessionId : (sessionName && sessionId ? `${sessionName}=${sessionId}` : '');

        if (!cookieHeader) {
          return {
            success: false,
            error: 'Could not obtain session from Dark Web ID',
            outgoing_ip: outgoingIP,
            login_status: restLoginResponse?.status,
            login_response_preview: restLoginText?.substring(0, 300),
            hint: 'Verify credentials are correct. Try logging into https://secure.darkwebid.com manually.',
          };
        }

        // Retry API call with session cookie + CSRF token
        const retryHeaders = {
          'Cookie': cookieHeader,
          'Accept': 'application/json',
        };
        if (csrfToken) {
          retryHeaders['X-CSRF-Token'] = csrfToken;
        }
        const retryResponse = await fetch(`${DARKWEB_BASE_URL}/api/organizations.json`, {
          headers: retryHeaders,
        });

        const retryText = await retryResponse.text();
        const retryContentType = retryResponse.headers.get('content-type') || '';

        if (retryContentType.includes('json') || retryText.trim().startsWith('[') || retryText.trim().startsWith('{')) {
          const data = JSON.parse(retryText);
          return {
            success: true,
            organizations: data,
            outgoing_ip: outgoingIP,
            auth_method: 'session_cookie',
          };
        }

        return {
          success: false,
          error: `Session auth also returned HTML (status ${retryResponse.status})`,
          outgoing_ip: outgoingIP,
          status_code: statusCode,
          content_type: contentType,
          response_preview: text.substring(0, 300),
          hint: 'Check that Web Services is enabled and IP is whitelisted in Dark Web ID portal',
        };
      } catch (sessionErr) {
        return {
          success: false,
          error: `Basic Auth returned HTML, session fallback failed: ${sessionErr.message}`,
          outgoing_ip: outgoingIP,
          status_code: statusCode,
          response_preview: text.substring(0, 300),
          hint: 'Check that Web Services is enabled and IP is whitelisted in Dark Web ID portal',
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
        outgoing_ip: outgoingIP,
      };
    }
  }

  // All other actions require credentials
  const authHeader = getDarkWebIDAuth();

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
          password_exposed: !!compromise.password,
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
