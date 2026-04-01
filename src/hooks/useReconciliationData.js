import { useMemo } from 'react';
import { useQuery, useQueries } from '@tanstack/react-query';
import { client } from '@/api/client';
import {
  INTEGRATION_MAPPING_ENTITIES,
  reconcileCustomer,
  reconcilePax8Subscriptions,
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
    retry: 2,
  });

  const { data: lineItems = [], isLoading: loadingLineItems } = useQuery({
    queryKey: ['recurring_bill_line_items'],
    queryFn: () => client.entities.RecurringBillLineItem.list(null, 5000),
    staleTime: 1000 * 60 * 5,
    retry: 2,
  });

  // 4. Fetch all integration mapping tables (useQueries to avoid hooks-in-loop)
  // De-duplicate entity names so we don't fetch the same table multiple times
  const mappingEntries = Object.entries(INTEGRATION_MAPPING_ENTITIES);
  const uniqueEntities = [...new Set(Object.values(INTEGRATION_MAPPING_ENTITIES))];
  const entityQueryResults = useQueries({
    queries: uniqueEntities.map((entityName) => ({
      queryKey: [`lootit_entity_${entityName}`],
      queryFn: () => client.entities[entityName].list(),
      staleTime: 1000 * 60 * 5,
      retry: 1,
    })),
  });
  // Map entity results back to integration keys
  const entityDataMap = {};
  uniqueEntities.forEach((name, idx) => { entityDataMap[name] = entityQueryResults[idx]; });
  const mappingQueryResults = mappingEntries.map(([, entityName]) => entityDataMap[entityName]);
  // Build a keyed object from the results array
  const mappingQueries = {};
  mappingEntries.forEach(([key], idx) => {
    mappingQueries[key] = mappingQueryResults[idx];
  });

  // 5. Fetch Pax8 line-item overrides (manual mappings)
  const { data: pax8Overrides = [], isLoading: loadingOverrides } = useQuery({
    queryKey: customerId
      ? ['pax8_line_item_overrides', customerId]
      : ['pax8_line_item_overrides_all'],
    queryFn: () =>
      customerId
        ? client.entities.Pax8LineItemOverride.filter({ customer_id: customerId })
        : client.entities.Pax8LineItemOverride.list(),
    staleTime: 1000 * 60 * 2,
  });

  // 6. Fetch reviews (all or for specific customer)
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

  // Only block on core data (rules + customers + bills).
  // Mapping queries load progressively — treat errors as "done".
  const isLoading =
    loadingRules ||
    loadingCustomers ||
    loadingBills ||
    loadingLineItems;

  // 6. Build set of active bill IDs (exclude inactive/expired bills)
  const activeBillIds = useMemo(() => {
    const now = new Date();
    return new Set(
      bills
        .filter(b => {
          if ((b.status || '').toLowerCase() === 'inactive') return false;
          if (b.end_date) {
            const end = new Date(b.end_date);
            if (end.getFullYear() < 2090 && end < now) return false;
          }
          return true;
        })
        .map(b => b.id)
    );
  }, [bills]);

  // 6b. Build bill → customer lookup (active bills only)
  const billCustomerMap = useMemo(() => {
    const map = {};
    for (const bill of bills) {
      if (!activeBillIds.has(bill.id)) continue;
      map[bill.id] = bill.customer_id;
    }
    return map;
  }, [bills, activeBillIds]);

  // 7. Group line items by customer (only from active bills)
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
          const rd = report.report_data || {};
          result[custId][integrationKey] = {
            customer_id: custId,
            cached_data: {
              total_emails_sent: rd.total_emails_sent || 0,
              user_count: rd.total_emails_sent || 0,
            },
          };
        }
        continue;
      }

      if (integrationKey === 'darkweb') {
        // DarkWeb: pick latest report per customer, use report_data as cached_data
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
          const rd = report.report_data || {};
          result[custId][integrationKey] = {
            customer_id: custId,
            cached_data: {
              domains_count: rd.domains_count || 0,
              domains_monitored: rd.domains_monitored || [],
              domain_count: rd.domains_count || 0,
            },
          };
        }
        continue;
      }

      if (integrationKey === 'threecx') {
        // ThreeCX: pick latest report per customer, build cached_data from report columns
        const byCustomer = {};
        for (const row of rows) {
          if (!row.customer_id) continue;
          const prev = byCustomer[row.customer_id];
          if (!prev || new Date(row.report_date || row.created_date || '') > new Date(prev.report_date || prev.created_date || '')) {
            byCustomer[row.customer_id] = row;
          }
        }
        for (const [custId, report] of Object.entries(byCustomer)) {
          if (!result[custId]) result[custId] = {};
          result[custId][integrationKey] = {
            customer_id: custId,
            cached_data: {
              user_extensions: report.user_extensions || 0,
              total_extensions: report.total_extensions || 0,
              ring_groups: report.ring_groups || 0,
              queues: report.queues || 0,
              trunks: report.trunks || 0,
            },
          };
        }
        continue;
      }

      for (const row of rows) {
        if (!row.customer_id) continue;
        if (!result[row.customer_id]) result[row.customer_id] = {};
        const existing = result[row.customer_id][integrationKey];
        if (existing && (integrationKey === 'unifi' || integrationKey === 'unifi_firewall')) {
          // Merge multiple UniFi sites: combine devices and summary counts
          const existingData = typeof existing.cached_data === 'string' ? (() => { try { return JSON.parse(existing.cached_data); } catch { return {}; } })() : (existing.cached_data || {});
          const newData = typeof row.cached_data === 'string' ? (() => { try { return JSON.parse(row.cached_data); } catch { return {}; } })() : (row.cached_data || {});
          const mergedDevices = [...(existingData.devices || []), ...(newData.devices || [])];
          const mergedSummary = {};
          for (const k of Object.keys(existingData.summary || {})) {
            mergedSummary[k] = (existingData.summary[k] || 0) + ((newData.summary || {})[k] || 0);
          }
          result[row.customer_id][integrationKey] = {
            ...row,
            cached_data: { ...existingData, ...newData, devices: mergedDevices, summary: { ...(newData.summary || {}), ...mergedSummary }, total_devices: mergedDevices.length },
          };
        } else {
          result[row.customer_id][integrationKey] = row;
        }
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

  // 10. Group Pax8 overrides by customer
  const overridesByCustomer = useMemo(() => {
    const grouped = {};
    for (const ov of pax8Overrides) {
      if (!grouped[ov.customer_id]) grouped[ov.customer_id] = [];
      grouped[ov.customer_id].push(ov);
    }
    return grouped;
  }, [pax8Overrides]);

  // 11. Compute reconciliation for each customer (or just one)
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

      const custOverrides = overridesByCustomer[customer.id] || [];

      // Run Pax8 FIRST to collect matched line item IDs
      const pax8Recon = custMappings.pax8
        ? reconcilePax8Subscriptions(custLineItems, custMappings.pax8, custReviews, custOverrides)
        : [];
      const pax8MatchedIds = pax8Recon._pax8MatchedLineItemIds || new Set();

      // Then run rule-based reconciliation with Pax8 exclusions
      const recon = reconcileCustomer(custLineItems, custMappings, rules, custReviews, custOverrides, pax8MatchedIds);

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
    overridesByCustomer,
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
    bills,
    lineItems,
    isLoading,
  };
}
