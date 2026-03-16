import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { client } from '@/api/client';
import {
  INTEGRATION_MAPPING_ENTITIES,
  reconcileCustomer,
  reconcilePax8Products,
  getDiscrepancySummary,
} from '@/lib/lootit-reconciliation';

/**
 * Fetches all data needed for reconciliation and computes results.
 *
 * When `customerId` is provided, returns reconciliation for that customer only.
 * When omitted, returns reconciliations for ALL customers (dashboard view).
 */
export function useReconciliationData(customerId) {
  // 1. Fetch all reconciliation rules
  const { data: rules = [], isLoading: loadingRules } = useQuery({
    queryKey: ['reconciliation_rules'],
    queryFn: () => client.entities.ReconciliationRule.list('created_date'),
    staleTime: 1000 * 60 * 5,
  });

  // 2. Fetch customers
  const { data: customers = [], isLoading: loadingCustomers } = useQuery({
    queryKey: ['customers'],
    queryFn: () => client.entities.Customer.list('name', 500),
    staleTime: 1000 * 60 * 5,
  });

  // 3. Fetch recurring bills + line items
  const { data: bills = [], isLoading: loadingBills } = useQuery({
    queryKey: ['recurring_bills'],
    queryFn: () => client.entities.RecurringBill.list('-created_date', 1000),
    staleTime: 1000 * 60 * 5,
  });

  const { data: lineItems = [], isLoading: loadingLineItems } = useQuery({
    queryKey: ['recurring_bill_line_items'],
    queryFn: () => client.entities.RecurringBillLineItem.list(null, 5000),
    staleTime: 1000 * 60 * 5,
  });

  // 4. Fetch all integration mapping tables
  const mappingQueries = {};
  for (const [key, entityName] of Object.entries(INTEGRATION_MAPPING_ENTITIES)) {
    mappingQueries[key] = useQuery({
      queryKey: [`${key}_mappings`],
      queryFn: () => client.entities[entityName].list(),
      staleTime: 1000 * 60 * 5,
    });
  }

  // 5. Fetch reviews (all or for specific customer)
  const { data: reviews = [], isLoading: loadingReviews } = useQuery({
    queryKey: customerId
      ? ['reconciliation_reviews', customerId]
      : ['reconciliation_reviews_all'],
    queryFn: () =>
      customerId
        ? client.entities.ReconciliationReview.filter({ customer_id: customerId })
        : client.entities.ReconciliationReview.list(),
    staleTime: 1000 * 60 * 2,
  });

  const isLoading =
    loadingRules ||
    loadingCustomers ||
    loadingBills ||
    loadingLineItems ||
    loadingReviews ||
    Object.values(mappingQueries).some((q) => q.isLoading);

  // 6. Build bill → customer lookup
  const billCustomerMap = useMemo(() => {
    const map = {};
    for (const bill of bills) {
      map[bill.id] = bill.customer_id;
    }
    return map;
  }, [bills]);

  // 7. Group line items by customer
  const lineItemsByCustomer = useMemo(() => {
    const grouped = {};
    for (const li of lineItems) {
      const custId = billCustomerMap[li.recurring_bill_id];
      if (!custId) continue;
      if (!grouped[custId]) grouped[custId] = [];
      grouped[custId].push(li);
    }
    return grouped;
  }, [lineItems, billCustomerMap]);

  // 8. Build mappings-by-customer: { customerId: { integration_key: mapping } }
  const mappingsByCustomer = useMemo(() => {
    const result = {};
    for (const [integrationKey, query] of Object.entries(mappingQueries)) {
      const rows = query.data || [];

      if (integrationKey === 'bullphish') {
        // BullPhish: pick latest report per customer, wrap as cached_data
        const byCustomer = {};
        for (const row of rows) {
          if (!row.customer_id) continue;
          const prev = byCustomer[row.customer_id];
          if (!prev || new Date(row.report_date) > new Date(prev.report_date)) {
            byCustomer[row.customer_id] = row;
          }
        }
        for (const [custId, report] of Object.entries(byCustomer)) {
          if (!result[custId]) result[custId] = {};
          result[custId][integrationKey] = {
            customer_id: custId,
            cached_data: {
              total_emails_sent: report.total_emails_sent || 0,
              user_count: report.total_emails_sent || 0,
            },
          };
        }
        continue;
      }

      if (integrationKey === 'darkweb') {
        // DarkWeb: count mappings per customer as domain_count
        const countByCustomer = {};
        for (const row of rows) {
          if (!row.customer_id) continue;
          countByCustomer[row.customer_id] = (countByCustomer[row.customer_id] || 0) + 1;
        }
        for (const [custId, count] of Object.entries(countByCustomer)) {
          if (!result[custId]) result[custId] = {};
          result[custId][integrationKey] = {
            customer_id: custId,
            cached_data: { domain_count: count },
          };
        }
        continue;
      }

      for (const row of rows) {
        if (!row.customer_id) continue;
        if (!result[row.customer_id]) result[row.customer_id] = {};
        result[row.customer_id][integrationKey] = row;
      }
    }
    return result;
  }, [
    // Depend on the data arrays themselves, not the query objects
    ...Object.values(mappingQueries).map((q) => q.data),
  ]);

  // 9. Group reviews by customer
  const reviewsByCustomer = useMemo(() => {
    const grouped = {};
    for (const r of reviews) {
      if (!grouped[r.customer_id]) grouped[r.customer_id] = [];
      grouped[r.customer_id].push(r);
    }
    return grouped;
  }, [reviews]);

  // 10. Compute reconciliation for each customer (or just one)
  const reconciliations = useMemo(() => {
    if (isLoading || rules.length === 0) return {};

    const targetCustomers = customerId
      ? customers.filter((c) => c.id === customerId)
      : customers;

    const results = {};
    for (const customer of targetCustomers) {
      const custLineItems = lineItemsByCustomer[customer.id] || [];
      const custMappings = mappingsByCustomer[customer.id] || {};
      const custReviews = reviewsByCustomer[customer.id] || [];

      const recon = reconcileCustomer(custLineItems, custMappings, rules, custReviews);

      // Auto-reconcile Pax8 products per-product
      const pax8Recon = custMappings.pax8
        ? reconcilePax8Products(custLineItems, custMappings.pax8)
        : [];

      // Only include customers that have at least some data to reconcile
      const hasData = recon.some(
        (r) => r.status !== 'no_data'
      );
      if (hasData || custLineItems.length > 0 || pax8Recon.length > 0) {
        results[customer.id] = {
          customer,
          reconciliations: recon,
          pax8Reconciliations: pax8Recon,
          summary: getDiscrepancySummary(recon),
        };
      }
    }
    return results;
  }, [
    isLoading,
    rules,
    customers,
    customerId,
    lineItemsByCustomer,
    mappingsByCustomer,
    reviewsByCustomer,
  ]);

  // 11. Global summary across all customers
  const globalSummary = useMemo(() => {
    const all = Object.values(reconciliations);
    return {
      totalCustomers: all.length,
      customersWithIssues: all.filter(
        (c) => c.summary.over > 0 || c.summary.under > 0 || (c.pax8Reconciliations || []).some(r => r.status !== 'match')
      ).length,
      pax8MissingFromPsa: all.reduce((s, c) => s + (c.pax8Reconciliations || []).filter(r => r.status === 'missing_from_psa').length, 0),
      totalMatched: all.reduce((s, c) => s + c.summary.matched, 0),
      totalOver: all.reduce((s, c) => s + c.summary.over, 0),
      totalUnder: all.reduce((s, c) => s + c.summary.under, 0),
      totalNoData: all.reduce((s, c) => s + c.summary.noData, 0),
      totalReviewed: all.reduce((s, c) => s + c.summary.reviewed, 0),
    };
  }, [reconciliations]);

  return {
    reconciliations,
    globalSummary,
    rules,
    customers,
    isLoading,
  };
}
