import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { client } from '@/api/client';
import { useAuth } from '@/lib/AuthContext';
import { useReconciliationData } from '@/hooks/useReconciliationData';
import { getDiscrepancySummary } from '@/lib/lootit-reconciliation';
import {
  Building2,
  FileText,
  Cloud,
  DollarSign,
  Users,
  Monitor,
  Calendar,
  ChevronRight,
  RefreshCw,
  HelpCircle,
  Phone,
  Mail,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  ChevronDown,
  Activity,
  BarChart3,
  Eye
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PortalMetricCard, PortalPageHeader, PortalSection, PortalStatusPill } from "@/components/ui/portal-primitives";
import { cn, formatLineItemDescription, safeFormatDate, safeDifferenceInDays } from "@/lib/utils";
// date-fns calls replaced by safe wrappers from @/lib/utils
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { toast } from 'sonner';

const LOOTIT_URL = import.meta.env.VITE_LOOTIT_URL || 'https://lootit-frontend-production.up.railway.app';

// Admin Dashboard Component
function AdminDashboard() {
  const navigate = useNavigate();

  const { data: customers = [], isLoading: loadingCustomers } = useQuery({
    queryKey: ['customers'],
    queryFn: () => client.entities.Customer.list('-updated_date', 500),
  });

  const { data: contracts = [], isLoading: loadingContracts } = useQuery({
    queryKey: ['contracts'],
    queryFn: () => client.entities.Contract.list('-created_date', 500),
  });

  const { data: recurringBills = [] } = useQuery({
    queryKey: ['recurring_bills'],
    queryFn: () => client.entities.RecurringBill.list('-created_date', 1000),
    staleTime: 1000 * 60 * 5,
  });

  const { data: syncLogs = [] } = useQuery({
    queryKey: ['sync_logs_recent'],
    queryFn: () => client.entities.SyncLog.list('-created_date', 10),
    staleTime: 1000 * 60 * 2,
  });

  // LootIT reconciliation data (also provides bills + line items for MRR)
  const { reconciliations, globalSummary, bills: reconBills, lineItems: reconLineItems, isLoading: loadingRecon } = useReconciliationData();

  const isLoading = loadingCustomers || loadingContracts;

  // Calculate MRR from line items (net_amount, excludes tax) of active monthly bills
  const totalMRR = useMemo(() => {
    const now = new Date();
    // Build set of active, non-expired, monthly bill IDs
    const monthlyBillIds = new Set();
    const allBills = reconBills.length > 0 ? reconBills : recurringBills;
    for (const b of allBills) {
      if ((b.status || '').toLowerCase() === 'inactive') continue;
      if (b.end_date) {
        const end = new Date(b.end_date);
        if (end.getFullYear() < 2090 && end < now) continue;
      }
      const freq = (b.frequency || 'monthly').toLowerCase();
      if (['yearly', 'annual', 'annually', 'year'].includes(freq)) continue;
      monthlyBillIds.add(b.id);
    }
    // Sum net_amount from line items (excludes tax) if available
    if (reconLineItems.length > 0) {
      return reconLineItems
        .filter(li => monthlyBillIds.has(li.recurring_bill_id))
        .reduce((sum, li) => sum + (parseFloat(li.net_amount) || 0), 0);
    }
    // Fallback to bill amounts if line items not loaded yet
    return allBills
      .filter(b => monthlyBillIds.has(b.id))
      .reduce((sum, b) => sum + (b.amount || 0), 0);
  }, [reconBills, reconLineItems, recurringBills]);

  // MRR breakdown by customer (for audit view)
  const mrrBreakdown = useMemo(() => {
    const now = new Date();
    const allBills = reconBills.length > 0 ? reconBills : recurringBills;
    const activeBills = allBills.filter(b => {
      if ((b.status || '').toLowerCase() === 'inactive') return false;
      if (b.end_date) {
        const end = new Date(b.end_date);
        if (end.getFullYear() < 2090 && end < now) return false;
      }
      const freq = (b.frequency || 'monthly').toLowerCase();
      if (['yearly', 'annual', 'annually', 'year'].includes(freq)) return false;
      return true;
    });

    const billIds = new Set(activeBills.map(b => b.id));
    const billMap = Object.fromEntries(activeBills.map(b => [b.id, b]));

    // Group line items by customer via bill
    const byCustomer = {};
    const items = reconLineItems.length > 0 ? reconLineItems : [];
    for (const li of items) {
      if (!billIds.has(li.recurring_bill_id)) continue;
      const bill = billMap[li.recurring_bill_id];
      const custId = bill?.customer_id;
      if (!custId) continue;
      if (!byCustomer[custId]) byCustomer[custId] = { bills: new Set(), lineTotal: 0, lines: [] };
      byCustomer[custId].bills.add(li.recurring_bill_id);
      byCustomer[custId].lineTotal += parseFloat(li.net_amount) || 0;
      byCustomer[custId].lines.push(li);
    }

    // If no line items, fall back to bill amounts
    if (items.length === 0) {
      for (const b of activeBills) {
        if (!byCustomer[b.customer_id]) byCustomer[b.customer_id] = { bills: new Set(), lineTotal: 0, lines: [] };
        byCustomer[b.customer_id].bills.add(b.id);
        byCustomer[b.customer_id].lineTotal += b.amount || 0;
      }
    }

    const customerMap = Object.fromEntries(customers.map(c => [c.id, c.name]));
    return Object.entries(byCustomer)
      .map(([custId, data]) => ({
        customerId: custId,
        customerName: customerMap[custId] || 'Unknown',
        mrr: data.lineTotal,
        billCount: data.bills.size,
        lineCount: data.lines.length,
      }))
      .sort((a, b) => b.mrr - a.mrr);
  }, [reconBills, reconLineItems, recurringBills, customers]);

  const [showMrrBreakdown, setShowMrrBreakdown] = useState(false);

  const activeCustomers = customers.filter(c => c.status === 'active').length;
  const activeContracts = contracts.filter(c => c.status === 'active').length;

  // LootIT: customers with billing issues
  const lootITCustomers = useMemo(() => {
    return Object.values(reconciliations)
      .map((entry) => {
        const allRecons = [
          ...(entry.reconciliations || []),
          ...(entry.pax8Reconciliations || []),
        ];
        const combined = getDiscrepancySummary(allRecons);
        return { ...entry, combinedSummary: combined };
      })
      .sort((a, b) => {
        const aIssues = a.combinedSummary.over + a.combinedSummary.under;
        const bIssues = b.combinedSummary.over + b.combinedSummary.under;
        return bIssues - aIssues;
      });
  }, [reconciliations]);

  const lootITIssueCustomers = lootITCustomers.filter(
    (c) => c.combinedSummary.over > 0 || c.combinedSummary.under > 0
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-28 rounded-2xl" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="lg:col-span-2 h-80 rounded-2xl" />
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      </div>
    );
  }

  const reconHealth = globalSummary.totalCustomers > 0
    ? Math.round(
        ((globalSummary.totalMatched + globalSummary.totalReviewed) /
          Math.max(
            globalSummary.totalMatched + globalSummary.totalOver + globalSummary.totalUnder + globalSummary.totalReviewed,
            1
          )) *
          100
      )
    : 0;

  return (
    <div className="space-y-5">
      <PortalPageHeader
        title="Dashboard"
        description="Operational view across customers, billing, and reconciliation."
        meta={syncLogs[0]?.created_date ? `Last sync ${safeFormatDate(syncLogs[0].created_date, 'MMM d, h:mm a', 'Unknown')}` : undefined}
        actions={(
          <Link to={createPageUrl('Customers')}>
            <Button size="sm" className="gap-2">
              <Building2 className="h-4 w-4" />
              Customers
            </Button>
          </Link>
        )}
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <PortalMetricCard
          icon={Building2}
          label="Active customers"
          value={activeCustomers}
          detail={`${customers.length} total accounts`}
          tone="violet"
          onClick={() => navigate(createPageUrl('Customers'))}
        />
        <PortalMetricCard
          icon={DollarSign}
          label="Monthly revenue"
          value={`$${Math.round(totalMRR).toLocaleString()}`}
          detail="Net active monthly services"
          tone="emerald"
          onClick={() => setShowMrrBreakdown(!showMrrBreakdown)}
        />
        <PortalMetricCard
          icon={FileText}
          label="Active contracts"
          value={activeContracts}
          detail="Published customer plans"
          tone="blue"
        />
        <PortalMetricCard
          icon={BarChart3}
          label="Reconciliation health"
          value={`${reconHealth}%`}
          detail={`${lootITIssueCustomers.length} customer${lootITIssueCustomers.length === 1 ? '' : 's'} need review`}
          tone={lootITIssueCustomers.length > 0 ? 'amber' : 'emerald'}
        />
      </div>

      {showMrrBreakdown && (
        <PortalSection
          title="MRR breakdown"
          description={`${mrrBreakdown.length} customers, net amounts excluding tax, active monthly bills only.`}
          badge={<PortalStatusPill tone="emerald" label={`$${Math.round(totalMRR).toLocaleString()} total`} />}
        >
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-2.5 text-left">Customer</th>
                  <th className="w-20 px-4 py-2.5 text-right">Bills</th>
                  <th className="w-20 px-4 py-2.5 text-right">Lines</th>
                  <th className="w-28 px-4 py-2.5 text-right">MRR</th>
                  <th className="w-20 px-4 py-2.5 text-right">%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {mrrBreakdown.map((row) => (
                  <tr key={row.customerId} className="hover:bg-slate-50">
                    <td className="px-5 py-2.5 text-sm font-medium text-slate-900">{row.customerName}</td>
                    <td className="px-4 py-2.5 text-right text-xs text-slate-500">{row.billCount}</td>
                    <td className="px-4 py-2.5 text-right text-xs text-slate-500">{row.lineCount}</td>
                    <td className="px-4 py-2.5 text-right text-sm font-semibold tabular-nums text-slate-950">
                      ${Math.round(row.mrr).toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs tabular-nums text-slate-500">
                      {totalMRR > 0 ? Math.round((row.mrr / totalMRR) * 100) : 0}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PortalSection>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
        <PortalSection
          title="Customer accounts"
          description="Fast account lookup with billing reconciliation context."
          actions={(
            <Link to={createPageUrl('Customers')}>
              <Button variant="outline" size="sm" className="gap-2">
                View all
                <ChevronRight className="h-4 w-4" />
              </Button>
            </Link>
          )}
        >
          <div className="hidden grid-cols-[minmax(0,1fr)_180px_160px_110px_32px] gap-3 border-b border-slate-100 bg-slate-50 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 md:grid">
            <div>Customer</div>
            <div>Contact</div>
            <div>Reconciliation</div>
            <div className="text-right">Status</div>
            <div />
          </div>
          <div className="divide-y divide-slate-100">
            {customers.slice(0, 12).map(customer => {
              const reconData = reconciliations[customer.id];
              const summary = reconData
                ? getDiscrepancySummary([
                    ...(reconData.reconciliations || []),
                    ...(reconData.pax8Reconciliations || []),
                  ])
                : null;
              const issues = summary ? summary.over + summary.under : 0;
              const active = summary ? summary.total - summary.noData : 0;
              const resolved = summary ? summary.matched + summary.reviewed : 0;
              const pct = active > 0 ? Math.round((resolved / active) * 100) : 0;

              return (
                <button
                  key={customer.id}
                  onClick={() => navigate(createPageUrl(`CustomerDetail?id=${customer.id}`))}
                  className="grid w-full grid-cols-1 gap-2 px-5 py-3 text-left transition-colors hover:bg-slate-50 md:grid-cols-[minmax(0,1fr)_180px_160px_110px_32px] md:items-center"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className={cn(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border',
                      customer.status === 'active' ? 'border-violet-200 bg-violet-50 text-violet-700' : 'border-slate-200 bg-slate-50 text-slate-400'
                    )}>
                      <Building2 className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-950">{customer.name}</p>
                      <p className="truncate text-xs text-slate-500">{customer.email || customer.address || 'No primary email'}</p>
                    </div>
                  </div>
                  <div className="truncate text-sm text-slate-600">{customer.primary_contact || customer.email || '-'}</div>
                  <div>
                    {summary && active > 0 ? (
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={cn('h-full rounded-full', issues > 0 ? 'bg-amber-400' : 'bg-emerald-500')}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="w-9 text-right text-xs font-semibold tabular-nums text-slate-600">{pct}%</span>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">No data</span>
                    )}
                  </div>
                  <div className="flex items-center justify-start gap-2 md:justify-end">
                    {issues > 0 ? (
                      <PortalStatusPill tone="amber" icon={AlertTriangle} label={`${issues} review`} className="py-0.5 text-[11px]" />
                    ) : (
                      <PortalStatusPill tone={customer.status === 'active' ? 'emerald' : 'slate'} label={customer.status || 'active'} className="py-0.5 text-[11px]" />
                    )}
                  </div>
                  <ChevronRight className="hidden h-4 w-4 text-slate-300 md:block" />
                </button>
              );
            })}
          </div>
        </PortalSection>

        <div className="space-y-5">
          <PortalSection
            title="Billing reconciliation"
            description="LootIT review queue across managed customers."
            actions={(
              <a href={LOOTIT_URL}>
                <Button variant="outline" size="sm" className="gap-2">
                  Open LootIT
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </a>
            )}
            bodyClassName="p-4"
          >
            {loadingRecon ? (
              <div className="grid grid-cols-2 gap-3">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-20 rounded-xl" />
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <PortalMetricCard icon={Activity} label="Health" value={`${reconHealth}%`} detail="matched or reviewed" tone={reconHealth >= 90 ? 'emerald' : 'amber'} className="p-3" />
                  <PortalMetricCard icon={Eye} label="Reviewed" value={globalSummary.totalReviewed} detail="accepted differences" tone="violet" className="p-3" />
                  <PortalMetricCard icon={TrendingDown} label="Under-billed" value={globalSummary.totalUnder} detail="vendor count higher" tone={globalSummary.totalUnder > 0 ? 'rose' : 'slate'} className="p-3" />
                  <PortalMetricCard icon={TrendingUp} label="Over-billed" value={globalSummary.totalOver} detail="billing count higher" tone={globalSummary.totalOver > 0 ? 'amber' : 'slate'} className="p-3" />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold uppercase tracking-wide text-slate-500">Needs review</span>
                    <span className="text-slate-500">{lootITIssueCustomers.length} customers</span>
                  </div>
                  {lootITIssueCustomers.length === 0 ? (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                      All mapped reconciliation rows are clean.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {lootITIssueCustomers.slice(0, 6).map(({ customer, combinedSummary: s }) => (
                        <a
                          key={customer.id}
                          href={`${LOOTIT_URL}?customer=${customer.id}`}
                          className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 transition-colors hover:bg-slate-50"
                        >
                          <span className="truncate text-sm font-medium text-slate-900">{customer.name}</span>
                          <div className="flex shrink-0 items-center gap-1.5 text-[11px]">
                            {s.under > 0 && <PortalStatusPill tone="rose" label={`${s.under} under`} className="py-0.5 text-[11px]" />}
                            {s.over > 0 && <PortalStatusPill tone="amber" label={`${s.over} over`} className="py-0.5 text-[11px]" />}
                          </div>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </PortalSection>

          {syncLogs.length > 0 && (
            <PortalSection title="Recent syncs" description="Latest integration activity." bodyClassName="divide-y divide-slate-100">
              {syncLogs.slice(0, 5).map((log) => (
                <div key={log.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{log.sync_type || 'Sync'}</p>
                    <p className="text-xs text-slate-500">{log.created_date ? safeFormatDate(log.created_date, 'MMM d, h:mm a', '') : 'Unknown time'}</p>
                  </div>
                  <PortalStatusPill
                    tone={log.status === 'success' ? 'emerald' : log.status === 'error' ? 'rose' : 'slate'}
                    label={log.status || 'sync'}
                    className="py-0.5 text-[11px]"
                  />
                </div>
              ))}
            </PortalSection>
          )}
        </div>
      </div>
    </div>
  );
}

// Customer Dashboard Component
function CustomerDashboard({ customer }) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [expandedInvoices, setExpandedInvoices] = useState({});
  const [dismissedAlerts, setDismissedAlerts] = useState([]);
  const queryClient = useQueryClient();
  const customerId = customer?.id;

  // Fetch activities for orphaned users (removed from HaloPSA but have licenses)
  const { data: orphanedUserAlerts = [] } = useQuery({
    queryKey: ['orphaned_user_alerts', customerId],
    queryFn: async () => {
      const activities = await client.entities.Activity.filter({
        entity_id: customerId,
        entity_type: 'license_revoked'
      });
      // Filter to only recent ones (last 30 days) that mention HaloPSA removal
      const recentAlerts = activities.filter(a => 
        a.description?.includes('removed from HaloPSA') || 
        a.title?.includes('Removed from HaloPSA')
      );
      
      // Parse metadata for all alerts up front
      const alertsWithMeta = recentAlerts.map(alert => {
        let metadata = {};
        try { metadata = alert.metadata ? JSON.parse(alert.metadata) : {}; } catch { /* skip malformed */ }
        return { ...alert, metadata };
      });

      // Collect all unique contact IDs to batch-fetch assignments
      const contactIds = [...new Set(
        alertsWithMeta.map(a => a.metadata?.contact_id).filter(Boolean)
      )];

      // Batch-load all license assignments for these contacts at once
      const allAssignments = contactIds.length > 0
        ? await client.entities.LicenseAssignment.filterIn('contact_id', contactIds)
        : [];
      const activeAssignments = allAssignments.filter(a => a.status === 'active');

      // Batch-load all referenced licenses at once
      const licenseIds = [...new Set(activeAssignments.map(a => a.license_id).filter(Boolean))];
      const allLicenses = licenseIds.length > 0
        ? await client.entities.SaaSLicense.filterIn('id', licenseIds)
        : [];
      const licenseMap = Object.fromEntries(allLicenses.map(l => [l.id, l.application_name || 'Unknown License']));

      // Build a map of contact_id -> license names
      const contactLicenseMap = {};
      for (const assignment of activeAssignments) {
        const cid = assignment.contact_id;
        if (!contactLicenseMap[cid]) contactLicenseMap[cid] = [];
        contactLicenseMap[cid].push(licenseMap[assignment.license_id] || 'Unknown License');
      }

      const alertsWithLicenses = alertsWithMeta.map(alert => ({
        ...alert,
        licenseNames: alert.metadata?.contact_id
          ? (contactLicenseMap[alert.metadata.contact_id] || [])
          : []
      }));
      
      return alertsWithLicenses;
    },
    enabled: !!customerId,
    staleTime: 1000 * 60 * 5
  });

  // Parallel fetch all primary data at once
  const { data: contracts = [], isLoading: loadingContracts } = useQuery({
    queryKey: ['contracts', customerId],
    queryFn: () => client.entities.Contract.filter({ customer_id: customerId }),
    enabled: !!customerId,
    staleTime: 1000 * 60 * 5
  });

  const { data: recurringBills = [], isLoading: loadingBills } = useQuery({
    queryKey: ['recurring_bills', customerId],
    queryFn: () => client.entities.RecurringBill.filter({ customer_id: customerId }),
    enabled: !!customerId,
    staleTime: 1000 * 60 * 5
  });

  const recurringBillIds = useMemo(() => recurringBills.map(b => b.id).sort(), [recurringBills]);
  const { data: lineItems = [] } = useQuery({
    queryKey: ['line_items', customerId, recurringBillIds],
    queryFn: () => client.entities.RecurringBillLineItem.filterIn(
      'recurring_bill_id', recurringBillIds
    ),
    enabled: !!customerId && recurringBillIds.length > 0,
    staleTime: 1000 * 60 * 5
  });

  const { data: invoices = [], isLoading: loadingInvoices } = useQuery({
    queryKey: ['invoices', customerId],
    queryFn: () => client.entities.Invoice.filter({ customer_id: customerId }),
    enabled: !!customerId,
    staleTime: 1000 * 60 * 5
  });

  const invoiceIds = useMemo(() => invoices.map(i => i.id).sort(), [invoices]);
  const { data: invoiceLineItems = [] } = useQuery({
    queryKey: ['invoice_line_items', customerId, invoiceIds],
    queryFn: () => client.entities.InvoiceLineItem.filterIn(
      'invoice_id', invoiceIds
    ),
    enabled: !!customerId && invoiceIds.length > 0,
    staleTime: 1000 * 60 * 5
  });

  const { data: tickets = [], isLoading: loadingTickets } = useQuery({
    queryKey: ['tickets', customerId],
    queryFn: () => client.entities.Ticket.filter({ customer_id: customerId }),
    enabled: !!customerId,
    staleTime: 1000 * 60 * 5
  });

  const { data: contacts = [], isLoading: loadingContacts } = useQuery({
    queryKey: ['contacts', customerId],
    queryFn: () => client.entities.Contact.filter({ customer_id: customerId }),
    enabled: !!customerId,
    staleTime: 1000 * 60 * 5
  });

  const isLoadingPrimary = loadingContracts || loadingBills || loadingInvoices || loadingTickets || loadingContacts;

  const monthlyTotal = recurringBills.filter(b => !['yearly', 'annual', 'annually'].includes((b.frequency || '').toLowerCase())).reduce((sum, b) => sum + (b.amount || 0), 0);
  const openTickets = tickets.filter(t => ['new', 'open', 'in_progress'].includes(t.status)).length;
  const activeContracts = contracts.filter(c => c.status === 'active').length;
  const overdueAmount = invoices.filter(i => i.status === 'overdue').reduce((sum, i) => sum + (parseFloat(i.amount_due) || 0), 0);

  const upcomingRenewals = contracts
    .filter(c => c.renewal_date || c.end_date)
    .map(c => ({
      ...c,
      renewalDate: c.renewal_date || c.end_date,
      daysUntil: (c.renewal_date || c.end_date) ? safeDifferenceInDays(c.renewal_date || c.end_date, new Date(), -1) : -1
    }))
    .filter(c => c.daysUntil >= 0 && c.daysUntil <= 90)
    .sort((a, b) => a.daysUntil - b.daysUntil);

  const handleFullSync = async () => {
    if (!customer?.external_id) return;
    setIsSyncing(true);
    try {
      await Promise.all([
        client.functions.invoke('syncHaloPSAContracts', { action: 'sync_customer', customer_id: customer.external_id }),
        client.functions.invoke('syncHaloPSARecurringBills', { action: 'sync_customer', customer_id: customer.external_id }),
        client.functions.invoke('syncHaloPSAInvoices', { action: 'sync_customer', customer_id: customer.external_id }),
        client.functions.invoke('syncHaloPSATickets', { action: 'sync_customer', customer_id: customer.external_id }),
        client.functions.invoke('syncHaloPSAContacts', { action: 'sync_customer', customer_id: customer.external_id }),
      ]);
      toast.success('All data synced successfully!');
      queryClient.invalidateQueries({ queryKey: ['contracts', customerId] });
      queryClient.invalidateQueries({ queryKey: ['recurring_bills', customerId] });
      queryClient.invalidateQueries({ queryKey: ['invoices', customerId] });
      queryClient.invalidateQueries({ queryKey: ['tickets', customerId] });
      queryClient.invalidateQueries({ queryKey: ['contacts', customerId] });
      queryClient.invalidateQueries({ queryKey: ['orphaned_user_alerts', customerId] });
    } catch (error) {
      toast.error('Sync failed: ' + error.message);
    } finally {
      setIsSyncing(false);
    }
  };

  // Show skeleton while primary data loads
  if (isLoadingPrimary) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <Skeleton className="h-64 rounded-3xl" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-64 rounded-2xl" />
            <Skeleton className="h-48 rounded-2xl" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-48 rounded-2xl" />
            <Skeleton className="h-40 rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Welcome Header */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-3xl p-8 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="relative">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-slate-400 text-sm mb-1">Welcome back,</p>
              <h1 className="text-3xl font-bold mb-2">{customer.name}</h1>
              <p className="text-slate-400">Your IT services dashboard</p>
            </div>
            {customer?.source === 'halopsa' && (
              <Button 
                onClick={handleFullSync}
                disabled={isSyncing}
                variant="outline"
                className="bg-white/10 border-white/20 text-white hover:bg-white/20"
              >
                <RefreshCw className={cn("w-4 h-4 mr-2", isSyncing && "animate-spin")} />
                Refresh Data
              </Button>
            )}
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
            <div className="bg-white/10 backdrop-blur rounded-xl p-4">
              <DollarSign className="w-5 h-5 text-emerald-400 mb-2" />
              <p className="text-2xl font-bold">${monthlyTotal.toLocaleString()}</p>
              <p className="text-xs text-slate-400">Monthly Services</p>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-xl p-4">
              <FileText className="w-5 h-5 text-blue-400 mb-2" />
              <p className="text-2xl font-bold">{activeContracts}</p>
              <p className="text-xs text-slate-400">Active Contracts</p>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-xl p-4">
              <Monitor className="w-5 h-5 text-orange-400 mb-2" />
              <p className="text-2xl font-bold">{openTickets}</p>
              <p className="text-xs text-slate-400">Open Tickets</p>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-xl p-4">
              <Users className="w-5 h-5 text-purple-400 mb-2" />
              <p className="text-2xl font-bold">{contacts.length}</p>
              <p className="text-xs text-slate-400">Team Members</p>
            </div>
          </div>
        </div>
      </div>

      {/* Orphaned User Alerts - Users removed from HaloPSA but still have licenses */}
      {orphanedUserAlerts.filter(a => !dismissedAlerts.includes(a.id)).length > 0 && (
        <div className="space-y-3">
          {orphanedUserAlerts.filter(a => !dismissedAlerts.includes(a.id)).map(alert => (
            <div key={alert.id} className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="flex items-start gap-4">
                <div className="p-2 bg-amber-100 rounded-lg flex-shrink-0">
                  <AlertCircle className="w-5 h-5 text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-amber-900">User Removed from HaloPSA</p>
                  <p className="text-sm text-amber-700 mt-1">
                    <strong>{alert.metadata?.contact_name || 'Unknown User'}</strong>
                    {alert.metadata?.contact_email && (
                      <span className="text-amber-600"> ({alert.metadata.contact_email})</span>
                    )}
                    {' '}was removed from HaloPSA but still has active licenses assigned.
                  </p>
                  {alert.licenseNames && alert.licenseNames.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs font-medium text-amber-800 mb-1">Assigned Licenses:</p>
                      <div className="flex flex-wrap gap-1">
                        {alert.licenseNames.map((name, idx) => (
                          <Badge key={idx} className="bg-amber-200 text-amber-800 text-xs">
                            {name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  <p className="text-xs text-amber-600 mt-2">
                    Action needed: Review and revoke licenses if this user should no longer have access.
                  </p>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="text-amber-600 hover:text-amber-800 hover:bg-amber-100 flex-shrink-0"
                  onClick={() => setDismissedAlerts(prev => [...prev, alert.id])}
                >
                  Dismiss
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Alerts */}
      {(overdueAmount > 0 || upcomingRenewals.length > 0) && (
        <div className="space-y-3">
          {overdueAmount > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-4">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-red-900">Payment Required</p>
                <p className="text-sm text-red-700">You have ${overdueAmount.toLocaleString()} in overdue invoices</p>
              </div>
              <Button size="sm" className="bg-red-600 hover:bg-red-700">Pay Now</Button>
            </div>
          )}
          {upcomingRenewals.length > 0 && upcomingRenewals[0]?.daysUntil <= 30 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-4">
              <div className="p-2 bg-amber-100 rounded-lg">
                <Calendar className="w-5 h-5 text-amber-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-amber-900">Contract Renewal Coming Up</p>
                <p className="text-sm text-amber-700">{upcomingRenewals[0]?.name} renews in {upcomingRenewals[0]?.daysUntil} days</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Services */}
          <div className="bg-white rounded-2xl border border-slate-200/50 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Your Services</h2>
                <p className="text-sm text-slate-500">What's included in your plan</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-slate-900">${monthlyTotal.toLocaleString()}</p>
                <p className="text-xs text-slate-500">per month</p>
              </div>
            </div>

            {lineItems.length === 0 ? (
              <div className="py-8 text-center">
                <Cloud className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">No services found</p>
              </div>
            ) : (
              <div className="space-y-2">
                {lineItems.slice(0, 6).map(item => (
                  <div key={item.id} className="flex items-center justify-between py-3 px-4 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <p className="font-medium text-slate-900 text-sm">
                        {formatLineItemDescription(item.description)}
                      </p>
                    </div>
                    <p className="font-semibold text-slate-900">
                      ${(item.net_amount || 0).toFixed(2)}
                    </p>
                  </div>
                ))}
                {lineItems.length > 6 && (
                  <Link to={createPageUrl(`CustomerDetail?id=${customerId}`)}>
                    <Button variant="ghost" className="w-full text-slate-600 hover:text-slate-900">
                      View all {lineItems.length} services <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </Link>
                )}
              </div>
            )}
          </div>

          {/* Recent Invoices */}
          <div className="bg-white rounded-2xl border border-slate-200/50 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900">Recent Invoices</h2>
              <Link to={createPageUrl(`CustomerDetail?id=${customerId}`)}>
                <Button variant="ghost" size="sm" className="text-slate-600 hover:text-slate-900">View All</Button>
              </Link>
            </div>

            {invoices.length === 0 ? (
              <div className="py-8 text-center">
                <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">No invoices yet</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {invoices.slice(0, 5).map(invoice => {
                  const items = invoiceLineItems.filter(item => item.invoice_id === invoice.id);
                  const isExpanded = expandedInvoices[invoice.id];
                  return (
                    <div key={invoice.id}>
                      <button
                        onClick={() => setExpandedInvoices(prev => ({ ...prev, [invoice.id]: !prev[invoice.id] }))}
                        className="w-full flex items-center justify-between py-4 hover:bg-slate-50 -mx-2 px-2 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <ChevronDown className={cn("w-4 h-4 text-slate-400", isExpanded && "rotate-180")} />
                          <div className="text-left">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-slate-900">{invoice.invoice_number}</p>
                              <Badge className={cn(
                                'text-xs',
                                invoice.status === 'paid' && 'bg-green-100 text-green-700',
                                invoice.status === 'overdue' && 'bg-red-100 text-red-700',
                                invoice.status === 'sent' && 'bg-yellow-100 text-yellow-700',
                              )}>
                                {invoice.status === 'sent' ? 'Pending' : invoice.status}
                              </Badge>
                            </div>
                            <p className="text-xs text-slate-500">
                              {invoice.due_date && `Due: ${safeFormatDate(invoice.due_date, 'MMM d, yyyy')}`}
                            </p>
                          </div>
                        </div>
                        <p className="text-lg font-semibold">${(invoice.total || 0).toFixed(2)}</p>
                      </button>
                      {isExpanded && items.length > 0 && (
                        <div className="bg-slate-50 rounded-lg px-4 py-3 mb-2 ml-7">
                          {items.map(item => (
                            <div key={item.id} className="flex justify-between text-sm py-1">
                              <span className="text-slate-700">{item.description}</span>
                              <span className="font-medium">${(item.net_amount || 0).toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Support */}
          <div className="bg-white rounded-2xl border border-slate-200/50 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900">Support</h2>
              <Badge className="bg-slate-100 text-slate-700">{openTickets} open</Badge>
            </div>
            {tickets.filter(t => ['new', 'open', 'in_progress'].includes(t.status)).length === 0 ? (
              <div className="py-6 text-center">
                <HelpCircle className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 text-sm">No open tickets</p>
              </div>
            ) : (
              <div className="space-y-3">
                {tickets.filter(t => ['new', 'open', 'in_progress'].includes(t.status)).slice(0, 3).map(ticket => (
                  <div key={ticket.id} className="p-3 bg-slate-50 rounded-lg">
                    <p className="font-medium text-slate-900 text-sm">#{ticket.ticket_number}</p>
                    <p className="text-xs text-slate-500 truncate">{ticket.summary}</p>
                  </div>
                ))}
              </div>
            )}
            <Link to={createPageUrl(`CustomerDetail?id=${customerId}`)}>
              <Button className="w-full mt-4 bg-slate-800 hover:bg-slate-900">
                <HelpCircle className="w-4 h-4 mr-2" />
                View All Tickets
              </Button>
            </Link>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-2xl border border-slate-200/50 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Quick Actions</h2>
            <div className="space-y-2">
              <Button variant="outline" className="w-full justify-start gap-3 h-12">
                <Phone className="w-4 h-4 text-slate-600" />
                Call Support
              </Button>
              <Button variant="outline" className="w-full justify-start gap-3 h-12">
                <Mail className="w-4 h-4 text-slate-600" />
                Email Support
              </Button>
              <Link to={createPageUrl(`CustomerDetail?id=${customerId}`)} className="block">
                <Button variant="outline" className="w-full justify-start gap-3 h-12">
                  <FileText className="w-4 h-4 text-slate-600" />
                  View Full Account
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Main Dashboard - Routes based on user role
export default function Dashboard() {
  const { user, isLoadingAuth } = useAuth();

  const { data: customers = [], isSuccess: customersLoaded } = useQuery({
    queryKey: ['customers'],
    queryFn: () => client.entities.Customer.list('-created_date', 500),
    staleTime: 1000 * 60 * 5,
  });

  // Match customer from the loaded customers list (derived, no useEffect needed)
  const customer = useMemo(() => {
    if (!user || user.role === 'admin') return null;
    if (!customersLoaded || customers.length === 0) return null;
    if (!user.customer_id) return null;
    return customers.find(c => c.id === user.customer_id) || null;
  }, [user, customersLoaded, customers, user?.customer_id]);

  const isLoading = isLoadingAuth;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 rounded-2xl" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      </div>
    );
  }

  // Admin users see the MSP dashboard
  if (user?.role === 'admin') {
    return <AdminDashboard />;
  }

  // Regular users see the customer dashboard
  if (customer) {
    return <CustomerDashboard customer={customer} />;
  }

  // Fallback if no customer found
  return (
    <div className="text-center py-12">
      <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-4" />
      <h2 className="text-xl font-semibold text-slate-900 mb-2">Account Not Found</h2>
      <p className="text-slate-500">Please contact support to link your account.</p>
    </div>
  );
}
