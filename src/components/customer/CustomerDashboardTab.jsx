import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle2,
  Cloud,
  CreditCard,
  FileText,
  HelpCircle,
  Monitor,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { differenceInDays } from 'date-fns';

import { cn, safeFormatDate } from '@/lib/utils';
import { createPageUrl } from '../../utils';

function money(value, digits = 2) {
  return `$${(Number(value) || 0).toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

function normalized(value) {
  return String(value || '').toLowerCase();
}

function tabUrl(customerId, tab) {
  return createPageUrl(`CustomerDetail?id=${customerId || ''}&tab=${tab}`);
}

function Panel({ title, description, action, children, className }) {
  return (
    <section className={cn('overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm', className)}>
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-slate-950">{title}</h3>
          {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function PulseMetric({ icon: Icon, label, value, detail, to, tone = 'slate' }) {
  const toneClass = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    rose: 'bg-rose-50 text-rose-700 border-rose-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    violet: 'bg-violet-50 text-violet-700 border-violet-200',
    slate: 'bg-slate-50 text-slate-700 border-slate-200',
  }[tone];

  const content = (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:bg-slate-50">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-2 truncate text-2xl font-bold tabular-nums text-slate-950">{value}</p>
          {detail && <p className="mt-1 truncate text-xs text-slate-500">{detail}</p>}
        </div>
        <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border', toneClass)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );

  return to ? <Link to={to}>{content}</Link> : content;
}

function StatusPill({ tone, children }) {
  const toneClass = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    rose: 'bg-rose-50 text-rose-700 border-rose-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    slate: 'bg-slate-50 text-slate-600 border-slate-200',
  }[tone] || 'bg-slate-50 text-slate-600 border-slate-200';

  return (
    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold', toneClass)}>
      {children}
    </span>
  );
}

function EmptyMessage({ icon: Icon, title, description }) {
  return (
    <div className="px-4 py-8 text-center">
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-slate-50 text-slate-400">
        <Icon className="h-5 w-5" />
      </div>
      <p className="font-medium text-slate-900">{title}</p>
      {description && <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
    </div>
  );
}

function TicketRow({ ticket }) {
  const status = normalized(ticket.status);
  const tone = status.includes('open') || status.includes('new')
    ? 'amber'
    : status.includes('progress')
      ? 'blue'
      : status.includes('closed') || status.includes('resolved')
        ? 'emerald'
        : 'slate';

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-500">
        <HelpCircle className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-950">
          {ticket.external_id ? `#${ticket.external_id} - ` : ''}{ticket.subject || ticket.summary || 'Support ticket'}
        </p>
        <p className="mt-0.5 truncate text-xs text-slate-500">
          {ticket.assigned_to ? `Tech: ${ticket.assigned_to}` : ticket.contact_name ? `By: ${ticket.contact_name}` : 'No owner shown'}
          {ticket.created_date && ` - ${safeFormatDate(ticket.created_date, 'MMM d, yyyy')}`}
        </p>
      </div>
      <StatusPill tone={tone}>{ticket.status?.replace('_', ' ') || 'Open'}</StatusPill>
    </div>
  );
}

