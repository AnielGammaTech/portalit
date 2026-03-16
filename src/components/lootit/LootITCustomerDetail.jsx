import React, { useState, useMemo } from 'react';
import { ArrowLeft, Filter, Check, X, ChevronRight, RotateCcw, RefreshCw } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { useReconciliationData } from '@/hooks/useReconciliationData';
import { useReconciliationReviews } from '@/hooks/useReconciliationReviews';
import { getDiscrepancySummary, getDiscrepancyMessage } from '@/lib/lootit-reconciliation';
import ServiceCard from './ServiceCard';
import ReconciliationBadge from './ReconciliationBadge';

export default function LootITCustomerDetail({ customer, onBack }) {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('all');
  const [detailItem, setDetailItem] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const { reconciliations, isLoading } = useReconciliationData(customer.id);
  const { markReviewed, dismiss, resetReview, isSaving } = useReconciliationReviews(customer.id);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await queryClient.invalidateQueries({ queryKey: ['reconciliation_rules'] });
      await queryClient.invalidateQueries({ queryKey: ['recurring_bills'] });
      await queryClient.invalidateQueries({ queryKey: ['recurring_bill_line_items'] });
      await queryClient.invalidateQueries({ queryKey: ['reconciliation_reviews', customer.id] });
      // Invalidate all mapping queries
      await queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).endsWith('_mappings') });
    } finally {
      setIsSyncing(false);
    }
  };

  const customerData = reconciliations[customer.id];
  const recons = customerData?.reconciliations || [];
  const pax8Recons = customerData?.pax8Reconciliations || [];

  // Combine rule-based + Pax8 for unified summary
  const allRecons = useMemo(() => [...recons, ...pax8Recons], [recons, pax8Recons]);
  const summary = customerData ? getDiscrepancySummary(allRecons) : null;

  const filteredRecons = useMemo(() => {
    const visible = recons.filter((r) => r.status !== 'no_data');
    if (statusFilter === 'all') return visible;
    if (statusFilter === 'issues') return visible.filter((r) => r.status === 'over' || r.status === 'under');
    if (statusFilter === 'matched') return visible.filter((r) => r.status === 'match');
    if (statusFilter === 'reviewed') return visible.filter((r) => r.review?.status === 'reviewed' || r.review?.status === 'dismissed');
    return visible;
  }, [recons, statusFilter]);

  const filteredPax8 = useMemo(() => {
    if (statusFilter === 'all') return pax8Recons;
    if (statusFilter === 'issues') return pax8Recons.filter((r) => r.status === 'over' || r.status === 'under' || r.status === 'missing_from_psa');
    if (statusFilter === 'matched') return pax8Recons.filter((r) => r.status === 'match');
    if (statusFilter === 'reviewed') return pax8Recons.filter((r) => r.review?.status === 'reviewed' || r.review?.status === 'dismissed');
    return pax8Recons;
  }, [pax8Recons, statusFilter]);

  const handleReview = async (ruleId) => {
    const recon = recons.find((r) => r.rule.id === ruleId);
    const pax8 = pax8Recons.find((r) => r.ruleId === ruleId);
    await markReviewed(ruleId, {
      psaQty: recon?.psaQty ?? pax8?.psaQty,
      vendorQty: recon?.vendorQty ?? pax8?.vendorQty,
    });
  };

  const handleDismiss = async (ruleId) => {
    const recon = recons.find((r) => r.rule.id === ruleId);
    const pax8 = pax8Recons.find((r) => r.ruleId === ruleId);
    await dismiss(ruleId, {
      psaQty: recon?.psaQty ?? pax8?.psaQty,
      vendorQty: recon?.vendorQty ?? pax8?.vendorQty,
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
        <button
          onClick={handleSync}
          disabled={isSyncing}
          className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-pink-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={cn('w-3.5 h-3.5', isSyncing && 'animate-spin')} />
          {isSyncing ? 'Syncing…' : 'Sync'}
        </button>
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

      {/* Pax8 / M365 Per-Subscription Reconciliation */}
      {filteredPax8.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-700">
            Pax8 / M365 Licence Reconciliation
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredPax8.map((recon) => (
              <Pax8SubscriptionCard
                key={recon.ruleId}
                recon={recon}
                onReview={handleReview}
                onDismiss={handleDismiss}
                onReset={resetReview}
                onDetails={setDetailItem}
                isSaving={isSaving}
              />
            ))}
          </div>
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
  const isPax8 = !!reconciliation.ruleId;
  const label = isPax8 ? reconciliation.productName : reconciliation.rule?.label;
  const integrationLabel = reconciliation.integrationLabel || '';
  const { matchedLineItems = [], psaQty, vendorQty } = reconciliation;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/20" />
      <div
        className="relative w-full max-w-md bg-white shadow-2xl overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">{label}</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-xl"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Source Info */}
          <div>
            <h4 className="text-xs uppercase tracking-wider text-slate-400 font-medium mb-2">
              {isPax8 ? 'Pax8 Subscription Details' : 'Rule Details'}
            </h4>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Integration</dt>
                <dd className="font-medium">{integrationLabel}</dd>
              </div>
              {!isPax8 && reconciliation.rule?.match_pattern && (
                <div className="flex justify-between">
                  <dt className="text-slate-500">Match Pattern</dt>
                  <dd className="font-mono text-xs bg-slate-50 px-2 py-1 rounded">
                    {reconciliation.rule.match_pattern}
                  </dd>
                </div>
              )}
              {isPax8 && reconciliation.subscriptionId && (
                <div className="flex justify-between">
                  <dt className="text-slate-500">Subscription ID</dt>
                  <dd className="font-mono text-xs bg-slate-50 px-2 py-1 rounded truncate max-w-[180px]" title={reconciliation.subscriptionId}>
                    {reconciliation.subscriptionId}
                  </dd>
                </div>
              )}
              {isPax8 && reconciliation.billingTerm && (
                <div className="flex justify-between">
                  <dt className="text-slate-500">Billing Term</dt>
                  <dd className="font-medium">{reconciliation.billingTerm}</dd>
                </div>
              )}
              {isPax8 && reconciliation.price > 0 && (
                <div className="flex justify-between">
                  <dt className="text-slate-500">Price / Unit</dt>
                  <dd className="font-medium">${parseFloat(reconciliation.price).toFixed(2)}</dd>
                </div>
              )}
              {isPax8 && reconciliation.startDate && (
                <div className="flex justify-between">
                  <dt className="text-slate-500">Start Date</dt>
                  <dd className="font-medium">{new Date(reconciliation.startDate).toLocaleDateString()}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-slate-500">PSA Quantity</dt>
                <dd className="font-bold">{psaQty ?? '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Vendor Quantity</dt>
                <dd className="font-bold">{vendorQty ?? '—'}</dd>
              </div>
              {isPax8 && reconciliation.totalVendorQty !== reconciliation.vendorQty && (
                <div className="flex justify-between">
                  <dt className="text-slate-500">Total Pax8 (all subs)</dt>
                  <dd className="font-bold">{reconciliation.totalVendorQty}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* HaloPSA Matched Line Items */}
          <div>
            <h4 className="text-xs uppercase tracking-wider text-slate-400 font-medium mb-2">
              HaloPSA Billing Line Items ({matchedLineItems.length})
            </h4>
            {matchedLineItems.length === 0 ? (
              <p className="text-sm text-slate-400 italic">No matching line items found in HaloPSA billing</p>
            ) : (
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
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Pax8 Subscription Card ──────────────────────────────────────────

const PAX8_STATUS_BORDER = {
  match: 'border-l-emerald-400',
  over: 'border-l-orange-400',
  under: 'border-l-red-400',
  missing_from_psa: 'border-l-red-500',
};

function Pax8SubscriptionCard({ recon, onReview, onDismiss, onReset, onDetails, isSaving }) {
  const {
    ruleId, productName, vendorQty, totalVendorQty, psaQty,
    difference, status, matchedLineItems, billingTerm, price,
    startDate, review,
  } = recon;

  const message = getDiscrepancyMessage(recon);
  const isReviewed = review?.status === 'reviewed' || review?.status === 'dismissed';
  const isMissing = status === 'missing_from_psa';

  return (
    <div
      className={cn(
        'bg-white rounded-xl border-l-4 border border-slate-200 p-5 transition-all hover:shadow-md',
        PAX8_STATUS_BORDER[status] || 'border-l-slate-200',
        isReviewed && 'opacity-60'
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h4 className="font-semibold text-slate-900 text-sm">{productName}</h4>
          <p className="text-xs text-slate-400 mt-0.5">
            Pax8{billingTerm ? ` · ${billingTerm}` : ''}{price > 0 ? ` · $${parseFloat(price).toFixed(2)}/unit` : ''}
          </p>
        </div>
        <ReconciliationBadge
          status={isMissing ? 'no_psa_data' : status}
          difference={difference}
        />
      </div>

      {/* Quantities */}
      <div className="flex items-center gap-6 mb-3">
        <div className="text-center">
          <p className="text-2xl font-bold text-slate-900">
            {psaQty !== null ? psaQty : '—'}
          </p>
          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">PSA</p>
        </div>
        <div className="text-slate-300 text-lg">vs</div>
        <div className="text-center">
          <p className="text-2xl font-bold text-slate-900">{vendorQty}</p>
          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Pax8</p>
        </div>
      </div>

      {/* Source details — always visible */}
      <div className="bg-slate-50 rounded-lg px-3 py-2 mb-3 space-y-1">
        <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Source</p>
        {matchedLineItems.length > 0 ? (
          matchedLineItems.slice(0, 2).map((li) => (
            <p key={li.id} className="text-xs text-slate-500 truncate">
              <span className="font-medium text-slate-600">HaloPSA:</span>{' '}
              {li.description?.replace(/\s*\$recurringbillingdate\s*/gi, '').trim()} · Qty {li.quantity}
            </p>
          ))
        ) : (
          <p className="text-xs text-slate-400 italic">No matching HaloPSA billing line item</p>
        )}
        <p className="text-xs text-slate-500 truncate">
          <span className="font-medium text-slate-600">Pax8:</span>{' '}
          {productName} · {vendorQty} licence{vendorQty !== 1 ? 's' : ''}
          {totalVendorQty !== vendorQty ? ` (product total: ${totalVendorQty})` : ''}
        </p>
      </div>

      {/* Message */}
      <p
        className={cn(
          'text-sm mb-4',
          status === 'match' ? 'text-emerald-600' : 'text-slate-600',
          (status === 'under' || isMissing) && 'text-red-600 font-medium',
          status === 'over' && 'text-orange-600 font-medium'
        )}
      >
        {isReviewed && (
          <span className="text-slate-400 mr-1">
            [{review.status === 'reviewed' ? '✓ Reviewed' : '✕ Dismissed'}]
          </span>
        )}
        {message}
      </p>

      {/* Actions — same as ServiceCard */}
      <div className="flex items-center gap-2">
        {!isReviewed && status !== 'match' && (
          <>
            <button
              onClick={() => onReview?.(ruleId)}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-pink-50 text-pink-600 hover:bg-pink-100 transition-colors disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" />
              Reviewed
            </button>
            <button
              onClick={() => onDismiss?.(ruleId)}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-50 text-slate-500 hover:bg-slate-100 transition-colors disabled:opacity-50"
            >
              <X className="w-3.5 h-3.5" />
              Dismiss
            </button>
          </>
        )}
        {isReviewed && (
          <button
            onClick={() => onReset?.(ruleId)}
            disabled={isSaving}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-50 text-slate-500 hover:bg-slate-100 transition-colors disabled:opacity-50"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </button>
        )}
        <button
          onClick={() => onDetails?.(recon)}
          className="ml-auto inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg text-slate-500 hover:bg-slate-50 transition-colors"
        >
          Details
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
