# Phase 3: Recurring Tab & Master Sync - Research

**Researched:** 2026-03-31
**Domain:** React tab component + backend API sync orchestration
**Confidence:** HIGH

## Summary

Phase 3 adds a "Recurring" tab to the LootIT customer detail page and replaces the current cache-only sync button with a real per-customer master sync. The codebase is well-prepared for both features: the orchestrator (406 lines post-Phase 1 split) already fetches `allLineItems` and `reconciliation_rules`, the `ReconciliationTab` provides a proven reference pattern for filter chips and tab content, and the backend `syncHaloPSARecurringBills` function already supports per-customer sync via `{ action: 'sync_customer', customer_id: external_id }`.

The match logic is straightforward: the existing `lineItemMatchesRule()` function in `lootit-reconciliation.js` already implements pipe-separated OR-pattern matching. The RecurringTab just needs to run each line item against all rules and classify results as matched/unmatched, then identify unused rules (rules with no matching line items). No new data fetching or backend changes are required for the Recurring tab itself.

The master sync requires calling `client.functions.invoke('syncHaloPSARecurringBills', ...)` followed by `client.halo.syncCustomer(external_id)` for HaloPSA customer+contacts, then invalidating all mapping queries. The existing `handleSync` function (line 174-184) is the exact insertion point -- it currently only invalidates caches and needs replacement with real API calls before cache invalidation.

**Primary recommendation:** Build RecurringTab as a self-contained component with internal useMemo for match computation (keeps orchestrator lean), follow ReconciliationTab's filter chip pattern exactly, and implement master sync as sequential API calls in the orchestrator's handleSync with try/catch per step for resilient error handling.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** New "Recurring" tab added as third tab alongside Reconciliation and Contract. Uses the existing useState tab system in the orchestrator (`activeTab` state).
- **D-02:** Create a new `RecurringTab.jsx` component (follows Phase 1 pattern of extracted components).
- **D-03:** Data source: `allLineItems` (already fetched in orchestrator as `recurring_bill_line_items` for the customer) + `reconciliation_rules` (already loaded via `useReconciliationData`). No new queries needed.
- **D-04:** Match logic: For each line item, check if any reconciliation rule's `match_pattern` (pipe-separated OR patterns) matches the line item's `description`. If a match is found, the line item is "matched" (green). If no rule matches, the line item is "unmatched" (red). Rules that have no matching line items are "unused" (gray).
- **D-05:** Display as a table with columns: Description, Qty, Unit Price, Net Amount, Item Code, Active status, Match Status (color dot + rule label or "Unmatched").
- **D-06:** Color coding uses existing STATUS_COLORS from lootit-constants: matched = emerald (match), unmatched = red (under), unused = slate (neutral).
- **D-07:** Filter chips: horizontal bar above the table with "All", "Matched", "Unmatched", "Unused" chips. Show count badges on each chip. Same visual style as ReconciliationTab filter chips.
- **D-08:** Unused rules shown as additional rows at the bottom of the list (or in a separate section) with gray styling, showing the rule label and "No matching line item" message.
- **D-09:** Replace the current sync handler (which only invalidates caches) with a real per-customer sync that calls the backend.
- **D-10:** Sync sequence (sequential, not parallel): 1. Call POST /api/halo/sync/customer with HaloPSA ID, 2. Invalidate ALL mapping queries, 3. Invalidate reconciliation rules, reviews, and contracts queries.
- **D-11:** Show sync progress: button shows "Syncing..." with spinning RefreshCw icon (already partially implemented). After each step completes, optionally show a toast with step completion.
- **D-12:** After full sync completes, all queries auto-refresh via invalidation. Show success toast.
- **D-13:** On error, show error toast with the step that failed. Don't block remaining steps.
- **D-14:** The sync button stays in the header (CustomerDetailHeader). The orchestrator's handleSync gets the real implementation.

