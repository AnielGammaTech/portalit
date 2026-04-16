export const STATUS_COLORS = {
  match:    { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-600', icon: 'text-emerald-500', bar: 'bg-emerald-500', card: 'bg-emerald-50/70 border-emerald-200', numBg: 'bg-emerald-100/60 border-emerald-200', numText: 'text-emerald-800', labelText: 'text-emerald-500', borderT: 'border-emerald-100', badgeClass: 'bg-emerald-500 text-white' },
  over:     { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-600', icon: 'text-amber-500', bar: 'bg-amber-500', card: 'bg-amber-50/50 border-amber-200', numBg: 'bg-white/80 border-amber-200', numText: 'text-amber-900', labelText: 'text-amber-400', borderT: 'border-amber-100', badgeClass: 'bg-amber-500 text-white' },
  under:    { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-600', icon: 'text-red-500', bar: 'bg-red-500', card: 'bg-red-50/50 border-red-200', numBg: 'bg-white/80 border-red-200', numText: 'text-red-900', labelText: 'text-red-400', borderT: 'border-red-100', badgeClass: 'bg-red-500 text-white' },
  neutral:  { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-400', icon: 'text-slate-400', bar: 'bg-slate-300', card: 'bg-white border-slate-200', numBg: 'bg-slate-50 border-slate-200', numText: 'text-slate-600', labelText: 'text-slate-400', borderT: 'border-slate-100', badgeClass: 'bg-slate-400 text-white' },
  reviewed: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-600', icon: 'text-blue-500', bar: 'bg-blue-500', card: 'bg-blue-50/50 border-blue-200', numBg: 'bg-blue-50 border-blue-200', numText: 'text-blue-800', labelText: 'text-blue-400', borderT: 'border-blue-100', badgeClass: 'bg-blue-500 text-white' },
};

export const BADGE_STATUS_CONFIG = {
  match: { label: 'Matched' },
  over: {},
  under: {},
  missing_from_psa: { label: 'Not Billed' },
  no_psa_data: { label: 'No PSA' },
  no_vendor_data: { label: 'No Vendor' },
  no_data: { label: 'No Data' },
};

export const ACTION_LABELS = {
  reviewed:  { label: 'Marked OK',     color: 'text-emerald-600', bg: 'bg-emerald-50' },
  dismissed: { label: 'Skipped',       color: 'text-slate-500',   bg: 'bg-slate-50' },
  reset:     { label: 'Reset',         color: 'text-amber-600',   bg: 'bg-amber-50' },
  note:      { label: 'Note added',    color: 'text-blue-600',    bg: 'bg-blue-50' },
  exclusion: { label: 'Exclusion set', color: 'text-amber-600',   bg: 'bg-amber-50' },
};

export const BILLING_STATUS_CONFIG = {
  healthy:      { label: 'Healthy',      className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  needs_review: { label: 'Needs Review', className: 'bg-amber-100 text-amber-700 border-amber-200' },
  at_risk:      { label: 'At Risk',      className: 'bg-red-100 text-red-700 border-red-200' },
};
