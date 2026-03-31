# Phase 3: Recurring Tab & Master Sync - Context

**Gathered:** 2026-03-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Add a "Recurring" tab to the customer detail page that displays HaloPSA recurring invoice line items with color-coded match status (matched/unmatched/unused). Implement a per-customer master sync button that triggers all vendor integrations + HaloPSA recurring sync with progress indication and automatic data refresh.

</domain>

<decisions>
## Implementation Decisions

### Recurring Tab (RECR-01 through RECR-07)
- **D-01:** New "Recurring" tab added as third tab alongside Reconciliation and Contract. Uses the existing useState tab system in the orchestrator (`activeTab` state).
- **D-02:** Create a new `RecurringTab.jsx` component (follows Phase 1 pattern of extracted components).
- **D-03:** Data source: `allLineItems` (already fetched in orchestrator as `recurring_bill_line_items` for the customer) + `reconciliation_rules` (already loaded via `useReconciliationData`). No new queries needed.
- **D-04:** Match logic: For each line item, check if any reconciliation rule's `match_pattern` (pipe-separated OR patterns) matches the line item's `description`. If a match is found, the line item is "matched" (green). If no rule matches, the line item is "unmatched" (red). Rules that have no matching line items are "unused" (gray).
- **D-05:** Display as a table with columns: Description, Qty, Unit Price, Net Amount, Item Code, Active status, Match Status (color dot + rule label or "Unmatched").
- **D-06:** Color coding uses existing STATUS_COLORS from lootit-constants: matched = emerald (match), unmatched = red (under), unused = slate (neutral).
- **D-07:** Filter chips: horizontal bar above the table with "All", "Matched", "Unmatched", "Unused" chips. Show count badges on each chip. Same visual style as ReconciliationTab filter chips.
- **D-08:** Unused rules shown as additional rows at the bottom of the list (or in a separate section) with gray styling, showing the rule label and "No matching line item" message.

### Master Sync Button (SYNC-01 through SYNC-05)
- **D-09:** Replace the current sync handler (which only invalidates caches) with a real per-customer sync that calls the backend.
- **D-10:** Sync sequence (sequential, not parallel — simpler error handling):
  1. Call `POST /api/halo/sync/customer` with the customer's HaloPSA ID → syncs recurring invoices + line items + contacts
  2. Invalidate ALL mapping queries (datto, cove, jumpcloud, spanning, rocketcyber, pax8, etc.) to pull fresh vendor data
  3. Invalidate reconciliation rules, reviews, and contracts queries
- **D-11:** Show sync progress: button shows "Syncing..." with spinning RefreshCw icon (already partially implemented). After each step completes, optionally show a toast with step completion.
- **D-12:** After full sync completes, all queries auto-refresh via invalidation. Show success toast: "All data synced for [customer name]".
- **D-13:** On error, show error toast with the step that failed. Don't block remaining steps — continue with cache invalidation even if the API call fails.
- **D-14:** The sync button stays in the header (CustomerDetailHeader component). The orchestrator's `handleSync` function gets the real implementation, then passes `onSync` prop to the header.

### Claude's Discretion
- Whether to compute match results in a useMemo in the orchestrator or in RecurringTab itself
- Exact table styling (sticky header, row hover, etc.)
- Whether unused rules are inline in the table or in a separate collapsible section
- Whether to add a new backend endpoint for "sync everything" or keep the frontend orchestrating multiple calls

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Components to Modify
- `src/components/lootit/LootITCustomerDetail.jsx` — Orchestrator: add Recurring tab state, sync handler, pass props (407 lines)
- `src/components/lootit/CustomerDetailHeader.jsx` — Sync button is here, may need progress props (~170 lines after Phase 2)

### Components to Create
- `src/components/lootit/RecurringTab.jsx` — New component for the Recurring tab content

### Data Layer
- `src/hooks/useReconciliationData.js` — Already fetches rules, bills, line items (325 lines)
- `src/api/client.js` — Entity mappings (RecurringBill, RecurringBillLineItem, ReconciliationRule)
- `src/lib/lootit-reconciliation.js` — Has VENDOR_EXTRACTORS and reconciliation engine (471 lines)

### Backend Sync
- `server/src/routes/halo.js` — `POST /api/halo/sync/customer` endpoint (syncs single customer)
- `server/src/functions/syncHaloPSARecurringBills.js` — Backend function that syncs recurring invoices + line items

### Design System
- `src/components/lootit/lootit-constants.js` — STATUS_COLORS for match/under/neutral
- `src/components/lootit/ReconciliationTab.jsx` — Reference for filter chip style and tab content pattern

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **ReconciliationTab.jsx (99 lines):** Reference pattern for tab content — filter chips, grid rendering, status filtering. RecurringTab should follow same structure.
- **allLineItems query:** Already fetched in orchestrator at line 51-60 — `recurring_bill_line_items` filtered by customer's recurring bills.
- **reconciliation_rules:** Loaded via `useReconciliationData` hook — has `match_pattern` field with pipe-separated OR patterns.
- **Table component:** `src/components/ui/table.jsx` — shadcn table with Table, TableBody, TableCell, TableHead, TableHeader, TableRow.
- **STATUS_COLORS:** Emerald for match, red for under (unmatched), slate for neutral (unused).
- **handleSync:** Currently at line ~225, just invalidates caches. Needs real implementation.
- **Tooltip component:** `src/components/ui/tooltip.jsx` — available for column header tooltips.

### Established Patterns
- Tab switching: `const [activeTab, setActiveTab] = useState('reconciliation')` with conditional rendering
- Filter chips: useState for filter + useMemo for filtered list
- Props flow: orchestrator → tab component
- Query invalidation: `queryClient.invalidateQueries` with predicate for mapping queries

### Integration Points
- Tab bar in orchestrator JSX (around line 300) — add "Recurring" option
- handleSync function — replace cache-only invalidation with real API calls
- New `RecurringTab` component rendered when `activeTab === 'recurring'`
- Match computation either in orchestrator (useMemo) or in RecurringTab

</code_context>

<specifics>
## Specific Ideas

- User wants the recurring list to show which items are "matched" to reconciliation rules vs "unmatched" vs "unused rules" — this is the core value for reconciliation workflows
- The sync button should be a "master sync" that ensures any HaloPSA or vendor changes are picked up — not just cache refresh
- Color-coded list (not grouped sections) was the user's explicit choice — single list with green/red/gray indicators
- Filter chips with counts make it easy to see at a glance how many items need attention

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-recurring-tab-master-sync*
*Context gathered: 2026-03-31*
