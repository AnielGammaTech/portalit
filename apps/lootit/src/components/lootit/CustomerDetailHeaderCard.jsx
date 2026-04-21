import React from 'react';
import { cn } from '@/lib/utils';
import { ArrowLeft, RefreshCw, AlertTriangle } from 'lucide-react';
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
  recons,
  pax8Recons,
  allRecons,
  hasUnresolvedItems,
  unresolvedCount,
  signOffExpired,
  daysSinceSignOff,
  verificationState,
}) {
  const verified = verificationState?.verified ?? 0;
  const total = verificationState?.total ?? 0;
  const pct = verificationState?.pct ?? 0;
  const allVerified = verificationState?.allVerified ?? false;
  const remaining = total - verified;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="h-1 bg-slate-100">
        <div
          className={cn(
            'h-full transition-all duration-700',
            healthPct >= 80 ? 'bg-emerald-400' : healthPct >= 50 ? 'bg-amber-400' : 'bg-red-400'
          )}
          style={{ width: `${healthPct}%` }}
        />
      </div>

      <div className="px-5 py-4 space-y-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center hover:bg-slate-100 transition-colors shrink-0 cursor-pointer"
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
            'px-2.5 py-1 rounded-full text-xs font-bold tabular-nums shrink-0',
            healthPct >= 80 ? 'bg-emerald-50 text-emerald-600' : healthPct >= 50 ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-600'
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
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', isSyncing && 'animate-spin')} />
            {isSyncing ? 'Syncing\u2026' : 'Sync'}
          </button>
        </div>

        {syncStatus && (
          <p className="text-xs text-pink-600 font-medium animate-pulse">{syncStatus}</p>
        )}

        {signOffExpired && (
          <div className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium',
            daysSinceSignOff !== null && daysSinceSignOff >= 45
              ? 'bg-red-50 border border-red-200/60 text-red-700'
              : 'bg-amber-50 border border-amber-200/60 text-amber-700'
          )}>
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            {daysSinceSignOff === null
              ? 'Reconciliation due \u2014 never signed off'
              : `Reconciliation due \u2014 last signed off ${daysSinceSignOff} days ago`}
          </div>
        )}

        {verificationState && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-3">
              <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-700',
                    allVerified ? 'bg-emerald-400' : pct >= 50 ? 'bg-amber-400' : 'bg-pink-400'
                  )}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className={cn(
                'text-xs font-bold tabular-nums shrink-0',
                allVerified ? 'text-emerald-600' : pct >= 50 ? 'text-amber-600' : 'text-pink-600'
              )}>
                {verified}/{total} verified
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              {allVerified
                ? 'All tiles verified \u2014 ready to sign off'
                : `${remaining} tile${remaining !== 1 ? 's' : ''} need${remaining === 1 ? 's' : ''} review`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
