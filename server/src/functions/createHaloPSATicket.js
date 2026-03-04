import { getServiceSupabase } from '../lib/supabase.js';

async function getHaloPSAToken(settings) {
  const response = await fetch(settings.halopsa_auth_url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: settings.halopsa_client_id,
      client_secret: settings.halopsa_client_secret,
      scope: 'all'
    })
  });
  const data = await response.json();
  return data.access_token;
}

export async function createHaloPSATicket(body, user) {
  const supabase = getServiceSupabase();

  const { customer_id, summary, details, priority, conversation_transcript } = body;

  if (!customer_id || !summary) {
    const err = new Error('customer_id and summary are required');
    err.statusCode = 400;
    throw err;
  }

  // Get HaloPSA settings
  const { data: settingsRecords } = await supabase.from('settings').select('*');
  const settings = (settingsRecords || [])[0];

  if (!settings?.halopsa_client_id || !settings?.halopsa_api_url) {
    const err = new Error('HaloPSA not configured');
    err.statusCode = 400;
    throw err;
  }

  // Get customer to find external_id
  let customerQuery = supabase.from('customers').select('*');
  customerQuery = customerQuery.eq('id', customer_id);
  const { data: customers } = await customerQuery;
  const customer = (customers || [])[0];

  if (!customer?.external_id) {
    const err = new Error('Customer not found or not linked to HaloPSA');
    err.statusCode = 400;
    throw err;
  }

  // Get HaloPSA token
  const token = await getHaloPSAToken(settings);

  // Fetch ticket types to find "Gamma Default"
  let ticketTypeId = 1; // fallback
  try {
    const typesResponse = await fetch(`${settings.halopsa_api_url}/TicketType`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (typesResponse.ok) {
      const types = await typesResponse.json();
      const gammaDefault = types.find(t => t.name?.toLowerCase().includes('gamma default'));
      if (gammaDefault) {
        ticketTypeId = gammaDefault.id;
      }
    }
  } catch (e) {
    console.log('Could not fetch ticket types, using default');
  }

  // Create ticket in HaloPSA
  const ticketData = {
    client_id: parseInt(customer.external_id),
    summary: summary,
    details: details || '',
    priority_id: priority === 'critical' ? 1 : priority === 'high' ? 2 : priority === 'medium' ? 3 : 4,
    tickettype_id: ticketTypeId
  };

  console.log('Creating ticket with data:', JSON.stringify(ticketData));

  const response = await fetch(`${settings.halopsa_api_url}/Tickets`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify([ticketData])
  });

  const responseText = await response.text();
  console.log('HaloPSA response:', responseText);

  if (!response.ok) {
    console.log('HaloPSA API error:', responseText);
    const err = new Error('Failed to create ticket in HaloPSA: ' + responseText);
    err.statusCode = 500;
    throw err;
  }

  let result;
  try {
    result = JSON.parse(responseText);
  } catch (e) {
    const err = new Error('Invalid response from HaloPSA');
    err.statusCode = 500;
    throw err;
  }

  const createdTicket = Array.isArray(result) ? result[0] : result;

  if (!createdTicket?.id) {
    console.log('No ticket ID in response:', result);
    const err = new Error('Ticket created but no ID returned');
    err.statusCode = 500;
    throw err;
  }

  // Add private note with conversation transcript if provided
  if (conversation_transcript) {
    try {
      const noteData = {
        ticket_id: createdTicket.id,
        note: `--- AI Support Assistant Conversation ---\n\n${conversation_transcript}\n\n--- End of Conversation ---`,
        hiddenfromuser: true,
        outcome: 'AI Pre-Ticket Troubleshooting'
      };

      await fetch(`${settings.halopsa_api_url}/Actions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify([noteData])
      });
    } catch (e) {
      console.log('Could not add conversation note:', e.message);
    }
  }

  // Also create in local database
  const { error: ticketError } = await supabase.from('tickets').insert({
    customer_id: customer_id,
    halopsa_id: String(createdTicket.id),
    ticket_number: String(createdTicket.id),
    summary: summary,
    details: details || '',
    status: 'new',
    priority: priority || 'medium',
    ticket_type: 'Gamma Default',
    date_opened: new Date().toISOString()
  }).select().single();
  if (ticketError) throw new Error(ticketError.message);

  return {
    success: true,
    ticket_id: createdTicket.id,
    message: 'Ticket created successfully'
  };
}
