import { getHaloConfig, haloGet } from '../lib/halopsa.js';

export async function lookupHaloPSATicket(body, _user) {
  const { ticket_number } = body;

  if (!ticket_number) {
    throw Object.assign(new Error('ticket_number is required'), { statusCode: 400 });
  }

  const config = await getHaloConfig();
  const ticketId = ticket_number.replace(/^0+/, '') || ticket_number;

  // Try direct lookup first
  try {
    const ticket = await haloGet(`Tickets/${ticketId}?includedetails=true`, config);

    const statusMap = {
      1: 'New', 2: 'Open', 3: 'In Progress', 4: 'Waiting',
      5: 'Waiting on Customer', 6: 'Waiting on Third Party',
      7: 'On Hold', 8: 'Resolved', 9: 'Closed', 10: 'Cancelled',
    };

    const statusId = ticket.status_id || ticket.status;
    const statusName = ticket.status_name || ticket.status?.name || statusMap[statusId] || `Status ${statusId}`;

    return {
      success: true,
      ticket: {
        id: ticket.id,
        ticket_number: String(ticket.id),
        summary: ticket.summary,
        details: ticket.details,
        status: statusName,
        priority: ticket.priority_name || ticket.priority?.name || ticket.priority || 'Unknown',
        assigned_to: ticket.agent_name || ticket.agent?.name ||
          (!ticket.agent_id || ticket.agent_id === 0 || ticket.agent_id === 1
            ? 'Unassigned'
            : `Agent ID ${ticket.agent_id}`),
        requested_by: ticket.user_name || ticket.user?.name || 'Unknown',
        date_opened: ticket.dateoccurred || ticket.datecreated,
        last_updated: ticket.lastactiondate,
      },
    };
  } catch {
    // Fall back to search
    try {
      const searchResult = await haloGet(`Tickets?search=${ticket_number}&count=5`, config);
      const tickets = searchResult.tickets || searchResult;

      if (Array.isArray(tickets) && tickets.length > 0) {
        const ticket = tickets[0];
        return {
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
            last_updated: ticket.lastactiondate,
          },
        };
      }
    } catch {
      // Both attempts failed
    }

    return { success: false, error: 'Ticket not found' };
  }
}
