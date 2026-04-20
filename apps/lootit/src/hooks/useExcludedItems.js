import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/api/client';
import { useAuth } from '@/lib/AuthContext';
import { toast } from 'sonner';

export function useExcludedItems(customerId) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const queryKey = ['reconciliation_excluded_items', customerId];

  const { data: excludedItems = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reconciliation_excluded_items')
        .select('*')
        .eq('customer_id', customerId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!customerId,
    staleTime: 1000 * 60 * 2,
  });

  const saveExcludedItemsMutation = useMutation({
    mutationFn: async ({ ruleId, selectedItems, reason }) => {
      const existing = excludedItems.filter(i => i.rule_id === ruleId);
      const existingIds = new Set(existing.map(i => i.vendor_item_id));
      const selectedIds = new Set(selectedItems.map(i => i.id));

      const toAdd = selectedItems.filter(i => !existingIds.has(i.id));
      const toRemove = existing.filter(i => !selectedIds.has(i.vendor_item_id));

      if (toRemove.length > 0) {
        const { error } = await supabase
          .from('reconciliation_excluded_items')
          .delete()
          .in('id', toRemove.map(i => i.id));
        if (error) throw error;
      }

      if (toAdd.length > 0) {
        const rows = toAdd.map(item => ({
          customer_id: customerId,
          rule_id: ruleId,
          vendor_item_id: item.id,
          vendor_item_label: item.label,
          reason: reason || null,
          excluded_by: user?.id || null,
        }));
        const { error } = await supabase
          .from('reconciliation_excluded_items')
          .upsert(rows, { onConflict: 'customer_id,rule_id,vendor_item_id' });
        if (error) throw error;
      }

      if (reason !== undefined) {
        const { error } = await supabase
          .from('reconciliation_excluded_items')
          .update({ reason })
          .eq('customer_id', customerId)
          .eq('rule_id', ruleId);
        if (error) throw error;
      }

      return { added: toAdd.length, removed: toRemove.length };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (err) => {
      toast.error(`Failed to save exclusions: ${err.message}`);
    },
  });

  const removeAllForRule = useMutation({
    mutationFn: async (ruleId) => {
      const { error } = await supabase
        .from('reconciliation_excluded_items')
        .delete()
        .eq('customer_id', customerId)
        .eq('rule_id', ruleId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const logDroppedItems = async (ruleId, droppedItems) => {
    for (const item of droppedItems) {
      await supabase.from('reconciliation_review_history').insert({
        customer_id: customerId,
        rule_id: ruleId,
        action: 'exclusion_dropped',
        status: 'auto',
        notes: `${item.vendor_item_label} (${item.vendor_item_id}) no longer in vendor data`,
        created_by: null,
        created_by_name: 'System',
      });
    }

    if (droppedItems.length > 0) {
      const { error } = await supabase
        .from('reconciliation_excluded_items')
        .delete()
        .in('id', droppedItems.map(i => i.id));
      if (error) console.warn('[logDroppedItems] cleanup error:', error.message);
      queryClient.invalidateQueries({ queryKey });
    }
  };

  const detectDroppedItems = async (ruleId, currentVendorItems) => {
    const excluded = excludedItems.filter(i => i.rule_id === ruleId);
    if (excluded.length === 0 || !currentVendorItems) return;
    const currentIds = new Set(currentVendorItems.map(i => i.id));
    const dropped = excluded.filter(i => !currentIds.has(i.vendor_item_id));
    if (dropped.length > 0) {
      await logDroppedItems(ruleId, dropped);
    }
  };

  const getExcludedForRule = (ruleId) =>
    excludedItems.filter(i => i.rule_id === ruleId);

  const getExclusionCount = (ruleId, currentVendorItems) => {
    const excluded = getExcludedForRule(ruleId);
    if (excluded.length === 0) return 0;
    if (!currentVendorItems) return excluded.length;
    const currentIds = new Set(currentVendorItems.map(i => i.id));
    return excluded.filter(i => currentIds.has(i.vendor_item_id)).length;
  };

  return {
    excludedItems,
    isLoading,
    getExcludedForRule,
    getExclusionCount,
    saveExcludedItems: saveExcludedItemsMutation.mutateAsync,
    removeAllForRule: removeAllForRule.mutateAsync,
    logDroppedItems,
    detectDroppedItems,
    isSaving: saveExcludedItemsMutation.isPending,
  };
}
