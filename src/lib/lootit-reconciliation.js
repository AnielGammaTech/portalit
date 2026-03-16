/**
 * LootIT Reconciliation Engine
 *
 * Pure functions that compare PSA billing quantities against vendor data.
 * No side effects — all state lives in the calling hooks/components.
 */

// ── Vendor count extractors ────────────────────────────────────────────
// Each integration stores cached_data in a different shape.
// These extractors normalise that to a single number.

const VENDOR_EXTRACTORS = {
  cove: (data) => {
    if (!data) return null;
    if (typeof data.totalDevices === 'number') return data.totalDevices;
    if (typeof data.activeDevices === 'number') return data.activeDevices;
    if (Array.isArray(data.devices)) return data.devices.length;
    return null;
  },

  cove_workstation: (data) => {
    if (!data) return null;
    if (typeof data.workstation_count === 'number') return data.workstation_count;
    if (Array.isArray(data.devices)) return data.devices.filter(d => d.osType === 'Workstation').length;
    return null;
  },

  cove_server: (data) => {
    if (!data) return null;
    if (typeof data.server_count === 'number') return data.server_count;
    if (Array.isArray(data.devices)) return data.devices.filter(d => d.osType === 'Server').length;
    return null;
  },

  datto_rmm: (data) => {
    if (!data) return null;
    if (typeof data.total_devices === 'number') return data.total_devices;
    if (typeof data.totalDevices === 'number') return data.totalDevices;
    return null;
  },

  spanning: (data) => {
    if (!data) return null;
    if (typeof data.numberOfUsers === 'number') return data.numberOfUsers;
    if (typeof data.total === 'number') return data.total;
    if (Array.isArray(data.users)) return data.users.length;
    return null;
  },

  jumpcloud: (data) => {
    if (!data) return null;
    if (typeof data.totalUsers === 'number') return data.totalUsers;
    return null;
  },

  datto_edr: (data) => {
    if (!data) return null;
    if (typeof data.total_devices === 'number') return data.total_devices;
    if (Array.isArray(data.devices)) return data.devices.length;
    return null;
  },

  unifi: (data) => {
    if (!data) return null;
    if (typeof data.total_devices === 'number') return data.total_devices;
    if (Array.isArray(data.devices)) return data.devices.length;
    return null;
  },

  rocket_cyber: (data) => {
    if (!data) return null;
    if (typeof data.total_agents === 'number') return data.total_agents;
    if (typeof data.totalAgents === 'number') return data.totalAgents;
    return null;
  },

  pax8: (data) => {
    if (!data) return null;
    if (typeof data.totalQuantity === 'number') return data.totalQuantity;
    if (typeof data.totalSubscriptions === 'number') return data.totalSubscriptions;
    if (Array.isArray(data.products)) {
      return data.products.reduce((sum, p) => sum + (p.quantity || 0), 0);
    }
    return null;
  },
};

/**
 * Extract a vendor count from cached_data for a given integration.
 * Returns null if no data or integration is unknown.
 */
export function extractVendorCount(integrationKey, cachedData) {
  const extractor = VENDOR_EXTRACTORS[integrationKey];
  if (!extractor) return null;
  return extractor(cachedData);
}

// ── Mapping table keys ─────────────────────────────────────────────────

export const INTEGRATION_MAPPING_ENTITIES = {
  cove: 'CoveDataMapping',
  cove_workstation: 'CoveDataMapping',
  cove_server: 'CoveDataMapping',
  datto_rmm: 'DattoSiteMapping',
  spanning: 'SpanningMapping',
  jumpcloud: 'JumpCloudMapping',
  datto_edr: 'DattoEDRMapping',
  unifi: 'UniFiMapping',
  rocket_cyber: 'RocketCyberMapping',
  pax8: 'Pax8Mapping',
};

export const INTEGRATION_LABELS = {
  cove: 'Cove Data Protection',
  cove_workstation: 'Cove Workstations',
  cove_server: 'Cove Servers',
  datto_rmm: 'Datto RMM',
  spanning: 'Spanning Backup',
  jumpcloud: 'JumpCloud',
  datto_edr: 'Datto EDR',
  unifi: 'UniFi Network',
  rocket_cyber: 'RocketCyber',
  pax8: 'Pax8',
};

