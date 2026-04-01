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

  const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };

  // Try auth URL as-is first (matches QuoteIT pattern)
  let authUrl = cfg.authUrl;
  let authRes = await fetch(authUrl, { method: 'POST', headers, body: params.toString() });

  // If we get HTML back (login page), retry with /token suffix
  const ct = authRes.headers.get('content-type') || '';
  const isHtml = ct.includes('text/html') || ct.includes('application/xhtml');
  if ((!authRes.ok || isHtml) && !authUrl.endsWith('/token')) {
    const retryUrl = authUrl.endsWith('/') ? `${authUrl}token` : `${authUrl}/token`;
    const retryRes = await fetch(retryUrl, { method: 'POST', headers, body: params.toString() });
    if (retryRes.ok) {
      authRes = retryRes;
    }
  }

  if (!authRes.ok) {
    const errText = await authRes.text();
    clearTokenCache();
    throw new Error(`HaloPSA auth failed (${authRes.status}): ${errText.substring(0, 300)}`);
  }

  const data = await authRes.json();
  if (!data.access_token) {
    clearTokenCache();
    throw new Error('HaloPSA returned no access_token');
  }
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
 * Validates that a HaloPSA ID contains only alphanumeric characters, hyphens,
 * and underscores. Rejects any value that could manipulate a URL path or query
 * string (e.g. "../", "?foo=bar", "%2F", etc.).
 *
 * Throws a 400 error when the ID is invalid so callers can propagate it as a
 * bad-request response.
 *
 * @param {unknown} id - The raw user-supplied identifier.
 * @param {string}  [label='id'] - Field name used in the error message.
 * @returns {string} The validated ID as a trimmed string.
 */
export function validateHaloId(id, label = 'id') {
  const str = String(id ?? '').trim();
  if (!str || !/^[A-Za-z0-9_-]+$/.test(str)) {
    throw Object.assign(
      new Error(`Invalid ${label}: must contain only alphanumeric characters, hyphens, or underscores.`),
      { statusCode: 400 },
    );
  }
  return str;
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
  for (const k of ['clients', 'records', 'users', 'contracts', 'sites', 'Clients', 'Records', 'Users', 'Contracts', 'Sites', 'invoices', 'tickets']) {
    if (Array.isArray(data[k])) return data[k];
  }
  return [];
}

/**
 * Map a HaloPSA client object to the PortalIT customers table shape.
 * Optionally accepts a site object for address resolution (HaloPSA stores
 * addresses on Sites, not on Clients).
 */
