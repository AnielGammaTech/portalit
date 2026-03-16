import React from 'react';
import { cn } from '@/lib/utils';

const STATUS_CONFIG = {
  match: { label: 'Matched', className: 'bg-emerald-100 text-emerald-700' },
  over: { className: 'bg-orange-100 text-orange-700' },
  under: { className: 'bg-red-100 text-red-700' },
  missing_from_psa: { label: 'Not Billed', className: 'bg-red-100 text-red-700' },
  no_psa_data: { label: 'No PSA', className: 'bg-slate-100 text-slate-500' },
  no_vendor_data: { label: 'No Vendor', className: 'bg-slate-100 text-slate-500' },
  no_data: { label: 'No Data', className: 'bg-slate-100 text-slate-400' },
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
