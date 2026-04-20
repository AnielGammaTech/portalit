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
    case 'reviewed': return 'Reviewed';
    case 'force_matched': return 'Force Matched';
    case 'dismissed': return 'Dismissed';
    default: return 'Reviewed';
  }
}

export default function AuditFooter({ reviewStatus, reviewedByName, reviewedAt, isStale, changeDetected, previousPsaQty, previousVendorQty }) {
  if (!reviewedAt && !changeDetected) return null;

  if (changeDetected) {
    return (
      <div className="px-3 pb-1.5">
        <p className="text-[9px] text-red-500 truncate leading-tight">
          Changed since sign-off (was {previousPsaQty ?? '—'}/{previousVendorQty ?? '—'})
        </p>
      </div>
    );
  }

  const label = getActionLabel(reviewStatus);
  const dateStr = formatRelativeDate(reviewedAt);
  const nameDisplay = reviewedByName || 'Unknown';
  const color = isStale ? 'text-amber-500' : 'text-slate-400';
  const prefix = isStale ? '⚠ ' : '';

  return (
    <div className="px-3 pb-1.5">
      <p className={`text-[9px] ${color} truncate leading-tight`}>
        {prefix}{label} by {nameDisplay} · {dateStr}
      </p>
    </div>
  );
}
