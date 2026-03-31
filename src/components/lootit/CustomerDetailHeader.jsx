import React from 'react';
import { cn } from '@/lib/utils';
import { STATUS_COLORS } from './lootit-constants';
import { ArrowLeft, RefreshCw, Users, Monitor, Server, Hash, FileText, DollarSign, Check, AlertTriangle, CheckCircle2 } from 'lucide-react';

export default function CustomerDetailHeader({ customer, onBack, onSync, isSyncing, healthPct, activeIntegrations, summary, contacts, devices, contracts, dollarImpact, issueCount }) {
  return (
    <div className="relative rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Health bar */}
      <div className="h-1.5 bg-slate-800">
        <div
          className={cn(
            'h-full transition-all duration-700 rounded-r-full',
            healthPct >= 80 ? 'bg-emerald-500' : healthPct >= 50 ? 'bg-amber-500' : 'bg-red-500'
          )}
          style={{ width: `${healthPct}%` }}
        />
      </div>

      {/* Dark/navy header band */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-5 py-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors flex-shrink-0"
          >
            <ArrowLeft className="w-4 h-4 text-white" />
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-white truncate leading-tight">
              {customer.name}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {activeIntegrations} integration{activeIntegrations !== 1 ? 's' : ''} · {summary?.total || 0} rules tracked
            </p>
          </div>
          <div className={cn(
            'px-3 py-1.5 rounded-lg text-sm font-bold',
            healthPct >= 80 ? 'bg-emerald-500/20 text-emerald-300' : healthPct >= 50 ? 'bg-amber-500/20 text-amber-300' : 'bg-red-500/20 text-red-300'
          )}>
            {healthPct}%
          </div>
          <button
            onClick={onSync}
            disabled={isSyncing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white text-slate-900 hover:bg-slate-100 shadow-sm transition-all disabled:opacity-50"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', isSyncing && 'animate-spin')} />
            {isSyncing ? 'Syncing...' : 'Sync'}
          </button>
        </div>
      </div>

      {/* Light content area */}
      <div className="bg-white px-4 py-4 space-y-4 rounded-b-2xl">
        {/* Integration widgets grid */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {[
            { icon: Users, value: contacts.length, label: 'Users', color: 'text-blue-600', bg: 'bg-blue-50' },
            { icon: Monitor, value: devices.filter(d => d.device_type !== 'Server' && d.device_type !== 'server').length, label: 'Workstations', color: 'text-indigo-600', bg: 'bg-indigo-50' },
            { icon: Server, value: devices.filter(d => d.device_type === 'Server' || d.device_type === 'server').length, label: 'Servers', color: 'text-purple-600', bg: 'bg-purple-50' },
            { icon: Hash, value: summary?.total || 0, label: 'Services', color: 'text-slate-600', bg: 'bg-slate-50' },
            { icon: FileText, value: contracts.length, label: 'Contracts', color: 'text-cyan-600', bg: 'bg-cyan-50' },
            { icon: DollarSign, value: dollarImpact?.totalMonthlyBilled ? `$${Math.round(dollarImpact.totalMonthlyBilled).toLocaleString()}` : '$0', label: 'Monthly', color: 'text-emerald-600', bg: 'bg-emerald-50' },
          ].map((w) => (
            <div key={w.label} className={cn('rounded-xl px-3 py-2.5 border border-transparent', w.bg)}>
              <div className="flex items-center gap-1.5 mb-0.5">
                <w.icon className={cn('w-3.5 h-3.5', w.color)} />
                <span className={cn('text-xl font-bold tabular-nums leading-none', w.color)}>{w.value}</span>
              </div>
              <p className="text-[10px] uppercase tracking-wide font-medium text-muted-foreground">{w.label}</p>
            </div>
          ))}
        </div>

        {/* Reconciliation summary boxes */}
        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className={cn(STATUS_COLORS.match.bg, 'rounded-xl border', STATUS_COLORS.match.border, 'px-3 py-2.5')}>
              <div className="flex items-center justify-between">
                <span className={cn('text-2xl font-bold tabular-nums', STATUS_COLORS.match.text)}>{summary.matched}</span>
                <Check className={cn('w-4 h-4', STATUS_COLORS.match.icon)} />
              </div>
              <p className={cn('text-[10px] font-medium uppercase tracking-wide mt-0.5', STATUS_COLORS.match.labelText)}>Matched</p>
            </div>
            <div className={cn('rounded-xl border px-3 py-2.5', issueCount > 0 ? cn(STATUS_COLORS.under.bg, STATUS_COLORS.under.border) : cn(STATUS_COLORS.neutral.bg, STATUS_COLORS.neutral.border))}>
              <div className="flex items-center justify-between">
                <span className={cn('text-2xl font-bold tabular-nums', issueCount > 0 ? STATUS_COLORS.under.text : STATUS_COLORS.neutral.text)}>{issueCount}</span>
                <AlertTriangle className={cn('w-4 h-4', issueCount > 0 ? STATUS_COLORS.under.icon : 'text-slate-300')} />
              </div>
              <p className={cn('text-[10px] font-medium uppercase tracking-wide mt-0.5', issueCount > 0 ? STATUS_COLORS.under.labelText : STATUS_COLORS.neutral.labelText)}>Issues</p>
            </div>
            <div className={cn(STATUS_COLORS.reviewed.bg, 'rounded-xl border', STATUS_COLORS.reviewed.border, 'px-3 py-2.5')}>
              <div className="flex items-center justify-between">
                <span className={cn('text-2xl font-bold tabular-nums', STATUS_COLORS.reviewed.text)}>{summary.reviewed}</span>
                <CheckCircle2 className={cn('w-4 h-4', STATUS_COLORS.reviewed.icon)} />
              </div>
              <p className={cn('text-[10px] font-medium uppercase tracking-wide mt-0.5', STATUS_COLORS.reviewed.labelText)}>Reviewed</p>
            </div>
            {dollarImpact && dollarImpact.underBilledAmount > 0 && (
              <div className={cn(STATUS_COLORS.under.bg, 'rounded-xl border', STATUS_COLORS.under.border, 'px-3 py-2.5')}>
                <span className={cn('text-2xl font-bold tabular-nums leading-tight', STATUS_COLORS.under.text)}>
                  ${dollarImpact.underBilledAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
                <p className={cn('text-[10px] font-medium uppercase tracking-wide mt-0.5', STATUS_COLORS.under.labelText)}>Under-billed</p>
              </div>
            )}
            {dollarImpact && dollarImpact.overBilledAmount > 0 && (
              <div className={cn(STATUS_COLORS.over.bg, 'rounded-xl border', STATUS_COLORS.over.border, 'px-3 py-2.5')}>
                <span className={cn('text-2xl font-bold tabular-nums leading-tight', STATUS_COLORS.over.text)}>
                  ${dollarImpact.overBilledAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
                <p className={cn('text-[10px] font-medium uppercase tracking-wide mt-0.5', STATUS_COLORS.over.labelText)}>Over-billed</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
