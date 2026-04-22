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
  onForceMatch,
  hasOverride,
  isSaving,
}) {
  const { rule, psaQty, vendorQty, difference, status, review } = reconciliation;
  const isReviewed = review?.status === 'reviewed' || review?.status === 'dismissed' || review?.status === 'force_matched';
  const isForceMatched = review?.status === 'force_matched';

  const [showNotes, setShowNotes] = useState(false);
  const [noteText, setNoteText] = useState(review?.notes || '');
  const [savingNote, setSavingNote] = useState(false);
  const [pendingAction, setPendingAction] = useState(null); // 'review', 'dismiss', or 'force_match'

  const hasNotes = !!(review?.notes);
  const hasExclusions = review?.exclusion_count > 0;

  // Engine already subtracts exclusion_count from vendorQty — use directly
  const exclusionCount = review?.exclusion_count || 0;
  const effectiveVendorQty = vendorQty;
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
      if (pendingAction === 'force_match') {
        if (!noteText.trim()) { setSavingNote(false); return; }
        await onForceMatch?.(rule.id, noteText);
      } else if (pendingAction === 'review') {
        await onReview?.(rule.id, { notes: noteText });
      } else if (pendingAction === 'dismiss') {
        await onDismiss?.(rule.id, { notes: noteText });
      } else {
        await onSaveNotes(rule.id, noteText);
      }
      setShowNotes(false);
      setPendingAction(null);
    } catch (_err) {
      // Error toast is shown by the mutation's onError
    } finally {
      setSavingNote(false);
    }
  };

  const handleActionWithNote = (action) => {
    setPendingAction(action);
    setShowNotes(true);
  };

  const effectiveStatusFinal = hasExclusions ? effectiveStatus : status;
  const message = getDiscrepancyMessage(reconciliation);

  return (
    <div
      className={cn(
        'rounded-lg border overflow-hidden transition-all hover:shadow-md cursor-pointer h-full flex flex-col',
        isForceMatched ? 'bg-gradient-to-br from-blue-50 via-blue-50 to-blue-100/80 border-blue-200' :
        isReviewed ? 'bg-gradient-to-br from-amber-50 via-yellow-50 to-amber-100/80 border-amber-200' : styles.card,
      )}
      style={isReviewed ? { backgroundImage: 'linear-gradient(135deg, #fffbeb 0%, #fef9c3 50%, #fef3c7 100%)' } : undefined}
      onClick={() => onDetails?.(reconciliation)}
    >
      {/* SLOT 1: Status bar (fixed 4px) */}
      <div className={cn('h-1', styles.bar)} />

      <div className="px-3 py-2 flex-1 flex flex-col">
        {/* SLOT 2: Title + badge (fixed height) */}
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <h4 className="font-semibold text-slate-900 text-xs truncate">{rule.label}</h4>
            {hasNotes && (
              <span className="shrink-0 w-4 h-4 rounded-full bg-amber-400 flex items-center justify-center" title={review.notes}>
                <StickyNote className="w-2.5 h-2.5 text-white" />
              </span>
            )}
          </div>
          <ReconciliationBadge status={effectiveStatusFinal} difference={hasExclusions ? effectiveDifference : difference} />
        </div>

        {/* SLOT 3: Integration label (fixed height) */}
        <p className="text-[10px] text-slate-400 mb-2 truncate">{reconciliation.integrationLabel}</p>

        {/* SLOT 4: Numbers (fixed height — always present) */}
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
            <p className={cn('text-[8px] uppercase tracking-widest font-semibold mt-0.5', styles.labelText)}>VENDOR</p>
          </div>
        </div>

        {/* SLOT 5: Status message (fixed height — always 1 line) */}
        <p className={cn(
          'text-[11px] text-center truncate mb-2 h-4',
          effectiveStatusFinal === 'match' && !isReviewed ? 'text-emerald-600 font-semibold' :
          effectiveStatusFinal === 'under' ? 'text-red-600 font-semibold' :
          effectiveStatusFinal === 'over' ? 'text-amber-600 font-semibold' :
          'text-slate-400'
        )}>
          {isReviewed && <span className="text-slate-400 mr-1">[{review?.status === 'reviewed' ? 'OK' : 'Skip'}]</span>}
          {effectiveStatusFinal === 'match' && !isReviewed ? `Matched — ${psaQty} licences` : message}
        </p>

        {/* SLOT 6: Info strip (fixed height — shows override OR note OR exclusion, max 1 line) */}
        <div className="h-6 mb-2">
          {hasOverride ? (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-blue-50 rounded border border-blue-100 h-full">
              <Link2 className="w-3 h-3 text-blue-500 shrink-0" />
              <span className="text-[10px] text-blue-600 flex-1 truncate">Mapped manually</span>
              <button
                onClick={(e) => { e.stopPropagation(); onRemoveMapping?.(rule.id); }}
                className="text-[9px] text-red-400 hover:text-red-600 font-medium shrink-0 px-1 hover:bg-red-50 rounded transition-colors"
                title="Remove manual mapping"
              >
                Unmap
              </button>
            </div>
          ) : hasExclusions ? (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-50 rounded border border-amber-100 h-full">
              <ShieldCheck className="w-3 h-3 text-amber-500 shrink-0" />
              <span className="text-[10px] text-amber-700 truncate">{review.exclusion_count} {review.exclusion_reason || 'excluded'}</span>
            </div>
          ) : hasNotes && !showNotes ? (
            <button onClick={(e) => { e.stopPropagation(); setShowNotes(true); }} className="flex items-center gap-1.5 px-2 py-1 bg-amber-50 rounded border border-amber-100 h-full w-full text-left hover:bg-amber-100 transition-colors">
              <StickyNote className="w-3 h-3 text-amber-500 shrink-0" />
              <span className="text-[10px] text-amber-700 truncate">{review.notes}</span>
            </button>
          ) : null}
        </div>

        {/* Notes editor (overlay — only when open) */}
        {showNotes && (
          <div className="mb-2" onClick={(e) => e.stopPropagation()}>
            <div className="space-y-2">
              {pendingAction && (
                <p className="text-[10px] font-medium text-amber-700 bg-amber-50 px-2 py-1 rounded border border-amber-200">
                  Add a note for {pendingAction === 'review' ? 'OK' : 'Skip'}
                </p>
              )}
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Add a note..."
                rows={2}
                className="w-full text-[11px] border border-slate-200 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none bg-white"
                autoFocus
              />
              <div className="flex gap-1.5">
                <button onClick={handleSaveNote} disabled={savingNote || (pendingAction && !noteText.trim())}
                  className="px-2 py-1 text-[10px] font-semibold rounded bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50">
                  {savingNote ? 'Saving...' : pendingAction === 'force_match' ? 'Force Match' : pendingAction ? `Save & ${pendingAction === 'review' ? 'OK' : 'Skip'}` : 'Save'}
                </button>
                <button onClick={() => { setShowNotes(false); setNoteText(review?.notes || ''); setPendingAction(null); }}
                  className="px-2 py-1 text-[10px] font-semibold rounded bg-slate-100 text-slate-500 hover:bg-slate-200">Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* SLOT 7: Action bar (pinned to bottom) */}
        <div onClick={(e) => e.stopPropagation()} className={cn(
          'flex items-center gap-1.5 pt-1.5 border-t mt-auto',
          'border-slate-100'
        )}>
          <TooltipProvider delayDuration={300}>
            {!isReviewed && status !== 'match' && (
              <>
                <Tooltip><TooltipTrigger asChild>
                  <button onClick={() => handleActionWithNote('force_match')} disabled={isSaving}
                    className="p-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 shadow-sm transition-colors disabled:opacity-50">
                    <ShieldCheck className="w-3.5 h-3.5" />
                  </button>
                </TooltipTrigger><TooltipContent>Force Match (requires note)</TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild>
                  <button onClick={() => handleActionWithNote('review')} disabled={isSaving}
                    className="p-1.5 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 shadow-sm transition-colors disabled:opacity-50">
                    <Check className="w-3.5 h-3.5" />
                  </button>
                </TooltipTrigger><TooltipContent>OK</TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild>
                  <button onClick={() => handleActionWithNote('dismiss')} disabled={isSaving}
                    className="p-1.5 rounded-lg bg-slate-200 text-slate-700 hover:bg-slate-300 transition-colors disabled:opacity-50">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </TooltipTrigger><TooltipContent>Skip</TooltipContent></Tooltip>
              </>
            )}
            {isReviewed && (
              <Tooltip><TooltipTrigger asChild>
                <button onClick={() => onReset?.(rule.id)} disabled={isSaving}
                  className="p-1.5 rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200 border border-amber-200 transition-colors disabled:opacity-50">
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </TooltipTrigger><TooltipContent>Undo</TooltipContent></Tooltip>
            )}
            {!showNotes && !pendingAction && (
              <Tooltip><TooltipTrigger asChild>
                <button onClick={() => setShowNotes(true)} className={cn('p-1.5 rounded-lg transition-colors', hasNotes ? 'text-amber-500 hover:bg-amber-50' : 'text-slate-300 hover:bg-slate-50')}>
                  <StickyNote className="w-3.5 h-3.5" />
                </button>
              </TooltipTrigger><TooltipContent>Note</TooltipContent></Tooltip>
            )}
            {onMapLineItem && !hasOverride && (
              <Tooltip><TooltipTrigger asChild>
                <button onClick={() => onMapLineItem?.(rule.id, rule.label)}
                  className="p-1.5 rounded-lg text-blue-500 hover:bg-blue-50 transition-colors">
                  <Link2 className="w-3.5 h-3.5" />
                </button>
              </TooltipTrigger><TooltipContent>Map</TooltipContent></Tooltip>
            )}
          </TooltipProvider>
          <span className="ml-auto inline-flex items-center text-xs text-slate-300">
            <ChevronRight className="w-3.5 h-3.5" />
          </span>
        </div>
      </div>
    </div>
  );
}
