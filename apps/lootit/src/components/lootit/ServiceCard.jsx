import React from 'react';
import { cn } from '@/lib/utils';
import { Check, RotateCcw, ShieldCheck, ShieldOff } from 'lucide-react';
import { STATUS_COLORS } from './lootit-constants';

const STATUS_STYLES = {
  match: {
    card: STATUS_COLORS.match.card,
    bar: STATUS_COLORS.match.bar,
    qtyText: 'text-emerald-700',
  },
  over: {
    card: STATUS_COLORS.over.card,
    bar: STATUS_COLORS.over.bar,
    qtyText: 'text-amber-700',
  },
  under: {
    card: STATUS_COLORS.under.card,
    bar: STATUS_COLORS.under.bar,
    qtyText: 'text-red-700',
  },
  default: {
    card: STATUS_COLORS.neutral.card,
    bar: STATUS_COLORS.neutral.bar,
    qtyText: 'text-slate-600',
  },
};

function getEffectiveStatus(reconciliation) {
  const { psaQty, vendorQty, status, review } = reconciliation;
  const exclusionCount = review?.exclusion_count || 0;
  if (exclusionCount <= 0) return status;
  const effectiveVendorQty = vendorQty !== null ? vendorQty - exclusionCount : null;
  if (psaQty === null || effectiveVendorQty === null) return status;
  const diff = psaQty - effectiveVendorQty;
  if (diff === 0) return 'match';
  return diff > 0 ? 'over' : 'under';
}

function getCardState(reconciliation) {
  const { status, review } = reconciliation;
  const reviewStatus = review?.status;
  const effectiveStatus = getEffectiveStatus(reconciliation);

  if (reviewStatus === 'force_matched') return 'force_matched';
  if (reviewStatus === 'dismissed') return 'dismissed';
  if (effectiveStatus === 'match') return 'auto_matched';
  if (status === 'no_vendor_data' || status === 'no_data' || status === 'unmatched_line_item' || status === 'no_psa_data' || status === 'missing_from_psa') return 'no_vendor';
  if (effectiveStatus === 'over' || effectiveStatus === 'under') return 'mismatch';
  return 'no_vendor';
}

