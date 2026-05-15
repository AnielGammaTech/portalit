import React from 'react';
import { cn } from '@/lib/utils';
import StaleBadge from './StaleBadge';
import AuditFooter from './AuditFooter';

function getEffectiveStatus(reconciliation) {
  return reconciliation.status;
}

function getCardState(reconciliation) {
  const { status, review } = reconciliation;
  const reviewStatus = review?.status;
  const effectiveStatus = getEffectiveStatus(reconciliation);

  if (reviewStatus === 'force_matched') return 'force_matched';
  if (reviewStatus === 'dismissed') return 'dismissed';
  if (effectiveStatus === 'match') return 'auto_matched';
  if (status === 'no_psa_data' || status === 'missing_from_psa') return 'no_psa';
  if (
    status === 'no_vendor_data' ||
    status === 'no_data' ||
    status === 'unmatched_line_item'
  ) {
    return 'no_vendor';
  }
  if (effectiveStatus === 'over' || effectiveStatus === 'under') return 'mismatch';
  return 'no_vendor';
}

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
  no_psa: {
    bg: 'linear-gradient(135deg, #FFF7ED 0%, #FFF1F5 100%)',
    border: '1.5px solid #FED7AA',
    bar: '#F59E0B',
    psaNum: '#CBD5E1',
    vendorNum: '#B45309',
    psaLabel: '#CBD5E1',
    vendorLabel: '#B45309',
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
      <span className="text-[10px] font-medium text-slate-300 mx-0.5">{separator}</span>
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

const STATUS_CONFIG = {
  auto_matched: { label: 'Auto-Matched', bg: '#DCFCE7', color: '#166534', dot: '#22C55E' },
  force_matched: { label: 'Approved', bg: '#DBEAFE', color: '#1E40AF' },
  dismissed: { label: 'Skipped', bg: '#F1F5F9', color: '#94A3B8' },
  mismatch: { label: 'Mismatch', bg: '#FEF3C7', color: '#B45309' },
  no_vendor: { label: 'No Vendor', bg: '#FFF1F5', color: '#9D174D' },
  no_psa: { label: 'No PSA', bg: '#FFF7ED', color: '#B45309' },
};

function StatusPill({ cardState, overrideCount }) {
  const base = STATUS_CONFIG[cardState] || STATUS_CONFIG.no_vendor;
  const label = cardState === 'force_matched' && overrideCount > 0
    ? `Mapped (${overrideCount})`
    : base.label;

  return (
    <div className="px-2 pb-[6px]">
      <div
        className="flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-semibold"
        style={{ background: base.bg, color: base.color }}
      >
        {base.dot && (
          <span className="inline-block w-[5px] h-[5px] rounded-full" style={{ background: base.dot }} />
        )}
        {label}
      </div>
    </div>
  );
}

export default function ServiceCard({
  reconciliation,
  onDetails,
  staleness,
  isVerified,
  hasOverride,
  overrideCount = 0,
}) {
  const { rule, psaQty, vendorQty, review } = reconciliation;

  const exclusionCount = review?.exclusion_count ?? 0;
  const cardState = getCardState(reconciliation);
  const styles = CARD_STYLES[cardState] || CARD_STYLES.no_vendor;

  const isDismissed = cardState === 'dismissed';
  const showDiff = cardState === 'mismatch' && psaQty !== null && vendorQty !== null;
  const diff = showDiff ? psaQty - vendorQty : 0;

  const multiMapLabel = hasOverride && overrideCount > 1
    ? `Mapped to ${overrideCount} items`
    : null;

  return (
    <div
      className="relative rounded-[14px] overflow-hidden flex flex-col cursor-pointer"
      style={{
        height: '175px',
        background: styles.bg,
        border: staleness?.changeDetected
          ? '1.5px solid rgba(239, 68, 68, 0.4)'
          : staleness?.isStale
          ? '1.5px solid rgba(234, 179, 8, 0.4)'
          : styles.border,
        opacity: isDismissed ? 0.7 : 1,
        transition: 'all 0.2s ease',
      }}
      onClick={() => onDetails?.(reconciliation)}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 8px 24px -4px rgba(236, 72, 153, 0.15)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <div className="h-[3px] w-full" style={{ background: styles.bar }} />

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

      <div className="h-[62px] flex items-center">
        <QtyBlock
          psaQty={psaQty}
          vendorQty={vendorQty}
          cardState={cardState}
          styles={styles}
        />
      </div>

      {exclusionCount > 0 && (
        <p className="text-[8px] text-amber-500 font-medium text-center -mt-1" title={`${exclusionCount} excluded`}>
          -{exclusionCount} excluded
        </p>
      )}

      <div className="mt-auto">
        <StatusPill cardState={cardState} overrideCount={overrideCount} />
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
