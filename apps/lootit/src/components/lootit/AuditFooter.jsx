import React from 'react';

function formatRelativeDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getActionLabel(reviewStatus) {
  switch (reviewStatus) {
    case 'reviewed': return 'Verified';
    case 'force_matched': return 'Approved';
    case 'dismissed': return 'Dismissed';
    default: return 'Verified';
  }
}

export default function AuditFooter({ reviewStatus, reviewedByName, reviewedAt, isStale, changeDetected, previousPsaQty, previousVendorQty, isVerified }) {
  if (changeDetected) {
    return (
      <div className="px-3 pb-1.5">
        <p className="text-[9px] text-red-500 truncate leading-tight">
          Changed — needs re-verification (was {previousPsaQty ?? '—'}/{previousVendorQty ?? '—'})
        </p>
      </div>
    );
  }

  if (reviewedAt && ['reviewed', 'force_matched', 'dismissed'].includes(reviewStatus)) {
    const label = getActionLabel(reviewStatus);
    const dateStr = formatRelativeDate(reviewedAt);
    const nameDisplay = reviewedByName || 'Unknown';
    const color = isStale ? 'text-amber-500' : 'text-emerald-500';
    const prefix = isStale ? '' : '';

    return (
      <div className="px-3 pb-1.5">
        <p className={`text-[9px] ${color} truncate leading-tight`}>
          {prefix}{label} by {nameDisplay} · {dateStr}
        </p>
      </div>
    );
  }

  return (
    <div className="px-3 pb-1.5">
      <p className="text-[9px] text-pink-400 truncate leading-tight font-medium">
        Needs verification
      </p>
    </div>
  );
}
