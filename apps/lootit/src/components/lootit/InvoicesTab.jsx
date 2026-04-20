import React from 'react';
import { cn } from '@/lib/utils';
import { DollarSign } from 'lucide-react';

const CATEGORY_BADGES = {
  monthly_recurring: { label: 'Recurring', className: 'bg-blue-100 text-blue-700' },
  voip: { label: 'VoIP', className: 'bg-purple-100 text-purple-700' },
  ticket_adhoc: { label: 'Ad-hoc', className: 'bg-amber-100 text-amber-700' },
  hardware_project: { label: 'Hardware', className: 'bg-slate-100 text-slate-600' },
  uncategorized: { label: 'Unclassified', className: 'bg-red-50 text-red-500 border border-red-200' },
};

export default function InvoicesTab({ invoices }) {
  if (invoices.length === 0) {
    return (
      <div className="text-center py-12">
        <DollarSign className="w-10 h-10 text-slate-300 mx-auto mb-3" />
        <p className="text-slate-500">No invoices found for this customer</p>
      </div>
    );
  }

  const sorted = invoices
    .slice()
    .sort((a, b) => new Date(b.invoice_date || 0) - new Date(a.invoice_date || 0));

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
        {sorted.map((inv) => {
          const categoryName = {
            monthly_recurring: 'Monthly Recurring',
            voip: 'VoIP Services',
            ticket_adhoc: 'Ticket Charges',
            hardware_project: 'Hardware / Project',
            uncategorized: inv.invoice_number || 'Unclassified',
          }[inv.category] || inv.invoice_number || inv.id;

          const dateStr = inv.invoice_date
            ? new Date(inv.invoice_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
            : '\u2014';

          return (
            <div key={inv.id} className="flex items-center gap-3 px-4 py-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-slate-800 truncate">
                    {categoryName}
                  </span>
                  {inv.category && CATEGORY_BADGES[inv.category] && (
                    <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium', CATEGORY_BADGES[inv.category].className)}>
                      {CATEGORY_BADGES[inv.category].label}
                    </span>
                  )}
                  <span className="text-[10px] text-slate-400">#{inv.invoice_number || inv.id}</span>
                  {inv.classification_confidence != null && inv.classification_confidence < 70 && (
                    <span className="text-[10px] text-red-400" title={`Confidence: ${inv.classification_confidence}%`}>Low confidence</span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">{dateStr}</p>
              </div>
              <div className="text-sm font-semibold text-slate-800 tabular-nums">
                ${(inv.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
