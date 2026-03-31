import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Check, X, ChevronRight, RotateCcw, Settings2, StickyNote, Link2, ShieldCheck } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import ReconciliationBadge from './ReconciliationBadge';
import { getDiscrepancyMessage } from '@/lib/lootit-reconciliation';
import { STATUS_COLORS } from './lootit-constants';

const STATUS_STYLES = {
  match: { card: STATUS_COLORS.match.card, bar: STATUS_COLORS.match.bar, numBg: STATUS_COLORS.match.numBg, numText: STATUS_COLORS.match.numText, labelText: STATUS_COLORS.match.labelText },
  over: { card: STATUS_COLORS.over.card, bar: STATUS_COLORS.over.bar, numBg: STATUS_COLORS.over.numBg, numText: STATUS_COLORS.over.numText, labelText: STATUS_COLORS.over.labelText },
  under: { card: STATUS_COLORS.under.card, bar: STATUS_COLORS.under.bar, numBg: STATUS_COLORS.under.numBg, numText: STATUS_COLORS.under.numText, labelText: STATUS_COLORS.under.labelText },
  default: { card: STATUS_COLORS.neutral.card, bar: STATUS_COLORS.neutral.bar, numBg: STATUS_COLORS.neutral.numBg, numText: STATUS_COLORS.neutral.numText, labelText: STATUS_COLORS.neutral.labelText },
};

const REVIEWED_STYLES = {
  card: 'border-amber-200',
  bar: 'bg-amber-400',
  numBg: 'bg-amber-50/60 border-amber-200',
  numText: 'text-amber-800',
  labelText: 'text-amber-400',
};

