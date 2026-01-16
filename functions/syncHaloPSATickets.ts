import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

async function authenticateWithHaloPSA(authUrl, clientId, clientSecret) {
  const tokenResponse = await fetch(authUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'all'
    })
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    throw new Error(`HaloPSA auth failed: ${tokenResponse.status} - ${errorText}`);
  }

  const tokenData = await tokenResponse.json();
  if (!tokenData.access_token) {
    throw new Error('No access token received from HaloPSA');
  }

  return tokenData.access_token;
}

function buildHaloPsaApiUrl(baseUrl, endpoint) {
  return `${baseUrl.endsWith('/') ? baseUrl : baseUrl + '/'}${endpoint}`;
}

async function fetchFromHaloPSA(url, accessToken, clientId) {
  await new Promise(resolve => setTimeout(resolve, 500));

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Client-ID': clientId
    }
  });

  if (!response.ok) {
    throw new Error(`HaloPSA API error: ${response.status}`);
  }

  return await response.json();
}

function transformTicket(haloTicket, customerId) {
  const statusMap = {
    '1': 'new',
    '2': 'open',
    '3': 'in_progress',
    '4': 'waiting',
    '5': 'resolved',
    '6': 'closed'
  };

  const priorityMap = {
    '1': 'critical',
    '2': 'high',
    '3': 'medium',
    '4': 'low'
  };

  return {
    customer_id: customerId,
    halopsa_id: String(haloTicket.id),
    ticket_number: String(haloTicket.id || haloTicket.ticketnumber || ''),
    summary: haloTicket.summary || haloTicket.Summary || '',
    details: haloTicket.details || haloTicket.Details || '',
    status: statusMap[String(haloTicket.status_id)] || haloTicket.status?.toLowerCase?.() || 'open',
    priority: priorityMap[String(haloTicket.priority_id)] || haloTicket.priority?.toLowerCase?.() || 'medium',
    ticket_type: haloTicket.tickettype_name || haloTicket.tickettype || '',
    assigned_to: haloTicket.agent_name || haloTicket.agent || '',
    requested_by: haloTicket.user_name || haloTicket.username || '',
    requested_by_email: haloTicket.user_email || '',
    date_opened: haloTicket.dateoccurred || haloTicket.datecreated || null,
    date_closed: haloTicket.dateclosed || null,
    last_updated: haloTicket.lastupdate || haloTicket.lastupdated || null
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const { action, customer_id } = body;

    const settings = (await base44.asServiceRole.entities.Settings.list())[0];
    if (!settings) {
      return Response.json({ error: 'HaloPSA settings not configured' }, { status: 400 });
    }

    let accessToken;
    try {
      accessToken = await authenticateWithHaloPSA(
        settings.halopsa_auth_url,
        settings.halopsa_client_id,
        settings.halopsa_client_secret
      );
    } catch (error) {
      return Response.json({ error: error.message }, { status: 401 });
    }

    const apiUrl = settings.halopsa_api_url;
    const clientId = settings.halopsa_client_id;

    if (action === 'sync_customer') {
      if (!customer_id) {
        return Response.json({ error: 'customer_id is required' }, { status: 400 });
      }

      const syncLog = await base44.asServiceRole.entities.SyncLog.create({
        source: 'halopsa',
        status: 'in_progress',
        sync_type: 'tickets',
        started_at: new Date().toISOString()
      });

      let recordsSynced = 0;
      let recordsFailed = 0;
      const errors = [];

      try {
        // First find the customer using the internal ID passed from frontend
        const allCustomers = await base44.asServiceRole.entities.Customer.list();
        const dbCustomer = allCustomers.find(c => c.external_id === String(customer_id) && c.source === 'halopsa');
        if (!dbCustomer) throw new Error(`Customer not found in database for external_id: ${customer_id}`);

        // Fetch the last 50 tickets for this client using the external HaloPSA ID, ordered by date descending
        const url = buildHaloPsaApiUrl(apiUrl, `Tickets?client_id=${customer_id}&page_size=50&order=dateoccurred&orderdesc=true`);
        const data = await fetchFromHaloPSA(url, accessToken, clientId);
        
        const tickets = Array.isArray(data) ? data : (data.tickets || data.records || []);
        console.log(`Found ${tickets.length} tickets for customer ${customer_id}`);

        for (const haloTicket of tickets) {
          try {
            const ticketPayload = transformTicket(haloTicket, dbCustomer.id);

            const existingTicket = (await base44.asServiceRole.entities.Ticket.filter({ 
              halopsa_id: ticketPayload.halopsa_id,
              customer_id: dbCustomer.id
            }))[0];

            if (existingTicket) {
              await base44.asServiceRole.entities.Ticket.update(existingTicket.id, ticketPayload);
            } else {
              await base44.asServiceRole.entities.Ticket.create(ticketPayload);
            }

            recordsSynced++;
          } catch (itemError) {
            recordsFailed++;
            errors.push(`Ticket ${haloTicket.id}: ${itemError.message}`);
          }
        }

        await base44.asServiceRole.entities.SyncLog.update(syncLog.id, {
          status: recordsFailed === 0 ? 'success' : 'partial',
          records_synced: recordsSynced,
          records_failed: recordsFailed,
          error_message: errors.length > 0 ? JSON.stringify(errors) : null,
          completed_at: new Date().toISOString()
        });

        return Response.json({
          success: true,
          recordsSynced,
          recordsFailed,
          message: `Synced ${recordsSynced} tickets`
        });
      } catch (error) {
        await base44.asServiceRole.entities.SyncLog.update(syncLog.id, {
          status: 'failed',
          error_message: error.message,
          completed_at: new Date().toISOString()
        });
        return Response.json({ success: false, error: error.message }, { status: 500 });
      }
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});