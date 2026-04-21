import React, { useState, useMemo } from 'react';
import {
  Search, AlertTriangle, CheckCircle2, TrendingDown, TrendingUp,
  Database, Bell, Check, Stamp, ExternalLink, ChevronDown, ChevronUp,
  ArrowUpDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { client } from '@/api/client';
import { useReconciliationData } from '@/hooks/useReconciliationData';
import { useAutoRetry } from '@/hooks/useAutoRetry';
import { getDiscrepancySummary } from '@/lib/lootit-reconciliation';

const PORTALIT_URL = import.meta.env.VITE_PORTALIT_URL || 'https://portalit.gtools.io';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'due', label: 'Due' },
  { key: 'issues', label: 'Issues' },
  { key: 'matched', label: 'Matched' },
  { key: 'signed_off', label: 'Signed Off' },
  { key: 'pending', label: 'Pending' },
];

const SORT_KEYS = {
  name: (a, b) => (a.customer?.name || '').localeCompare(b.customer?.name || ''),
  services: (a, b) => (b.combinedSummary.total - b.combinedSummary.noData) - (a.combinedSummary.total - a.combinedSummary.noData),
  issues: (a, b) => (b.combinedSummary.over + b.combinedSummary.under) - (a.combinedSummary.over + a.combinedSummary.under),
  progress: (a, b) => {
    const pctA = a.applicable > 0 ? a.resolved / a.applicable : 0;
    const pctB = b.applicable > 0 ? b.resolved / b.applicable : 0;
    return pctB - pctA;
  },
};

