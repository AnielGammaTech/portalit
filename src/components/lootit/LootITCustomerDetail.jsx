import React, { useState, useMemo, useRef, useCallback } from 'react';
import { ArrowLeft, Filter, Check, RotateCcw, RefreshCw, AlertTriangle, Save, Upload, FileText, Download, DollarSign, Users, Hash, CloudUpload, CheckCircle2, Monitor, Server, Repeat2, Bell, TrendingDown, TrendingUp, X } from 'lucide-react';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cn, formatLineItemDescription } from '@/lib/utils';
import { client, supabase } from '@/api/client';
import { useReconciliationData } from '@/hooks/useReconciliationData';
import { useReconciliationReviews } from '@/hooks/useReconciliationReviews';
import { useCustomerContacts, useCustomerDevices } from '@/hooks/useCustomerData';
import { useAuth } from '@/lib/AuthContext';
import { getDiscrepancySummary, getDiscrepancyMessage } from '@/lib/lootit-reconciliation';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import ServiceCard from './ServiceCard';
import Pax8SubscriptionCard from './Pax8SubscriptionCard';
import ReconciliationBadge from './ReconciliationBadge';
import RecurringTab from './RecurringTab';
import CustomerDetailHeader from './CustomerDetailHeader';
import ContractTab from './ContractTab';
import ContractCard from './ContractCard';
import UploadProgressCard from './UploadProgressCard';
import DetailDrawer from './DetailDrawer';
import LineItemPicker from './LineItemPicker';
import RuleEditorDialog from './RuleEditorDialog';
import SignOffButton from './SignOffButton';

