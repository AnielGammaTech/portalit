import { getServiceSupabase } from '../lib/supabase.js';

const PAX8_API_BASE = 'https://api.pax8.com/v1';
const PAX8_TOKEN_URL = 'https://api.pax8.com/v1/token';

// ── Auth ────────────────────────────────────────────────────────────────

let cachedToken = null;
let tokenExpiresAt = 0;

async function getPax8Token() {
  // Return cached token if still valid (with 5-min buffer)
  if (cachedToken && Date.now() < tokenExpiresAt - 5 * 60 * 1000) {
    return cachedToken;
  }

  const clientId = process.env.PAX8_CLIENT_ID;
  const clientSecret = process.env.PAX8_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('PAX8_CLIENT_ID and PAX8_CLIENT_SECRET must be set');
  }

  const response = await fetch(PAX8_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials',
      audience: 'https://api.pax8.com',
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Pax8 token error ${response.status}: ${text}`);
  }

  const data = await response.json();
  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + (data.expires_in || 86400) * 1000;
  console.log('[Pax8] Token acquired, expires in', data.expires_in, 's');
  return cachedToken;
}

// ── API calls ───────────────────────────────────────────────────────────

async function pax8ApiCall(endpoint) {
  const token = await getPax8Token();
  const url = `${PAX8_API_BASE}${endpoint}`;
  console.log(`[Pax8] GET ${url}`);

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Pax8 API error ${response.status}: ${text}`);
  }

  return response.json();
}

/**
 * Paginate through a Pax8 endpoint.
 * Pax8 uses page (0-based) + size params.
 */
async function pax8Paginate(basePath, maxPages = 20) {
  const pageSize = 200;
  const allItems = [];

  for (let page = 0; page < maxPages; page++) {
    const sep = basePath.includes('?') ? '&' : '?';
    const data = await pax8ApiCall(`${basePath}${sep}page=${page}&size=${pageSize}`);

    const items = data.content || data.items || data.data || [];
    allItems.push(...items);

    // Stop if we got fewer than pageSize (last page)
    if (items.length < pageSize) break;
  }

  return allItems;
}

// ── Actions ─────────────────────────────────────────────────────────────

