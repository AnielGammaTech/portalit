import React from 'react';
import { cn } from '@/lib/utils';
import ServiceCard from './ServiceCard';
import Pax8SubscriptionCard from './Pax8SubscriptionCard';
import { Filter } from 'lucide-react';

export default function ReconciliationTab({ filteredRecons, filteredPax8, statusFilter, onFilterChange, allRecons, summary, issueCount, existingOverrides, isSaving, onReview, onDismiss, onReset, onDetails, onEditRule, onSaveNotes, onMapLineItem, onRemoveMapping }) {
  return (
    <>
      {/* Filter + context bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1.5">
          {[
            { key: 'all', label: 'All', count: allRecons.filter(r => r.status !== 'no_data').length },
            { key: 'issues', label: 'Issues', count: issueCount },
            { key: 'matched', label: 'Matched', count: (summary?.matched || 0) + (summary?.forceMatched || 0) },
            { key: 'reviewed', label: 'Reviewed', count: summary?.reviewed || 0 },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => onFilterChange(f.key)}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
                statusFilter === f.key
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
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
      </div>

      {/* Service Cards */}
      {filteredRecons.length === 0 ? (
        <div className="text-center py-12">
          <Filter className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">
            {statusFilter === 'all'
              ? 'No reconciliation data for this customer'
              : 'No services match this filter'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-3">
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
              onMapLineItem={onMapLineItem}
              onRemoveMapping={onRemoveMapping}
              hasOverride={existingOverrides.some((o) => o.rule_id === recon.rule.id)}
              isSaving={isSaving}
            />
          ))}
        </div>
      )}

      {/* Pax8 / M365 Per-Subscription Reconciliation */}
      {filteredPax8.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Pax8 / M365 Licence Reconciliation
          </h3>
          <div className="grid grid-cols-4 gap-3">
            {filteredPax8.map((recon) => (
              <Pax8SubscriptionCard
                key={recon.ruleId}
                recon={recon}
                onReview={onReview}
                onDismiss={onDismiss}
                onReset={onReset}
                onDetails={onDetails}
                onMapLineItem={onMapLineItem}
                onRemoveMapping={onRemoveMapping}
                onSaveNotes={onSaveNotes}
                hasOverride={existingOverrides.some((o) => o.rule_id === recon.ruleId)}
                isSaving={isSaving}
              />
            ))}
          </div>
        </div>
      )}
    </>
  );
}
