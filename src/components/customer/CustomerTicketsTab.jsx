import React from 'react';
import { CheckCircle2, Clock, MessageSquare, Monitor, UserCircle } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn, safeFormatDate } from '@/lib/utils';

function normalized(value) {
  return String(value || '').toLowerCase();
}

function customerStatus(status) {
  const lower = normalized(status);
  if (['closed', 'resolved', 'completed'].includes(lower)) return { label: 'Completed', tone: 'emerald' };
  if (['waiting', 'awaiting_customer', 'customer_waiting'].includes(lower)) return { label: 'Your input needed', tone: 'amber' };
  if (['open', 'new', 'in_progress', 'active', 'pending'].includes(lower)) return { label: 'In progress', tone: 'blue' };
  return { label: status || 'Request', tone: 'slate' };
}

function StatusBadge({ status }) {
  const view = customerStatus(status);
  return (
    <Badge className={cn(
      view.tone === 'emerald' && 'bg-emerald-100 text-emerald-700',
      view.tone === 'amber' && 'bg-amber-100 text-amber-700',
      view.tone === 'blue' && 'bg-blue-100 text-blue-700',
      view.tone === 'slate' && 'bg-slate-100 text-slate-700'
    )}>
      {view.tone === 'emerald' ? <CheckCircle2 className="mr-1 h-3 w-3" /> : <Clock className="mr-1 h-3 w-3" />}
      {view.label}
    </Badge>
  );
}

export default function CustomerTicketsTab({
  tickets = [],
  ticketFilter,
  setTicketFilter,
  ticketPage,
  setTicketPage,
  customer,
}) {
  const filteredTickets = tickets
    .filter(ticket => ticketFilter === 'all' || normalized(ticket.status) === ticketFilter)
    .sort((a, b) => new Date(b.updated_date || b.created_date || 0) - new Date(a.updated_date || a.created_date || 0));
  const totalPages = Math.max(1, Math.ceil(filteredTickets.length / 10));
  const visibleTickets = filteredTickets.slice((ticketPage - 1) * 10, ticketPage * 10);
  const inProgress = tickets.filter(ticket => ['open', 'new', 'in_progress', 'active', 'pending'].includes(normalized(ticket.status))).length;
  const inputNeeded = tickets.filter(ticket => ['waiting', 'awaiting_customer', 'customer_waiting'].includes(normalized(ticket.status))).length;
  const completed = tickets.filter(ticket => ['closed', 'resolved', 'completed'].includes(normalized(ticket.status))).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'In progress', value: inProgress, detail: 'being worked', tone: 'blue' },
          { label: 'Your input needed', value: inputNeeded, detail: 'waiting on customer', tone: inputNeeded > 0 ? 'amber' : 'slate' },
          { label: 'Completed', value: completed, detail: 'resolved history', tone: 'emerald' },
          { label: 'All time', value: tickets.length, detail: 'total requests', tone: 'slate' },
        ].map(metric => (
          <div
            key={metric.label}
            className={cn(
              'rounded-xl border p-4 shadow-sm',
              metric.tone === 'blue' && 'border-blue-200 bg-blue-50/70',
              metric.tone === 'amber' && 'border-amber-200 bg-amber-50/80',
              metric.tone === 'emerald' && 'border-emerald-200 bg-emerald-50/70',
              metric.tone === 'slate' && 'border-slate-200 bg-white'
            )}
          >
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{metric.label}</p>
            <p className="mt-2 text-2xl font-bold tabular-nums text-slate-950">{metric.value}</p>
            <p className="mt-1 text-xs text-slate-500">{metric.detail}</p>
          </div>
        ))}
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="font-semibold text-slate-950">Service requests</h3>
            <p className="text-sm text-slate-500">Progress and history sorted by most recent update.</p>
          </div>
          <select
            value={ticketFilter}
            onChange={(event) => {
              setTicketFilter(event.target.value);
              setTicketPage(1);
            }}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700"
          >
            <option value="all">All requests</option>
            <option value="open">In progress</option>
            <option value="in_progress">Currently active</option>
            <option value="waiting">Your input needed</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
        </div>

        {visibleTickets.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <MessageSquare className="mx-auto mb-3 h-9 w-9 text-slate-300" />
            <p className="font-medium text-slate-900">No service requests to show</p>
            <p className="mt-1 text-sm text-slate-500">
              {customer?.source === 'halopsa' ? 'Requests will appear after the next support sync.' : 'No requests are published for this account.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {visibleTickets.map(ticket => (
              <div key={ticket.id} className="grid grid-cols-1 gap-3 px-5 py-4 transition-colors hover:bg-slate-50 md:grid-cols-[minmax(0,1fr)_150px_150px] md:items-center">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Monitor className="h-4 w-4 shrink-0 text-slate-400" />
                    <p className="truncate text-sm font-semibold text-slate-950">
                      {ticket.external_id ? `#${ticket.external_id} - ` : ''}{ticket.subject || ticket.summary || 'Service request'}
                    </p>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    {ticket.contact_name && (
                      <span className="inline-flex items-center gap-1">
                        <UserCircle className="h-3.5 w-3.5" />
                        {ticket.contact_name}
                      </span>
                    )}
                    {ticket.assigned_to && <span>Assigned to {ticket.assigned_to}</span>}
                    <span>Updated {ticket.updated_date ? safeFormatDate(ticket.updated_date, 'MMM d, yyyy') : ticket.created_date ? safeFormatDate(ticket.created_date, 'MMM d, yyyy') : '-'}</span>
                  </div>
                </div>
                <div><StatusBadge status={ticket.status} /></div>
                <div className="text-sm text-slate-600 md:text-right">
                  {ticket.priority ? `${ticket.priority} priority` : 'Standard priority'}
                </div>
              </div>
            ))}
          </div>
        )}

        {filteredTickets.length > 10 && (
          <div className="flex items-center justify-center gap-2 border-t border-slate-100 px-5 py-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setTicketPage(page => Math.max(1, page - 1))}
              disabled={ticketPage === 1}
            >
              Previous
            </Button>
            <span className="px-3 text-sm text-slate-600">Page {ticketPage} of {totalPages}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setTicketPage(page => Math.min(totalPages, page + 1))}
              disabled={ticketPage >= totalPages}
            >
              Next
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
