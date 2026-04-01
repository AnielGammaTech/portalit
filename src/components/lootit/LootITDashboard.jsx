import React, { useState, useMemo } from 'react';
import { Search, AlertTriangle, CheckCircle2, TrendingDown, TrendingUp, Database, Bell, DollarSign, Check, X, Stamp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { client } from '@/api/client';
import { useReconciliationData } from '@/hooks/useReconciliationData';
import { getDiscrepancySummary } from '@/lib/lootit-reconciliation';

export default function LootITDashboard({ onSelectCustomer }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const queryClient = useQueryClient();
  const { reconciliations, globalSummary, bills, customers, isLoading } = useReconciliationData();

  // Fetch persistent anomalies from database
  const { data: dbAnomalies = [] } = useQuery({
    queryKey: ['billing_anomalies'],
    queryFn: () => client.entities.BillingAnomaly.filter({ status: 'open' }),
    staleTime: 1000 * 60 * 2,
  });

  const handleDismissAnomaly = async (anomalyId) => {
    await client.entities.BillingAnomaly.update(anomalyId, { status: 'dismissed', reviewed_at: new Date().toISOString() });
    queryClient.invalidateQueries({ queryKey: ['billing_anomalies'] });
  };

  const handleReviewAnomaly = async (anomalyId) => {
    await client.entities.BillingAnomaly.update(anomalyId, { status: 'reviewed', reviewed_at: new Date().toISOString() });
    queryClient.invalidateQueries({ queryKey: ['billing_anomalies'] });
  };

  // Fetch signed-off customers
  const { data: signOffs = [] } = useQuery({
    queryKey: ['all_sign_offs'],
    queryFn: () => client.entities.ReconciliationSignOff.filter({ status: 'signed_off' }),
    staleTime: 1000 * 60 * 2,
  });
  const signedOffCustomerIds = useMemo(() => new Set(signOffs.map(s => s.customer_id)), [signOffs]);

  // ── Anomaly Detection ──
  // Fetch invoices for anomaly detection (actual monthly charges, not recurring bill definitions)
  const { data: invoices = [] } = useQuery({
    queryKey: ['all_invoices_for_anomalies'],
    queryFn: () => client.entities.Invoice.list('-invoice_date', 5000),
    staleTime: 1000 * 60 * 5,
  });

  // Compare each customer's monthly invoices — track by invoice name pattern
  const anomalies = useMemo(() => {
    if (!invoices || invoices.length === 0) return [];

    // Build set of recurring bill halopsa_ids to filter recurring-only invoices
    const recurringBillIds = new Set((bills || []).map(b => b.halopsa_id).filter(Boolean));

    // Group RECURRING invoices by customer — compare total monthly spend over time
    // Filter: only invoices whose notes/source match "recurring" or whose ID links to a recurring bill
    const monthlyByCustomer = {};
    for (const inv of invoices) {
      if (!inv.customer_id) continue;
      const amount = parseFloat(inv.total || inv.amount) || 0;
      if (amount <= 0) continue;

      // Filter: only PAID recurring invoices (skip overdue/pending duplicates, ticket charges, projects)
      if (inv.status !== 'paid') continue;
      const invName = (inv.notes || inv.invoice_number || '').toLowerCase();
      const isRecurring = invName.includes('recurring') || invName.includes('monthly') ||
        invName.includes('gtvoice') || invName.includes('voice') ||
        recurringBillIds.has(inv.halopsa_id) ||
        (inv.source === 'halopsa' && !invName.includes('ticket') && !invName.includes('project') && !invName.includes('ad-hoc'));
      if (!isRecurring) continue;

      const date = new Date(inv.invoice_date || inv.created_date || 0);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyByCustomer[inv.customer_id]) monthlyByCustomer[inv.customer_id] = {};
      if (!monthlyByCustomer[inv.customer_id][monthKey]) monthlyByCustomer[inv.customer_id][monthKey] = { amount: 0, date };
      monthlyByCustomer[inv.customer_id][monthKey].amount += amount;
    }

    // Convert to sorted arrays per customer
    const invoiceGroups = {};
    for (const [custId, months] of Object.entries(monthlyByCustomer)) {
      const sorted = Object.values(months).sort((a, b) => b.date - a.date);
      if (sorted.length >= 2) {
        invoiceGroups[custId] = { customerId: custId, billName: 'Total Monthly', invoices: sorted };
      }
    }

    const results = [];
    const customerMap = Object.fromEntries((customers || []).map(c => [c.id, c]));

    for (const group of Object.values(invoiceGroups)) {
      const sorted = group.invoices;
      if (sorted.length < 2) continue;

      const latest = sorted[0];
      const historical = sorted.slice(1, 7);
      if (historical.length === 0) continue;

      const avgAmount = historical.reduce((s, b) => s + b.amount, 0) / historical.length;
      if (avgAmount === 0) continue;

      const pctChange = ((latest.amount - avgAmount) / avgAmount) * 100;

      const history = sorted.slice(0, 7).map(b => ({
        amount: b.amount,
        month: b.date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      }));

      if (Math.abs(pctChange) >= 10) {
        const customer = customerMap[group.customerId];
        results.push({
          customerId: group.customerId,
          customerName: customer?.name || 'Unknown',
          billName: group.billName,
          customer,
          latestAmount: latest.amount,
          avgAmount,
          pctChange,
          direction: pctChange > 0 ? 'increase' : 'decrease',
          latestDate: latest.date,
          history,
        });
      }
    }

    // Merge with DB anomalies — add dbId for review/dismiss actions
    const dbMap = {};
    for (const dba of dbAnomalies) {
      dbMap[dba.customer_id] = dba.id;
    }
    for (const r of results) {
      r.dbId = dbMap[r.customerId] || null;
    }

    // Also add DB anomalies that aren't in the computed list (from previous scans)
    const computedIds = new Set(results.map(r => r.customerId));
    for (const dba of dbAnomalies) {
      if (!computedIds.has(dba.customer_id)) {
        results.push({
          customerId: dba.customer_id,
          customerName: customerMap[dba.customer_id]?.name || 'Unknown',
          customer: customerMap[dba.customer_id],
          latestAmount: parseFloat(dba.current_amount) || 0,
          avgAmount: parseFloat(dba.previous_avg) || 0,
          pctChange: parseFloat(dba.pct_change) || 0,
          direction: dba.direction,
          dbId: dba.id,
        });
      }
    }

    // Sort by absolute % change descending (biggest anomalies first)
    return results.sort((a, b) => Math.abs(b.pctChange) - Math.abs(a.pctChange));
  }, [bills, customers, dbAnomalies]);

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

      {/* Billing Anomalies */}
      {anomalies.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Bell className="w-4 h-4 text-red-500" />
            <h3 className="text-sm font-bold text-slate-900">Billing Anomalies</h3>
            <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-semibold">{anomalies.length}</span>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-2">
            {anomalies.slice(0, 8).map((a) => (
              <button
                key={`${a.customerId}-${a.billName}`}
                onClick={() => a.customer && onSelectCustomer(a.customer, 'recurring')}
                className={cn(
                  'text-left rounded-lg border p-3 hover:shadow-md transition-all cursor-pointer',
                  a.direction === 'decrease' ? 'bg-red-50/60 border-red-200' : 'bg-amber-50/60 border-amber-200'
                )}
              >
                <p className="text-xs font-semibold text-slate-900 truncate">{a.customerName}</p>
                <p className="text-[9px] text-slate-400 truncate mb-1.5">{a.billName}</p>
                <div className="flex items-baseline gap-1.5">
                  {a.direction === 'decrease' ? (
                    <TrendingDown className="w-3.5 h-3.5 text-red-500 shrink-0" />
                  ) : (
                    <TrendingUp className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  )}
                  <span className={cn('text-base font-bold tabular-nums', a.direction === 'decrease' ? 'text-red-600' : 'text-amber-600')}>
                    {a.pctChange > 0 ? '+' : ''}{a.pctChange.toFixed(0)}%
                  </span>
                  <span className="text-[10px] text-slate-400 tabular-nums">
                    ${Math.round(a.avgAmount).toLocaleString()} → ${Math.round(a.latestAmount).toLocaleString()}
                  </span>
                </div>
              </button>
            ))}
          </div>
          {anomalies.length > 8 && (
            <p className="text-[10px] text-slate-400 text-center">+{anomalies.length - 8} more anomalies</p>
          )}
        </div>
      )}

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
            const isSignedOff = signedOffCustomerIds.has(customer.id);

            return (
              <button
                key={customer.id}
                onClick={() => onSelectCustomer(customer)}
                className={cn(
                  'text-left rounded-lg border p-3.5 hover:shadow-md transition-all group flex flex-col h-full',
                  isSignedOff
                    ? 'bg-violet-50/60 border-violet-200 hover:border-violet-300'
                    : isFullyReconciled
                    ? 'bg-emerald-50/60 border-emerald-200 hover:border-emerald-300'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                )}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-semibold text-slate-900 text-xs leading-tight group-hover:text-slate-600 transition-colors line-clamp-1 flex-1 min-w-0">
                    {customer.name}
                  </h3>
                  {isSignedOff ? (
                    <Stamp className="w-4 h-4 text-violet-500 flex-shrink-0" />
                  ) : isFullyReconciled ? (
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
      {/* Anomaly Detail Modal — removed, details shown on customer page */}
      {false && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setAnomalyDetail(null)}>
          <div className="absolute inset-0 bg-black/30" />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">{anomalyDetail.customerName}</h3>
                <p className="text-xs text-slate-400">Billing Anomaly Detail</p>
              </div>
              <button onClick={() => setAnomalyDetail(null)} className="p-1 hover:bg-slate-100 rounded-lg">
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-4">
              {/* Summary */}
              <div className={cn(
                'flex items-center gap-3 p-3 rounded-xl border',
                anomalyDetail.direction === 'decrease' ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'
              )}>
                {anomalyDetail.direction === 'decrease' ? (
                  <TrendingDown className="w-6 h-6 text-red-500" />
                ) : (
                  <TrendingUp className="w-6 h-6 text-amber-500" />
                )}
                <div>
                  <p className={cn('text-xl font-bold tabular-nums', anomalyDetail.direction === 'decrease' ? 'text-red-600' : 'text-amber-600')}>
                    {anomalyDetail.pctChange > 0 ? '+' : ''}{anomalyDetail.pctChange.toFixed(1)}%
                  </p>
                  <p className="text-xs text-slate-500">
                    {anomalyDetail.direction === 'decrease' ? 'Revenue decreased' : 'Billing increased'} by ${Math.abs(Math.round(anomalyDetail.latestAmount - anomalyDetail.avgAmount)).toLocaleString()}/mo
                  </p>
                </div>
              </div>

              {/* Explanation */}
              <div className="bg-slate-50 rounded-lg p-3 border text-xs text-slate-600">
                <p className="font-semibold text-slate-700 mb-1">How this was calculated:</p>
                <p>The average of the previous {anomalyDetail.history ? anomalyDetail.history.length - 1 : '?'} months was <strong className="text-slate-900">${Math.round(anomalyDetail.avgAmount).toLocaleString()}/mo</strong>. The latest invoice is <strong className="text-slate-900">${Math.round(anomalyDetail.latestAmount).toLocaleString()}/mo</strong>.</p>
              </div>

              {/* Monthly history */}
              <div>
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Monthly Invoice History</h4>
                <div className="space-y-1">
                  {(anomalyDetail.history || []).map((h, i) => {
                    const barPct = anomalyDetail.history ? (h.amount / Math.max(...anomalyDetail.history.map(x => x.amount || 1))) * 100 : 0;
                    return (
                      <div key={i} className="flex items-center gap-3">
                        <span className="text-[10px] text-slate-400 w-14 shrink-0">{h.month}</span>
                        <div className="flex-1 h-5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={cn(
                              'h-full rounded-full transition-all',
                              i === 0
                                ? (anomalyDetail.direction === 'decrease' ? 'bg-red-400' : 'bg-amber-400')
                                : 'bg-slate-300'
                            )}
                            style={{ width: `${Math.max(barPct, 3)}%` }}
                          />
                        </div>
                        <span className={cn(
                          'text-xs font-semibold tabular-nums w-20 text-right',
                          i === 0
                            ? (anomalyDetail.direction === 'decrease' ? 'text-red-600' : 'text-amber-600')
                            : 'text-slate-600'
                        )}>
                          ${Math.round(h.amount).toLocaleString()}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2 border-t">
                <button
                  onClick={() => { anomalyDetail.customer && onSelectCustomer(anomalyDetail.customer, 'recurring'); setAnomalyDetail(null); }}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-pink-500 text-white hover:bg-pink-600 transition-colors"
                >
                  <DollarSign className="w-3.5 h-3.5" /> View Invoices
                </button>
                {anomalyDetail.dbId && (
                  <button
                    onClick={() => { handleReviewAnomaly(anomalyDetail.dbId); setAnomalyDetail(null); }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors"
                  >
                    <Check className="w-3.5 h-3.5" /> Mark Reviewed
                  </button>
                )}
              </div>
            </div>
          </div>
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