export default function LootITDashboard({ onSelectCustomer }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [sortKey, setSortKey] = useState('name');
  const [sortAsc, setSortAsc] = useState(true);
  const [anomaliesExpanded, setAnomaliesExpanded] = useState(true);
  const queryClient = useQueryClient();
  const { reconciliations, globalSummary, bills, customers, isLoading, isError } = useReconciliationData();

  const { data: dbAnomalies = [] } = useQuery({
    queryKey: ['billing_anomalies'],
    queryFn: () => client.entities.BillingAnomaly.filter({ status: 'open' }),
    staleTime: 1000 * 60 * 2,
  });

  const handleDismissAnomaly = async (anomalyId) => {
    await client.entities.BillingAnomaly.update(anomalyId, { status: 'dismissed', reviewed_at: new Date().toISOString() });
    queryClient.invalidateQueries({ queryKey: ['billing_anomalies'] });
  };

  const { data: signOffs = [] } = useQuery({
    queryKey: ['all_sign_offs'],
    queryFn: () => client.entities.ReconciliationSignOff.filter({ status: 'signed_off' }),
    staleTime: 1000 * 60 * 2,
  });
  const signedOffCustomerIds = useMemo(() => new Set(signOffs.map(s => s.customer_id)), [signOffs]);

  const signOffDateMap = useMemo(() => {
    const map = {};
    for (const so of (signOffs || [])) {
      const existing = map[so.customer_id];
      if (!existing || new Date(so.signed_at) > new Date(existing.signed_at)) {
        map[so.customer_id] = { signed_at: so.signed_at, next_reconciliation_date: so.next_reconciliation_date };
      }
    }
    return map;
  }, [signOffs]);

  const anomalies = useMemo(() => {
    if (!dbAnomalies || dbAnomalies.length === 0) return [];
    const customerMap = Object.fromEntries((customers || []).map(c => [c.id, c]));
    const categoryLabels = { monthly_recurring: 'Monthly Recurring', voip: 'VoIP' };

    return dbAnomalies
      .map(dba => {
        const customer = customerMap[dba.customer_id];
        return {
          customerId: dba.customer_id,
          customerName: customer?.name || 'Unknown',
          billName: categoryLabels[dba.category] || dba.category || 'Unknown',
          customer,
          latestAmount: parseFloat(dba.current_amount) || 0,
          avgAmount: parseFloat(dba.previous_avg) || 0,
          pctChange: parseFloat(dba.pct_change) || 0,
          direction: dba.direction,
          dbId: dba.id,
        };
      })
      .sort((a, b) => Math.abs(b.pctChange) - Math.abs(a.pctChange));
  }, [dbAnomalies, customers]);

  const customerList = useMemo(() => {
    const entries = Object.values(reconciliations).map((entry) => {
      const allRecons = [
        ...(entry.reconciliations || []),
        ...(entry.pax8Reconciliations || []),
      ];
      const combined = getDiscrepancySummary(allRecons);
      const resolved = (combined.matched || 0) + (combined.forceMatched || 0) + (combined.dismissed || 0) + (combined.reviewed || 0);
      const applicable = combined.total - (combined.noData || 0);
      return { ...entry, combinedSummary: combined, resolved, applicable };
    });

    const searched = search.trim()
      ? entries.filter((e) =>
          e.customer.name?.toLowerCase().includes(search.toLowerCase())
        )
      : entries;

    const filtered = searched.filter((entry) => {
      const s = entry.combinedSummary;
      if (filter === 'issues') return s.over > 0 || s.under > 0;
      if (filter === 'matched') return (s.matched + s.forceMatched) > 0 && s.over === 0 && s.under === 0;
      if (filter === 'no_data') return s.noData > 0;
      if (filter === 'signed_off') return signedOffCustomerIds.has(entry.customer.id);
      if (filter === 'pending') return !signedOffCustomerIds.has(entry.customer.id);
      if (filter === 'due') {
        const so = signOffDateMap[entry.customer.id];
        if (!so) return true;
        if (so.next_reconciliation_date) return new Date() >= new Date(so.next_reconciliation_date);
        const days = Math.floor((Date.now() - new Date(so.signed_at).getTime()) / (1000 * 60 * 60 * 24));
        return days >= 30;
      }
      return true;
    });

    const sortFn = SORT_KEYS[sortKey] || SORT_KEYS.name;
    const sorted = [...filtered].sort(sortFn);
    return sortAsc ? sorted : sorted.reverse();
  }, [reconciliations, search, filter, signedOffCustomerIds, sortKey, sortAsc]);

  useAutoRetry(
    [customers, bills],
    isLoading,
    [['reconciliation_rules'], ['reconciliation_customers'], ['reconciliation_bills'], ['reconciliation_line_items']]
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-600 rounded-full animate-spin" />
      </div>
    );
  }

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortAsc(prev => !prev);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  const SortHeader = ({ label, sortId, className }) => (
    <button
      onClick={() => handleSort(sortId)}
      className={cn("flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-800 transition-colors", className)}
    >
      {label}
      {sortKey === sortId ? (
        sortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
      ) : (
        <ArrowUpDown className="w-2.5 h-2.5 text-slate-300" />
      )}
    </button>
  );

  return (
    <div className="space-y-4">
      {isError && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-red-50 border border-red-200 rounded-lg">
          <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
          <p className="text-xs text-red-700 flex-1">Some data failed to load.</p>
          <button onClick={() => queryClient.invalidateQueries()} className="px-3 py-1 text-xs font-semibold rounded-lg bg-red-100 text-red-700 hover:bg-red-200">
            Retry
          </button>
        </div>
      )}

      {/* Summary Strip */}
      <div className="flex items-center gap-2">
        <SummaryPill icon={Database} label="Customers" value={globalSummary.totalCustomers} color="slate" />
        <SummaryPill icon={CheckCircle2} label="Matched" value={globalSummary.totalMatched} color="emerald" />
        <SummaryPill icon={TrendingDown} label="Under" value={globalSummary.totalUnder} color="red" />
        <SummaryPill icon={TrendingUp} label="Over" value={globalSummary.totalOver} color="amber" />
        <SummaryPill icon={AlertTriangle} label="Issues" value={globalSummary.customersWithIssues} color="amber" />
        <SummaryPill icon={Stamp} label="Signed Off" value={signedOffCustomerIds.size} color="violet" />
        <SummaryPill icon={Bell} label="Anomalies" value={anomalies.length} color="red" />
      </div>

      {/* Anomalies (collapsible) */}
      {anomalies.length > 0 && (
        <div className="border border-red-200 rounded-lg overflow-hidden">
          <button
            onClick={() => setAnomaliesExpanded(prev => !prev)}
            className="w-full flex items-center gap-2 px-3 py-2 bg-red-50 hover:bg-red-100 transition-colors"
          >
            <Bell className="w-3.5 h-3.5 text-red-500" />
            <span className="text-xs font-bold text-slate-900">Billing Anomalies</span>
            <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-semibold">{anomalies.length}</span>
            <div className="flex-1" />
            <ChevronDown className={cn("w-3.5 h-3.5 text-slate-400 transition-transform", anomaliesExpanded && "rotate-180")} />
          </button>
          {anomaliesExpanded && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 p-3 bg-white">
              {anomalies.slice(0, 8).map((a) => (
                <button
                  key={`${a.customerId}-${a.billName}`}
                  onClick={() => a.customer && onSelectCustomer(a.customer, 'recurring')}
                  className={cn(
                    'text-left rounded-md border px-3 py-2 hover:shadow transition-all',
                    a.direction === 'decrease' ? 'bg-red-50/60 border-red-200' : 'bg-amber-50/60 border-amber-200'
                  )}
                >
                  <p className="text-[11px] font-semibold text-slate-900 truncate">{a.customerName}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    {a.direction === 'decrease'
                      ? <TrendingDown className="w-3 h-3 text-red-500" />
                      : <TrendingUp className="w-3 h-3 text-amber-500" />
                    }
                    <span className={cn('text-sm font-bold tabular-nums', a.direction === 'decrease' ? 'text-red-600' : 'text-amber-600')}>
                      {a.pctChange > 0 ? '+' : ''}{a.pctChange.toFixed(0)}%
                    </span>
                    <span className="text-[9px] text-slate-400 tabular-nums">
                      ${Math.round(a.avgAmount).toLocaleString()} → ${Math.round(a.latestAmount).toLocaleString()}
                    </span>
                  </div>
                </button>
              ))}
              {anomalies.length > 8 && (
                <div className="col-span-full text-center">
                  <p className="text-[10px] text-slate-400">+{anomalies.length - 8} more</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Search & Filter */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customers..."
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-slate-300"
          />
        </div>
        <div className="flex gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                'px-2.5 py-1.5 text-[11px] font-medium rounded-md transition-colors',
                filter === f.key
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <span className="text-[11px] text-slate-400 tabular-nums">{customerList.length} customers</span>
      </div>

      {/* Customer Table */}
      {customerList.length === 0 ? (
        <div className="text-center py-12">
          <Database className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-slate-500 text-sm font-medium">
            {search ? 'No customers match your search' : 'No reconciliation data yet'}
          </p>
        </div>
      ) : (
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-3 py-2 w-8" />
                <th className="text-left px-3 py-2">
                  <SortHeader label="Customer" sortId="name" />
                </th>
                <th className="text-left px-3 py-2 w-20">
                  <SortHeader label="Services" sortId="services" />
                </th>
                <th className="text-left px-3 py-2 w-28">
                  <SortHeader label="Progress" sortId="progress" />
                </th>
                <th className="text-center px-3 py-2 w-16">
                  <SortHeader label="Issues" sortId="issues" className="justify-center" />
                </th>
                <th className="text-center px-3 py-2 w-20">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Due</span>
                </th>
                <th className="text-center px-3 py-2 w-16">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Status</span>
                </th>
                <th className="text-right px-3 py-2 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {customerList.map(({ customer, combinedSummary: s, resolved, applicable }, idx) => {
                const pct = applicable > 0 ? Math.min(100, Math.round((resolved / applicable) * 100)) : 0;
                const issues = s.over + s.under;
                const isSignedOff = signedOffCustomerIds.has(customer.id);
                const isFullyReconciled = applicable > 0 && resolved === applicable;

                return (
                  <tr
                    key={customer.id}
                    onClick={() => onSelectCustomer(customer)}
                    className={cn(
                      "transition-colors cursor-pointer hover:bg-slate-50",
                      idx % 2 === 1 && "bg-slate-50/40",
                      isSignedOff && "bg-violet-50/30",
                      isFullyReconciled && !isSignedOff && "bg-emerald-50/30",
                    )}
                  >
                    {/* Status dot */}
                    <td className="px-3 py-2 text-center">
                      <div className={cn(
                        "w-2 h-2 rounded-full mx-auto",
                        isSignedOff ? "bg-violet-500"
                          : isFullyReconciled ? "bg-emerald-500"
                          : issues > 0 ? "bg-red-500"
                          : "bg-slate-300"
                      )} />
                    </td>

                    {/* Customer name (clickable to PortalIT) */}
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-900 truncate">{customer.name}</span>
                        <a
                          href={`${PORTALIT_URL}/CustomerDetail/${customer.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-slate-300 hover:text-blue-500 transition-colors shrink-0"
                          title="Open in PortalIT"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </td>

                    {/* Services count */}
                    <td className="px-3 py-2">
                      <span className="text-xs text-slate-600 tabular-nums">{applicable}</span>
                    </td>

                    {/* Progress bar */}
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all",
                              pct === 100 ? "bg-emerald-400"
                                : pct >= 70 ? "bg-amber-400"
                                : "bg-red-400"
                            )}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className={cn(
                          "text-[10px] font-semibold tabular-nums w-8 text-right",
                          pct === 100 ? "text-emerald-600"
                            : pct >= 70 ? "text-amber-600"
                            : "text-red-500"
                        )}>
                          {pct}%
                        </span>
                      </div>
                    </td>

                    {/* Issues */}
                    <td className="px-3 py-2 text-center">
                      {issues > 0 ? (
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-100 text-red-600 text-[10px] font-bold">
                          {issues}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>

                    {/* Due */}
                    <td className="px-3 py-2 text-center">
                      {(() => {
                        const so = signOffDateMap[customer.id];
                        if (!so) {
                          return (
                            <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">
                              Never
                            </span>
                          );
                        }
                        const nextDate = so.next_reconciliation_date ? new Date(so.next_reconciliation_date) : null;
                        if (nextDate) {
                          const now = new Date();
                          const daysUntil = Math.ceil((nextDate - now) / (1000 * 60 * 60 * 24));
                          const label = nextDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                          if (daysUntil < 0) {
                            return (
                              <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">
                                {label} ({Math.abs(daysUntil)}d overdue)
                              </span>
                            );
                          }
                          if (daysUntil <= 14) {
                            return (
                              <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                                {label} ({daysUntil}d)
                              </span>
                            );
                          }
                          return (
                            <span className="text-[10px] font-medium text-slate-500">
                              {label}
                            </span>
                          );
                        }
                        const days = Math.floor((Date.now() - new Date(so.signed_at).getTime()) / (1000 * 60 * 60 * 24));
                        if (days >= 30) {
                          return (
                            <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">
                              {days}d ago
                            </span>
                          );
                        }
                        return <span className="text-slate-300">—</span>;
                      })()}
                    </td>

                    {/* Status badges */}
                    <td className="px-3 py-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {(s.matched + s.forceMatched) > 0 && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-600 font-medium">
                            <Check className="w-3 h-3" />{s.matched + s.forceMatched}
                          </span>
                        )}
                        {s.reviewed > 0 && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] text-blue-500 font-medium">
                            <CheckCircle2 className="w-3 h-3" />{s.reviewed}
                          </span>
                        )}
                        {isSignedOff && <Stamp className="w-3.5 h-3.5 text-violet-500" />}
                      </div>
                    </td>

                    {/* Arrow */}
                    <td className="px-3 py-2 text-right">
                      <ChevronDown className="w-3 h-3 text-slate-300 -rotate-90" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SummaryPill({ icon: Icon, label, value, color }) {
  const colors = {
    slate: 'bg-slate-100 text-slate-700 border-slate-200',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    violet: 'bg-violet-50 text-violet-700 border-violet-200',
  };
  const iconColors = {
    slate: 'text-slate-500',
    emerald: 'text-emerald-500',
    red: 'text-red-500',
    amber: 'text-amber-500',
    violet: 'text-violet-500',
  };

  return (
    <div className={cn('flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs font-medium flex-1', colors[color] || colors.slate)}>
      <Icon className={cn('w-3.5 h-3.5', iconColors[color] || iconColors.slate)} />
      <span className="text-[10px] text-slate-500 hidden lg:inline">{label}</span>
      <span className="font-bold tabular-nums ml-auto">{value}</span>
    </div>
  );
}
