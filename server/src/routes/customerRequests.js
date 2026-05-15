import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { requireAuth } from '../middleware/auth.js';
import { getServiceSupabase } from '../lib/supabase.js';
import { getHaloConfig, haloGet, haloPost } from '../lib/halopsa.js';

const router = Router();
let anthropicClient = null;
let openaiClient = null;

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

function isInternalFieldKey(key) {
  const field = String(key || '');
  return field.endsWith('_ref') ||
    field.endsWith('_contact_id') ||
    field.endsWith('_halo_id') ||
    field === 'requester_contact_id';
}

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

function targetCustomerIdForUser(req) {
  const requestedCustomerId = cleanText(req.body.customer_id, 100);
  const targetCustomerId = isStaff(req.user) ? requestedCustomerId : req.user?.customer_id;
  return { requestedCustomerId, targetCustomerId };
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

function normalizeAttachments(rawAttachments = []) {
  const attachments = Array.isArray(rawAttachments) ? rawAttachments : [];
  return attachments
    .slice(0, 8)
    .map((attachment) => {
      const url = cleanText(attachment?.url || attachment?.file_url, 1000);
      if (!url) return null;
      let parsed;
      try {
        parsed = new URL(url);
      } catch {
        return null;
      }
      if (!['http:', 'https:'].includes(parsed.protocol)) return null;
      if (!parsed.pathname.includes('/api/upload/file/')) return null;
      return {
        url,
        name: cleanText(attachment?.name, 180) || decodeURIComponent(parsed.pathname.split('/').pop() || 'Attachment'),
        type: cleanText(attachment?.type, 120),
        size: Number.isFinite(Number(attachment?.size)) ? Number(attachment.size) : null,
      };
    })
    .filter(Boolean);
}

function buildTicketDetails({ requestType, fields, notes, requester, customer, attachments }) {
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
    if (isInternalFieldKey(key)) return;
    const value = formatFieldValue(rawValue);
    if (value) lines.push(`${formatFieldLabel(key)}: ${value}`);
  });

  const cleanNotes = cleanText(notes, 3000);
  if (cleanNotes) {
    lines.push('', 'Additional Notes', cleanNotes);
  }

  if (attachments?.length) {
    lines.push('', 'Attachments');
    attachments.forEach((attachment, index) => {
      lines.push(`${index + 1}. ${attachment.name}: ${attachment.url}`);
    });
  }

  return lines.join('\n');
}

async function resolveHaloUserId(supabase, customerId, requester, fields) {
  const contactIds = [
    fields?.requester_contact_id,
    fields?.affected_contact_id,
    fields?.employee_contact_id,
    fields?.manager_contact_id,
    fields?.approval_contact_id,
  ].filter(Boolean).map(String);

  const emails = [
    requester?.email,
    fields?.affected_user_email,
    fields?.employee_email,
    fields?.manager_email,
    fields?.approval_contact_email,
  ].filter(Boolean).map(email => String(email).trim().toLowerCase());

  if (contactIds.length === 0 && emails.length === 0) return null;

  const { data: contacts, error } = await supabase
    .from('contacts')
    .select('*')
    .eq('customer_id', customerId);

  if (error || !Array.isArray(contacts)) {
    if (error) console.warn('[customer-requests] Could not resolve contact:', error.message);
    return null;
  }

  const byId = contacts.find(contact => contactIds.includes(String(contact.id)));
  const byEmail = contacts.find(contact => emails.includes(String(contact.email || '').trim().toLowerCase()));
  const contact = byId || byEmail;
  const rawHaloId = contact?.halopsa_id || contact?.external_id;
  const haloUserId = parseInt(rawHaloId, 10);
  return Number.isFinite(haloUserId) ? haloUserId : null;
}

async function getAISettings() {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from('portal_settings')
    .select('ai_provider, ai_model')
    .limit(1)
    .maybeSingle();

  if (error) console.error('[customer-requests] Failed to load AI settings:', error.message);
  const provider = data?.ai_provider || 'anthropic';
  let model = data?.ai_model || 'claude-sonnet-4-20250514';

  if (model === 'claude-haiku-4-20250514') model = 'claude-haiku-4-5-20251001';
  if (provider === 'openai' && model.startsWith('claude')) model = 'gpt-4o';
  if (provider === 'anthropic' && (model.startsWith('gpt') || model.startsWith('o1'))) model = 'claude-sonnet-4-20250514';

  return { provider, model };
}

