import { getServiceSupabase } from '../lib/supabase.js';

const ANOMALY_THRESHOLD = 0.10; // 10% change triggers alert
const MIN_HISTORY_MONTHS = 2;   // Need at least 2 months of history
const LOOKBACK_MONTHS = 6;      // Compare against last 6 months

/**
 * Scan all customers for billing anomalies.
 * Compares each customer's latest recurring bill total against their historical average.
 * Creates alerts for changes exceeding the threshold.
 *
 * Designed to run weekly via cron.
 */
export default async function scanBillingAnomalies({ action } = {}) {
  const supabase = getServiceSupabase();
  const results = { scanned: 0, anomalies: 0, errors: [] };

  try {
    // 1. Fetch all active recurring bills with customer info
    const { data: bills, error: billsErr } = await supabase
      .from('recurring_bills')
      .select('id, customer_id, amount, created_date, start_date, status')
      .order('created_date', { ascending: false });

    if (billsErr) throw billsErr;
    if (!bills || bills.length === 0) return { ...results, message: 'No bills found' };

    // 2. Group bills by customer, sorted by date desc
    const billsByCustomer = {};
    for (const bill of bills) {
      if (!bill.customer_id || !bill.amount) continue;
      if (!billsByCustomer[bill.customer_id]) billsByCustomer[bill.customer_id] = [];
      billsByCustomer[bill.customer_id].push({
        amount: parseFloat(bill.amount) || 0,
        date: new Date(bill.created_date || bill.start_date || 0),
        status: bill.status,
      });
    }

    // 3. Get existing open anomalies to avoid duplicates
    const { data: existingAnomalies } = await supabase
      .from('billing_anomalies')
      .select('customer_id, bill_period')
      .in('status', ['open', 'reviewed']);

    const existingSet = new Set(
      (existingAnomalies || []).map(a => `${a.customer_id}:${a.bill_period}`)
    );

    // 4. Analyze each customer
    const newAnomalies = [];

    for (const [custId, custBills] of Object.entries(billsByCustomer)) {
      results.scanned++;

      // Sort by date descending
      const sorted = custBills.sort((a, b) => b.date - a.date);
      if (sorted.length < MIN_HISTORY_MONTHS) continue;

      const latest = sorted[0];
      const billPeriod = `${latest.date.getFullYear()}-${String(latest.date.getMonth() + 1).padStart(2, '0')}`;

      // Skip if we already have an anomaly for this customer+period
      if (existingSet.has(`${custId}:${billPeriod}`)) continue;

      // Historical average (months 2 through LOOKBACK_MONTHS+1)
      const historical = sorted.slice(1, LOOKBACK_MONTHS + 1);
      if (historical.length < MIN_HISTORY_MONTHS) continue;

      const avgAmount = historical.reduce((s, b) => s + b.amount, 0) / historical.length;
      if (avgAmount === 0) continue;

      const pctChange = ((latest.amount - avgAmount) / avgAmount) * 100;
      const dollarChange = latest.amount - avgAmount;

      // Only flag if exceeds threshold
      if (Math.abs(pctChange) < ANOMALY_THRESHOLD * 100) continue;

      newAnomalies.push({
        customer_id: custId,
        current_amount: latest.amount,
        previous_avg: Math.round(avgAmount * 100) / 100,
        pct_change: Math.round(pctChange * 100) / 100,
        dollar_change: Math.round(dollarChange * 100) / 100,
        direction: pctChange > 0 ? 'increase' : 'decrease',
        status: 'open',
        bill_period: billPeriod,
      });
    }

    // 5. Insert new anomalies (skip conflicts on unique constraint)
    if (newAnomalies.length > 0) {
      const { error: insertErr } = await supabase
        .from('billing_anomalies')
        .upsert(newAnomalies, { onConflict: 'customer_id,bill_period', ignoreDuplicates: true });

      if (insertErr) {
        results.errors.push(`Insert error: ${insertErr.message}`);
      } else {
        results.anomalies = newAnomalies.length;
      }
    }

    return {
      success: true,
      ...results,
      message: `Scanned ${results.scanned} customers, found ${results.anomalies} new anomalies`,
    };

  } catch (err) {
    return {
      success: false,
      ...results,
      error: err.message,
    };
  }
}