### Claude's Discretion
- Whether to compute match results in a useMemo in the orchestrator or in RecurringTab itself
- Exact table styling (sticky header, row hover, etc.)
- Whether unused rules are inline in the table or in a separate collapsible section
- Whether to add a new backend endpoint for "sync everything" or keep the frontend orchestrating multiple calls

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RECR-01 | New "Recurring" tab added alongside existing Reconciliation and Contract tabs | Tab bar array at line 312-332 of orchestrator -- add third entry. `activeTab` useState already supports string keys. |
| RECR-02 | Tab displays all HaloPSA recurring invoice line items for the customer | `allLineItems` query at line 52-61 already fetches all line items for the customer. Pass as prop to RecurringTab. |
| RECR-03 | Each line item shows: description, quantity, price, net amount, item code, active status | Line item fields available: `description`, `quantity`, `price`, `net_amount`, `item_code`, `active`. All from `RecurringBillLineItem` entity. |
| RECR-04 | Line items color-coded green when matched to a reconciliation rule | Use `lineItemMatchesRule()` from `lootit-reconciliation.js` + `STATUS_COLORS.match` (emerald) from `lootit-constants.js`. |
| RECR-05 | Line items color-coded red when unmatched (no reconciliation rule maps to them) | Items with no matching rule get `STATUS_COLORS.under` (red). |
| RECR-06 | Reconciliation rules with no matching line item shown as gray "unused" entries | After matching, identify rules where no line item matched. Show with `STATUS_COLORS.neutral` (slate). |
| RECR-07 | List is filterable by status (All, Matched, Unmatched, Unused) | Follow ReconciliationTab filter chip pattern (line 12-38 of ReconciliationTab.jsx). useState + useMemo for filtered list. |
| SYNC-01 | Sync button triggers real per-customer sync of ALL vendor integrations | Replace `handleSync` (line 174-184). Call `halo.syncCustomer(external_id)` + invalidate ALL mapping queries via predicate. |
| SYNC-02 | Sync button triggers HaloPSA recurring invoice sync for that customer | Call `client.functions.invoke('syncHaloPSARecurringBills', { action: 'sync_customer', customer_id: customer.external_id })`. |
| SYNC-03 | Sync button shows progress/loading state during sync | `isSyncing` state + `RefreshCw` with `animate-spin` already wired in CustomerDetailHeader. Add toast notifications per step. |
| SYNC-04 | After sync completes, all data on page refreshes automatically | `queryClient.invalidateQueries` with predicate for mapping queries + explicit keys for rules, bills, line items, reviews, contracts. |
| SYNC-05 | Sync triggers device count refresh from all mapped vendors | Invalidating mapping queries (`lootit_entity_*` pattern) causes vendor data to refetch, which updates device counts in the header. |
</phase_requirements>

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 18.x | UI framework | Already used throughout |
| @tanstack/react-query | 5.x | Data fetching, cache invalidation | Already used for all queries -- `useQuery`, `useQueryClient`, `invalidateQueries` |
| sonner | latest | Toast notifications | Already imported in orchestrator (`import { toast } from 'sonner'`) |
| lucide-react | latest | Icons (RefreshCw, RotateCcw, Filter, etc.) | Already used throughout all components |

### Supporting (already in project)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @/lib/utils (cn) | - | Tailwind class merging | Every conditional className |
| @/components/ui/table | - | shadcn Table components | RecurringTab table rendering |
| @/lib/lootit-reconciliation | - | `lineItemMatchesRule()`, `matchLineItemToRules()` | Match computation in RecurringTab |
| @/components/lootit/lootit-constants | - | `STATUS_COLORS` (match/under/neutral) | Color coding for matched/unmatched/unused |

No new dependencies needed. Everything required is already installed and in use.

## Architecture Patterns

### Component Structure
```
src/components/lootit/
  LootITCustomerDetail.jsx   # Orchestrator (406 lines) -- add tab + sync
  CustomerDetailHeader.jsx   # Sync button already here (171 lines)
  ReconciliationTab.jsx      # Reference pattern (99 lines)
  RecurringTab.jsx           # NEW (estimated ~150-200 lines)
  lootit-constants.js        # STATUS_COLORS shared constants
```

