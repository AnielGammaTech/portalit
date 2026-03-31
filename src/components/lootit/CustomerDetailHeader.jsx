import React from 'react';
import { cn } from '@/lib/utils';
import { STATUS_COLORS, BILLING_STATUS_CONFIG } from './lootit-constants';
import { ArrowLeft, RefreshCw, Users, Monitor, Server, Hash, FileText, DollarSign, Check, AlertTriangle, CheckCircle2, MapPin, Mail } from 'lucide-react';

export default function CustomerDetailHeader({ customer, onBack, onSync, isSyncing, healthPct, activeIntegrations, summary, contacts, devices, contracts, dollarImpact, issueCount, financialSummary }) {
  const primaryContact = contacts.length > 0 ? contacts[0] : null;

  return (
    <div className="rounded-2xl border border-pink-200/60 shadow-sm overflow-hidden bg-white">
      {/* Health bar */}
      <div className="h-1 bg-pink-100">
        <div
          className={cn(
            'h-full transition-all duration-700 rounded-r-full',
            healthPct >= 80 ? 'bg-emerald-500' : healthPct >= 50 ? 'bg-amber-500' : 'bg-red-500'
          )}
          style={{ width: `${healthPct}%` }}
        />
      </div>

      <div className="px-5 py-4">
        {/* Row 1: Name + Contact + Actions */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <button
              onClick={onBack}
              className="w-8 h-8 mt-0.5 rounded-lg bg-pink-50 hover:bg-pink-100 flex items-center justify-center transition-colors flex-shrink-0"
            >
              <ArrowLeft className="w-4 h-4 text-pink-600" />
            </button>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-bold text-slate-900 truncate leading-tight">
                {customer.name}
              </h2>
              <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                {primaryContact ? (
                  <>
                    <Mail className="w-3 h-3 text-pink-400 shrink-0" />
                    <span className="truncate">{primaryContact.full_name}{primaryContact.email ? ` · ${primaryContact.email}` : ''}</span>
                  </>
                ) : (
                  <span className="text-slate-300">No contact on file</span>
                )}
                {customer.address && (
                  <>
                    <span className="text-slate-200">|</span>
                    <MapPin className="w-3 h-3 text-pink-400 shrink-0" />
                    <span className="truncate">{customer.address}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <div className={cn(
              'px-2.5 py-1 rounded-full text-xs font-bold tabular-nums border',
              healthPct >= 80 ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : healthPct >= 50 ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-red-50 text-red-600 border-red-200'
            )}>
              {healthPct}%
            </div>
            <button
              onClick={onSync}
              disabled={isSyncing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-pink-500 text-white hover:bg-pink-600 shadow-sm transition-all disabled:opacity-50"
            >
              <RefreshCw className={cn('w-3.5 h-3.5', isSyncing && 'animate-spin')} />
              {isSyncing ? 'Syncing...' : 'Sync'}
            </button>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-pink-100/60 my-3" />

        {/* Row 2: Stats strip — all in one tight row */}
        <div className="flex items-center gap-3 overflow-x-auto pb-1">
          {[
            { icon: Users, value: contacts.length, label: 'Users', color: 'text-blue-600' },
            { icon: Monitor, value: devices.filter(d => d.device_type !== 'Server' && d.device_type !== 'server').length, label: 'Workstations', color: 'text-indigo-600' },
            { icon: Server, value: devices.filter(d => d.device_type === 'Server' || d.device_type === 'server').length, label: 'Servers', color: 'text-purple-600' },
            { icon: Hash, value: summary?.total || 0, label: 'Services', color: 'text-slate-500' },
            { icon: FileText, value: contracts.length, label: 'Contracts', color: 'text-cyan-600' },
            { icon: DollarSign, value: dollarImpact?.totalMonthlyBilled ? `$${Math.round(dollarImpact.totalMonthlyBilled).toLocaleString()}` : '$0', label: 'Monthly', color: 'text-emerald-600' },
          ].map((w) => (
            <div key={w.label} className="flex items-center gap-1.5 whitespace-nowrap">
              <w.icon className={cn('w-3.5 h-3.5', w.color)} />
              <span className={cn('text-sm font-bold tabular-nums', w.color)}>{w.value}</span>
              <span className="text-[10px] text-slate-400">{w.label}</span>
            </div>
          ))}

          {/* Financial summary inline */}
          {financialSummary && financialSummary.mrr > 0 && (
            <>
              <div className="w-px h-4 bg-slate-200 mx-1" />
              <div className="flex items-center gap-1.5 whitespace-nowrap">
                <span className="text-[10px] text-slate-400">MRR</span>
                <span className="text-sm font-bold text-slate-700 tabular-nums">
                  ${financialSummary.mrr.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </span>
              </div>
            </>
          )}
          {financialSummary && (
            <>
              <div className="w-px h-4 bg-slate-200 mx-1" />
              <span className={cn(
                'inline-block px-2 py-0.5 text-[10px] font-semibold rounded-full border',
                BILLING_STATUS_CONFIG[financialSummary.billingStatus].className
              )}>
                {BILLING_STATUS_CONFIG[financialSummary.billingStatus].label}
              </span>
            </>
          )}
        </div>

        {/* Divider */}
        <div className="border-t border-pink-100/60 my-3" />

        {/* Row 3: Reconciliation summary — compact pills */}
        {summary && (
          <div className="flex items-center gap-2">
            <div className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg border', STATUS_COLORS.match.bg, STATUS_COLORS.match.border)}>
              <Check className={cn('w-3.5 h-3.5', STATUS_COLORS.match.icon)} />
              <span className={cn('text-sm font-bold tabular-nums', STATUS_COLORS.match.text)}>{summary.matched}</span>
              <span className={cn('text-[10px]', STATUS_COLORS.match.labelText)}>Matched</span>
            </div>
            <div className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg border',
              issueCount > 0 ? cn(STATUS_COLORS.under.bg, STATUS_COLORS.under.border) : cn(STATUS_COLORS.neutral.bg, STATUS_COLORS.neutral.border)
            )}>
              <AlertTriangle className={cn('w-3.5 h-3.5', issueCount > 0 ? STATUS_COLORS.under.icon : 'text-slate-300')} />
              <span className={cn('text-sm font-bold tabular-nums', issueCount > 0 ? STATUS_COLORS.under.text : STATUS_COLORS.neutral.text)}>{issueCount}</span>
              <span className={cn('text-[10px]', issueCount > 0 ? STATUS_COLORS.under.labelText : STATUS_COLORS.neutral.labelText)}>Issues</span>
            </div>
            {dollarImpact && dollarImpact.underBilledAmount > 0 && (
              <div className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg border', STATUS_COLORS.under.bg, STATUS_COLORS.under.border)}>
                <span className={cn('text-sm font-bold tabular-nums', STATUS_COLORS.under.text)}>
                  ${dollarImpact.underBilledAmount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </span>
                <span className={cn('text-[10px]', STATUS_COLORS.under.labelText)}>Under</span>
              </div>
            )}
            {dollarImpact && dollarImpact.overBilledAmount > 0 && (
              <div className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg border', STATUS_COLORS.over.bg, STATUS_COLORS.over.border)}>
                <span className={cn('text-sm font-bold tabular-nums', STATUS_COLORS.over.text)}>
                  ${dollarImpact.overBilledAmount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </span>
                <span className={cn('text-[10px]', STATUS_COLORS.over.labelText)}>Over</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
