import React from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, CalendarClock, ChevronRight, Filter, Link2, ClipboardCheck } from 'lucide-react';
import ServiceCard from './ServiceCard';
import Pax8SubscriptionCard from './Pax8SubscriptionCard';

export default function CustomerDetailReconciliationTab({
  filteredRecons,
  filteredPax8,
  statusFilter,
  onFilterChange,
  allRecons,
  summary,
  issueCount,
  existingOverrides,
  onDetails,
  onShowGroupMapper,
  stalenessMap,
  staleCount,
  onSignOff,
  customerId,
  vendorMappings,
  verificationState,
  issueItems = [],
  reconciliationCycle,
}) {
  const unverifiedCount = verificationState ? verificationState.total - verificationState.verified : 0;
  const cycleToneClass = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    slate: 'bg-slate-50 text-slate-600 border-slate-200',
  }[reconciliationCycle?.tone || 'slate'];

  const reasonLabel = (reason) => ({
    over: 'PSA over vendor',
    under: 'Vendor over PSA',
    missing_from_psa: 'Vendor not billed',
    no_psa_data: 'No PSA',
    unmatched_line_item: 'Unmapped billing item',
    no_vendor_data: 'No vendor',
    changed: 'Changed',
    stale: 'Stale',
    unverified: 'Needs verification',
  }[reason] || reason);

  return (
    <>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1 flex-wrap">
          {[
            { key: 'unverified', label: 'To Review', count: unverifiedCount },
            { key: 'all', label: 'All', count: allRecons.filter(r => r.status !== 'no_data').length },
            { key: 'issues', label: 'Issues', count: issueCount },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => onFilterChange(f.key)}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer',
                statusFilter === f.key
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-500 hover:bg-slate-100'
              )}
            >
              {f.label}
              <span className={cn(
                'text-[10px] tabular-nums font-semibold',
                statusFilter === f.key ? 'text-slate-300' : 'text-slate-400'
              )}>
                {f.count}
              </span>
            </button>
          ))}
        </div>
        {onSignOff ? (
          <button
            onClick={onSignOff}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors cursor-pointer"
          >
            <ClipboardCheck className="w-3.5 h-3.5" />
            Sign Off
          </button>
        ) : verificationState && !verificationState.allVerified ? (
          <span className="text-[11px] font-medium text-slate-400 tabular-nums">
            {verificationState.verified}/{verificationState.total} verified
          </span>
        ) : null}
      </div>

      {reconciliationCycle && (
        <div className={cn('flex items-center justify-between gap-3 rounded-lg border px-4 py-3', cycleToneClass)}>
          <div className="flex items-center gap-2">
            <CalendarClock className="w-4 h-4" />
            <div>
              <p className="text-sm font-semibold">{reconciliationCycle.label} Reconciliation</p>
              <p className="text-[11px] opacity-70">
                {verificationState.verified}/{verificationState.total} verified · {reconciliationCycle.statusLabel}
              </p>
            </div>
          </div>
          {reconciliationCycle.nextDueAt && (
            <span className="text-[11px] font-medium opacity-75">
              Next due {new Date(reconciliationCycle.nextDueAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}
        </div>
      )}

      {statusFilter === 'issues' && issueItems.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/40 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2 border-b border-amber-100">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <p className="text-sm font-semibold text-slate-800">Issue Queue</p>
            <span className="text-[10px] font-bold text-amber-700 bg-amber-100 rounded-full px-1.5 py-0.5">
              {issueItems.length}
            </span>
          </div>
          <div className="divide-y divide-amber-100">
            {issueItems.slice(0, 12).map((item) => (
              <button
                key={item.ruleId}
                type="button"
                onClick={() => onDetails?.(item.tile)}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-white/60 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-800 truncate">{item.label}</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {item.reasons.map((reason) => (
                      <span key={reason} className="text-[10px] font-medium text-amber-700 bg-amber-100 rounded-full px-1.5 py-0.5">
                        {reasonLabel(reason)}
                      </span>
                    ))}
                  </div>
                </div>
                <span className="text-xs font-semibold tabular-nums text-slate-600 shrink-0">
                  {item.psaQty ?? '\u2014'} / {item.vendorQty ?? '\u2014'}
                </span>
                <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}

      {filteredRecons.length === 0 && filteredPax8.length === 0 ? (
        <div className="text-center py-12">
          <Filter className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">
            {statusFilter === 'all'
              ? 'No reconciliation data for this customer'
              : 'No services match this filter'}
          </p>
        </div>
      ) : filteredRecons.length === 0 ? null : (
        <div className="grid grid-cols-4 gap-3 auto-rows-fr">
          {filteredRecons.map((recon) => (
            <ServiceCard
              key={recon.rule.id}
              reconciliation={recon}
              onDetails={onDetails}
              staleness={stalenessMap?.[recon.rule.id]}
              isVerified={verificationState?.verifiedMap?.[recon.rule.id] || false}
              hasOverride={existingOverrides.some((o) => o.rule_id === recon.rule.id)}
              overrideCount={existingOverrides.filter((o) => o.rule_id === recon.rule.id && o.pax8_product_name !== 'approved_as_is').length}
            />
          ))}
        </div>
      )}

      {filteredPax8.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700">
              Pax8 / M365 Licence Reconciliation
            </h3>
            <button
              onClick={onShowGroupMapper}
              className="text-[10px] font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors"
            >
              <Link2 className="w-3 h-3" />
              Group Map
            </button>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {filteredPax8.map((recon) => (
              <Pax8SubscriptionCard
                key={recon.ruleId}
                recon={recon}
                onDetails={onDetails}
                staleness={stalenessMap?.[recon.ruleId]}
                isVerified={verificationState?.verifiedMap?.[recon.ruleId] || false}
                hasOverride={existingOverrides.some((o) => o.rule_id === recon.ruleId)}
              />
            ))}
          </div>
        </div>
      )}
    </>
  );
}