### Pattern 1: Tab Content Component (from ReconciliationTab)
**What:** Self-contained tab component that receives data via props, manages its own filter state, and renders filtered content.
**When to use:** Every tab in the customer detail page follows this pattern.
**Reference:** `ReconciliationTab.jsx` lines 1-99
```jsx
// Pattern: Tab component with filter chips + content
export default function RecurringTab({ lineItems, rules, /* ...other props */ }) {
  // 1. Internal filter state
  const [filter, setFilter] = useState('all');

  // 2. Compute match results (useMemo)
  const matchResults = useMemo(() => {
    // Run lineItemMatchesRule for each item against all rules
    // Classify: matched, unmatched, unused rules
    return { matched: [...], unmatched: [...], unusedRules: [...], counts: {...} };
  }, [lineItems, rules]);

  // 3. Filter based on current chip selection
  const filtered = useMemo(() => {
    if (filter === 'all') return [...matchResults.matched, ...matchResults.unmatched];
    if (filter === 'matched') return matchResults.matched;
    // ...etc
  }, [matchResults, filter]);

  return (
    <>
      {/* Filter chips (same visual as ReconciliationTab) */}
      {/* Table content */}
    </>
  );
}
```

### Pattern 2: Filter Chips (exact ReconciliationTab pattern)
**What:** Horizontal button bar with count badges, active/inactive visual states.
**Reference:** `ReconciliationTab.jsx` lines 12-38
```jsx
<div className="flex gap-1.5">
  {[
    { key: 'all', label: 'All', count: totalCount },
    { key: 'matched', label: 'Matched', count: matchedCount },
    { key: 'unmatched', label: 'Unmatched', count: unmatchedCount },
    { key: 'unused', label: 'Unused', count: unusedCount },
  ].map((f) => (
    <button
      key={f.key}
      onClick={() => onFilterChange(f.key)}
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
        filter === f.key
          ? 'bg-slate-900 text-white shadow-sm'
          : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
      )}
    >
      {f.label}
      <span className={cn(
        'text-[10px] px-1.5 py-0.5 rounded-full',
        filter === f.key ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-400'
      )}>
        {f.count}
      </span>
    </button>
  ))}
</div>
```

### Pattern 3: Sequential Async with Error Resilience
**What:** The master sync runs steps sequentially, catches errors per step, continues remaining steps.
**Reference:** Decision D-13 from CONTEXT.md
```jsx
const handleSync = async () => {
  setIsSyncing(true);
  try {
    // Step 1: HaloPSA customer sync (uses external_id)
    try {
      await client.halo.syncCustomer(customer.external_id);
      toast.success('Customer data synced');
    } catch (err) {
      toast.error('Customer sync failed: ' + err.message);
    }

    // Step 2: Recurring bills sync
    try {
      await client.functions.invoke('syncHaloPSARecurringBills', {
        action: 'sync_customer',
        customer_id: customer.external_id,
      });
      toast.success('Recurring bills synced');
    } catch (err) {
      toast.error('Recurring bill sync failed: ' + err.message);
    }

    // Step 3: Invalidate all caches (always runs)
    await queryClient.invalidateQueries({ queryKey: ['reconciliation_rules'] });
    // ...more invalidations
    
    toast.success(`All data synced for ${customer.name}`);
  } finally {
    setIsSyncing(false);
  }
};
```

### Pattern 4: Match Status Color Dot
**What:** Small colored circle indicator next to text, using STATUS_COLORS from constants.
**Reference:** `lootit-constants.js` STATUS_COLORS definition
```jsx
// Matched (emerald)
<span className={cn('w-2 h-2 rounded-full', STATUS_COLORS.match.bar)} />

// Unmatched (red)
<span className={cn('w-2 h-2 rounded-full', STATUS_COLORS.under.bar)} />

// Unused rule (slate)
<span className={cn('w-2 h-2 rounded-full', STATUS_COLORS.neutral.bar)} />
```

