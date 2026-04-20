import React from 'react';
import { cn } from '@/lib/utils';
import { ArrowLeft, RefreshCw, Check, AlertTriangle, DollarSign, Users, Hash, FileText, Monitor, Server, CheckCircle2 } from 'lucide-react';
import SignOffButton from './SignOffButton';

export default function CustomerDetailHeaderCard({
  customer,
  onBack,
  onSync,
  isSyncing,
  syncStatus,
  healthPct,
  activeIntegrations,
  summary,
  issueCount,
  dollarImpact,
  contacts,
  devices,
  contracts,
  recons,
  pax8Recons,
  allRecons,
  hasUnresolvedItems,
  unresolvedCount,
}) {
  return (
    <div className="relative bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="h-1.5 bg-slate-100">
        <div
          className={cn(
            'h-full transition-all duration-700 rounded-r-full',
            healthPct >= 80 ? 'bg-emerald-500' : healthPct >= 50 ? 'bg-orange-500' : 'bg-red-500'
          )}
          style={{ width: `${healthPct}%` }}
        />
      </div>

      <div className="p-5">
        <div className="flex items-center gap-3 mb-5">
          <button
            onClick={onBack}
            className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center hover:bg-slate-100 transition-colors flex-shrink-0"
          >
            <ArrowLeft className="w-4 h-4 text-slate-500" />
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-slate-900 truncate leading-tight">
              {customer.name}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {activeIntegrations} integration{activeIntegrations !== 1 ? 's' : ''} · {summary?.total || 0} rules tracked
            </p>
          </div>
          <div className={cn(
            'px-3 py-1.5 rounded-lg text-sm font-bold',
            healthPct >= 80 ? 'bg-emerald-50 text-emerald-600' : healthPct >= 50 ? 'bg-orange-50 text-orange-600' : 'bg-red-50 text-red-600'
          )}>
            {healthPct}%
          </div>
          <SignOffButton
            customer={customer}
            reconciliations={recons}
            pax8Reconciliations={pax8Recons}
            unmatchedItems={allRecons.filter(r => r.isUnmatchedLineItem)}
            hasUnresolvedItems={hasUnresolvedItems}
            unresolvedCount={unresolvedCount}
          />
          <button
            onClick={onSync}
            disabled={isSyncing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-pink-500 text-white hover:bg-pink-600 shadow-sm shadow-pink-200 transition-all disabled:opacity-50"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', isSyncing && 'animate-spin')} />
            {isSyncing ? 'Syncing...' : 'Sync'}
          </button>
        </div>
        {syncStatus && (
          <div className="text-xs text-pink-600 font-medium animate-pulse mb-2">
            {syncStatus}
          </div>
        )}

        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-4">
          {[
            { icon: Users, value: contacts.length, label: 'Users', color: 'text-blue-600', bg: 'bg-blue-50' },
            { icon: Monitor, value: devices.filter(d => d.device_type !== 'Server' && d.device_type !== 'server').length, label: 'Workstations', color: 'text-indigo-600', bg: 'bg-indigo-50' },
            { icon: Server, value: devices.filter(d => d.device_type === 'Server' || d.device_type === 'server').length, label: 'Servers', color: 'text-purple-600', bg: 'bg-purple-50' },
            { icon: Hash, value: summary?.total || 0, label: 'Services', color: 'text-slate-600', bg: 'bg-slate-50' },
            { icon: FileText, value: contracts.length, label: 'Contracts', color: 'text-pink-600', bg: 'bg-pink-50' },
            { icon: DollarSign, value: dollarImpact?.totalMonthlyBilled ? `$${Math.round(dollarImpact.totalMonthlyBilled).toLocaleString()}` : '$0', label: 'Monthly', color: 'text-emerald-600', bg: 'bg-emerald-50' },
          ].map((w) => (
            <div key={w.label} className={cn('rounded-xl px-3 py-2 border border-transparent', w.bg)}>
              <div className="flex items-center gap-1.5 mb-0.5">
                <w.icon className={cn('w-3.5 h-3.5', w.color)} />
                <span className={cn('text-lg font-bold leading-none', w.color)}>{w.value}</span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium">{w.label}</p>
            </div>
          ))}
        </div>

        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="bg-emerald-50 rounded-xl border border-emerald-200 px-3 py-2.5">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold text-emerald-600">{summary.matched}</span>
                <Check className="w-4 h-4 text-emerald-400" />
              </div>
              <p className="text-[10px] text-emerald-500 font-medium uppercase tracking-wide mt-0.5">Matched</p>
            </div>
            <div className={cn('rounded-xl border px-3 py-2.5', issueCount > 0 ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200')}>
              <div className="flex items-center justify-between">
                <span className={cn('text-2xl font-bold', issueCount > 0 ? 'text-red-600' : 'text-slate-400')}>{issueCount}</span>
                <AlertTriangle className={cn('w-4 h-4', issueCount > 0 ? 'text-red-400' : 'text-slate-300')} />
              </div>
              <p className={cn('text-[10px] font-medium uppercase tracking-wide mt-0.5', issueCount > 0 ? 'text-red-500' : 'text-slate-400')}>Issues</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 px-3 py-2.5">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold text-slate-600">{summary.reviewed}</span>
                <CheckCircle2 className="w-4 h-4 text-slate-300" />
              </div>
              <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide mt-0.5">Reviewed</p>
            </div>
            {dollarImpact && dollarImpact.underBilledAmount > 0 && (
              <div className="bg-red-50 rounded-xl border border-red-200 px-3 py-2.5">
                <span className="text-lg font-bold text-red-600 leading-tight">
                  ${dollarImpact.underBilledAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
                <p className="text-[10px] text-red-500 font-medium uppercase tracking-wide mt-0.5">Under-billed</p>
              </div>
            )}
            {dollarImpact && dollarImpact.overBilledAmount > 0 && (
              <div className="bg-orange-50 rounded-xl border border-orange-200 px-3 py-2.5">
                <span className="text-lg font-bold text-orange-600 leading-tight">
                  ${dollarImpact.overBilledAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
                <p className="text-[10px] text-orange-500 font-medium uppercase tracking-wide mt-0.5">Over-billed</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
