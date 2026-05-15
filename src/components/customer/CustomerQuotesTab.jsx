import React from 'react';
import { Calendar, CheckCircle2, ChevronDown, Clock, ExternalLink, FileText, Plus } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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

function parseQuoteMeta(quote) {
  if (!quote?.notes) return {};
  if (typeof quote.notes === 'object') return quote.notes;
  try {
    return JSON.parse(quote.notes);
  } catch {
    return {};
  }
}

function quoteDisplay(quote) {
  const meta = parseQuoteMeta(quote);
  return {
    title: meta.title || quote.title || quote.quote_number || 'Quote',
    viewUrl: meta.public_url || quote.public_url || '',
    validUntil: quote.valid_until || meta.valid_until || quote.expiry_date,
    issued: meta.date_issued || quote.quote_date || quote.created_date,
  };
}

function quoteTotal(quote, quoteItems) {
  const meta = parseQuoteMeta(quote);
  const lineItems = quoteItems.filter(item => item.quote_id === quote.id);
  return Number(quote.total ?? quote.amount ?? quote.total_amount ?? meta.total ?? lineItems.reduce((sum, item) => sum + (Number(item.total_price ?? item.total ?? item.amount) || 0), 0)) || 0;
}

function QuoteStatus({ status }) {
  const lower = normalized(status);
  return (
    <Badge className={cn(
      'capitalize',
      ['accepted', 'approved'].includes(lower) && 'bg-emerald-100 text-emerald-700',
      ['sent', 'presented'].includes(lower) && 'bg-blue-100 text-blue-700',
      lower === 'viewed' && 'bg-indigo-100 text-indigo-700',
      lower === 'draft' && 'bg-slate-100 text-slate-700',
      ['rejected', 'declined'].includes(lower) && 'bg-rose-100 text-rose-700',
      lower === 'changes_requested' && 'bg-orange-100 text-orange-700',
      lower === 'expired' && 'bg-amber-100 text-amber-700'
    )}>
      {['accepted', 'approved'].includes(lower) && <CheckCircle2 className="mr-1 h-3 w-3" />}
      {['sent', 'presented', 'viewed', 'draft'].includes(lower) && <Clock className="mr-1 h-3 w-3" />}
      {String(status || 'Quote').replaceAll('_', ' ')}
    </Badge>
  );
}

