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

    const body = await req.json();
    const { customer_id, summary, details, priority, conversation_transcript } = body;

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
      console.error('HaloPSA API error:', responseText);
      return Response.json({ error: 'Failed to create ticket in HaloPSA: ' + responseText }, { status: 500 });
    }

    let result;
    try {
      result = JSON.parse(responseText);
    } catch (e) {
      return Response.json({ error: 'Invalid response from HaloPSA' }, { status: 500 });
    }
    
    const createdTicket = Array.isArray(result) ? result[0] : result;
    
    if (!createdTicket?.id) {
      console.error('No ticket ID in response:', result);
      return Response.json({ error: 'Ticket created but no ID returned' }, { status: 500 });
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
    await base44.asServiceRole.entities.Ticket.create({
      customer_id: customer_id,
      halopsa_id: String(createdTicket.id),
      ticket_number: String(createdTicket.id),
      summary: summary,
      details: details || '',
      status: 'new',
      priority: priority || 'medium',
      ticket_type: 'Gamma Default',
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