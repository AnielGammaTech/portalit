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
    const ws = typeof data.workstation_count === 'number' ? data.workstation_count : 0;
    const srv = typeof data.server_count === 'number' ? data.server_count : 0;
    return ws + srv > 0 ? ws + srv : null;
  },

  datto_rmm_workstation: (data) => {
    if (!data) return null;
    if (typeof data.workstation_count === 'number') return data.workstation_count;
    return null;
  },

  datto_rmm_server: (data) => {
    if (!data) return null;
    if (typeof data.server_count === 'number') return data.server_count;
    return null;
  },

  spanning: (data) => {
    if (!data) return null;
    // Standard licenses only (excludes archived)
    if (typeof data.numberOfProtectedStandardUsers === 'number') return data.numberOfProtectedStandardUsers;
    if (typeof data.numberOfStandardLicensesTotal === 'number') return data.numberOfStandardLicensesTotal;
    // Fallback: count standard-type users from the users array
    if (Array.isArray(data.users)) {
      const standard = data.users.filter(u => (u.userType || 'standard') !== 'archived');
      return standard.length;
    }
    if (typeof data.total === 'number') return data.total;
    return null;
  },

  spanning_archived: (data) => {
    if (!data) return null;
    if (typeof data.numberOfProtectedArchivedUsers === 'number') return data.numberOfProtectedArchivedUsers;
    if (typeof data.numberOfArchivedLicensesTotal === 'number') return data.numberOfArchivedLicensesTotal;
    if (Array.isArray(data.users)) {
      return data.users.filter(u => u.userType === 'archived').length;
    }
    return null;
  },

  jumpcloud: (data) => {
    if (!data) return null;
    if (typeof data.totalUsers === 'number') return data.totalUsers;
    return null;
  },

  datto_edr: (data) => {
    if (!data) return null;
    if (typeof data.hostCount === 'number') return data.hostCount;
    if (typeof data.total_devices === 'number') return data.total_devices;
    if (Array.isArray(data.hosts)) return data.hosts.length;
    return null;
  },

  unifi: (data) => {
    if (!data) return null;
    if (typeof data.total_devices === 'number') return data.total_devices;
    if (Array.isArray(data.devices)) return data.devices.length;
    return null;
  },
  unifi_firewall: (data) => {
    if (!data) return null;
    if (Array.isArray(data.devices)) return data.devices.filter(d => d.type === 'firewall' || d.device_type === 'firewall' || d.model?.toLowerCase().includes('udm') || d.model?.toLowerCase().includes('usg') || d.model?.toLowerCase().includes('gateway')).length;
    if (typeof data.summary?.firewalls === 'number') return data.summary.firewalls;
    return null;
  },

  rocket_cyber: (data) => {
    if (!data) return null;
    if (typeof data.total_agents === 'number') return data.total_agents;
    if (typeof data.totalAgents === 'number') return data.totalAgents;
    return null;
  },

  darkweb: (data) => {
    if (!data) return null;
    if (typeof data.domains_count === 'number') return data.domains_count;
    if (typeof data.domain_count === 'number') return data.domain_count;
    if (Array.isArray(data.domains_monitored)) return data.domains_monitored.length;
    return 1; // Each mapping/report = 1 monitored domain
  },

  bullphish: (data) => {
    if (!data) return null;
    if (typeof data.total_emails_sent === 'number') return data.total_emails_sent;
    if (typeof data.user_count === 'number') return data.user_count;
    return null;
  },

  threecx: (data) => {
    if (!data) return null;
    if (typeof data.user_extensions === 'number') return data.user_extensions;
    if (typeof data.total_extensions === 'number') return data.total_extensions;
    return null;
  },

  inky: (data) => {
    if (!data) return null;
    if (typeof data.total_users === 'number') return data.total_users;
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
  datto_rmm_workstation: 'DattoSiteMapping',
  datto_rmm_server: 'DattoSiteMapping',
  spanning: 'SpanningMapping',
  spanning_archived: 'SpanningMapping',
  jumpcloud: 'JumpCloudMapping',
  datto_edr: 'DattoEDRMapping',
  unifi: 'UniFiMapping',
  unifi_firewall: 'UniFiMapping',
  rocket_cyber: 'RocketCyberMapping',
  darkweb: 'DarkWebIDReport',
  bullphish: 'BullPhishIDReport',
  threecx: 'ThreeCXReport',
  inky: 'InkyReport',
  pax8: 'Pax8Mapping',
};