export default function CustomerQuotesTab({
  quotes = [],
  quoteItems = [],
  expandedQuotes,
  setExpandedQuotes,
  canUseAdminActions = false,
}) {
  const visibleQuotes = quotes.filter(q => normalized(q.status) !== 'draft');
  const activeQuotes = visibleQuotes.filter(q => !['accepted', 'approved', 'rejected', 'declined', 'expired', 'void', 'cancelled', 'canceled'].includes(normalized(q.status)));
  const acceptedQuotes = visibleQuotes.filter(q => ['accepted', 'approved'].includes(normalized(q.status)));
  const quotedTotal = visibleQuotes.reduce((sum, quote) => sum + quoteTotal(quote, quoteItems), 0);
  const expiringSoon = visibleQuotes.filter(q => {
    const expiryDate = quoteDisplay(q).validUntil;
    if (!expiryDate) return false;
    const diffMs = new Date(expiryDate) - new Date();
    return diffMs > 0 && diffMs <= 1000 * 60 * 60 * 24 * 7;
  });
  const sortedQuotes = [...visibleQuotes].sort((a, b) => new Date(quoteDisplay(b).issued || b.updated_date || 0) - new Date(quoteDisplay(a).issued || a.updated_date || 0));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Pending approval', value: activeQuotes.length, detail: 'customer-visible quotes', tone: 'amber' },
          { label: 'Accepted', value: acceptedQuotes.length, detail: 'approved quotes', tone: 'emerald' },
          { label: 'Total quoted', value: money(quotedTotal), detail: `${visibleQuotes.length} published`, tone: 'blue' },
          { label: 'Expiring soon', value: expiringSoon.length, detail: 'within 7 days', tone: expiringSoon.length > 0 ? 'amber' : 'slate' },
        ].map(metric => (
          <div
            key={metric.label}
            className={cn(
              'rounded-xl border p-4 shadow-sm',
              metric.tone === 'amber' && 'border-amber-200 bg-amber-50/75',
              metric.tone === 'emerald' && 'border-emerald-200 bg-emerald-50/70',
              metric.tone === 'blue' && 'border-blue-200 bg-blue-50/70',
              metric.tone === 'slate' && 'border-slate-200 bg-white'
            )}
          >
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{metric.label}</p>
            <p className="mt-2 truncate text-2xl font-bold tabular-nums text-slate-950">{metric.value}</p>
            <p className="mt-1 truncate text-xs text-slate-500">{metric.detail}</p>
          </div>
        ))}
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="font-semibold text-slate-950">Quotes</h3>
            <p className="text-sm text-slate-500">Review proposals, totals, and expiration dates.</p>
          </div>
          {canUseAdminActions && (
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              New Quote
            </Button>
          )}
        </div>

        {sortedQuotes.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <FileText className="mx-auto mb-3 h-9 w-9 text-slate-300" />
            <p className="font-medium text-slate-900">No quotes published</p>
            <p className="mt-1 text-sm text-slate-500">Quotes will appear here when they are available.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {sortedQuotes.map(quote => {
              const quoteLineItems = quoteItems.filter(item => item.quote_id === quote.id);
              const isExpanded = expandedQuotes[quote.id];
              const total = quoteTotal(quote, quoteItems);
              const display = quoteDisplay(quote);
              const expiryDate = display.validUntil;

              return (
                <div key={quote.id}>
                  <div className="grid w-full grid-cols-1 gap-3 px-5 py-4 text-left transition-colors hover:bg-slate-50 md:grid-cols-[minmax(0,1fr)_130px_120px_140px_170px] md:items-center">
                    <button
                      type="button"
                      onClick={() => setExpandedQuotes(prev => ({ ...prev, [quote.id]: !prev[quote.id] }))}
                      className="min-w-0 text-left"
                    >
                      <p className="truncate text-sm font-semibold text-slate-950">{display.title}</p>
                      <p className="truncate text-xs text-slate-500">Quote #{quote.quote_number || quote.external_id || quote.id}</p>
                    </button>
                    <div><QuoteStatus status={quote.status} /></div>
                    <div className="flex items-center gap-1 text-sm text-slate-600">
                      <Calendar className="h-3.5 w-3.5 text-slate-400" />
                      {expiryDate ? safeFormatDate(expiryDate, 'MMM d, yyyy') : 'No expiry'}
                    </div>
                    <div className="text-left text-sm font-semibold tabular-nums text-slate-950 md:text-right">{money(total)}</div>
                    <div className="flex items-center gap-2 md:justify-end">
                      {display.viewUrl && (
                        <Button
                          type="button"
                          size="sm"
                          className="h-8 gap-1.5 bg-orange-600 px-3 text-white hover:bg-orange-700"
                          onClick={() => window.open(display.viewUrl, '_blank', 'noopener,noreferrer')}
                        >
                          Review
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <button
                        type="button"
                        onClick={() => setExpandedQuotes(prev => ({ ...prev, [quote.id]: !prev[quote.id] }))}
                        className="hidden rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 md:block"
                        aria-label={isExpanded ? 'Collapse quote details' : 'Expand quote details'}
                      >
                        <ChevronDown className={cn('h-4 w-4 transition-transform', isExpanded && 'rotate-180')} />
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-slate-100 bg-slate-50/80">
                      {quoteLineItems.length > 0 ? (
                        <div className="divide-y divide-slate-100">
                          {quoteLineItems.map(item => (
                            <div key={item.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 px-6 py-2 text-sm md:pl-12">
                              <div className="min-w-0">
                                <p className="truncate text-slate-800">{item.description || 'Line item'}</p>
                                <p className="text-xs text-slate-500">
                                  {item.quantity || 1} x {money(item.unit_price || 0)}
                                </p>
                              </div>
                              <p className="whitespace-nowrap text-right font-medium text-slate-900">{money(item.total_price || item.total || 0)}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="px-6 py-4 text-center text-sm text-slate-500">No line items published for this quote.</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