function CardActionZone({ cardState, ruleId, onForceMatch, onDismiss, onReset, onMapLineItem, ruleLabel, isSaving }) {
  switch (cardState) {
    case 'auto_matched':
      return (
        <div className="flex items-center gap-1.5">
          <Check className="w-3.5 h-3.5 text-emerald-500" />
          <span className="text-[11px] font-semibold text-emerald-600">Matched</span>
        </div>
      );

    case 'force_matched':
      return (
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
            <span className="text-[11px] font-semibold text-blue-600">Approved</span>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onReset?.(ruleId); }}
            disabled={isSaving}
            className="p-1 rounded-md text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors disabled:opacity-50"
            title="Undo approval"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        </div>
      );

    case 'dismissed':
      return (
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-1.5">
            <ShieldOff className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[11px] font-semibold text-slate-400">Skipped</span>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onReset?.(ruleId); }}
            disabled={isSaving}
            className="p-1 rounded-md text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors disabled:opacity-50"
            title="Undo skip"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        </div>
      );

    case 'no_vendor':
      return (
        <div className="flex flex-col gap-1.5 w-full">
          <button
            onClick={(e) => { e.stopPropagation(); onMapLineItem?.(ruleId, ruleLabel); }}
            disabled={isSaving}
            className="w-full py-1.5 text-[11px] font-semibold rounded-lg bg-pink-500 text-white hover:bg-pink-600 transition-colors disabled:opacity-50"
          >
            Map to Vendor
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onForceMatch?.(ruleId); }}
            disabled={isSaving}
            className="w-full text-[10px] text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-50"
          >
            Approve as-is
          </button>
        </div>
      );

    case 'mismatch':
      return (
        <button
          onClick={(e) => { e.stopPropagation(); onForceMatch?.(ruleId); }}
          disabled={isSaving}
          className="w-full py-1.5 text-[11px] font-semibold rounded-lg bg-pink-500 text-white hover:bg-pink-600 transition-colors disabled:opacity-50"
        >
          Force Match
        </button>
      );

    default:
      return null;
  }
}

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
  overrideCount = 0,
  isSaving,
}) {
  const { rule, psaQty, vendorQty, status, review } = reconciliation;

  const exclusionCount = review?.exclusion_count || 0;
  const effectiveVendorQty = vendorQty !== null ? vendorQty - exclusionCount : null;
  const effectiveStatus = getEffectiveStatus(reconciliation);
  const cardState = getCardState(reconciliation);

  const styles = STATUS_STYLES[effectiveStatus] || STATUS_STYLES.default;

  const isForceMatched = review?.status === 'force_matched';
  const isDismissed = review?.status === 'dismissed';

  const cardBg = isForceMatched
    ? 'bg-gradient-to-br from-blue-50 via-blue-50/80 to-blue-100/60 border-blue-200'
    : isDismissed
    ? 'bg-slate-50/80 border-slate-200'
    : styles.card;

  const qtyColor = (qty, isVendor) => {
    if (qty === null || qty === undefined) return 'text-slate-400';
    if (effectiveStatus === 'match') return 'text-emerald-700';
    if (isVendor && effectiveStatus === 'under') return 'text-red-600';
    if (isVendor && effectiveStatus === 'over') return 'text-amber-600';
    if (!isVendor && effectiveStatus === 'under') return 'text-red-600';
    if (!isVendor && effectiveStatus === 'over') return 'text-amber-600';
    return 'text-slate-600';
  };

  const handleCardClick = () => {
    onDetails?.(reconciliation);
  };

  // Card action triggers -- "no_vendor" and "mismatch" open the modal
  // (the modal will handle the note requirement before executing)
  const handleForceMatchAction = (ruleId) => {
    onDetails?.(reconciliation);
  };

  return (
    <div
      className={cn(
        'rounded-xl border overflow-hidden transition-all cursor-pointer h-full flex flex-col',
        'hover:shadow-md hover:shadow-slate-200/60',
        cardBg,
      )}
      onClick={handleCardClick}
    >
      {/* Status bar */}
      <div className={cn('h-1', styles.bar)} />

      <div className="px-3 py-2 flex-1 flex flex-col">
        {/* Top: name + integration + diff badge inline */}
        <div className="flex items-start justify-between gap-1">
          <div className="min-w-0 flex-1">
            <h4 className="font-bold text-[13px] text-slate-900 truncate leading-tight">
              {rule.label}
            </h4>
            <p className="text-[10px] text-slate-400 truncate leading-tight">
              {reconciliation.integrationLabel}
            </p>
          </div>
          {effectiveStatus !== 'match' && psaQty !== null && effectiveVendorQty !== null && (
            <span className={cn(
              'text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded-full shrink-0',
              (psaQty - effectiveVendorQty) > 0
                ? 'bg-amber-100 text-amber-700'
                : 'bg-red-100 text-red-700'
            )}>
              {(psaQty - effectiveVendorQty) > 0 ? '+' : ''}{psaQty - effectiveVendorQty}
            </span>
          )}
        </div>

        {/* Middle: PSA vs Vendor — compact big numbers */}
        <div className="flex items-center justify-center gap-3 py-1.5">
          <div className="text-center">
            <span className={cn('text-xl font-bold tabular-nums leading-none', qtyColor(psaQty, false))}>
              {psaQty !== null ? psaQty : '\u2014'}
            </span>
            <p className="text-[8px] uppercase tracking-wider font-semibold text-slate-400">PSA</p>
          </div>
          <span className="text-[10px] text-slate-300">vs</span>
          <div className="text-center">
            <span className={cn('text-xl font-bold tabular-nums leading-none', qtyColor(effectiveVendorQty, true))}>
              {effectiveVendorQty !== null ? effectiveVendorQty : '\u2014'}
            </span>
            <p className="text-[8px] uppercase tracking-wider font-semibold text-slate-400">Vendor</p>
          </div>
          {exclusionCount > 0 && (
            <span className="text-[8px] text-amber-500 font-medium" title={`${exclusionCount} excluded`}>-{exclusionCount}</span>
          )}
        </div>

        {/* Multi-mapping indicator */}
        {hasOverride && overrideCount > 1 && (
          <p className="text-[10px] font-medium text-pink-500 text-center -mt-0.5 mb-0.5">
            {overrideCount} items mapped
          </p>
        )}

        {/* Bottom: action */}
        <div className="mt-auto pt-1 border-t border-slate-100">
          <CardActionZone
            cardState={cardState}
            ruleId={rule.id}
            ruleLabel={rule.label}
            onForceMatch={handleForceMatchAction}
            onDismiss={onDismiss}
            onReset={onReset}
            onMapLineItem={onMapLineItem}
            isSaving={isSaving}
          />
        </div>
      </div>
    </div>
  );
}
