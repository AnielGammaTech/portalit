import React, { useState, useMemo } from 'react';
import { ArrowLeft, RefreshCw, Filter } from 'lucide-react';
import { useReconciliationData } from '@/hooks/useReconciliationData';
import { useReconciliationReviews } from '@/hooks/useReconciliationReviews';
import { getDiscrepancySummary } from '@/lib/lootit-reconciliation';
import ServiceCard from './ServiceCard';

export default function LootITCustomerDetail({ customer, onBack }) {
  const [statusFilter, setStatusFilter] = useState('all');
  const [detailItem, setDetailItem] = useState(null);

  const { reconciliations, isLoading } = useReconciliationData(customer.id);
  const { markReviewed, dismiss, resetReview, isSaving } = useReconciliationReviews(customer.id);

  const customerData = reconciliations[customer.id];
  const recons = customerData?.reconciliations || [];
  const summary = customerData ? getDiscrepancySummary(recons) : null;

  const filteredRecons = useMemo(() => {
    if (statusFilter === 'all') return recons.filter((r) => r.status !== 'no_data');
    if (statusFilter === 'issues') return recons.filter((r) => r.status === 'over' || r.status === 'under');
    if (statusFilter === 'matched') return recons.filter((r) => r.status === 'match');
    if (statusFilter === 'reviewed') return recons.filter((r) => r.review?.status === 'reviewed' || r.review?.status === 'dismissed');
    return recons;
  }, [recons, statusFilter]);

  const handleReview = async (ruleId) => {
    const recon = recons.find((r) => r.rule.id === ruleId);
    await markReviewed(ruleId, {
      psaQty: recon?.psaQty,
      vendorQty: recon?.vendorQty,
    });
  };

  const handleDismiss = async (ruleId) => {
    const recon = recons.find((r) => r.rule.id === ruleId);
    await dismiss(ruleId, {
      psaQty: recon?.psaQty,
      vendorQty: recon?.vendorQty,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-pink-200 border-t-pink-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center hover:bg-pink-50 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-slate-600" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold text-slate-900 truncate">
            {customer.name}
          </h2>
          {summary && (
            <p className="text-sm text-slate-500 mt-0.5">
              {summary.total} services tracked · {summary.matched} matched · {summary.over + summary.under} issue{summary.over + summary.under !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      </div>

      {/* Quick Summary */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MiniStat label="Matched" value={summary.matched} color="emerald" />
          <MiniStat label="Under-billed" value={summary.under} color="red" />
          <MiniStat label="Over-billed" value={summary.over} color="orange" />
          <MiniStat label="Reviewed" value={summary.reviewed} color="pink" />
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex gap-2">
        {[
          { key: 'all', label: 'All' },
          { key: 'issues', label: 'Issues' },
          { key: 'matched', label: 'Matched' },
          { key: 'reviewed', label: 'Reviewed' },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setStatusFilter(f.key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              statusFilter === f.key
                ? 'bg-pink-500 text-white'
                : 'bg-white text-slate-500 border border-slate-200 hover:bg-pink-50'
            }`}
          >
            {f.label}
          </button>
        ))}
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredRecons.map((recon) => (
            <ServiceCard
              key={recon.rule.id}
              reconciliation={recon}
              onReview={handleReview}
              onDismiss={handleDismiss}
              onReset={resetReview}
              onDetails={setDetailItem}
              isSaving={isSaving}
            />
          ))}
        </div>
      )}

      {/* Details Drawer */}
      {detailItem && (
        <DetailDrawer
          reconciliation={detailItem}
          onClose={() => setDetailItem(null)}
        />
      )}
    </div>
  );
}

function MiniStat({ label, value, color }) {
  const colors = {
    emerald: 'text-emerald-600 bg-emerald-50',
    red: 'text-red-600 bg-red-50',
    orange: 'text-orange-600 bg-orange-50',
    pink: 'text-pink-600 bg-pink-50',
  };

  return (
    <div className={`rounded-xl px-4 py-3 ${colors[color]}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs font-medium opacity-70">{label}</p>
    </div>
  );
}

function DetailDrawer({ reconciliation, onClose }) {
  const { rule, matchedLineItems, psaQty, vendorQty, integrationLabel } = reconciliation;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/20" />
      <div
        className="relative w-full max-w-md bg-white shadow-2xl overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">{rule.label}</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-xl"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Rule Info */}
          <div>
            <h4 className="text-xs uppercase tracking-wider text-slate-400 font-medium mb-2">
              Rule Details
            </h4>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Integration</dt>
                <dd className="font-medium">{integrationLabel}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Match Pattern</dt>
                <dd className="font-mono text-xs bg-slate-50 px-2 py-1 rounded">
                  {rule.match_pattern}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">PSA Quantity</dt>
                <dd className="font-bold">{psaQty ?? '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Vendor Quantity</dt>
                <dd className="font-bold">{vendorQty ?? '—'}</dd>
              </div>
            </dl>
          </div>

          {/* Matched Line Items */}
          {matchedLineItems.length > 0 && (
            <div>
              <h4 className="text-xs uppercase tracking-wider text-slate-400 font-medium mb-2">
                Matched PSA Line Items ({matchedLineItems.length})
              </h4>
              <div className="space-y-2">
                {matchedLineItems.map((li) => (
                  <div
                    key={li.id}
                    className="bg-slate-50 rounded-lg px-3 py-2 text-sm"
                  >
                    <p className="text-slate-700 truncate">{li.description}</p>
                    <div className="flex gap-4 mt-1 text-xs text-slate-400">
                      <span>Qty: {li.quantity}</span>
                      {li.price > 0 && <span>Price: ${parseFloat(li.price).toFixed(2)}</span>}
                      {li.net_amount > 0 && <span>Net: ${parseFloat(li.net_amount).toFixed(2)}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
