import React from 'react';
import { cn } from '@/lib/utils';
import { Filter, Link2, ClipboardCheck } from 'lucide-react';
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
  isSaving,
  onReview,
  onDismiss,
  onReset,
  onDetails,
  onEditRule,
  onSaveNotes,
  onForceMatch,
  onMapLineItem,
  onRemoveMapping,
  onShowGroupMapper,
  stalenessMap,
  staleCount,
  onSignOff,
}) {
  return (
    <>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1.5">
          {[
            { key: 'all', label: 'All', count: allRecons.filter(r => r.status !== 'no_data').length },
            { key: 'issues', label: 'Issues', count: issueCount },
            { key: 'stale', label: 'Stale', count: staleCount || 0 },
            { key: 'matched', label: 'Matched', count: (summary?.matched || 0) + (summary?.forceMatched || 0) },
            { key: 'reviewed', label: 'Reviewed', count: summary?.reviewed || 0 },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => onFilterChange(f.key)}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
                statusFilter === f.key
                  ? 'bg-pink-500 text-white shadow-sm shadow-pink-200'
                  : 'bg-white text-slate-500 border border-slate-200 hover:bg-pink-50'
              )}
            >
              {f.label}
              <span className={cn(
                'text-[10px] px-1.5 py-0.5 rounded-full',
                statusFilter === f.key ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-400'
              )}>
                {f.count}
              </span>
            </button>
          ))}
        </div>
        {onSignOff && (
          <button
            onClick={onSignOff}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors"
          >
            <ClipboardCheck className="w-3.5 h-3.5" />
            Sign Off Reconciliation
          </button>
        )}
      </div>

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
              onReview={onReview}
              onDismiss={onDismiss}
              onReset={onReset}
              onDetails={onDetails}
              onEditRule={onEditRule}
              onSaveNotes={onSaveNotes}
              onForceMatch={onForceMatch}
              onMapLineItem={onMapLineItem}
              onRemoveMapping={onRemoveMapping}
              hasOverride={existingOverrides.some((o) => o.rule_id === recon.rule.id)}
              overrideCount={existingOverrides.filter((o) => o.rule_id === recon.rule.id && o.pax8_product_name !== 'approved_as_is').length}
              isSaving={isSaving}
              staleness={stalenessMap?.[recon.rule.id]}
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
                onReview={onReview}
                onDismiss={onDismiss}
                onReset={onReset}
                onForceMatch={onForceMatch}
                onDetails={onDetails}
                onMapLineItem={() => onMapLineItem(recon)}
                onRemoveMapping={() => onRemoveMapping(recon.ruleId)}
                onSaveNotes={onSaveNotes}
                hasOverride={existingOverrides.some((o) => o.rule_id === recon.ruleId)}
                isSaving={isSaving}
                staleness={stalenessMap?.[recon.ruleId]}
              />
            ))}
          </div>
        </div>
      )}
    </>
  );
}
