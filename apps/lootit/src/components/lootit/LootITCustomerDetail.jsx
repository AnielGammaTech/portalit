import React, { useState, useMemo } from 'react';
import { RotateCcw, Repeat2, DollarSign, FileText, LayoutDashboard } from 'lucide-react';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { client, supabase } from '@/api/client';
import { useAuth } from '@/lib/AuthContext';
import { useReconciliationData } from '@/hooks/useReconciliationData';
import { useReconciliationReviews } from '@/hooks/useReconciliationReviews';
import { useExcludedItems } from '@/hooks/useExcludedItems';
import { useCustomerContacts, useCustomerDevices } from '@/hooks/useCustomerData';
import { getDiscrepancySummary } from '@/lib/lootit-reconciliation';
import { extractVendorItems } from '@/lib/vendor-item-extractors';
import { useAnomalyData } from '@/hooks/useAnomalyData';
import { useContractActions } from '@/hooks/useContractActions';
import { useSyncCustomer } from '@/hooks/useSyncCustomer';
import RecurringTab from './RecurringTab';
import ReconciliationDetailModal from './ReconciliationDetailModal';
import LineItemPicker from './LineItemPicker';
import RuleEditorDialog from './RuleEditorDialog';
import Pax8GroupMapper from './Pax8GroupMapper';
import CustomerDetailHeaderCard from './CustomerDetailHeaderCard';
import BillingAnomaliesSection from './BillingAnomaliesSection';
import InvoicesTab from './InvoicesTab';
import CustomerDetailContractTab from './CustomerDetailContractTab';
import CustomerDetailReconciliationTab from './CustomerDetailReconciliationTab';
import { useReconciliationSnapshot } from '@/hooks/useReconciliationSnapshot';
import { useStalenessData } from '@/hooks/useStalenessData';
import { useSignOff } from '@/hooks/useSignOff';
import DashboardTab from './DashboardTab';
import SignOffDialog from './SignOffDialog';

