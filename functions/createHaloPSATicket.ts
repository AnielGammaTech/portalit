import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

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

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const { customer_id, summary, details, priority, ticket_type } = body;

    if (!customer_id || !summary) {
      return Response.json({ error: 'customer_id and summary are required' }, { status: 400 });
    }

    // Get HaloPSA settings
    const settingsRecords = await base44.asServiceRole.entities.Settings.list();
    const settings = settingsRecords[0];

    if (!settings?.halopsa_client_id || !settings?.halopsa_api_url) {
      return Response.json({ error: 'HaloPSA not configured' }, { status: 400 });
    }

    // Get customer to find external_id
    const customers = await base44.asServiceRole.entities.Customer.filter({ id: customer_id });
    const customer = customers[0];

    if (!customer?.external_id) {
      return Response.json({ error: 'Customer not found or not linked to HaloPSA' }, { status: 400 });
    }

    // Get HaloPSA token
    const token = await getHaloPSAToken(settings);

    // Create ticket in HaloPSA
    const ticketData = {
      client_id: parseInt(customer.external_id),
      summary: summary,
      details: details || '',
      priority_id: priority === 'critical' ? 1 : priority === 'high' ? 2 : priority === 'medium' ? 3 : 4,
      tickettype_id: ticket_type || 1
    };

    const response = await fetch(`${settings.halopsa_api_url}/Tickets`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify([ticketData])
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('HaloPSA API error:', errorText);
      return Response.json({ error: 'Failed to create ticket in HaloPSA' }, { status: 500 });
    }

    const result = await response.json();
    const createdTicket = result[0];

    // Also create in local database
    await base44.asServiceRole.entities.Ticket.create({
      customer_id: customer_id,
      halopsa_id: String(createdTicket.id),
      ticket_number: String(createdTicket.id),
      summary: summary,
      details: details || '',
      status: 'new',
      priority: priority || 'medium',
      ticket_type: ticket_type ? String(ticket_type) : null,
      date_opened: new Date().toISOString()
    });

    return Response.json({ 
      success: true, 
      ticket_id: createdTicket.id,
      message: 'Ticket created successfully'
    });

  } catch (error) {
    console.error('Error creating ticket:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});