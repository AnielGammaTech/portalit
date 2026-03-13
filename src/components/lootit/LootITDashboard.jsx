import React, { useState, useMemo } from 'react';
import { Search, AlertTriangle, CheckCircle2, TrendingDown, TrendingUp, Database } from 'lucide-react';
import { useReconciliationData } from '@/hooks/useReconciliationData';
import ReconciliationBadge from './ReconciliationBadge';

export default function LootITDashboard({ onSelectCustomer }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // all, issues, matched, no_data
  const { reconciliations, globalSummary, isLoading } = useReconciliationData();

  const customerList = useMemo(() => {
    const entries = Object.values(reconciliations);

    // Filter by search
    const searched = search.trim()
      ? entries.filter((e) =>
          e.customer.name?.toLowerCase().includes(search.toLowerCase())
        )
      : entries;

    // Filter by status
    return searched.filter((entry) => {
      if (filter === 'issues') return entry.summary.over > 0 || entry.summary.under > 0;
      if (filter === 'matched') return entry.summary.matched > 0 && entry.summary.over === 0 && entry.summary.under === 0;
      if (filter === 'no_data') return entry.summary.noData > 0;
      return true;
    });
  }, [reconciliations, search, filter]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-pink-200 border-t-pink-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <SummaryCard
          icon={Database}
          label="Customers"
          value={globalSummary.totalCustomers}
          color="slate"
        />
        <SummaryCard
          icon={CheckCircle2}
          label="Matched"
          value={globalSummary.totalMatched}
          color="emerald"
        />
        <SummaryCard
          icon={TrendingDown}
          label="Under-billed"
          value={globalSummary.totalUnder}
          color="red"
        />
        <SummaryCard
          icon={TrendingUp}
          label="Over-billed"
          value={globalSummary.totalOver}
          color="orange"
        />
        <SummaryCard
          icon={AlertTriangle}
          label="Issues"
          value={globalSummary.customersWithIssues}
          color="pink"
        />
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customers..."
            className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-pink-300 focus:border-pink-300"
          />
        </div>
        <div className="flex gap-2">
          {[
            { key: 'all', label: 'All' },
            { key: 'issues', label: 'Issues' },
            { key: 'matched', label: 'Matched' },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-4 py-2 text-sm font-medium rounded-xl transition-colors ${
                filter === f.key
                  ? 'bg-pink-500 text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-pink-50'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Customer Grid */}
      {customerList.length === 0 ? (
        <div className="text-center py-16">
          <Database className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">
            {search ? 'No customers match your search' : 'No reconciliation data yet'}
          </p>
          <p className="text-sm text-slate-400 mt-1">
            {!search && 'Set up reconciliation rules in Settings to get started.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {customerList.map(({ customer, summary, reconciliations: recons }) => (
            <button
              key={customer.id}
              onClick={() => onSelectCustomer(customer)}
              className="text-left bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md hover:border-pink-200 transition-all group"
            >
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-semibold text-slate-900 text-sm group-hover:text-pink-600 transition-colors line-clamp-1">
                  {customer.name}
                </h3>
                {(summary.over > 0 || summary.under > 0) && (
                  <span className="flex-shrink-0 ml-2 inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-100 text-red-600 text-xs font-bold">
                    {summary.over + summary.under}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5 mb-3">
                {recons
                  .filter((r) => r.status !== 'no_data')
                  .slice(0, 4)
                  .map((r) => (
                    <ReconciliationBadge
                      key={r.rule.id}
                      status={r.status}
                      difference={r.difference}
                    />
                  ))}
                {recons.filter((r) => r.status !== 'no_data').length > 4 && (
                  <span className="text-xs text-slate-400 self-center">
                    +{recons.filter((r) => r.status !== 'no_data').length - 4} more
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 text-xs text-slate-400">
                <span>{summary.total} services</span>
                <span>·</span>
                {summary.over + summary.under > 0 ? (
                  <span className="text-red-500 font-medium">
                    {summary.over + summary.under} issue{summary.over + summary.under !== 1 ? 's' : ''}
                  </span>
                ) : (
                  <span className="text-emerald-500">All matched ✓</span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, color }) {
  const colorMap = {
    slate: 'bg-slate-50 text-slate-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    red: 'bg-red-50 text-red-600',
    orange: 'bg-orange-50 text-orange-600',
    pink: 'bg-pink-50 text-pink-600',
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center gap-2 mb-1">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${colorMap[color]}`}>
          <Icon className="w-4 h-4" />
        </div>
        <span className="text-xs text-slate-400 font-medium">{label}</span>
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
    </div>
  );
}