export default function LootITCustomerDetail({ customer, onBack, activeTab: activeTabProp = 'dashboard', onTabChange }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [statusFilter, setStatusFilter] = useState('all');
  const [detailItem, setDetailItem] = useState(null);
  const [mappingRecon, setMappingRecon] = useState(null);
  const [showGroupMapper, setShowGroupMapper] = useState(false);
  const [editingRule, setEditingRule] = useState(null);

  const { reconciliations, isLoading, rules: allRules } = useReconciliationData(customer.id);
  const { reviews, markReviewed, dismiss, resetReview, saveNotes, saveExclusion, forceMatch, reVerify, saveVendorDivisor, isSaving } = useReconciliationReviews(customer.id);
  const { excludedItems, getExcludedForRule, getExclusionCount, saveExcludedItems, removeAllForRule, detectDroppedItems, isSaving: isExclusionSaving } = useExcludedItems(customer.id);
  const { data: contacts = [] } = useCustomerContacts(customer.id);
  const { data: devices = [] } = useCustomerDevices(customer.id);

  const {
    customerInvoices, openAnomalies, resolvedAnomalies, anomalyHistory,
    acknowledgeId, setAcknowledgeId, acknowledgeNotes, setAcknowledgeNotes,
    showHistory, setShowHistory, handleAcknowledgeAnomaly, handleDismissAnomaly,
  } = useAnomalyData(customer.id);

  const {
    contracts, extractingId, fileInputRef, isDragging, isUploading,
    extractContractData, handleFileUpload, handleDownloadContract,
    handleDeleteContract, handleDragOver, handleDragLeave, handleDrop,
  } = useContractActions(customer.id);

  const { isSyncing, syncStatus, handleSync } = useSyncCustomer(customer);

  const { latestSignOff, snapshotsByRuleId } = useReconciliationSnapshot(customer.id);
  const { signOff, isSigningOff } = useSignOff(customer.id);
  const [showSignOffDialog, setShowSignOffDialog] = useState(false);

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

  // ── Reconciliation data ──
  const customerData = reconciliations[customer.id];
  const recons = customerData?.reconciliations || [];
  const pax8Recons = customerData?.pax8Reconciliations || [];

  const pax8MatchedLineItemIds = useMemo(() => {
    const ids = new Set();
    for (const r of pax8Recons) {
      for (const li of (r.matchedLineItems || [])) ids.add(li.id);
    }
    return ids;
  }, [pax8Recons]);

  const allRecons = useMemo(() => [...recons, ...pax8Recons], [recons, pax8Recons]);
  const summary = customerData ? getDiscrepancySummary(allRecons) : null;

  const { stalenessMap, staleCount, signOffExpired, daysSinceSignOff } = useStalenessData({
    reviews,
    snapshotsByRuleId,
    latestSignOff,
    allRecons,
    pax8Recons,
  });

  // Detect excluded items that no longer exist in vendor data
  React.useEffect(() => {
    if (!customerData?.vendorMappings || excludedItems.length === 0) return;
    const mappings = customerData.vendorMappings;
    const processedRules = new Set();
    for (const recon of recons) {
      const ruleId = recon.rule?.id;
      const integrationKey = recon.rule?.integration_key;
      if (!ruleId || !integrationKey || processedRules.has(ruleId)) continue;
      const hasExclusions = excludedItems.some(e => e.rule_id === ruleId);
      if (!hasExclusions) continue;
      const mapping = mappings[integrationKey];
      if (!mapping) continue;
      const vendorItems = extractVendorItems(integrationKey, mapping.cached_data);
      if (!vendorItems) continue;
      processedRules.add(ruleId);
      detectDroppedItems(ruleId, vendorItems);
    }
  }, [customerData?.vendorMappings, excludedItems.length]);

  const verificationState = useMemo(() => {
    const tiles = [
      ...(recons || []).filter(r => r.status !== 'no_data' || ['force_matched', 'reviewed', 'dismissed'].includes(r.review?.status))
        .map(r => ({ ruleId: r.rule?.id, label: r.rule?.label })),
      ...(pax8Recons || []).map(r => ({ ruleId: r.ruleId, label: r.productName })),
    ];
    const total = tiles.length;
    let verified = 0;
    const unverified = [];
    const verifiedMap = {};
    for (const tile of tiles) {
      const review = reviews.find(r => r.rule_id === tile.ruleId);
      const isReviewed = ['reviewed', 'force_matched', 'dismissed'].includes(review?.status);
      const hasDataChanged = stalenessMap[tile.ruleId]?.changeDetected;
      if (isReviewed && !hasDataChanged) {
        verified++;
        verifiedMap[tile.ruleId] = true;
      } else {
        unverified.push(tile);
        verifiedMap[tile.ruleId] = false;
      }
    }
    return {
      total, verified, unverified, verifiedMap,
      allVerified: total > 0 && verified === total,
      pct: total > 0 ? Math.round((verified / total) * 100) : 0,
    };
  }, [recons, pax8Recons, reviews, stalenessMap]);

  const filteredRecons = useMemo(() => {
    const visible = recons.filter((r) => r.status !== 'no_data' || r.review?.status === 'force_matched' || r.review?.status === 'reviewed' || r.review?.status === 'dismissed');
    if (statusFilter === 'all') return visible;
    if (statusFilter === 'issues') return visible.filter((r) => (r.status === 'over' || r.status === 'under') && !['force_matched', 'dismissed', 'reviewed'].includes(r.review?.status));
    if (statusFilter === 'stale') return visible.filter((r) => stalenessMap[r.rule.id]);
    if (statusFilter === 'matched') return visible.filter((r) => r.status === 'match' || r.review?.status === 'force_matched');
    if (statusFilter === 'verified') return visible.filter((r) => verificationState.verifiedMap[r.rule?.id]);
    if (statusFilter === 'unverified') return visible.filter((r) => !verificationState.verifiedMap[r.rule?.id]);
    return visible;
  }, [recons, statusFilter, stalenessMap, verificationState]);

  const filteredPax8 = useMemo(() => {
    if (statusFilter === 'all') return pax8Recons;
    if (statusFilter === 'issues') return pax8Recons.filter((r) => (r.status === 'over' || r.status === 'under' || r.status === 'missing_from_psa') && !['force_matched', 'dismissed', 'reviewed'].includes(r.review?.status));
    if (statusFilter === 'stale') return pax8Recons.filter((r) => stalenessMap[r.ruleId]);
    if (statusFilter === 'matched') return pax8Recons.filter((r) => r.status === 'match');
    if (statusFilter === 'verified') return pax8Recons.filter((r) => verificationState.verifiedMap[r.ruleId]);
    if (statusFilter === 'unverified') return pax8Recons.filter((r) => !verificationState.verifiedMap[r.ruleId]);
    return pax8Recons;
  }, [pax8Recons, statusFilter, stalenessMap, verificationState]);

  // ── Computed values ──
  const dollarImpact = useMemo(() => {
    if (!allRecons.length) return null;
    let underBilledAmount = 0;
    let overBilledAmount = 0;
    let totalMonthlyBilled = 0;
    for (const r of allRecons) {
      const reviewStatus = r.review?.status;
      if (reviewStatus === 'force_matched' || reviewStatus === 'dismissed' || reviewStatus === 'reviewed') continue;
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

  const issueCount = summary ? summary.over + summary.under : 0;
  const totalRules = summary ? summary.total - (summary.noData || 0) : 0;
  const resolvedCount = summary ? (summary.matched || 0) + (summary.forceMatched || 0) + (summary.dismissed || 0) + (summary.reviewed || 0) : 0;
  const healthPct = totalRules > 0 ? Math.min(100, Math.round((resolvedCount / totalRules) * 100)) : 0;
  const hasUnresolvedItems = totalRules > resolvedCount;

  // ── Handlers ──
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

  const handleSaveMapping = async (ruleId, productName, selectedItems) => {
    try {
      const items = Array.isArray(selectedItems) ? selectedItems : [{ id: selectedItems, description: productName, quantity: 0 }];
      const recon = recons.find(r => r.rule?.id === ruleId);
      const pax8Recon = pax8Recons.find(r => r.ruleId === ruleId);
      const psaLineItemId = recon?.matchedLineItems?.[0]?.id || pax8Recon?.matchedLineItems?.[0]?.id || null;

      const toRemove = existingOverrides.filter((o) => o.rule_id === ruleId);
      for (const ov of toRemove) {
        await client.entities.Pax8LineItemOverride.delete(ov.id);
      }

      if (items.length === 1) {
        const item = items[0];
        const isPsaLineItem = item.id && !item.id.includes(':');
        const vendorKey = item.id?.endsWith(':total') || item.id?.endsWith(':count')
          ? item.id.replace(/:total$|:count$/, '')
          : null;
        await client.entities.Pax8LineItemOverride.create({
          customer_id: customer.id,
          rule_id: ruleId,
          pax8_product_name: isPsaLineItem ? (productName || null) : (vendorKey || item.description || item.id),
          line_item_id: isPsaLineItem ? item.id : (psaLineItemId || null),
          group_id: `qty:${item.quantity || 0}`,
        });
      } else {
        const mappingData = items.map(item => ({
          id: item.id,
          name: item.description,
          qty: item.quantity || 0,
        }));
        const totalQty = mappingData.reduce((sum, m) => sum + m.qty, 0);
        await client.entities.Pax8LineItemOverride.create({
          customer_id: customer.id,
          rule_id: ruleId,
          pax8_product_name: JSON.stringify(mappingData),
          line_item_id: psaLineItemId || null,
          group_id: `multi:${totalQty}`,
        });
      }

      await queryClient.invalidateQueries({ queryKey: ['pax8_line_item_overrides', customer.id] });
      await queryClient.invalidateQueries({ queryKey: ['pax8_line_item_overrides_all'] });
      setMappingRecon(null);
      const count = items.length;
      toast.success(count > 1 ? `Mapped ${count} items` : 'Mapping saved');
    } catch (err) {
      toast.error(err.message || 'Failed to save mapping');
    }
  };

  const handleSaveGroupMapping = async (lineItemId, ruleIds) => {
    try {
      const groupId = crypto.randomUUID();
      for (const ruleId of ruleIds) {
        const existing = existingOverrides.filter(o => o.rule_id === ruleId);
        for (const ov of existing) {
          await client.entities.Pax8LineItemOverride.delete(ov.id);
        }
        const sub = pax8Recons.find(r => r.ruleId === ruleId);
        await client.entities.Pax8LineItemOverride.create({
          customer_id: customer.id,
          rule_id: ruleId,
          line_item_id: lineItemId,
          pax8_product_name: sub?.productName || ruleId,
          group_id: groupId,
        });
      }
      await queryClient.invalidateQueries({ queryKey: ['pax8_line_item_overrides', customer.id] });
      await queryClient.invalidateQueries({ queryKey: ['pax8_line_item_overrides_all'] });
      setShowGroupMapper(false);
      toast.success(`Grouped ${ruleIds.length} subscriptions`);
    } catch (err) {
      toast.error(err.message || 'Failed to save group mapping');
    }
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

  const unresolvedItems = useMemo(() => {
    const allTiles = [
      ...(allRecons || []).map((r) => ({ ruleId: r.rule?.id || r.ruleId, label: r.rule?.label || r.productName, status: r.status, review: reviews.find((rv) => rv.rule_id === (r.rule?.id || r.ruleId)) })),
    ];
    return allTiles.filter((t) =>
      ['over', 'under', 'missing_from_psa', 'no_psa_match', 'unmatched_line_item'].includes(t.status) &&
      !['reviewed', 'force_matched', 'dismissed'].includes(t.review?.status)
    );
  }, [allRecons, reviews]);

  const handleSignOff = async (notes, nextReconciliationDate) => {
    await signOff({
      allRecons: recons,
      pax8Recons,
      reviews,
      overrides: existingOverrides,
      notes,
      nextReconciliationDate,
    });
    setShowSignOffDialog(false);
    toast.success('Reconciliation signed off successfully');
    setActiveTab('dashboard');
  };

  const activeTab = activeTabProp;
  const setActiveTab = (tab) => onTabChange ? onTabChange(tab) : null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-pink-200 border-t-pink-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5 relative">
      <div className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-pink-400/10 rounded-full blur-[100px]" />

      <CustomerDetailHeaderCard
        customer={customer}
        onBack={onBack}
        onSync={handleSync}
        isSyncing={isSyncing}
        syncStatus={syncStatus}
        healthPct={healthPct}
        activeIntegrations={activeIntegrations}
        summary={summary}
        issueCount={issueCount}
        dollarImpact={dollarImpact}
        contacts={contacts}
        devices={devices}
        contracts={contracts}
        recons={recons}
        pax8Recons={pax8Recons}
        allRecons={allRecons}
        hasUnresolvedItems={hasUnresolvedItems}
        unresolvedCount={totalRules - resolvedCount}
        signOffExpired={signOffExpired}
        daysSinceSignOff={daysSinceSignOff}
        verificationState={verificationState}
      />

      <BillingAnomaliesSection
        openAnomalies={openAnomalies}
        resolvedAnomalies={resolvedAnomalies}
        anomalyHistory={anomalyHistory}
        showHistory={showHistory}
        onToggleHistory={() => setShowHistory(!showHistory)}
        acknowledgeId={acknowledgeId}
        acknowledgeNotes={acknowledgeNotes}
        onAcknowledgeNotesChange={setAcknowledgeNotes}
        onAcknowledge={handleAcknowledgeAnomaly}
        onDismiss={handleDismissAnomaly}
        onStartAcknowledge={setAcknowledgeId}
        onCancelAcknowledge={() => { setAcknowledgeId(null); setAcknowledgeNotes(''); }}
      />

      {/* Tab bar */}
      <div className="sticky top-0 z-10 bg-white shadow-sm">
        <div className="flex w-full">
          {[
            { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
            { key: 'reconciliation', label: 'Reconciliation', icon: RotateCcw },
            { key: 'recurring', label: 'Recurring', icon: Repeat2, badge: allLineItems.length || null },
            { key: 'invoices', label: 'Invoices', icon: DollarSign, badge: customerInvoices.length || null },
            { key: 'contract', label: 'Contract', icon: FileText, badge: contracts.length || null },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-all rounded-lg mx-1 my-1.5',
                activeTab === tab.key
                  ? 'bg-pink-500 text-white shadow-sm'
                  : 'text-slate-500 hover:bg-pink-50'
              )}
            >
              <tab.icon className="w-5 h-5" />
              {tab.label}
              {tab.badge != null && (
                <span className={cn(
                  'text-[10px] px-1.5 py-0.5 rounded-full font-bold',
                  activeTab === tab.key ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                )}>{tab.badge}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'dashboard' && (
        <DashboardTab
          customerId={customer.id}
          onTabChange={setActiveTab}
          onShowSnapshotDetail={(snapshot) => {
            const liveRecon = allRecons.find((r) => (r.rule?.id || r.ruleId) === snapshot.rule_id);
            setDetailItem({
              rule: { id: snapshot.rule_id, label: snapshot.label, integration_key: snapshot.integration_key },
              psaQty: snapshot.psa_qty,
              vendorQty: snapshot.vendor_qty,
              status: snapshot.status,
              matchedLineItems: liveRecon?.matchedLineItems || [],
              rawVendorQty: liveRecon?.rawVendorQty,
              vendorDivisor: liveRecon?.vendorDivisor,
              difference: (snapshot.psa_qty || 0) - (snapshot.vendor_qty || 0),
              review: {
                status: snapshot.review_status,
                notes: snapshot.review_notes,
                reviewed_by: snapshot.reviewed_by,
                reviewed_at: snapshot.reviewed_at,
                exclusion_count: snapshot.exclusion_count,
                exclusion_reason: snapshot.exclusion_reason,
              },
              integrationLabel: snapshot.integration_key,
              _readOnly: true,
              _snapshotDate: latestSignOff?.signed_at,
            });
          }}
        />
      )}

      {activeTab === 'reconciliation' && (
        <CustomerDetailReconciliationTab
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
          onForceMatch={(ruleId, notes) => forceMatch(ruleId, notes)}
          onMapLineItem={(ruleId, label) => setMappingRecon({ ruleId, productName: label })}
          onRemoveMapping={(ruleId) => handleRemoveMapping(ruleId)}
          onShowGroupMapper={() => setShowGroupMapper(true)}
          stalenessMap={stalenessMap}
          staleCount={staleCount}
          onSignOff={verificationState.allVerified ? () => setShowSignOffDialog(true) : null}
          customerId={customer.id}
          vendorMappings={customerData?.vendorMappings || {}}
          verificationState={verificationState}
        />
      )}

      {activeTab === 'recurring' && (
        <RecurringTab lineItems={allLineItems} rules={allRules || []} overrides={existingOverrides} pax8MatchedIds={pax8MatchedLineItemIds} />
      )}

      {activeTab === 'invoices' && (
        <InvoicesTab invoices={customerInvoices} />
      )}

      {activeTab === 'contract' && (
        <CustomerDetailContractTab
          contracts={contracts}
          extractingId={extractingId}
          fileInputRef={fileInputRef}
          isDragging={isDragging}
          isUploading={isUploading}
          onFileUpload={handleFileUpload}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onDownload={handleDownloadContract}
          onDelete={handleDeleteContract}
          onRetryExtract={extractContractData}
        />
      )}

      {detailItem && (
        <ReconciliationDetailModal
          reconciliation={detailItem}
          customerId={customer.id}
          overrides={existingOverrides}
          onClose={() => setDetailItem(null)}
          readOnly={detailItem._readOnly || false}
          snapshotDate={detailItem._snapshotDate}
          snapshot={snapshotsByRuleId[detailItem.ruleId || detailItem.rule?.id]}
          staleness={stalenessMap[detailItem.ruleId || detailItem.rule?.id]}
          signOffDate={latestSignOff?.signed_at}
          isSaving={isSaving}
          onReVerify={async (ruleId) => {
            await reVerify(ruleId);
            toast.success('Re-verified');
          }}
          onForceMatch={async (ruleId, notes) => {
            const rawId = ruleId.startsWith('unmatched_') ? ruleId : null;
            const liId = rawId ? rawId.replace('unmatched_', '') : null;
            if (liId) {
              const toRemove = existingOverrides.filter(o => o.rule_id === rawId);
              for (const ov of toRemove) await client.entities.Pax8LineItemOverride.delete(ov.id);
              await client.entities.Pax8LineItemOverride.create({
                customer_id: customer.id,
                rule_id: rawId,
                pax8_product_name: 'approved_as_is',
                line_item_id: liId,
                group_id: `approved:${(notes || '').slice(0, 200)}`,
              });
              supabase.from('reconciliation_review_history').insert({
                customer_id: customer.id,
                rule_id: rawId,
                action: 'approved_as_is',
                status: 'force_matched',
                notes: `[APPROVED AS-IS by ${user?.full_name || user?.email || 'Unknown'} — ${new Date().toLocaleString()}] ${(notes || '').trim()}`,
                created_by: user?.id || null,
                created_by_name: user?.full_name || user?.email || null,
              });
              await queryClient.invalidateQueries({ queryKey: ['pax8_line_item_overrides', customer.id] });
              await queryClient.invalidateQueries({ queryKey: ['pax8_line_item_overrides_all'] });
              await queryClient.invalidateQueries({ queryKey: ['reconciliation_review_history', customer.id] });
              toast.success('Approved as-is');
            } else {
              await forceMatch(ruleId, notes);
            }
          }}
          onReview={(ruleId, opts) => markReviewed(ruleId, opts)}
          onDismiss={(ruleId, opts) => dismiss(ruleId, opts)}
          onReset={(ruleId) => resetReview(ruleId)}
          onSaveNotes={(ruleId, notes) => saveNotes(ruleId, notes)}
          onSaveExclusion={async (ruleId, exclusionCount, exclusionReason) => {
            await saveExclusion(ruleId, exclusionCount, exclusionReason);
            const updatedReviews = queryClient.getQueryData(['reconciliation_reviews', customer.id]);
            const updatedReview = updatedReviews?.find((r) => r.rule_id === ruleId);
            if (updatedReview) {
              setDetailItem((prev) => prev ? { ...prev, review: updatedReview } : prev);
            }
          }}
          onMapLineItem={(ruleId, label) => setMappingRecon({ ruleId, productName: label })}
          onSaveExcludedItems={saveExcludedItems}
          onRemoveAllExcludedItems={removeAllForRule}
          excludedItemsForRule={detailItem ? getExcludedForRule(
            detailItem.ruleId || detailItem.rule?.id
          ) : []}
          vendorMapping={
            detailItem
              ? (customerData?.vendorMappings || {})[
                  detailItem.ruleId ? 'pax8' : detailItem.rule?.integration_key
                ]
              : null
          }
          isExclusionSaving={isExclusionSaving}
          haloDevices={devices}
          onSaveVendorDivisor={async (ruleId, divisor) => {
            await saveVendorDivisor(ruleId, divisor);
            setDetailItem((prev) => {
              if (!prev) return prev;
              const raw = prev.rawVendorQty ?? prev.vendorQty;
              const adjusted = raw != null && divisor > 1 ? Math.ceil(raw / divisor) : raw;
              return {
                ...prev,
                vendorDivisor: divisor,
                rawVendorQty: raw,
                vendorQty: adjusted,
                difference: prev.psaQty != null && adjusted != null ? prev.psaQty - adjusted : 0,
              };
            });
          }}
        />
      )}

      <SignOffDialog
        open={showSignOffDialog}
        onClose={() => setShowSignOffDialog(false)}
        summary={{
          matched: summary?.matched || 0,
          forceMatched: summary?.forceMatched || 0,
          dismissed: summary?.dismissed || 0,
          reviewed: summary?.reviewed || 0,
        }}
        unresolvedItems={unresolvedItems}
        onConfirm={handleSignOff}
        isSigningOff={isSigningOff}
        verificationState={verificationState}
      />

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
          pax8Products={pax8Recons.map(r => ({ name: r.productName, quantity: r.vendorQty, price: r.price }))}
          devices={devices}
          vendorMappings={customerData?.vendorMappings || {}}
          onSelect={(selectedItems) => handleSaveMapping(mappingRecon.ruleId, mappingRecon.productName, selectedItems)}
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
