import { Router } from 'express';
import { requireAdmin, requireAuth } from '../middleware/auth.js';
import { getServiceSupabase } from '../lib/supabase.js';

const router = Router();

const MAPBOX_STYLES = new Set(['dark-v11', 'light-v11', 'streets-v12', 'outdoors-v12', 'satellite-v9']);
const DEFAULT_MAPBOX_STYLE = 'dark-v11';
const TEST_ADDRESS = '1600 Amphitheatre Parkway, Mountain View, CA';

async function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function cleanText(value, max = 500) {
  if (value == null) return '';
  return String(value).trim().slice(0, max);
}

function validateExternalUrl(value, label) {
  const raw = cleanText(value, 2048);
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw Object.assign(new Error(`${label} must be a valid URL`), { statusCode: 400 });
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw Object.assign(new Error(`${label} must use http or https`), { statusCode: 400 });
  }

  const hostname = parsed.hostname.toLowerCase();
  const blocked = [
    /^localhost$/,
    /^127\./,
    /^10\./,
    /^172\.(1[6-9]|2\d|3[01])\./,
    /^192\.168\./,
    /^169\.254\./,
    /^0\./,
    /^\[::1\]$/,
    /^::1$/,
    /^metadata\./,
    /\.internal$/,
  ];
  if (blocked.some(re => re.test(hostname))) {
    throw Object.assign(new Error(`${label} points to a restricted host`), { statusCode: 400 });
  }

  return parsed.toString().replace(/\/$/, '');
}

function validateMapboxToken(token) {
  const value = cleanText(token, 512);
  if (!value) return '';
  if (!/^pk\.[A-Za-z0-9._-]+$/.test(value)) {
    throw Object.assign(new Error('Mapbox token must be a public token that starts with pk.'), { statusCode: 400 });
  }
  return value;
}

function validateMapboxStyle(style) {
  const value = cleanText(style, 80) || DEFAULT_MAPBOX_STYLE;
  if (!MAPBOX_STYLES.has(value)) {
    throw Object.assign(new Error('Unsupported Mapbox style'), { statusCode: 400 });
  }
  return value;
}

function validateHaloExcludedIds(value) {
  const ids = cleanText(value, 2000);
  if (!/^[A-Za-z0-9_,\-\s]*$/.test(ids)) {
    throw Object.assign(new Error('Excluded HaloPSA IDs may only contain letters, numbers, commas, hyphens, underscores, and spaces'), { statusCode: 400 });
  }
  return ids;
}

async function getSettingsRow() {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from('settings')
    .select('*')
    .order('created_date', { ascending: true })
    .limit(1);

  if (error?.code === '42703' || error?.message?.includes('created_date')) {
    const fallback = await supabase
      .from('settings')
      .select('*')
      .limit(1);
    if (fallback.error) throw new Error(fallback.error.message);
    return { supabase, row: fallback.data?.[0] || null };
  }

  if (error) throw new Error(error.message);
  return { supabase, row: data?.[0] || null };
}

