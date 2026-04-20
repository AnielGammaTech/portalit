import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { client } from '@/api/client';
import { supabase } from '@/api/client';
import { useAuth } from '@/lib/AuthContext';

export function useReconciliationReviews(customerId) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const reviewsKey = ['reconciliation_reviews', customerId];
  const historyKey = ['reconciliation_review_history', customerId];

  const {
    data: reviews = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: reviewsKey,
    queryFn: () =>
      client.entities.ReconciliationReview.filter({ customer_id: customerId }),
    enabled: !!customerId,
    staleTime: 1000 * 60 * 2,
  });

  // Log every action to the history table
  const logHistory = async ({ reviewId, ruleId, action, status, notes, psaQty, vendorQty }) => {
    await supabase.from('reconciliation_review_history').insert({
      review_id: reviewId || null,
      customer_id: customerId,
      rule_id: ruleId,
      action,
      status,
      notes: notes || null,
      psa_qty: psaQty ?? null,
      vendor_qty: vendorQty ?? null,
      created_by: user?.id || null,
    });
  };

  const upsertMutation = useMutation({
    mutationFn: async ({ ruleId, status, notes, psaQty, vendorQty, action, exclusionCount, exclusionReason }) => {
      const existing = reviews.find((r) => r.rule_id === ruleId);
      const payload = {
        customer_id: customerId,
        rule_id: ruleId,
        status,
        reviewed_by: user?.id || null,
        reviewed_at: new Date().toISOString(),
        notes: notes || null,
        psa_qty: psaQty ?? null,
        vendor_qty: vendorQty ?? null,
      };
      // Only include exclusion fields if they're explicitly provided or already exist
      if (exclusionCount !== undefined || existing?.exclusion_count) {
        payload.exclusion_count = exclusionCount ?? existing?.exclusion_count ?? 0;
        payload.exclusion_reason = exclusionReason ?? existing?.exclusion_reason ?? null;
      }
      const { data, error } = await supabase
        .from('reconciliation_reviews')
        .upsert(payload, { onConflict: 'customer_id,rule_id' })
        .select()
        .single();

      if (error) throw error;

      // Log to history (fire-and-forget, don't block the UI)
      logHistory({
        reviewId: data.id,
        ruleId,
        action: action || status,
        status,
        notes,
        psaQty,
        vendorQty,
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reviewsKey });
      queryClient.invalidateQueries({ queryKey: historyKey });
    },
  });

  const markReviewed = (ruleId, { notes, psaQty, vendorQty } = {}) =>
    upsertMutation.mutateAsync({
      ruleId,
      status: 'reviewed',
      action: 'reviewed',
      notes,
      psaQty,
      vendorQty,
    });

  const dismiss = (ruleId, { notes, psaQty, vendorQty } = {}) =>
    upsertMutation.mutateAsync({
      ruleId,
      status: 'dismissed',
      action: 'dismissed',
      notes,
      psaQty,
      vendorQty,
    });

  const resetReview = (ruleId) => {
    const existing = reviews.find((r) => r.rule_id === ruleId);
    return upsertMutation.mutateAsync({
      ruleId,
      status: 'pending',
      action: 'reset',
      notes: existing?.notes,
      psaQty: existing?.psa_qty,
      vendorQty: existing?.vendor_qty,
    });
  };

  const saveNotes = async (ruleId, notes) => {
    const existing = reviews.find((r) => r.rule_id === ruleId);
    return upsertMutation.mutateAsync({
      ruleId,
      status: existing?.status || 'pending',
      action: 'note',
      notes,
      psaQty: existing?.psa_qty,
      vendorQty: existing?.vendor_qty,
    });
  };

  const saveExclusion = async (ruleId, exclusionCount, exclusionReason) => {
    const existing = reviews.find((r) => r.rule_id === ruleId);
    return upsertMutation.mutateAsync({
      ruleId,
      status: existing?.status || 'reviewed',
      action: 'exclusion',
      notes: existing?.notes,
      psaQty: existing?.psa_qty,
      vendorQty: existing?.vendor_qty,
      exclusionCount: exclusionCount || 0,
      exclusionReason: exclusionReason || null,
    });
  };

  const forceMatch = (ruleId, notes) => {
    if (!notes || !notes.trim()) throw new Error('Notes required for force match');
    return upsertMutation.mutateAsync({
      ruleId,
      status: 'force_matched',
      action: 'force_matched',
      notes: `[FORCE MATCH by ${user?.full_name || user?.email || 'Unknown'} — ${new Date().toLocaleString()}] ${notes.trim()}`,
    });
  };

  const reVerify = (ruleId) => {
    const existing = reviews.find((r) => r.rule_id === ruleId);
    if (!existing) return Promise.resolve();
    return upsertMutation.mutateAsync({
      ruleId,
      status: existing.status,
      action: 're_verified',
      notes: existing.notes,
      psaQty: existing.psa_qty,
      vendorQty: existing.vendor_qty,
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
    saveExclusion,
    forceMatch,
    reVerify,
    isSaving: upsertMutation.isPending,
  };
}
