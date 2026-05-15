import React from 'react';
import { cn } from '@/lib/utils';

const toneClasses = {
  slate: {
    card: 'border-slate-200 bg-white',
    icon: 'border-slate-200 bg-slate-50 text-slate-600',
    accent: 'text-slate-600',
  },
  emerald: {
    card: 'border-emerald-200 bg-emerald-50/65',
    icon: 'border-emerald-200 bg-white text-emerald-700',
    accent: 'text-emerald-700',
  },
  blue: {
    card: 'border-blue-200 bg-blue-50/65',
    icon: 'border-blue-200 bg-white text-blue-700',
    accent: 'text-blue-700',
  },
  violet: {
    card: 'border-violet-200 bg-violet-50/65',
    icon: 'border-violet-200 bg-white text-violet-700',
    accent: 'text-violet-700',
  },
  amber: {
    card: 'border-amber-200 bg-amber-50/75',
    icon: 'border-amber-200 bg-white text-amber-700',
    accent: 'text-amber-700',
  },
  rose: {
    card: 'border-rose-200 bg-rose-50/75',
    icon: 'border-rose-200 bg-white text-rose-700',
    accent: 'text-rose-700',
  },
};

export function PortalPageHeader({ title, description, meta, actions, className }) {
  return (
    <div className={cn('flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between', className)}>
      <div className="min-w-0">
        {meta && (
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{meta}</p>
        )}
        <h1 className="truncate text-2xl font-semibold tracking-normal text-slate-950">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function PortalMetricCard({ icon: Icon, label, value, detail, tone = 'slate', onClick, className }) {
  const styles = toneClasses[tone] || toneClasses.slate;
  const Component = onClick ? 'button' : 'div';

  return (
    <Component
      onClick={onClick}
      className={cn(
        'rounded-xl border p-4 text-left shadow-sm transition-colors',
        styles.card,
        onClick && 'hover:bg-slate-50',
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-2 truncate text-2xl font-bold tabular-nums text-slate-950">{value}</p>
          {detail && <p className="mt-1 truncate text-xs text-slate-500">{detail}</p>}
        </div>
        {Icon && (
          <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border', styles.icon)}>
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>
    </Component>
  );
}

export function PortalSection({ title, description, badge, actions, children, className, bodyClassName }) {
  return (
    <section className={cn('overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm', className)}>
      {(title || description || badge || actions) && (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {title && <h2 className="font-semibold text-slate-950">{title}</h2>}
              {badge}
            </div>
            {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

export function PortalStatusPill({ label, tone = 'slate', icon: Icon, className }) {
  const tones = {
    slate: 'border-slate-200 bg-slate-50 text-slate-700',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    blue: 'border-blue-200 bg-blue-50 text-blue-700',
    violet: 'border-violet-200 bg-violet-50 text-violet-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    rose: 'border-rose-200 bg-rose-50 text-rose-700',
  };

  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold', tones[tone] || tones.slate, className)}>
      {Icon && <Icon className="h-3.5 w-3.5" />}
      {label}
    </span>
  );
}
