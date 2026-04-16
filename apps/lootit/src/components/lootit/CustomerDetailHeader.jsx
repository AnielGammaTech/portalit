import React from 'react';
import { cn } from '@/lib/utils';
import { STATUS_COLORS, BILLING_STATUS_CONFIG } from './lootit-constants';
import { ArrowLeft, RefreshCw, Users, Monitor, Server, Hash, FileText, DollarSign, Check, AlertTriangle, ExternalLink } from 'lucide-react';

const PORTALIT_URL = import.meta.env.VITE_PORTALIT_URL || 'https://portalit.gtools.io';

export default function CustomerDetailHeader({ customer, onBack, onSync, isSyncing, healthPct, activeIntegrations, summary, contacts, devices, contracts, dollarImpact, issueCount, financialSummary }) {
  const workstationCount = devices.filter(d => d.device_type !== 'Server' && d.device_type !== 'server').length;
  const serverCount = devices.filter(d => d.device_type === 'Server' || d.device_type === 'server').length;

  const statsItems = [
    { icon: Users, value: contacts.length, label: 'Users' },
    { icon: Monitor, value: workstationCount, label: 'Workstations' },
    { icon: Server, value: serverCount, label: 'Servers' },
    { icon: Hash, value: summary?.total || 0, label: 'Services' },
    { icon: FileText, value: contracts.length, label: 'Contracts' },
    { icon: DollarSign, value: dollarImpact?.totalMonthlyBilled ? `$${Math.round(dollarImpact.totalMonthlyBilled).toLocaleString()}` : '$0', label: 'Monthly' },
  ];

  const healthColor = healthPct >= 80
    ? 'bg-emerald-500 text-white'
    : healthPct >= 50
      ? 'bg-amber-500 text-white'
      : 'bg-red-500 text-white';

  return (
    <div className="rounded-2xl overflow-hidden shadow-sm">
      {/* Dark rose header band */}
      <div
        className="px-5 py-4"
        style={{ background: 'linear-gradient(135deg, #2E0820 0%, #3D1230 100%)' }}
      >
        {/* Row 1: Back + Name + Health + Sync */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <button
              onClick={onBack}
              className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors flex-shrink-0"
            >
              <ArrowLeft className="w-4 h-4 text-pink-300" />
            </button>
            <h2 className="text-lg font-bold text-white truncate leading-tight">
              <a
                href={`${PORTALIT_URL}/CustomerDetail/${customer.id}`}
                className="hover:underline inline-flex items-center gap-1.5"
              >
                {customer.name}
                <ExternalLink className="w-3.5 h-3.5 text-pink-300 shrink-0" />
              </a>
            </h2>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <div className={cn('px-2.5 py-1 rounded-full text-xs font-bold tabular-nums', healthColor)}>
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

        {/* Row 2: Stats strip */}
        <div className="flex items-center gap-2 mt-3 overflow-x-auto pb-1">
          {statsItems.map((w) => (
            <div
              key={w.label}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 whitespace-nowrap"
            >
              <w.icon className="w-3.5 h-3.5 text-pink-300" />
              <span className="text-sm font-bold tabular-nums text-white">{w.value}</span>
              <span className="text-[10px] text-pink-300/80">{w.label}</span>
            </div>
          ))}

          {/* MRR */}
          {financialSummary && financialSummary.mrr > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 whitespace-nowrap">
              <span className="text-[10px] text-pink-300/80">MRR</span>
              <span className="text-sm font-bold text-white tabular-nums">
                ${financialSummary.mrr.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </span>
            </div>
          )}

          {/* Billing status */}
          {financialSummary && (
            <span className={cn(
              'inline-block px-2.5 py-1 text-[10px] font-semibold rounded-full',
              BILLING_STATUS_CONFIG[financialSummary.billingStatus].className
            )}>
              {BILLING_STATUS_CONFIG[financialSummary.billingStatus].label}
            </span>
          )}
        </div>

        {/* Row 3: Reconciliation summary pills */}
        {summary && (
          <div className="flex items-center gap-2 mt-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 whitespace-nowrap">
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-sm font-bold tabular-nums text-emerald-300">{summary.matched}</span>
              <span className="text-[10px] text-emerald-400/70">Matched</span>
            </div>
            <div className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg whitespace-nowrap',
              issueCount > 0 ? 'bg-red-500/20' : 'bg-white/5'
            )}>
              <AlertTriangle className={cn('w-3.5 h-3.5', issueCount > 0 ? 'text-red-400' : 'text-white/30')} />
              <span className={cn('text-sm font-bold tabular-nums', issueCount > 0 ? 'text-red-300' : 'text-white/40')}>{issueCount}</span>
              <span className={cn('text-[10px]', issueCount > 0 ? 'text-red-400/70' : 'text-white/30')}>Issues</span>
            </div>
            {dollarImpact && dollarImpact.underBilledAmount > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/20 whitespace-nowrap">
                <span className="text-sm font-bold tabular-nums text-red-300">
                  ${dollarImpact.underBilledAmount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </span>
                <span className="text-[10px] text-red-400/70">Under</span>
              </div>
            )}
            {dollarImpact && dollarImpact.overBilledAmount > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 whitespace-nowrap">
                <span className="text-sm font-bold tabular-nums text-amber-300">
                  ${dollarImpact.overBilledAmount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </span>
                <span className="text-[10px] text-amber-400/70">Over</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
