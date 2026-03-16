import { getServiceSupabase } from '../lib/supabase.js';
import { getHaloConfig, haloGet, extractRecords } from '../lib/halopsa.js';

function transformTicket(haloTicket, customerId) {
  const statusMap = {
    '1': 'new',
    '2': 'open',
    '3': 'in_progress',
    '4': 'waiting',
    '5': 'resolved',
    '6': 'closed',
    '26': 'resolved', // Resolved status
    '27': 'closed'    // Closed status
  };

  const priorityMap = {
    '1': 'critical',
    '2': 'high',
    '3': 'medium',
    '4': 'low'
  };

  // Try to determine status from multiple fields
  let status = 'open';

  // First check if ticket has a closed date - that means it's resolved/closed
  if (haloTicket.dateclosed) {
    status = 'resolved';
  } else if (haloTicket.status_id) {
    status = statusMap[String(haloTicket.status_id)] || 'open';
  }

  // Also check the status name directly
  if (haloTicket.status && typeof haloTicket.status === 'string') {
    const statusLower = haloTicket.status.toLowerCase();
    if (statusLower.includes('resolved')) status = 'resolved';
    else if (statusLower.includes('closed')) status = 'closed';
    else if (statusLower.includes('waiting')) status = 'waiting';
    else if (statusLower.includes('progress')) status = 'in_progress';
    else if (statusLower.includes('new')) status = 'new';
  }

  // Final check: if date_closed exists, it's resolved
  if (haloTicket.dateclosed) {
    status = 'resolved';
  }

  return {
    customer_id: customerId,
    external_id: String(haloTicket.id),
    source: 'halopsa',
    subject: haloTicket.summary || haloTicket.Summary || '',
    description: haloTicket.details || haloTicket.Details || '',
    status,
    priority: priorityMap[String(haloTicket.priority_id)] || haloTicket.priority?.toLowerCase?.() || 'medium',
    ticket_type: haloTicket.tickettype_name || haloTicket.tickettype || '',
    assigned_to: haloTicket.agent_name || haloTicket.agent || '',
    contact_name: haloTicket.user_name || haloTicket.username || '',
    contact_email: haloTicket.user_email || '',
    created_date: haloTicket.dateoccurred || haloTicket.datecreated || null,
    closed_at: haloTicket.dateclosed || null,
  };
}

export async function syncHaloPSATickets(body, _user) {
  const supabase = getServiceSupabase();
  const { action, customer_id } = body;
  const config = await getHaloConfig();

  if (action === 'sync_customer') {
    if (!customer_id) {
      const err = new Error('customer_id is required');
      err.statusCode = 400;
      throw err;
    }

    const { data: syncLog, error: syncLogError } = await supabase.from('sync_logs').insert({
      source: 'halopsa',
      status: 'in_progress',
      sync_type: 'tickets',
      started_at: new Date().toISOString()
    }).select().single();
    if (syncLogError) throw new Error(syncLogError.message);

    let recordsSynced = 0;
    let recordsFailed = 0;
    const errors = [];

    try {
      // Find customer by external_id + source (indexed query instead of full-table scan)
      const { data: matchedCustomers } = await supabase.from('customers').select('*')
        .eq('external_id', String(customer_id))
        .eq('source', 'halopsa');
      const dbCustomer = (matchedCustomers || [])[0];
      if (!dbCustomer) throw new Error(`Customer not found in database for external_id: ${customer_id}`);

      // Fetch tickets for this client (most recent 200)
      const data = await haloGet(`Tickets?client_id=${customer_id}&pageinate=true&page_size=200&page_no=1&order=dateoccurred&orderdesc=true`, config);
      const tickets = extractRecords(data, 'tickets');
      const totalTicketCount = data.record_count || data.recordCount || data.total_count || tickets.length;
      console.log(`Found ${tickets.length} tickets (total: ${totalTicketCount}) for customer ${customer_id}`);

      // Save the true total ticket count from HaloPSA on the customer record
      await supabase.from('customers').update({ total_tickets: totalTicketCount }).eq('id', dbCustomer.id);

      // Log first ticket to see status field structure
      if (tickets.length > 0) {
        console.log('Sample ticket data:', JSON.stringify(tickets[0], null, 2));
      }

      // Batch-fetch existing tickets for this customer (avoid N+1)
      const { data: existingTickets } = await supabase.from('tickets').select('id, external_id')
        .eq('customer_id', dbCustomer.id);
      const existingMap = new Map((existingTickets || []).map(t => [t.external_id, t.id]));

      const toCreate = [];
      const toUpdate = [];

      for (const haloTicket of tickets) {
        try {
          const ticketPayload = transformTicket(haloTicket, dbCustomer.id);
          const existingId = existingMap.get(ticketPayload.external_id);
          if (existingId) {
            toUpdate.push({ id: existingId, data: ticketPayload });
          } else {
            toCreate.push(ticketPayload);
          }
        } catch (itemError) {
          recordsFailed++;
          errors.push(`Ticket ${haloTicket.id}: ${itemError.message}`);
        }
      }

      // Bulk create new tickets
      if (toCreate.length > 0) {
        const { error } = await supabase.from('tickets').insert(toCreate);
        if (error) { recordsFailed += toCreate.length; errors.push(`Bulk insert: ${error.message}`); }
        else { recordsSynced += toCreate.length; }
      }

      // Batch update existing tickets (parallel batches of 20)
      const BATCH_SIZE = 20;
      for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
        const batch = toUpdate.slice(i, i + BATCH_SIZE);
        const results = await Promise.allSettled(
          batch.map(item => supabase.from('tickets').update(item.data).eq('id', item.id))
        );
        for (const r of results) {
          if (r.status === 'fulfilled' && !r.value.error) recordsSynced++;
          else recordsFailed++;
        }
      }

      await supabase.from('sync_logs').update({
        status: recordsFailed === 0 ? 'success' : 'partial',
        records_synced: recordsSynced,
        records_failed: recordsFailed,
        error_message: errors.length > 0 ? JSON.stringify(errors) : null,
        completed_at: new Date().toISOString()
      }).eq('id', syncLog.id).select().single();

      return {
        success: true,
        recordsSynced,
        recordsFailed,
        message: `Synced ${recordsSynced} tickets`
      };
    } catch (error) {
      await supabase.from('sync_logs').update({
        status: 'failed',
        error_message: error.message,
        completed_at: new Date().toISOString()
      }).eq('id', syncLog.id).select().single();
      const err = new Error(error.message);
      err.statusCode = 500;
      throw err;
    }
  }

  const err = new Error('Invalid action');
  err.statusCode = 400;
  throw err;
}
