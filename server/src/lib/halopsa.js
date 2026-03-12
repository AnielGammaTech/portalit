/**
 * HaloPSA Service Module
 *
 * Shared authentication, configuration, and API helpers for all HaloPSA
 * integrations.  Credentials are resolved in order of priority:
 *
 *   1. Environment variables (HALOPSA_CLIENT_ID, HALOPSA_CLIENT_SECRET, …)
 *   2. Settings table row (halopsa_client_id, halopsa_client_secret, …)
 *
 * This eliminates the credential-fetch / token-fetch duplication that was
 * previously scattered across every individual sync function.
 */

import { getServiceSupabase } from './supabase.js';

// ── Token cache (simple in-memory, ~55 min TTL) ─────────────────────────

let cachedToken = null;
let tokenExpiresAt = 0;

function clearTokenCache() {
  cachedToken = null;
  tokenExpiresAt = 0;
}

// ── Configuration helpers ────────────────────────────────────────────────

/**
 * Resolve HaloPSA configuration from env vars first, then settings table.
 * Returns { clientId, clientSecret, authUrl, apiUrl, tenant, excludedIds }.
 * Throws if required fields are missing.
 */
export async function getHaloConfig() {
  // 1. Try environment variables
  const envConfig = {
    clientId: process.env.HALOPSA_CLIENT_ID,
    clientSecret: process.env.HALOPSA_CLIENT_SECRET,
    authUrl: process.env.HALOPSA_AUTH_URL,
    apiUrl: process.env.HALOPSA_API_URL,
    tenant: process.env.HALOPSA_TENANT || '',
    excludedIds: process.env.HALOPSA_EXCLUDED_IDS
      ? process.env.HALOPSA_EXCLUDED_IDS.split(',').map(id => id.trim())
      : [],
  };

  if (envConfig.clientId && envConfig.clientSecret && envConfig.authUrl && envConfig.apiUrl) {
    return envConfig;
  }

  // 2. Fall back to settings table
  const supabase = getServiceSupabase();
  const { data: settingsList } = await supabase.from('settings').select('*');
  const settings = (settingsList || [])[0];

  if (!settings) {
    throw Object.assign(new Error('HaloPSA is not configured. Add credentials via Integrations page or environment variables.'), { statusCode: 400 });
  }

  const dbConfig = {
    clientId: settings.halopsa_client_id,
    clientSecret: settings.halopsa_client_secret,
    authUrl: settings.halopsa_auth_url,
    apiUrl: settings.halopsa_api_url,
    tenant: settings.halopsa_tenant || '',
    excludedIds: settings.halopsa_excluded_ids
      ? settings.halopsa_excluded_ids.split(',').map(id => id.trim())
      : [],
  };

  if (!dbConfig.clientId || !dbConfig.clientSecret || !dbConfig.authUrl || !dbConfig.apiUrl) {
    throw Object.assign(new Error('HaloPSA credentials are incomplete. Please update the configuration.'), { statusCode: 400 });
  }

  return dbConfig;
}

/**
 * Returns true when at least one credential source has a valid-looking config.
 */
export async function isHaloConfigured() {
  try {
    await getHaloConfig();
    return true;
  } catch {
    return false;
  }
}

// ── Authentication ───────────────────────────────────────────────────────

/**
 * Obtain an OAuth2 access token (client_credentials grant).
 * Caches the token for ~55 minutes.
 */
export async function getHaloToken(config) {
  const cfg = config || await getHaloConfig();

  // Return cached token if still fresh
  if (cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken;
  }

  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    scope: 'all',
  });
  if (cfg.tenant) {
    params.set('tenant', cfg.tenant);
  }

  // HaloPSA token endpoint is at {authUrl}/token — auto-append if needed
  const tokenUrl = cfg.authUrl.endsWith('/token')
    ? cfg.authUrl
    : `${cfg.authUrl.replace(/\/$/, '')}/token`;

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    clearTokenCache();
    throw new Error(`HaloPSA auth failed (${response.status}): ${errorText}`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const text = await response.text();
    clearTokenCache();
    throw new Error(`HaloPSA auth returned unexpected content-type (${contentType}): ${text.slice(0, 200)}`);
  }

  const data = await response.json();
  cachedToken = data.access_token;
  // Token usually lasts 3600 s — cache for 55 min to be safe
  tokenExpiresAt = Date.now() + 55 * 60 * 1000;

  return cachedToken;
}