export default function CustomerDashboardTab({
  customer,
  contacts = [],
  devices = [],
  contracts = [],
  tickets = [],
  invoices = [],
  lineItems = [],
  recurringBills = [],
  licenses = [],
  serviceTags = [],
}) {
  const customerId = customer?.id;

  const activeBillIds = useMemo(() => {
    const now = new Date();
    return new Set(
      recurringBills
        .filter(b => {
          if (normalized(b.status) === 'inactive') return false;
          if (b.end_date) {
            const end = new Date(b.end_date);
            if (end.getFullYear() < 2090 && end < now) return false;
          }
          return true;
        })
        .map(b => b.id)
    );
  }, [recurringBills]);

  const activeLineItems = useMemo(
    () => lineItems.filter(item => activeBillIds.has(item.recurring_bill_id)),
    [lineItems, activeBillIds]
  );

  const monthlyBillIds = useMemo(() => new Set(
    recurringBills
      .filter(b => activeBillIds.has(b.id) && !['yearly', 'annual', 'annually'].includes(normalized(b.frequency)))
      .map(b => b.id)
  ), [recurringBills, activeBillIds]);

  const monthlyCost = useMemo(
    () => activeLineItems
      .filter(item => monthlyBillIds.has(item.recurring_bill_id))
      .reduce((sum, item) => sum + (Number(item.net_amount ?? item.total ?? item.amount) || 0), 0),
    [activeLineItems, monthlyBillIds]
  );

  const invoiceStats = useMemo(() => {
    const overdue = invoices.filter(i => normalized(i.status) === 'overdue');
    const pending = invoices.filter(i => ['pending', 'sent', 'open', 'unpaid'].includes(normalized(i.status)));
    const paid = invoices.filter(i => normalized(i.status) === 'paid');
    const overdueAmount = overdue.reduce((sum, inv) => sum + (Number(inv.amount_due ?? inv.total ?? inv.amount) || 0), 0);
    const pendingAmount = pending.reduce((sum, inv) => sum + (Number(inv.amount_due ?? inv.total ?? inv.amount) || 0), 0);
    return { overdue, pending, paid, overdueAmount, pendingAmount };
  }, [invoices]);

  const ticketStats = useMemo(() => {
    const open = tickets.filter(t => ['open', 'new', 'in_progress', 'pending', 'active'].includes(normalized(t.status)));
    const closed = tickets.filter(t => ['closed', 'resolved', 'completed'].includes(normalized(t.status)));
    const recent = tickets.filter(t => t.created_date && differenceInDays(new Date(), new Date(t.created_date)) <= 30);
    const sorted = [...tickets].sort((a, b) =>
      new Date(b.updated_date || b.created_date || 0) - new Date(a.updated_date || a.created_date || 0)
    );
    return { open, closed, recent, sorted };
  }, [tickets]);

  const deviceStats = useMemo(() => {
    const online = devices.filter(d => normalized(d.status) === 'online');
    const offline = devices.filter(d => normalized(d.status) === 'offline');
    const servers = devices.filter(d => normalized(d.device_type).includes('server'));
    const workstations = devices.filter(d => !normalized(d.device_type).includes('server'));
    return { online, offline, servers, workstations, total: devices.length };
  }, [devices]);

  const activeContracts = useMemo(() => contracts.filter(c => normalized(c.status) === 'active'), [contracts]);
  const expiringContracts = useMemo(() => activeContracts.filter(c => {
    if (!c.end_date) return false;
    const daysLeft = differenceInDays(new Date(c.end_date), new Date());
    return daysLeft >= 0 && daysLeft <= 60;
  }), [activeContracts]);

  const activeLicenseSpend = useMemo(
    () => licenses.filter(l => normalized(l.status) === 'active').reduce((sum, l) => sum + (Number(l.total_cost) || 0), 0),
    [licenses]
  );

  const healthTone = invoiceStats.overdue.length > 0
    ? 'rose'
    : ticketStats.open.length > 0 || deviceStats.offline.length > 0 || expiringContracts.length > 0
      ? 'amber'
      : 'emerald';
  const healthLabel = healthTone === 'rose'
    ? 'Action needed'
    : healthTone === 'amber'
      ? 'Open items'
      : 'Operational';

  const primaryContact = contacts.find(c => c.is_primary) || contacts[0];

  return (
    <div className="space-y-4">
      <section className={cn(
        'rounded-xl border p-4 shadow-sm',
        healthTone === 'rose' && 'border-rose-200 bg-rose-50',
        healthTone === 'amber' && 'border-amber-200 bg-amber-50',
        healthTone === 'emerald' && 'border-emerald-200 bg-emerald-50'
      )}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-white',
              healthTone === 'rose' && 'border-rose-200 text-rose-700',
              healthTone === 'amber' && 'border-amber-200 text-amber-700',
              healthTone === 'emerald' && 'border-emerald-200 text-emerald-700'
            )}>
              {healthTone === 'emerald' ? <ShieldCheck className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
            </div>
            <div>
              <p className="font-semibold text-slate-950">{healthLabel}</p>
              <p className="mt-0.5 text-sm text-slate-600">
                {invoiceStats.overdue.length > 0
                  ? `${invoiceStats.overdue.length} overdue invoice${invoiceStats.overdue.length !== 1 ? 's' : ''} need review.`
                  : ticketStats.open.length > 0
                    ? `${ticketStats.open.length} support item${ticketStats.open.length !== 1 ? 's' : ''} currently open.`
                    : 'No urgent customer-facing items are showing on this account.'}
              </p>
            </div>
          </div>
          <Link
            to={tabUrl(customerId, ticketStats.open.length > 0 ? 'tickets' : 'services')}
            className="inline-flex h-9 items-center justify-center rounded-lg bg-slate-950 px-4 text-sm font-medium text-white hover:bg-slate-800"
          >
            {ticketStats.open.length > 0 ? 'View tickets' : 'View services'}
          </Link>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <PulseMetric
          icon={HelpCircle}
          label="Support tickets"
          value={`${ticketStats.open.length} open`}
          detail={`${ticketStats.recent.length} ticket${ticketStats.recent.length !== 1 ? 's' : ''} in the last 30 days`}
          tone={ticketStats.open.length > 0 ? 'amber' : 'emerald'}
          to={tabUrl(customerId, 'tickets')}
        />
        <PulseMetric
          icon={CreditCard}
          label="Invoice summary"
          value={invoiceStats.overdueAmount > 0 ? money(invoiceStats.overdueAmount) : money(invoiceStats.pendingAmount)}
          detail={invoiceStats.overdueAmount > 0 ? 'overdue balance' : `${invoiceStats.pending.length} pending invoice${invoiceStats.pending.length !== 1 ? 's' : ''}`}
          tone={invoiceStats.overdueAmount > 0 ? 'rose' : 'blue'}
          to={tabUrl(customerId, 'billing')}
        />
        <PulseMetric
          icon={Monitor}
          label="Device status"
          value={`${deviceStats.online.length}/${deviceStats.total} online`}
          detail={`${deviceStats.online.length} online - ${deviceStats.offline.length} offline`}
          tone={deviceStats.offline.length > 0 ? 'amber' : 'violet'}
          to={tabUrl(customerId, 'services')}
        />
        <PulseMetric
          icon={FileText}
          label="Service plan"
          value={`${activeContracts.length} active`}
          detail={expiringContracts.length > 0 ? `${expiringContracts.length} renewing soon` : `${activeLineItems.length} active line item${activeLineItems.length !== 1 ? 's' : ''}`}
          tone={expiringContracts.length > 0 ? 'amber' : 'slate'}
          to={tabUrl(customerId, 'billing')}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.8fr)]">
        <div className="space-y-4">
          <Panel
            title="Current work"
            description="Recent support activity and open items."
            action={<Link to={tabUrl(customerId, 'tickets')} className="text-sm font-medium text-slate-600 hover:text-slate-950">All tickets</Link>}
          >
            {ticketStats.sorted.length === 0 ? (
              <EmptyMessage
                icon={CheckCircle2}
                title="Zero active issues"
                description="Your infrastructure is performing optimally based on the customer-facing data currently available."
              />
            ) : (
              <div className="divide-y divide-slate-100">
                {ticketStats.sorted.slice(0, 5).map(ticket => (
                  <TicketRow key={ticket.id || ticket.external_id || ticket.subject} ticket={ticket} />
                ))}
              </div>
            )}
          </Panel>

          <Panel
            title="Billing health"
            description="Recurring service cost and invoice status."
            action={<Link to={tabUrl(customerId, 'billing')} className="text-sm font-medium text-slate-600 hover:text-slate-950">Billing</Link>}
          >
            <div className="grid grid-cols-1 divide-y divide-slate-100 md:grid-cols-3 md:divide-x md:divide-y-0">
              <div className="p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Monthly services</p>
                <p className="mt-2 text-2xl font-bold tabular-nums text-slate-950">{money(monthlyCost)}</p>
                <p className="mt-1 text-xs text-slate-500">{activeLineItems.length} active line item{activeLineItems.length !== 1 ? 's' : ''}</p>
              </div>
              <div className="p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Pending</p>
                <p className="mt-2 text-2xl font-bold tabular-nums text-slate-950">{money(invoiceStats.pendingAmount)}</p>
                <p className="mt-1 text-xs text-slate-500">{invoiceStats.pending.length} invoice{invoiceStats.pending.length !== 1 ? 's' : ''}</p>
              </div>
              <div className="p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Overdue</p>
                <p className={cn('mt-2 text-2xl font-bold tabular-nums', invoiceStats.overdueAmount > 0 ? 'text-rose-700' : 'text-slate-950')}>
                  {money(invoiceStats.overdueAmount)}
                </p>
                <p className="mt-1 text-xs text-slate-500">{invoiceStats.overdue.length} invoice{invoiceStats.overdue.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel title="Service health" description="Snapshot of core managed services.">
            <div className="divide-y divide-slate-100">
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2">
                  <Monitor className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium text-slate-800">Devices</span>
                </div>
                <StatusPill tone={deviceStats.offline.length > 0 ? 'amber' : 'emerald'}>
                  {deviceStats.online.length}/{deviceStats.total} online
                </StatusPill>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2">
                  <Cloud className="h-4 w-4 text-violet-600" />
                  <span className="text-sm font-medium text-slate-800">SaaS</span>
                </div>
                <StatusPill tone="blue">{licenses.length} license{licenses.length !== 1 ? 's' : ''}</StatusPill>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-amber-600" />
                  <span className="text-sm font-medium text-slate-800">Contracts</span>
                </div>
                <StatusPill tone={expiringContracts.length > 0 ? 'amber' : 'emerald'}>
                  {activeContracts.length} active
                </StatusPill>
              </div>
            </div>
          </Panel>

          <Panel title="Your support team" description="Primary contact details from your account.">
            {primaryContact ? (
              <div className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-700">
                    {(primaryContact.full_name || primaryContact.email || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-950">{primaryContact.full_name || 'Primary contact'}</p>
                    <p className="truncate text-sm text-slate-500">{primaryContact.email || primaryContact.title || 'No email listed'}</p>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Team</p>
                    <p className="mt-1 text-lg font-bold text-slate-950">{contacts.length}</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">SaaS spend</p>
                    <p className="mt-1 text-lg font-bold text-slate-950">{money(activeLicenseSpend, 0)}</p>
                  </div>
                </div>
              </div>
            ) : (
              <EmptyMessage
                icon={Users}
                title="No contact listed"
                description="Your provider has not published a primary contact for this account yet."
              />
            )}
          </Panel>

          {serviceTags.length > 0 && (
            <Panel title="Connected services">
              <div className="flex flex-wrap gap-2 p-4">
                {serviceTags.map(tag => (
                  <span
                    key={tag.key}
                    className={cn('inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium', tag.text)}
                  >
                    <span className={cn('h-1.5 w-1.5 rounded-full', tag.dot)} />
                    {tag.label}
                  </span>
                ))}
              </div>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
