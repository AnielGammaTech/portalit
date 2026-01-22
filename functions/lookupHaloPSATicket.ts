import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Lookup ticket info from HaloPSA by ticket number
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
    const { ticket_number, customer_id } = body;

    if (!ticket_number) {
      return Response.json({ error: 'ticket_number is required' }, { status: 400 });
    }

    // Get HaloPSA settings
    const settingsRecords = await base44.asServiceRole.entities.Settings.list();
    const settings = settingsRecords[0];

    if (!settings?.halopsa_client_id || !settings?.halopsa_api_url) {
      return Response.json({ error: 'HaloPSA not configured' }, { status: 400 });
    }

    // Get HaloPSA token
    const token = await getHaloPSAToken(settings);

    // Search for the ticket by ID/number
    const ticketId = ticket_number.replace(/^0+/, '') || ticket_number; // Remove leading zeros
    
    // Include related data to get status/priority names
    const response = await fetch(`${settings.halopsa_api_url}/Tickets/${ticketId}?includedetails=true`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
      // Try searching by ticket number
      const searchResponse = await fetch(`${settings.halopsa_api_url}/Tickets?search=${ticket_number}&count=5`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (searchResponse.ok) {
        const searchResult = await searchResponse.json();
        const tickets = searchResult.tickets || searchResult;
        
        if (Array.isArray(tickets) && tickets.length > 0) {
          const ticket = tickets[0];
          return Response.json({
            success: true,
            ticket: {
              id: ticket.id,
              ticket_number: String(ticket.id),
              summary: ticket.summary,
              details: ticket.details,
              status: ticket.status?.name || ticket.status_id,
              priority: ticket.priority?.name || ticket.priority_id,
              assigned_to: ticket.agent?.name || ticket.agent_id || 'Unassigned',
              requested_by: ticket.user?.name || ticket.user_name,
              date_opened: ticket.dateoccurred || ticket.datecreated,
              last_updated: ticket.lastactiondate
            }
          });
        }
      }
      
      return Response.json({ 
        success: false, 
        error: 'Ticket not found' 
      });
    }

    const ticket = await response.json();
    
    // Map common HaloPSA status IDs to names
    const statusMap = {
      1: 'New',
      2: 'Open', 
      3: 'In Progress',
      4: 'Waiting',
      5: 'Waiting on Customer',
      6: 'Waiting on Third Party',
      7: 'On Hold',
      8: 'Resolved',
      9: 'Closed',
      10: 'Cancelled'
    };
    
    const statusId = ticket.status_id || ticket.status;
    const statusName = ticket.status_name || ticket.status?.name || statusMap[statusId] || `Status ${statusId}`;
    
    return Response.json({
      success: true,
      ticket: {
        id: ticket.id,
        ticket_number: String(ticket.id),
        summary: ticket.summary,
        details: ticket.details,
        status: statusName,
        priority: ticket.priority_name || ticket.priority?.name || ticket.priority || 'Unknown',
        assigned_to: ticket.agent_name || ticket.agent?.name || (!ticket.agent_id || ticket.agent_id === 0 ? 'Unassigned' : `Agent ID ${ticket.agent_id}`),
        requested_by: ticket.user_name || ticket.user?.name || 'Unknown',
        date_opened: ticket.dateoccurred || ticket.datecreated,
        last_updated: ticket.lastactiondate
      }
    });

  } catch (error) {
    console.error('Error looking up ticket:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});