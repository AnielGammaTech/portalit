import React from 'react';
import { cn } from '@/lib/utils';

const STATUS_CONFIG = {
  match: { label: 'Matched', className: 'bg-emerald-500 text-white' },
  over: { className: 'bg-orange-500 text-white' },
  under: { className: 'bg-red-500 text-white' },
  missing_from_psa: { label: 'Not Billed', className: 'bg-red-500 text-white' },
  no_psa_data: { label: 'No PSA', className: 'bg-slate-400 text-white' },
  no_vendor_data: { label: 'No Vendor', className: 'bg-slate-400 text-white' },
  no_data: { label: 'No Data', className: 'bg-slate-300 text-white' },
};

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
