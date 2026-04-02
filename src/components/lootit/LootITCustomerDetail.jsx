import React, { useState, useMemo, useRef, useCallback } from 'react';
import { ArrowLeft, Filter, Check, RotateCcw, RefreshCw, AlertTriangle, Save, Upload, FileText, Download, DollarSign, Users, Hash, CloudUpload, CheckCircle2, Monitor, Server, Repeat2, Bell, X, Link2 } from 'lucide-react';
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
import Pax8GroupMapper from './Pax8GroupMapper';
import SignOffButton from './SignOffButton';

const CATEGORY_BADGES = {
  monthly_recurring: { label: 'Recurring', className: 'bg-blue-100 text-blue-700' },
  voip: { label: 'VoIP', className: 'bg-purple-100 text-purple-700' },
  ticket_adhoc: { label: 'Ad-hoc', className: 'bg-amber-100 text-amber-700' },
  hardware_project: { label: 'Hardware', className: 'bg-slate-100 text-slate-600' },
  uncategorized: { label: 'Unclassified', className: 'bg-red-50 text-red-500 border border-red-200' },
};

export default function LootITCustomerDetail({ customer, onBack, activeTab: activeTabProp = 'reconciliation', onTabChange }) {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('all');
  const [detailItem, setDetailItem] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const [mappingRecon, setMappingRecon] = useState(null); // { ruleId, productName } being mapped
  const [showGroupMapper, setShowGroupMapper] = useState(false);

  const [editingRule, setEditingRule] = useState(null); // rule being edited
  const fileInputRef = useRef(null);
  const { user } = useAuth();

  const { reconciliations, isLoading, rules: allRules } = useReconciliationData(customer.id);
  const { reviews, markReviewed, dismiss, resetReview, saveNotes, saveExclusion, isSaving } = useReconciliationReviews(customer.id);

  // Billing anomalies for this customer (from the DB scanner, grouped by category)
  const { data: customerAnomalies = [] } = useQuery({
    queryKey: ['billing_anomalies_customer', customer.id],
    queryFn: () => client.entities.BillingAnomaly.filter({
      customer_id: customer.id,
      flagged_on_customer: true,
    }),
    staleTime: 1000 * 60 * 2,
  });

  const openAnomalies = useMemo(
    () => customerAnomalies.filter(a => a.status === 'open'),
    [customerAnomalies]
  );

  const resolvedAnomalies = useMemo(
    () => customerAnomalies
      .filter(a => a.status === 'acknowledged' || a.status === 'dismissed')
      .sort((a, b) => (b.acknowledged_at || b.reviewed_at || '').localeCompare(a.acknowledged_at || a.reviewed_at || '')),
    [customerAnomalies]
  );

  const [showHistory, setShowHistory] = useState(false);

  // Invoices for this customer (with AI category + confidence from classifier)
  const { data: customerInvoices = [] } = useQuery({
    queryKey: ['lootit_invoices_customer', customer.id],
    queryFn: () => client.entities.Invoice.filter({ customer_id: customer.id }),
    staleTime: 1000 * 60 * 2,
  });

  // Detect yearly invoice amounts: if an amount appears in <= 2 months out of 12, it's yearly
  const yearlyAmounts = useMemo(() => {
    if (!customerInvoices || customerInvoices.length === 0) return new Set();
    // Count how many distinct months each unique amount appears in
    const amountMonths = {};
    for (const inv of customerInvoices) {
      const amt = (parseFloat(inv.total) || 0).toFixed(2);
      if (parseFloat(amt) <= 0) continue;
      const date = new Date(inv.due_date || inv.invoice_date || inv.created_date || 0);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!amountMonths[amt]) amountMonths[amt] = new Set();
      amountMonths[amt].add(monthKey);
    }
    // Also check billing_frequency field if populated
    const yearly = new Set();
    for (const inv of customerInvoices) {
      if ((inv.billing_frequency || '').toLowerCase() === 'yearly') {
        yearly.add((parseFloat(inv.total) || 0).toFixed(2));
      }
    }
    // If an amount appears in <= 2 months but other amounts appear in 4+, it's likely yearly
    const maxMonths = Math.max(...Object.values(amountMonths).map(s => s.size), 0);
    if (maxMonths >= 4) {
      for (const [amt, months] of Object.entries(amountMonths)) {
        if (months.size <= 2) yearly.add(amt);
      }
    }
    return yearly;
  }, [customerInvoices]);

  // Build monthly history per category from invoices for anomaly visualization
  const anomalyHistory = useMemo(() => {
    if (!customerInvoices || customerInvoices.length === 0) return {};
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const byCategory = {};

    for (const inv of customerInvoices) {
      if (!inv.category || (parseFloat(inv.total) || 0) <= 0) continue;
      // Skip yearly items — detected by frequency field OR by appearance pattern
      const amt = (parseFloat(inv.total) || 0).toFixed(2);
      if (yearlyAmounts.has(amt)) continue;
      const date = new Date(inv.due_date || inv.invoice_date || inv.created_date || 0);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (monthKey === currentMonth) continue;
      if (!byCategory[inv.category]) byCategory[inv.category] = {};
      if (!byCategory[inv.category][monthKey]) byCategory[inv.category][monthKey] = 0;
      byCategory[inv.category][monthKey] += parseFloat(inv.total) || 0;
    }

    const result = {};
    for (const [cat, months] of Object.entries(byCategory)) {
      result[cat] = Object.entries(months)
        .map(([month, amount]) => ({ month, amount: Math.round(amount * 100) / 100 }))
        .sort((a, b) => b.month.localeCompare(a.month))
        .slice(0, 7);
    }
    return result;
  }, [customerInvoices, yearlyAmounts]);

  const [acknowledgeId, setAcknowledgeId] = useState(null);
  const [acknowledgeNotes, setAcknowledgeNotes] = useState('');

  const handleAcknowledgeAnomaly = async (anomalyId) => {
    if (!acknowledgeNotes.trim()) {
      toast.error('Please add notes explaining why this change is expected');
      return;
    }
    try {
      await client.entities.BillingAnomaly.update(anomalyId, {
        status: 'acknowledged',
        acknowledged_at: new Date().toISOString(),
        acknowledgement_notes: `[${user?.full_name || user?.email || 'Unknown'} — ${new Date().toLocaleString()}] ${acknowledgeNotes.trim()}`,
      });
      queryClient.invalidateQueries({ queryKey: ['billing_anomalies_customer', customer.id] });
      setAcknowledgeId(null);
      setAcknowledgeNotes('');
      toast.success('Anomaly acknowledged');
    } catch (err) {
      console.error('[Anomaly] Acknowledge failed:', err);
      toast.error(err.message || 'Failed to acknowledge anomaly');
    }
  };

  const handleDismissAnomaly = async (anomalyId) => {
    await client.entities.BillingAnomaly.update(anomalyId, {
      status: 'dismissed',
      reviewed_at: new Date().toISOString(),
    });
    queryClient.invalidateQueries({ queryKey: ['billing_anomalies_customer', customer.id] });
    toast.success('Anomaly dismissed');
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

  const handleSaveGroupMapping = async (lineItemId, ruleIds) => {
    const groupId = crypto.randomUUID();
    for (const ruleId of ruleIds) {
      const existing = existingOverrides.filter(o => o.rule_id === ruleId);
      for (const ov of existing) {
        await client.entities.Pax8LineItemOverride.delete(ov.id);
      }
      await client.entities.Pax8LineItemOverride.create({
        customer_id: customer.id,
        rule_id: ruleId,
        line_item_id: lineItemId,
        group_id: groupId,
      });
    }
    await queryClient.invalidateQueries({ queryKey: ['pax8_line_item_overrides', customer.id] });
    await queryClient.invalidateQueries({ queryKey: ['pax8_line_item_overrides_all'] });
    setShowGroupMapper(false);
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
      {(openAnomalies.length > 0 || resolvedAnomalies.length > 0) && (
        <div className="bg-white rounded-xl border border-red-200/60 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-red-500" />
              <h3 className="text-sm font-bold text-slate-900">Billing Anomalies</h3>
              {openAnomalies.length > 0 && (
                <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-semibold">{openAnomalies.length}</span>
              )}
            </div>
            {resolvedAnomalies.length > 0 && (
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="text-[10px] font-medium text-slate-400 hover:text-slate-600 transition-colors flex items-center gap-1"
              >
                {showHistory ? 'Hide' : 'Show'} History ({resolvedAnomalies.length})
              </button>
            )}
          </div>
          <div className="space-y-3">
            {openAnomalies.map((a) => {
              const categoryLabel = {
                monthly_recurring: 'Monthly Recurring',
                voip: 'VoIP',
              }[a.category] || a.category || 'Unknown';

              // Reverse history: oldest first → newest last (left to right)
              const rawHistory = anomalyHistory[a.category] || [];
              const history = [...rawHistory].reverse();

              // Build plain-text summary of the billing pattern
              const buildSummary = () => {
                if (rawHistory.length < 2) return null;
                const newest = rawHistory[0]; // sorted desc, so [0] is newest
                const oldest = rawHistory[rawHistory.length - 1];
                const newestLabel = new Date(newest.month + '-15').toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
                const oldestLabel = new Date(oldest.month + '-15').toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

                // Find where the change happened (first month that differs significantly from previous)
                const sorted = [...rawHistory]; // desc order
                let changeIdx = -1;
                for (let i = 0; i < sorted.length - 1; i++) {
                  const diff = Math.abs(sorted[i].amount - sorted[i + 1].amount);
                  if (diff > sorted[i + 1].amount * 0.05) { changeIdx = i; break; }
                }
                if (changeIdx < 0) return null;
                const changeMonth = new Date(sorted[changeIdx].month + '-15').toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
                const beforeAmount = sorted[changeIdx + 1].amount;
                const afterAmount = sorted[changeIdx].amount;

                if (afterAmount < beforeAmount) {
                  return `Was $${beforeAmount.toLocaleString()}/mo (${oldestLabel} \u2013 ${new Date(sorted[changeIdx + 1].month + '-15').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}). Dropped to $${afterAmount.toLocaleString()} in ${changeMonth}.`;
                }
                return `Was $${beforeAmount.toLocaleString()}/mo. Increased to $${afterAmount.toLocaleString()} in ${changeMonth}.`;
              };
              const summaryText = buildSummary();
              const maxAmount = history.length > 0 ? Math.max(...history.map(h => h.amount)) : 1;

              // Color segments between nodes
              const getSegmentColor = (idx) => {
                if (idx >= history.length - 1) return 'bg-slate-200';
                const curr = history[idx].amount;
                const next = history[idx + 1].amount;
                const diff = ((next - curr) / (curr || 1)) * 100;
                if (Math.abs(diff) < 5) return 'bg-emerald-400';
                return diff < 0 ? 'bg-red-400' : 'bg-amber-400';
              };

              const getNodeColor = (idx) => {
                const isLatest = idx === history.length - 1;
                if (isLatest) return a.direction === 'decrease' ? 'bg-red-500 ring-red-200' : 'bg-amber-500 ring-amber-200';
                if (idx === 0) return 'bg-slate-400 ring-slate-200';
                // Check if this month changed significantly from previous
                const prev = history[idx - 1]?.amount || 0;
                const curr = history[idx].amount;
                const diff = prev > 0 ? ((curr - prev) / prev) * 100 : 0;
                if (Math.abs(diff) >= 5) return diff < 0 ? 'bg-red-400 ring-red-100' : 'bg-amber-400 ring-amber-100';
                return 'bg-emerald-500 ring-emerald-200';
              };

              return (
                <div key={a.id} className="rounded-xl border border-slate-200 bg-white p-5">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'w-8 h-8 rounded-lg flex items-center justify-center',
                        a.direction === 'decrease' ? 'bg-red-100' : 'bg-amber-100'
                      )}>
                        <Bell className={cn('w-4 h-4', a.direction === 'decrease' ? 'text-red-600' : 'text-amber-600')} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-900">{categoryLabel}</span>
                          <span className={cn(
                            'text-sm font-bold',
                            a.direction === 'decrease' ? 'text-red-600' : 'text-amber-600'
                          )}>
                            {a.direction === 'decrease' ? '' : '+'}{a.pct_change}%
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-0.5">
                          <span>Now <strong className="text-slate-600">${a.current_amount?.toLocaleString()}</strong></span>
                          <span>Was <strong className="text-slate-600">${a.previous_avg?.toLocaleString()}</strong></span>
                          <span className={cn('font-semibold', a.direction === 'decrease' ? 'text-red-500' : 'text-amber-500')}>
                            {a.direction === 'decrease' ? '-' : '+'}${Math.abs(a.dollar_change).toLocaleString()}/mo
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Summary */}
                  {summaryText && (
                    <p className="text-[11px] text-slate-500 mb-3 px-1">{summaryText}</p>
                  )}

                  {/* Horizontal Timeline */}
                  {history.length > 0 && (
                    <div className="mb-4 px-2">
                      {/* Amount labels (above timeline) */}
                      <div className="flex items-end mb-1" style={{ paddingLeft: '4px', paddingRight: '4px' }}>
                        {history.map((h, i) => {
                          const isLatest = i === history.length - 1;
                          return (
                            <div key={h.month} className="flex-1 text-center">
                              <span className={cn(
                                'text-[10px] font-bold tabular-nums',
                                isLatest
                                  ? (a.direction === 'decrease' ? 'text-red-600' : 'text-amber-600')
                                  : 'text-slate-500'
                              )}>
                                ${h.amount.toLocaleString()}
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      {/* Timeline track with nodes */}
                      <div className="relative flex items-center" style={{ height: '28px' }}>
                        {history.map((h, i) => {
                          const isLatest = i === history.length - 1;
                          const isFirst = i === 0;
                          return (
                            <div key={h.month} className="flex-1 flex items-center">
                              {/* Segment line (before node, except first) */}
                              {!isFirst && (
                                <div className={cn('flex-1 h-1 rounded-full', getSegmentColor(i - 1))} />
                              )}
                              {/* Node */}
                              <div className={cn(
                                'shrink-0 rounded-full ring-2 z-10',
                                isLatest ? 'w-4 h-4' : 'w-3 h-3',
                                getNodeColor(i)
                              )} />
                              {/* Segment line (after node, except last) */}
                              {!isLatest && (
                                <div className={cn('flex-1 h-1 rounded-full', getSegmentColor(i))} />
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Month labels (below timeline) */}
                      <div className="flex mt-1" style={{ paddingLeft: '4px', paddingRight: '4px' }}>
                        {history.map((h) => {
                          const monthLabel = new Date(h.month + '-15').toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
                          return (
                            <div key={h.month} className="flex-1 text-center">
                              <span className="text-[9px] text-slate-400 font-medium">{monthLabel}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  {acknowledgeId === a.id ? (
                    <div className="space-y-2 pt-3 border-t border-slate-100">
                      <textarea
                        value={acknowledgeNotes}
                        onChange={e => setAcknowledgeNotes(e.target.value)}
                        placeholder="Explain why this change is expected..."
                        className="w-full text-xs border border-slate-200 rounded-lg p-2.5 resize-none focus:outline-none focus:ring-1 focus:ring-blue-400"
                        rows={2}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleAcknowledgeAnomaly(a.id)}
                          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-colors"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => { setAcknowledgeId(null); setAcknowledgeNotes(''); }}
                          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2 pt-3 border-t border-slate-100">
                      <button
                        onClick={() => setAcknowledgeId(a.id)}
                        className="px-4 py-1.5 text-xs font-medium rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors border border-emerald-200"
                      >
                        Acknowledge
                      </button>
                      <button
                        onClick={() => handleDismissAnomaly(a.id)}
                        className="px-4 py-1.5 text-xs font-medium rounded-lg bg-slate-50 text-slate-500 hover:bg-slate-100 transition-colors border border-slate-200"
                      >
                        Dismiss
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* History Log */}
          {showHistory && resolvedAnomalies.length > 0 && (
            <div className="mt-4 pt-3 border-t border-slate-100">
              <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-2">Activity Log</p>
              <div className="space-y-2">
                {resolvedAnomalies.map(a => {
                  const categoryLabel = { monthly_recurring: 'Monthly Recurring', voip: 'VoIP' }[a.category] || a.category || 'Unknown';
                  const ts = a.acknowledged_at || a.reviewed_at;
                  const dateStr = ts ? new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
                  const statusLabel = a.status === 'acknowledged' ? 'Acknowledged' : 'Dismissed';
                  const statusColor = a.status === 'acknowledged' ? 'text-emerald-600 bg-emerald-50' : 'text-slate-500 bg-slate-50';

                  return (
                    <div key={a.id} className="flex items-start gap-3 py-2 px-3 rounded-lg bg-slate-50/80">
                      <div className="shrink-0 mt-0.5">
                        <span className={cn('text-[9px] font-semibold px-1.5 py-0.5 rounded', statusColor)}>{statusLabel}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-medium text-slate-700">{categoryLabel}</span>
                          <span className={cn('font-bold text-[11px]', a.direction === 'decrease' ? 'text-red-500' : 'text-amber-500')}>
                            {a.direction === 'decrease' ? '' : '+'}{a.pct_change}%
                          </span>
                          <span className="text-slate-400">${a.current_amount?.toLocaleString()} (was ${a.previous_avg?.toLocaleString()})</span>
                          <span className="text-slate-300">|</span>
                          <span className="text-slate-400">{a.bill_period}</span>
                        </div>
                        {a.acknowledgement_notes && (
                          <p className="text-[11px] text-slate-500 mt-1">{a.acknowledgement_notes}</p>
                        )}
                        {dateStr && <p className="text-[9px] text-slate-300 mt-0.5">{dateStr}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex justify-center border-b border-pink-100">
        {[
          { key: 'reconciliation', label: 'Reconciliation', icon: RotateCcw },
          { key: 'recurring', label: 'Recurring', icon: Repeat2, badge: allLineItems.length || null },
          { key: 'invoices', label: 'Invoices', icon: DollarSign, badge: customerInvoices.length || null },
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

      {/* ── Invoices Tab ── */}
      {activeTab === 'invoices' && (
        <div className="space-y-3">
          {customerInvoices.length === 0 ? (
            <div className="text-center py-12">
              <DollarSign className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">No invoices found for this customer</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
              {customerInvoices
                .slice()
                .sort((a, b) => new Date(b.invoice_date || 0) - new Date(a.invoice_date || 0))
                .map((inv) => {
                  const categoryName = {
                    monthly_recurring: 'Monthly Recurring',
                    voip: 'VoIP Services',
                    ticket_adhoc: 'Ticket Charges',
                    hardware_project: 'Hardware / Project',
                    uncategorized: inv.invoice_number || 'Unclassified',
                  }[inv.category] || inv.invoice_number || inv.id;

                  const dateStr = inv.invoice_date
                    ? new Date(inv.invoice_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                    : '—';

                  return (
                    <div key={inv.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-slate-800 truncate">
                            {categoryName}
                          </span>
                          {inv.category && CATEGORY_BADGES[inv.category] && (
                            <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium', CATEGORY_BADGES[inv.category].className)}>
                              {CATEGORY_BADGES[inv.category].label}
                            </span>
                          )}
                          <span className="text-[10px] text-slate-400">#{inv.invoice_number || inv.id}</span>
                          {inv.classification_confidence != null && inv.classification_confidence < 70 && (
                            <span className="text-[10px] text-red-400" title={`Confidence: ${inv.classification_confidence}%`}>Low confidence</span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">{dateStr}</p>
                      </div>
                      <div className="text-sm font-semibold text-slate-800 tabular-nums">
                        ${(inv.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
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

          {/* Existing contracts list — shown first */}
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

          {/* Upload / Analyzing State */}
          {(uploadMutation.isPending || extractingId) ? (
            <UploadProgressCard
              isUploading={uploadMutation.isPending}
              isExtracting={!!extractingId}
            />
          ) : (
            /* Compact Upload Zone */
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                'relative cursor-pointer rounded-xl border-2 border-dashed transition-all group',
                isDragging
                  ? 'border-pink-400 bg-pink-50/80'
                  : 'border-slate-200 bg-white hover:border-pink-300 hover:bg-pink-50/30'
              )}
            >
              <div className="flex items-center gap-3 py-3 px-4">
                <div className={cn(
                  'w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
                  isDragging ? 'bg-pink-500' : 'bg-pink-50 group-hover:bg-pink-100'
                )}>
                  <CloudUpload className={cn('w-4 h-4', isDragging ? 'text-white' : 'text-pink-500')} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-700">
                    {isDragging ? 'Drop here' : contracts.length > 0 ? 'Upload Revised Contract' : 'Upload MSSP Contract'}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    PDF, DOC, XLSX — <span className="text-pink-500 font-medium">browse</span> or drag & drop
                  </p>
                </div>
              </div>
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
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700">
              Pax8 / M365 Licence Reconciliation
            </h3>
            <button
              onClick={() => setShowGroupMapper(true)}
              className="text-[10px] font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors"
            >
              <Link2 className="w-3 h-3" />
              Group Map
            </button>
          </div>
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
      {showGroupMapper && (
        <Pax8GroupMapper
          pax8Recons={pax8Recons}
          lineItems={allLineItems}
          existingOverrides={existingOverrides}
          onSave={handleSaveGroupMapping}
          onClose={() => setShowGroupMapper(false)}
        />
      )}
    </div>
  );
}


