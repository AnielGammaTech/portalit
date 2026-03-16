import React, { useState, useMemo, useRef } from 'react';
import { ArrowLeft, Filter, Check, X, ChevronRight, RotateCcw, RefreshCw, AlertTriangle, Link2, Search, Trash2, StickyNote, Settings2, Save, Upload, FileText, Download, Loader2, ChevronDown, DollarSign, Calendar, Users, Building2, Hash } from 'lucide-react';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { client, supabase } from '@/api/client';
import { useReconciliationData } from '@/hooks/useReconciliationData';
import { useReconciliationReviews } from '@/hooks/useReconciliationReviews';
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
      // Get a public URL for the uploaded PDF
      const { data: { publicUrl } } = supabase.storage
        .from('lootit-contracts')
        .getPublicUrl(contract.file_url);

      const result = await client.integrations.Core.InvokeLLM({
        prompt: `Extract all contract data from this MSSP/IT services agreement PDF. Focus on the pricing addendum/table.`,
        file_urls: [publicUrl],
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-pink-200 border-t-pink-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center hover:bg-pink-50 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-slate-600" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold text-slate-900 truncate">
            {customer.name}
          </h2>
          {summary && (
            <p className="text-sm text-slate-500 mt-0.5">
              {summary.total} services tracked · {summary.matched} matched · {summary.over + summary.under} issue{summary.over + summary.under !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        <button
          onClick={handleSync}
          disabled={isSyncing}
          className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-pink-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={cn('w-3.5 h-3.5', isSyncing && 'animate-spin')} />
          {isSyncing ? 'Syncing…' : 'Sync'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-pink-50/60 rounded-xl p-1">
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
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-700">Contracts</h3>
              <p className="text-xs text-slate-400">Upload MSSP contracts — line items are extracted automatically</p>
            </div>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadMutation.isPending}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-pink-500 text-white hover:bg-pink-600 transition-colors disabled:opacity-50"
              >
                {uploadMutation.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Upload className="w-3.5 h-3.5" />
                )}
                {uploadMutation.isPending ? 'Uploading…' : 'Upload Contract'}
              </button>
            </div>
          </div>

          {contracts.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
              <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-500 mb-1">No contracts uploaded yet</p>
              <p className="text-xs text-slate-400">Upload a PDF and we'll extract the pricing and service details</p>
            </div>
          ) : (
            <div className="space-y-3">
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
      {/* Quick Summary */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MiniStat label="Matched" value={summary.matched} color="emerald" />
          <MiniStat label="Under-billed" value={summary.under} color="red" />
          <MiniStat label="Over-billed" value={summary.over} color="orange" />
          <MiniStat label="Reviewed" value={summary.reviewed} color="pink" />
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex gap-2">
        {[
          { key: 'all', label: 'All' },
          { key: 'issues', label: 'Issues' },
          { key: 'matched', label: 'Matched' },
          { key: 'reviewed', label: 'Reviewed' },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setStatusFilter(f.key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              statusFilter === f.key
                ? 'bg-pink-500 text-white'
                : 'bg-white text-slate-500 border border-slate-200 hover:bg-pink-50'
            }`}
          >
            {f.label}
          </button>
        ))}
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

function ContractCard({ contract, extractingId, onDownload, onDelete, onRetryExtract }) {
  const [expanded, setExpanded] = useState(false);
  const isExtracting = extractingId === contract.id;
  const data = contract.extracted_data || {};
  const hasData = contract.extraction_status === 'complete' && Object.keys(data).length > 0;
  const lineItems = data.line_items || [];

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Header row */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors"
        onClick={() => hasData && setExpanded(!expanded)}
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
            <ChevronDown className={cn("w-4 h-4 text-slate-400 transition-transform", expanded && "rotate-180")} />
          )}
        </div>
      </div>

      {/* Expanded extracted data */}
      {expanded && hasData && (
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

function MiniStat({ label, value, color }) {
  const colors = {
    emerald: 'text-emerald-600 bg-emerald-50',
    red: 'text-red-600 bg-red-50',
    orange: 'text-orange-600 bg-orange-50',
    pink: 'text-pink-600 bg-pink-50',
  };

  return (
    <div className={`rounded-xl px-4 py-3 ${colors[color]}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs font-medium opacity-70">{label}</p>
    </div>
  );
}

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

const PAX8_STATUS_BORDER = {
  match: 'border-l-emerald-400',
  over: 'border-l-orange-400',
  under: 'border-l-red-400',
  missing_from_psa: 'border-l-red-500',
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

  return (
    <div
      className={cn(
        'bg-white rounded-xl border-l-4 border border-slate-200 p-5 transition-all hover:shadow-md',
        PAX8_STATUS_BORDER[status] || 'border-l-slate-200',
        isReviewed && 'opacity-60'
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h4 className="font-semibold text-slate-900 text-sm">{productName}</h4>
          <p className="text-xs text-slate-400 mt-0.5">
            Pax8{billingTerm ? ` · ${billingTerm}` : ''}{price > 0 ? ` · $${parseFloat(price).toFixed(2)}/unit · $${(parseFloat(price) * vendorQty).toFixed(2)}/mo` : ''}
          </p>
        </div>
        <ReconciliationBadge
          status={isMissing ? 'no_psa_data' : status}
          difference={difference}
        />
      </div>

      {/* Not Billed banner */}
      {isMissing && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
          <p className="text-xs font-medium text-red-700 flex-1">PSA Not Billing — no matching line item in HaloPSA</p>
          <button
            onClick={() => onMapLineItem?.()}
            className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-semibold rounded bg-red-600 text-white hover:bg-red-700 transition-colors flex-shrink-0"
          >
            <Link2 className="w-3 h-3" />
            Map
          </button>
        </div>
      )}

      {/* Override badge */}
      {hasOverride && !isMissing && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 mb-3 flex items-center gap-2">
          <Link2 className="w-4 h-4 text-blue-500 flex-shrink-0" />
          <p className="text-xs font-medium text-blue-700 flex-1">Manually mapped line item</p>
          <button
            onClick={() => onRemoveMapping?.()}
            className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-semibold rounded bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors flex-shrink-0"
          >
            <Trash2 className="w-3 h-3" />
            Unmap
          </button>
        </div>
      )}

      {/* Quantities */}
      <div className="flex items-center gap-6 mb-3">
        <div className="text-center">
          <p className="text-2xl font-bold text-slate-900">
            {psaQty !== null ? psaQty : '—'}
          </p>
          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">PSA</p>
        </div>
        <div className="text-slate-300 text-lg">vs</div>
        <div className="text-center">
          <p className="text-2xl font-bold text-slate-900">{vendorQty}</p>
          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Pax8</p>
        </div>
      </div>

      {/* Source details — always visible */}
      <div className="bg-slate-50 rounded-lg px-3 py-2 mb-3 space-y-1">
        <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Source</p>
        {matchedLineItems.length > 0 ? (
          matchedLineItems.slice(0, 2).map((li) => (
            <p key={li.id} className="text-xs text-slate-500 truncate">
              <span className="font-medium text-slate-600">HaloPSA:</span>{' '}
              {li.description?.replace(/\s*\$recurringbillingdate\s*/gi, '').trim()} · Qty {li.quantity}
            </p>
          ))
        ) : (
          <p className="text-xs text-slate-400 italic">No matching HaloPSA billing line item</p>
        )}
        <p className="text-xs text-slate-500 truncate">
          <span className="font-medium text-slate-600">Pax8:</span>{' '}
          {productName} · {vendorQty} licence{vendorQty !== 1 ? 's' : ''}
          {totalVendorQty !== vendorQty ? ` (product total: ${totalVendorQty})` : ''}
        </p>
      </div>

      {/* Notes */}
      {(showNotes || hasNotes) && (
        <div className="mb-3">
          {showNotes ? (
            <div className="space-y-2">
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Add a note about this licence…"
                rows={2}
                className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-300 resize-none"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSaveNote}
                  disabled={savingNote}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-semibold rounded bg-pink-500 text-white hover:bg-pink-600 transition-colors disabled:opacity-50"
                >
                  <Save className="w-3 h-3" />
                  {savingNote ? 'Saving…' : 'Save'}
                </button>
                <button
                  onClick={() => { setShowNotes(false); setNoteText(review?.notes || ''); }}
                  className="px-2.5 py-1 text-[10px] font-semibold rounded bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowNotes(true)}
              className="w-full text-left bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700"
            >
              <span className="font-medium">Note:</span> {review.notes}
            </button>
          )}
        </div>
      )}

      {/* Message */}
      <p
        className={cn(
          'text-sm mb-4',
          status === 'match' ? 'text-emerald-600' : 'text-slate-600',
          (status === 'under' || isMissing) && 'text-red-600 font-medium',
          status === 'over' && 'text-orange-600 font-medium'
        )}
      >
        {isReviewed && (
          <span className="text-slate-400 mr-1">
            [{review.status === 'reviewed' ? '✓ Reviewed' : '✕ Dismissed'}]
          </span>
        )}
        {message}
      </p>

      {/* Actions — same as ServiceCard */}
      <div className="flex items-center gap-2">
        {!isReviewed && status !== 'match' && (
          <>
            <button
              onClick={() => onReview?.(ruleId)}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-pink-50 text-pink-600 hover:bg-pink-100 transition-colors disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" />
              Reviewed
            </button>
            <button
              onClick={() => onDismiss?.(ruleId)}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-50 text-slate-500 hover:bg-slate-100 transition-colors disabled:opacity-50"
            >
              <X className="w-3.5 h-3.5" />
              Dismiss
            </button>
          </>
        )}
        {isReviewed && (
          <button
            onClick={() => onReset?.(ruleId)}
            disabled={isSaving}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-50 text-slate-500 hover:bg-slate-100 transition-colors disabled:opacity-50"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </button>
        )}
        {!showNotes && (
          <button
            onClick={() => setShowNotes(true)}
            className={cn(
              'inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors',
              hasNotes ? 'text-amber-500 hover:bg-amber-50' : 'text-slate-400 hover:bg-slate-50'
            )}
            title="Add note"
          >
            <StickyNote className="w-3.5 h-3.5" />
          </button>
        )}
        {!isMissing && !hasOverride && (
          <button
            onClick={() => onMapLineItem?.()}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg text-blue-500 hover:bg-blue-50 transition-colors"
          >
            <Link2 className="w-3.5 h-3.5" />
            Map
          </button>
        )}
        <button
          onClick={() => onDetails?.(recon)}
          className="ml-auto inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg text-slate-500 hover:bg-slate-50 transition-colors"
        >
          Details
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
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
                  {li.description?.replace(/\s*\$recurringbillingdate\s*/gi, '').trim()}
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