export async function syncPax8Subscriptions(body, _user) {
  const supabase = getServiceSupabase();
  const { action, customer_id } = body;

  // Test connection
  if (action === 'test_connection') {
    try {
      const data = await pax8ApiCall('/companies?page=0&size=5');
      const companies = data.content || data.items || data.data || [];
      return {
        success: true,
        message: `Connected! Found companies.`,
        sampleCount: companies.length,
      };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  // List Pax8 companies for mapping
  if (action === 'list_companies') {
    try {
      const companies = await pax8Paginate('/companies');
      return {
        success: true,
        companies: companies.map((c) => ({
          id: c.id,
          name: c.name || c.companyName || 'Unknown',
          city: c.city || '',
          status: c.status || 'active',
        })),
      };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  // Get cached data
  if (action === 'get_cached') {
    if (!customer_id) {
      const err = new Error('customer_id is required');
      err.statusCode = 400;
      throw err;
    }

    const { data: mappings } = await supabase
      .from('pax8_mappings')
      .select('*')
      .eq('customer_id', customer_id);

    if (!mappings || mappings.length === 0) {
      return { success: false, error: 'No Pax8 mapping found' };
    }

    const mapping = mappings[0];
    return {
      success: true,
      cached: true,
      last_synced: mapping.last_synced,
      ...(mapping.cached_data || {}),
    };
  }

  // Sync subscriptions for a specific customer
  if (action === 'sync_customer') {
    if (!customer_id) {
      const err = new Error('customer_id is required');
      err.statusCode = 400;
      throw err;
    }

    const { data: mappings } = await supabase
      .from('pax8_mappings')
      .select('*')
      .eq('customer_id', customer_id);

    if (!mappings || mappings.length === 0) {
      const err = new Error('No Pax8 mapping found for this customer');
      err.statusCode = 400;
      throw err;
    }

    const mapping = mappings[0];
    return await syncCompanySubscriptions(supabase, mapping);
  }

  // Sync all mapped customers
  if (action === 'sync_all') {
    const { data: allMappings } = await supabase
      .from('pax8_mappings')
      .select('*');

    let synced = 0;
    let errors = 0;

    for (const mapping of (allMappings || [])) {
      try {
        await syncCompanySubscriptions(supabase, mapping);
        synced++;
      } catch (e) {
        console.error(`[Pax8] Failed to sync mapping ${mapping.id}:`, e.message);
        errors++;
      }
    }

    return { success: true, synced, errors };
  }

  const err = new Error('Invalid action');
  err.statusCode = 400;
  throw err;
}

// ── Product name resolver ────────────────────────────────────────────────

// Cache product names across syncs to avoid repeated lookups
// Stores { name, ts } with 24h TTL
const productNameCache = new Map();
const PRODUCT_NAME_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

async function resolveProductName(productId) {
  if (!productId) return 'Unknown';
  const cached = productNameCache.get(productId);
  if (cached) {
    if (Date.now() - cached.ts <= PRODUCT_NAME_CACHE_TTL_MS) {
      return cached.name;
    }
    productNameCache.delete(productId);
  }

  try {
    const product = await pax8ApiCall(`/products/${productId}`);
    const name = product.name || product.productName || productId;
    productNameCache.set(productId, { name, ts: Date.now() });
    return name;
  } catch (err) {
    console.log(`[Pax8] Could not resolve product ${productId}: ${err.message}`);
    productNameCache.set(productId, { name: productId, ts: Date.now() }); // cache the miss too
    return productId;
  }
}

// ── Sync helper ─────────────────────────────────────────────────────────

async function syncCompanySubscriptions(supabase, mapping) {
  try {
    const subscriptions = await pax8Paginate(
      `/subscriptions?companyId=${mapping.pax8_company_id}`
    );

    // Group subscriptions by product for a clean summary
    const activeSubscriptions = subscriptions.filter(
      (s) => s.status === 'Active' || s.status === 'active'
    );

    // Collect unique product IDs that need name resolution
    const productIds = [...new Set(
      activeSubscriptions
        .filter(s => !s.productName && !s.product?.name && s.productId)
        .map(s => s.productId)
    )];

    // Resolve product names in batches of 5
    const CONCURRENCY = 5;
    for (let i = 0; i < productIds.length; i += CONCURRENCY) {
      const batch = productIds.slice(i, i + CONCURRENCY);
      await Promise.allSettled(batch.map(id => resolveProductName(id)));
    }

    const byProduct = {};
    for (const sub of activeSubscriptions) {
      const productName = sub.productName || sub.product?.name
        || productNameCache.get(sub.productId)?.name || sub.productId || 'Unknown';
      if (!byProduct[productName]) {
        byProduct[productName] = { name: productName, quantity: 0, subscriptions: [] };
      }
      byProduct[productName].quantity += sub.quantity || 1;
      byProduct[productName].subscriptions.push({
        id: sub.id,
        quantity: sub.quantity || 1,
        billingTerm: sub.billingTerm || '',
        price: sub.price || 0,
        startDate: sub.startDate || sub.createdDate || null,
        status: sub.status,
      });
    }

    const products = Object.values(byProduct);
    const totalSubscriptions = activeSubscriptions.length;
    const totalQuantity = activeSubscriptions.reduce((s, sub) => s + (sub.quantity || 1), 0);

    const cacheData = {
      success: true,
      totalSubscriptions,
      totalQuantity,
      products,
      period: 'current',
    };

    await supabase
      .from('pax8_mappings')
      .update({
        cached_data: cacheData,
        last_synced: new Date().toISOString(),
      })
      .eq('id', mapping.id);

    return cacheData;
  } catch (e) {
    return { success: false, error: e.message };
  }
}