export function mapHaloClientToCustomer(client, site) {
  // Try multiple address sources in priority order
  const addressSources = [
    site?.delivery_address,
    site?.invoice_address,
    site?.postal_address,
    client?.delivery_address,
    client?.invoice_address,
    client?.postal_address,
    // Some HaloPSA instances nest it under client_to_site or toplevel
    client?.client_to_site?.delivery_address,
    client?.toplevel?.delivery_address,
  ].filter(Boolean);

  const addr = addressSources[0] || {};
  const src = site || client || {};

  function pick(addrKey, ...fallbackKeys) {
    // Try all address source objects first
    for (const addrObj of addressSources) {
      if (addrObj[addrKey] && String(addrObj[addrKey]).trim()) return String(addrObj[addrKey]).trim();
    }
    // Then try top-level site and client fields
    for (const key of fallbackKeys) {
      for (const obj of [site, client].filter(Boolean)) {
        if (obj[key] && String(obj[key]).trim()) return String(obj[key]).trim();
      }
    }
    return '';
  }

  const line1 = pick('line1', 'address1', 'Address1', 'street', 'Street', 'addressline1', 'AddressLine1');
  const line2 = pick('line2', 'address2', 'Address2', 'addressline2', 'AddressLine2');
  const city = pick('line3', 'city', 'City', 'town', 'Town');
  const stateCountry = pick('line4', 'state', 'State', 'county', 'County', 'region', 'Region');
  const zip = pick('postcode', 'Postcode', 'zip', 'Zip', 'postal_code', 'PostalCode', 'zipcode', 'ZipCode');

  const addressParts = [line1, line2, city, stateCountry, zip].filter(Boolean);

  if (addressParts.length === 0) {
    console.warn(`[HaloPSA] No address found for client ${client.id} (${client.name || 'unknown'}). Site provided: ${!!site}`);
  }

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
 * Fetch HaloPSA site details (with delivery_address) for a list of site IDs.
 * Returns a map of client_id → site detail object.
 *
 * HaloPSA's bulk Site listing does NOT include address data — only the
 * individual Site/{id} endpoint returns the nested `delivery_address` object.
 * We batch-fetch site details in parallel (5 at a time) for efficiency.
 */
export async function fetchSitesByClientId(config, clients) {
  const cfg = config || await getHaloConfig();
  const siteMap = {};

  // If clients are provided, fetch individual sites by main_site_id (includes address)
  if (clients && clients.length > 0) {
    // Collect unique site IDs from clients
    const siteEntries = [];
    const clientsWithoutSite = [];
    for (const client of clients) {
      const siteId = client.main_site_id || client.toplevel_id;
      if (siteId && siteId > 0) {
        siteEntries.push({ clientId: String(client.id), siteId });
      } else {
        clientsWithoutSite.push(client);
      }
    }
    if (clientsWithoutSite.length > 0) {
      console.log(`[HaloPSA] ${clientsWithoutSite.length} clients have no main_site_id — will try Site?client_id lookup`);
    }

    console.log(`[HaloPSA] Fetching ${siteEntries.length} individual site details for addresses...`);

    // Deduplicate by siteId
    const uniqueSiteIds = [...new Set(siteEntries.map(e => e.siteId))];
    const siteDetailsMap = {};
    let fetched = 0;

    // Batch fetch 5 at a time to respect rate limits
    for (let i = 0; i < uniqueSiteIds.length; i += 5) {
      const batch = uniqueSiteIds.slice(i, i + 5);
      const results = await Promise.allSettled(
        batch.map(async (siteId) => {
          const data = await haloGet(`Site/${siteId}`, cfg);
          return { siteId, data };
        })
      );
      for (const result of results) {
        if (result.status === 'fulfilled') {
          siteDetailsMap[result.value.siteId] = result.value.data;
          fetched++;
        }
      }
    }

    console.log(`[HaloPSA] Fetched ${fetched}/${uniqueSiteIds.length} site details`);

    // Map client_id → site detail
    for (const entry of siteEntries) {
      const detail = siteDetailsMap[entry.siteId];
      if (detail && !siteMap[entry.clientId]) {
        siteMap[entry.clientId] = detail;
      }
    }

    // Fallback: for clients without main_site_id, try fetching sites by client_id
    if (clientsWithoutSite.length > 0) {
      for (let i = 0; i < clientsWithoutSite.length; i += 5) {
        const batch = clientsWithoutSite.slice(i, i + 5);
        const results = await Promise.allSettled(
          batch.map(async (client) => {
            const data = await haloGet(`Site?client_id=${client.id}&page_size=1`, cfg);
            const sites = extractRecords(data, 'sites');
            if (sites.length > 0) {
              // Fetch full site detail (bulk list doesn't include delivery_address)
              const detail = await haloGet(`Site/${sites[0].id}`, cfg);
              return { clientId: String(client.id), data: detail };
            }
            return null;
          })
        );
        for (const r of results) {
          if (r.status === 'fulfilled' && r.value) {
            siteMap[r.value.clientId] = r.value.data;
          }
        }
      }
    }

    const withAddr = Object.values(siteMap).filter(s =>
      s.delivery_address?.line1 || s.invoice_address?.line1 || s.postal_address?.line1
    ).length;
    console.log(`[HaloPSA] ${withAddr}/${Object.keys(siteMap).length} sites have addresses`);

    return siteMap;
  }

  // Fallback: bulk fetch (no address data, for backward compat)
  let page = 1;
  const pageSize = 1000;

  while (true) {
    try {
      const data = await haloGet(
        `Site?pageinate=true&page_size=${pageSize}&page_no=${page}`,
        cfg,
      );
      const sites = extractRecords(data, 'sites');
      if (!sites.length) break;

      for (const site of sites) {
        const clientId = String(site.client_id || site.clientid || site.toplevel_id || '');
        if (clientId && !siteMap[clientId]) {
          siteMap[clientId] = site;
        }
      }

      const total = data.record_count || data.recordCount || 0;
      console.log(`[HaloPSA] Sites page ${page}: ${sites.length} sites (total map: ${Object.keys(siteMap).length})`);
      if (sites.length < pageSize) break;
      if (total > 0 && Object.keys(siteMap).length >= total) break;
      if (page > 20) break;
      page++;
    } catch (err) {
      console.error('[HaloPSA] Failed to fetch sites:', err.message);
      break;
    }
  }

  return siteMap;
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
    source: 'halopsa',
    is_primary: haloUser.isprimarycontact || false,
  };
}
