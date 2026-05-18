import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Cloud,
  FileText,
  Monitor,
} from 'lucide-react';

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
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-3 py-3 sm:px-4">
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

function NumberMetric({ label, value, detail, to, tone = 'slate' }) {
  const toneClass = {
    emerald: 'text-emerald-700',
    amber: 'text-amber-700',
    rose: 'text-rose-700',
    blue: 'text-blue-700',
    violet: 'text-violet-700',
    slate: 'text-slate-950',
  }[tone] || 'text-slate-950';

  const content = (
    <div className="min-w-0 py-1">
      <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={cn('mt-1 truncate text-xl font-bold leading-6 tabular-nums', toneClass)}>{value}</p>
      {detail && <p className="mt-0.5 truncate text-xs text-slate-500">{detail}</p>}
    </div>
  );

  return to ? (
    <Link to={to} className="min-w-0 transition-opacity hover:opacity-80">
      {content}
    </Link>
  ) : content;
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
    <div className="px-4 py-6 text-center sm:py-8">
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-slate-50 text-slate-400">
        <Icon className="h-5 w-5" />
      </div>
      <p className="font-medium text-slate-900">{title}</p>
      {description && <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
    </div>
  );
}

function QuoteRow({ quote, items = [] }) {
  const lineItems = items.filter(item => item.quote_id === quote.id);
  const total = Number(quote.total ?? quote.amount ?? lineItems.reduce((sum, item) => sum + (Number(item.total ?? item.amount ?? item.price) || 0), 0)) || 0;
  const status = normalized(quote.status) || 'quote';
  const tone = ['accepted', 'approved'].includes(status)
    ? 'emerald'
    : ['sent', 'presented'].includes(status)
      ? 'blue'
      : 'slate';

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-500">
        <FileText className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-950">
          {quote.title || quote.quote_number || 'Quote'}
        </p>
        <p className="mt-0.5 truncate text-xs text-slate-500">
          {quote.quote_number ? `Quote #${quote.quote_number}` : `${lineItems.length} line item${lineItems.length !== 1 ? 's' : ''}`}
          {quote.quote_date && ` - ${safeFormatDate(quote.quote_date, 'MMM d, yyyy')}`}
        </p>
      </div>
      <div className="text-right">
        <p className="text-sm font-semibold tabular-nums text-slate-950">{money(total)}</p>
        <StatusPill tone={tone}>{quote.status?.replace('_', ' ') || 'Quote'}</StatusPill>
      </div>
    </div>
  );
}