export default function LootITCustomerDetail({ customer, onBack, activeTab: activeTabProp = 'reconciliation', onTabChange }) {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('all');
  const [detailItem, setDetailItem] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const [mappingRecon, setMappingRecon] = useState(null); // { ruleId, productName } being mapped

  const [editingRule, setEditingRule] = useState(null); // rule being edited
  const fileInputRef = useRef(null);
  const { user } = useAuth();

  const { reconciliations, isLoading, rules: allRules } = useReconciliationData(customer.id);
  const { reviews, markReviewed, dismiss, resetReview, saveNotes, saveExclusion, isSaving } = useReconciliationReviews(customer.id);

  // Billing anomalies for this customer
  const { data: customerAnomalies = [] } = useQuery({
    queryKey: ['billing_anomalies_customer', customer.id],
    queryFn: () => client.entities.BillingAnomaly.filter({ customer_id: customer.id, status: 'open' }),
    staleTime: 1000 * 60 * 2,
  });

  // Also compute live anomalies from bills
  const { data: customerBills = [] } = useQuery({
    queryKey: ['customer_bills_for_anomaly', customer.id],
    queryFn: () => client.entities.RecurringBill.filter({ customer_id: customer.id }),
    staleTime: 1000 * 60 * 5,
  });

  const liveAnomalies = useMemo(() => {
    if (customerBills.length < 2) return [];
    const byName = {};
    for (const b of customerBills) {
      const name = b.name || 'Unknown';
      if (!byName[name]) byName[name] = [];
      byName[name].push({ amount: parseFloat(b.amount) || 0, date: new Date(b.created_date || b.start_date || 0) });
    }
    const results = [];
    for (const [name, bills] of Object.entries(byName)) {
      const sorted = bills.sort((a, b) => b.date - a.date);
      if (sorted.length < 2) continue;
      const latest = sorted[0];
      const hist = sorted.slice(1, 7);
      if (hist.length === 0) continue;
      const avg = hist.reduce((s, b) => s + b.amount, 0) / hist.length;
      if (avg === 0) continue;
      const pct = ((latest.amount - avg) / avg) * 100;
      if (Math.abs(pct) >= 10) {
        results.push({
          billName: name, latestAmount: latest.amount, avgAmount: avg, pctChange: pct,
          direction: pct > 0 ? 'increase' : 'decrease',
          history: sorted.slice(0, 7).map(b => ({ amount: b.amount, month: b.date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }) })),
          dbId: customerAnomalies.find(a => a.bill_period)?.id || null,
        });
      }
    }
    return results.sort((a, b) => Math.abs(b.pctChange) - Math.abs(a.pctChange));
  }, [customerBills, customerAnomalies]);

  const handleDismissAnomaly = async (anomalyId) => {
    await client.entities.BillingAnomaly.update(anomalyId, { status: 'dismissed', reviewed_at: new Date().toISOString() });
    queryClient.invalidateQueries({ queryKey: ['billing_anomalies_customer', customer.id] });
    toast.success('Anomaly dismissed');
  };

  const handleReviewAnomaly = async (anomalyId) => {
    await client.entities.BillingAnomaly.update(anomalyId, { status: 'reviewed', reviewed_at: new Date().toISOString() });
    queryClient.invalidateQueries({ queryKey: ['billing_anomalies_customer', customer.id] });
    toast.success('Anomaly marked as reviewed');
  };

  // Integration widget data
  const { data: contacts = [] } = useCustomerContacts(customer.id);
  const { data: devices = [] } = useCustomerDevices(customer.id);

  // Fetch all line items for this customer (for the mapping picker)
  const { data: allLineItems = [] } = useQuery({
    queryKey: ['recurring_bill_line_items_customer', customer.id],
    queryFn: async () => {
      const bills = await client.entities.RecurringBill.filter({ customer_id: customer.id });
      if (bills.length === 0) return [];
      const billIds = bills.map((b) => b.id);
      return client.entities.RecurringBillLineItem.filterIn('recurring_bill_id', billIds);
    },
    staleTime: 1000 * 60 * 5,
  });

  // Fetch existing overrides for this customer
  const { data: existingOverrides = [] } = useQuery({
    queryKey: ['pax8_line_item_overrides', customer.id],
    queryFn: () => client.entities.Pax8LineItemOverride.filter({ customer_id: customer.id }),
    staleTime: 1000 * 60 * 2,
  });

  const handleSaveMapping = async (ruleId, productName, lineItemId) => {
    await client.entities.Pax8LineItemOverride.create({
      customer_id: customer.id,
      rule_id: ruleId,
      pax8_product_name: productName || null,
      line_item_id: lineItemId,
    });
    await queryClient.invalidateQueries({ queryKey: ['pax8_line_item_overrides', customer.id] });
    await queryClient.invalidateQueries({ queryKey: ['pax8_line_item_overrides_all'] });
    setMappingRecon(null);
  };

  const handleSaveRule = async (ruleId, updates) => {
    await client.entities.ReconciliationRule.update(ruleId, updates);
    await queryClient.invalidateQueries({ queryKey: ['reconciliation_rules'] });
    setEditingRule(null);
  };

  const handleRemoveMapping = async (ruleId) => {
    const toRemove = existingOverrides.filter((o) => o.rule_id === ruleId);
    for (const ov of toRemove) {
      await client.entities.Pax8LineItemOverride.delete(ov.id);
    }
    await queryClient.invalidateQueries({ queryKey: ['pax8_line_item_overrides', customer.id] });
    await queryClient.invalidateQueries({ queryKey: ['pax8_line_item_overrides_all'] });
  };

  // ── Contracts ──
  const { data: contracts = [] } = useQuery({
    queryKey: ['lootit_contracts', customer.id],
    queryFn: () => client.entities.LootITContract.filter({ customer_id: customer.id }, '-created_date'),
    staleTime: 1000 * 60 * 2,
  });

  const [extractingId, setExtractingId] = useState(null);

  const uploadMutation = useMutation({
    mutationFn: async (file) => {
      const ext = file.name.split('.').pop();
      const path = `${customer.id}/${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from('lootit-contracts')
        .upload(path, file, { upsert: false });
      if (uploadErr) throw uploadErr;

      const contract = await client.entities.LootITContract.create({
        customer_id: customer.id,
        file_name: file.name,
        file_url: path,
        file_size: file.size,
        uploaded_by: user?.id || null,
        extraction_status: 'pending',
      });

      // Trigger LLM extraction in background for PDFs
      if (ext.toLowerCase() === 'pdf') {
        extractContractData(contract);
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['lootit_contracts', customer.id] }),
  });

  const extractContractData = async (contract) => {
    setExtractingId(contract.id);
    try {
      // Get a signed URL (bucket is private) so the server can download the PDF
      const { data: signedData, error: signError } = await supabase.storage
        .from('lootit-contracts')
        .createSignedUrl(contract.file_url, 300); // 5 min expiry
      if (signError || !signedData?.signedUrl) throw new Error('Could not create signed URL');

      const result = await client.integrations.Core.InvokeLLM({
        prompt: `Extract all contract data from this MSSP/IT services agreement PDF. Focus on the pricing addendum/table.`,
        file_urls: [signedData.signedUrl],
        response_json_schema: {
          type: "object",
          properties: {
            client_name: { type: "string", description: "Client/customer company name" },
            provider_name: { type: "string", description: "MSP/consultant company name" },
            agreement_date: { type: "string", description: "Date of agreement (YYYY-MM-DD)" },
            term_months: { type: "number", description: "Contract term in months" },
            monthly_total: { type: "number", description: "Total monthly fee" },
            setup_total: { type: "number", description: "Total one-time setup fee" },
            hourly_rate: { type: "number", description: "On-site hourly rate" },
            trip_charge: { type: "number", description: "Trip charge per visit" },
            line_items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  product: { type: "string", description: "Product/service name" },
                  unit: { type: "string", description: "Per what (Endpoint, User, Server, Domain, etc.)" },
                  quantity: { type: "number", description: "Quantity" },
                  unit_price: { type: "number", description: "Price per unit per month" },
                  monthly_total: { type: "number", description: "Line total per month (qty × price)" },
                  setup_price: { type: "number", description: "One-time setup fee per unit (0 if none)" },
                  setup_total: { type: "number", description: "Setup total (qty × setup_price)" },
                }
              }
            },
            auto_renewal: { type: "boolean", description: "Whether contract auto-renews" },
            cancellation_notice_days: { type: "number", description: "Days notice required for cancellation" },
            notes: { type: "string", description: "Any important notes or special terms" },
          }
        }
      });

      if (result) {
        await client.entities.LootITContract.update(contract.id, {
          extracted_data: result,
          extraction_status: 'complete',
        });
        toast.success('Contract data extracted successfully');
      } else {
        await client.entities.LootITContract.update(contract.id, {
          extraction_status: 'failed',
        });
        toast.error('Could not extract contract data');
      }
    } catch (err) {
      console.error('[LootIT] Contract extraction failed:', err);
      await client.entities.LootITContract.update(contract.id, {
        extraction_status: 'failed',
      });
      toast.error('Contract extraction failed');
    } finally {
      setExtractingId(null);
      queryClient.invalidateQueries({ queryKey: ['lootit_contracts', customer.id] });
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) uploadMutation.mutate(file);
    e.target.value = '';
  };

  const handleDownloadContract = async (contract) => {
    const { data, error } = await supabase.storage
      .from('lootit-contracts')
      .download(contract.file_url);
    if (error) return;
    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = contract.file_name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDeleteContract = async (contract) => {
    await supabase.storage.from('lootit-contracts').remove([contract.file_url]);
    await client.entities.LootITContract.delete(contract.id);
    await queryClient.invalidateQueries({ queryKey: ['lootit_contracts', customer.id] });
  };

  const handleSync = async () => {
    if (!customer.external_id) {
      toast.error('Cannot sync: customer has no HaloPSA ID');
      return;
    }
    setIsSyncing(true);
    try {
      // Step 1: Sync customer + contacts from HaloPSA
      try {
        await client.halo.syncCustomer(customer.external_id);
      } catch (err) {
        toast.error(`Customer sync failed: ${err.message}`);
      }

      // Step 2: Sync recurring bills + line items
      try {
        await client.functions.invoke('syncHaloPSARecurringBills', {
          action: 'sync_customer',
          customer_id: customer.external_id,
        });
      } catch (err) {
        toast.error(`Recurring bill sync failed: ${err.message}`);
      }

      // Step 3: Sync all vendor integrations in parallel
      const vendorSyncs = [
        { fn: 'syncDattoRMMDevices', action: 'sync_devices', label: 'Datto RMM' },
        { fn: 'syncDattoEDR', action: 'sync_alerts', label: 'Datto EDR' },
        { fn: 'syncJumpCloudLicenses', action: 'sync_licenses', label: 'JumpCloud' },
        { fn: 'syncSpanningBackup', action: 'sync_licenses', label: 'Spanning' },
        { fn: 'syncCoveData', action: 'sync_devices', label: 'Cove' },
        { fn: 'syncRocketCyber', action: 'sync_agents', label: 'RocketCyber' },
        { fn: 'syncUniFiDevices', action: 'sync_devices', label: 'UniFi' },
        { fn: 'syncPax8Subscriptions', action: 'sync_subscriptions', label: 'Pax8' },
      ];
      const syncResults = await Promise.allSettled(
        vendorSyncs.map((v) =>
          client.functions.invoke(v.fn, { action: v.action, customer_id: customer.id }).catch(() => null)
        )
      );
      const failed = syncResults.filter((r, i) => r.status === 'rejected').length;
      if (failed > 0) toast.error(`${failed} vendor sync(s) had issues`);

      // Step 4: Invalidate ALL caches to pull fresh data
      await queryClient.invalidateQueries({ queryKey: ['reconciliation_rules'] });
      await queryClient.invalidateQueries({ queryKey: ['recurring_bills'] });
      await queryClient.invalidateQueries({ queryKey: ['recurring_bill_line_items'] });
      await queryClient.invalidateQueries({ queryKey: ['recurring_bill_line_items_customer', customer.id] });
      await queryClient.invalidateQueries({ queryKey: ['reconciliation_reviews', customer.id] });
      await queryClient.invalidateQueries({ queryKey: ['lootit_contracts', customer.id] });
      await queryClient.invalidateQueries({ queryKey: ['customer_contacts', customer.id] });
      await queryClient.invalidateQueries({ queryKey: ['customer_devices', customer.id] });
      // Invalidate all vendor mapping queries for device count refresh
      await queryClient.invalidateQueries({
        predicate: (q) => String(q.queryKey[0]).startsWith('lootit_entity_'),
      });

      toast.success(`All data synced for ${customer.name}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const customerData = reconciliations[customer.id];
  const recons = customerData?.reconciliations || [];
  const pax8Recons = customerData?.pax8Reconciliations || [];

  // Combine rule-based + Pax8 for unified summary
  const allRecons = useMemo(() => [...recons, ...pax8Recons], [recons, pax8Recons]);
  const summary = customerData ? getDiscrepancySummary(allRecons) : null;

  const filteredRecons = useMemo(() => {
    const visible = recons.filter((r) => r.status !== 'no_data');
    if (statusFilter === 'all') return visible;
    if (statusFilter === 'issues') return visible.filter((r) => r.status === 'over' || r.status === 'under');
    if (statusFilter === 'matched') return visible.filter((r) => r.status === 'match');
    if (statusFilter === 'reviewed') return visible.filter((r) => r.review?.status === 'reviewed' || r.review?.status === 'dismissed');
    return visible;
  }, [recons, statusFilter]);

  const filteredPax8 = useMemo(() => {
    if (statusFilter === 'all') return pax8Recons;
    if (statusFilter === 'issues') return pax8Recons.filter((r) => r.status === 'over' || r.status === 'under' || r.status === 'missing_from_psa');
    if (statusFilter === 'matched') return pax8Recons.filter((r) => r.status === 'match');
    if (statusFilter === 'reviewed') return pax8Recons.filter((r) => r.review?.status === 'reviewed' || r.review?.status === 'dismissed');
    return pax8Recons;
  }, [pax8Recons, statusFilter]);

  const handleReview = async (ruleId, { notes } = {}) => {
    const recon = recons.find((r) => r.rule.id === ruleId);
    const pax8 = pax8Recons.find((r) => r.ruleId === ruleId);
    const existing = reviews.find((r) => r.rule_id === ruleId);
    await markReviewed(ruleId, {
      notes: notes ?? existing?.notes ?? null,
      psaQty: recon?.psaQty ?? pax8?.psaQty,
      vendorQty: recon?.vendorQty ?? pax8?.vendorQty,
    });
  };

  const handleDismiss = async (ruleId, { notes } = {}) => {
    const recon = recons.find((r) => r.rule.id === ruleId);
    const pax8 = pax8Recons.find((r) => r.ruleId === ruleId);
    const existing = reviews.find((r) => r.rule_id === ruleId);
    await dismiss(ruleId, {
      notes: notes ?? existing?.notes ?? null,
      psaQty: recon?.psaQty ?? pax8?.psaQty,
      vendorQty: recon?.vendorQty ?? pax8?.vendorQty,
    });
  };

  const activeTab = activeTabProp;
  const setActiveTab = (tab) => onTabChange ? onTabChange(tab) : null;
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadMutation.mutate(file);
  }, [uploadMutation]);

  // Compute dollar impact from reconciliation data
  const dollarImpact = useMemo(() => {
    if (!allRecons.length) return null;
    let underBilledAmount = 0;
    let overBilledAmount = 0;
    let totalMonthlyBilled = 0;
    for (const r of allRecons) {
      const price = r.price || 0;
      const diff = r.difference || 0;
      if (r.status === 'under' || r.status === 'missing_from_psa') {
        underBilledAmount += Math.abs(diff) * price;
      } else if (r.status === 'over') {
        overBilledAmount += Math.abs(diff) * price;
      }
      if (r.psaQty && price) {
        totalMonthlyBilled += r.psaQty * price;
      }
    }
    return { underBilledAmount, overBilledAmount, totalMonthlyBilled };
  }, [allRecons]);

  // Count integrations involved
  const activeIntegrations = useMemo(() => {
    const keys = new Set();
    for (const r of recons) {
      if (r.rule?.integration_key) keys.add(r.rule.integration_key);
    }
    if (pax8Recons.length > 0) keys.add('pax8');
    return keys.size;
  }, [recons, pax8Recons]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-pink-200 border-t-pink-500 rounded-full animate-spin" />
      </div>
    );
  }

  const issueCount = summary ? summary.over + summary.under : 0;
  const activeRules = summary ? summary.total - (summary.noData || 0) - (summary.noPsa || 0) : 0;
  // Health = only fully matched items count. Reviewed/dismissed are acknowledged but not resolved.
  // Denominator excludes no_data and no_psa (rules without both sides of data).
  const healthPct = activeRules > 0 ? Math.min(100, Math.round((summary.matched / activeRules) * 100)) : 0;

  return (
    <div className="space-y-5 relative">
      {/* Pink ambient glow */}
      <div className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-pink-400/10 rounded-full blur-[100px]" />

      {/* ── Header Card ── */}
      <div className="relative bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Health bar */}
        <div className="h-1.5 bg-slate-100">
          <div
            className={cn(
              'h-full transition-all duration-700 rounded-r-full',
              healthPct >= 80 ? 'bg-emerald-500' : healthPct >= 50 ? 'bg-orange-500' : 'bg-red-500'
            )}
            style={{ width: `${healthPct}%` }}
          />
        </div>

        <div className="p-5">
          {/* Row 1: Back + name + health + sync */}
          <div className="flex items-center gap-3 mb-5">
            <button
              onClick={onBack}
              className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center hover:bg-slate-100 transition-colors flex-shrink-0"
            >
              <ArrowLeft className="w-4 h-4 text-slate-500" />
            </button>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-slate-900 truncate leading-tight">
                {customer.name}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {activeIntegrations} integration{activeIntegrations !== 1 ? 's' : ''} · {summary?.total || 0} rules tracked
              </p>
            </div>
            <div className={cn(
              'px-3 py-1.5 rounded-lg text-sm font-bold',
              healthPct >= 80 ? 'bg-emerald-50 text-emerald-600' : healthPct >= 50 ? 'bg-orange-50 text-orange-600' : 'bg-red-50 text-red-600'
            )}>
              {healthPct}%
            </div>
            <SignOffButton
              customer={customer}
              reconciliations={recons}
              pax8Reconciliations={pax8Recons}
              unmatchedItems={allRecons.filter(r => r.isUnmatchedLineItem)}
            />
            <button
              onClick={handleSync}
              disabled={isSyncing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-pink-500 text-white hover:bg-pink-600 shadow-sm shadow-pink-200 transition-all disabled:opacity-50"
            >
              <RefreshCw className={cn('w-3.5 h-3.5', isSyncing && 'animate-spin')} />
              {isSyncing ? 'Syncing…' : 'Sync'}
            </button>
          </div>

          {/* Row 2: Integration widgets — data from actual integrations */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-4">
            {[
              { icon: Users, value: contacts.length, label: 'Users', color: 'text-blue-600', bg: 'bg-blue-50' },
              { icon: Monitor, value: devices.filter(d => d.device_type !== 'Server' && d.device_type !== 'server').length, label: 'Workstations', color: 'text-indigo-600', bg: 'bg-indigo-50' },
              { icon: Server, value: devices.filter(d => d.device_type === 'Server' || d.device_type === 'server').length, label: 'Servers', color: 'text-purple-600', bg: 'bg-purple-50' },
              { icon: Hash, value: summary?.total || 0, label: 'Services', color: 'text-slate-600', bg: 'bg-slate-50' },
              { icon: FileText, value: contracts.length, label: 'Contracts', color: 'text-pink-600', bg: 'bg-pink-50' },
              { icon: DollarSign, value: dollarImpact?.totalMonthlyBilled ? `$${Math.round(dollarImpact.totalMonthlyBilled).toLocaleString()}` : '$0', label: 'Monthly', color: 'text-emerald-600', bg: 'bg-emerald-50' },
            ].map((w) => (
              <div key={w.label} className={cn('rounded-xl px-3 py-2 border border-transparent', w.bg)}>
                <div className="flex items-center gap-1.5 mb-0.5">
                  <w.icon className={cn('w-3.5 h-3.5', w.color)} />
                  <span className={cn('text-lg font-bold leading-none', w.color)}>{w.value}</span>
                </div>
                <p className="text-[10px] text-slate-400 font-medium">{w.label}</p>
              </div>
            ))}
          </div>

          {/* Row 3: Reconciliation summary — colored boxes */}
          {summary && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="bg-emerald-50 rounded-xl border border-emerald-200 px-3 py-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold text-emerald-600">{summary.matched}</span>
                  <Check className="w-4 h-4 text-emerald-400" />
                </div>
                <p className="text-[10px] text-emerald-500 font-medium uppercase tracking-wide mt-0.5">Matched</p>
              </div>
              <div className={cn('rounded-xl border px-3 py-2.5', issueCount > 0 ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200')}>
                <div className="flex items-center justify-between">
                  <span className={cn('text-2xl font-bold', issueCount > 0 ? 'text-red-600' : 'text-slate-400')}>{issueCount}</span>
                  <AlertTriangle className={cn('w-4 h-4', issueCount > 0 ? 'text-red-400' : 'text-slate-300')} />
                </div>
                <p className={cn('text-[10px] font-medium uppercase tracking-wide mt-0.5', issueCount > 0 ? 'text-red-500' : 'text-slate-400')}>Issues</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 px-3 py-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold text-slate-600">{summary.reviewed}</span>
                  <CheckCircle2 className="w-4 h-4 text-slate-300" />
                </div>
                <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide mt-0.5">Reviewed</p>
              </div>
              {dollarImpact && dollarImpact.underBilledAmount > 0 && (
                <div className="bg-red-50 rounded-xl border border-red-200 px-3 py-2.5">
                  <span className="text-lg font-bold text-red-600 leading-tight">
                    ${dollarImpact.underBilledAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                  <p className="text-[10px] text-red-500 font-medium uppercase tracking-wide mt-0.5">Under-billed</p>
                </div>
              )}
              {dollarImpact && dollarImpact.overBilledAmount > 0 && (
                <div className="bg-orange-50 rounded-xl border border-orange-200 px-3 py-2.5">
                  <span className="text-lg font-bold text-orange-600 leading-tight">
                    ${dollarImpact.overBilledAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                  <p className="text-[10px] text-orange-500 font-medium uppercase tracking-wide mt-0.5">Over-billed</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Billing Anomalies */}
      {liveAnomalies.length > 0 && (
        <div className="bg-white rounded-xl border border-red-200/60 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Bell className="w-4 h-4 text-red-500" />
            <h3 className="text-sm font-bold text-slate-900">Billing Anomalies</h3>
            <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-semibold">{liveAnomalies.length}</span>
          </div>
          <div className="space-y-3">
            {liveAnomalies.map((a, idx) => (
              <div key={idx} className={cn(
                'rounded-lg border p-3',
                a.direction === 'decrease' ? 'bg-red-50/60 border-red-200' : 'bg-amber-50/60 border-amber-200'
              )}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {a.direction === 'decrease' ? <TrendingDown className="w-4 h-4 text-red-500" /> : <TrendingUp className="w-4 h-4 text-amber-500" />}
                    <span className="text-sm font-bold text-slate-900">{a.billName}</span>
                    <span className={cn('text-sm font-bold tabular-nums', a.direction === 'decrease' ? 'text-red-600' : 'text-amber-600')}>
                      {a.pctChange > 0 ? '+' : ''}{a.pctChange.toFixed(0)}%
                    </span>
                  </div>
                  <div className="flex gap-1.5">
                    {a.dbId && (
                      <>
                        <button onClick={() => handleReviewAnomaly(a.dbId)} className="px-2 py-1 text-[10px] font-medium rounded bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors">Reviewed</button>
                        <button onClick={() => handleDismissAnomaly(a.dbId)} className="px-2 py-1 text-[10px] font-medium rounded bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors">Dismiss</button>
                      </>
                    )}
                  </div>
                </div>
                {/* Explanation */}
                <p className="text-xs text-slate-500 mb-2">
                  Previous average was <strong className="text-slate-700">${Math.round(a.avgAmount).toLocaleString()}/mo</strong>, latest invoice is <strong className={a.direction === 'decrease' ? 'text-red-600' : 'text-amber-600'}>${Math.round(a.latestAmount).toLocaleString()}/mo</strong>.
                  {a.direction === 'decrease' ? ' Potential lost revenue.' : ' Billing increase detected.'}
                </p>
                {/* Mini history bar chart */}
                <div className="flex items-end gap-1 h-10">
                  {(a.history || []).slice().reverse().map((h, i, arr) => {
                    const max = Math.max(...arr.map(x => x.amount || 1));
                    const pct = (h.amount / max) * 100;
                    const isLatest = i === arr.length - 1;
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                        <div
                          className={cn('w-full rounded-t-sm min-h-[2px]', isLatest ? (a.direction === 'decrease' ? 'bg-red-400' : 'bg-amber-400') : 'bg-slate-200')}
                          style={{ height: `${Math.max(pct, 5)}%` }}
                        />
                        <span className="text-[7px] text-slate-400">{h.month}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex justify-center border-b border-pink-100">
        {[
          { key: 'reconciliation', label: 'Reconciliation', icon: RotateCcw },
          { key: 'recurring', label: 'Recurring', icon: Repeat2, badge: allLineItems.length || null },
          { key: 'contract', label: 'Contract', icon: FileText, badge: contracts.length || null },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium transition-colors relative',
              activeTab === tab.key
                ? 'text-pink-600'
                : 'text-slate-400 hover:text-slate-600'
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {tab.badge && (
              <span className={cn(
                'text-[10px] px-1.5 py-0.5 rounded-full font-semibold',
                activeTab === tab.key ? 'bg-pink-100 text-pink-600' : 'bg-slate-100 text-slate-400'
              )}>{tab.badge}</span>
            )}
            {activeTab === tab.key && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-pink-500 rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* ── Recurring Tab ── */}
      {activeTab === 'recurring' && (
        <RecurringTab lineItems={allLineItems} rules={allRules || []} overrides={existingOverrides} />
      )}

      {/* ── Contract Tab ── */}
      {activeTab === 'contract' && (
        <div className="space-y-5">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
            onChange={handleFileUpload}
            className="hidden"
          />

          {/* Upload / Analyzing State */}
          {(uploadMutation.isPending || extractingId) ? (
            <UploadProgressCard
              isUploading={uploadMutation.isPending}
              isExtracting={!!extractingId}
            />
          ) : (
            /* Drag & Drop Upload Zone */
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                'relative cursor-pointer rounded-2xl border-2 border-dashed transition-all duration-300 group',
                isDragging
                  ? 'border-pink-400 bg-pink-50/80 scale-[1.01]'
                  : 'border-slate-200 bg-white hover:border-pink-300 hover:bg-pink-50/30'
              )}
            >
              <div className="flex flex-col items-center justify-center py-8 px-6">
                <div className={cn(
                  'w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-all duration-300',
                  isDragging
                    ? 'bg-pink-500 shadow-lg shadow-pink-200'
                    : 'bg-gradient-to-br from-pink-100 to-rose-100 group-hover:from-pink-200 group-hover:to-rose-200'
                )}>
                  <CloudUpload className={cn(
                    'w-7 h-7 transition-all duration-300',
                    isDragging ? 'text-white scale-110' : 'text-pink-500'
                  )} />
                </div>
                <p className="text-sm font-semibold text-slate-700 mb-1">
                  {isDragging ? 'Drop your contract here' : 'Upload MSSP Contract'}
                </p>
                <p className="text-xs text-slate-400 text-center max-w-xs">
                  Drag & drop a PDF or <span className="text-pink-500 font-medium">browse files</span> — we'll automatically extract pricing and line items
                </p>
                <div className="flex items-center gap-3 mt-4">
                  {['PDF', 'DOC', 'XLSX'].map((ext) => (
                    <span key={ext} className="text-[10px] font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                      .{ext}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Existing contracts list */}
          {contracts.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Uploaded Contracts ({contracts.length})
              </h4>
              {contracts.map((c) => (
                <ContractCard
                  key={c.id}
                  contract={c}
                  extractingId={extractingId}
                  onDownload={handleDownloadContract}
                  onDelete={handleDeleteContract}
                  onRetryExtract={extractContractData}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Reconciliation Tab ── */}
      {activeTab === 'reconciliation' && (
        <>
      {/* Filter + context bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1.5">
          {[
            { key: 'all', label: 'All', count: allRecons.filter(r => r.status !== 'no_data').length },
            { key: 'issues', label: 'Issues', count: issueCount },
            { key: 'matched', label: 'Matched', count: summary?.matched || 0 },
            { key: 'reviewed', label: 'Reviewed', count: summary?.reviewed || 0 },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
                statusFilter === f.key
                  ? 'bg-pink-500 text-white shadow-sm shadow-pink-200'
                  : 'bg-white text-slate-500 border border-slate-200 hover:bg-pink-50'
              )}
            >
              {f.label}
              <span className={cn(
                'text-[10px] px-1.5 py-0.5 rounded-full',
                statusFilter === f.key ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-400'
              )}>
                {f.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Service Cards */}
      {filteredRecons.length === 0 && filteredPax8.length === 0 ? (
        <div className="text-center py-12">
          <Filter className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">
            {statusFilter === 'all'
              ? 'No reconciliation data for this customer'
              : 'No services match this filter'}
          </p>
        </div>
      ) : filteredRecons.length === 0 ? null : (
        <div className="grid grid-cols-4 gap-3">
          {filteredRecons.map((recon) => (
            <ServiceCard
              key={recon.rule.id}
              reconciliation={recon}
              onReview={handleReview}
              onDismiss={handleDismiss}
              onReset={resetReview}
              onDetails={setDetailItem}
              onEditRule={setEditingRule}
              onSaveNotes={(ruleId, notes) => saveNotes(ruleId, notes)}
              onMapLineItem={(ruleId, label) => setMappingRecon({ ruleId, productName: label })}
              onRemoveMapping={(ruleId) => handleRemoveMapping(ruleId)}
              hasOverride={existingOverrides.some((o) => o.rule_id === recon.rule.id)}
              isSaving={isSaving}
            />
          ))}
        </div>
      )}

      {/* Pax8 / M365 Per-Subscription Reconciliation */}
      {filteredPax8.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-700">
            Pax8 / M365 Licence Reconciliation
          </h3>
          <div className="grid grid-cols-4 gap-3">
            {filteredPax8.map((recon) => (
              <Pax8SubscriptionCard
                key={recon.ruleId}
                recon={recon}
                onReview={handleReview}
                onDismiss={handleDismiss}
                onReset={resetReview}
                onDetails={setDetailItem}
                onMapLineItem={() => setMappingRecon(recon)}
                onRemoveMapping={() => handleRemoveMapping(recon.ruleId)}
                onSaveNotes={(ruleId, notes) => saveNotes(ruleId, notes)}
                hasOverride={existingOverrides.some((o) => o.rule_id === recon.ruleId)}
                isSaving={isSaving}
              />
            ))}
          </div>
        </div>
      )}

      </>
      )}

      {/* Details Drawer */}
      <Sheet open={!!detailItem} onOpenChange={(open) => { if (!open) setDetailItem(null); }}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto p-0">
          {detailItem && (
            <DetailDrawer
              reconciliation={detailItem}
              customerId={customer.id}
              onSaveExclusion={async (ruleId, exclusionCount, exclusionReason) => {
                await saveExclusion(ruleId, exclusionCount, exclusionReason);
                const updatedReviews = queryClient.getQueryData(['reconciliation_reviews', customer.id]);
                const updatedReview = updatedReviews?.find((r) => r.rule_id === ruleId);
                if (updatedReview) {
                  setDetailItem((prev) => prev ? { ...prev, review: updatedReview } : prev);
                }
              }}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* Rule Editor Dialog */}
      {editingRule && (
        <RuleEditorDialog
          rule={editingRule}
          onSave={handleSaveRule}
          onClose={() => setEditingRule(null)}
        />
      )}

      {/* Line Item Mapping Picker */}
      {mappingRecon && (
        <LineItemPicker
          productName={mappingRecon.productName}
          lineItems={allLineItems}
          onSelect={(lineItemId) => handleSaveMapping(mappingRecon.ruleId, mappingRecon.productName, lineItemId)}
          onClose={() => setMappingRecon(null)}
        />
      )}
    </div>
  );
}


