import React from 'react';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  CreditCard,
  DollarSign,
  FileText,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { cn, safeFormatDate } from '@/lib/utils';

function money(value) {
  return `$${(Number(value) || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function normalized(value) {
  return String(value || '').toLowerCase();
}

function LedgerMetric({ icon: Icon, label, value, detail, tone = 'slate' }) {
  const tones = {
    emerald: 'border-emerald-200 bg-emerald-50/70 text-emerald-700',
    amber: 'border-amber-200 bg-amber-50/80 text-amber-700',
    rose: 'border-rose-200 bg-rose-50/80 text-rose-700',
    blue: 'border-blue-200 bg-blue-50/70 text-blue-700',
    slate: 'border-slate-200 bg-white text-slate-700',
  };

  return (
    <div className={cn('rounded-xl border p-4 shadow-sm', tones[tone])}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-2 truncate text-2xl font-bold tabular-nums text-slate-950">{value}</p>
          {detail && <p className="mt-1 truncate text-xs text-slate-500">{detail}</p>}
        </div>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-current/20 bg-white/80">
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

function InvoiceStatus({ status }) {
  const lower = normalized(status);
  const label = lower === 'overdue'
    ? 'Payment required'
    : lower === 'sent' || lower === 'open' || lower === 'unpaid'
      ? 'Balance due'
      : lower === 'paid'
        ? 'Paid'
        : status || 'Draft';

  return (
    <Badge className={cn(
      'capitalize',
      lower === 'paid' && 'bg-emerald-100 text-emerald-700',
      lower === 'overdue' && 'bg-rose-100 text-rose-700',
      ['sent', 'open', 'unpaid', 'pending'].includes(lower) && 'bg-amber-100 text-amber-700',
      !['paid', 'overdue', 'sent', 'open', 'unpaid', 'pending'].includes(lower) && 'bg-slate-100 text-slate-700'
    )}>
      {lower === 'paid' && <CheckCircle2 className="mr-1 h-3 w-3" />}
      {lower === 'overdue' && <AlertCircle className="mr-1 h-3 w-3" />}
      {['sent', 'open', 'unpaid', 'pending'].includes(lower) && <Clock className="mr-1 h-3 w-3" />}
      {label}
    </Badge>
  );
}

function invoiceLabel(invoice, invoiceItems) {
  if (!invoiceItems.length) return invoice.invoice_number || 'Invoice';
  const descriptions = invoiceItems.map(item => String(item.description || '').toLowerCase());
  if (descriptions.some(desc => desc.includes('ticket id:') || desc.includes('ticket opened'))) return 'Service request work';
  if (descriptions.some(desc => desc.includes('managed it') || desc.includes('business location'))) return 'Monthly recurring services';
  return invoice.invoice_number || 'Invoice';
}

export default function CustomerBillingTab({
  customer,
  invoices = [],
  invoiceLineItems = [],
  recurringBills = [],
  lineItems = [],
  activeBillIdSet,
  invoiceFilter,
  setInvoiceFilter,
  expandedInvoices,
  setExpandedInvoices,
}) {
  const activeBills = recurringBills.filter(b => activeBillIdSet?.has(b.id));
  const yearlyBills = activeBills.filter(b => ['yearly', 'annual', 'annually'].includes(normalized(b.frequency)));
  const monthlyBills = activeBills.filter(b => !['yearly', 'annual', 'annually'].includes(normalized(b.frequency)));
  const monthlyCost = monthlyBills.reduce((sum, bill) => sum + (Number(bill.amount) || 0), 0);
  const yearlyCost = yearlyBills.reduce((sum, bill) => sum + (Number(bill.amount) || 0), 0);
  const balanceInvoices = invoices.filter(inv => ['overdue', 'sent', 'open', 'pending', 'unpaid'].includes(normalized(inv.status)));
  const paymentRequired = invoices.filter(inv => normalized(inv.status) === 'overdue');
  const balanceTotal = balanceInvoices.reduce((sum, inv) => sum + (Number(inv.amount_due ?? inv.total ?? inv.amount) || 0), 0);
  const paidCount = invoices.filter(inv => normalized(inv.status) === 'paid').length;
  const filteredInvoices = invoices
    .filter(inv => invoiceFilter === 'all' || normalized(inv.status) === invoiceFilter)
    .sort((a, b) => new Date(b.due_date || b.invoice_date || 0) - new Date(a.due_date || a.invoice_date || 0));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <LedgerMetric
          icon={DollarSign}
          label="Monthly services"
          value={money(monthlyCost)}
          detail={`${lineItems.length} active line item${lineItems.length !== 1 ? 's' : ''}`}
          tone="emerald"
        />
        <LedgerMetric
          icon={Calendar}
          label="Annual services"
          value={yearlyCost > 0 ? money(yearlyCost) : '$0.00'}
          detail={`${yearlyBills.length} annual bill${yearlyBills.length !== 1 ? 's' : ''}`}
          tone="blue"
        />
        <LedgerMetric
          icon={CreditCard}
          label="Invoice balance"
          value={money(balanceTotal)}
          detail={paymentRequired.length > 0 ? `${paymentRequired.length} payment required` : `${balanceInvoices.length} invoice${balanceInvoices.length !== 1 ? 's' : ''} with balance`}
          tone={paymentRequired.length > 0 ? 'rose' : balanceInvoices.length > 0 ? 'amber' : 'slate'}
        />
        <LedgerMetric
          icon={CheckCircle2}
          label="Paid invoices"
          value={paidCount}
          detail={`${invoices.length} total invoice${invoices.length !== 1 ? 's' : ''}`}
          tone="slate"
        />
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="font-semibold text-slate-950">Invoices</h3>
            <p className="text-sm text-slate-500">A compact ledger of published customer invoices.</p>
          </div>
          <select
            value={invoiceFilter}
            onChange={(event) => setInvoiceFilter(event.target.value)}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700"
          >
            <option value="all">All invoices</option>
            <option value="paid">Paid</option>
            <option value="overdue">Payment required</option>
            <option value="sent">Balance due</option>
          </select>
        </div>

        {filteredInvoices.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <FileText className="mx-auto mb-3 h-9 w-9 text-slate-300" />
            <p className="font-medium text-slate-900">No invoices to show</p>
            <p className="mt-1 text-sm text-slate-500">
              {customer?.source === 'halopsa' ? 'Invoices will appear after the next billing sync.' : 'No billing records are available yet.'}
            </p>
          </div>
        ) : (
          <div>
            <div className="hidden grid-cols-[minmax(0,1.5fr)_120px_120px_120px_120px_32px] gap-3 border-b border-slate-100 bg-slate-50 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 md:grid">
              <div>Invoice</div>
              <div>Status</div>
              <div>Issued</div>
              <div>Due</div>
              <div className="text-right">Balance</div>
              <div />
            </div>
            <div className="divide-y divide-slate-100">
              {filteredInvoices.map(invoice => {
                const invoiceItems = invoiceLineItems.filter(item => item.invoice_id === invoice.id);
                const isExpanded = expandedInvoices[invoice.id];
                const balance = normalized(invoice.status) === 'paid' ? 0 : (Number(invoice.amount_due ?? invoice.total ?? invoice.amount) || 0);
                const rowLabel = invoiceLabel(invoice, invoiceItems);
                const isPaymentRequired = normalized(invoice.status) === 'overdue';

                return (
                  <div key={invoice.id}>
                    <button
                      onClick={() => setExpandedInvoices(prev => ({ ...prev, [invoice.id]: !prev[invoice.id] }))}
                      className={cn(
                        'grid w-full grid-cols-1 gap-2 px-5 py-3 text-left transition-colors hover:bg-slate-50 md:grid-cols-[minmax(0,1.5fr)_120px_120px_120px_120px_32px] md:items-center',
                        isPaymentRequired && 'bg-rose-50/50 hover:bg-rose-50'
                      )}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-950">{rowLabel}</p>
                        <p className="truncate text-xs text-slate-500">
                          #{invoice.invoice_number || invoice.external_id || invoice.id}
                        </p>
                      </div>
                      <div><InvoiceStatus status={invoice.status} /></div>
                      <div className="text-sm text-slate-600">{invoice.invoice_date ? safeFormatDate(invoice.invoice_date, 'MMM d, yyyy') : '-'}</div>
                      <div className={cn('text-sm', isPaymentRequired ? 'font-medium text-rose-700' : 'text-slate-600')}>
                        {invoice.due_date ? safeFormatDate(invoice.due_date, 'MMM d, yyyy') : '-'}
                      </div>
                      <div className="text-left text-sm font-semibold tabular-nums text-slate-950 md:text-right">
                        {balance > 0 ? money(balance) : '-'}
                      </div>
                      <ChevronRight className={cn('hidden h-4 w-4 text-slate-400 transition-transform md:block', isExpanded && 'rotate-90')} />
                    </button>

                    {isExpanded && (
                      <div className="border-t border-slate-100 bg-slate-50/80">
                        {invoiceItems.length > 0 ? (
                          <div className="divide-y divide-slate-100">
                            {invoiceItems.map(item => (
                              <div key={item.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 px-6 py-2 text-sm md:pl-12">
                                <p className="truncate text-slate-700">{item.description || 'Line item'}</p>
                                <p className="whitespace-nowrap text-right text-slate-600">
                                  {item.quantity || 1} x {money(item.unit_price || 0)} = {money(item.total || ((item.quantity || 1) * (item.unit_price || 0)))}
                                </p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="px-6 py-4 text-center text-sm text-slate-500">No line items published for this invoice.</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