// ── Rule matching ──────────────────────────────────────────────────────

/**
 * Test whether a line item matches a rule's pattern.
 * Case-insensitive substring match on the configured field.
 */
export function lineItemMatchesRule(lineItem, rule) {
  const field = rule.match_field || 'description';
  const value = (lineItem[field] || '').toLowerCase();
  const pattern = (rule.match_pattern || '').toLowerCase();
  if (!pattern) return false;
  return value.includes(pattern);
}

/**
 * Find all rules that match a given line item.
 */
export function matchLineItemToRules(lineItem, rules) {
  return rules.filter((rule) => rule.is_active && lineItemMatchesRule(lineItem, rule));
}

// ── Reconciliation ─────────────────────────────────────────────────────

/**
 * Reconcile a single customer.
 *
 * @param {Array} lineItems  – recurring_bill_line_items for this customer
 * @param {Object} mappings  – { integration_key: { cached_data } } per integration
 * @param {Array}  rules     – all active reconciliation_rules
 * @param {Array}  reviews   – reconciliation_reviews for this customer
 *
 * @returns {Array} reconciliation results, one per rule
 */
export function reconcileCustomer(lineItems, mappings, rules, reviews = []) {
  const activeRules = rules.filter((r) => r.is_active);
  const reviewMap = Object.fromEntries(
    reviews.map((r) => [r.rule_id, r])
  );

  return activeRules.map((rule) => {
    // 1. Sum PSA quantities from matching line items
    const matched = lineItems.filter((li) => lineItemMatchesRule(li, rule));
    const psaQty = matched.reduce((sum, li) => sum + (parseFloat(li.quantity) || 0), 0);
    const hasPsaData = matched.length > 0;

    // 2. Extract vendor count from cached_data
    const mapping = mappings[rule.integration_key];
    const vendorQty = mapping
      ? extractVendorCount(rule.integration_key, mapping.cached_data)
      : null;
    const hasVendorData = vendorQty !== null;

    // 3. Calculate difference and status
    const difference = hasPsaData && hasVendorData ? psaQty - vendorQty : 0;
    let status = 'no_data';
    if (hasPsaData && hasVendorData) {
      if (difference === 0) status = 'match';
      else if (difference > 0) status = 'over';
      else status = 'under';
    } else if (!hasPsaData && hasVendorData) {
      status = 'no_psa_data';
    } else if (hasPsaData && !hasVendorData) {
      status = 'no_vendor_data';
    }

    // 4. Attach review info
    const review = reviewMap[rule.id] || null;

    return {
      rule,
      psaQty: hasPsaData ? psaQty : null,
      vendorQty,
      difference,
      status,
      matchedLineItems: matched,
      review,
      integrationLabel: INTEGRATION_LABELS[rule.integration_key] || rule.integration_key,
    };
  });
}

/**
 * Summarise a set of reconciliations.
 */
export function getDiscrepancySummary(reconciliations) {
  const summary = { total: 0, matched: 0, over: 0, under: 0, noData: 0, reviewed: 0 };

  for (const r of reconciliations) {
    summary.total++;
    if (r.status === 'match') summary.matched++;
    else if (r.status === 'over') summary.over++;
    else if (r.status === 'under') summary.under++;
    else summary.noData++;

    if (r.review?.status === 'reviewed' || r.review?.status === 'dismissed') {
      summary.reviewed++;
    }
  }

  return summary;
}

/**
 * Build a human-readable message for a reconciliation result.
 */
export function getDiscrepancyMessage(reconciliation) {
  const { status, difference, psaQty, vendorQty } = reconciliation;

  switch (status) {
    case 'match':
      return `Matched — ${psaQty} licences`;
    case 'over':
      return `You need to remove ${difference} licence${difference !== 1 ? 's' : ''}`;
    case 'under':
      return `You need to add ${Math.abs(difference)} licence${Math.abs(difference) !== 1 ? 's' : ''}`;
    case 'no_psa_data':
      return `Vendor shows ${vendorQty} but no PSA line item found`;
    case 'no_vendor_data':
      return `PSA shows ${psaQty} but no vendor data available`;
    default:
      return 'No data available';
  }
}