// ── API helpers ──────────────────────────────────────────────────────────

function buildUrl(baseUrl, path) {
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return `${base}${path}`;
}

/**
 * Generic GET request to HaloPSA API.
 * Includes a small delay for rate-limiting.
 */
export async function haloGet(path, config) {
  const cfg = config || await getHaloConfig();
  const token = await getHaloToken(cfg);
  const url = buildUrl(cfg.apiUrl, path);

  // Small delay for rate limiting
  await new Promise(r => setTimeout(r, 300));

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    // If 401, clear token cache and retry once
    if (response.status === 401) {
      clearTokenCache();
      const freshToken = await getHaloToken(cfg);
      const retry = await fetch(url, {
        headers: {
          Authorization: `Bearer ${freshToken}`,
          'Content-Type': 'application/json',
        },
      });
      if (!retry.ok) {
        const retryText = await retry.text();
        throw new Error(`HaloPSA API error (${path}): ${retry.status} — ${retryText}`);
      }
      return retry.json();
    }
    throw new Error(`HaloPSA API error (${path}): ${response.status} — ${errorText}`);
  }

  return response.json();
}

/**
 * Generic POST request to HaloPSA API.
 */
export async function haloPost(path, body, config) {
  const cfg = config || await getHaloConfig();
  const token = await getHaloToken(cfg);
  const url = buildUrl(cfg.apiUrl, path);

  await new Promise(r => setTimeout(r, 300));

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HaloPSA POST error (${path}): ${response.status} — ${errorText}`);
  }

  return response.json();
}

/**
 * Normalise HaloPSA list responses.
 * The API returns arrays, { clients: [] }, { records: [] }, etc.
 */
export function extractRecords(data, key) {
  if (Array.isArray(data)) return data;
  if (key && data[key]) return data[key];
  // Common HaloPSA wrapper keys
  for (const k of ['clients', 'records', 'users', 'Clients', 'Records', 'Users', 'invoices', 'tickets']) {
    if (Array.isArray(data[k])) return data[k];
  }
  return [];
}

/**
 * Map a HaloPSA client object to the PortalIT customers table shape.
 */
export function mapHaloClientToCustomer(client) {
  const addressParts = [
    client.address1 || client.Address1 || '',
    client.address2 || client.Address2 || '',
    client.city || client.City || '',
    client.state || client.State || '',
    client.postcode || client.Postcode || '',
    client.country || client.Country || '',
  ].filter(Boolean);

  return {
    name: client.name || client.Name || `Customer ${client.id}`,
    external_id: String(client.id),
    source: 'halopsa',
    status: !client.inactive ? 'active' : 'inactive',
    primary_contact: client.main_contact_name || client.primary_contact_name || client.PrimaryContactName || '',
    email: client.main_email_address || client.primary_contact_email || client.PrimaryContactEmail || client.email || '',
    phone: client.main_contact_phone || client.primary_contact_phone || client.PrimaryContactPhone || client.phonenumber || '',
    address: addressParts.join(', '),
    notes: client.notes || client.Notes || '',
  };
}

/**
 * Map a HaloPSA user object to the PortalIT contacts table shape.
 */
export function mapHaloUserToContact(haloUser, customerId) {
  return {
    customer_id: customerId,
    halopsa_id: String(haloUser.id),
    full_name: haloUser.name || `${haloUser.firstname || ''} ${haloUser.surname || ''}`.trim() || 'Unknown',
    email: haloUser.emailaddress || haloUser.email || '',
    phone: haloUser.phonenumber || haloUser.phone || '',
    title: haloUser.jobtitle || '',
    is_primary: haloUser.isprimarycontact || false,
  };
}
