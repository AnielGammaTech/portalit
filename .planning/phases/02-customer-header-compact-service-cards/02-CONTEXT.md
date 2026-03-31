# Phase 2: Customer Header & Compact Service Cards - Context

**Gathered:** 2026-03-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Redesign the customer header to show real customer details (contact, address from HaloPSA), a financial summary (MRR, contract value, billing status), and a reconciliation health score. Shrink service cards ~50% so 3-4 fit per row while retaining all data and interactions.

</domain>

<decisions>
## Implementation Decisions

### Customer Header — Real Data (HEAD-01)
- **D-01:** Customer details (company name, primary contact, address) come from the existing `customer` prop which already contains HaloPSA metadata. The `contacts` data from `useCustomerContacts` hook provides contact details.
- **D-02:** Display: company name (already shown), primary contact name + email, and address if available. Show in the dark header band alongside existing elements.
- **D-03:** If no contact/address data exists, show graceful empty state (dash or "No contact on file") — never blank space.

### Financial Summary (HEAD-02)
- **D-04:** MRR derived from `recurring_bills` data — sum of active recurring bill amounts for the customer. Already fetched in the reconciliation data flow.
- **D-05:** Contract value from `contracts` array (already fetched) — sum of `extracted_data.monthly_total` from contracts with `extraction_status: 'complete'`.
- **D-06:** Billing status derived from reconciliation health: "Healthy" (80%+), "Needs Review" (50-79%), "At Risk" (<50%). Shown as a colored badge.
- **D-07:** Financial summary displayed as a compact row in the light content area of the header, below the integration widgets.

### Health Score (HEAD-03)
- **D-08:** Health score already implemented in Phase 1 as a % badge in the dark header. Keep as-is — Phase 2 just ensures it's connected to real data properly.

### Header Visual Design (HEAD-04, HEAD-05)
- **D-09:** Header retains the Phase 1 dashboard-pro styling (dark/navy gradient, light content area). Phase 2 adds content, not restyling.
- **D-10:** Integration stat widgets stay compact (already 6-column grid from Phase 1). Ensure they pull real counts from actual vendor data, not hardcoded placeholders.

### Compact Service Cards (CARD-01, CARD-02, CARD-03)
- **D-11:** Cards shrink ~50% — reduce padding, font sizes, and big number size (text-3xl → text-xl). Target: cards fit 3-4 per row on standard desktop (grid-cols-2 → grid-cols-3 lg:grid-cols-4).
- **D-12:** Keep ALL data: PSA vs Vendor counts, status badge, integration label, action buttons. Nothing removed — just smaller.
- **D-13:** Action bar compresses: buttons become icon-only (tooltip on hover) instead of icon+text. OK button stays green, Skip stays gray, but smaller.
- **D-14:** "vs" separator between PSA and Vendor numbers becomes a thin vertical divider instead of text.
- **D-15:** Notes section collapses to a small icon indicator — expand on click.

### Claude's Discretion
- Exact responsive breakpoints for 3-col vs 4-col card grid
- Whether financial summary goes above or below integration widgets
- Exact font sizes for compact card numbers (text-lg vs text-xl)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Components to Modify
- `src/components/lootit/CustomerDetailHeader.jsx` — Primary target for header redesign (121 lines, Phase 1 output)
- `src/components/lootit/ServiceCard.jsx` — Primary target for card compaction (263 lines)
- `src/components/lootit/ReconciliationTab.jsx` — Grid layout that renders ServiceCards (99 lines)
- `src/components/lootit/LootITCustomerDetail.jsx` — Orchestrator that passes props to header (394 lines)

### Data Sources
- `src/hooks/useReconciliationData.js` — Reconciliation data + Pax8 data
- `src/hooks/useCustomerData.js` — Customer contacts and devices
- `src/hooks/useReconciliationReviews.js` — Review/dismiss data
- `src/api/client.js` — Entity mappings (RecurringBill, LootITContract)

### Design System
- `src/components/lootit/lootit-constants.js` — Shared status colors (Phase 1 output)
- `tailwind.config.js` — Tailwind design tokens

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **CustomerDetailHeader.jsx (121 lines):** Already has dark header, integration widgets, reconciliation summary boxes. Phase 2 adds customer details + financial summary to this component.
- **ServiceCard.jsx (263 lines):** Fully functional with PSA vs Vendor numbers, action bar, notes, exclusions. Phase 2 scales everything down 50%.
- **ReconciliationTab.jsx:** Renders `grid grid-cols-1 sm:grid-cols-2` — needs to become `grid-cols-2 md:grid-cols-3 lg:grid-cols-4`.
- **useCustomerContacts hook:** Returns contacts array with name, email fields.
- **dollarImpact object:** Already computed in orchestrator — has `totalMonthlyBilled`, `underBilledAmount`, `overBilledAmount`.

### Established Patterns
- Props flow from orchestrator → components (no context providers)
- TanStack Query for all data fetching with staleTime caching
- STATUS_COLORS from lootit-constants.js for all status-related styling
- cn() utility for conditional Tailwind class merging

### Integration Points
- `LootITCustomerDetail.jsx` already passes `customer`, `contacts`, `devices`, `contracts`, `dollarImpact`, `summary`, `healthPct` to CustomerDetailHeader
- ReconciliationTab gets `filteredRecons`, `filteredPax8` and renders the card grid
- Financial data (recurring bills) already queried as `allLineItems` in orchestrator

</code_context>

<specifics>
## Specific Ideas

- User showed screenshots of the current header and wants it "prettier with real information" — not just counts but actual business context
- Cards currently show as 2-per-row with large numbers — user explicitly wants 3-4 per row with everything still visible
- Dashboard-pro aesthetic established in Phase 1 carries forward — no style regression
- The "big squares" (PSA vs VENDOR) are the core visual element of ServiceCard — they must remain prominent even at 50% size

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-customer-header-compact-service-cards*
*Context gathered: 2026-03-31*
