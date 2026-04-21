import React from 'react';
import { cn } from '@/lib/utils';
import { Filter, Link2, ClipboardCheck } from 'lucide-react';
import ServiceCard from './ServiceCard';
import Pax8SubscriptionCard from './Pax8SubscriptionCard';
import { useExcludedItems } from '@/hooks/useExcludedItems';
import { extractVendorItems } from '@/lib/vendor-item-extractors';

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
}) {
  const { getExclusionCount } = useExcludedItems(customerId);
  const unverifiedCount = verificationState ? verificationState.total - verificationState.verified : 0;

  return (
    <>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1.5 flex-wrap">
          {[
            { key: 'unverified', label: 'To Review', count: unverifiedCount },
            { key: 'all', label: 'All', count: allRecons.filter(r => r.status !== 'no_data').length },
            { key: 'issues', label: 'Issues', count: issueCount },
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
        {onSignOff ? (
          <button
            onClick={onSignOff}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors"
          >
            <ClipboardCheck className="w-3.5 h-3.5" />
            Sign Off Reconciliation
          </button>
        ) : verificationState && !verificationState.allVerified ? (
          <span className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-pink-500 bg-pink-50 border border-pink-200 rounded-lg">
            <ClipboardCheck className="w-3.5 h-3.5" />
            {verificationState.verified}/{verificationState.total} verified to sign off
          </span>
        ) : null}
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
              onDetails={onDetails}
              staleness={stalenessMap?.[recon.rule.id]}
              isVerified={verificationState?.verifiedMap?.[recon.rule.id] || false}
              hasOverride={existingOverrides.some((o) => o.rule_id === recon.rule.id)}
              overrideCount={existingOverrides.filter((o) => o.rule_id === recon.rule.id && o.pax8_product_name !== 'approved_as_is').length}
              itemExclusionCount={(() => {
                const integrationKey = recon.rule?.integration_key;
                if (!integrationKey) return undefined;
                const mapping = vendorMappings?.[integrationKey];
                if (!mapping) return undefined;
                const vendorItems = extractVendorItems(integrationKey, mapping.cached_data);
                if (!vendorItems) return undefined;
                return getExclusionCount(recon.rule?.id, vendorItems);
              })()}
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