export default function CustomerDashboardTab({
  customer,
  contacts = [],
  devices = [],
  contracts = [],
  invoices = [],
  lineItems = [],
  recurringBills = [],
  licenses = [],
  quotes = [],
  quoteItems = [],
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
    const due = invoices.filter(i => ['overdue', 'pending', 'sent', 'open', 'unpaid'].includes(normalized(i.status)));
    const overdue = invoices.filter(i => normalized(i.status) === 'overdue');
    const paid = invoices.filter(i => normalized(i.status) === 'paid');
    const dueAmount = due.reduce((sum, inv) => sum + (Number(inv.amount_due ?? inv.total ?? inv.amount) || 0), 0);
    const overdueAmount = overdue.reduce((sum, inv) => sum + (Number(inv.amount_due ?? inv.total ?? inv.amount) || 0), 0);
    return { due, overdue, paid, dueAmount, overdueAmount };
  }, [invoices]);

  const quoteStats = useMemo(() => {
    const active = quotes.filter(q => !['rejected', 'expired', 'void', 'cancelled', 'canceled'].includes(normalized(q.status)));
    const accepted = quotes.filter(q => ['accepted', 'approved'].includes(normalized(q.status)));
    const total = quotes.reduce((sum, quote) => {
      const lineItems = quoteItems.filter(item => item.quote_id === quote.id);
      return sum + (Number(quote.total ?? quote.amount ?? lineItems.reduce((itemSum, item) => itemSum + (Number(item.total ?? item.amount ?? item.price) || 0), 0)) || 0);
    }, 0);
    const sorted = [...quotes].sort((a, b) =>
      new Date(b.quote_date || b.updated_date || b.created_date || 0) - new Date(a.quote_date || a.updated_date || a.created_date || 0)
    );
    return { active, accepted, total, sorted };
  }, [quotes, quoteItems]);

  const deviceStats = useMemo(() => {
    const online = devices.filter(d => normalized(d.status) === 'online');
    const offline = devices.filter(d => normalized(d.status) === 'offline');
    const servers = devices.filter(d => normalized(d.device_type).includes('server'));
    const workstations = devices.filter(d => !normalized(d.device_type).includes('server'));
    return { online, offline, servers, workstations, total: devices.length };
  }, [devices]);

  const activeContracts = useMemo(() => contracts.filter(c => normalized(c.status) === 'active'), [contracts]);

  return (
    <div className="space-y-3 sm:space-y-4">
      <section className="hidden rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm sm:block">
        <div className="grid grid-cols-2 gap-x-5 gap-y-3 md:grid-cols-3 xl:grid-cols-6 xl:divide-x xl:divide-slate-100">
          <NumberMetric
            label="Monthly billing"
            value={money(monthlyCost)}
            detail={`${activeLineItems.length} active line item${activeLineItems.length !== 1 ? 's' : ''}`}
            tone="emerald"
            to={tabUrl(customerId, 'billing')}
          />
          <NumberMetric
            label="Open balance"
            value={money(invoiceStats.dueAmount)}
            detail={`${invoiceStats.due.length} open invoice${invoiceStats.due.length !== 1 ? 's' : ''}`}
            tone={invoiceStats.dueAmount > 0 ? 'amber' : 'slate'}
            to={tabUrl(customerId, 'billing')}
          />
          <NumberMetric
            label="Past due"
            value={money(invoiceStats.overdueAmount)}
            detail={invoiceStats.overdue.length > 0 ? `${invoiceStats.overdue.length} overdue invoice${invoiceStats.overdue.length !== 1 ? 's' : ''}` : 'No overdue balance'}
            tone={invoiceStats.overdueAmount > 0 ? 'rose' : 'slate'}
            to={tabUrl(customerId, 'billing')}
          />
          <NumberMetric
            label="Quotes"
            value={`${quoteStats.active.length} active`}
            detail={`${money(quoteStats.total, 0)} quoted`}
            tone={quoteStats.active.length > 0 ? 'amber' : 'slate'}
            to={tabUrl(customerId, 'quotes')}
          />
          <NumberMetric
            label="Devices"
            value={deviceStats.total}
            detail={`${deviceStats.servers.length} servers - ${deviceStats.workstations.length} workstations`}
            tone="violet"
            to={tabUrl(customerId, 'services')}
          />
          <NumberMetric
            label="Services"
            value={activeContracts.length}
            detail={`${activeLineItems.length} recurring line item${activeLineItems.length !== 1 ? 's' : ''}`}
            tone={activeContracts.length > 0 ? 'blue' : 'slate'}
            to={tabUrl(customerId, 'billing')}
          />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-3 sm:gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.8fr)]">
        <div className="space-y-3 sm:space-y-4">
          <Panel
            title="Billing summary"
            description="Recurring service cost and invoice balance."
            action={<Link to={tabUrl(customerId, 'billing')} className="text-sm font-medium text-slate-600 hover:text-slate-950">Billing</Link>}
            className="hidden sm:block"
          >
            <div className="grid grid-cols-1 divide-y divide-slate-100 md:grid-cols-3 md:divide-x md:divide-y-0">
              <div className="p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Monthly services</p>
                <p className="mt-2 text-2xl font-bold tabular-nums text-slate-950">{money(monthlyCost)}</p>
                <p className="mt-1 text-xs text-slate-500">{activeLineItems.length} active line item{activeLineItems.length !== 1 ? 's' : ''}</p>
              </div>
              <div className="p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Past due</p>
                <p className={cn('mt-2 text-2xl font-bold tabular-nums', invoiceStats.overdueAmount > 0 ? 'text-rose-700' : 'text-slate-950')}>
                  {money(invoiceStats.overdueAmount)}
                </p>
                <p className="mt-1 text-xs text-slate-500">{invoiceStats.overdue.length} overdue invoice{invoiceStats.overdue.length !== 1 ? 's' : ''}</p>
              </div>
              <div className="p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Open balance</p>
                <p className="mt-2 text-2xl font-bold tabular-nums text-slate-950">{money(invoiceStats.dueAmount)}</p>
                <p className="mt-1 text-xs text-slate-500">{invoiceStats.due.length} invoice{invoiceStats.due.length !== 1 ? 's' : ''} with a balance</p>
              </div>
            </div>
          </Panel>

          <Panel
            title="Quote activity"
            description="Recently synced proposals and approvals."
            action={<Link to={tabUrl(customerId, 'quotes')} className="text-sm font-medium text-slate-600 hover:text-slate-950">Quotes</Link>}
          >
            {quoteStats.sorted.length === 0 ? (
              <EmptyMessage
                icon={FileText}
                title="No quotes published"
                description="Approved and sent quotes will appear here when they are available."
              />
            ) : (
              <div className="divide-y divide-slate-100">
                {quoteStats.sorted.slice(0, 5).map(quote => (
                  <QuoteRow key={quote.id || quote.quote_number || quote.title} quote={quote} items={quoteItems} />
                ))}
              </div>
            )}
          </Panel>
        </div>

        <div className="space-y-3 sm:space-y-4">
          <Panel title="Account totals" description="Quick customer account reference.">
            <div className="grid grid-cols-2 gap-1.5 p-3">
              <div className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Team</p>
                <p className="mt-0.5 text-base font-bold leading-5 text-slate-950">{contacts.length}</p>
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Accepted quotes</p>
                <p className="mt-0.5 text-base font-bold leading-5 text-slate-950">{quoteStats.accepted.length}</p>
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Applications</p>
                <p className="mt-0.5 text-base font-bold leading-5 text-slate-950">{licenses.length}</p>
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Services</p>
                <p className="mt-0.5 text-base font-bold leading-5 text-slate-950">{serviceTags.length}</p>
              </div>
            </div>
          </Panel>

          <Panel title="Services and inventory" description="What is currently represented in the portal.">
            <div className="divide-y divide-slate-100">
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2">
                  <Monitor className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium text-slate-800">Devices</span>
                </div>
                <StatusPill tone="blue">{deviceStats.total} total</StatusPill>
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
                <StatusPill tone="slate">{activeContracts.length} active</StatusPill>
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