async function invokeRequestEnhancer(prompt) {
  const { provider, model } = await getAISettings();

  if (provider === 'openai') {
    if (!process.env.OPENAI_API_KEY) throw new Error('OpenAI API key is not configured.');
    if (!openaiClient) openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await openaiClient.chat.completions.create({
      model,
      max_tokens: 900,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'Return only JSON. Do not add markdown.' },
        { role: 'user', content: prompt },
      ],
    });
    return response.choices[0]?.message?.content || '{}';
  }

  if (!process.env.ANTHROPIC_API_KEY) throw new Error('Anthropic API key is not configured.');
  if (!anthropicClient) anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const response = await anthropicClient.messages.create({
    model,
    max_tokens: 900,
    system: 'Return only JSON. Do not add markdown.',
    messages: [{ role: 'user', content: prompt }],
  });
  return response.content.find(part => part.type === 'text')?.text || '{}';
}

function parseEnhancerResponse(text, fallbackSummary, fallbackNotes) {
  try {
    let jsonText = String(text || '').trim();
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    }
    const parsed = JSON.parse(jsonText);
    return {
      summary: cleanText(parsed.summary || fallbackSummary, 180),
      notes: cleanText(parsed.notes || fallbackNotes, 3000),
    };
  } catch {
    return { summary: fallbackSummary, notes: fallbackNotes };
  }
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

router.post('/enhance', requireAuth, async (req, res, next) => {
  try {
    const requestType = normalizeRequestType(req.body.request_type);
    const { requestedCustomerId, targetCustomerId } = targetCustomerIdForUser(req);
    if (!targetCustomerId) {
      return res.status(400).json({ error: 'Customer account is required.' });
    }
    if (!isStaff(req.user) && requestedCustomerId && requestedCustomerId !== req.user?.customer_id) {
      return res.status(403).json({ error: 'You can only enhance requests for your own account.' });
    }

    const summary = cleanText(req.body.summary, 180);
    const notes = cleanText(req.body.notes, 3000);
    const fields = req.body.fields && typeof req.body.fields === 'object' ? req.body.fields : {};
    if (!summary && !notes && Object.values(fields).every(value => !formatFieldValue(value))) {
      return res.status(400).json({ error: 'Add a few details before using AI enhance.' });
    }

    const template = REQUEST_TYPES[requestType] || REQUEST_TYPES.support;
    const fieldLines = Object.entries(fields)
      .map(([key, value]) => {
        if (isInternalFieldKey(key)) return '';
        const formatted = formatFieldValue(value);
        return formatted ? `${formatFieldLabel(key)}: ${formatted}` : '';
      })
      .filter(Boolean)
      .join('\n');

    const prompt = [
      'Rewrite this customer IT request into a clear support ticket intake.',
      'Preserve facts exactly. Do not invent names, dates, approvals, impacts, or troubleshooting.',
      'Keep it customer-friendly and concise. If something is unknown, leave it out.',
      'Return JSON shaped as {"summary":"short ticket subject","notes":"clear details and requested outcome"}.',
      '',
      `Request Type: ${template.label}`,
      `Original Subject: ${summary}`,
      `Structured Fields:\n${fieldLines || 'None'}`,
      `Customer Notes:\n${notes || 'None'}`,
    ].join('\n');

    const responseText = await invokeRequestEnhancer(prompt);
    return res.json(parseEnhancerResponse(responseText, summary, notes));
  } catch (error) {
    next(error);
  }
});

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const supabase = getServiceSupabase();
    const requestType = normalizeRequestType(req.body.request_type);
    const template = REQUEST_TYPES[requestType];
    const priority = normalizePriority(req.body.priority);
    const fields = req.body.fields && typeof req.body.fields === 'object' ? req.body.fields : {};
    const notes = cleanText(req.body.notes, 3000);
    const attachments = normalizeAttachments(req.body.attachments);
    const { requestedCustomerId, targetCustomerId } = targetCustomerIdForUser(req);

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
    const details = buildTicketDetails({ requestType, fields, notes, requester, customer, attachments });
    const summary = `${template.summaryPrefix}: ${summaryInput}`.slice(0, 250);
    const haloClientId = parseInt(customer.external_id, 10);

    if (!Number.isFinite(haloClientId)) {
      return res.status(400).json({ error: 'Customer HaloPSA link is invalid.' });
    }

    const haloUserId = await resolveHaloUserId(supabase, customer.id, requester, fields);
    const haloPayload = {
      client_id: haloClientId,
      summary,
      details,
      priority_id: PRIORITY_IDS[priority],
      tickettype_id: ticketTypeId,
    };
    if (haloUserId) {
      haloPayload.user_id = haloUserId;
    }

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
      subject: summary,
      description: details,
      status: 'new',
      priority,
      ticket_type: template.label,
      category: 'PortalIT Helpdesk',
      contact_name: requester.name,
      contact_email: requester.email,
      created_date: now,
      updated_date: now,
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