### Anti-Patterns to Avoid
- **Do NOT compute match results in the orchestrator:** The orchestrator is already 406 lines. Adding match logic there violates the Phase 1 component-split principle. Keep it in RecurringTab via useMemo.
- **Do NOT create a new backend endpoint for "sync everything":** The frontend already has access to `client.halo.syncCustomer()` and `client.functions.invoke()`. A new backend endpoint would duplicate logic and add maintenance surface. Keep orchestration in the frontend.
- **Do NOT run sync steps in parallel:** Decision D-10 explicitly says sequential. Parallel sync has harder error semantics and HaloPSA rate limits are a concern.
- **Do NOT mutate the lineItems/rules arrays:** Use `useMemo` to derive new arrays. Never push/splice the source data (per coding style rules).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Pattern matching | Custom regex or string matching | `lineItemMatchesRule()` from `lootit-reconciliation.js` | Already handles pipe-separated OR patterns, case insensitivity, configurable match_field |
| Color coding | Custom color constants | `STATUS_COLORS` from `lootit-constants.js` | Consistent with entire LootIT module, has bg/border/text/icon/bar variants |
| Toast notifications | Custom notification system | `toast` from `sonner` | Already wired with Toaster provider, used in 50+ places |
| Table rendering | Custom div-based table | `Table` components from `@/components/ui/table` | shadcn Table with proper accessibility, consistent styling |
| Cache invalidation | Manual refetch calls | `queryClient.invalidateQueries()` | TanStack Query handles stale marking, background refetch, dedup |
| Class merging | String concatenation | `cn()` from `@/lib/utils` | Handles Tailwind class conflicts properly |

**Key insight:** This phase requires ZERO new libraries or utilities. Every building block exists and is battle-tested in the codebase.

## Common Pitfalls

### Pitfall 1: Using customer.id instead of customer.external_id for HaloPSA API
**What goes wrong:** The `halo.syncCustomer()` and `syncHaloPSARecurringBills` functions expect the HaloPSA external ID (numeric), not the PortalIT UUID.
**Why it happens:** The orchestrator receives `customer` as a prop with both `id` (UUID) and `external_id` (HaloPSA ID). Easy to confuse.
**How to avoid:** Always use `customer.external_id` for any HaloPSA API call. Use `customer.id` for query keys and Supabase operations.
**Warning signs:** API returns 404 or "Customer not found in database" error during sync.

### Pitfall 2: Not invalidating the per-customer line items query
**What goes wrong:** After sync, the Recurring tab shows stale data because the customer-specific query was not invalidated.
**Why it happens:** The orchestrator has TWO line item queries: `['recurring_bill_line_items']` (global) and `['recurring_bill_line_items_customer', customer.id]` (per-customer, line 52). Both need invalidation.
**How to avoid:** Include both query keys in the sync cleanup:
```js
await queryClient.invalidateQueries({ queryKey: ['recurring_bill_line_items'] });
await queryClient.invalidateQueries({ queryKey: ['recurring_bill_line_items_customer', customer.id] });
```
**Warning signs:** Global dashboard refreshes but customer detail page shows old line items.

### Pitfall 3: Rules without is_active flag polluting match results
**What goes wrong:** Inactive rules appear as "unused" when they should be invisible.
**Why it happens:** The `reconciliation_rules` query returns ALL rules. Only active rules should participate in matching.
**How to avoid:** Filter rules with `rules.filter(r => r.is_active)` before running match logic. The existing `reconcileCustomer()` function does this (line 235), so follow its pattern.
**Warning signs:** "Unused" count is unexpectedly high, includes disabled rules.

### Pitfall 4: Sync button not disabling during sync
**What goes wrong:** User clicks sync multiple times, triggering concurrent API calls.
**Why it happens:** If `isSyncing` state is not set before the first await, there is a brief window where double-clicks get through.
**How to avoid:** Set `setIsSyncing(true)` as the very first line before any async operation. The `finally` block handles reset.
**Warning signs:** Multiple "Syncing..." toasts appearing simultaneously.

### Pitfall 5: Orchestrator file exceeding 800-line limit
**What goes wrong:** Adding tab rendering + sync logic pushes the orchestrator past the coding convention limit.
**Why it happens:** Adding a new tab option to the JSX array (3 lines) and replacing handleSync (15 lines net) should keep it well under 450 total lines. But if match logic is added to the orchestrator instead of RecurringTab, it could grow past the limit.
**How to avoid:** Keep all match computation and table rendering in RecurringTab.jsx. Orchestrator only passes raw data props.
**Warning signs:** Orchestrator growing past ~450 lines.

## Code Examples