async function upsertSettings(updates) {
  const { supabase, row } = await getSettingsRow();
  if (row?.id) {
    const { data, error } = await supabase
      .from('settings')
      .update(updates)
      .eq('id', row.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  }

  const { data, error } = await supabase
    .from('settings')
    .insert(updates)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

function mapboxConfigFrom(row) {
  return {
    configured: Boolean(row?.mapbox_token || process.env.MAPBOX_TOKEN || process.env.VITE_MAPBOX_TOKEN),
    tokenConfigured: Boolean(row?.mapbox_token || process.env.MAPBOX_TOKEN || process.env.VITE_MAPBOX_TOKEN),
    style: row?.mapbox_style || DEFAULT_MAPBOX_STYLE,
    source: row?.mapbox_token ? 'settings' : (process.env.MAPBOX_TOKEN || process.env.VITE_MAPBOX_TOKEN ? 'environment' : null),
  };
}

function halopsaConfigFrom(row) {
  const envConfigured = Boolean(
    process.env.HALOPSA_CLIENT_ID &&
    process.env.HALOPSA_CLIENT_SECRET &&
    process.env.HALOPSA_AUTH_URL &&
    process.env.HALOPSA_API_URL
  );

  return {
    configured: envConfigured || Boolean(row?.halopsa_client_id && row?.halopsa_client_secret && row?.halopsa_auth_url && row?.halopsa_api_url),
    source: envConfigured ? 'environment' : (row?.halopsa_client_id ? 'settings' : null),
    hasClientId: envConfigured || Boolean(row?.halopsa_client_id),
    hasClientSecret: envConfigured || Boolean(row?.halopsa_client_secret),
    halopsa_tenant: process.env.HALOPSA_TENANT || row?.halopsa_tenant || '',
    halopsa_auth_url: process.env.HALOPSA_AUTH_URL || row?.halopsa_auth_url || '',
    halopsa_api_url: process.env.HALOPSA_API_URL || row?.halopsa_api_url || '',
    halopsa_excluded_ids: process.env.HALOPSA_EXCLUDED_IDS || row?.halopsa_excluded_ids || '',
  };
}

function publicThreecxMapping(row) {
  if (!row) return null;
  const { api_key: _apiKey, api_secret: _apiSecret, ...safeRow } = row;
  return {
    ...safeRow,
    hasApiKey: Boolean(row.api_key),
    hasApiSecret: Boolean(row.api_secret),
  };
}

async function getCustomerForMapping(supabase, customerId) {
  const id = cleanText(customerId, 120);
  if (!id) {
    throw Object.assign(new Error('customer_id is required'), { statusCode: 400 });
  }

  const { data, error } = await supabase
    .from('customers')
    .select('id, name')
    .eq('id', id)
    .single();

  if (error || !data) {
    throw Object.assign(new Error('Customer not found'), { statusCode: 404 });
  }
  return data;
}

async function getMapboxToken() {
  const { row } = await getSettingsRow();
  return row?.mapbox_token || process.env.MAPBOX_TOKEN || process.env.VITE_MAPBOX_TOKEN || '';
}

async function testMapboxToken(token, style = DEFAULT_MAPBOX_STYLE) {
  const encoded = encodeURIComponent(TEST_ADDRESS);
  const res = await fetchWithTimeout(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json?access_token=${encodeURIComponent(token)}&limit=1`,
    {},
    15000
  );
  if (!res.ok) {
    return { success: false, error: `Mapbox returned HTTP ${res.status}` };
  }

  const data = await res.json();
  const feature = data.features?.[0];
  if (!feature) {
    return { success: false, error: 'Mapbox returned no geocoding results' };
  }

  return {
    success: true,
    style,
    message: `Geocoded "${TEST_ADDRESS}" to [${feature.center[0].toFixed(4)}, ${feature.center[1].toFixed(4)}]`,
  };
}

async function geocodeAddress(address, token) {
  const encoded = encodeURIComponent(address);
  const res = await fetchWithTimeout(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json?access_token=${encodeURIComponent(token)}&limit=1`,
    {},
    15000
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data.features?.[0]?.center || null;
}

router.get('/config/:provider', requireAdmin, async (req, res, next) => {
  try {
    const { row } = await getSettingsRow();
    if (req.params.provider === 'mapbox') return res.json(mapboxConfigFrom(row));
    if (req.params.provider === 'halopsa') return res.json(halopsaConfigFrom(row));
    return res.status(404).json({ error: 'Unknown integration provider' });
  } catch (error) {
    next(error);
  }
});

router.patch('/config/:provider', requireAdmin, async (req, res, next) => {
  try {
    if (req.params.provider === 'mapbox') {
      const updates = {};
      if (Object.prototype.hasOwnProperty.call(req.body, 'token')) {
        updates.mapbox_token = validateMapboxToken(req.body.token);
      }
      if (Object.prototype.hasOwnProperty.call(req.body, 'style')) {
        updates.mapbox_style = validateMapboxStyle(req.body.style);
      }
      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: 'No supported Mapbox settings provided' });
      }
      const row = await upsertSettings(updates);
      return res.json(mapboxConfigFrom(row));
    }

    if (req.params.provider === 'halopsa') {
      const updates = {};
      const body = req.body || {};
      if (Object.prototype.hasOwnProperty.call(body, 'halopsa_client_id')) {
        updates.halopsa_client_id = cleanText(body.halopsa_client_id, 500);
      }
      if (Object.prototype.hasOwnProperty.call(body, 'halopsa_client_secret')) {
        updates.halopsa_client_secret = cleanText(body.halopsa_client_secret, 1000);
      }
      if (Object.prototype.hasOwnProperty.call(body, 'halopsa_tenant')) {
        updates.halopsa_tenant = cleanText(body.halopsa_tenant, 200);
      }
      if (Object.prototype.hasOwnProperty.call(body, 'halopsa_auth_url')) {
        updates.halopsa_auth_url = validateExternalUrl(body.halopsa_auth_url, 'HaloPSA auth URL');
      }
      if (Object.prototype.hasOwnProperty.call(body, 'halopsa_api_url')) {
        updates.halopsa_api_url = validateExternalUrl(body.halopsa_api_url, 'HaloPSA API URL');
      }
      if (Object.prototype.hasOwnProperty.call(body, 'halopsa_excluded_ids')) {
        updates.halopsa_excluded_ids = validateHaloExcludedIds(body.halopsa_excluded_ids);
      }
      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: 'No supported HaloPSA settings provided' });
      }
      const row = await upsertSettings(updates);
      return res.json(halopsaConfigFrom(row));
    }

    return res.status(404).json({ error: 'Unknown integration provider' });
  } catch (error) {
    next(error);
  }
});

