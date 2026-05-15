import { getServiceSupabase } from '../lib/supabase.js';

/**
 * Expires reconciliation reviews older than 30 days.
 *
 * Reviews that were signed off (reviewed, dismissed, force_matched) more than
 * 30 days ago are reset to 'pending' so they must be re-reviewed.
 *
 * The original sign-off is preserved in the reconciliation_review_history table
 * and a new 'auto_expired' entry is logged for the audit trail.
 */
export async function expireReconciliationReviews(_body, _user) {
  const supabase = getServiceSupabase();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Find all reviews that were signed off more than 30 days ago
  const { data: expiredReviews, error: fetchError } = await supabase
    .from('reconciliation_reviews')
    .select('*')
    .in('status', ['reviewed', 'dismissed', 'force_matched'])
    .lt('reviewed_at', thirtyDaysAgo);

  if (fetchError) {
    return { success: false, error: fetchError.message };
  }

  if (!expiredReviews || expiredReviews.length === 0) {
    return { success: true, message: 'No expired reviews found', expired: 0 };
  }

  let expired = 0;
  let failed = 0;

  for (const review of expiredReviews) {
    // Log the expiration to history before resetting
    const { error: historyError } = await supabase
      .from('reconciliation_review_history')
      .insert({
        review_id: review.id,
        customer_id: review.customer_id,
        rule_id: review.rule_id,
        action: 'auto_expired',
        status: 'pending',
        notes: `Auto-expired after 30 days. Previous status: ${review.status}, signed off at: ${review.reviewed_at}${review.notes ? ` | Original notes: ${review.notes}` : ''}`,
        psa_qty: review.psa_qty,
        vendor_qty: review.vendor_qty,
        created_by: null,
      });

    if (historyError) {
      failed++;
      continue;
    }

    // Reset the review to pending
    const { error: updateError } = await supabase
      .from('reconciliation_reviews')
      .update({
        status: 'pending',
        reviewed_at: new Date().toISOString(),
        reviewed_by: null,
        notes: `[AUTO-EXPIRED ${new Date().toLocaleDateString()}] Previous: ${review.status}. ${review.notes || ''}`.trim(),
      })
      .eq('id', review.id);

    if (updateError) {
      failed++;
    } else {
      expired++;
    }
  }

  return {
    success: true,
    message: `Expired ${expired} reviews (${failed} failed)`,
    expired,
    failed,
    total: expiredReviews.length,
  };
}
