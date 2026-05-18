import { Router } from 'express';
import { getServiceSupabase } from '../lib/supabase.js';

const router = Router();

function cleanText(value, fallback = '') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function normalizeLimit(value, fallback = 100, max = 1000) {
  const parsed = Number.parseInt(String(value || ''), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

function getApiKey(req) {
  const direct = req.headers['x-gammastack-key'] || req.headers['x-portalit-key'];
  if (direct) return cleanText(Array.isArray(direct) ? direct[0] : direct);
  const auth = cleanText(req.headers.authorization);
  if (auth.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim();
  return '';
}

function getEnvApiKeys() {
  return [
    process.env.PORTALIT_EXTERNAL_API_KEY,
    process.env.GAMMASTACK_EXTERNAL_API_KEY,
    process.env.GAMMASTACK_API_KEY,
  ]
    .map((value) => cleanText(value))
    .filter(Boolean);
}

async function requireExternalApiKey(req, res, next) {
  const key = getApiKey(req);
  if (!key) return res.status(401).json({ success: false, error: 'PortalIT API key required' });

  try {
    if (getEnvApiKeys().includes(key)) {
      req.externalUser = {
        id: 'env:portalit-external-api',
        email: 'quoteit-sync@gamma.tech',
        role: 'service',
        full_name: 'QuoteIT Sync',
      };
      return next();
    }

    const supabase = getServiceSupabase();
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, role, full_name, gammastack_api_key')
      .eq('gammastack_api_key', key)
      .maybeSingle();

    if (error) throw error;
    if (!user) return res.status(401).json({ success: false, error: 'Invalid PortalIT API key' });

    req.externalUser = user;
    next();
  } catch (err) {
    next(err);
  }
}

function isOpenStatus(status) {
  const s = cleanText(status).toLowerCase();
  return ['new', 'open', 'in_progress', 'pending', 'active'].includes(s);
}

function isClosedStatus(status) {
  const s = cleanText(status).toLowerCase();
  return ['closed', 'resolved', 'completed', 'cancelled', 'canceled'].includes(s);
}

function deviceIsOnline(device) {
  const status = cleanText(device.status || device.online_status).toLowerCase();
  return status === 'online' || status === 'active' || status === 'connected';
}

function customerShape(customer) {
  if (!customer) return null;
  return {
    id: customer.id,
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
    address: customer.address,
    status: customer.status,
    external_id: customer.external_id,
    halo_id: customer.source === 'halopsa' ? customer.external_id : null,
    source: customer.source,
    primary_contact: customer.primary_contact,
    logo_url: customer.logo_url,
    updated_date: customer.updated_date,
  };
}

async function findCustomer({ id, haloId, name }) {
  const supabase = getServiceSupabase();

  if (id) {
    const { data, error } = await supabase.from('customers').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    if (data) return data;
  }

  if (haloId) {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('source', 'halopsa')
      .eq('external_id', String(haloId))
      .maybeSingle();
    if (error) throw error;
    if (data) return data;
  }

  if (name) {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .ilike('name', cleanText(name))
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (data) return data;
  }

  return null;
}

function safeJson(value, fallback = {}) {
  if (!value) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function normalizeQuote(quote) {
  const meta = safeJson(quote.notes);
  return {
    ...quote,
    title: meta.title || quote.quote_number || 'Quote',
    public_url: meta.public_url || null,
    quoteit_api_url: meta.quoteit_api_url || null,
    date_issued: meta.date_issued || null,
    sent_at: meta.sent_at || null,
    viewed_at: meta.viewed_at || null,
    accepted_at: meta.accepted_at || null,
    declined_at: meta.declined_at || null,
    change_request_notes: meta.change_request_notes || null,
    sales_person: meta.sales_person || null,
    contact: meta.contact || null,
    metadata: meta,
  };
}

function summarizeSnapshot({ devices, tickets, recurringBills, recurringLineItems, saasLicenses, quotes }) {
  const openTickets = tickets.filter((ticket) => isOpenStatus(ticket.status));
  const closedTickets = tickets.filter((ticket) => isClosedStatus(ticket.status));
  const onlineDevices = devices.filter(deviceIsOnline);
  const servers = devices.filter((device) => cleanText(device.device_type).toLowerCase().includes('server'));
  const workstations = devices.filter((device) => !cleanText(device.device_type).toLowerCase().includes('server'));
  const monthlyServices = recurringBills.filter((bill) => cleanText(bill.status, 'active').toLowerCase() === 'active');
  const recurringMonthly = monthlyServices.reduce((sum, bill) => sum + (Number(bill.amount) || 0), 0);
  const lineMonthly = recurringLineItems.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
  const activeSaas = saasLicenses.filter((license) => cleanText(license.status, 'active').toLowerCase() === 'active');

  return {
    devices: {
      total: devices.length,
      online: onlineDevices.length,
      offline: Math.max(0, devices.length - onlineDevices.length),
      servers: servers.length,
      workstations: workstations.length,
    },
    tickets: {
      total: tickets.length,
      open: openTickets.length,
      closed: closedTickets.length,
    },
    services: {
      recurring_bills: recurringBills.length,
      recurring_line_items: recurringLineItems.length,
      monthly_total: recurringMonthly || lineMonthly,
    },
    saas: {
      apps: activeSaas.length,
      licenses: activeSaas.reduce((sum, license) => sum + (Number(license.quantity) || 0), 0),
      monthly_total: activeSaas.reduce((sum, license) => sum + (Number(license.total_cost) || 0), 0),
      assigned_users: activeSaas.reduce((sum, license) => sum + (Number(license.assigned_users) || 0), 0),
    },
    quotes: {
      total: quotes.length,
      open: quotes.filter((quote) => ['sent', 'viewed', 'changes_requested'].includes(cleanText(quote.status).toLowerCase())).length,
      accepted: quotes.filter((quote) => cleanText(quote.status).toLowerCase() === 'accepted').length,
      declined: quotes.filter((quote) => cleanText(quote.status).toLowerCase() === 'declined').length,
      amount: quotes.reduce((sum, quote) => sum + (Number(quote.amount) || 0), 0),
    },
  };
}

async function buildCustomerSnapshot(customer) {
  const supabase = getServiceSupabase();
  const customerId = customer.id;

  const [
    contactsRes,
    devicesRes,
    ticketsRes,
    contractsRes,
    recurringBillsRes,
    saasRes,
    quotesRes,
    syncLogsRes,
  ] = await Promise.all([
    supabase.from('contacts').select('*').eq('customer_id', customerId).order('full_name', { ascending: true }),
    supabase.from('devices').select('*').eq('customer_id', customerId).order('hostname', { ascending: true }),
    supabase.from('tickets').select('*').eq('customer_id', customerId).order('created_date', { ascending: false }).limit(250),
    supabase.from('contracts').select('*').eq('customer_id', customerId).order('updated_date', { ascending: false }).limit(100),
    supabase.from('recurring_bills').select('*').eq('customer_id', customerId).order('name', { ascending: true }),
    supabase.from('saas_licenses').select('*').eq('customer_id', customerId).order('application_name', { ascending: true }),
    supabase.from('quotes').select('*').eq('customer_id', customerId).neq('status', 'draft').order('created_date', { ascending: false }).limit(250),
    supabase.from('sync_logs').select('*').order('completed_at', { ascending: false }).limit(25),
  ]);

  for (const result of [contactsRes, devicesRes, ticketsRes, contractsRes, recurringBillsRes, saasRes, quotesRes, syncLogsRes]) {
    if (result.error) throw result.error;
  }

  const recurringBills = recurringBillsRes.data || [];
  const billIds = recurringBills.map((bill) => bill.id).filter(Boolean);
  let recurringLineItems = [];
  if (billIds.length > 0) {
    const { data, error } = await supabase
      .from('recurring_bill_line_items')
      .select('*')
      .in('recurring_bill_id', billIds)
      .order('description', { ascending: true });
    if (error) throw error;
    recurringLineItems = data || [];
  }

  const recurringLineItemsByBill = recurringLineItems.reduce((map, item) => {
    const key = item.recurring_bill_id;
    if (!map[key]) map[key] = [];
    map[key].push(item);
    return map;
  }, {});

  const services = recurringBills.map((bill) => ({
    ...bill,
    line_items: recurringLineItemsByBill[bill.id] || [],
  }));

  const devices = devicesRes.data || [];
  const tickets = ticketsRes.data || [];
  const saasLicenses = saasRes.data || [];
  const quotes = (quotesRes.data || []).map(normalizeQuote);
  const quoteIds = quotes.map((quote) => quote.id).filter(Boolean);
  let quoteItems = [];
  if (quoteIds.length > 0) {
    const { data, error } = await supabase
      .from('quote_items')
      .select('*')
      .in('quote_id', quoteIds)
      .order('created_date', { ascending: true });
    if (error) throw error;
    quoteItems = data || [];
  }

  return {
    success: true,
    generated_at: new Date().toISOString(),
    customer: customerShape(customer),
    contacts: contactsRes.data || [],
    devices,
    tickets,
    contracts: contractsRes.data || [],
    services,
    quotes,
    quote_items: quoteItems,
    recurring_bills: recurringBills,
    recurring_bill_line_items: recurringLineItems,
    saas_licenses: saasLicenses,
    sync_logs: syncLogsRes.data || [],
    metrics: summarizeSnapshot({
      devices,
      tickets,
      recurringBills,
      recurringLineItems,
      saasLicenses,
      quotes,
    }),
  };
}

function serializeQuoteNotes(quote) {
  return JSON.stringify({
    title: quote.title || quote.name || quote.quote_number || quote.number || 'Quote',
    public_url: quote.public_url || null,
    quoteit_api_url: quote.quoteit_api_url || null,
    date_issued: quote.date_issued || quote.quote_date || null,
    sent_at: quote.sent_at || null,
    viewed_at: quote.viewed_at || null,
    accepted_at: quote.accepted_at || null,
    accepted_by_name: quote.accepted_by_name || null,
    declined_at: quote.declined_at || null,
    declined_by_name: quote.declined_by_name || null,
    change_request_notes: quote.change_request_notes || null,
    sales_person: quote.sales_person || null,
    contact: quote.contact || null,
    subtotal_one_time: Number(quote.subtotal_one_time) || 0,
    subtotal_mrr: Number(quote.subtotal_mrr) || 0,
    total_tax: Number(quote.total_tax) || 0,
    synced_at: new Date().toISOString(),
  });
}

async function upsertQuoteForCustomer(customerId, quote, items = []) {
  const supabase = getServiceSupabase();
  const externalId = cleanText(quote.external_id || quote.id);
  if (!externalId) throw new Error('Quote external_id is required');

  const payload = {
    customer_id: customerId,
    quote_number: cleanText(quote.quote_number || quote.number, externalId.slice(0, 8)),
    status: cleanText(quote.status, 'sent'),
    amount: Number(quote.amount ?? quote.total_amount ?? quote.total ?? 0) || 0,
    valid_until: quote.valid_until || quote.expiry_date || null,
    external_id: externalId,
    source: 'quoteit',
    notes: serializeQuoteNotes(quote),
    updated_date: new Date().toISOString(),
  };

  const { data: existing, error: findErr } = await supabase
    .from('quotes')
    .select('id')
    .eq('source', 'quoteit')
    .eq('external_id', externalId)
    .limit(1)
    .maybeSingle();
  if (findErr) throw findErr;

  let portalQuote;
  if (existing?.id) {
    const { data, error } = await supabase
      .from('quotes')
      .update(payload)
      .eq('id', existing.id)
      .select()
      .single();
    if (error) throw error;
    portalQuote = data;
    await supabase.from('quote_items').delete().eq('quote_id', existing.id);
  } else {
    const { data, error } = await supabase
      .from('quotes')
      .insert({ ...payload, created_date: new Date().toISOString() })
      .select()
      .single();
    if (error) throw error;
    portalQuote = data;
  }

  const cleanItems = (items || []).map((item) => ({
    quote_id: portalQuote.id,
    description: cleanText(item.description || item.name, 'Quote item'),
    quantity: Number(item.quantity) || 1,
    unit_price: Number(item.unit_price ?? item.price ?? 0) || 0,
    total: Number(item.total ?? item.total_price ?? 0) || 0,
  }));

  if (cleanItems.length > 0) {
    const { error } = await supabase.from('quote_items').insert(cleanItems);
    if (error) throw error;
  }

  return normalizeQuote(portalQuote);
}

router.use(requireExternalApiKey);

router.get('/customers', async (req, res, next) => {
  try {
    const supabase = getServiceSupabase();
    const limit = normalizeLimit(req.query.limit, 100, 1000);
    const search = cleanText(req.query.search);

    let query = supabase
      .from('customers')
      .select('id,name,email,phone,address,status,external_id,source,primary_contact,logo_url,updated_date')
      .order('name', { ascending: true })
      .limit(limit);

    if (search) query = query.ilike('name', `%${search}%`);

    const { data, error } = await query;
    if (error) throw error;

    const customers = (data || []).map(customerShape);
    return res.json({ success: true, count: customers.length, customers });
  } catch (err) {
    next(err);
  }
});

router.get('/customers/lookup', async (req, res, next) => {
  try {
    const customer = await findCustomer({
      id: cleanText(req.query.id),
      haloId: cleanText(req.query.halo_id || req.query.external_id),
      name: cleanText(req.query.name),
    });

    if (!customer) return res.status(404).json({ success: false, error: 'Customer not found' });
    return res.json({ success: true, customer: customerShape(customer) });
  } catch (err) {
    next(err);
  }
});

router.get('/customers/:id/snapshot', async (req, res, next) => {
  try {
    const customer = await findCustomer({ id: req.params.id });
    if (!customer) return res.status(404).json({ success: false, error: 'Customer not found' });
    return res.json(await buildCustomerSnapshot(customer));
  } catch (err) {
    next(err);
  }
});

router.post('/customers/:id/quotes/upsert', async (req, res, next) => {
  try {
    const customer = await findCustomer({ id: req.params.id });
    if (!customer) return res.status(404).json({ success: false, error: 'Customer not found' });

    const quote = req.body?.quote || req.body;
    const items = req.body?.items || [];
    if (!quote) return res.status(400).json({ success: false, error: 'Quote payload is required' });

    const portalQuote = await upsertQuoteForCustomer(customer.id, quote, items);
    return res.json({ success: true, quote: portalQuote });
  } catch (err) {
    next(err);
  }
});

export { router as externalRouter };
