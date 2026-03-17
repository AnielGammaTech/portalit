import React, { useState, useMemo, useRef, useCallback } from 'react';
import { ArrowLeft, Filter, Check, X, ChevronRight, RotateCcw, RefreshCw, AlertTriangle, Link2, Search, Trash2, StickyNote, Settings2, Save, Upload, FileText, Download, Loader2, ChevronDown, DollarSign, Calendar, Users, Building2, Hash, CloudUpload, Sparkles, CheckCircle2, Monitor, Shield, Server, Mail, Wifi } from 'lucide-react';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cn, formatLineItemDescription } from '@/lib/utils';
import { client, supabase } from '@/api/client';
import { useReconciliationData } from '@/hooks/useReconciliationData';
import { useReconciliationReviews } from '@/hooks/useReconciliationReviews';
import { useCustomerContacts, useCustomerDevices } from '@/hooks/useCustomerData';
import { useAuth } from '@/lib/AuthContext';
import { getDiscrepancySummary, getDiscrepancyMessage } from '@/lib/lootit-reconciliation';
import ServiceCard from './ServiceCard';
import ReconciliationBadge from './ReconciliationBadge';

export default function LootITCustomerDetail({ customer, onBack }) {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('all');
  const [detailItem, setDetailItem] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const [mappingRecon, setMappingRecon] = useState(null); // { ruleId, productName } being mapped

  const [editingRule, setEditingRule] = useState(null); // rule being edited
  const fileInputRef = useRef(null);
  const { user } = useAuth();

  const { reconciliations, isLoading } = useReconciliationData(customer.id);
  const { markReviewed, dismiss, resetReview, saveNotes, isSaving } = useReconciliationReviews(customer.id);

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
    setIsSyncing(true);
    try {
      await queryClient.invalidateQueries({ queryKey: ['reconciliation_rules'] });
      await queryClient.invalidateQueries({ queryKey: ['recurring_bills'] });
      await queryClient.invalidateQueries({ queryKey: ['recurring_bill_line_items'] });
      await queryClient.invalidateQueries({ queryKey: ['reconciliation_reviews', customer.id] });
      // Invalidate all mapping queries
      await queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).endsWith('_mappings') });
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

  const handleReview = async (ruleId) => {
    const recon = recons.find((r) => r.rule.id === ruleId);
    const pax8 = pax8Recons.find((r) => r.ruleId === ruleId);
    await markReviewed(ruleId, {
      psaQty: recon?.psaQty ?? pax8?.psaQty,
      vendorQty: recon?.vendorQty ?? pax8?.vendorQty,
    });
  };

  const handleDismiss = async (ruleId) => {
    const recon = recons.find((r) => r.rule.id === ruleId);
    const pax8 = pax8Recons.find((r) => r.ruleId === ruleId);
    await dismiss(ruleId, {
      psaQty: recon?.psaQty ?? pax8?.psaQty,
      vendorQty: recon?.vendorQty ?? pax8?.vendorQty,
    });
  };

  const [activeTab, setActiveTab] = useState('reconciliation');
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
  const healthPct = summary && summary.total > 0 ? Math.round((summary.matched / summary.total) * 100) : 0;

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

      {/* Tabs */}
      <div className="flex gap-1 bg-pink-50/60 rounded-xl p-1 shadow-[0_0_20px_-5px_rgba(236,72,153,0.1)]">
        {[
          { key: 'reconciliation', label: 'Reconciliation', icon: RotateCcw },
          { key: 'contract', label: 'Contract', icon: FileText, badge: contracts.length || null },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors',
              activeTab === tab.key
                ? 'bg-white text-pink-600 shadow-sm'
                : 'text-slate-500 hover:text-pink-500'
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {tab.badge && (
              <span className="text-[10px] bg-pink-100 text-pink-600 px-1.5 py-0.5 rounded-full">{tab.badge}</span>
            )}
          </button>
        ))}
      </div>

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
      {filteredRecons.length === 0 ? (
        <div className="text-center py-12">
          <Filter className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">
            {statusFilter === 'all'
              ? 'No reconciliation data for this customer'
              : 'No services match this filter'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
      {detailItem && (
        <DetailDrawer
          reconciliation={detailItem}
          onClose={() => setDetailItem(null)}
        />
      )}

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

function UploadProgressCard({ isUploading, isExtracting }) {
  const steps = [
    { key: 'upload', label: 'Uploading file', icon: CloudUpload },
    { key: 'analyze', label: 'Analyzing document', icon: Sparkles },
    { key: 'done', label: 'Extraction complete', icon: CheckCircle2 },
  ];

  const currentStep = isUploading ? 0 : isExtracting ? 1 : 2;

  return (
    <div className="rounded-2xl border border-pink-200 bg-gradient-to-br from-white via-pink-50/50 to-rose-50/50 overflow-hidden">
      {/* Animated top bar */}
      <div className="h-1 bg-pink-100 overflow-hidden">
        <div className="h-full bg-gradient-to-r from-pink-400 via-rose-400 to-pink-400 animate-[shimmer_2s_ease-in-out_infinite] bg-[length:200%_100%]" />
      </div>

      <div className="px-6 py-8">
        {/* Animated icon */}
        <div className="flex justify-center mb-6">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center shadow-lg shadow-pink-200/50">
              {isUploading ? (
                <CloudUpload className="w-8 h-8 text-white animate-bounce" />
              ) : (
                <Sparkles className="w-8 h-8 text-white animate-pulse" />
              )}
            </div>
            <div className="absolute -inset-2 rounded-3xl border-2 border-pink-200 animate-ping opacity-20" />
          </div>
        </div>

        {/* Title */}
        <p className="text-center text-sm font-semibold text-slate-700 mb-1">
          {isUploading ? 'Uploading your contract…' : 'Analyzing with AI…'}
        </p>
        <p className="text-center text-xs text-slate-400 mb-6">
          {isUploading
            ? 'Securely transferring your document'
            : 'Extracting pricing, line items, and contract terms'}
        </p>

        {/* Progress steps */}
        <div className="flex items-center justify-center gap-3 max-w-sm mx-auto">
          {steps.map((step, idx) => {
            const StepIcon = step.icon;
            const isActive = idx === currentStep;
            const isDone = idx < currentStep;
            return (
              <div key={step.key} className="flex items-center gap-3">
                {idx > 0 && (
                  <div className={cn(
                    'w-8 h-px transition-colors duration-500',
                    isDone ? 'bg-pink-400' : 'bg-slate-200'
                  )} />
                )}
                <div className="flex flex-col items-center gap-1.5">
                  <div className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-500',
                    isDone && 'bg-pink-500 text-white',
                    isActive && 'bg-pink-100 text-pink-600 ring-2 ring-pink-300 ring-offset-1',
                    !isDone && !isActive && 'bg-slate-100 text-slate-300'
                  )}>
                    {isDone ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <StepIcon className={cn('w-4 h-4', isActive && 'animate-pulse')} />
                    )}
                  </div>
                  <span className={cn(
                    'text-[10px] font-medium whitespace-nowrap',
                    isActive ? 'text-pink-600' : isDone ? 'text-slate-500' : 'text-slate-300'
                  )}>
                    {step.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ContractCard({ contract, extractingId, onDownload, onDelete, onRetryExtract }) {
  const isExtracting = extractingId === contract.id;
  const data = contract.extracted_data || {};
  const hasData = contract.extraction_status === 'complete' && Object.keys(data).length > 0;
  const lineItems = data.line_items || [];
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Header row */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors"
        onClick={() => hasData && setCollapsed(!collapsed)}
      >
        <FileText className="w-5 h-5 text-pink-400 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-slate-700 truncate">{contract.file_name}</p>
            {isExtracting && (
              <span className="inline-flex items-center gap-1 text-[10px] text-pink-500 bg-pink-50 px-2 py-0.5 rounded-full">
                <Loader2 className="w-3 h-3 animate-spin" /> Extracting…
              </span>
            )}
            {contract.extraction_status === 'complete' && (
              <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                <Check className="w-3 h-3" /> Extracted
              </span>
            )}
            {contract.extraction_status === 'failed' && (
              <span className="inline-flex items-center gap-1 text-[10px] text-red-500 bg-red-50 px-2 py-0.5 rounded-full">
                Failed
              </span>
            )}
          </div>
          <p className="text-[10px] text-slate-400">
            {contract.file_size ? `${(contract.file_size / 1024).toFixed(0)} KB` : ''} · {new Date(contract.created_date).toLocaleDateString()}
            {hasData && data.client_name && <> · {data.client_name}</>}
            {hasData && data.monthly_total && <> · <span className="font-medium text-slate-600">${Number(data.monthly_total).toLocaleString('en-US', { minimumFractionDigits: 2 })}/mo</span></>}
          </p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {contract.extraction_status === 'failed' && (
            <button
              onClick={(e) => { e.stopPropagation(); onRetryExtract(contract); }}
              className="text-slate-400 hover:text-pink-500 transition-colors p-1"
              title="Retry extraction"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onDownload(contract); }}
            className="text-slate-400 hover:text-pink-500 transition-colors p-1"
            title="Download"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(contract); }}
            className="text-slate-400 hover:text-red-500 transition-colors p-1"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          {hasData && (
            <ChevronDown className={cn("w-4 h-4 text-slate-400 transition-transform", !collapsed && "rotate-180")} />
          )}
        </div>
      </div>

      {/* Extracted data — visible by default, collapsible */}
      {!collapsed && hasData && (
        <div className="border-t border-slate-100 px-4 py-4 space-y-4 bg-slate-50/50">
          {/* Summary stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { icon: Building2, label: 'Client', value: data.client_name || '—', raw: true },
              { icon: DollarSign, label: 'Monthly', value: data.monthly_total ? `$${Number(data.monthly_total).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—', raw: true },
              { icon: DollarSign, label: 'Setup', value: data.setup_total ? `$${Number(data.setup_total).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—', raw: true },
              { icon: Calendar, label: 'Date', value: data.agreement_date || '—', raw: true },
            ].map((s) => (
              <div key={s.label} className="bg-white rounded-lg border border-slate-200 px-3 py-2">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <s.icon className="w-3 h-3 text-pink-400" />
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide">{s.label}</p>
                </div>
                <p className="text-sm font-semibold text-slate-700 truncate">{s.value}</p>
              </div>
            ))}
          </div>

          {/* Extra info row */}
          {(data.hourly_rate || data.term_months || data.cancellation_notice_days) && (
            <div className="flex flex-wrap gap-2 text-[11px]">
              {data.hourly_rate > 0 && (
                <span className="bg-white border border-slate-200 rounded px-2 py-1 text-slate-600">
                  On-site: <strong>${data.hourly_rate}/hr</strong>
                </span>
              )}
              {data.trip_charge > 0 && (
                <span className="bg-white border border-slate-200 rounded px-2 py-1 text-slate-600">
                  Trip: <strong>${data.trip_charge}</strong>
                </span>
              )}
              {data.term_months && (
                <span className="bg-white border border-slate-200 rounded px-2 py-1 text-slate-600">
                  Term: <strong>{data.term_months} months</strong>
                </span>
              )}
              {data.auto_renewal && (
                <span className="bg-pink-50 border border-pink-200 rounded px-2 py-1 text-pink-600">
                  Auto-renews
                </span>
              )}
              {data.cancellation_notice_days && (
                <span className="bg-white border border-slate-200 rounded px-2 py-1 text-slate-600">
                  Cancel notice: <strong>{data.cancellation_notice_days} days</strong>
                </span>
              )}
            </div>
          )}

          {/* Line items table */}
          {lineItems.length > 0 && (
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
              <div className="grid grid-cols-[1fr_60px_70px_80px] gap-1 px-3 py-2 bg-slate-100 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                <span>Product</span>
                <span className="text-right">Qty</span>
                <span className="text-right">Unit</span>
                <span className="text-right">Monthly</span>
              </div>
              <div className="divide-y divide-slate-100">
                {lineItems.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-[1fr_60px_70px_80px] gap-1 px-3 py-2 items-center">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-slate-700 truncate">{item.product}</p>
                      {item.unit && <p className="text-[10px] text-slate-400">per {item.unit}</p>}
                    </div>
                    <p className="text-xs text-slate-600 text-right">{item.quantity}</p>
                    <p className="text-xs text-slate-500 text-right">${Number(item.unit_price || 0).toFixed(2)}</p>
                    <p className="text-xs font-semibold text-slate-700 text-right">${Number(item.monthly_total || 0).toFixed(2)}</p>
                  </div>
                ))}
              </div>
              {/* Totals footer */}
              <div className="grid grid-cols-[1fr_60px_70px_80px] gap-1 px-3 py-2 bg-pink-50 border-t border-pink-100">
                <p className="text-xs font-semibold text-pink-700">Total</p>
                <p className="text-xs text-right text-pink-600">{lineItems.reduce((s, i) => s + (i.quantity || 0), 0)}</p>
                <p className="text-xs text-right"></p>
                <p className="text-xs font-bold text-right text-pink-700">
                  ${lineItems.reduce((s, i) => s + (i.monthly_total || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          )}

          {data.notes && (
            <div className="bg-white rounded-lg border border-slate-200 px-3 py-2">
              <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-1">Notes</p>
              <p className="text-xs text-slate-600">{data.notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// MiniStat removed — metrics now live in the header card

function DetailDrawer({ reconciliation, onClose }) {
  const isPax8 = !!reconciliation.ruleId;
  const label = isPax8 ? reconciliation.productName : reconciliation.rule?.label;
  const integrationLabel = reconciliation.integrationLabel || '';
  const { matchedLineItems = [], psaQty, vendorQty } = reconciliation;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/20" />
      <div
        className="relative w-full max-w-md bg-white shadow-2xl overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">{label}</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-xl"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Source Info */}
          <div>
            <h4 className="text-xs uppercase tracking-wider text-slate-400 font-medium mb-2">
              {isPax8 ? 'Pax8 Subscription Details' : 'Rule Details'}
            </h4>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Integration</dt>
                <dd className="font-medium">{integrationLabel}</dd>
              </div>
              {!isPax8 && reconciliation.rule?.match_pattern && (
                <div className="flex justify-between">
                  <dt className="text-slate-500">Match Pattern</dt>
                  <dd className="font-mono text-xs bg-slate-50 px-2 py-1 rounded">
                    {reconciliation.rule.match_pattern}
                  </dd>
                </div>
              )}
              {isPax8 && reconciliation.subscriptionId && (
                <div className="flex justify-between">
                  <dt className="text-slate-500">Subscription ID</dt>
                  <dd className="font-mono text-xs bg-slate-50 px-2 py-1 rounded truncate max-w-[180px]" title={reconciliation.subscriptionId}>
                    {reconciliation.subscriptionId}
                  </dd>
                </div>
              )}
              {isPax8 && reconciliation.billingTerm && (
                <div className="flex justify-between">
                  <dt className="text-slate-500">Billing Term</dt>
                  <dd className="font-medium">{reconciliation.billingTerm}</dd>
                </div>
              )}
              {isPax8 && reconciliation.price > 0 && (
                <div className="flex justify-between">
                  <dt className="text-slate-500">Price / Unit</dt>
                  <dd className="font-medium">${parseFloat(reconciliation.price).toFixed(2)}</dd>
                </div>
              )}
              {isPax8 && reconciliation.startDate && (
                <div className="flex justify-between">
                  <dt className="text-slate-500">Start Date</dt>
                  <dd className="font-medium">{new Date(reconciliation.startDate).toLocaleDateString()}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-slate-500">PSA Quantity</dt>
                <dd className="font-bold">{psaQty ?? '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Vendor Quantity</dt>
                <dd className="font-bold">{vendorQty ?? '—'}</dd>
              </div>
              {isPax8 && reconciliation.totalVendorQty !== reconciliation.vendorQty && (
                <div className="flex justify-between">
                  <dt className="text-slate-500">Total Pax8 (all subs)</dt>
                  <dd className="font-bold">{reconciliation.totalVendorQty}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* HaloPSA Matched Line Items */}
          <div>
            <h4 className="text-xs uppercase tracking-wider text-slate-400 font-medium mb-2">
              HaloPSA Billing Line Items ({matchedLineItems.length})
            </h4>
            {matchedLineItems.length === 0 ? (
              <p className="text-sm text-slate-400 italic">No matching line items found in HaloPSA billing</p>
            ) : (
              <div className="space-y-2">
                {matchedLineItems.map((li) => (
                  <div
                    key={li.id}
                    className="bg-slate-50 rounded-lg px-3 py-2 text-sm"
                  >
                    <p className="text-slate-700 truncate">{li.description}</p>
                    <div className="flex gap-4 mt-1 text-xs text-slate-400">
                      <span>Qty: {li.quantity}</span>
                      {li.price > 0 && <span>Price: ${parseFloat(li.price).toFixed(2)}</span>}
                      {li.net_amount > 0 && <span>Net: ${parseFloat(li.net_amount).toFixed(2)}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Pax8 Subscription Card ──────────────────────────────────────────

const PAX8_STATUS_STYLES = {
  match: { card: 'bg-emerald-50/70 border-emerald-200', bar: 'bg-emerald-500', numBg: 'bg-emerald-100/60 border-emerald-200', numText: 'text-emerald-800', labelText: 'text-emerald-500', borderT: 'border-emerald-100' },
  over: { card: 'bg-orange-50/50 border-orange-200', bar: 'bg-orange-500', numBg: 'bg-white/80 border-orange-200', numText: 'text-orange-900', labelText: 'text-orange-400', borderT: 'border-orange-100' },
  under: { card: 'bg-red-50/50 border-red-200', bar: 'bg-red-500', numBg: 'bg-white/80 border-red-200', numText: 'text-red-900', labelText: 'text-red-400', borderT: 'border-red-100' },
  missing_from_psa: { card: 'bg-red-50/50 border-red-200', bar: 'bg-red-500', numBg: 'bg-white/80 border-red-200', numText: 'text-red-900', labelText: 'text-red-400', borderT: 'border-red-100' },
  default: { card: 'bg-white border-slate-200', bar: 'bg-slate-300', numBg: 'bg-slate-50 border-slate-200', numText: 'text-slate-900', labelText: 'text-slate-400', borderT: 'border-slate-100' },
};

function Pax8SubscriptionCard({ recon, onReview, onDismiss, onReset, onDetails, onMapLineItem, onRemoveMapping, onSaveNotes, hasOverride, isSaving }) {
  const {
    ruleId, productName, vendorQty, totalVendorQty, psaQty,
    difference, status, matchedLineItems, billingTerm, price,
    startDate, review,
  } = recon;

  const message = getDiscrepancyMessage(recon);
  const isReviewed = review?.status === 'reviewed' || review?.status === 'dismissed';
  const isMissing = status === 'missing_from_psa';
  const styles = PAX8_STATUS_STYLES[status] || PAX8_STATUS_STYLES.default;

  const [showNotes, setShowNotes] = useState(false);
  const [noteText, setNoteText] = useState(review?.notes || '');
  const [savingNote, setSavingNote] = useState(false);
  const hasNotes = !!(review?.notes);

  const handleSaveNote = async () => {
    if (!onSaveNotes) return;
    setSavingNote(true);
    try {
      await onSaveNotes(ruleId, noteText);
    } finally {
      setSavingNote(false);
      setShowNotes(false);
    }
  };

  const totalCost = price > 0 ? (parseFloat(price) * vendorQty).toFixed(2) : null;

  return (
    <div
      className={cn(
        'rounded-xl border overflow-hidden transition-all hover:shadow-md',
        styles.card,
        isReviewed && 'opacity-50'
      )}
    >
      <div className={cn('h-1', styles.bar)} />

      <div className="px-4 py-3">
        {/* Title row */}
        <div className="flex items-center justify-between gap-2 mb-1">
          <h4 className="font-semibold text-slate-900 text-sm leading-tight truncate flex-1">{productName}</h4>
          <ReconciliationBadge status={isMissing ? 'missing_from_psa' : status} difference={difference} />
        </div>

        {/* Price line */}
        {(billingTerm || totalCost) && (
          <p className="text-[11px] text-slate-400 mb-3">
            {billingTerm || 'Pax8'}{price > 0 ? ` · $${parseFloat(price).toFixed(2)}/unit` : ''}{totalCost ? ` · $${totalCost}/mo` : ''}
          </p>
        )}

        {/* Override / Not Billed */}
        {isMissing && (
          <div className="flex items-center gap-2 mb-3 px-2.5 py-1.5 bg-red-100/60 rounded-md border border-red-200">
            <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
            <span className="text-[11px] font-medium text-red-700 flex-1">Not billed in PSA</span>
            <button onClick={() => onMapLineItem?.()} className="text-[10px] font-bold text-red-600 hover:text-red-800">MAP</button>
          </div>
        )}
        {hasOverride && !isMissing && (
          <div className="flex items-center gap-2 mb-3 px-2.5 py-1.5 bg-blue-50/80 rounded-md border border-blue-100">
            <Link2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />
            <span className="text-[11px] text-blue-600 flex-1">Mapped manually</span>
            <button onClick={() => onRemoveMapping?.()} className="text-[10px] font-bold text-blue-600 hover:text-blue-800">UNMAP</button>
          </div>
        )}

        {/* Big numbers */}
        <div className="flex items-center mb-3">
          <div className={cn('flex-1 text-center py-2 rounded-l-lg border', styles.numBg)}>
            <p className={cn('text-3xl font-black leading-none', styles.numText)}>
              {psaQty !== null ? psaQty : '—'}
            </p>
            <p className={cn('text-[10px] uppercase tracking-widest font-bold mt-1', styles.labelText)}>PSA</p>
          </div>
          <div className="px-2 text-slate-300 text-sm font-bold">vs</div>
          <div className={cn('flex-1 text-center py-2 rounded-r-lg border', styles.numBg)}>
            <p className={cn('text-3xl font-black leading-none', styles.numText)}>{vendorQty}</p>
            <p className={cn('text-[10px] uppercase tracking-widest font-bold mt-1', styles.labelText)}>PAX8</p>
          </div>
        </div>

        {/* Matched checkmark */}
        {status === 'match' && !isReviewed && (
          <div className="flex items-center gap-1.5 mb-3 text-emerald-600">
            <Check className="w-4 h-4" />
            <span className="text-xs font-semibold">{message}</span>
          </div>
        )}

        {/* Message for non-match */}
        {status !== 'match' && (
          <p className={cn(
            'text-xs mb-3 text-slate-500',
            (status === 'under' || isMissing) && 'text-red-600 font-semibold',
            status === 'over' && 'text-orange-600 font-semibold'
          )}>
            {isReviewed && <span className="text-slate-400 mr-1">[{review.status === 'reviewed' ? 'Reviewed' : 'Dismissed'}]</span>}
            {message}
          </p>
        )}

        {/* Notes inline */}
        {(showNotes || hasNotes) && (
          <div className="mb-3">
            {showNotes ? (
              <div className="space-y-1.5">
                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Add a note…"
                  rows={2}
                  className="w-full text-xs border border-slate-200 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none bg-white"
                  autoFocus
                />
                <div className="flex gap-1.5">
                  <button onClick={handleSaveNote} disabled={savingNote} className="px-2 py-1 text-[10px] font-bold rounded bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50">
                    {savingNote ? 'Saving…' : 'Save'}
                  </button>
                  <button onClick={() => { setShowNotes(false); setNoteText(review?.notes || ''); }} className="px-2 py-1 text-[10px] font-bold rounded bg-slate-100 text-slate-500 hover:bg-slate-200">Cancel</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setShowNotes(true)} className="w-full text-left bg-amber-50 rounded-md px-2.5 py-1.5 text-[11px] text-amber-700 truncate border border-amber-100">
                <span className="font-semibold">Note:</span> {review.notes}
              </button>
            )}
          </div>
        )}

        {/* Action bar */}
        <div className={cn('flex items-center gap-1.5 pt-2 border-t', styles.borderT)}>
          {!isReviewed && status !== 'match' && (
            <>
              <button onClick={() => onReview?.(ruleId)} disabled={isSaving} className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-md bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 transition-colors disabled:opacity-50">
                <Check className="w-3 h-3" /> OK
              </button>
              <button onClick={() => onDismiss?.(ruleId)} disabled={isSaving} className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-md bg-slate-500/10 text-slate-600 hover:bg-slate-500/20 transition-colors disabled:opacity-50">
                <X className="w-3 h-3" /> Skip
              </button>
            </>
          )}
          {isReviewed && (
            <button onClick={() => onReset?.(ruleId)} disabled={isSaving} className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-md bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors disabled:opacity-50">
              <RotateCcw className="w-3 h-3" /> Reset
            </button>
          )}
          {!showNotes && (
            <button onClick={() => setShowNotes(true)} className={cn('p-1 rounded-md transition-colors', hasNotes ? 'text-amber-500 hover:bg-amber-50' : 'text-slate-300 hover:bg-slate-50')} title="Note">
              <StickyNote className="w-3.5 h-3.5" />
            </button>
          )}
          {!isMissing && !hasOverride && (
            <button onClick={() => onMapLineItem?.()} className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded-md text-blue-500 hover:bg-blue-50 transition-colors">
              <Link2 className="w-3 h-3" /> Map
            </button>
          )}
          <button onClick={() => onDetails?.(recon)} className="ml-auto inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded-md text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors">
            Details <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Line Item Picker Dialog ─────────────────────────────────────────

function LineItemPicker({ productName, lineItems, onSelect, onClose }) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const items = lineItems.filter((li) => li.description && li.quantity > 0);
    if (!q) return items;
    return items.filter((li) => (li.description || '').toLowerCase().includes(q));
  }, [lineItems, search]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <div
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="font-semibold text-slate-900 text-sm">
            Map Line Item
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Select a HaloPSA billing line item for <span className="font-medium text-slate-700">{productName}</span>
          </p>
        </div>

        {/* Search */}
        <div className="px-6 py-3 border-b border-slate-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search line items…"
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-300 focus:border-pink-400"
              autoFocus
            />
          </div>
        </div>

        {/* Line item list */}
        <div className="max-h-80 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">No line items found</p>
          ) : (
            filtered.map((li) => (
              <button
                key={li.id}
                onClick={() => onSelect(li.id)}
                className="w-full text-left px-6 py-3 hover:bg-pink-50 border-b border-slate-50 transition-colors"
              >
                <p className="text-sm font-medium text-slate-700 truncate">
                  {formatLineItemDescription(li.description)}
                </p>
                <div className="flex gap-4 mt-0.5 text-xs text-slate-400">
                  <span>Qty: {li.quantity}</span>
                  {li.unit_price > 0 && <span>Price: ${parseFloat(li.unit_price).toFixed(2)}</span>}
                  {li.total > 0 && <span>Total: ${parseFloat(li.total).toFixed(2)}</span>}
                </div>
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Rule Editor Dialog ──────────────────────────────────────────────

function RuleEditorDialog({ rule, onSave, onClose }) {
  const [label, setLabel] = useState(rule.label || '');
  const [matchPattern, setMatchPattern] = useState(rule.match_pattern || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(rule.id, { label, match_pattern: matchPattern });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <div
        className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="font-semibold text-slate-900 text-sm">Edit Rule</h3>
          <p className="text-xs text-slate-500 mt-1">
            Integration: <span className="font-medium">{rule.integration_key}</span>
          </p>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Label</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-300"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Match Pattern <span className="text-slate-400">(use | for OR)</span>
            </label>
            <input
              type="text"
              value={matchPattern}
              onChange={(e) => setMatchPattern(e.target.value)}
              placeholder="e.g. Managed IT|Remote Only"
              className="w-full text-sm font-mono border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-300"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Matches line items where description contains this text (case-insensitive)
            </p>
          </div>
        </div>

        <div className="px-6 py-3 border-t border-slate-200 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !label.trim() || !matchPattern.trim()}
            className="px-4 py-2 text-xs font-medium rounded-lg bg-pink-500 text-white hover:bg-pink-600 transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
