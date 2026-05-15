import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getServiceSupabase } from '../lib/supabase.js';
import { getHaloConfig, haloGet, haloPost } from '../lib/halopsa.js';

const router = Router();

const REQUEST_TYPES = {
  support: {
    label: 'Problem report',
    ticketTypeMatches: ['support', 'incident', 'gamma default'],
    summaryPrefix: 'Support request',
  },
  onboarding: {
    label: 'New user onboarding',
    ticketTypeMatches: ['onboard', 'new user', 'employee', 'gamma default'],
    summaryPrefix: 'New user onboarding',
  },
  offboarding: {
    label: 'User offboarding',
    ticketTypeMatches: ['offboard', 'termination', 'disable', 'gamma default'],
    summaryPrefix: 'User offboarding',
  },
  access_change: {
    label: 'Access change',
    ticketTypeMatches: ['access', 'permission', 'folder', 'gamma default'],
    summaryPrefix: 'Access change',
  },
  quote: {
    label: 'Quote or purchase request',
    ticketTypeMatches: ['quote', 'purchase', 'procurement', 'hardware', 'software', 'gamma default'],
    summaryPrefix: 'Quote request',
  },
};

const PRIORITY_IDS = {
  critical: 1,
  high: 2,
  medium: 3,
  low: 4,
};

function isStaff(user) {
  return user?.role === 'admin' || user?.role === 'sales';
}

function cleanText(value, max = 4000) {
  return String(value ?? '').replace(/\r/g, '').trim().slice(0, max);
}

function normalizePriority(value) {
  const priority = String(value || 'medium').toLowerCase();
  return PRIORITY_IDS[priority] ? priority : 'medium';
}

function normalizeRequestType(value) {
  const key = String(value || '').toLowerCase();
  return REQUEST_TYPES[key] ? key : 'support';
}

function formatFieldLabel(key) {
  return String(key || '')
    .replace(/[_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());
}

function formatFieldValue(value) {
  if (Array.isArray(value)) return value.filter(Boolean).join(', ');
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (value == null) return '';
  return cleanText(value, 1000);
}

function buildTicketDetails({ requestType, fields, notes, requester, customer }) {
  const template = REQUEST_TYPES[requestType] || REQUEST_TYPES.support;
  const lines = [
    `PortalIT Request Type: ${template.label}`,
    `Customer: ${customer.name || customer.customer_name || customer.id}`,
    `Submitted By: ${requester.name || 'Unknown'} <${requester.email || 'no email'}>`,
    `Submitted At: ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })}`,
    '',
    'Request Details',
  ];

  Object.entries(fields || {}).forEach(([key, rawValue]) => {
    const value = formatFieldValue(rawValue);
    if (value) lines.push(`${formatFieldLabel(key)}: ${value}`);
  });

  const cleanNotes = cleanText(notes, 3000);
  if (cleanNotes) {
    lines.push('', 'Additional Notes', cleanNotes);
  }

  return lines.join('\n');
}

async function resolveTicketTypeId(config, requestType) {
  const template = REQUEST_TYPES[requestType] || REQUEST_TYPES.support;
  try {
    const response = await haloGet('TicketType', config);
    const types = Array.isArray(response) ? response : [];
    const matches = template.ticketTypeMatches || [];

    for (const match of matches) {
      const found = types.find(type => String(type.name || '').toLowerCase().includes(match));
      if (found?.id) return found.id;
    }

    const gammaDefault = types.find(type => String(type.name || '').toLowerCase().includes('gamma default'));
    if (gammaDefault?.id) return gammaDefault.id;
  } catch (error) {
    console.warn('[customer-requests] Could not resolve Halo ticket type:', error.message);
  }

  return 1;
}

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const supabase = getServiceSupabase();
    const requestType = normalizeRequestType(req.body.request_type);
    const template = REQUEST_TYPES[requestType];
    const priority = normalizePriority(req.body.priority);
    const fields = req.body.fields && typeof req.body.fields === 'object' ? req.body.fields : {};
    const notes = cleanText(req.body.notes, 3000);
    const requestedCustomerId = cleanText(req.body.customer_id, 100);

    const targetCustomerId = isStaff(req.user) ? requestedCustomerId : req.user?.customer_id;
    if (!targetCustomerId) {
      return res.status(400).json({ error: 'Customer account is required to submit a request.' });
    }

    if (!isStaff(req.user) && requestedCustomerId && requestedCustomerId !== req.user?.customer_id) {
      return res.status(403).json({ error: 'You can only submit requests for your own account.' });
    }

    const summaryInput = cleanText(req.body.summary, 180);
    if (!summaryInput) {
      return res.status(400).json({ error: 'Request subject is required.' });
    }

    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('*')
      .eq('id', targetCustomerId)
      .single();

    if (customerError || !customer) {
      return res.status(404).json({ error: 'Customer account was not found.' });
    }
    if (!customer.external_id) {
      return res.status(400).json({ error: 'This customer is not linked to HaloPSA yet.' });
    }

    const requester = {
      name: cleanText(req.body.requester_name || req.user?.full_name || req.user?.name || req.user?.email, 160),
      email: cleanText(req.body.requester_email || req.user?.email, 200),
    };

    const config = await getHaloConfig();
    const ticketTypeId = await resolveTicketTypeId(config, requestType);
    const details = buildTicketDetails({ requestType, fields, notes, requester, customer });
    const summary = `${template.summaryPrefix}: ${summaryInput}`.slice(0, 250);
    const haloClientId = parseInt(customer.external_id, 10);

    if (!Number.isFinite(haloClientId)) {
      return res.status(400).json({ error: 'Customer HaloPSA link is invalid.' });
    }

    const haloPayload = {
      client_id: haloClientId,
      summary,
      details,
      priority_id: PRIORITY_IDS[priority],
      tickettype_id: ticketTypeId,
    };

    const haloResult = await haloPost('Tickets', [haloPayload], config);
    const createdTicket = Array.isArray(haloResult) ? haloResult[0] : haloResult;

    if (!createdTicket?.id) {
      return res.status(502).json({ error: 'HaloPSA did not return a ticket number.' });
    }

    const now = new Date().toISOString();
    const ticketRecord = {
      customer_id: customer.id,
      external_id: String(createdTicket.id),
      source: 'halopsa',
      ticket_number: String(createdTicket.id),
      summary,
      subject: summary,
      details,
      description: details,
      status: 'new',
      priority,
      ticket_type: template.label,
      contact_name: requester.name,
      contact_email: requester.email,
      date_opened: now,
      created_date: now,
    };

    const { data: localTicket, error: ticketError } = await supabase
      .from('tickets')
      .insert(ticketRecord)
      .select()
      .single();

    if (ticketError) {
      console.error('[customer-requests] Local ticket insert failed:', ticketError.message);
      return res.status(500).json({
        error: 'Ticket was created in HaloPSA, but the portal could not record it locally.',
        ticket_id: createdTicket.id,
      });
    }

    await supabase
      .from('customers')
      .update({ total_tickets: Number(customer.total_tickets || 0) + 1 })
      .eq('id', customer.id);

    return res.json({
      success: true,
      ticket_id: createdTicket.id,
      ticket: localTicket,
      message: `Request submitted as ticket #${createdTicket.id}`,
    });
  } catch (error) {
    next(error);
  }
});

export { router as customerRequestsRouter };
