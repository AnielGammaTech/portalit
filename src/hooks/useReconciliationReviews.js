import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { client } from '@/api/client';
import { supabase } from '@/api/client';
import { useAuth } from '@/lib/AuthContext';

export function useReconciliationReviews(customerId) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const queryKey = ['reconciliation_reviews', customerId];

  const {
    data: reviews = [],
    isLoading,
    error,
  } = useQuery({
    queryKey,
    queryFn: () =>
      client.entities.ReconciliationReview.filter({ customer_id: customerId }),
    enabled: !!customerId,
    staleTime: 1000 * 60 * 2,
  });

  const upsertMutation = useMutation({
    mutationFn: async ({ ruleId, status, notes, psaQty, vendorQty }) => {
      const { data, error } = await supabase
        .from('reconciliation_reviews')
        .upsert(
          {
            customer_id: customerId,
            rule_id: ruleId,
            status,
            reviewed_by: user?.id || null,
            reviewed_at: new Date().toISOString(),
            notes: notes || null,
            psa_qty: psaQty ?? null,
            vendor_qty: vendorQty ?? null,
          },
          { onConflict: 'customer_id,rule_id' }
        )
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const markReviewed = (ruleId, { notes, psaQty, vendorQty } = {}) =>
    upsertMutation.mutateAsync({
      ruleId,
      status: 'reviewed',
      notes,
      psaQty,
      vendorQty,
    });

  const dismiss = (ruleId, { notes, psaQty, vendorQty } = {}) =>
    upsertMutation.mutateAsync({
      ruleId,
      status: 'dismissed',
      notes,
      psaQty,
      vendorQty,
    });

  const resetReview = (ruleId) =>
    upsertMutation.mutateAsync({
      ruleId,
      status: 'pending',
    });

  const saveNotes = async (ruleId, notes) => {
    // Update notes on existing review, or create a pending one with notes
    const existing = reviews.find((r) => r.rule_id === ruleId);
    return upsertMutation.mutateAsync({
      ruleId,
      status: existing?.status || 'pending',
      notes,
      psaQty: existing?.psa_qty,
      vendorQty: existing?.vendor_qty,
    });
  };

  return {
    reviews,
    isLoading,
    error,
    markReviewed,
    dismiss,
    resetReview,
    saveNotes,
    isSaving: upsertMutation.isPending,
  };
}
