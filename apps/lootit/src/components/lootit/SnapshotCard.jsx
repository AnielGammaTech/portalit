import React from 'react';

const STATUS_STYLES = {
  match:          { bg: 'linear-gradient(135deg, #F0FDF4 0%, #ECFDF5 100%)', border: '1.5px solid #BBF7D0', bar: '#22C55E', num: '#166534', badge: { bg: '#DCFCE7', text: '#166534', label: 'Match' } },
  over:           { bg: 'linear-gradient(135deg, #FFF7ED 0%, #FFFBEB 100%)', border: '1.5px solid #FED7AA', bar: '#F97316', num: '#C2410C', badge: { bg: '#FEF3C7', text: '#B45309', label: 'Over' } },
  under:          { bg: 'linear-gradient(135deg, #FEF2F2 0%, #FFF5F5 100%)', border: '1.5px solid #FECACA', bar: '#EF4444', num: '#DC2626', badge: { bg: '#FEE2E2', text: '#DC2626', label: 'Under' } },
  force_matched:  { bg: 'linear-gradient(135deg, #EFF6FF 0%, #F0F9FF 100%)', border: '1.5px solid #BFDBFE', bar: '#3B82F6', num: '#1E40AF', badge: { bg: '#DBEAFE', text: '#1E40AF', label: 'Force Matched' } },
  dismissed:      { bg: '#F8FAFC', border: '1.5px solid #E2E8F0', bar: '#CBD5E1', num: '#94A3B8', badge: { bg: '#F1F5F9', text: '#94A3B8', label: 'Dismissed' } },
  no_vendor_data: { bg: 'linear-gradient(135deg, #FFF1F5 0%, #FFF5F7 100%)', border: '1.5px solid #FBCFE8', bar: '#EC4899', num: '#9D174D', badge: { bg: '#FCE7F3', text: '#9D174D', label: 'No Vendor' } },
};

function getSnapshotStyle(snapshot) {
  if (snapshot.review_status === 'force_matched') return STATUS_STYLES.force_matched;
  if (snapshot.review_status === 'dismissed') return STATUS_STYLES.dismissed;
  return STATUS_STYLES[snapshot.status] || STATUS_STYLES.no_vendor_data;
}

function getReviewLabel(reviewStatus) {
  switch (reviewStatus) {
    case 'reviewed': return 'Reviewed';
    case 'force_matched': return 'Force Matched';
    case 'dismissed': return 'Dismissed';
    default: return 'Pending';
  }
}

export default function SnapshotCard({ snapshot, onDetails }) {
  const style = getSnapshotStyle(snapshot);
  const diff = snapshot.difference || 0;
  const showDiff = diff !== 0 && !['force_matched', 'dismissed'].includes(snapshot.review_status);

  const reviewDate = snapshot.reviewed_at
    ? new Date(snapshot.reviewed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null;

  return (
    <div
      className="relative rounded-[14px] overflow-hidden flex flex-col cursor-pointer"
      style={{
        height: '210px',
        background: style.bg,
        border: style.border,
        opacity: snapshot.review_status === 'dismissed' ? 0.7 : 1,
      }}
      onClick={() => onDetails?.(snapshot)}
    >
      <div className="h-[3px] w-full" style={{ background: style.bar }} />

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
          <div className="text-[28px] font-bold leading-none tabular-nums h-[32px] flex items-end justify-center" style={{ color: style.num }}>
            {snapshot.psa_qty ?? '—'}
          </div>
          <div className="text-[9px] font-semibold uppercase tracking-wider mt-1" style={{ color: style.num, opacity: 0.5 }}>PSA</div>
        </div>
        <span className="text-[10px] font-medium text-slate-300 mx-0.5">
          {snapshot.status === 'match' || snapshot.review_status === 'force_matched' ? '=' : 'vs'}
        </span>
        <div className="text-center w-16">
          <div className="text-[28px] font-bold leading-none tabular-nums h-[32px] flex items-end justify-center" style={{ color: style.num }}>
            {snapshot.vendor_qty ?? '—'}
          </div>
          <div className="text-[9px] font-semibold uppercase tracking-wider mt-1" style={{ color: style.num, opacity: 0.5 }}>Vendor</div>
        </div>
      </div>

      <div className="px-2 pb-[10px]">
        <div
          className="block w-full py-[7px] rounded-lg text-[12px] font-semibold text-center"
          style={{ background: style.badge.bg, color: style.badge.text }}
        >
          {style.badge.label}
        </div>
      </div>

      <div className="px-3 pb-1.5">
        <p className="text-[9px] text-slate-400 truncate leading-tight">
          {getReviewLabel(snapshot.review_status)} by {snapshot.reviewed_by_name || 'Unknown'} · {reviewDate || '—'}
        </p>
      </div>
    </div>
  );
}
