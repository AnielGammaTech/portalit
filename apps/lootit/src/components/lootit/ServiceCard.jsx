import React from 'react';
import { cn } from '@/lib/utils';
import { Check, X, RotateCcw } from 'lucide-react';
import StaleBadge from './StaleBadge';
import AuditFooter from './AuditFooter';

/* ─────────────────────────────────────────────
   Card-state resolution (unchanged logic)
   ───────────────────────────────────────────── */

function getEffectiveStatus(reconciliation, itemExclusionCount) {
  const { psaQty, vendorQty, status, review } = reconciliation;
  const exclusionCount = itemExclusionCount ?? review?.exclusion_count ?? 0;
  if (exclusionCount <= 0) return status;
  const effectiveVendorQty = vendorQty !== null ? vendorQty - exclusionCount : null;
  if (psaQty === null || effectiveVendorQty === null) return status;
  const diff = psaQty - effectiveVendorQty;
  if (diff === 0) return 'match';
  return diff > 0 ? 'over' : 'under';
}

function getCardState(reconciliation, itemExclusionCount) {
  const { status, review } = reconciliation;
  const reviewStatus = review?.status;
  const effectiveStatus = getEffectiveStatus(reconciliation, itemExclusionCount);

  if (reviewStatus === 'force_matched') return 'force_matched';
  if (reviewStatus === 'dismissed') return 'dismissed';
  if (effectiveStatus === 'match') return 'auto_matched';
  if (
    status === 'no_vendor_data' ||
    status === 'no_data' ||
    status === 'unmatched_line_item' ||
    status === 'no_psa_data' ||
    status === 'missing_from_psa'
  ) {
    return 'no_vendor';
  }
  if (effectiveStatus === 'over' || effectiveStatus === 'under') return 'mismatch';
  return 'no_vendor';
}

/* ─────────────────────────────────────────────
   Visual config per card state
   ───────────────────────────────────────────── */

const CARD_STYLES = {
  auto_matched: {
    bg: 'linear-gradient(135deg, #F0FDF4 0%, #ECFDF5 100%)',
    border: '1.5px solid #BBF7D0',
    bar: '#22C55E',
    psaNum: '#166534',
    vendorNum: '#166534',
    psaLabel: '#166534',
    vendorLabel: '#166534',
  },
  mismatch: {
    bg: 'linear-gradient(135deg, #FFF7ED 0%, #FFFBEB 100%)',
    border: '1.5px solid #FED7AA',
    bar: '#F97316',
    psaNum: '#C2410C',
    vendorNum: '#B45309',
    psaLabel: '#C2410C',
    vendorLabel: '#B45309',
  },
  no_vendor: {
    bg: 'linear-gradient(135deg, #FFF1F5 0%, #FFF5F7 100%)',
    border: '1.5px solid #FBCFE8',
    bar: '#EC4899',
    psaNum: '#9D174D',
    vendorNum: '#CBD5E1',
    psaLabel: '#9D174D',
    vendorLabel: '#CBD5E1',
  },
  force_matched: {
    bg: 'linear-gradient(135deg, #EFF6FF 0%, #F0F9FF 100%)',
    border: '1.5px solid #BFDBFE',
    bar: '#3B82F6',
    psaNum: '#1E40AF',
    vendorNum: '#1E40AF',
    psaLabel: '#1E40AF',
    vendorLabel: '#1E40AF',
  },
  dismissed: {
    bg: '#F8FAFC',
    border: '1.5px solid #E2E8F0',
    bar: '#CBD5E1',
    psaNum: '#94A3B8',
    vendorNum: '#94A3B8',
    psaLabel: '#94A3B8',
    vendorLabel: '#94A3B8',
  },
};

/* ─────────────────────────────────────────────
   Diff badge (absolute top-right)
   ───────────────────────────────────────────── */

function DiffBadge({ diff }) {
  if (diff === 0) return null;

  const isPositive = diff > 0;
  const style = {
    background: isPositive ? '#FEF3C7' : '#FEE2E2',
    color: isPositive ? '#B45309' : '#DC2626',
  };

  return (
    <span
      className="absolute top-[10px] right-[10px] text-[10px] font-bold tabular-nums px-2 py-0.5 rounded-full z-10"
      style={style}
    >
      {isPositive ? '+' : ''}{diff}
    </span>
  );
}

/* ─────────────────────────────────────────────
   Quantity display block (center zone)
   ───────────────────────────────────────────── */