export default function ServiceCard({
  reconciliation,
  onReview,
  onDismiss,
  onDetails,
  onReset,
  onEditRule,
  onSaveNotes,
  onMapLineItem,
  onRemoveMapping,
  hasOverride,
  isSaving,
}) {
  const { rule, psaQty, vendorQty, difference, status, review } = reconciliation;
  const isReviewed = review?.status === 'reviewed' || review?.status === 'dismissed';

  const [showNotes, setShowNotes] = useState(false);
  const [noteText, setNoteText] = useState(review?.notes || '');
  const [savingNote, setSavingNote] = useState(false);
  const [pendingAction, setPendingAction] = useState(null); // 'review' or 'dismiss'

  const hasNotes = !!(review?.notes);
  const hasExclusions = review?.exclusion_count > 0;

  // Compute effective vendor qty after exclusions
  const exclusionCount = review?.exclusion_count || 0;
  const effectiveVendorQty = vendorQty !== null ? vendorQty - exclusionCount : null;
  const effectiveDifference = psaQty !== null && effectiveVendorQty !== null ? psaQty - effectiveVendorQty : difference;
  const effectiveStatus = hasExclusions
    ? (effectiveDifference === 0 ? 'match' : effectiveDifference > 0 ? 'over' : 'under')
    : status;

  const baseStyles = STATUS_STYLES[hasExclusions ? effectiveStatus : status] || STATUS_STYLES.default;
  const styles = isReviewed ? { ...baseStyles, ...REVIEWED_STYLES } : baseStyles;

  const handleSaveNote = async () => {
    if (!onSaveNotes) return;
    setSavingNote(true);
    try {
      if (pendingAction === 'review') {
        // Save note + review in one call so notes aren't overwritten
        await onReview?.(rule.id, { notes: noteText });
      } else if (pendingAction === 'dismiss') {
        await onDismiss?.(rule.id, { notes: noteText });
      } else {
        // Standalone note save
        await onSaveNotes(rule.id, noteText);
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

  return (
    <div
      className={cn(
        'rounded-lg border overflow-hidden transition-all hover:shadow-md cursor-pointer h-full flex flex-col',
        isReviewed ? 'bg-gradient-to-br from-amber-50 via-yellow-50 to-amber-100/80 border-amber-200' : styles.card,
      )}
      style={isReviewed ? { backgroundImage: 'linear-gradient(135deg, #fffbeb 0%, #fef9c3 50%, #fef3c7 100%)' } : undefined}
      onClick={() => onDetails?.(reconciliation)}
    >
      {/* Status color bar */}
      <div className={cn('h-1', styles.bar)} />

      <div className="px-3 py-2 flex-1 flex flex-col">
        {/* Title row */}
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <h4 className="font-semibold text-slate-900 text-xs truncate">{rule.label}</h4>
            {onEditRule && (
              <button onClick={() => onEditRule(rule)} className="text-slate-300 hover:text-slate-500 transition-colors shrink-0" title="Edit rule">
                <Settings2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <ReconciliationBadge status={hasExclusions ? effectiveStatus : status} difference={hasExclusions ? effectiveDifference : difference} />
        </div>

        {/* Integration label */}
        <p className="text-[10px] text-slate-400 mb-1.5">{reconciliation.integrationLabel}</p>

        {/* Override — compact */}
        {hasOverride && (
          <div className="flex items-center gap-2 mb-2 px-2.5 py-1.5 bg-blue-50/80 rounded-md border border-blue-100">
            <Link2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />
            <span className="text-[11px] text-blue-600 flex-1">Mapped manually</span>
            <button onClick={() => onRemoveMapping?.(rule.id)} className="text-[10px] font-bold text-blue-600 hover:text-blue-800">UNMAP</button>
          </div>
        )}

        {/* Compact numbers */}
        <div className="flex items-center mb-2 gap-1">
          <div className={cn('flex-1 text-center py-1 rounded-md border', styles.numBg)}>
            <p className={cn('text-base font-bold tabular-nums leading-none', styles.numText)}>
              {psaQty !== null ? psaQty : '—'}
            </p>
            <p className={cn('text-[8px] uppercase tracking-widest font-semibold mt-0.5', styles.labelText)}>PSA</p>
          </div>
          <span className="text-[10px] text-slate-300 font-medium">vs</span>
          <div className={cn('flex-1 text-center py-1 rounded-md border', styles.numBg)}>
            <p className={cn('text-base font-bold tabular-nums leading-none', styles.numText)}>
              {effectiveVendorQty !== null ? effectiveVendorQty : '—'}
            </p>
            {hasExclusions && vendorQty !== null && (
              <p className="text-[8px] text-amber-500 line-through">{vendorQty}</p>
            )}
            <p className={cn('text-[8px] uppercase tracking-widest font-semibold mt-0.5', styles.labelText)}>VENDOR</p>
          </div>
        </div>

        {/* Matched checkmark — show when effective status is match */}
        {(hasExclusions ? effectiveStatus : status) === 'match' && !isReviewed && (
          <div className="flex items-center justify-center gap-1.5 mb-2 text-emerald-600">
            <Check className="w-3.5 h-3.5" />
            <span className="text-[11px] font-semibold">
              {hasExclusions ? 'Counts match (after exclusions)' : getDiscrepancyMessage(reconciliation)}
            </span>
          </div>
        )}

        {/* Message for non-match */}
        {(hasExclusions ? effectiveStatus : status) !== 'match' && (
          <p className={cn(
            'text-[11px] mb-2 text-center',
            'text-slate-500',
            (hasExclusions ? effectiveStatus : status) === 'under' && 'text-red-600 font-semibold',
            (hasExclusions ? effectiveStatus : status) === 'over' && 'text-amber-600 font-semibold'
          )}>
            {isReviewed && <span className="text-slate-400 mr-1">[{review.status === 'reviewed' ? 'Reviewed' : 'Dismissed'}]</span>}
            {getDiscrepancyMessage(reconciliation)}
          </p>
        )}

        {/* Notes editing -- only shown when user clicks the note icon */}
        {showNotes && (
          <div className="mb-2" onClick={(e) => e.stopPropagation()}>
            <div className="space-y-2">
              {pendingAction && (
                <p className="text-xs font-medium text-amber-700 bg-amber-50 px-2 py-1 rounded-md border border-amber-200">
                  Please add a note explaining why this is being {pendingAction === 'review' ? 'marked OK' : 'skipped'}
                </p>
              )}
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder={pendingAction ? 'Required: explain the discrepancy\u2026' : 'Add a note\u2026'}
                rows={2}
                className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none bg-white"
                autoFocus
              />
              <div className="flex gap-1.5">
                <button
                  onClick={handleSaveNote}
                  disabled={savingNote || (pendingAction && !noteText.trim())}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 transition-colors"
                >
                  {savingNote ? 'Saving\u2026' : pendingAction ? `Save & ${pendingAction === 'review' ? 'OK' : 'Skip'}` : 'Save'}
                </button>
                <button
                  onClick={() => { setShowNotes(false); setNoteText(review?.notes || ''); setPendingAction(null); }}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Exclusion badge */}
        {hasExclusions && (
          <div className="flex items-center gap-2 mb-2 px-2.5 py-1.5 bg-amber-50 rounded-md border border-amber-200">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span className="text-[11px] font-medium text-amber-700 flex-1">
              {review.exclusion_count} {review.exclusion_reason || 'excluded'} — not counted
            </span>
          </div>
        )}

        {/* Note preview strip */}
        {hasNotes && !showNotes && (
          <button onClick={(e) => { e.stopPropagation(); setShowNotes(true); }} className="w-full text-left mb-2 flex items-center gap-1.5 px-2 py-1 bg-amber-50 rounded-md border border-amber-100 hover:bg-amber-100 transition-colors">
            <StickyNote className="w-3 h-3 text-amber-500 shrink-0" />
            <span className="text-[10px] text-amber-700 truncate">{review.notes}</span>
          </button>
        )}

        {/* Action bar */}
        {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events */}
        <div onClick={(e) => e.stopPropagation()} className={cn(
          'flex items-center gap-1.5 pt-1.5 border-t mt-auto',
          status === 'match' ? 'border-emerald-100' : status === 'over' ? 'border-amber-100' : status === 'under' ? 'border-red-100' : 'border-slate-100'
        )}>
          <TooltipProvider delayDuration={300}>
            {!isReviewed && status !== 'match' && status !== 'no_data' && (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => handleActionWithNote('review')}
                      disabled={isSaving}
                      className="p-1.5 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 shadow-sm transition-colors disabled:opacity-50"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>OK</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => handleActionWithNote('dismiss')}
                      disabled={isSaving}
                      className="p-1.5 rounded-lg bg-slate-200 text-slate-700 hover:bg-slate-300 transition-colors disabled:opacity-50"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Skip</TooltipContent>
                </Tooltip>
              </>
            )}
            {isReviewed && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={() => onReset?.(rule.id)} disabled={isSaving}
                    className="p-1.5 rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200 border border-amber-200 transition-colors disabled:opacity-50">
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Undo</TooltipContent>
              </Tooltip>
            )}
            {!showNotes && !pendingAction && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={() => setShowNotes(true)} className={cn('p-1.5 rounded-lg transition-colors', hasNotes ? 'text-amber-500 hover:bg-amber-50' : 'text-slate-300 hover:bg-slate-50')}>
                    <StickyNote className="w-3.5 h-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Note</TooltipContent>
              </Tooltip>
            )}
            {onMapLineItem && !hasOverride && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={() => onMapLineItem?.(rule.id, rule.label)}
                    className="p-1.5 rounded-lg text-blue-500 hover:bg-blue-50 transition-colors">
                    <Link2 className="w-3.5 h-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Map</TooltipContent>
              </Tooltip>
            )}
          </TooltipProvider>
          <span className="ml-auto inline-flex items-center gap-1 text-xs text-slate-300">
            <ChevronRight className="w-3.5 h-3.5" />
          </span>
        </div>
      </div>
    </div>
  );
}
