import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import ReconciliationBadge from './ReconciliationBadge';
import { getDiscrepancyMessage } from '@/lib/lootit-reconciliation';
import { STATUS_COLORS } from './lootit-constants';
import { Check, X, RotateCcw, ChevronRight, StickyNote, Link2, ShieldCheck, AlertTriangle, Trash2 } from 'lucide-react';

const PAX8_REVIEWED_STYLES = {
  card: 'border-amber-200', bar: 'bg-amber-400', numBg: 'bg-amber-50/60 border-amber-200', numText: 'text-amber-800', labelText: 'text-amber-400', borderT: 'border-amber-200',
};

export default function Pax8SubscriptionCard({ recon, onReview, onDismiss, onReset, onDetails, onMapLineItem, onRemoveMapping, onSaveNotes, hasOverride, isSaving }) {
  const {
    ruleId, productName, vendorQty, totalVendorQty, psaQty,
    difference, status, matchedLineItems, billingTerm, price,
    startDate, review,
  } = recon;

  const message = getDiscrepancyMessage(recon);
  const isReviewed = review?.status === 'reviewed' || review?.status === 'dismissed';
  const isMissing = status === 'missing_from_psa';

  const [showNotes, setShowNotes] = useState(false);
  const [noteText, setNoteText] = useState(review?.notes || '');
  const [savingNote, setSavingNote] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const hasNotes = !!(review?.notes);
  const hasExclusions = review?.exclusion_count > 0;

  // Compute effective vendor qty after exclusions
  const exclusionCount = review?.exclusion_count || 0;
  const effectiveVendorQty = vendorQty !== null ? vendorQty - exclusionCount : null;
  const effectiveDifference = psaQty !== null && effectiveVendorQty !== null ? psaQty - effectiveVendorQty : difference;
  const effectiveStatus = hasExclusions
    ? (effectiveDifference === 0 ? 'match' : effectiveDifference > 0 ? 'over' : 'under')
    : status;

  const styles = STATUS_COLORS[hasExclusions ? effectiveStatus : status] || STATUS_COLORS.neutral;

  const handleSaveNote = async () => {
    if (!onSaveNotes) return;
    setSavingNote(true);
    try {
      if (pendingAction === 'review') {
        await onReview?.(ruleId, { notes: noteText });
      } else if (pendingAction === 'dismiss') {
        await onDismiss?.(ruleId, { notes: noteText });
      } else {
        await onSaveNotes(ruleId, noteText);
      }
    } finally {
      setSavingNote(false);
      setShowNotes(false);
      setPendingAction(null);
    }
  };

  const handleActionWithNote = (action) => {
    setPendingAction(action);
    setShowNotes(true);
  };

  const totalCost = price > 0 ? (parseFloat(price) * vendorQty).toFixed(2) : null;
  const resolvedStyles = isReviewed ? { ...styles, ...PAX8_REVIEWED_STYLES } : styles;

  return (
    <div
      className={cn(
        'rounded-xl border overflow-hidden transition-all hover:shadow-md cursor-pointer',
        isReviewed ? 'border-amber-200' : resolvedStyles.card,
      )}
      style={isReviewed ? { backgroundImage: 'linear-gradient(135deg, #fffbeb 0%, #fef9c3 50%, #fef3c7 100%)' } : undefined}
      onClick={() => onDetails?.(recon)}
    >
      <div className={cn('h-1', resolvedStyles.bar)} />

      <div className="px-4 py-3">
        {/* Title row */}
        <div className="flex items-center justify-between gap-2 mb-1">
          <h4 className="font-semibold text-slate-900 text-sm leading-tight truncate flex-1">{productName}</h4>
          <ReconciliationBadge status={isMissing ? 'missing_from_psa' : (hasExclusions ? effectiveStatus : status)} difference={hasExclusions ? effectiveDifference : difference} />
        </div>

        {/* Price line */}
        {(billingTerm || totalCost) && (
          <p className="text-[11px] text-slate-400 mb-3">
            {billingTerm || 'Pax8'}{price > 0 ? ` · $${parseFloat(price).toFixed(2)}/unit` : ''}{totalCost ? ` · $${totalCost}/mo` : ''}
          </p>
        )}

        {/* Override / Not Billed */}
        {isMissing && (
          <div className="flex items-center gap-2 mb-3 px-2.5 py-1.5 bg-red-100/60 rounded-md border border-red-200" onClick={(e) => e.stopPropagation()}>
            <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
            <span className="text-[11px] font-medium text-red-700 flex-1">Not billed in PSA</span>
            <button onClick={() => onMapLineItem?.()} className="text-[10px] font-bold text-red-600 hover:text-red-800">MAP</button>
          </div>
        )}
        {hasOverride && !isMissing && (
          <div className="flex items-center gap-2 mb-3 px-2.5 py-1.5 bg-blue-50/80 rounded-md border border-blue-100" onClick={(e) => e.stopPropagation()}>
            <Link2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />
            <span className="text-[11px] text-blue-600 flex-1">Mapped manually</span>
            <button onClick={() => onRemoveMapping?.()} className="text-[10px] font-bold text-blue-600 hover:text-blue-800">UNMAP</button>
          </div>
        )}

        {/* Big numbers */}
        <div className="flex items-center mb-3">
          <div className={cn('flex-1 text-center py-2 rounded-l-lg border', resolvedStyles.numBg)}>
            <p className={cn('text-3xl font-black leading-none', resolvedStyles.numText)}>
              {psaQty !== null ? psaQty : '\u2014'}
            </p>
            <p className={cn('text-[10px] uppercase tracking-widest font-bold mt-1', resolvedStyles.labelText)}>PSA</p>
          </div>
          <div className="px-2 text-slate-300 text-sm font-bold">vs</div>
          <div className={cn('flex-1 text-center py-2 rounded-r-lg border', resolvedStyles.numBg)}>
            <p className={cn('text-3xl font-black leading-none', resolvedStyles.numText)}>
              {effectiveVendorQty !== null ? effectiveVendorQty : '\u2014'}
            </p>
            {hasExclusions && vendorQty !== null && (
              <p className="text-[10px] text-amber-500 line-through">{vendorQty}</p>
            )}
            <p className={cn('text-[10px] uppercase tracking-widest font-bold mt-1', resolvedStyles.labelText)}>PAX8</p>
          </div>
        </div>

        {/* Matched checkmark */}
        {(hasExclusions ? effectiveStatus : status) === 'match' && !isReviewed && (
          <div className="flex items-center gap-1.5 mb-3 text-emerald-600">
            <Check className="w-4 h-4" />
            <span className="text-xs font-semibold">
              {hasExclusions ? 'Counts match (after exclusions)' : message}
            </span>
          </div>
        )}

        {/* Message for non-match */}
        {(hasExclusions ? effectiveStatus : status) !== 'match' && (
          <p className={cn(
            'text-xs mb-3 text-slate-500',
            ((hasExclusions ? effectiveStatus : status) === 'under' || isMissing) && 'text-red-600 font-semibold',
            (hasExclusions ? effectiveStatus : status) === 'over' && 'text-amber-600 font-semibold'
          )}>
            {isReviewed && <span className="text-slate-400 mr-1">[{review.status === 'reviewed' ? 'Reviewed' : 'Dismissed'}]</span>}
            {message}
          </p>
        )}

        {/* Exclusion badge */}
        {hasExclusions && (
          <div className="flex items-center gap-2 mb-3 px-2.5 py-1.5 bg-amber-50 rounded-md border border-amber-200">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span className="text-[11px] font-medium text-amber-700 flex-1">
              {review.exclusion_count} {review.exclusion_reason || 'excluded'} -- not counted
            </span>
          </div>
        )}

        {/* Notes inline -- also shown when pendingAction requires a note */}
        {(showNotes || hasNotes) && (
          <div className="mb-3" onClick={(e) => e.stopPropagation()}>
            {showNotes ? (
              <div className="space-y-2">
                {pendingAction && (
                  <p className="text-xs font-medium text-amber-700 bg-amber-50 px-2.5 py-1.5 rounded-md border border-amber-200">
                    Please add a note explaining why this is being {pendingAction === 'review' ? 'marked OK' : 'skipped'}
                  </p>
                )}
                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder={pendingAction ? 'Required: explain the discrepancy...' : 'Add a note...'}
                  rows={2}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none bg-white"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveNote}
                    disabled={savingNote || (pendingAction && !noteText.trim())}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 transition-colors"
                  >
                    {savingNote ? 'Saving...' : pendingAction ? `Save & ${pendingAction === 'review' ? 'OK' : 'Skip'}` : 'Save Note'}
                  </button>
                  <button
                    onClick={() => { setShowNotes(false); setNoteText(review?.notes || ''); setPendingAction(null); }}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => setShowNotes(true)} className="w-full text-left bg-amber-50 rounded-md px-2.5 py-1.5 text-[11px] text-amber-700 truncate border border-amber-100">
                <span className="font-semibold">Note:</span> {review.notes}
              </button>
            )}
          </div>
        )}

        {/* Action bar */}
        <div onClick={(e) => e.stopPropagation()} className={cn('flex items-center gap-2 pt-2 border-t', resolvedStyles.borderT)}>
          {!isReviewed && status !== 'match' && (
            <>
              <button
                onClick={() => handleActionWithNote('review')}
                disabled={isSaving}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 shadow-sm transition-colors disabled:opacity-50"
              >
                <Check className="w-4 h-4" /> OK
              </button>
              <button
                onClick={() => handleActionWithNote('dismiss')}
                disabled={isSaving}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg bg-slate-200 text-slate-700 hover:bg-slate-300 transition-colors disabled:opacity-50"
              >
                <X className="w-4 h-4" /> Skip
              </button>
            </>
          )}
          {isReviewed && (
            <button onClick={() => onReset?.(ruleId)} disabled={isSaving} className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200 border border-amber-200 transition-colors disabled:opacity-50">
              <RotateCcw className="w-4 h-4" /> Undo
            </button>
          )}
          {!showNotes && !pendingAction && (
            <button onClick={() => setShowNotes(true)} className={cn('p-1.5 rounded-lg transition-colors', hasNotes ? 'text-amber-500 hover:bg-amber-50' : 'text-slate-300 hover:bg-slate-50')} title="Note">
              <StickyNote className="w-4 h-4" />
            </button>
          )}
          {!isMissing && !hasOverride && (
            <button onClick={() => onMapLineItem?.()} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg text-blue-500 hover:bg-blue-50 transition-colors">
              <Link2 className="w-3.5 h-3.5" /> Map
            </button>
          )}
          <span className="ml-auto inline-flex items-center gap-1 text-xs text-slate-300">
            <ChevronRight className="w-3.5 h-3.5" />
          </span>
        </div>
      </div>
    </div>
  );
}
