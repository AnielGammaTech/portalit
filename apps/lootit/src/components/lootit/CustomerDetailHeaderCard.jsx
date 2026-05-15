import React from 'react';
import { cn } from '@/lib/utils';
import { ArrowLeft, RefreshCw, AlertTriangle, Activity, ShieldCheck, AlertCircle } from 'lucide-react';
import SignOffButton from './SignOffButton';

function MiniStat({ icon: Icon, label, value, sub, color }) {
  const colors = {
    emerald: 'bg-emerald-50 border-emerald-100',
    amber: 'bg-amber-50 border-amber-100',
    red: 'bg-red-50 border-red-100',
    slate: 'bg-slate-50 border-slate-100',
  };
  const textColors = {
    emerald: 'text-emerald-600',
    amber: 'text-amber-600',
    red: 'text-red-600',
    slate: 'text-slate-600',
  };

  return (
    <div className={cn('flex-1 rounded-xl border px-3.5 py-2.5', colors[color] || colors.slate)}>
      <div className="flex items-center gap-1.5 mb-1">
        {Icon && <Icon className={cn('w-3 h-3', textColors[color] || textColors.slate)} />}
        <span className={cn('text-[10px] font-semibold uppercase tracking-wider', textColors[color] || textColors.slate)} style={{ opacity: 0.7 }}>
          {label}
        </span>
      </div>
      <p className={cn('text-xl font-bold leading-tight tabular-nums', textColors[color] || textColors.slate)}>
        {value}
      </p>
      {sub && (
        <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>
      )}
    </div>
  );
}

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

  const healthColor = healthPct >= 80 ? 'emerald' : healthPct >= 50 ? 'amber' : 'red';
  const verifyColor = allVerified ? 'emerald' : pct >= 50 ? 'amber' : 'red';

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="h-1.5 bg-slate-100">
        <div
          className={cn(
            'h-full transition-all duration-700 rounded-r-full',
            healthPct >= 80 ? 'bg-emerald-500' : healthPct >= 50 ? 'bg-amber-500' : 'bg-red-500'
          )}
          style={{ width: `${healthPct}%` }}
        />
      </div>

      <div className="px-5 py-4 space-y-4">
        <div className="flex items-start gap-3">
          <button
            onClick={onBack}
            className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center hover:bg-slate-100 transition-colors shrink-0 cursor-pointer mt-0.5"
          >
            <ArrowLeft className="w-4 h-4 text-slate-500" />
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-slate-900 truncate leading-tight">
              {customer.name}
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                <Activity className="w-3 h-3" />
                {activeIntegrations} integration{activeIntegrations !== 1 ? 's' : ''}
              </span>
              <span className="text-slate-200">·</span>
              <span className="text-[11px] text-slate-400">
                {summary?.total || 0} rules
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onSync}
              disabled={isSyncing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={cn('w-3.5 h-3.5', isSyncing && 'animate-spin')} />
              {isSyncing ? 'Syncing\u2026' : 'Sync'}
            </button>
            <SignOffButton
              customer={customer}
              reconciliations={recons}
              pax8Reconciliations={pax8Recons}
              unmatchedItems={allRecons.filter(r => r.isUnmatchedLineItem)}
              hasUnresolvedItems={hasUnresolvedItems}
              unresolvedCount={unresolvedCount}
            />
          </div>
        </div>

        {syncStatus && (
          <p className="text-xs text-pink-600 font-medium animate-pulse">{syncStatus}</p>
        )}

        {signOffExpired && (
          <div className={cn(
            'flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-medium',
            daysSinceSignOff !== null && daysSinceSignOff >= 45
              ? 'bg-red-50 border border-red-200/60 text-red-700'
              : 'bg-amber-50 border border-amber-200/60 text-amber-700'
          )}>
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <div>
              <span className="font-semibold">
                {daysSinceSignOff === null ? 'Never signed off' : `${daysSinceSignOff} days since sign-off`}
              </span>
              <span className="opacity-70 ml-1.5">
                {daysSinceSignOff !== null && daysSinceSignOff >= 45
                  ? '— reconciliation overdue'
                  : '— reconciliation due'}
              </span>
            </div>
          </div>
        )}

        <div className="flex gap-2.5">
          <MiniStat
            icon={ShieldCheck}
            label="Health"
            value={`${healthPct}%`}
            sub={healthPct >= 80 ? 'Healthy' : healthPct >= 50 ? 'Needs attention' : 'Critical'}
            color={healthColor}
          />
          {verificationState && (
            <MiniStat
              icon={Activity}
              label="Verified"
              value={`${verified}/${total}`}
              sub={allVerified ? 'All verified' : `${remaining} remaining`}
              color={verifyColor}
            />
          )}
          <MiniStat
            icon={AlertCircle}
            label="Unresolved"
            value={unresolvedCount || 0}
            sub={unresolvedCount > 0 ? 'Need review' : 'All clear'}
            color={unresolvedCount > 0 ? 'red' : 'emerald'}
          />
        </div>
      </div>
    </div>
  );
}
