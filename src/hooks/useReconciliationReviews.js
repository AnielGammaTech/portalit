import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { client } from '@/api/client';
import { supabase } from '@/api/client';
import { useAuth } from '@/lib/AuthContext';
import { toast } from 'sonner';

// The rule_id column is TEXT. Values can be:
// - A UUID (from reconciliation_rules)
// - "unmatched_<uuid>" (synthetic, from unmatched line items)
// - "pax8:<name>" or "pax8:<uuid>" (from Pax8 reconciliation)
// All are stored as-is — no stripping needed.

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

  const findReview = (ruleId) =>
    reviews.find((r) => r.rule_id === ruleId);

  // Log every action to the history table
  const logHistory = async ({ reviewId, ruleId, action, status, notes, psaQty, vendorQty }) => {
    try {
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
    } catch (_err) {
      // History logging is non-critical — don't block the main operation
    }
  };

  const upsertMutation = useMutation({
    mutationFn: async ({ ruleId, status, notes, psaQty, vendorQty, action, exclusionCount, exclusionReason }) => {
      const existing = findReview(ruleId);
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
      // Check if a review already exists for this customer+rule
      const { data: existingRow } = await supabase
        .from('reconciliation_reviews')
        .select('id')
        .eq('customer_id', customerId)
        .eq('rule_id', ruleId)
        .maybeSingle();

      let data;
      if (existingRow) {
        // Update existing review
        const { data: updated, error: updateErr } = await supabase
          .from('reconciliation_reviews')
          .update(payload)
          .eq('id', existingRow.id)
          .select()
          .single();
        if (updateErr) throw new Error(updateErr.message || 'Failed to update review');
        data = updated;
      } else {
        // Insert new review
        const { data: inserted, error: insertErr } = await supabase
          .from('reconciliation_reviews')
          .insert(payload)
          .select()
          .single();
        if (insertErr) throw new Error(insertErr.message || 'Failed to save review');
        data = inserted;
      }

      // Log to history (fire-and-forget)
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
      toast.error(err.message || 'Failed to save review');
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
    const existing = findReview(ruleId);
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
    const existing = findReview(ruleId);
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
    const existing = findReview(ruleId);
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

  const saveVendorDivisor = async (ruleId, divisor) => {
    const existing = findReview(ruleId);
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
    queryClient.invalidateQueries({ queryKey: reviewsKey });
    queryClient.invalidateQueries({ queryKey: ['reconciliation_reviews'] });
    toast.success(divisor > 1 ? `Billing model: ${divisor} devices per user` : 'Billing model: Per Device');
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
    saveVendorDivisor,
    isSaving: upsertMutation.isPending,
  };
}
