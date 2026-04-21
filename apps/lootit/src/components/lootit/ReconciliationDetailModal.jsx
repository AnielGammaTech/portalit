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
  Settings,
  ClipboardCheck,
  Clock,
  ChevronRight,
  MessageSquarePlus,
  Minus,
} from 'lucide-react';
import { ACTION_LABELS } from './lootit-constants';
import ExclusionSection from './ExclusionSection';

const ACTION_ICONS = {
  reviewed: Check,
  dismissed: X,
  reset: RotateCcw,
  note: StickyNote,
  exclusion: ShieldCheck,
  exclusion_added: ShieldCheck,
  exclusion_removed: ShieldOff,
  exclusion_dropped: AlertTriangle,
  force_matched: ShieldCheck,
  approved_as_is: Check,
  re_verified: RefreshCw,
  signed_off: ShieldCheck,
  billing_model: Settings,
  mapping_changed: Link2,
};

function getStatusBadge(reconciliation) {
  const { status, review } = reconciliation;
  const rs = review?.status;
  if (rs === 'force_matched') return { label: 'Approved', bg: 'bg-blue-50', text: 'text-blue-700', ring: 'ring-blue-200' };
  if (rs === 'dismissed') return { label: 'Skipped', bg: 'bg-slate-100', text: 'text-slate-600', ring: 'ring-slate-200' };
  if (status === 'match') return { label: 'Matched', bg: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-200' };
  if (status === 'no_vendor_data' || status === 'no_data') return { label: 'No Vendor', bg: 'bg-amber-50', text: 'text-amber-700', ring: 'ring-amber-200' };
  if (status === 'over' || status === 'under') return { label: 'Mismatch', bg: 'bg-red-50', text: 'text-red-700', ring: 'ring-red-200' };
  return { label: 'Pending', bg: 'bg-slate-50', text: 'text-slate-500', ring: 'ring-slate-200' };
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const ms = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function StatCard({ label, value, previousValue, variant = 'default' }) {
  const numVal = Number(value ?? 0);
  const numPrev = previousValue != null ? Number(previousValue) : null;
  const changed = numPrev != null && numVal !== numPrev;

  const isDiff = variant === 'diff';
  const diffVal = isDiff ? numVal : 0;

  const cardBg = isDiff
    ? diffVal === 0 ? 'bg-emerald-50/80' : diffVal > 0 ? 'bg-amber-50/80' : 'bg-red-50/80'
    : changed ? 'bg-red-50/80' : 'bg-slate-50/80';

  const cardBorder = isDiff
    ? diffVal === 0 ? 'border-emerald-200/60' : diffVal > 0 ? 'border-amber-200/60' : 'border-red-200/60'
    : changed ? 'border-red-200/60' : 'border-slate-200/60';

  const valColor = isDiff
    ? diffVal === 0 ? 'text-emerald-700' : diffVal > 0 ? 'text-amber-700' : 'text-red-700'
    : changed ? 'text-red-700' : 'text-slate-900';

  const displayVal = isDiff
    ? (diffVal > 0 ? `+${diffVal}` : diffVal === 0 ? '0' : String(diffVal))
    : (value ?? '\u2014');

  return (
    <div className={cn('rounded-xl border px-3 py-2.5 text-center transition-colors', cardBg, cardBorder)}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className={cn('text-xl font-bold tabular-nums mt-0.5', valColor)}>{displayVal}</p>
      {changed && numPrev != null && (
        <p className="text-[10px] text-red-400 mt-0.5">was {numPrev}</p>
      )}
    </div>
  );
}

function CollapsibleSection({ title, icon: Icon, count, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-slate-200/80 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-50/80 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2">
          {Icon && <Icon className="w-3.5 h-3.5 text-slate-400" />}
          <span className="text-xs font-semibold text-slate-600">{title}</span>
          {count != null && (
            <span className="text-[10px] font-medium bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full tabular-nums">
              {count}
            </span>
          )}
        </div>
        <ChevronRight className={cn('w-3.5 h-3.5 text-slate-400 transition-transform duration-200', open && 'rotate-90')} />
      </button>
      {open && <div className="border-t border-slate-100 px-4 py-3">{children}</div>}
    </div>
  );
}

function BillingModelToggle({ ruleId, currentDivisor, rawVendorQty, onSave }) {
  const [saving, setSaving] = useState(false);
  const [localDivisor, setLocalDivisor] = useState(currentDivisor);

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

  const options = [
    { value: 1, label: 'Per Device' },
    { value: 2, label: '2 Per User' },
  ];

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs font-semibold text-slate-500 shrink-0">Billing</span>
      <div className="flex gap-1.5 flex-1">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => handleSelect(opt.value)}
            disabled={saving}
            className={cn(
              'flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all disabled:opacity-50 cursor-pointer',
              localDivisor === opt.value
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {rawVendorQty != null && localDivisor > 1 && (
        <span className="text-[10px] text-slate-400 tabular-nums shrink-0">
          {rawVendorQty} ÷ {localDivisor} = {adjustedQty}
        </span>
      )}
    </div>
  );
}

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

  if (history.length === 0) {
    return <p className="text-xs text-slate-400 italic py-1">No activity yet</p>;
  }

  return (
    <div className="relative pl-4 border-l-2 border-slate-100 space-y-3">
      {history.map((entry) => {
        const config = ACTION_LABELS[entry.action] || ACTION_LABELS.note;
        const Icon = ACTION_ICONS[entry.action] || StickyNote;
        const userName = entry.created_by_name || 'System';
        const ts = new Date(entry.created_date);
        return (
          <div key={entry.id} className="relative">
            <div className={cn('absolute -left-[21px] top-0.5 w-4 h-4 rounded-full flex items-center justify-center border-2 border-white', config.bg)}>
              <Icon className={cn('w-2.5 h-2.5', config.color)} />
            </div>
            <div className="ml-1.5">
              <div className="flex items-center gap-2">
                <span className={cn('text-[11px] font-semibold', config.color)}>{config.label}</span>
                <span className="text-[10px] text-slate-400">
                  {ts.toLocaleDateString()} {ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">by {userName}</p>
              {entry.notes && (
                <p className="text-xs text-slate-600 mt-1 bg-slate-50 rounded-md px-2.5 py-1.5 border border-slate-100">
                  {entry.notes}
                </p>
              )}
              {(entry.psa_qty !== null || entry.vendor_qty !== null) && (
                <p className="text-[10px] text-slate-400 mt-0.5 tabular-nums">
                  PSA: {entry.psa_qty ?? '\u2014'} · Vendor: {entry.vendor_qty ?? '\u2014'}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ActionFooter({
  reconciliation,
  ruleId,
  onForceMatch,
  onReview,
  onDismiss,
  onReset,
  onMapLineItem,
  onReVerify,
  onSaveNotes,
  isSaving,
}) {
  const { status, review, rule } = reconciliation;
  const isPax8 = !!reconciliation.ruleId;
  const reviewStatus = review?.status;
  const isReviewed = reviewStatus === 'reviewed' || reviewStatus === 'dismissed' || reviewStatus === 'force_matched';
  const isMatch = status === 'match';

  const [pendingAction, setPendingAction] = useState(null);
  const [actionNotes, setActionNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [standaloneNote, setStandaloneNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  const noteRequired = pendingAction === 'force_match' || pendingAction === 'approve';
  const buttonDisabled = saving || isSaving || (noteRequired && !actionNotes.trim());

  const handleExecute = async () => {
    if (!pendingAction) return;
    if (noteRequired && !actionNotes.trim()) return;
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

  const handleSaveNote = async () => {
    if (!standaloneNote.trim() || !onSaveNotes) return;
    setSavingNote(true);
    try {
      await onSaveNotes(ruleId, standaloneNote);
      setStandaloneNote('');
      setShowNoteInput(false);
      toast.success('Note saved');
    } catch (err) {
      toast.error(`Failed to save note: ${err.message || 'Unknown error'}`);
    } finally {
      setSavingNote(false);
    }
  };

  const actionLabel = (() => {
    if (saving) return 'Saving\u2026';
    if (pendingAction === 'force_match') return 'Force Match';
    if (pendingAction === 'approve') return 'Approve';
    if (pendingAction === 'review') return 'Confirm';
    if (pendingAction === 'dismiss') return 'Skip';
    return 'Save';
  })();

  const actionColor = (() => {
    if (pendingAction === 'force_match' || pendingAction === 'approve') return 'bg-pink-500 hover:bg-pink-600';
    if (pendingAction === 'review') return 'bg-emerald-500 hover:bg-emerald-600';
    return 'bg-slate-500 hover:bg-slate-600';
  })();

  if (pendingAction) {
    return (
      <div className="border-t border-slate-100 bg-slate-50/50 px-6 py-4 space-y-3 shrink-0">
        <textarea
          value={actionNotes}
          onChange={(e) => setActionNotes(e.target.value)}
          placeholder={noteRequired ? 'Required \u2014 explain why\u2026' : 'Optional note\u2026'}
          rows={2}
          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-200 resize-none bg-white"
          autoFocus
        />
        <div className="flex gap-2">
          <button
            onClick={handleExecute}
            disabled={buttonDisabled}
            className={cn('px-4 py-2 text-xs font-semibold rounded-lg text-white transition-colors disabled:opacity-50 cursor-pointer', actionColor)}
          >
            {actionLabel}
          </button>
          <button
            onClick={handleCancel}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-white text-slate-500 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (showNoteInput) {
    return (
      <div className="border-t border-slate-100 bg-slate-50/50 px-6 py-4 space-y-3 shrink-0">
        <textarea
          value={standaloneNote}
          onChange={(e) => setStandaloneNote(e.target.value)}
          placeholder="Add a note\u2026"
          rows={2}
          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-200 resize-none bg-white"
          autoFocus
        />
        <div className="flex gap-2">
          <button
            onClick={handleSaveNote}
            disabled={savingNote || !standaloneNote.trim()}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-700 text-white hover:bg-slate-800 disabled:opacity-50 transition-colors cursor-pointer"
          >
            {savingNote ? 'Saving\u2026' : 'Save Note'}
          </button>
          <button
            onClick={() => { setShowNoteInput(false); setStandaloneNote(''); }}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-white text-slate-500 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="border-t border-slate-100 bg-slate-50/50 px-6 py-4 shrink-0">
      <div className="flex items-center gap-2 flex-wrap">
        {/* Status + Reset for reviewed items */}
        {isReviewed && (
          <>
            <div className="flex items-center gap-1.5 text-xs font-semibold mr-auto">
              <Check className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-emerald-600">
                {reviewStatus === 'force_matched' ? 'Force Matched' : reviewStatus === 'dismissed' ? 'Dismissed' : 'Verified'}
              </span>
            </div>
            <button
              onClick={() => onReset?.(ruleId)}
              disabled={isSaving}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white text-amber-700 hover:bg-amber-50 border border-amber-200 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" /> Reset
            </button>
          </>
        )}

        {/* Confirm Match for auto-matched, unreviewed */}
        {isMatch && !isReviewed && (
          <button
            onClick={() => setPendingAction('review')}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-colors cursor-pointer mr-auto"
          >
            <ClipboardCheck className="w-3.5 h-3.5" /> Confirm Match
          </button>
        )}

        {/* Action buttons for non-matched, unreviewed */}
        {!isMatch && !isReviewed && (
          <>
            <button
              onClick={() => setPendingAction('approve')}
              className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors cursor-pointer"
            >
              <ShieldCheck className="w-3.5 h-3.5" /> Approve
            </button>
            {status !== 'no_vendor_data' && status !== 'no_data' && status !== 'unmatched_line_item' && (
              <button
                onClick={() => setPendingAction('force_match')}
                className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold rounded-lg bg-pink-500 text-white hover:bg-pink-600 transition-colors cursor-pointer"
              >
                <ShieldCheck className="w-3.5 h-3.5" /> Force Match
              </button>
            )}
            <button
              onClick={() => setPendingAction('dismiss')}
              className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold rounded-lg bg-white text-slate-600 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" /> Dismiss
            </button>
            {onMapLineItem && (
              <button
                onClick={() => {
                  const label = isPax8 ? reconciliation.productName : rule?.label;
                  onMapLineItem(ruleId, label);
                }}
                className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold rounded-lg bg-white text-blue-600 hover:bg-blue-50 border border-blue-200 transition-colors cursor-pointer"
              >
                <Link2 className="w-3.5 h-3.5" /> Map
              </button>
            )}
            <div className="flex-1" />
          </>
        )}

        {/* Note button */}
        <button
          onClick={() => setShowNoteInput(true)}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg text-slate-500 hover:bg-slate-100 transition-colors cursor-pointer"
        >
          <MessageSquarePlus className="w-3.5 h-3.5" /> Note
        </button>

        {/* Re-verify */}
        {onReVerify && (
          <button
            onClick={() => onReVerify(ruleId)}
            className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Re-verify
          </button>
        )}
      </div>

      {/* Current review notes */}
      {review?.notes && (
        <div className="mt-3 bg-white rounded-lg px-3 py-2 border border-slate-100">
          <p className="text-xs text-slate-600">{review.notes}</p>
        </div>
      )}
    </div>
  );
}

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
  snapshot,
  staleness,
  signOffDate,
  isSaving: isSavingProp,
}) {
  if (!reconciliation) return null;

  const isPax8 = !!reconciliation.ruleId;
  const ruleId = isPax8 ? reconciliation.ruleId : reconciliation.rule?.id;
  const label = isPax8 ? reconciliation.productName : reconciliation.rule?.label;
  const integrationLabel = reconciliation.integrationLabel || '';
  const { matchedLineItems = [], psaQty, vendorQty } = reconciliation;
  const review = reconciliation.review;
  const badge = getStatusBadge(reconciliation);

  const hasDataChange = staleness?.changeDetected;
  const hasReview = !!review?.reviewed_at;
  const psaPrev = snapshot ? Number(snapshot.psa_qty ?? 0) : null;
  const vendorPrev = snapshot ? Number(snapshot.vendor_qty ?? 0) : null;
  const diff = (Number(psaQty ?? 0)) - (Number(vendorQty ?? 0));

  const showBillingToggle = !isPax8 && reconciliation.rule?.integration_key?.startsWith('datto_rmm') && onSaveVendorDivisor && !readOnly;
  const matchPattern = !isPax8 ? reconciliation.rule?.match_pattern : null;

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

  const exclusionCount = excludedItemsForRule?.length || 0;

  return (
    <Dialog open={!!reconciliation} onOpenChange={(open) => { if (!open) onClose?.(); }}>
      <DialogContent className="max-w-xl rounded-2xl p-0 gap-0 border-slate-200/80 overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-slate-100 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-base font-bold text-slate-900 truncate">
                {label}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400 mt-0.5 truncate">
                {integrationLabel}
                {matchPattern && integrationLabel && ' \u00B7 '}
                {matchPattern && <span className="font-mono text-[11px] bg-slate-100 px-1.5 py-0.5 rounded">{matchPattern}</span>}
                {readOnly && snapshotDate && (
                  <span className="ml-2 text-purple-500 font-medium">
                    Snapshot {new Date(snapshotDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                )}
              </DialogDescription>
            </div>
            <span className={cn('inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold ring-1 shrink-0', badge.bg, badge.text, badge.ring)}>
              {badge.label}
            </span>
          </div>
        </DialogHeader>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Stat cards */}
          <div className="grid grid-cols-3 gap-3">
            <StatCard label="PSA" value={psaQty} previousValue={psaPrev} />
            <StatCard label="Vendor" value={vendorQty} previousValue={vendorPrev} />
            <StatCard label="Diff" value={diff} variant="diff" />
          </div>

          {/* Change alert */}
          {hasDataChange && !readOnly && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200/60 rounded-lg px-3 py-2">
              <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
              <p className="text-xs font-medium text-red-700">Quantities changed since last review</p>
            </div>
          )}

          {/* Last reviewed */}
          {hasReview && !readOnly && (
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <Clock className="w-3 h-3" />
              <span>Reviewed by <span className="font-medium text-slate-500">{review.reviewed_by_name || 'Unknown'}</span></span>
              <span>\u00B7</span>
              <span>{timeAgo(review.reviewed_at)}</span>
              {signOffDate && (
                <>
                  <span>\u00B7</span>
                  <span>Signed off {new Date(signOffDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                </>
              )}
            </div>
          )}

          {/* Pax8 extra details */}
          {isPax8 && (
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
              {reconciliation.totalVendorQty !== reconciliation.vendorQty && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Total Pax8</span>
                  <span className="font-semibold text-slate-700 tabular-nums">{reconciliation.totalVendorQty}</span>
                </div>
              )}
              {reconciliation.subscriptionId && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Sub ID</span>
                  <span className="font-mono text-[11px] text-slate-600 truncate ml-2">{reconciliation.subscriptionId}</span>
                </div>
              )}
              {reconciliation.billingTerm && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Billing</span>
                  <span className="font-semibold text-slate-700">{reconciliation.billingTerm}</span>
                </div>
              )}
              {reconciliation.price > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Price/Unit</span>
                  <span className="font-semibold text-slate-700 tabular-nums">${parseFloat(reconciliation.price).toFixed(2)}</span>
                </div>
              )}
              {reconciliation.startDate && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Start</span>
                  <span className="font-semibold text-slate-700">{new Date(reconciliation.startDate).toLocaleDateString()}</span>
                </div>
              )}
            </div>
          )}

          {/* Billing model toggle (Datto RMM) */}
          {showBillingToggle && (
            <BillingModelToggle
              ruleId={ruleId}
              currentDivisor={reconciliation.vendorDivisor || 1}
              rawVendorQty={reconciliation.rawVendorQty}
              onSave={onSaveVendorDivisor}
            />
          )}

          {/* Line items */}
          {matchedLineItems.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Line Items ({matchedLineItems.length})
              </p>
              <div className="space-y-1.5">
                {matchedLineItems.map((li) => (
                  <div key={li.id} className="bg-slate-50/80 rounded-lg px-3 py-2">
                    <p className="text-sm font-medium text-slate-700 truncate">{li.description}</p>
                    <div className="flex gap-3 mt-0.5 text-[11px] text-slate-400 tabular-nums">
                      <span>Qty: {li.quantity}</span>
                      {li.price > 0 && <span>${parseFloat(li.price).toFixed(2)}</span>}
                      {li.net_amount > 0 && <span>Net: ${parseFloat(li.net_amount).toFixed(2)}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {matchedLineItems.length === 0 && (
            <p className="text-xs text-slate-400 italic">No matching HaloPSA line items</p>
          )}

          {/* Mapped vendor items */}
          {mappedVendorItems.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-pink-400 mb-2">
                Mapped Vendor Items ({mappedVendorItems.length})
              </p>
              <div className="rounded-lg border border-pink-200/60 overflow-hidden">
                {mappedVendorItems.map((item, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-2 border-b border-pink-100 last:border-b-0">
                    <span className="text-xs font-medium text-slate-700">{item.name}</span>
                    <span className="text-xs font-bold text-pink-600 tabular-nums">{item.qty}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between px-3 py-2 bg-pink-50/80">
                  <span className="text-[10px] font-semibold text-pink-600 uppercase">Total</span>
                  <span className="text-xs font-bold text-pink-700 tabular-nums">
                    {mappedVendorItems.reduce((sum, m) => sum + (m.qty || 0), 0)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Exclusions */}
          {!readOnly && (
            <CollapsibleSection
              title="Exclusions"
              icon={ShieldOff}
              count={exclusionCount}
              defaultOpen={exclusionCount > 0}
            >
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
            </CollapsibleSection>
          )}

          {/* Read-only exclusions */}
          {readOnly && (exclusionCount > 0 || reconciliation.review?.exclusion_count > 0) && (
            <CollapsibleSection
              title="Excluded Accounts"
              icon={ShieldOff}
              count={exclusionCount || reconciliation.review?.exclusion_count || 0}
              defaultOpen
            >
              {exclusionCount > 0 ? (
                <div className="space-y-1">
                  {excludedItemsForRule.map((item) => (
                    <div key={item.id} className="flex items-center justify-between py-1">
                      <span className="text-xs font-medium text-slate-700">{item.vendor_item_label || item.vendor_item_id}</span>
                      {item.reason && <span className="text-[10px] text-amber-600">{item.reason}</span>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-amber-700">
                  {reconciliation.review.exclusion_count} excluded
                  {reconciliation.review.exclusion_reason && ` \u2014 "${reconciliation.review.exclusion_reason}"`}
                </p>
              )}
            </CollapsibleSection>
          )}

          {/* Notes & History */}
          <CollapsibleSection
            title="Audit Log"
            icon={Clock}
          >
            <HistoryTimeline customerId={customerId} ruleId={ruleId} />
          </CollapsibleSection>
        </div>

        {/* Action footer */}
        {!readOnly && (
          <ActionFooter
            reconciliation={reconciliation}
            ruleId={ruleId}
            onForceMatch={async (id, notes) => { await onForceMatch?.(id, notes); onClose?.(); }}
            onReview={async (id, opts) => { await onReview?.(id, opts); onClose?.(); }}
            onDismiss={async (id, opts) => { await onDismiss?.(id, opts); onClose?.(); }}
            onReset={async (id) => { await onReset?.(id); onClose?.(); }}
            onMapLineItem={(id, lbl) => { onClose?.(); setTimeout(() => onMapLineItem?.(id, lbl), 100); }}
            onReVerify={onReVerify}
            onSaveNotes={onSaveNotes}
            isSaving={isSavingProp || false}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
