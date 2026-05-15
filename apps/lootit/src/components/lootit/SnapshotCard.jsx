import React from 'react';
import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

function getEffectiveStatus(snapshot) {
  const { psa_qty, vendor_qty, status, exclusion_count } = snapshot;
  const exclusions = exclusion_count || 0;
  if (exclusions <= 0) return status;
  const effectiveVendorQty = vendor_qty != null ? vendor_qty - exclusions : null;
  if (psa_qty == null || effectiveVendorQty == null) return status;
  const diff = psa_qty - effectiveVendorQty;
  if (diff === 0) return 'match';
  return diff > 0 ? 'over' : 'under';
}

function getCardState(snapshot) {
  const { review_status } = snapshot;
  const effectiveStatus = getEffectiveStatus(snapshot);

  if (review_status === 'force_matched') return 'force_matched';
  if (review_status === 'dismissed') return 'dismissed';
  if (effectiveStatus === 'match') return 'auto_matched';
  if (review_status === 'reviewed') return 'reviewed';
  if (effectiveStatus === 'over' || effectiveStatus === 'under') return 'mismatch';
  return 'auto_matched';
}

const CARD_STYLES = {
  auto_matched: {
    bg: 'linear-gradient(135deg, #F0FDF4 0%, #ECFDF5 100%)',
    border: '1.5px solid #BBF7D0',
    bar: '#22C55E',
    num: '#166534',
  },
  reviewed: {
    bg: 'linear-gradient(135deg, #F0F9FF 0%, #F5F3FF 100%)',
    border: '1.5px solid #C7D2FE',
    bar: '#6366F1',
    num: '#4338CA',
  },
  mismatch: {
    bg: 'linear-gradient(135deg, #FFF7ED 0%, #FFFBEB 100%)',
    border: '1.5px solid #FED7AA',
    bar: '#F97316',
    num: '#C2410C',
  },
  force_matched: {
    bg: 'linear-gradient(135deg, #EFF6FF 0%, #F0F9FF 100%)',
    border: '1.5px solid #BFDBFE',
    bar: '#3B82F6',
    num: '#1E40AF',
  },
  dismissed: {
    bg: '#F8FAFC',
    border: '1.5px solid #E2E8F0',
    bar: '#CBD5E1',
    num: '#94A3B8',
  },
};

const BADGE_CONFIG = {
  auto_matched: { bg: '#DCFCE7', text: '#166534', dot: '#22C55E', label: 'Auto-Matched' },
  reviewed:     { bg: '#E0E7FF', text: '#4338CA', icon: 'check', label: 'Reviewed' },
  mismatch:     { bg: '#FEF3C7', text: '#B45309', label: 'Mismatch' },
  force_matched:{ bg: '#DBEAFE', text: '#1E40AF', icon: 'check', label: 'Approved' },
  dismissed:    { bg: '#F1F5F9', text: '#94A3B8', icon: 'x', label: 'Skipped' },
};

function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function SnapshotCard({ snapshot, onDetails }) {
  const cardState = getCardState(snapshot);
  const styles = CARD_STYLES[cardState] || CARD_STYLES.auto_matched;
  const badge = BADGE_CONFIG[cardState] || BADGE_CONFIG.auto_matched;

  const exclusionCount = snapshot.exclusion_count || 0;
  const effectiveVendorQty = snapshot.vendor_qty != null ? snapshot.vendor_qty - exclusionCount : null;
  const isMatched = cardState === 'auto_matched' || cardState === 'force_matched';
  const diff = (snapshot.psa_qty || 0) - (effectiveVendorQty || 0);
  const showDiff = diff !== 0 && cardState === 'mismatch';

  return (
    <div
      className="relative rounded-[14px] overflow-hidden flex flex-col cursor-pointer"
      style={{
        height: '210px',
        background: styles.bg,
        border: styles.border,
        opacity: cardState === 'dismissed' ? 0.7 : 1,
      }}
      onClick={() => onDetails?.(snapshot)}
    >
      <div className="h-[3px] w-full" style={{ background: styles.bar }} />

      {showDiff && (
        <span
          className="absolute top-[10px] right-[10px] text-[10px] font-bold tabular-nums px-2 py-0.5 rounded-full z-10"
          style={{
            background: diff > 0 ? '#FEF3C7' : '#FEE2E2',
            color: diff > 0 ? '#B45309' : '#DC2626',
          }}
        >
          {diff > 0 ? '+' : ''}{diff}
        </span>
      )}

      <div className="px-3 pt-[10px]">
        <h4 className="text-[13px] font-bold text-slate-800 leading-tight truncate">
          {snapshot.label}
        </h4>
        <p className="text-[10px] text-slate-400 leading-tight truncate">
          {snapshot.integration_key}
        </p>
      </div>

      <div className="flex items-center justify-center gap-1.5 flex-1">
        <div className="text-center w-16">
          <div className="text-[28px] font-bold leading-none tabular-nums h-[32px] flex items-end justify-center" style={{ color: styles.num }}>
            {snapshot.psa_qty ?? '—'}
          </div>
          <div className="text-[9px] font-semibold uppercase tracking-wider mt-1" style={{ color: styles.num, opacity: 0.5 }}>PSA</div>
        </div>
        <span className="text-[10px] font-medium text-slate-300 mx-0.5">
          {isMatched ? '=' : 'vs'}
        </span>
        <div className="text-center w-16">
          <div className="text-[28px] font-bold leading-none tabular-nums h-[32px] flex items-end justify-center" style={{ color: styles.num }}>
            {effectiveVendorQty ?? '—'}
          </div>
          <div className="text-[9px] font-semibold uppercase tracking-wider mt-1" style={{ color: styles.num, opacity: 0.5 }}>Vendor</div>
        </div>
      </div>

      {exclusionCount > 0 && (
        <p className="text-[8px] text-amber-500 font-medium text-center -mt-1">
          -{exclusionCount} excluded
        </p>
      )}

      <div className="px-2 pb-[10px] mt-auto">
        <div
          className={cn('block w-full py-[7px] rounded-lg text-[12px] font-semibold text-center flex items-center justify-center gap-1.5')}
          style={{ background: badge.bg, color: badge.text }}
        >
          {badge.dot && (
            <span className="inline-block w-[5px] h-[5px] rounded-full" style={{ background: badge.dot }} />
          )}
          {badge.icon === 'check' && <Check className="w-3 h-3" strokeWidth={2.5} />}
          {badge.icon === 'x' && <X className="w-3 h-3" strokeWidth={2.5} />}
          {badge.label}
        </div>
      </div>

      {snapshot.reviewed_at && (
        <div className="px-3 pb-1.5">
          <p className="text-[9px] text-slate-400 truncate leading-tight">
            {snapshot.reviewed_by_name || 'Unknown'} · {formatDate(snapshot.reviewed_at)}
          </p>
        </div>
      )}
    </div>
  );
}
