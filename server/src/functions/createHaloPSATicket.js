import { getServiceSupabase } from '../lib/supabase.js';
import { getHaloConfig, haloGet, haloPost } from '../lib/halopsa.js';

export async function createHaloPSATicket(body, _user) {
  const supabase = getServiceSupabase();
  const { customer_id, summary, details, priority, conversation_transcript } = body;

  if (!customer_id || !summary) {
    throw Object.assign(new Error('customer_id and summary are required'), { statusCode: 400 });
  }

  const config = await getHaloConfig();

  // Get customer to find external_id
  const { data: customers } = await supabase
    .from('customers')
    .select('*')
    .eq('id', customer_id);

  const customer = (customers || [])[0];
  if (!customer?.external_id) {
    throw Object.assign(new Error('Customer not found or not linked to HaloPSA'), { statusCode: 400 });
  }

  // Fetch ticket types to find "Gamma Default"
  let ticketTypeId = 1;
  try {
    const types = await haloGet('TicketType', config);
    const gammaDefault = (Array.isArray(types) ? types : []).find(
      t => t.name?.toLowerCase().includes('gamma default'),
    );
    if (gammaDefault) ticketTypeId = gammaDefault.id;
  } catch {
    console.log('Could not fetch ticket types, using default');
  }

  // Create ticket in HaloPSA
  const ticketData = {
    client_id: parseInt(customer.external_id, 10),
    summary,
    details: details || '',
    priority_id: priority === 'critical' ? 1 : priority === 'high' ? 2 : priority === 'medium' ? 3 : 4,
    tickettype_id: ticketTypeId,
  };

  const result = await haloPost('Tickets', [ticketData], config);
  const createdTicket = Array.isArray(result) ? result[0] : result;

  if (!createdTicket?.id) {
    throw Object.assign(new Error('Ticket created but no ID returned'), { statusCode: 500 });
  }

  // Add private note with conversation transcript if provided
  if (conversation_transcript) {
    try {
      await haloPost('Actions', [{
        ticket_id: createdTicket.id,
        note: `--- AI Support Assistant Conversation ---\n\n${conversation_transcript}\n\n--- End of Conversation ---`,
        hiddenfromuser: true,
        outcome: 'AI Pre-Ticket Troubleshooting',
      }], config);
    } catch (e) {
      console.log('Could not add conversation note:', e.message);
    }
  }

  // Also create in local database
  const { error: ticketError } = await supabase
    .from('tickets')
    .insert({
      customer_id,
      halopsa_id: String(createdTicket.id),
      ticket_number: String(createdTicket.id),
      summary,
      details: details || '',
      status: 'new',
      priority: priority || 'medium',
      ticket_type: 'Gamma Default',
      date_opened: new Date().toISOString(),
    });
  if (ticketError) throw new Error(ticketError.message);

  return { success: true, ticket_id: createdTicket.id, message: 'Ticket created successfully' };
}
