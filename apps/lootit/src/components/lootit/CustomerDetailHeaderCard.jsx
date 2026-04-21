import React from 'react';
import { cn } from '@/lib/utils';
import { ArrowLeft, RefreshCw, AlertTriangle, ClipboardCheck } from 'lucide-react';
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
        <div className="flex items-center gap-3 mb-4">
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

        {signOffExpired && (
          <div className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium mb-3',
            daysSinceSignOff !== null && daysSinceSignOff >= 45
              ? 'bg-red-50 border border-red-200 text-red-700'
              : 'bg-amber-50 border border-amber-200 text-amber-700'
          )}>
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            <span>
              {daysSinceSignOff === null
                ? 'Reconciliation due — never signed off'
                : `Reconciliation due — last signed off ${daysSinceSignOff} days ago`}
            </span>
          </div>
        )}

        {verificationState && (
          <div className="bg-slate-50 rounded-xl border border-slate-200 px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <ClipboardCheck className={cn('w-4 h-4', verificationState.allVerified ? 'text-emerald-500' : 'text-pink-500')} />
                <span className="text-xs font-semibold text-slate-700">
                  Audit Progress
                </span>
              </div>
              <span className={cn(
                'text-sm font-bold tabular-nums',
                verificationState.allVerified ? 'text-emerald-600' : verificationState.pct >= 50 ? 'text-amber-600' : 'text-pink-600'
              )}>
                {verificationState.verified}/{verificationState.total} verified
              </span>
            </div>
            <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full transition-all duration-700 rounded-full',
                  verificationState.allVerified ? 'bg-emerald-500' : verificationState.pct >= 50 ? 'bg-amber-500' : 'bg-pink-500'
                )}
                style={{ width: `${verificationState.pct}%` }}
              />
            </div>
            {verificationState.allVerified && (
              <p className="text-[11px] text-emerald-600 font-medium mt-1.5">All tiles verified — ready to sign off</p>
            )}
            {!verificationState.allVerified && verificationState.unverified.length > 0 && (
              <p className="text-[11px] text-slate-400 mt-1.5">
                {verificationState.unverified.length} tile{verificationState.unverified.length > 1 ? 's' : ''} need{verificationState.unverified.length === 1 ? 's' : ''} review before sign-off
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