router.get('/threecx/mappings', requireAuth, async (req, res, next) => {
  try {
    const supabase = getServiceSupabase();
    const requestedCustomerId = cleanText(req.query.customer_id, 120);
    const isStaff = req.user?.role === 'admin' || req.user?.role === 'sales';

    if (!isStaff && (!requestedCustomerId || requestedCustomerId !== req.user?.customer_id)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    let query = supabase
      .from('threecx_mappings')
      .select('*')
      .order('customer_name', { ascending: true });

    if (requestedCustomerId) {
      query = query.eq('customer_id', requestedCustomerId);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    res.json({ mappings: (data || []).map(publicThreecxMapping) });
  } catch (error) {
    next(error);
  }
});

router.post('/threecx/mappings', requireAdmin, async (req, res, next) => {
  try {
    const supabase = getServiceSupabase();
    const customer = await getCustomerForMapping(supabase, req.body?.customer_id);
    const apiKey = cleanText(req.body?.api_key, 1000);
    if (!apiKey) {
      return res.status(400).json({ error: 'api_key is required' });
    }

    const { data: existingRows, error: existingError } = await supabase
      .from('threecx_mappings')
      .select('id')
      .eq('customer_id', customer.id)
      .limit(1);
    if (existingError) throw new Error(existingError.message);
    if (existingRows?.length) {
      return res.status(409).json({ error: 'A 3CX mapping already exists for this customer' });
    }

    const payload = {
      customer_id: customer.id,
      customer_name: customer.name,
      instance_url: validateExternalUrl(req.body?.instance_url, '3CX instance URL'),
      instance_name: cleanText(req.body?.instance_name, 200) || customer.name,
      api_key: apiKey,
      api_secret: cleanText(req.body?.api_secret, 1000) || null,
    };

    const { data, error } = await supabase
      .from('threecx_mappings')
      .insert(payload)
      .select()
      .single();

    if (error) throw new Error(error.message);
    res.status(201).json({ mapping: publicThreecxMapping(data) });
  } catch (error) {
    next(error);
  }
});

router.patch('/threecx/mappings/:id', requireAdmin, async (req, res, next) => {
  try {
    const supabase = getServiceSupabase();
    const mappingId = cleanText(req.params.id, 120);
    const updates = {};

    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'customer_id')) {
      const customer = await getCustomerForMapping(supabase, req.body.customer_id);
      updates.customer_id = customer.id;
      updates.customer_name = customer.name;
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'instance_url')) {
      updates.instance_url = validateExternalUrl(req.body.instance_url, '3CX instance URL');
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'instance_name')) {
      updates.instance_name = cleanText(req.body.instance_name, 200);
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'api_key') && cleanText(req.body.api_key, 1000)) {
      updates.api_key = cleanText(req.body.api_key, 1000);
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'api_secret') && cleanText(req.body.api_secret, 1000)) {
      updates.api_secret = cleanText(req.body.api_secret, 1000);
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No supported 3CX mapping fields provided' });
    }

    if (updates.customer_id) {
      const { data: existingRows, error: existingError } = await supabase
        .from('threecx_mappings')
        .select('id')
        .eq('customer_id', updates.customer_id)
        .neq('id', mappingId)
        .limit(1);
      if (existingError) throw new Error(existingError.message);
      if (existingRows?.length) {
        return res.status(409).json({ error: 'A 3CX mapping already exists for this customer' });
      }
    }

    updates.updated_date = new Date().toISOString();

    const { data, error } = await supabase
      .from('threecx_mappings')
      .update(updates)
      .eq('id', mappingId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    res.json({ mapping: publicThreecxMapping(data) });
  } catch (error) {
    next(error);
  }
});

