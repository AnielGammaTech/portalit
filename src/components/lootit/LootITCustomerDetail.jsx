import React, { useState, useMemo, useRef, useCallback } from 'react';
import { RotateCcw, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { client, supabase } from '@/api/client';
import { useReconciliationData } from '@/hooks/useReconciliationData';
import { useReconciliationReviews } from '@/hooks/useReconciliationReviews';
import { useCustomerContacts, useCustomerDevices } from '@/hooks/useCustomerData';
import { useAuth } from '@/lib/AuthContext';
import { getDiscrepancySummary } from '@/lib/lootit-reconciliation';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import CustomerDetailHeader from './CustomerDetailHeader';
import ReconciliationTab from './ReconciliationTab';
import ContractTab from './ContractTab';
import DetailDrawer from './DetailDrawer';
import LineItemPicker from './LineItemPicker';
import RuleEditorDialog from './RuleEditorDialog';

// LLM extraction schema for contract PDFs (kept outside component to avoid re-creation)
const s = (t, d) => ({ type: t, description: d });
const CONTRACT_EXTRACT_SCHEMA = { type: "object", properties: {
  client_name: s("string", "Client/customer company name"), provider_name: s("string", "MSP/consultant company name"),
  agreement_date: s("string", "Date of agreement (YYYY-MM-DD)"), term_months: s("number", "Contract term in months"),
  monthly_total: s("number", "Total monthly fee"), setup_total: s("number", "Total one-time setup fee"),
  hourly_rate: s("number", "On-site hourly rate"), trip_charge: s("number", "Trip charge per visit"),
  line_items: { type: "array", items: { type: "object", properties: {
    product: s("string", "Product/service name"), unit: s("string", "Per what (Endpoint, User, Server, etc.)"),
    quantity: s("number", "Quantity"), unit_price: s("number", "Price per unit per month"),
    monthly_total: s("number", "Line total per month (qty x price)"),
    setup_price: s("number", "One-time setup fee per unit (0 if none)"), setup_total: s("number", "Setup total (qty x setup_price)"),
  }}},
  auto_renewal: s("boolean", "Whether contract auto-renews"),
  cancellation_notice_days: s("number", "Days notice required for cancellation"),
  notes: s("string", "Any important notes or special terms"),
}};

export default function LootITCustomerDetail({ customer, onBack }) {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('all');
  const [detailItem, setDetailItem] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [mappingRecon, setMappingRecon] = useState(null);
  const [editingRule, setEditingRule] = useState(null);
  const fileInputRef = useRef(null);
  const { user } = useAuth();
  const { reconciliations, isLoading } = useReconciliationData(customer.id);
  const { reviews, markReviewed, dismiss, resetReview, saveNotes, saveExclusion, isSaving } = useReconciliationReviews(customer.id);
  const { data: contacts = [] } = useCustomerContacts(customer.id);
  const { data: devices = [] } = useCustomerDevices(customer.id);

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
      const { data: signedData, error: signError } = await supabase.storage
        .from('lootit-contracts').createSignedUrl(contract.file_url, 300);
      if (signError || !signedData?.signedUrl) throw new Error('Could not create signed URL');

      const result = await client.integrations.Core.InvokeLLM({
        prompt: `Extract all contract data from this MSSP/IT services agreement PDF. Focus on the pricing addendum/table.`,
        file_urls: [signedData.signedUrl],
        response_json_schema: CONTRACT_EXTRACT_SCHEMA,
      });

      if (result) {
        await client.entities.LootITContract.update(contract.id, { extracted_data: result, extraction_status: 'complete' });
        toast.success('Contract data extracted successfully');
      } else {
        await client.entities.LootITContract.update(contract.id, { extraction_status: 'failed' });
        toast.error('Could not extract contract data');
      }
    } catch (err) {
      console.error('[LootIT] Contract extraction failed:', err);
      await client.entities.LootITContract.update(contract.id, { extraction_status: 'failed' });
      toast.error('Contract extraction failed');
    } finally {
      setExtractingId(null);
      queryClient.invalidateQueries({ queryKey: ['lootit_contracts', customer.id] });
    }
  };

  const handleFileUpload = (e) => { const file = e.target.files?.[0]; if (file) uploadMutation.mutate(file); e.target.value = ''; };

  const handleDownloadContract = async (contract) => {
    const { data, error } = await supabase.storage.from('lootit-contracts').download(contract.file_url);
    if (error) return;
    const url = URL.createObjectURL(data);
    const a = document.createElement('a'); a.href = url; a.download = contract.file_name; a.click();
    URL.revokeObjectURL(url);
  };

  const handleDeleteContract = async (contract) => {
    await supabase.storage.from('lootit-contracts').remove([contract.file_url]);
    await client.entities.LootITContract.delete(contract.id);
    queryClient.invalidateQueries({ queryKey: ['lootit_contracts', customer.id] });
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
    } finally { setIsSyncing(false); }
  };

  const customerData = reconciliations[customer.id];
  const recons = customerData?.reconciliations || [];
  const pax8Recons = customerData?.pax8Reconciliations || [];
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

  const [activeTab, setActiveTab] = useState('reconciliation');
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e) => { e.preventDefault(); setIsDragging(true); }, []);
  const handleDragLeave = useCallback((e) => { e.preventDefault(); setIsDragging(false); }, []);
  const handleDrop = useCallback((e) => {
    e.preventDefault(); setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadMutation.mutate(file);
  }, [uploadMutation]);

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
      <div className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-pink-400/10 rounded-full blur-[100px]" />
      <CustomerDetailHeader
        customer={customer}
        onBack={onBack}
        onSync={handleSync}
        isSyncing={isSyncing}
        healthPct={healthPct}
        activeIntegrations={activeIntegrations}
        summary={summary}
        contacts={contacts}
        devices={devices}
        contracts={contracts}
        dollarImpact={dollarImpact}
        issueCount={issueCount}
      />
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
      {activeTab === 'contract' && (
        <ContractTab
          contracts={contracts}
          extractingId={extractingId}
          fileInputRef={fileInputRef}
          isDragging={isDragging}
          uploadPending={uploadMutation.isPending}
          onFileUpload={handleFileUpload}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onDownload={handleDownloadContract}
          onDelete={handleDeleteContract}
          onRetryExtract={extractContractData}
        />
      )}
      {activeTab === 'reconciliation' && (
        <ReconciliationTab
          filteredRecons={filteredRecons}
          filteredPax8={filteredPax8}
          statusFilter={statusFilter}
          onFilterChange={setStatusFilter}
          allRecons={allRecons}
          summary={summary}
          issueCount={issueCount}
          existingOverrides={existingOverrides}
          isSaving={isSaving}
          onReview={handleReview}
          onDismiss={handleDismiss}
          onReset={resetReview}
          onDetails={setDetailItem}
          onEditRule={setEditingRule}
          onSaveNotes={(ruleId, notes) => saveNotes(ruleId, notes)}
          onMapLineItem={(ruleId, label) => setMappingRecon({ ruleId, productName: label })}
          onRemoveMapping={(ruleId) => handleRemoveMapping(ruleId)}
        />
      )}
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
      {editingRule && (
        <RuleEditorDialog
          rule={editingRule}
          onSave={handleSaveRule}
          onClose={() => setEditingRule(null)}
        />
      )}
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
