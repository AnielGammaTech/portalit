import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Check, X, ChevronRight, RotateCcw, Settings2, StickyNote, Save, Link2, Trash2 } from 'lucide-react';
import ReconciliationBadge from './ReconciliationBadge';
import { getDiscrepancyMessage } from '@/lib/lootit-reconciliation';

const STATUS_BORDER = {
  match: 'border-l-emerald-400',
  over: 'border-l-orange-400',
  under: 'border-l-red-400',
  no_psa_data: 'border-l-slate-300',
  no_vendor_data: 'border-l-slate-300',
  no_data: 'border-l-slate-200',
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
        'bg-white rounded-xl border-l-4 border border-slate-200 p-5 transition-all hover:shadow-md',
        STATUS_BORDER[status] || 'border-l-slate-200',
        isReviewed && 'opacity-60'
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h4 className="font-semibold text-slate-900 text-sm truncate">{rule.label}</h4>
            {onEditRule && (
              <button
                onClick={() => onEditRule(rule)}
                className="text-slate-300 hover:text-slate-500 transition-colors flex-shrink-0"
                title="Edit rule"
              >
                <Settings2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            {reconciliation.integrationLabel}
          </p>
        </div>
        <ReconciliationBadge status={status} difference={difference} />
      </div>

      {/* Quantities */}
      <div className="flex items-center gap-6 mb-3">
        <div className="text-center">
          <p className="text-2xl font-bold text-slate-900">
            {psaQty !== null ? psaQty : '—'}
          </p>
          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">
            PSA
          </p>
        </div>
        <div className="text-slate-300 text-lg">vs</div>
        <div className="text-center">
          <p className="text-2xl font-bold text-slate-900">
            {vendorQty !== null ? vendorQty : '—'}
          </p>
          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">
            Vendor
          </p>
        </div>
      </div>

      {/* Override badge */}
      {hasOverride && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 mb-3 flex items-center gap-2">
          <Link2 className="w-4 h-4 text-blue-500 flex-shrink-0" />
          <p className="text-xs font-medium text-blue-700 flex-1">Manually mapped line item</p>
          <button
            onClick={() => onRemoveMapping?.(reconciliation.rule.id)}
            className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-semibold rounded bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors flex-shrink-0"
          >
            <Trash2 className="w-3 h-3" />
            Unmap
          </button>
        </div>
      )}

      {/* Notes inline */}
      {(showNotes || hasNotes) && (
        <div className="mb-3">
          {showNotes ? (
            <div className="space-y-2">
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Add a note about this service…"
                rows={2}
                className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-300 resize-none"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSaveNote}
                  disabled={savingNote}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-semibold rounded bg-pink-500 text-white hover:bg-pink-600 transition-colors disabled:opacity-50"
                >
                  <Save className="w-3 h-3" />
                  {savingNote ? 'Saving…' : 'Save'}
                </button>
                <button
                  onClick={() => { setShowNotes(false); setNoteText(review?.notes || ''); }}
                  className="px-2.5 py-1 text-[10px] font-semibold rounded bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowNotes(true)}
              className="w-full text-left bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700"
            >
              <span className="font-medium">Note:</span> {review.notes}
            </button>
          )}
        </div>
      )}

      {/* Message */}
      <p
        className={cn(
          'text-sm mb-4',
          status === 'match' ? 'text-emerald-600' : 'text-slate-600',
          status === 'under' && 'text-red-600 font-medium',
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

      {/* Actions */}
      <div className="flex items-center gap-2">
        {!isReviewed && status !== 'match' && status !== 'no_data' && (
          <>
            <button
              onClick={() => onReview?.(rule.id)}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-pink-50 text-pink-600 hover:bg-pink-100 transition-colors disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" />
              Reviewed
            </button>
            <button
              onClick={() => onDismiss?.(rule.id)}
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
            onClick={() => onReset?.(rule.id)}
            disabled={isSaving}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-50 text-slate-500 hover:bg-slate-100 transition-colors disabled:opacity-50"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </button>
        )}
        {!showNotes && (
          <button
            onClick={() => setShowNotes(true)}
            className={cn(
              'inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors',
              hasNotes ? 'text-amber-500 hover:bg-amber-50' : 'text-slate-400 hover:bg-slate-50'
            )}
            title="Add note"
          >
            <StickyNote className="w-3.5 h-3.5" />
          </button>
        )}
        {onMapLineItem && !hasOverride && (
          <button
            onClick={() => onMapLineItem?.(reconciliation.rule.id, reconciliation.rule.label)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg text-blue-500 hover:bg-blue-50 transition-colors"
          >
            <Link2 className="w-3.5 h-3.5" />
            Map
          </button>
        )}
        <button
          onClick={() => onDetails?.(reconciliation)}
          className="ml-auto inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg text-slate-500 hover:bg-slate-50 transition-colors"
        >
          Details
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
