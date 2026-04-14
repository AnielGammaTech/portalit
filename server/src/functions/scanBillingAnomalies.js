import { getServiceSupabase } from '../lib/supabase.js';

const ANOMALY_THRESHOLD = 0.05;
const MIN_HISTORY_MONTHS = 2;
const LOOKBACK_MONTHS = 6;
const SCANNED_CATEGORIES = ['monthly_recurring', 'voip'];

export default async function scanBillingAnomalies({ action } = {}) {
  const supabase = getServiceSupabase();
  const results = { scanned: 0, anomalies: 0, errors: [] };

  try {
    // 1. Fetch all classified MONTHLY invoices with amounts > 0 (exclude yearly/quarterly)
    const { data: invoices, error: invErr } = await supabase
      .from('invoices')
      .select('id, customer_id, category, total, invoice_date, due_date, created_date, billing_frequency')
      .in('category', SCANNED_CATEGORIES)
      .in('billing_frequency', ['monthly', null])
      .gt('total', 0)
      .order('invoice_date', { ascending: false })
      .limit(10000);

    if (invErr) throw invErr;
    if (!invoices || invoices.length === 0) {
      return { ...results, message: 'No classified invoices found' };
    }

    // 2. Group invoices by (customer_id, category, month)
    const grouped = {};
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    for (const inv of invoices) {
      const date = new Date(inv.due_date || inv.invoice_date || inv.created_date || 0);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (monthKey === currentMonthKey) continue;

      const key = `${inv.customer_id}:${inv.category}`;
      if (!grouped[key]) grouped[key] = { customerId: inv.customer_id, category: inv.category, months: {} };
      if (!grouped[key].months[monthKey]) grouped[key].months[monthKey] = 0;
      grouped[key].months[monthKey] += parseFloat(inv.total) || 0;
    }

    // 3. Get existing anomalies to avoid duplicates
    const { data: existingAnomalies } = await supabase
      .from('billing_anomalies')
      .select('customer_id, category, bill_period, status')
      .in('status', ['open', 'reviewed', 'acknowledged']);

    const existingSet = new Set(
      (existingAnomalies || []).map(a => `${a.customer_id}:${a.category || ''}:${a.bill_period}`)
    );

    // 4. Analyze each customer+category group
    const newAnomalies = [];

    for (const [, group] of Object.entries(grouped)) {
      results.scanned++;

      const sortedMonths = Object.entries(group.months)
        .map(([month, amount]) => ({ month, amount }))
        .sort((a, b) => b.month.localeCompare(a.month));

      if (sortedMonths.length < MIN_HISTORY_MONTHS) continue;

      const latest = sortedMonths[0];
      const billPeriod = latest.month;

      if (existingSet.has(`${group.customerId}:${group.category}:${billPeriod}`)) continue;

      const historical = sortedMonths.slice(1, LOOKBACK_MONTHS + 1);
      if (historical.length < MIN_HISTORY_MONTHS) continue;

      const avgAmount = historical.reduce((s, b) => s + b.amount, 0) / historical.length;
      if (avgAmount === 0) continue;

      const pctChange = ((latest.amount - avgAmount) / avgAmount) * 100;
      const dollarChange = latest.amount - avgAmount;

      if (Math.abs(pctChange) < ANOMALY_THRESHOLD * 100) continue;

      newAnomalies.push({
        customer_id: group.customerId,
        category: group.category,
        current_amount: Math.round(latest.amount * 100) / 100,
        previous_avg: Math.round(avgAmount * 100) / 100,
        pct_change: Math.round(pctChange * 100) / 100,
        dollar_change: Math.round(dollarChange * 100) / 100,
        direction: pctChange > 0 ? 'increase' : 'decrease',
        status: 'open',
        bill_period: billPeriod,
        flagged_on_customer: true,
      });
    }

    // 5. Insert new anomalies
    if (newAnomalies.length > 0) {
      const { error: insertErr } = await supabase
        .from('billing_anomalies')
        .upsert(newAnomalies, { onConflict: 'customer_id,category,bill_period', ignoreDuplicates: true });

      if (insertErr) {
        results.errors.push(`Insert error: ${insertErr.message}`);
      } else {
        results.anomalies = newAnomalies.length;
      }
    }

    return {
      success: true,
      ...results,
      message: `Scanned ${results.scanned} customer+category groups, found ${results.anomalies} new anomalies`,
    };

  } catch (err) {
    return {
      success: false,
      ...results,
      error: err.message,
    };
  }
}
