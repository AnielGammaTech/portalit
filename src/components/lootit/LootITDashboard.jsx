import React, { useState, useMemo } from 'react';
import { Search, AlertTriangle, CheckCircle2, TrendingDown, TrendingUp, Database } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useReconciliationData } from '@/hooks/useReconciliationData';
import { getDiscrepancySummary } from '@/lib/lootit-reconciliation';

export default function LootITDashboard({ onSelectCustomer }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const { reconciliations, globalSummary, isLoading } = useReconciliationData();

  const customerList = useMemo(() => {
    const entries = Object.values(reconciliations).map((entry) => {
      const allRecons = [
        ...(entry.reconciliations || []),
        ...(entry.pax8Reconciliations || []),
      ];
      const combined = getDiscrepancySummary(allRecons);
      return { ...entry, combinedSummary: combined };
    });

    const searched = search.trim()
      ? entries.filter((e) =>
          e.customer.name?.toLowerCase().includes(search.toLowerCase())
        )
      : entries;

    return searched.filter((entry) => {
      const s = entry.combinedSummary;
      if (filter === 'issues') return s.over > 0 || s.under > 0;
      if (filter === 'matched') return s.matched > 0 && s.over === 0 && s.under === 0;
      if (filter === 'no_data') return s.noData > 0;
      return true;
    });
  }, [reconciliations, search, filter]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Summary Cards */}
      <div className="grid grid-cols-5 gap-3">
        <SummaryCard icon={Database} label="Customers" value={globalSummary.totalCustomers} color="slate" />
        <SummaryCard icon={CheckCircle2} label="Matched" value={globalSummary.totalMatched} color="emerald" />
        <SummaryCard icon={TrendingDown} label="Under-billed" value={globalSummary.totalUnder} color="red" />
        <SummaryCard icon={TrendingUp} label="Over-billed" value={globalSummary.totalOver} color="amber" />
        <SummaryCard icon={AlertTriangle} label="Issues" value={globalSummary.customersWithIssues} color="amber" />
      </div>

      {/* Search & Filter */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customers..."
            className="w-full pl-10 pr-4 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-300 focus:border-slate-400"
          />
        </div>
        <div className="flex gap-1.5">
          {[
            { key: 'all', label: 'All' },
            { key: 'issues', label: 'Issues' },
            { key: 'matched', label: 'Matched' },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                'px-3.5 py-2 text-xs font-medium rounded-lg transition-colors',
                filter === f.key
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Customer Grid */}
      {customerList.length === 0 ? (
        <div className="text-center py-16">
          <Database className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium text-sm">
            {search ? 'No customers match your search' : 'No reconciliation data yet'}
          </p>
          {!search && (
            <p className="text-xs text-slate-400 mt-1">
              Set up reconciliation rules in Settings to get started.
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {customerList.map(({ customer, combinedSummary: s }) => {
            const active = s.total - s.noData;
            const resolved = s.matched + s.reviewed;
            const pct = active > 0 ? Math.round((resolved / active) * 100) : 0;
            const issues = s.over + s.under;
            const noPsa = s.noPsa || 0;
            const isFullyReconciled = active > 0 && issues === 0 && noPsa === 0;

            return (
              <button
                key={customer.id}
                onClick={() => onSelectCustomer(customer)}
                className={cn(
                  'text-left rounded-lg border p-3.5 hover:shadow-md transition-all group flex flex-col h-full',
                  isFullyReconciled
                    ? 'bg-emerald-50/60 border-emerald-200 hover:border-emerald-300'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                )}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-semibold text-slate-900 text-xs leading-tight group-hover:text-slate-600 transition-colors line-clamp-1 flex-1 min-w-0">
                    {customer.name}
                  </h3>
                  {isFullyReconciled ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  ) : issues > 0 ? (
                    <span className="flex-shrink-0 inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-100 text-red-600 text-[10px] font-bold">
                      {issues}
                    </span>
                  ) : noPsa > 0 ? (
                    <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                  ) : null}
                </div>

                {/* Progress bar */}
                <div className="mb-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-slate-400">{active} services</span>
                    <span className={cn(
                      'text-[10px] font-semibold tabular-nums',
                      pct === 100 && noPsa === 0 ? 'text-emerald-600'
                        : pct >= 70 ? 'text-amber-600' : 'text-red-500'
                    )}>
                      {pct}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        pct === 100 && noPsa === 0 ? 'bg-emerald-400'
                          : pct >= 70 ? 'bg-amber-400' : 'bg-red-400'
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 flex-wrap mt-auto">
                  <span className="text-emerald-500 font-medium">{s.matched} ok</span>
                  {noPsa > 0 && (
                    <>
                      <span className="text-slate-300">·</span>
                      <span className="text-amber-600 font-medium">{noPsa} no PSA</span>
                    </>
                  )}
                  {issues > 0 && (
                    <>
                      <span className="text-slate-300">·</span>
                      <span className="text-red-500 font-medium">{issues} issue{issues !== 1 ? 's' : ''}</span>
                    </>
                  )}
                  {s.reviewed > 0 && (
                    <>
                      <span className="text-slate-300">·</span>
                      <span className="text-blue-500">{s.reviewed} reviewed</span>
                    </>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, color }) {
  const styles = {
    slate: { icon: 'bg-slate-100 text-slate-600', border: 'border-slate-200' },
    emerald: { icon: 'bg-emerald-100 text-emerald-600', border: 'border-emerald-200' },
    red: { icon: 'bg-red-100 text-red-600', border: 'border-red-200' },
    amber: { icon: 'bg-amber-100 text-amber-600', border: 'border-amber-200' },
  };
  const s = styles[color] || styles.slate;

  return (
    <div className={cn('bg-white rounded-lg border p-3', s.border)}>
      <div className="flex items-center gap-2 mb-1">
        <div className={cn('w-6 h-6 rounded-md flex items-center justify-center', s.icon)}>
          <Icon className="w-3.5 h-3.5" />
        </div>
        <span className="text-[10px] uppercase tracking-wide font-medium text-slate-400">{label}</span>
      </div>
      <p className="text-xl font-bold tabular-nums text-slate-900">{value}</p>
    </div>
  );
}
