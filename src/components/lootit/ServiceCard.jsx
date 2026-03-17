import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Check, X, ChevronRight, RotateCcw, Settings2, StickyNote, Save, Link2, Trash2 } from 'lucide-react';
import ReconciliationBadge from './ReconciliationBadge';
import { getDiscrepancyMessage } from '@/lib/lootit-reconciliation';

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
  const message = getDiscrepancyMessage(reconciliation);
  const isReviewed = review?.status === 'reviewed' || review?.status === 'dismissed';

  const [showNotes, setShowNotes] = useState(false);
  const [noteText, setNoteText] = useState(review?.notes || '');
  const [savingNote, setSavingNote] = useState(false);

  const hasNotes = !!(review?.notes);

  const handleSaveNote = async () => {
    if (!onSaveNotes) return;
    setSavingNote(true);
    try {
      await onSaveNotes(rule.id, noteText);
    } finally {
      setSavingNote(false);
      setShowNotes(false);
    }
  };

  return (
    <div
      className={cn(
        'bg-white rounded-lg border border-slate-200 overflow-hidden transition-all hover:shadow-md',
        isReviewed && 'opacity-50'
      )}
    >
      {/* Status color bar */}
      <div className={cn(
        'h-1',
        status === 'match' ? 'bg-emerald-500' : status === 'over' ? 'bg-orange-500' : status === 'under' ? 'bg-red-500' : 'bg-slate-300'
      )} />

      <div className="px-4 py-3">
        {/* Title row */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <h4 className="font-semibold text-slate-900 text-sm truncate">{rule.label}</h4>
            {onEditRule && (
              <button onClick={() => onEditRule(rule)} className="text-slate-300 hover:text-slate-500 transition-colors shrink-0" title="Edit rule">
                <Settings2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <ReconciliationBadge status={status} difference={difference} />
        </div>

        {/* Integration label */}
        <p className="text-[11px] text-slate-400 mb-3">{reconciliation.integrationLabel}</p>

        {/* Override — compact */}
        {hasOverride && (
          <div className="flex items-center gap-2 mb-3 px-2.5 py-1.5 bg-blue-50 rounded-md">
            <Link2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />
            <span className="text-[11px] text-blue-600 flex-1">Mapped manually</span>
            <button onClick={() => onRemoveMapping?.(rule.id)} className="text-[10px] font-bold text-blue-600 hover:text-blue-800">UNMAP</button>
          </div>
        )}

        {/* Big numbers */}
        <div className="flex items-center mb-3">
          <div className="flex-1 text-center py-2 bg-slate-50 rounded-l-lg border border-slate-200">
            <p className="text-3xl font-black text-slate-900 leading-none">
              {psaQty !== null ? psaQty : '—'}
            </p>
            <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mt-1">PSA</p>
          </div>
          <div className="px-2 text-slate-300 text-sm font-bold">vs</div>
          <div className="flex-1 text-center py-2 bg-slate-50 rounded-r-lg border border-slate-200">
            <p className="text-3xl font-black text-slate-900 leading-none">
              {vendorQty !== null ? vendorQty : '—'}
            </p>
            <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mt-1">VENDOR</p>
          </div>
        </div>

        {/* Message */}
        <p className={cn(
          'text-xs mb-3',
          status === 'match' ? 'text-emerald-600 font-medium' : 'text-slate-500',
          status === 'under' && 'text-red-600 font-semibold',
          status === 'over' && 'text-orange-600 font-semibold'
        )}>
          {isReviewed && <span className="text-slate-400 mr-1">[{review.status === 'reviewed' ? 'Reviewed' : 'Dismissed'}]</span>}
          {message}
        </p>

        {/* Notes inline */}
        {(showNotes || hasNotes) && (
          <div className="mb-3">
            {showNotes ? (
              <div className="space-y-1.5">
                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Add a note…"
                  rows={2}
                  className="w-full text-xs border border-slate-200 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
                  autoFocus
                />
                <div className="flex gap-1.5">
                  <button onClick={handleSaveNote} disabled={savingNote} className="px-2 py-1 text-[10px] font-bold rounded bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50">
                    {savingNote ? 'Saving…' : 'Save'}
                  </button>
                  <button onClick={() => { setShowNotes(false); setNoteText(review?.notes || ''); }} className="px-2 py-1 text-[10px] font-bold rounded bg-slate-100 text-slate-500 hover:bg-slate-200">Cancel</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setShowNotes(true)} className="w-full text-left bg-amber-50 rounded-md px-2.5 py-1.5 text-[11px] text-amber-700 truncate">
                <span className="font-semibold">Note:</span> {review.notes}
              </button>
            )}
          </div>
        )}

        {/* Compact action bar */}
        <div className="flex items-center gap-1.5 pt-2 border-t border-slate-100">
          {!isReviewed && status !== 'match' && status !== 'no_data' && (
            <>
              <button onClick={() => onReview?.(rule.id)} disabled={isSaving} className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-md bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors disabled:opacity-50">
                <Check className="w-3 h-3" /> OK
              </button>
              <button onClick={() => onDismiss?.(rule.id)} disabled={isSaving} className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-md bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors disabled:opacity-50">
                <X className="w-3 h-3" /> Skip
              </button>
            </>
          )}
          {isReviewed && (
            <button onClick={() => onReset?.(rule.id)} disabled={isSaving} className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-md bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors disabled:opacity-50">
              <RotateCcw className="w-3 h-3" /> Reset
            </button>
          )}
          {!showNotes && (
            <button onClick={() => setShowNotes(true)} className={cn('p-1 rounded-md transition-colors', hasNotes ? 'text-amber-500 hover:bg-amber-50' : 'text-slate-300 hover:bg-slate-50')} title="Note">
              <StickyNote className="w-3.5 h-3.5" />
            </button>
          )}
          {onMapLineItem && !hasOverride && (
            <button onClick={() => onMapLineItem?.(rule.id, rule.label)} className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded-md text-blue-500 hover:bg-blue-50 transition-colors">
              <Link2 className="w-3 h-3" /> Map
            </button>
          )}
          <button onClick={() => onDetails?.(reconciliation)} className="ml-auto inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded-md text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors">
            Details <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
