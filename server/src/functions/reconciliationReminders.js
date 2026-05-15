import { getServiceSupabase } from '../lib/supabase.js';
import { sendTelegramMessage, isTelegramConfigured } from '../lib/telegram.js';

const SIGN_OFF_EXPIRY_DAYS = 30;
const REMINDER_COOLDOWN_DAYS = 7;
const EXCLUSION_STALE_DAYS = 90;
const LOOTIT_URL = process.env.LOOTIT_URL || 'https://lootit.gtools.io';

export async function reconciliationReminders(_body, _user) {
  if (!isTelegramConfigured()) {
    return { success: true, message: 'Telegram not configured — skipping', sent: 0 };
  }

  const supabase = getServiceSupabase();
  const now = new Date();
  const cooldownThreshold = new Date(now - REMINDER_COOLDOWN_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const exclusionThreshold = new Date(now - EXCLUSION_STALE_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: customers, error: custErr } = await supabase
    .from('customers')
    .select('id, name')
    .eq('active', true);

  if (custErr) return { success: false, error: custErr.message };

  const { data: signOffs } = await supabase
    .from('reconciliation_sign_offs')
    .select('id, customer_id, signed_at, reminder_sent_at')
    .eq('status', 'signed_off')
    .order('signed_at', { ascending: false });

  const latestSignOffMap = {};
  for (const so of (signOffs || [])) {
    if (!latestSignOffMap[so.customer_id]) {
      latestSignOffMap[so.customer_id] = so;
    }
  }

  const { data: activeReviews } = await supabase
    .from('reconciliation_reviews')
    .select('customer_id, rule_id, status, exclusion_count, exclusion_verified_at, reviewed_at');

  const reviewsByCustomer = {};
  for (const r of (activeReviews || [])) {
    if (!reviewsByCustomer[r.customer_id]) reviewsByCustomer[r.customer_id] = [];
    reviewsByCustomer[r.customer_id].push(r);
  }

  let skipped = 0;
  const dueCustomers = [];

  for (const customer of (customers || [])) {
    const signOff = latestSignOffMap[customer.id];
    const signedAt = signOff?.signed_at ? new Date(signOff.signed_at) : null;
    const daysSinceSignOff = signedAt
      ? Math.floor((now - signedAt) / (1000 * 60 * 60 * 24))
      : null;

    const isDue = daysSinceSignOff === null || daysSinceSignOff >= SIGN_OFF_EXPIRY_DAYS;
    if (!isDue) continue;

    if (signOff?.reminder_sent_at && signOff.reminder_sent_at > cooldownThreshold) {
      skipped++;
      continue;
    }

    const reviews = reviewsByCustomer[customer.id] || [];
    const forceMatchedCount = reviews.filter((r) => r.status === 'force_matched').length;
    const staleExclusionCount = reviews.filter((r) =>
      r.exclusion_count > 0 &&
      (!r.exclusion_verified_at || r.exclusion_verified_at < exclusionThreshold)
    ).length;

    if (reviews.length === 0 && daysSinceSignOff === null) {
      skipped++;
      continue;
    }

    dueCustomers.push({
      name: customer.name,
      id: customer.id,
      daysSinceSignOff,
      forceMatchedCount,
      staleExclusionCount,
      signOffId: signOff?.id,
    });
  }

  if (dueCustomers.length === 0) {
    return { success: true, message: 'No customers due for reconciliation', sent: 0, skipped };
  }

  const lines = ['<b>LootIT — Reconciliation Due</b>', ''];

  for (const c of dueCustomers) {
    const parts = [`<b>${c.name}</b>`];
    if (c.daysSinceSignOff === null) {
      parts.push('Never signed off');
    } else {
      parts.push(`Last signed off ${c.daysSinceSignOff}d ago`);
    }
    if (c.forceMatchedCount > 0) {
      parts.push(`${c.forceMatchedCount} force-matched`);
    }
    if (c.staleExclusionCount > 0) {
      parts.push(`${c.staleExclusionCount} stale exclusions`);
    }
    lines.push(parts.join(' · '));
  }

  lines.push('');
  lines.push(`<a href="${LOOTIT_URL}">Open LootIT</a>`);

  const result = await sendTelegramMessage(lines.join('\n'));

  if (result.success) {
    for (const c of dueCustomers) {
      if (c.signOffId) {
        await supabase
          .from('reconciliation_sign_offs')
          .update({ reminder_sent_at: now.toISOString() })
          .eq('id', c.signOffId);
      }
    }
  }

  return {
    success: true,
    message: `Sent reminder for ${dueCustomers.length} customers (${skipped} skipped/cooldown)`,
    sent: dueCustomers.length,
    skipped,
    dueCustomers: dueCustomers.map((c) => c.name),
  };
}
