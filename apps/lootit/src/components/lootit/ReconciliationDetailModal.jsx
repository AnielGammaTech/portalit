import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/api/client';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Check,
  X,
  RotateCcw,
  RefreshCw,
  ShieldCheck,
  ShieldOff,
  Link2,
  StickyNote,
  AlertTriangle,
} from 'lucide-react';
import { ACTION_LABELS } from './lootit-constants';
import ExclusionSection from './ExclusionSection';

// -------------------------------------------------------------------
// Constants
// -------------------------------------------------------------------


const ACTION_ICONS = {
  reviewed: Check,
  dismissed: X,
  reset: RotateCcw,
  note: StickyNote,
  exclusion: ShieldCheck,
  force_matched: ShieldCheck,
  re_verified: RefreshCw,
  signed_off: ShieldCheck,
};

// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------

function getStatusBadge(reconciliation) {
  const { status, review } = reconciliation;
  const reviewStatus = review?.status;

  if (reviewStatus === 'force_matched') {
    return { label: 'Approved', className: 'bg-blue-100 text-blue-700' };
  }
  if (reviewStatus === 'dismissed') {
    return { label: 'Skipped', className: 'bg-slate-200 text-slate-600' };
  }
  if (status === 'match') {
    return { label: 'Matched', className: 'bg-emerald-100 text-emerald-700' };
  }
  if (status === 'no_vendor_data' || status === 'no_data') {
    return { label: 'No Vendor', className: 'bg-amber-100 text-amber-700' };
  }
  if (status === 'over' || status === 'under') {
    return { label: 'Mismatch', className: 'bg-red-100 text-red-700' };
  }
  return { label: 'Pending', className: 'bg-slate-100 text-slate-500' };
}