### Match Computation (for RecurringTab useMemo)
```jsx
// Source: lootit-reconciliation.js lineItemMatchesRule + matchLineItemToRules
import { matchLineItemToRules } from '@/lib/lootit-reconciliation';

const { matchedItems, unmatchedItems, unusedRules, counts } = useMemo(() => {
  const activeRules = rules.filter(r => r.is_active);
  const rulesWithMatches = new Set();
  const matched = [];
  const unmatched = [];

  for (const item of lineItems) {
    const matchingRules = matchLineItemToRules(item, activeRules);
    if (matchingRules.length > 0) {
      matched.push({ ...item, matchStatus: 'matched', matchedRule: matchingRules[0] });
      matchingRules.forEach(r => rulesWithMatches.add(r.id));
    } else {
      unmatched.push({ ...item, matchStatus: 'unmatched', matchedRule: null });
    }
  }

  const unused = activeRules
    .filter(r => !rulesWithMatches.has(r.id))
    .map(r => ({ matchStatus: 'unused', rule: r }));

  return {
    matchedItems: matched,
    unmatchedItems: unmatched,
    unusedRules: unused,
    counts: {
      all: matched.length + unmatched.length,
      matched: matched.length,
      unmatched: unmatched.length,
      unused: unused.length,
    },
  };
}, [lineItems, rules]);
```

### Tab Bar Addition (orchestrator JSX)
```jsx
// Source: LootITCustomerDetail.jsx lines 311-333
// Add 'recurring' to the tab array alongside existing tabs
{[
  { key: 'reconciliation', label: 'Reconciliation', icon: RotateCcw },
  { key: 'recurring', label: 'Recurring', icon: Repeat2, badge: allLineItems.length || null },
  { key: 'contract', label: 'Contract', icon: FileText, badge: contracts.length || null },
].map((tab) => (
  // ... existing tab button rendering unchanged
))}
```

### Master Sync Handler (replaces current handleSync)
```jsx
// Source: Decision D-09 through D-14
const handleSync = async () => {
  setIsSyncing(true);
  try {
    // Step 1: Sync customer + contacts from HaloPSA
    try {
      await client.halo.syncCustomer(customer.external_id);
    } catch (err) {
      toast.error(`Customer sync failed: ${err.message}`);
    }

    // Step 2: Sync recurring bills + line items
    try {
      await client.functions.invoke('syncHaloPSARecurringBills', {
        action: 'sync_customer',
        customer_id: customer.external_id,
      });
    } catch (err) {
      toast.error(`Recurring bill sync failed: ${err.message}`);
    }

    // Step 3: Invalidate ALL caches to pull fresh data
    await queryClient.invalidateQueries({ queryKey: ['reconciliation_rules'] });
    await queryClient.invalidateQueries({ queryKey: ['recurring_bills'] });
    await queryClient.invalidateQueries({ queryKey: ['recurring_bill_line_items'] });
    await queryClient.invalidateQueries({ queryKey: ['recurring_bill_line_items_customer', customer.id] });
    await queryClient.invalidateQueries({ queryKey: ['reconciliation_reviews', customer.id] });
    await queryClient.invalidateQueries({ queryKey: ['lootit_contracts', customer.id] });
    await queryClient.invalidateQueries({ queryKey: ['customer_contacts', customer.id] });
    await queryClient.invalidateQueries({ queryKey: ['customer_devices', customer.id] });
    // Invalidate all mapping queries (vendor data)
    await queryClient.invalidateQueries({
      predicate: (q) => String(q.queryKey[0]).startsWith('lootit_entity_'),
    });

    toast.success(`All data synced for ${customer.name}`);
  } finally {
    setIsSyncing(false);
  }
};
```