function QtyBlock({ psaQty, vendorQty, cardState, styles }) {
  const isMatched = cardState === 'auto_matched' || cardState === 'force_matched';
  const hasAnyData = psaQty !== null || vendorQty !== null;

  const separator = isMatched ? '=' : hasAnyData ? 'vs' : '\u2014';

  return (
    <div className="flex items-center justify-center gap-1.5 flex-1">
      <div className="text-center w-16">
        <div
          className="text-[28px] font-bold leading-none tabular-nums h-[32px] flex items-end justify-center"
          style={{ color: styles.psaNum }}
        >
          {psaQty !== null ? psaQty : '\u2014'}
        </div>
        <div
          className="text-[9px] font-semibold uppercase tracking-wider mt-1"
          style={{ color: styles.psaLabel, opacity: 0.5 }}
        >
          PSA
        </div>
      </div>

      <span className="text-[10px] font-medium text-slate-300 mx-0.5">
        {separator}
      </span>

      <div className="text-center w-16">
        <div
          className="text-[28px] font-bold leading-none tabular-nums h-[32px] flex items-end justify-center"
          style={{ color: styles.vendorNum }}
        >
          {vendorQty !== null ? vendorQty : '\u2014'}
        </div>
        <div
          className="text-[9px] font-semibold uppercase tracking-wider mt-1"
          style={{ color: styles.vendorLabel, opacity: 0.5 }}
        >
          Vendor
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Bottom action zone
   ───────────────────────────────────────────── */

function CardActionZone({ cardState, ruleId, ruleLabel, onForceMatch, onReset, onMapLineItem, onRemoveMapping, overrideCount, hasOverride, isSaving }) {
  const btnBase = 'block w-full py-[7px] rounded-lg text-[12px] font-semibold text-center transition-all';

  switch (cardState) {
    case 'auto_matched':
      return (
        <div className="px-2 pb-[10px]">
          <div
            className={cn(btnBase, 'cursor-default flex items-center justify-center gap-1.5')}
            style={{ background: '#DCFCE7', color: '#166534' }}
          >
            <span
              className="inline-block w-[5px] h-[5px] rounded-full"
              style={{ background: '#22C55E' }}
            />
            Auto-Matched
          </div>
        </div>
      );

    case 'force_matched':
      return (
        <div className="px-2 pb-[10px] space-y-1">
          <div
            className={cn(btnBase, 'cursor-default flex items-center justify-center gap-1.5')}
            style={{ background: '#DBEAFE', color: '#1E40AF' }}
          >
            <Check className="w-3 h-3" strokeWidth={2.5} />
            {overrideCount > 0 ? `Mapped to ${overrideCount} item${overrideCount > 1 ? 's' : ''}` : 'Approved'}
          </div>
          <div className="flex items-center justify-center gap-3">
            {overrideCount > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); onMapLineItem?.(ruleId, ruleLabel); }}
                disabled={isSaving}
                className="text-[10px] text-blue-400 cursor-pointer hover:text-blue-600 transition-colors"
              >
                Edit mapping
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); hasOverride ? onRemoveMapping?.(ruleId) : onReset?.(ruleId); }}
              disabled={isSaving}
              className="text-[10px] text-red-400 cursor-pointer hover:text-red-600 transition-colors"
            >
              Reset
            </button>
          </div>
        </div>
      );

    case 'dismissed':
      return (
        <div className="px-2 pb-[10px]">
          <div
            className={cn(btnBase, 'cursor-default flex items-center justify-center gap-1.5')}
            style={{ background: '#F1F5F9', color: '#94A3B8' }}
          >
            <X className="w-3 h-3" strokeWidth={2.5} />
            Skipped
          </div>
        </div>
      );

    case 'no_vendor':
      return (
        <div className="px-2 pb-1 flex flex-col gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); onMapLineItem?.(ruleId, ruleLabel); }}
            disabled={isSaving}
            className={cn(btnBase, 'text-white hover:brightness-[0.92] disabled:opacity-50')}
            style={{ background: 'linear-gradient(135deg, #EC4899, #DB2777)' }}
          >
            Map to Vendor
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onForceMatch?.(ruleId); }}
            disabled={isSaving}
            className="text-center text-[10px] text-slate-400 cursor-pointer pb-1 hover:text-slate-600 transition-colors disabled:opacity-50"
          >
            Approve as-is
          </button>
        </div>
      );

    case 'mismatch':
      return (
        <div className="px-2 pb-[10px]">
          <button
            onClick={(e) => { e.stopPropagation(); onForceMatch?.(ruleId); }}
            disabled={isSaving}
            className={cn(btnBase, 'text-white cursor-pointer hover:brightness-[0.92] disabled:opacity-50')}
            style={{ background: 'linear-gradient(135deg, #F97316, #EA580C)' }}
          >
            Force Match
          </button>
        </div>
      );

    default:
      return null;
  }
}