router.delete('/threecx/mappings/:id', requireAdmin, async (req, res, next) => {
  try {
    const supabase = getServiceSupabase();
    const mappingId = cleanText(req.params.id, 120);
    const { error } = await supabase
      .from('threecx_mappings')
      .delete()
      .eq('id', mappingId);

    if (error) throw new Error(error.message);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.post('/mapbox/test', requireAdmin, async (req, res, next) => {
  try {
    const requestedToken = cleanText(req.body?.token, 512);
    const token = requestedToken ? validateMapboxToken(requestedToken) : await getMapboxToken();
    const style = validateMapboxStyle(req.body?.style);
    if (!token) return res.status(400).json({ error: 'Mapbox token is not configured' });
    res.json(await testMapboxToken(token, style));
  } catch (error) {
    next(error);
  }
});

router.post('/mapbox/static', requireAuth, async (req, res, next) => {
  try {
    const token = await getMapboxToken();
    if (!token) return res.status(404).json({ error: 'Mapbox token is not configured' });

    const { row } = await getSettingsRow();
    const style = validateMapboxStyle(req.body?.style || row?.mapbox_style || DEFAULT_MAPBOX_STYLE);
    const addresses = Array.isArray(req.body?.addresses)
      ? req.body.addresses.map(a => cleanText(a, 500)).filter(Boolean).slice(0, 5)
      : [];

    if (addresses.length === 0) {
      return res.status(400).json({ error: 'At least one address is required' });
    }

    const coordinates = [];
    for (const address of addresses) {
      const coords = await geocodeAddress(address, token);
      if (coords) coordinates.push(coords);
    }

    if (coordinates.length === 0) {
      return res.status(404).json({ error: 'No mappable addresses found' });
    }

    const pins = coordinates.map(([lng, lat]) => `pin-s+f97316(${lng},${lat})`).join(',');
    const viewport = coordinates.length === 1 ? `${coordinates[0][0]},${coordinates[0][1]},13` : 'auto';
    const paddingParam = viewport === 'auto' ? '&padding=40' : '';
    const width = Math.min(Math.max(Number(req.body?.width) || 800, 200), 1280);
    const height = Math.min(Math.max(Number(req.body?.height) || 200, 120), 800);
    const mapUrl = `https://api.mapbox.com/styles/v1/mapbox/${style}/static/${pins}/${viewport}/${width}x${height}@2x?access_token=${encodeURIComponent(token)}${paddingParam}`;

    const mapRes = await fetchWithTimeout(mapUrl, {}, 20000);
    if (!mapRes.ok) {
      return res.status(mapRes.status).json({ error: 'Mapbox static image request failed' });
    }

    const contentType = mapRes.headers.get('content-type') || 'image/png';
    const buffer = Buffer.from(await mapRes.arrayBuffer());
    res.set('Content-Type', contentType);
    res.set('Cache-Control', 'private, max-age=3600');
    res.set('X-Content-Type-Options', 'nosniff');
    res.send(buffer);
  } catch (error) {
    next(error);
  }
});

export { router as integrationsRouter };