function formatTimestamp(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

// -------------------------------------------------------------------
// Sub-components
// -------------------------------------------------------------------

function InfoRow({ label, value, mono }) {
  if (value === null || value === undefined) return null;
  return (
    <div className="flex justify-between items-baseline gap-4 min-w-0">
      <dt className="text-xs text-slate-500 shrink-0">{label}</dt>
      <dd className={cn('text-sm font-semibold text-slate-700 text-right truncate min-w-0 max-w-[60%]', mono && 'font-mono text-xs bg-slate-50 px-2 py-0.5 rounded')}>
        {value}
      </dd>
    </div>
  );
}

function StatusBadge({ reconciliation }) {
  const badge = getStatusBadge(reconciliation);
  return (
    <span className={cn('inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold', badge.className)}>
      {badge.label}
    </span>
  );
}

// -------------------------------------------------------------------
// Action Section
// -------------------------------------------------------------------

function ActionSection({
  reconciliation,
  onForceMatch,
  onReview,
  onDismiss,
  onReset,
  onMapLineItem,
  isSaving,
}) {
  const { status, review, rule } = reconciliation;
  const isPax8 = !!reconciliation.ruleId;
  const ruleId = isPax8 ? reconciliation.ruleId : rule?.id;
  const reviewStatus = review?.status;
  const isReviewed = reviewStatus === 'reviewed' || reviewStatus === 'dismissed' || reviewStatus === 'force_matched';
  const isMatch = status === 'match';

  const [pendingAction, setPendingAction] = useState(null);
  const [actionNotes, setActionNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleExecute = async () => {
    if (!pendingAction) return;
    if ((pendingAction === 'force_match' || pendingAction === 'approve') && !actionNotes.trim()) return;
    setSaving(true);
    try {
      if (pendingAction === 'force_match' || pendingAction === 'approve') {
        await onForceMatch?.(ruleId, actionNotes);
      } else if (pendingAction === 'review') {
        await onReview?.(ruleId, { notes: actionNotes || undefined });
      } else if (pendingAction === 'dismiss') {
        await onDismiss?.(ruleId, { notes: actionNotes || undefined });
      }
      setPendingAction(null);
      setActionNotes('');
    } catch (err) {
      console.error('[Modal Action]', err);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setPendingAction(null);
    setActionNotes('');
  };

  const noteRequired = pendingAction === 'force_match' || pendingAction === 'approve';
  const buttonDisabled = saving || isSaving || (noteRequired && !actionNotes.trim());

  const buttonLabel = (() => {
    if (saving) return 'Saving...';
    if (pendingAction === 'force_match') return 'Force Match';
    if (pendingAction === 'approve') return 'Approve';
    if (pendingAction === 'review') return 'Save & OK';
    if (pendingAction === 'dismiss') return 'Save & Skip';
    return 'Save';
  })();

  const buttonColor = (() => {
    if (pendingAction === 'force_match' || pendingAction === 'approve') return 'bg-pink-500 hover:bg-pink-600';
    if (pendingAction === 'review') return 'bg-emerald-500 hover:bg-emerald-600';
    return 'bg-slate-500 hover:bg-slate-600';
  })();

  return (
    <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Actions</span>
        {review && (
          <span className={cn(
            'text-[10px] font-bold px-2 py-0.5 rounded-full',
            reviewStatus === 'force_matched' && 'bg-blue-100 text-blue-700',
            reviewStatus === 'reviewed' && 'bg-emerald-100 text-emerald-700',
            reviewStatus === 'dismissed' && 'bg-slate-200 text-slate-600',
            reviewStatus === 'pending' && 'bg-amber-100 text-amber-700',
            !reviewStatus && 'bg-slate-100 text-slate-400',
          )}>
            {reviewStatus === 'force_matched' ? 'Force Matched' : reviewStatus === 'reviewed' ? 'Reviewed' : reviewStatus === 'dismissed' ? 'Dismissed' : 'Pending'}
          </span>
        )}
      </div>

      {/* Action buttons (visible when no pending action) */}
      {!pendingAction && (
        <div className="flex flex-wrap gap-2">
          {!isMatch && !isReviewed && (
            <button
              onClick={() => setPendingAction('approve')}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors"
            >
              <ShieldCheck className="w-3.5 h-3.5" /> Approve
            </button>
          )}
          {!isMatch && !isReviewed && status !== 'no_vendor_data' && status !== 'no_data' && status !== 'unmatched_line_item' && (
            <button
              onClick={() => setPendingAction('force_match')}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-pink-500 text-white hover:bg-pink-600 transition-colors"
            >
              <ShieldCheck className="w-3.5 h-3.5" /> Force Match
            </button>
          )}
          {!isReviewed && !isMatch && (
            <button
              onClick={() => setPendingAction('dismiss')}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-slate-200 text-slate-700 hover:bg-slate-300 transition-colors"
            >
              <X className="w-3.5 h-3.5" /> Dismiss
            </button>
          )}
          {isReviewed && (
            <button
              onClick={() => onReset?.(ruleId)}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200 border border-amber-200 transition-colors disabled:opacity-50"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset
            </button>
          )}
          {onMapLineItem && (
            <button
              onClick={() => onMapLineItem?.(ruleId, isPax8 ? reconciliation.productName : rule?.label)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors"
            >
              <Link2 className="w-3.5 h-3.5" /> Map
            </button>
          )}
        </div>
      )}

      {/* Note textarea for pending action */}
      {pendingAction && (
        <div className="space-y-2">
          <p className="text-xs text-slate-500">
            {noteRequired
              ? 'Note is required \u2014 explain why:'
              : 'Add an optional note:'}
          </p>
          <textarea
            value={actionNotes}
            onChange={(e) => setActionNotes(e.target.value)}
            placeholder={noteRequired ? 'Why is this being approved?' : 'Optional note...'}
            rows={2}
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-300 resize-none"
            autoFocus
          />
          <div className="flex gap-2">
            <button
              onClick={handleExecute}
              disabled={buttonDisabled}
              className={cn('px-3 py-1.5 text-xs font-semibold rounded-lg text-white transition-colors disabled:opacity-50', buttonColor)}
            >
              {buttonLabel}
            </button>
            <button
              onClick={handleCancel}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Current notes display */}
      {review?.notes && !pendingAction && (
        <div className="bg-white rounded-md px-3 py-2 border border-slate-100">
          <p className="text-sm text-slate-600">{review.notes}</p>
        </div>
      )}
    </div>
  );
}


// -------------------------------------------------------------------
// History Timeline
// -------------------------------------------------------------------

function HistoryTimeline({ customerId, ruleId }) {
  const { data: history = [] } = useQuery({
    queryKey: ['reconciliation_review_history', customerId, ruleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reconciliation_review_history')
        .select('*')
        .eq('customer_id', customerId)
        .eq('rule_id', ruleId)
        .order('created_date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!customerId && !!ruleId,
  });

  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
        Audit Log
        <span className="text-[10px] font-normal text-slate-400">
          {history.length} {history.length === 1 ? 'entry' : 'entries'}
        </span>
      </h3>
      {history.length === 0 ? (
        <p className="text-sm text-slate-400 italic">No activity yet</p>
      ) : (
        <div className="relative pl-4 border-l-2 border-slate-100 space-y-4">
          {history.map((entry) => {
            const config = ACTION_LABELS[entry.action] || ACTION_LABELS.note;
            const Icon = ACTION_ICONS[entry.action] || StickyNote;
            const userName = entry.created_by_name || 'System';
            const timestamp = new Date(entry.created_date);
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
                      PSA: {entry.psa_qty ?? '\u2014'} | Vendor: {entry.vendor_qty ?? '\u2014'}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------------
// Standalone Note Form
// -------------------------------------------------------------------

function AddNoteForm({ ruleId, onSaveNotes }) {
  const [noteText, setNoteText] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!noteText.trim() || !onSaveNotes) return;
    setSaving(true);
    try {
      await onSaveNotes(ruleId, noteText);
      setNoteText('');
      toast.success('Note saved');
    } catch (err) {
      toast.error(`Failed to save note: ${err.message || 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Add Note</h4>
      <textarea
        value={noteText}
        onChange={(e) => setNoteText(e.target.value)}
        placeholder="Add a note to this item..."
        rows={2}
        className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-300 resize-none"
      />
      <button
        onClick={handleSave}
        disabled={saving || !noteText.trim()}
        className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-pink-500 text-white hover:bg-pink-600 disabled:opacity-50 transition-colors"
      >
        {saving ? 'Saving...' : 'Save Note'}
      </button>
    </div>
  );
}

// -------------------------------------------------------------------
// Billing Model Toggle (Datto RMM)
// -------------------------------------------------------------------

function BillingModelToggle({ ruleId, currentDivisor, rawVendorQty, onSave }) {
  const [saving, setSaving] = useState(false);
  const [localDivisor, setLocalDivisor] = useState(currentDivisor);
  const options = [
    { value: 1, label: 'Per Device' },
    { value: 2, label: '2 Per User' },
  ];

  const adjustedQty = rawVendorQty != null && localDivisor > 1
    ? Math.ceil(rawVendorQty / localDivisor)
    : rawVendorQty;

  const handleSelect = async (value) => {
    if (value === localDivisor) return;
    setLocalDivisor(value);
    setSaving(true);
    try {
      await onSave(ruleId, value);
    } catch (err) {
      setLocalDivisor(currentDivisor);
      toast.error(`Failed to save: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-blue-50 rounded-xl border border-blue-200 p-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-blue-400">Billing Model</span>
        {rawVendorQty != null && localDivisor > 1 && (
          <span className="text-[10px] text-blue-400">
            {rawVendorQty} devices / {localDivisor} = {adjustedQty} billable
          </span>
        )}
      </div>
      <div className="flex gap-2">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => handleSelect(opt.value)}
            disabled={saving}
            className={cn(
              'flex-1 py-2 text-xs font-semibold rounded-lg transition-all disabled:opacity-50',
              localDivisor === opt.value
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white text-blue-600 border border-blue-200 hover:bg-blue-100'
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// -------------------------------------------------------------------
// Main Modal
// -------------------------------------------------------------------

export default function ReconciliationDetailModal({
  reconciliation,
  customerId,
  onClose,
  onForceMatch,
  onReview,
  onDismiss,
  onReset,
  onSaveNotes,
  onSaveExclusion,
  onSaveExcludedItems,
  onRemoveAllExcludedItems,
  excludedItemsForRule,
  vendorMapping,
  isExclusionSaving,
  haloDevices,
  onMapLineItem,
  overrides = [],
  readOnly = false,
  snapshotDate,
  onReVerify,
  onSaveVendorDivisor,
}) {
  if (!reconciliation) return null;

  const isPax8 = !!reconciliation.ruleId;
  const ruleId = isPax8 ? reconciliation.ruleId : reconciliation.rule?.id;
  const label = isPax8 ? reconciliation.productName : reconciliation.rule?.label;
  const integrationLabel = reconciliation.integrationLabel || '';
  const { matchedLineItems = [], psaQty, vendorQty } = reconciliation;

  let mappedVendorItems = [];
  if (ruleId) {
    const ruleOverrides = overrides.filter(ov => ov.rule_id === ruleId);
    for (const ov of ruleOverrides) {
      if (ov.pax8_product_name && ov.pax8_product_name.startsWith('[')) {
        try { mappedVendorItems = JSON.parse(ov.pax8_product_name); } catch {}
        break;
      }
    }
    if (mappedVendorItems.length === 0 && ruleOverrides.length > 0 && ruleOverrides[0].pax8_product_name && !ruleOverrides[0].pax8_product_name.startsWith('[')) {
      mappedVendorItems = [{ name: ruleOverrides[0].pax8_product_name, qty: vendorQty || 0 }];
    }
  }

  return (
    <Dialog open={!!reconciliation} onOpenChange={(open) => { if (!open) onClose?.(); }}>
      <DialogContent className="max-w-2xl rounded-2xl p-0 gap-0 backdrop-blur-sm border-slate-200 overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-100">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-lg font-bold text-slate-900 truncate">
                {label}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400 mt-0.5">
                {integrationLabel}
                {readOnly && snapshotDate && (
                  <span className="ml-2 text-purple-500 font-medium">
                    Snapshot from {new Date(snapshotDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                )}
              </DialogDescription>
            </div>
            <StatusBadge reconciliation={reconciliation} />
          </div>
        </DialogHeader>

        {/* Scrollable body */}
        <div className="px-6 py-5 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Info section */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Details</h4>
            <dl className="space-y-2">
              <InfoRow label="PSA Quantity" value={psaQty ?? '\u2014'} />
              <InfoRow label="Vendor Quantity" value={vendorQty ?? '\u2014'} />
              {isPax8 && reconciliation.totalVendorQty !== reconciliation.vendorQty && (
                <InfoRow label="Total Pax8 (all subs)" value={reconciliation.totalVendorQty} />
              )}
              <InfoRow label="Integration" value={integrationLabel} />
              {!isPax8 && reconciliation.rule?.match_pattern && (
                <InfoRow label="Match Pattern" value={reconciliation.rule.match_pattern} mono />
              )}
              {isPax8 && reconciliation.subscriptionId && (
                <InfoRow label="Subscription ID" value={reconciliation.subscriptionId} mono />
              )}
              {isPax8 && reconciliation.billingTerm && (
                <InfoRow label="Billing Term" value={reconciliation.billingTerm} />
              )}
              {isPax8 && reconciliation.price > 0 && (
                <InfoRow label="Price / Unit" value={`$${parseFloat(reconciliation.price).toFixed(2)}`} />
              )}
              {isPax8 && reconciliation.startDate && (
                <InfoRow label="Start Date" value={new Date(reconciliation.startDate).toLocaleDateString()} />
              )}
            </dl>
          </div>

          {/* Billing Model Toggle (Datto RMM) */}
          {!isPax8 && reconciliation.rule?.integration_key?.startsWith('datto_rmm') && onSaveVendorDivisor && !readOnly && (
            <BillingModelToggle
              ruleId={ruleId}
              currentDivisor={reconciliation.vendorDivisor || 1}
              rawVendorQty={reconciliation.rawVendorQty}
              onSave={onSaveVendorDivisor}
            />
          )}

          {/* Matched line items */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              HaloPSA Billing Line Items ({matchedLineItems.length})
            </h4>
            {matchedLineItems.length === 0 ? (
              <p className="text-sm text-slate-400 italic">No matching line items found in HaloPSA billing</p>
            ) : (
              <div className="space-y-2">
                {matchedLineItems.map((li) => (
                  <div key={li.id} className="bg-slate-50 rounded-lg px-3 py-2 text-sm">
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

          {/* Mapped Vendor Items breakdown */}
          {mappedVendorItems.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-pink-400 mb-2">
                Mapped Vendor Items ({mappedVendorItems.length})
              </h4>
              <div className="bg-pink-50 rounded-xl border border-pink-200 divide-y divide-pink-100 overflow-hidden">
                {mappedVendorItems.map((item, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-sm font-medium text-slate-700">{item.name}</span>
                    <span className="text-sm font-bold text-pink-600 tabular-nums">Qty: {item.qty}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between px-4 py-2.5 bg-pink-100/60">
                  <span className="text-xs font-semibold text-pink-700 uppercase">Total</span>
                  <span className="text-sm font-bold text-pink-700 tabular-nums">
                    {mappedVendorItems.reduce((sum, m) => sum + (m.qty || 0), 0)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Re-verify button (for stale items in active mode) */}
          {!readOnly && onReVerify && (
            <button
              onClick={() => onReVerify(ruleId)}
              className="w-full py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors"
            >
              Re-verify
            </button>
          )}

          {/* Actions */}
          {!readOnly && (
            <ActionSection
              reconciliation={reconciliation}
              onForceMatch={async (ruleId, notes) => { await onForceMatch?.(ruleId, notes); onClose?.(); }}
              onReview={async (ruleId, opts) => { await onReview?.(ruleId, opts); onClose?.(); }}
              onDismiss={async (ruleId, opts) => { await onDismiss?.(ruleId, opts); onClose?.(); }}
              onReset={async (ruleId) => { await onReset?.(ruleId); onClose?.(); }}
              onMapLineItem={(ruleId, label) => { onClose?.(); setTimeout(() => onMapLineItem?.(ruleId, label), 100); }}
              isSaving={false}
            />
          )}

          {/* Exclusions */}
          {!readOnly && (
            <ExclusionSection
              reconciliation={reconciliation}
              vendorMapping={vendorMapping}
              excludedItemsForRule={excludedItemsForRule || []}
              onSaveExcludedItems={onSaveExcludedItems}
              onRemoveAllExcludedItems={onRemoveAllExcludedItems}
              onSaveExclusion={onSaveExclusion}
              isSaving={isExclusionSaving}
              haloDevices={haloDevices}
            />
          )}

          {/* Add note form */}
          {!readOnly && (
            <AddNoteForm ruleId={ruleId} onSaveNotes={onSaveNotes} />
          )}

          {/* History timeline */}
          <HistoryTimeline customerId={customerId} ruleId={ruleId} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
