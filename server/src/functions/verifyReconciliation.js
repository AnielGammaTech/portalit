import { getServiceSupabase } from '../lib/supabase.js';
import Anthropic from '@anthropic-ai/sdk';

let anthropicClient = null;
function getAnthropic() {
  if (!anthropicClient) anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return anthropicClient;
}

/**
 * AI-powered reconciliation verification and sign-off.
 *
 * Actions:
 *   verify   — Run AI check, return issues or approve
 *   sign_off — Record sign-off after verification passes
 *   status   — Get latest sign-off status for a customer
 */
export async function verifyReconciliation(body, user) {
  const supabase = getServiceSupabase();
  const { action, customer_id } = body;

  if (!customer_id) throw Object.assign(new Error('customer_id required'), { statusCode: 400 });

  switch (action) {
    case 'verify': return runVerification(supabase, body, user);
    case 'sign_off': return recordSignOff(supabase, body, user);
    case 'status': return getSignOffStatus(supabase, customer_id);
    default: throw Object.assign(new Error(`Unknown action: ${action}`), { statusCode: 400 });
  }
}

async function runVerification(supabase, body, user) {
  const { customer_id, customer_name, reconciliations, pax8_reconciliations, unmatched_items } = body;

  // Build a clear summary for the AI
  const items = [];

  for (const r of (reconciliations || [])) {
    items.push({
      service: r.rule?.label || 'Unknown',
      integration: r.integrationLabel || r.rule?.integration_key,
      psa_qty: r.psaQty,
      vendor_qty: r.vendorQty,
      status: r.status,
      has_review: !!r.review,
      review_status: r.review?.status || null,
      review_notes: r.review?.notes || null,
      exclusions: r.review?.exclusion_count || 0,
      exclusion_reason: r.review?.exclusion_reason || null,
      is_unmatched: r.isUnmatchedLineItem || false,
    });
  }

  for (const r of (pax8_reconciliations || [])) {
    items.push({
      service: r.productName || 'Pax8 Product',
      integration: 'Pax8',
      psa_qty: r.psaQty,
      vendor_qty: r.vendorQty,
      status: r.status,
      has_review: !!r.review,
      review_status: r.review?.status || null,
      review_notes: r.review?.notes || null,
      is_pax8: true,
    });
  }

  const prompt = `You are a billing reconciliation auditor for an MSP (Managed Service Provider).
Review the following reconciliation data for customer "${customer_name}" and determine if it's ready for sign-off.

RECONCILIATION ITEMS (excluding no_data — those integrations are not connected):
${JSON.stringify(items.filter(i => i.status !== 'no_data'), null, 2)}

NOTE: ${items.filter(i => i.status === 'no_data').length} services were excluded because their integrations are not connected (no_data). These are NOT applicable and should be ignored completely.

UNMATCHED BILLING ITEMS (line items on the invoice with no matching reconciliation rule):
${JSON.stringify((unmatched_items || []).map(u => ({ description: u.rule?.label, qty: u.psaQty })), null, 2)}

RULES FOR SIGN-OFF:
1. All "matched" items (PSA = Vendor) are GOOD — no issues.
2. Items with status "over" or "under" MUST have a review (review_status = "reviewed" or "dismissed") WITH notes explaining why. If they have no review or no notes, they are BLOCKERS.
3. Items with "no_data" status should be COMPLETELY IGNORED — they are not applicable. The integration is not connected for this customer so it cannot be verified. Do NOT flag these as warnings or blockers.
4. Items with "no_psa_data" or "no_vendor_data" where the vendor integration IS connected but data is missing — flag as WARNINGS only if quantities are significant (>5).
5. Unmatched billing items (status "unmatched_line_item") should be flagged as WARNINGS — they're on the invoice but not reconciled. However, if they are minor amounts or common items like "Remote Access" or "Server Support", they are low priority.
6. Items with exclusions are OK if the exclusion reason makes sense.
7. Reviewed items with notes are considered resolved — don't flag them as issues. Check that the notes make sense and explain the discrepancy.

Respond with JSON:
{
  "can_sign_off": true/false,
  "confidence": 0-100,
  "summary": "One paragraph summary of the reconciliation state",
  "blockers": ["list of items that MUST be resolved before sign-off"],
  "warnings": ["list of items to be aware of but don't block sign-off"],
  "recommendation": "Your recommendation for the reviewer"
}`;

  try {
    const anthropic = getAnthropic();
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
      system: 'You are a precise billing auditor. Respond ONLY with valid JSON, no markdown.',
    });

    const text = response.content[0]?.text || '{}';
    const aiResult = JSON.parse(text);

    // Store the verification attempt
    const billingPeriod = new Date().toISOString().slice(0, 7);
    const { data: signOff } = await supabase
      .from('reconciliation_sign_offs')
      .upsert({
        customer_id,
        signed_by: user.id,
        signed_at: new Date().toISOString(),
        status: aiResult.can_sign_off ? 'verified' : 'blocked',
        ai_verified: aiResult.can_sign_off,
        ai_confidence: aiResult.confidence || 0,
        ai_summary: aiResult.summary,
        ai_issues: { blockers: aiResult.blockers || [], warnings: aiResult.warnings || [] },
        manual_notes: aiResult.recommendation,
        reconciliation_snapshot: { items, unmatched: unmatched_items?.length || 0 },
        billing_period: billingPeriod,
      }, { onConflict: 'customer_id,billing_period' })
      .select()
      .single();

    return {
      success: true,
      ...aiResult,
      sign_off_id: signOff?.id,
    };
  } catch (err) {
    console.error('[verifyReconciliation] AI error:', err.message);
    return {
      success: false,
      error: `AI verification failed: ${err.message}`,
      can_sign_off: false,
      blockers: ['AI verification service unavailable'],
      warnings: [],
    };
  }
}

async function recordSignOff(supabase, body, user) {
  const { customer_id, sign_off_id, notes } = body;

  if (!sign_off_id) throw Object.assign(new Error('sign_off_id required'), { statusCode: 400 });

  const { data, error } = await supabase
    .from('reconciliation_sign_offs')
    .update({
      status: 'signed_off',
      signed_by: user.id,
      signed_at: new Date().toISOString(),
      manual_notes: notes || null,
    })
    .eq('id', sign_off_id)
    .eq('customer_id', customer_id)
    .select()
    .single();

  if (error) throw error;

  return { success: true, sign_off: data };
}

async function getSignOffStatus(supabase, customerId) {
  const { data } = await supabase
    .from('reconciliation_sign_offs')
    .select('*, signer:users!reconciliation_sign_offs_signed_by_fkey(full_name, email)')
    .eq('customer_id', customerId)
    .order('signed_at', { ascending: false })
    .limit(1);

  return { success: true, sign_off: data?.[0] || null };
}