/* ─────────────────────────────────────────────
   ServiceCard (main export)
   ───────────────────────────────────────────── */

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
  staleness,
  itemExclusionCount,
  isVerified,
}) {
  const { rule, psaQty, vendorQty, review } = reconciliation;

  const exclusionCount = itemExclusionCount ?? review?.exclusion_count ?? 0;
  const effectiveVendorQty = vendorQty !== null ? vendorQty - exclusionCount : null;
  const cardState = getCardState(reconciliation, itemExclusionCount);
  const styles = CARD_STYLES[cardState] || CARD_STYLES.no_vendor;

  const isDismissed = cardState === 'dismissed';
  const showDiff = cardState === 'mismatch' && psaQty !== null && effectiveVendorQty !== null;
  const diff = showDiff ? psaQty - effectiveVendorQty : 0;

  const handleCardClick = () => {
    onDetails?.(reconciliation);
  };

  const handleForceMatchAction = (ruleId) => {
    onDetails?.(reconciliation);
  };

  const multiMapLabel = hasOverride && overrideCount > 1
    ? `Mapped to ${overrideCount} items`
    : null;

  return (
    <div
      className="relative rounded-[14px] overflow-hidden flex flex-col cursor-pointer"
      style={{
        height: '210px',
        background: styles.bg,
        border: staleness?.changeDetected
          ? '1.5px solid rgba(239, 68, 68, 0.4)'
          : staleness?.isStale
          ? '1.5px solid rgba(234, 179, 8, 0.4)'
          : styles.border,
        opacity: isDismissed ? 0.7 : 1,
        transition: 'all 0.2s ease',
      }}
      onClick={handleCardClick}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 8px 24px -4px rgba(236, 72, 153, 0.15)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      {/* Status bar — 3px colored strip */}
      <div className="h-[3px] w-full" style={{ background: styles.bar }} />

      {/* Diff badge — absolute top-right for mismatches */}
      {showDiff && <DiffBadge diff={diff} />}
      {staleness && (
        <StaleBadge
          stalenessDays={staleness.stalenessDays}
          changeDetected={staleness.changeDetected}
          forceMatchStale={staleness.forceMatchStale}
          exclusionStale={staleness.exclusionStale}
          exclusionDaysSinceVerified={staleness.exclusionDaysSinceVerified}
        />
      )}

      {/* Card header — fixed height so numbers always align */}
      <div className="px-3 pt-[10px] h-[42px]">
        <h4 className="text-[13px] font-bold text-slate-800 leading-tight truncate">
          {rule.label}
        </h4>
        {multiMapLabel && cardState === 'force_matched' ? (
          <p className="text-[10px] font-medium text-blue-500 leading-tight truncate">
            {multiMapLabel}
          </p>
        ) : (
          <p className="text-[10px] text-slate-400 leading-tight truncate">
            {reconciliation.integrationLabel}
          </p>
        )}
      </div>

      {/* Center zone: fixed height so numbers are always at the same position */}
      <div className="h-[72px] flex items-center">
        <QtyBlock
          psaQty={psaQty}
          vendorQty={effectiveVendorQty}
          cardState={cardState}
          styles={styles}
        />
      </div>

      {/* Optional indicators — fixed height slot */}
      <div className="h-[14px] flex items-center justify-center">
        {multiMapLabel && cardState !== 'force_matched' ? (
          <p className="text-[10px] font-medium text-pink-500 text-center truncate">
            {multiMapLabel}
          </p>
        ) : exclusionCount > 0 ? (
          <p className="text-[8px] text-amber-500 font-medium text-center" title={`${exclusionCount} excluded`}>
            -{exclusionCount} excluded
          </p>
        ) : null}
      </div>

      {/* Bottom action zone */}
      <div className="mt-auto">
        <CardActionZone
          cardState={cardState}
          ruleId={rule.id}
          ruleLabel={rule.label}
          onForceMatch={handleForceMatchAction}
          onReset={onReset}
          onMapLineItem={onMapLineItem}
          onRemoveMapping={onRemoveMapping}
          overrideCount={overrideCount || 0}
          hasOverride={hasOverride}
          isSaving={isSaving}
        />
      </div>
      <div className="h-[18px]">
        <AuditFooter
          reviewStatus={review?.status}
          reviewedByName={review?.reviewed_by_name}
          reviewedAt={review?.reviewed_at}
          isStale={staleness?.isStale}
          changeDetected={staleness?.changeDetected}
          previousPsaQty={staleness?.previousPsaQty}
          previousVendorQty={staleness?.previousVendorQty}
          isVerified={isVerified}
        />
      </div>
    </div>
  );
}
