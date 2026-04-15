import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { FileText, Download, Trash2, Loader2, Sparkles, Calendar, ChevronDown, Check, DollarSign, Building2, RefreshCw } from 'lucide-react';

export default function ContractCard({ contract, extractingId, onDownload, onDelete, onRetryExtract }) {
  const isExtracting = extractingId === contract.id;
  const data = contract.extracted_data || {};
  const hasData = contract.extraction_status === 'complete' && Object.keys(data).length > 0;
  const lineItems = data.line_items || [];
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Header row */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors"
        onClick={() => hasData && setCollapsed(!collapsed)}
      >
        <FileText className="w-5 h-5 text-slate-400 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-slate-700 truncate">{contract.file_name}</p>
            {isExtracting && (
              <span className="inline-flex items-center gap-1 text-[10px] text-slate-500 bg-slate-50 px-2 py-0.5 rounded-full">
                <Loader2 className="w-3 h-3 animate-spin" /> Extracting...
              </span>
            )}
            {contract.extraction_status === 'complete' && (
              <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                <Check className="w-3 h-3" /> Extracted
              </span>
            )}
            {contract.extraction_status === 'failed' && (
              <span className="inline-flex items-center gap-1 text-[10px] text-red-500 bg-red-50 px-2 py-0.5 rounded-full">
                Failed
              </span>
            )}
          </div>
          <p className="text-[10px] text-slate-400">
            {contract.file_size ? `${(contract.file_size / 1024).toFixed(0)} KB` : ''} · {new Date(contract.created_date).toLocaleDateString()}
            {hasData && data.client_name && <> · {data.client_name}</>}
            {hasData && data.monthly_total && <> · <span className="font-medium text-slate-600">${Number(data.monthly_total).toLocaleString('en-US', { minimumFractionDigits: 2 })}/mo</span></>}
          </p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {contract.extraction_status === 'failed' && (
            <button
              onClick={(e) => { e.stopPropagation(); onRetryExtract(contract); }}
              className="text-slate-400 hover:text-slate-600 transition-colors p-1"
              title="Retry extraction"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onDownload(contract); }}
            className="text-slate-400 hover:text-slate-600 transition-colors p-1"
            title="Download"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(contract); }}
            className="text-slate-400 hover:text-red-500 transition-colors p-1"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          {hasData && (
            <ChevronDown className={cn("w-4 h-4 text-slate-400 transition-transform", !collapsed && "rotate-180")} />
          )}
        </div>
      </div>

      {/* Extracted data -- visible by default, collapsible */}
      {!collapsed && hasData && (
        <div className="border-t border-slate-100 px-4 py-4 space-y-4 bg-slate-50/50">
          {/* Summary stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { icon: Building2, label: 'Client', value: data.client_name || '\u2014', raw: true },
              { icon: DollarSign, label: 'Monthly', value: data.monthly_total ? `$${Number(data.monthly_total).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '\u2014', raw: true },
              { icon: DollarSign, label: 'Setup', value: data.setup_total ? `$${Number(data.setup_total).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '\u2014', raw: true },
              { icon: Calendar, label: 'Date', value: data.agreement_date || '\u2014', raw: true },
            ].map((s) => (
              <div key={s.label} className="bg-white rounded-lg border border-slate-200 px-3 py-2">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <s.icon className="w-3 h-3 text-slate-400" />
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide">{s.label}</p>
                </div>
                <p className="text-sm font-semibold text-slate-700 truncate">{s.value}</p>
              </div>
            ))}
          </div>

          {/* Extra info row */}
          {(data.hourly_rate || data.term_months || data.cancellation_notice_days) && (
            <div className="flex flex-wrap gap-2 text-[11px]">
              {data.hourly_rate > 0 && (
                <span className="bg-white border border-slate-200 rounded px-2 py-1 text-slate-600">
                  On-site: <strong>${data.hourly_rate}/hr</strong>
                </span>
              )}
              {data.trip_charge > 0 && (
                <span className="bg-white border border-slate-200 rounded px-2 py-1 text-slate-600">
                  Trip: <strong>${data.trip_charge}</strong>
                </span>
              )}
              {data.term_months && (
                <span className="bg-white border border-slate-200 rounded px-2 py-1 text-slate-600">
                  Term: <strong>{data.term_months} months</strong>
                </span>
              )}
              {data.auto_renewal && (
                <span className="bg-amber-50 border border-amber-200 rounded px-2 py-1 text-amber-600">
                  Auto-renews
                </span>
              )}
              {data.cancellation_notice_days && (
                <span className="bg-white border border-slate-200 rounded px-2 py-1 text-slate-600">
                  Cancel notice: <strong>{data.cancellation_notice_days} days</strong>
                </span>
              )}
            </div>
          )}

          {/* Line items table */}
          {lineItems.length > 0 && (
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
              <div className="grid grid-cols-[1fr_60px_70px_80px] gap-1 px-3 py-2 bg-slate-100 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                <span>Product</span>
                <span className="text-right">Qty</span>
                <span className="text-right">Unit</span>
                <span className="text-right">Monthly</span>
              </div>
              <div className="divide-y divide-slate-100">
                {lineItems.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-[1fr_60px_70px_80px] gap-1 px-3 py-2 items-center">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-slate-700 truncate">{item.product}</p>
                      {item.unit && <p className="text-[10px] text-slate-400">per {item.unit}</p>}
                    </div>
                    <p className="text-xs text-slate-600 text-right">{item.quantity}</p>
                    <p className="text-xs text-slate-500 text-right">${Number(item.unit_price || 0).toFixed(2)}</p>
                    <p className="text-xs font-semibold text-slate-700 text-right">${Number(item.monthly_total || 0).toFixed(2)}</p>
                  </div>
                ))}
              </div>
              {/* Totals footer */}
              <div className="grid grid-cols-[1fr_60px_70px_80px] gap-1 px-3 py-2 bg-slate-100 border-t border-slate-200">
                <p className="text-xs font-semibold text-slate-700">Total</p>
                <p className="text-xs text-right text-slate-600">{lineItems.reduce((s, i) => s + (i.quantity || 0), 0)}</p>
                <p className="text-xs text-right"></p>
                <p className="text-xs font-bold text-right text-slate-900">
                  ${lineItems.reduce((s, i) => s + (i.monthly_total || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          )}

          {data.notes && (
            <div className="bg-white rounded-lg border border-slate-200 px-3 py-2">
              <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-1">Notes</p>
              <p className="text-xs text-slate-600">{data.notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