### Table Row with Status Dot
```jsx
// Source: shadcn Table + STATUS_COLORS
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { STATUS_COLORS } from './lootit-constants';

<TableRow key={item.id}>
  <TableCell className="font-medium">
    <div className="flex items-center gap-2">
      <span className={cn(
        'w-2 h-2 rounded-full flex-shrink-0',
        item.matchStatus === 'matched' ? STATUS_COLORS.match.bar
          : item.matchStatus === 'unmatched' ? STATUS_COLORS.under.bar
          : STATUS_COLORS.neutral.bar
      )} />
      <span className="truncate">{item.description}</span>
    </div>
  </TableCell>
  <TableCell className="tabular-nums text-right">{item.quantity}</TableCell>
  <TableCell className="tabular-nums text-right">${parseFloat(item.price || 0).toFixed(2)}</TableCell>
  <TableCell className="tabular-nums text-right">${parseFloat(item.net_amount || 0).toFixed(2)}</TableCell>
  <TableCell className="text-muted-foreground">{item.item_code}</TableCell>
  <TableCell>{item.active ? 'Active' : 'Inactive'}</TableCell>
  <TableCell>
    {item.matchedRule
      ? <span className={cn('text-xs font-medium', STATUS_COLORS.match.text)}>{item.matchedRule.label}</span>
      : <span className={cn('text-xs', STATUS_COLORS.under.text)}>Unmatched</span>
    }
  </TableCell>
</TableRow>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| handleSync = cache invalidation only | handleSync = API calls + cache invalidation | This phase | Ensures fresh data from HaloPSA, not just stale cache |
| No Recurring tab | Recurring tab with match status | This phase | MSP operators can see which line items are reconciled |
| 2-tab layout (Reconciliation + Contract) | 3-tab layout (+ Recurring) | This phase | More information density without visual clutter |

## Open Questions

1. **Lucide icon for Recurring tab**
   - What we know: ReconciliationTab uses `RotateCcw`, ContractTab uses `FileText`
   - What's unclear: Best icon for "recurring" -- `Repeat2`, `ListChecks`, `Receipt`, or `CalendarClock` are all reasonable
   - Recommendation: Use `Repeat2` from lucide-react (visually distinct from RotateCcw, semantically correct for "recurring")

2. **Whether to guard sync behind customer.external_id check**
   - What we know: `customer.external_id` is required for all HaloPSA calls. If null, sync will fail.
   - What's unclear: Can there be customers without external_id in the LootIT context?
   - Recommendation: Add an early guard `if (!customer.external_id)` to show a toast warning instead of calling APIs that will fail. The Dashboard.jsx already does this check (line 587).

## Project Constraints (from CLAUDE.md)

- **Immutability (CRITICAL):** Always create new objects via spread/map, never mutate existing arrays or objects. Match computation must use `useMemo` returning new arrays.
- **File Organization:** Many small files > few large files. 200-400 lines typical, 800 max. RecurringTab must be a separate file.
- **Error Handling:** Handle errors explicitly at every level. Sync steps must have individual try/catch.
- **No console.log:** Use proper toast notifications, not console.log for user-facing feedback.
- **No emojis in UI:** Use Lucide icons exclusively for visual indicators.
- **Functions < 50 lines:** Keep handleSync focused. Match computation in a separate useMemo, not inline.
- **No hardcoded values:** Use STATUS_COLORS constants, not inline color strings.
- **GSD Workflow:** All changes go through GSD planning system.

## Sources

### Primary (HIGH confidence)
- `src/components/lootit/LootITCustomerDetail.jsx` -- orchestrator: tab system (line 231, 311-333), sync handler (line 174-184), allLineItems query (line 52-61)
- `src/components/lootit/ReconciliationTab.jsx` -- reference pattern for filter chips and tab content (99 lines)
- `src/components/lootit/CustomerDetailHeader.jsx` -- sync button with isSyncing + RefreshCw spinner (line 46-53)
- `src/components/lootit/lootit-constants.js` -- STATUS_COLORS: match (emerald), under (red), neutral (slate)
- `src/lib/lootit-reconciliation.js` -- `lineItemMatchesRule()` (line 204-212), `matchLineItemToRules()` (line 217-219)
- `src/api/client.js` -- `halo.syncCustomer()` (line 477-478), `functions.invoke()` (line 366-369)
- `server/src/routes/halo.js` -- `POST /sync/customer` expects `customer_id` as HaloPSA external ID (line 236-241)
- `server/src/functions/syncHaloPSARecurringBills.js` -- `sync_customer` action with `customer_id` (line 49-54)
- `src/hooks/useReconciliationData.js` -- rules query (line 19-23), full data pipeline
- `src/components/ui/table.jsx` -- shadcn Table components

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in use, zero new dependencies
- Architecture: HIGH -- follows exact patterns from Phase 1 component split and ReconciliationTab
- Pitfalls: HIGH -- identified from direct code reading of both endpoints, query keys, and existing sync patterns

**Research date:** 2026-03-31
**Valid until:** 2026-04-30 (stable -- no framework migrations or dependency changes expected)
