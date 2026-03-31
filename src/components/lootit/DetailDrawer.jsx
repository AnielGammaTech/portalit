import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/api/client';
import { cn } from '@/lib/utils';
import { SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { ACTION_LABELS } from './lootit-constants';
import { Check, X, RotateCcw, StickyNote, ShieldCheck, AlertTriangle } from 'lucide-react';

export default function DetailDrawer({ reconciliation, customerId, onSaveExclusion }) {
  const isPax8 = !!reconciliation.ruleId;
  const ruleId = isPax8 ? reconciliation.ruleId : reconciliation.rule?.id;
  const label = isPax8 ? reconciliation.productName : reconciliation.rule?.label;
  const integrationLabel = reconciliation.integrationLabel || '';
  const { matchedLineItems = [], psaQty, vendorQty } = reconciliation;

  // Fetch history for this specific card
  const { data: history = [] } = useQuery({
    queryKey: ['reconciliation_review_history', customerId, ruleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reconciliation_review_history')
        .select('*, created_by_user:users!reconciliation_review_history_created_by_fkey(full_name, email)')
        .eq('customer_id', customerId)
        .eq('rule_id', ruleId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!customerId && !!ruleId,
  });

  const review = reconciliation.review;
  const [exclusionCount, setExclusionCount] = useState(review?.exclusion_count || 0);
  const [exclusionReason, setExclusionReason] = useState(review?.exclusion_reason || '');
  const [showExclusionForm, setShowExclusionForm] = useState(false);
  const [savingExclusion, setSavingExclusion] = useState(false);

  const EXCLUSION_PRESETS = [
    { label: 'Service Account', value: 'service account' },
    { label: 'Free Account', value: 'free account' },
    { label: 'Admin Account', value: 'admin account' },
    { label: 'Shared Mailbox', value: 'shared mailbox' },
    { label: 'Test Account', value: 'test account' },
  ];

  const handleSaveExclusion = async () => {
    if (!onSaveExclusion) return;
    setSavingExclusion(true);
    try {
      await onSaveExclusion(ruleId, exclusionCount, exclusionReason);
      setShowExclusionForm(false);
    } finally {
      setSavingExclusion(false);
    }
  };

  // Icon map for ACTION_LABELS (icons can't be serialized in constants)
  const ACTION_ICONS = {
    reviewed: Check,
    dismissed: X,
    reset: RotateCcw,
    note: StickyNote,
    exclusion: ShieldCheck,
  };

  return (
    <>
      <SheetHeader className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 z-10">
        <SheetTitle className="text-left">{label}</SheetTitle>
        <SheetDescription className="text-left text-xs text-slate-400">
          {integrationLabel}
        </SheetDescription>
      </SheetHeader>

      <div className="p-6 space-y-6">
          {/* Current Status */}
          {review && (
            <div className="bg-slate-50 rounded-lg px-4 py-3 border border-slate-200">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs uppercase tracking-wider text-slate-400 font-medium">Current Status</span>
                <span className={cn(
                  'text-xs font-semibold px-2 py-0.5 rounded-full',
                  review.status === 'reviewed' && 'bg-emerald-100 text-emerald-700',
                  review.status === 'dismissed' && 'bg-slate-200 text-slate-600',
                  review.status === 'pending' && 'bg-amber-100 text-amber-700',
                )}>
                  {review.status === 'reviewed' ? 'Reviewed' : review.status === 'dismissed' ? 'Dismissed' : 'Pending'}
                </span>
              </div>
              {review.notes && (
                <p className="text-sm text-slate-600 mt-2 bg-white rounded-md px-3 py-2 border border-slate-100">
                  {review.notes}
                </p>
              )}
            </div>
          )}

          {/* Excluded Accounts Section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs uppercase tracking-wider text-slate-400 font-medium">Excluded Accounts</h4>
              {!showExclusionForm && (
                <button
                  onClick={() => setShowExclusionForm(true)}
                  className="text-xs font-semibold text-amber-600 hover:text-amber-700 transition-colors"
                >
                  {review?.exclusion_count > 0 ? 'Edit' : '+ Add'}
                </button>
              )}
            </div>
            {review?.exclusion_count > 0 && !showExclusionForm && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-amber-200" style={{ backgroundImage: 'linear-gradient(135deg, #fffbeb 0%, #fef9c3 100%)' }}>
                <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-amber-800">{review.exclusion_count} {review.exclusion_reason || 'excluded'}</p>
                  <p className="text-[11px] text-amber-600">These don't count against the vendor total</p>
                </div>
              </div>
            )}
            {showExclusionForm && (
              <div className="space-y-3 bg-amber-50/50 rounded-lg px-4 py-3 border border-amber-200">
                <p className="text-xs text-amber-700">
                  Add accounts that shouldn't count against the licence total (e.g. service accounts, free accounts).
                </p>
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">How many?</label>
                  <input
                    type="number"
                    min="0"
                    value={exclusionCount}
                    onChange={(e) => setExclusionCount(parseInt(e.target.value) || 0)}
                    className="w-24 text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Reason</label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {EXCLUSION_PRESETS.map((preset) => (
                      <button
                        key={preset.value}
                        onClick={() => setExclusionReason(preset.value)}
                        className={cn(
                          'px-2.5 py-1 text-[11px] font-medium rounded-full border transition-colors',
                          exclusionReason === preset.value
                            ? 'bg-amber-200 border-amber-300 text-amber-800'
                            : 'bg-white border-slate-200 text-slate-500 hover:border-amber-200 hover:text-amber-700'
                        )}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={exclusionReason}
                    onChange={(e) => setExclusionReason(e.target.value)}
                    placeholder="Or type a custom reason..."
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveExclusion}
                    disabled={savingExclusion || exclusionCount <= 0}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 transition-colors"
                  >
                    {savingExclusion ? 'Saving...' : 'Save Exclusion'}
                  </button>
                  {review?.exclusion_count > 0 && (
                    <button
                      onClick={async () => {
                        setSavingExclusion(true);
                        try {
                          await onSaveExclusion?.(ruleId, 0, '');
                          setExclusionCount(0);
                          setExclusionReason('');
                          setShowExclusionForm(false);
                        } finally {
                          setSavingExclusion(false);
                        }
                      }}
                      disabled={savingExclusion}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-100 text-red-600 hover:bg-red-200 transition-colors disabled:opacity-50"
                    >
                      Remove
                    </button>
                  )}
                  <button
                    onClick={() => { setShowExclusionForm(false); setExclusionCount(review?.exclusion_count || 0); setExclusionReason(review?.exclusion_reason || ''); }}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
            {!review?.exclusion_count && !showExclusionForm && (
              <p className="text-sm text-slate-400 italic">No excluded accounts</p>
            )}
          </div>

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
                <dd className="font-bold">{psaQty ?? '\u2014'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Vendor Quantity</dt>
                <dd className="font-bold">{vendorQty ?? '\u2014'}</dd>
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

          {/* Activity History */}
          <div>
            <h4 className="text-xs uppercase tracking-wider text-slate-400 font-medium mb-3">
              Activity History ({history.length})
            </h4>
            {history.length === 0 ? (
              <p className="text-sm text-slate-400 italic">No activity yet</p>
            ) : (
              <div className="relative pl-4 border-l-2 border-slate-100 space-y-4">
                {history.map((entry) => {
                  const config = ACTION_LABELS[entry.action] || ACTION_LABELS.note;
                  const Icon = ACTION_ICONS[entry.action] || StickyNote;
                  const userName = entry.created_by_user?.full_name || entry.created_by_user?.email || 'System';
                  const timestamp = new Date(entry.created_at);
                  return (
                    <div key={entry.id} className="relative">
                      <div className={cn('absolute -left-[23px] top-0.5 w-5 h-5 rounded-full flex items-center justify-center border-2 border-white', config.bg)}>
                        <Icon className={cn('w-3 h-3', config.color)} />
                      </div>
                      <div className="ml-2">
                        <div className="flex items-center gap-2">
                          <span className={cn('text-xs font-semibold', config.color)}>{config.label}</span>
                          <span className="text-[11px] text-slate-400">
                            {timestamp.toLocaleDateString()} {timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">by {userName}</p>
                        {entry.notes && (
                          <p className="text-sm text-slate-700 mt-1 bg-slate-50 rounded-md px-3 py-2 border border-slate-100">
                            {entry.notes}
                          </p>
                        )}
                        {(entry.psa_qty !== null || entry.vendor_qty !== null) && (
                          <p className="text-[11px] text-slate-400 mt-1">
                            PSA: {entry.psa_qty ?? '\u2014'} · Vendor: {entry.vendor_qty ?? '\u2014'}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
    </>
  );
}
