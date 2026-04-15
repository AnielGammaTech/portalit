import React from 'react';
import { cn } from '@/lib/utils';
import { STATUS_COLORS, BADGE_STATUS_CONFIG } from './lootit-constants';

const STATUS_CONFIG = Object.fromEntries(
  Object.entries(BADGE_STATUS_CONFIG).map(([key, val]) => [
    key,
    { ...val, className: (STATUS_COLORS[key] || STATUS_COLORS.neutral).badgeClass },
  ])
);

export default function ReconciliationBadge({ status, difference = 0 }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.no_data;

  let label = config.label;
  if (!label) {
    if (status === 'over') label = `+${difference}`;
    else if (status === 'under') label = `${difference}`;
    else label = 'Unknown';
  }

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold',
        config.className
      )}
    >
      {label}
    </span>
  );
}
