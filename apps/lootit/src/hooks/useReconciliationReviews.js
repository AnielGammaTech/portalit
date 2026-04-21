import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { client } from '@/api/client';
import { supabase } from '@/api/client';
import { useAuth } from '@/lib/AuthContext';
import { toast } from 'sonner';

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
    const { error } = await supabase.from('reconciliation_review_history').insert({
      review_id: reviewId || null,
      customer_id: customerId,
      rule_id: ruleId,
      action,
      status,
      notes: notes || null,
      psa_qty: psaQty ?? null,
      vendor_qty: vendorQty ?? null,
      created_by: user?.id || null,
      created_by_name: user?.full_name || user?.email || null,
    });
    if (error) console.warn('[logHistory]', error.message);
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
    onError: (err) => {
      toast.error(`Save failed: ${err.message || 'Unknown error'}`);
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
    const result = await upsertMutation.mutateAsync({
      ruleId,
      status: existing?.status || 'reviewed',
      action: 'exclusion',
      notes: existing?.notes,
      psaQty: existing?.psa_qty,
      vendorQty: existing?.vendor_qty,
      exclusionCount: exclusionCount || 0,
      exclusionReason: exclusionReason || null,
    });
    if (result?.id && exclusionCount > 0) {
      await supabase
        .from('reconciliation_reviews')
        .update({ exclusion_verified_at: new Date().toISOString() })
        .eq('id', result.id);
    }
    return result;
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

  const saveVendorDivisor = async (ruleId, divisor) => {
    const existing = reviews.find((r) => r.rule_id === ruleId);
    if (existing) {
      const { error } = await supabase
        .from('reconciliation_reviews')
        .update({ vendor_divisor: divisor })
        .eq('id', existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('reconciliation_reviews')
        .insert({
          customer_id: customerId,
          rule_id: ruleId,
          status: 'pending',
          vendor_divisor: divisor,
          reviewed_by: user?.id || null,
          reviewed_at: new Date().toISOString(),
        });
      if (error) throw error;
    }
    await logHistory({
      reviewId: existing?.id,
      ruleId,
      action: 'billing_model',
      status: existing?.status || 'pending',
      notes: divisor > 1 ? `Changed to ${divisor} devices per user` : 'Changed to Per Device',
    });
    queryClient.invalidateQueries({ queryKey: reviewsKey });
    queryClient.invalidateQueries({ queryKey: ['reconciliation_reviews'] });
    queryClient.invalidateQueries({ queryKey: historyKey });
    toast.success(divisor > 1 ? `Billing model: ${divisor} devices per user` : 'Billing model: Per Device');
  };

  const reVerifyExclusion = async (ruleId) => {
    const existing = reviews.find((r) => r.rule_id === ruleId);
    if (!existing) return;
    const { error } = await supabase
      .from('reconciliation_reviews')
      .update({ exclusion_verified_at: new Date().toISOString() })
      .eq('id', existing.id);
    if (error) throw error;
    logHistory({
      reviewId: existing.id,
      ruleId,
      action: 'exclusion_reverified',
      status: existing.status,
      notes: `Exclusions re-verified (${existing.exclusion_count} excluded)`,
      psaQty: existing.psa_qty,
      vendorQty: existing.vendor_qty,
    });
    queryClient.invalidateQueries({ queryKey: reviewsKey });
    queryClient.invalidateQueries({ queryKey: historyKey });
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
    reVerifyExclusion,
    saveVendorDivisor,
    isSaving: upsertMutation.isPending,
  };
}