export const INTEGRATION_LABELS = {
  cove: 'Cove Data Protection',
  cove_workstation: 'Cove Workstations',
  cove_server: 'Cove Servers',
  datto_rmm: 'Datto RMM',
  datto_rmm_workstation: 'Datto RMM Workstations',
  datto_rmm_server: 'Datto RMM Servers',
  spanning: 'Spanning Standard',
  spanning_archived: 'Spanning Archived',
  jumpcloud: 'JumpCloud',
  datto_edr: 'Datto EDR',
  unifi: 'UniFi Network',
  unifi_firewall: 'UniFi Firewall',
  rocket_cyber: 'RocketCyber',
  darkweb: 'Dark Web ID',
  bullphish: 'BullPhish ID',
  threecx: '3CX VoIP',
  inky: 'Inky',
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
  // Support pipe-separated patterns (OR logic): "JumpCloud|Jump Cloud"
  const patterns = pattern.split('|').map(p => p.trim()).filter(Boolean);
  return patterns.some(p => value.includes(p));
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
 * @param {Array}  overrides – manual line-item overrides (from pax8_line_item_overrides table)
 *
 * @returns {Array} reconciliation results, one per rule
 */
export function reconcileCustomer(lineItems, mappings, rules, reviews = [], overrides = [], pax8MatchedIds = new Set()) {
  const activeRules = rules.filter((r) => r.is_active);
  const reviewMap = Object.fromEntries(
    reviews.map((r) => [r.rule_id, r])
  );

  // Build override lookup: rule_id → [resolved reference, ...]
  const overrideMap = {};
  for (const ov of overrides) {
    const key = ov.rule_id || '';
    if (!overrideMap[key]) overrideMap[key] = [];
    // line_item_id holds PSA UUIDs; pax8_product_name holds non-PSA refs (pax8:Name, device:id)
    overrideMap[key].push(ov.line_item_id || ov.pax8_product_name);
  }
  const lineItemById = Object.fromEntries(lineItems.map((li) => [li.id, li]));

  // Resolve an override ID to a line item — supports both real UUIDs and
  // synthetic IDs (pax8:Name, device:id, vendor:key:id) from cross-source mappings.
  const resolveOverrideItem = (id) => {
    // Direct HaloPSA line item lookup (UUID)
    const direct = lineItemById[id];
    if (direct) return direct;

    // Synthetic Pax8 product reference
    if (id.startsWith('pax8:')) {
      const productName = id.slice(5);
      const pax8Mapping = mappings.pax8;
      const products = pax8Mapping?.cached_data?.products || [];
      const product = products.find(p => p.name === productName);
      if (product) {
        return { id, description: product.name, quantity: product.quantity || 1, _synthetic: true };
      }
    }

    // Synthetic vendor reference (vendor:key:id)
    if (id.startsWith('vendor:') || id.startsWith('device:')) {
      return { id, description: id, quantity: 1, _synthetic: true };
    }

    return null;
  };

  // Track which line items are matched by any rule or override
  const matchedLineItemIds = new Set();

  // Build multi-mapping lookup: rule_id → parsed JSON items with summed qty
  const multiMappingMap = {};
  for (const ov of overrides) {
    if (ov.pax8_product_name && ov.pax8_product_name.startsWith('[')) {
      try {
        const items = JSON.parse(ov.pax8_product_name);
        if (Array.isArray(items)) {
          multiMappingMap[ov.rule_id] = {
            items,
            totalQty: items.reduce((sum, m) => sum + (m.qty || 0), 0),
          };
        }
      } catch {}
    }
  }

  const ruleResults = activeRules.map((rule) => {
    // 1. Check for manual overrides first, then fall back to pattern matching
    const overrideIds = overrideMap[rule.id] || [];
    const overrideItems = overrideIds.map(resolveOverrideItem).filter(Boolean);
    const matched = overrideItems.length > 0
      ? overrideItems
      : lineItems.filter((li) => lineItemMatchesRule(li, rule));
    const psaQty = matched.reduce((sum, li) => sum + (parseFloat(li.quantity) || 0), 0);
    const hasPsaData = matched.length > 0;

    // Track matched line items
    for (const li of matched) matchedLineItemIds.add(li.id);

    // 2. Extract vendor count — check multi-mapping overrides first, then integration cached_data
    const multiMapping = multiMappingMap[rule.id];
    const mapping = mappings[rule.integration_key];
    const vendorQty = multiMapping
      ? multiMapping.totalQty
      : mapping
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
    } else if (!hasPsaData && hasVendorData && vendorQty > 0) {
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

  // 5. Handle overrides on unmatched items — these have rule_id starting with "unmatched_"
  // and need their own reconciliation results with vendor qty from the override
  const overridedUnmatchedIds = new Set();
  const overridedUnmatchedResults = [];
  for (const ov of overrides) {
    if (ov.line_item_id) matchedLineItemIds.add(ov.line_item_id);
    if (ov.rule_id && ov.rule_id.startsWith('unmatched_')) {
      const liId = ov.rule_id.replace('unmatched_', '');
      const li = lineItemById[liId];
      if (!li) continue;
      overridedUnmatchedIds.add(liId);
      const psaQty = parseFloat(li.quantity) || 0;
      const multiMapping = multiMappingMap[ov.rule_id];
      const vendorKey = ov.pax8_product_name || null;
      const vendorMapping = vendorKey ? mappings[vendorKey] : null;
      const isApprovedAsIs = vendorKey === 'approved_as_is';
      let vendorQty = null;
      if (isApprovedAsIs) {
        vendorQty = psaQty;
      } else if (multiMapping) {
        vendorQty = multiMapping.totalQty;
      } else if (vendorKey && vendorMapping) {
        const cd = typeof vendorMapping.cached_data === 'string'
          ? (() => { try { return JSON.parse(vendorMapping.cached_data); } catch { return vendorMapping.cached_data; } })()
          : vendorMapping.cached_data;
        vendorQty = extractVendorCount(vendorKey, cd);
      }
      if (vendorQty === null && vendorKey && !isApprovedAsIs) {
        for (const [mk, mv] of Object.entries(mappings)) {
          if (mk === vendorKey || mk.startsWith(vendorKey)) {
            const q = extractVendorCount(mk, mv.cached_data);
            if (q !== null) { vendorQty = q; break; }
          }
        }
      }
      const hasVendorData = vendorQty !== null;
      const difference = hasVendorData ? psaQty - vendorQty : 0;
      let status = 'no_vendor_data';
      if (hasVendorData) {
        if (difference === 0) status = 'match';
        else if (difference > 0) status = 'over';
        else status = 'under';
      }
      const review = reviewMap[ov.rule_id] || reviewMap[liId] || null;
      const approvalNote = isApprovedAsIs && ov.group_id ? ov.group_id.replace('approved:', '') : null;
      const vendorLabel = vendorKey && !isApprovedAsIs ? (INTEGRATION_LABELS[vendorKey] || vendorKey) : null;
      overridedUnmatchedResults.push({
        rule: {
          id: ov.rule_id,
          label: (li.description || 'Unknown').replace(/\s*\$recurringbillingdate\s*/gi, '').trim() || li.description,
          integration_key: isApprovedAsIs ? 'approved_as_is' : (vendorKey || 'manually_mapped'),
          is_active: true,
        },
        psaQty,
        vendorQty,
        difference,
        status,
        matchedLineItems: [li],
        review: isApprovedAsIs ? { status: 'force_matched', notes: approvalNote } : review,
        integrationLabel: isApprovedAsIs ? 'Approved as-is' : multiMapping ? `Mapped to ${multiMapping.items.length} vendor item(s)` : (vendorLabel ? `Mapped → ${vendorLabel}` : 'Manually Mapped'),
        isUnmatchedLineItem: false,
      });
    }
  }

  // 6. Add remaining unmatched line items
  for (const id of pax8MatchedIds) {
    matchedLineItemIds.add(id);
  }
  const unmatchedItems = lineItems.filter((li) =>
    !matchedLineItemIds.has(li.id) &&
    !overridedUnmatchedIds.has(li.id) &&
    li.description &&
    (parseFloat(li.quantity) || 0) !== 0 &&
    !(li.description || '').toLowerCase().startsWith('discount')
  );

  const unmatchedResults = unmatchedItems.map((li) => ({
    rule: {
      id: `unmatched_${li.id}`,
      label: (li.description || 'Unknown').replace(/\s*\$recurringbillingdate\s*/gi, '').trim() || li.description,
      integration_key: 'unmatched',
      is_active: true,
    },
    psaQty: parseFloat(li.quantity) || 0,
    vendorQty: null,
    difference: 0,
    status: 'unmatched_line_item',
    matchedLineItems: [li],
    review: null,
    integrationLabel: 'Unmatched Billing Item',
    isUnmatchedLineItem: true,
  }));

  return [...ruleResults, ...overridedUnmatchedResults, ...unmatchedResults];
}

// ── Pax8 per-subscription auto-reconciliation ────────────────────────

/**
 * Find PSA line items matching a Pax8 product name.
 * Uses strict substring matching only — tries full name first,
 * then strips common Pax8 suffixes for a cleaner match.
 */
function findPsaMatchesForProduct(productName, lineItems) {
  const name = (productName || '').toLowerCase().trim();
  if (name.length < 4) return [];

  // 1. Exact substring match on full product name
  const exact = lineItems.filter((li) =>
    (li.description || '').toLowerCase().includes(name)
  );
  if (exact.length > 0) return exact;

  // 2. Strip common Pax8 suffixes and retry
  const cleaned = name
    .replace(/\[new commerce experience\]/gi, '')
    .replace(/\(new commerce experience\)/gi, '')
    .replace(/\[nce\]/gi, '')
    .replace(/- annual/gi, '')
    .replace(/- monthly/gi, '')
    .trim();

  if (cleaned.length >= 4 && cleaned !== name) {
    const stripped = lineItems.filter((li) =>
      (li.description || '').toLowerCase().includes(cleaned)
    );
    if (stripped.length > 0) return stripped;
  }

  // 3. Also try matching PSA description against the product name (reverse match)
  const reverse = lineItems.filter((li) => {
    const desc = (li.description || '').toLowerCase().trim();
    return desc.length >= 4 && name.includes(desc);
  });
  if (reverse.length > 0) return reverse;

  return [];
}

/**
 * Auto-reconcile Pax8 subscriptions against PSA line items.
 *
 * Returns one result per individual Pax8 subscription (not grouped).
 * Status comparison is done at the product level (total Pax8 qty for
 * all subs of the same product vs total PSA qty).
 *
 * @param {Array} overrides – pax8_line_item_overrides for this customer
 */
export function reconcilePax8Subscriptions(lineItems, pax8Mapping, reviews = [], overrides = []) {
  if (!pax8Mapping?.cached_data?.products) return [];

  const products = pax8Mapping.cached_data.products || [];
  const reviewMap = Object.fromEntries(
    reviews.filter((r) => r.rule_id?.startsWith('pax8:')).map((r) => [r.rule_id, r])
  );

  // Build override lookup: rule_id → [resolved reference, ...]
  const overrideMap = {};
  for (const ov of overrides) {
    const key = ov.rule_id || '';
    if (!overrideMap[key]) overrideMap[key] = [];
    overrideMap[key].push(ov.line_item_id || ov.pax8_product_name);
  }
  const lineItemById = Object.fromEntries(lineItems.map((li) => [li.id, li]));

  const results = [];
  const pax8MatchedLineItemIds = new Set();

  for (const product of products) {
    // Auto-match at the product level (fallback when no per-sub override)
    const autoMatched = findPsaMatchesForProduct(product.name, lineItems);
    const totalVendorQty = product.quantity || 0;
    const subs = product.subscriptions || [];

    // Helper: build result for a given ruleId + vendorQty using specific matched items
    const buildResult = (ruleId, subVendorQty, matched, sub) => {
      const psaQty = matched.reduce((sum, li) => sum + (parseFloat(li.quantity) || 0), 0);
      const hasPsaData = matched.length > 0;
      const difference = hasPsaData ? psaQty - subVendorQty : 0;

      let status = 'missing_from_psa';
      if (hasPsaData) {
        if (difference === 0) status = 'match';
        else if (difference > 0) status = 'over';
        else status = 'under';
      }

      return {
        ruleId,
        productName: product.name,
        subscriptionId: sub?.id || null,
        vendorQty: subVendorQty,
        totalVendorQty,
        psaQty: hasPsaData ? psaQty : null,
        difference,
        status,
        matchedLineItems: matched,
        billingTerm: sub?.billingTerm || '',
        price: sub?.price || 0,
        startDate: sub?.startDate || null,
        review: reviewMap[ruleId] || null,
        integrationLabel: 'Pax8',
      };
    };

    // If no subscription detail, emit one tile for the product itself
    if (subs.length === 0) {
      const ruleId = `pax8:${product.name}`;
      const overrideIds = overrideMap[ruleId] || [];
      const overrideItems = overrideIds.map((id) => lineItemById[id]).filter(Boolean);
      const matched = overrideItems.length > 0 ? overrideItems : autoMatched;
      results.push(buildResult(ruleId, totalVendorQty, matched, null));
      continue;
    }

    // One tile per subscription — each can have its own override
    for (const sub of subs) {
      const ruleId = `pax8:${sub.id}`;
      const overrideIds = overrideMap[ruleId] || [];
      const overrideItems = overrideIds.map((id) => lineItemById[id]).filter(Boolean);
      const matched = overrideItems.length > 0 ? overrideItems : autoMatched;
      results.push(buildResult(ruleId, sub.quantity || 1, matched, sub));
    }
  }

  // ── Group merge: combine results that share a group_id ──
  const groupMap = {};
  for (const ov of overrides) {
    if (ov.group_id) {
      if (!groupMap[ov.group_id]) groupMap[ov.group_id] = [];
      groupMap[ov.group_id].push(ov.rule_id);
    }
  }

  const groupedRuleIds = new Set();
  const mergedResults = [];

  for (const [groupId, ruleIds] of Object.entries(groupMap)) {
    if (ruleIds.length < 2) continue;
    const groupResults = results.filter(r => ruleIds.includes(r.ruleId));
    if (groupResults.length === 0) continue;

    for (const r of groupResults) groupedRuleIds.add(r.ruleId);

    const combinedVendorQty = groupResults.reduce((sum, r) => sum + (r.vendorQty || 0), 0);
    const matched = groupResults[0].matchedLineItems || [];
    const psaQty = matched.reduce((sum, li) => sum + (parseFloat(li.quantity) || 0), 0);
    const difference = matched.length > 0 ? psaQty - combinedVendorQty : 0;

    let status = 'missing_from_psa';
    if (matched.length > 0) {
      if (difference === 0) status = 'match';
      else if (difference > 0) status = 'over';
      else status = 'under';
    }

    mergedResults.push({
      ruleId: `group:${groupId}`,
      groupId,
      productName: groupResults.map(r => r.productName).filter((v, i, a) => a.indexOf(v) === i).join(' + '),
      vendorQty: combinedVendorQty,
      totalVendorQty: combinedVendorQty,
      psaQty: matched.length > 0 ? psaQty : null,
      difference,
      status,
      matchedLineItems: matched,
      billingTerm: '',
      price: groupResults.reduce((sum, r) => sum + (r.price || 0), 0),
      startDate: null,
      review: groupResults[0].review,
      integrationLabel: 'Pax8',
      isGroup: true,
      groupSubs: groupResults,
    });
  }

  const finalResults = [
    ...mergedResults,
    ...results.filter(r => !groupedRuleIds.has(r.ruleId)),
  ];

  // Collect all matched line item IDs from Pax8 reconciliations
  const outputResults = finalResults.length > 0 ? finalResults : results;
  for (const r of outputResults) {
    for (const li of (r.matchedLineItems || [])) {
      pax8MatchedLineItemIds.add(li.id);
    }
  }
  outputResults._pax8MatchedLineItemIds = pax8MatchedLineItemIds;
  return outputResults;
}

/**
 * Summarise a set of reconciliations.
 */
export function getDiscrepancySummary(reconciliations) {
  const summary = { total: 0, matched: 0, over: 0, under: 0, noData: 0, noVendor: 0, unmatched: 0, noPsa: 0, reviewed: 0, dismissed: 0, forceMatched: 0 };

  for (const r of reconciliations) {
    summary.total++;

    // Force-matched items count as matched regardless of actual status
    if (r.review?.status === 'force_matched') {
      summary.forceMatched++;
      summary.matched++;
      continue;
    }

    if (r.status === 'match') summary.matched++;
    else if (r.status === 'over') summary.over++;
    else if (r.status === 'no_psa_data') summary.noPsa++;
    else if (r.status === 'under' || r.status === 'missing_from_psa') summary.under++;
    else if (r.status === 'no_data') summary.noData++;
    else if (r.status === 'unmatched_line_item' || r.status === 'no_vendor_data') summary.unmatched++;
    else summary.noData++;

    if (r.review?.status === 'reviewed') summary.reviewed++;
    else if (r.review?.status === 'dismissed') summary.dismissed++;
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
      return `You need to add ${difference} licence${difference !== 1 ? 's' : ''} to vendor`;
    case 'under':
      return `You need to remove ${Math.abs(difference)} licence${Math.abs(difference) !== 1 ? 's' : ''} from vendor`;
    case 'missing_from_psa':
      return `Pax8 has ${vendorQty} licence${vendorQty !== 1 ? 's' : ''} but no matching HaloPSA line item found`;
    case 'no_psa_data':
      return `Vendor shows ${vendorQty} but no PSA line item found`;
    case 'no_vendor_data':
      return `PSA shows ${psaQty} but no vendor data available`;
    default:
      return 'No data available';
  }
}
