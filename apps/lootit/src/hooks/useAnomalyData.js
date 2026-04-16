import { useState, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { client } from '@/api/client';
import { useAuth } from '@/lib/AuthContext';

export function useAnomalyData(customerId) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [acknowledgeId, setAcknowledgeId] = useState(null);
  const [acknowledgeNotes, setAcknowledgeNotes] = useState('');
  const [showHistory, setShowHistory] = useState(false);

  const { data: customerAnomalies = [] } = useQuery({
    queryKey: ['billing_anomalies_customer', customerId],
    queryFn: () => client.entities.BillingAnomaly.filter({
      customer_id: customerId,
      flagged_on_customer: true,
    }),
    staleTime: 1000 * 60 * 2,
  });

  const { data: customerInvoices = [] } = useQuery({
    queryKey: ['lootit_invoices_customer', customerId],
    queryFn: () => client.entities.Invoice.filter({ customer_id: customerId }),
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

  const yearlyAmounts = useMemo(() => {
    if (!customerInvoices || customerInvoices.length === 0) return new Set();
    const amountMonths = {};
    for (const inv of customerInvoices) {
      const amt = (parseFloat(inv.total) || 0).toFixed(2);
      if (parseFloat(amt) <= 0) continue;
      const date = new Date(inv.due_date || inv.invoice_date || inv.created_date || 0);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!amountMonths[amt]) amountMonths[amt] = new Set();
      amountMonths[amt].add(monthKey);
    }
    const yearly = new Set();
    for (const inv of customerInvoices) {
      if ((inv.billing_frequency || '').toLowerCase() === 'yearly') {
        yearly.add((parseFloat(inv.total) || 0).toFixed(2));
      }
    }
    const maxMonths = Math.max(...Object.values(amountMonths).map(s => s.size), 0);
    if (maxMonths >= 4) {
      for (const [amt, months] of Object.entries(amountMonths)) {
        if (months.size <= 2) yearly.add(amt);
      }
    }
    return yearly;
  }, [customerInvoices]);

  const anomalyHistory = useMemo(() => {
    if (!customerInvoices || customerInvoices.length === 0) return {};
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const byCategory = {};

    for (const inv of customerInvoices) {
      if (!inv.category || (parseFloat(inv.total) || 0) <= 0) continue;
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

  const handleAcknowledgeAnomaly = useCallback(async (anomalyId) => {
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
      queryClient.invalidateQueries({ queryKey: ['billing_anomalies_customer', customerId] });
      setAcknowledgeId(null);
      setAcknowledgeNotes('');
      toast.success('Anomaly acknowledged');
    } catch (err) {
      console.error('[Anomaly] Acknowledge failed:', err);
      toast.error(err.message || 'Failed to acknowledge anomaly');
    }
  }, [acknowledgeNotes, user, customerId, queryClient]);

  const handleDismissAnomaly = useCallback(async (anomalyId) => {
    await client.entities.BillingAnomaly.update(anomalyId, {
      status: 'dismissed',
      reviewed_at: new Date().toISOString(),
    });
    queryClient.invalidateQueries({ queryKey: ['billing_anomalies_customer', customerId] });
    toast.success('Anomaly dismissed');
  }, [customerId, queryClient]);

  return {
    customerInvoices,
    openAnomalies,
    resolvedAnomalies,
    anomalyHistory,
    acknowledgeId,
    setAcknowledgeId,
    acknowledgeNotes,
    setAcknowledgeNotes,
    showHistory,
    setShowHistory,
    handleAcknowledgeAnomaly,
    handleDismissAnomaly,
  };
}
