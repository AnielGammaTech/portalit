# Phase 2: Customer Header & Compact Service Cards - Research

**Researched:** 2026-03-31
**Domain:** React component redesign (Tailwind CSS layout, data binding, responsive grids)
**Confidence:** HIGH

## Summary

Phase 2 is a UI-focused phase that modifies four existing components to show richer customer data in the header and to compress service cards to fit 3-4 per row. No new data fetching is required -- all data (customer details, contacts, recurring bills, contracts, reconciliation summaries) is already available through existing hooks and props. The work is purely presentational: adding new sections to the header, computing derived financial values from existing data, and shrinking the card layout.

The primary technical concerns are: (1) ensuring financial computations (MRR, contract value, billing status) use the correct data sources that are already fetched, (2) maintaining interactivity on smaller cards where action buttons lose their text labels, and (3) responsive grid breakpoints that accommodate both the main ServiceCard grid and the Pax8SubscriptionCard grid.

**Primary recommendation:** Modify `CustomerDetailHeader.jsx` to add a customer info row (contact/address) in the dark band and a financial summary row in the light area. Modify `ServiceCard.jsx` and `Pax8SubscriptionCard.jsx` with reduced spacing/font sizes. Change `ReconciliationTab.jsx` grid from `md:grid-cols-2` to `md:grid-cols-3 lg:grid-cols-4`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Customer details (company name, primary contact, address) come from the existing `customer` prop which already contains HaloPSA metadata. The `contacts` data from `useCustomerContacts` hook provides contact details.
- **D-02:** Display: company name (already shown), primary contact name + email, and address if available. Show in the dark header band alongside existing elements.
- **D-03:** If no contact/address data exists, show graceful empty state (dash or "No contact on file") -- never blank space.
- **D-04:** MRR derived from `recurring_bills` data -- sum of active recurring bill amounts for the customer. Already fetched in the reconciliation data flow.
- **D-05:** Contract value from `contracts` array (already fetched) -- sum of `extracted_data.monthly_total` from contracts with `extraction_status: 'complete'`.
- **D-06:** Billing status derived from reconciliation health: "Healthy" (80%+), "Needs Review" (50-79%), "At Risk" (<50%). Shown as a colored badge.
- **D-07:** Financial summary displayed as a compact row in the light content area of the header, below the integration widgets.
- **D-08:** Health score already implemented in Phase 1 as a % badge in the dark header. Keep as-is -- Phase 2 just ensures it's connected to real data properly.
- **D-09:** Header retains the Phase 1 dashboard-pro styling (dark/navy gradient, light content area). Phase 2 adds content, not restyling.
- **D-10:** Integration stat widgets stay compact (already 6-column grid from Phase 1). Ensure they pull real counts from actual vendor data, not hardcoded placeholders.
- **D-11:** Cards shrink ~50% -- reduce padding, font sizes, and big number size (text-3xl to text-xl). Target: cards fit 3-4 per row on standard desktop (grid-cols-2 to grid-cols-3 lg:grid-cols-4).
- **D-12:** Keep ALL data: PSA vs Vendor counts, status badge, integration label, action buttons. Nothing removed -- just smaller.
- **D-13:** Action bar compresses: buttons become icon-only (tooltip on hover) instead of icon+text. OK button stays green, Skip stays gray, but smaller.
- **D-14:** "vs" separator between PSA and Vendor numbers becomes a thin vertical divider instead of text.
- **D-15:** Notes section collapses to a small icon indicator -- expand on click.

### Claude's Discretion
- Exact responsive breakpoints for 3-col vs 4-col card grid
- Whether financial summary goes above or below integration widgets
- Exact font sizes for compact card numbers (text-lg vs text-xl)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| HEAD-01 | Header displays real customer details (company name, contact, address) from HaloPSA data | Customer object has `name`, `email`, `phone`, `address` fields. Contacts have `full_name`, `email`, `phone`, `title`. Both already passed as props to header. |
| HEAD-02 | Header shows financial summary (MRR from recurring bills, contract value, billing status) | `allLineItems` (recurring bill line items) already queried. Contracts already fetched with `extracted_data.monthly_total`. `healthPct` already computed. All data available in orchestrator. |
| HEAD-03 | Header shows reconciliation health score with visual indicator | Already implemented in Phase 1 (`healthPct` badge with color coding). Verify it connects to real data. |
| HEAD-04 | Header redesigned in dashboard-pro style | Already done in Phase 1. Phase 2 adds content within existing style. |
| HEAD-05 | Integration stat widgets redesigned to be more compact and informative | Already compact 6-column grid from Phase 1. Phase 2 ensures real data (not placeholders). |
| CARD-01 | Service cards shrunk ~50% so 3-4 cards fit per row | Grid change in ReconciliationTab + padding/font reduction in ServiceCard and Pax8SubscriptionCard. |
| CARD-02 | Card layout retains PSA vs Vendor counts, status badge, and action buttons at smaller size | All elements preserved -- sizes reduced, action buttons go icon-only with tooltips. |
| CARD-03 | Cards remain interactive (review, dismiss, map, notes) at compact size | Tooltip-wrapped icon buttons maintain all interactivity. Notes collapse to icon indicator. |
</phase_requirements>

## Standard Stack

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react | ^18.2.0 | UI framework | Project standard |
| tailwindcss | ^3.4.17 | Utility-first CSS | Project design system |
| @radix-ui/react-tooltip | ^1.1.8 | Accessible tooltips for icon-only buttons | Already installed, has shadcn wrapper at `src/components/ui/tooltip.jsx` |
| lucide-react | ^0.475.0 | Icon library | Project standard for all icons |
| @tanstack/react-query | ^5.84.1 | Data fetching/caching | All data hooks use TanStack Query |

### Supporting (already in use)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| clsx + tailwind-merge (via cn()) | - | Conditional class merging | Every dynamic className |
| sonner | - | Toast notifications | Error/success feedback |

**No new dependencies needed.** Everything required is already installed.

## Architecture Patterns

### Components Modified (not new)
```
src/components/lootit/
  CustomerDetailHeader.jsx   # ADD: contact row, financial summary row
  ServiceCard.jsx            # MODIFY: shrink all sizes, icon-only actions
  Pax8SubscriptionCard.jsx   # MODIFY: same shrink treatment as ServiceCard
  ReconciliationTab.jsx      # MODIFY: grid-cols-2 -> grid-cols-3 lg:grid-cols-4
  (LootITCustomerDetail.jsx) # MODIFY: compute + pass new financial props
```

### Pattern 1: Financial Data Computation in Orchestrator
**What:** MRR and contract value are derived data computed in `LootITCustomerDetail.jsx` (the orchestrator) and passed as props.
**When to use:** Always -- follow the existing pattern where data computation lives in the orchestrator, not in display components.
**Example:**
```jsx
// In LootITCustomerDetail.jsx -- add to existing useMemo computations
const financialSummary = useMemo(() => {
  // MRR: sum of active recurring bill line item amounts
  const mrr = allLineItems.reduce((sum, li) => sum + (parseFloat(li.net_amount) || 0), 0);
  
  // Contract value: sum of extracted monthly_total from complete contracts
  const contractValue = contracts
    .filter(c => c.extraction_status === 'complete' && c.extracted_data?.monthly_total)
    .reduce((sum, c) => sum + (parseFloat(c.extracted_data.monthly_total) || 0), 0);
  
  // Billing status derived from healthPct
  const billingStatus = healthPct >= 80 ? 'healthy' : healthPct >= 50 ? 'needs_review' : 'at_risk';
  
  return { mrr, contractValue, billingStatus };
}, [allLineItems, contracts, healthPct]);
```

### Pattern 2: Icon-Only Buttons with Tooltip
**What:** Action buttons in compact cards use icons only, with Radix Tooltip for labels.
**When to use:** For all action buttons in the compact ServiceCard and Pax8SubscriptionCard.
**Example:**
```jsx
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';

// Wrap the action bar (or higher parent) with TooltipProvider
<TooltipProvider delayDuration={300}>
  <Tooltip>
    <TooltipTrigger asChild>
      <button
        onClick={() => handleActionWithNote('review')}
        disabled={isSaving}
        className="p-1.5 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 transition-colors"
      >
        <Check className="w-3.5 h-3.5" />
      </button>
    </TooltipTrigger>
    <TooltipContent>OK</TooltipContent>
  </Tooltip>
</TooltipProvider>
```

### Pattern 3: Thin Vertical Divider (replacing "vs" text)
**What:** Replace the `px-2 text-slate-300 text-sm font-bold` "vs" text div with a thin vertical line.
**When to use:** In both ServiceCard and Pax8SubscriptionCard between PSA and Vendor number boxes.
**Example:**
```jsx
// Before (current):
<div className="px-2 text-slate-300 text-sm font-bold">vs</div>

// After (compact):
<div className="w-px bg-slate-200 self-stretch my-1" />
```

### Pattern 4: Collapsible Notes Indicator
**What:** Notes section shows only a small icon when collapsed, expands inline on click.
**When to use:** When a card has notes but the notes panel is not actively being edited.
**Example:**
```jsx
// Current notes display (full width banner) becomes:
// Just the StickyNote icon in the action bar (already exists as a button)
// The hasNotes condition in the card body is removed -- notes only show when showNotes is true
```

### Pattern 5: Primary Contact Selection
**What:** Show the first contact from the contacts array as the "primary contact".
**When to use:** In the header dark band for HEAD-01.
**Example:**
```jsx
const primaryContact = contacts.length > 0 ? contacts[0] : null;
// Display: primaryContact.full_name + primaryContact.email
// Fallback: "No contact on file"
```

### Anti-Patterns to Avoid
- **Mutating existing data objects:** Never modify `dollarImpact`, `summary`, or `contracts` in place. Always derive new computed values via `useMemo`.
- **Adding data fetching to display components:** `CustomerDetailHeader` must remain a pure display component receiving props only. Financial computations go in the orchestrator.
- **Hardcoding financial values:** MRR and contract value must come from real data, not placeholder numbers.
- **Removing card functionality:** D-12 is explicit -- keep ALL data and interactions. Only reduce sizes.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tooltips for icon-only buttons | Custom hover state with absolute positioned text | `@radix-ui/react-tooltip` via `src/components/ui/tooltip.jsx` | Accessibility (aria, keyboard focus, screen readers) |
| Currency formatting | Manual string concatenation with `$` | `toLocaleString('en-US', { minimumFractionDigits: 2 })` | Already used in the codebase, handles edge cases |
| Responsive grid breakpoints | Custom media queries in CSS | Tailwind responsive prefixes `md:grid-cols-3 lg:grid-cols-4` | Consistent with entire codebase |
| Status color mapping | Inline ternary chains for colors | `STATUS_COLORS` from `lootit-constants.js` | Single source of truth, already established |

## Common Pitfalls

### Pitfall 1: TooltipProvider Placement
**What goes wrong:** Radix Tooltip requires `<TooltipProvider>` as an ancestor. If placed inside each button, it creates unnecessary React tree depth and inconsistent delay behavior.
**Why it happens:** Developer wraps each tooltip individually instead of wrapping the card or action bar once.
**How to avoid:** Place a single `<TooltipProvider delayDuration={300}>` around the action bar div in each card component. All `<Tooltip>` children inherit from it.
**Warning signs:** Tooltips have inconsistent hover delays or don't appear at all.

### Pitfall 2: Financial Data NaN/undefined
**What goes wrong:** `parseFloat(undefined)` returns `NaN`, which propagates through sum calculations and shows "NaN" in the UI.
**Why it happens:** Recurring bill line items or contract extracted data may have null/undefined amount fields.
**How to avoid:** Always default to 0: `parseFloat(li.net_amount) || 0`. The existing `dollarImpact` computation already does this correctly -- follow the same pattern.
**Warning signs:** "$NaN" or "$undefined" appearing in the financial summary.

### Pitfall 3: Grid Overflow on Narrow Screens
**What goes wrong:** With `lg:grid-cols-4`, cards on medium screens (768-1024px) may be too narrow to display their content, especially cards with long integration labels or exclusion badges.
**Why it happens:** 4 columns at 1024px gives each card only ~256px width, which can squeeze the PSA/Vendor number boxes.
**How to avoid:** Use `md:grid-cols-3 lg:grid-cols-4` so 4-col only kicks in at 1024px+. Test that cards at ~250px width still render all elements without overflow.
**Warning signs:** Text truncation in unexpected places, horizontal scrollbar, overlapping elements.

### Pitfall 4: Pax8SubscriptionCard Inconsistency
**What goes wrong:** ServiceCard gets the compact treatment but Pax8SubscriptionCard is forgotten, creating a visual mismatch in the same tab.
**Why it happens:** ReconciliationTab renders two separate grids -- one for `filteredRecons` (ServiceCard) and one for `filteredPax8` (Pax8SubscriptionCard). Both grids need the same column changes.
**How to avoid:** Apply identical grid classes to both grids in ReconciliationTab. Apply identical size reductions to both card components.
**Warning signs:** Pax8 section at the bottom looks larger/different from the main reconciliation section above it.

### Pitfall 5: Notes Expansion Breaking Card Height
**What goes wrong:** When a user expands notes on a compact card in a multi-column grid, the card expands vertically and pushes other cards down unevenly.
**Why it happens:** CSS grid auto-rows accommodate the tallest item in each row. An expanded textarea adds significant height.
**How to avoid:** This is inherent to the grid layout and is acceptable behavior. The notes textarea already exists in the current design. With smaller cards, the relative expansion is more noticeable but still correct behavior.
**Warning signs:** Not a bug -- just something to be aware of during testing.

### Pitfall 6: Health Score Already Wired
**What goes wrong:** Developer re-implements health score logic thinking it needs work for HEAD-03.
**Why it happens:** HEAD-03 says "Header shows reconciliation health score with visual indicator" which sounds like new work, but Phase 1 already implemented it.
**How to avoid:** Verify the existing `healthPct` computation in the orchestrator (line 280-281 of LootITCustomerDetail.jsx) and the badge rendering in CustomerDetailHeader.jsx (lines 37-42). HEAD-03 requires only verification, not implementation.
**Warning signs:** Duplicate health score logic or visual elements.

## Code Examples

### Example 1: Customer Info Row in Dark Header Band
```jsx
// In CustomerDetailHeader.jsx -- add below the existing title row
// customer prop has: name, email, phone, address
// contacts prop is an array with: full_name, email, phone, title
const primaryContact = contacts.length > 0 ? contacts[0] : null;

<div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
  {primaryContact ? (
    <span>{primaryContact.full_name} · {primaryContact.email || 'No email'}</span>
  ) : (
    <span>No contact on file</span>
  )}
  {customer.address && (
    <>
      <span className="text-slate-600">|</span>
      <span className="truncate">{customer.address}</span>
    </>
  )}
</div>
```

### Example 2: Financial Summary Row
```jsx
// In CustomerDetailHeader.jsx -- light content area, below integration widgets
// financialSummary prop has: mrr, contractValue, billingStatus
const BILLING_STATUS_CONFIG = {
  healthy: { label: 'Healthy', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  needs_review: { label: 'Needs Review', className: 'bg-amber-100 text-amber-700 border-amber-200' },
  at_risk: { label: 'At Risk', className: 'bg-red-100 text-red-700 border-red-200' },
};

<div className="flex items-center gap-4 text-sm">
  <div>
    <span className="text-slate-400 text-xs uppercase tracking-wide">MRR</span>
    <p className="font-bold text-slate-900">${financialSummary.mrr.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
  </div>
  <div className="w-px h-8 bg-slate-200" />
  <div>
    <span className="text-slate-400 text-xs uppercase tracking-wide">Contract</span>
    <p className="font-bold text-slate-900">${financialSummary.contractValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
  </div>
  <div className="w-px h-8 bg-slate-200" />
  <span className={cn('px-2 py-0.5 text-xs font-semibold rounded-full border', BILLING_STATUS_CONFIG[financialSummary.billingStatus].className)}>
    {BILLING_STATUS_CONFIG[financialSummary.billingStatus].label}
  </span>
</div>
```

### Example 3: Compact Card Number Sizes
```jsx
// ServiceCard.jsx -- big numbers section (currently text-3xl)
// Reduce to text-xl, reduce padding from py-2 to py-1.5
<div className="flex items-center mb-2">
  <div className={cn('flex-1 text-center py-1.5 rounded-l-lg border', styles.numBg)}>
    <p className={cn('text-xl font-black leading-none', styles.numText)}>
      {psaQty !== null ? psaQty : '\u2014'}
    </p>
    <p className={cn('text-[9px] uppercase tracking-widest font-bold mt-0.5', styles.labelText)}>PSA</p>
  </div>
  <div className="w-px bg-slate-200 self-stretch my-1" />
  <div className={cn('flex-1 text-center py-1.5 rounded-r-lg border', styles.numBg)}>
    <p className={cn('text-xl font-black leading-none', styles.numText)}>
      {effectiveVendorQty !== null ? effectiveVendorQty : '\u2014'}
    </p>
    <p className={cn('text-[9px] uppercase tracking-widest font-bold mt-0.5', styles.labelText)}>VENDOR</p>
  </div>
</div>
```

### Example 4: Compact Action Bar with Icon-Only Buttons
```jsx
// ServiceCard.jsx -- action bar becomes icon-only with tooltips
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';

<TooltipProvider delayDuration={300}>
  <div onClick={(e) => e.stopPropagation()} className={cn('flex items-center gap-1.5 pt-1.5 border-t', borderColor)}>
    {!isReviewed && status !== 'match' && status !== 'no_data' && (
      <>
        <Tooltip>
          <TooltipTrigger asChild>
            <button onClick={() => handleActionWithNote('review')} disabled={isSaving}
              className="p-1.5 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 shadow-sm transition-colors disabled:opacity-50">
              <Check className="w-3.5 h-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent>OK</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button onClick={() => handleActionWithNote('dismiss')} disabled={isSaving}
              className="p-1.5 rounded-lg bg-slate-200 text-slate-700 hover:bg-slate-300 transition-colors disabled:opacity-50">
              <X className="w-3.5 h-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent>Skip</TooltipContent>
        </Tooltip>
      </>
    )}
    {/* ... similar for Undo, Note, Map */}
  </div>
</TooltipProvider>
```

### Example 5: Updated Grid in ReconciliationTab
```jsx
// ReconciliationTab.jsx -- change both card grids
// Current: grid grid-cols-1 md:grid-cols-2 gap-4
// New:     grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3

// Main reconciliation grid (line 52)
<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">

// Pax8 grid (line 78)
<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
```

## Data Shape Reference

### Customer Object (from HaloPSA)
```
customer.name        // string - company name (already displayed)
customer.email       // string | null - company email
customer.phone       // string | null - company phone
customer.address     // string | null - full address string
customer.logo_url    // string | null - company logo
customer.primary_contact // string | null - contact name
```

### Contact Object (from useCustomerContacts)
```
contact.full_name    // string - contact display name
contact.email        // string | null
contact.phone        // string | null
contact.title        // string | null - job title
```

### Recurring Bill Line Item
```
lineItem.net_amount  // number | string - needs parseFloat
lineItem.description // string
lineItem.quantity    // number
lineItem.unit_price  // number
```

### Contract Object (with extraction)
```
contract.extraction_status  // 'pending' | 'complete' | 'failed'
contract.extracted_data     // object | null
  .monthly_total            // number - total monthly fee
  .line_items               // array - individual items
```

### Summary Object (from getDiscrepancySummary)
```
summary.total     // number
summary.matched   // number
summary.over      // number
summary.under     // number
summary.noData    // number
summary.reviewed  // number
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 2-col card grid | 3-4 col compact grid | This phase | Fits more cards on screen |
| Text-labeled buttons (OK, Skip) | Icon-only with tooltip | This phase | Saves horizontal space |
| "vs" text separator | Thin vertical line | This phase | Cleaner compact appearance |
| Header shows counts only | Header shows business context | This phase | MSP operators get real info |

## Project Constraints (from CLAUDE.md)

- **Immutability:** Always create new objects, never mutate existing ones. Use spread operator and `useMemo` for derived data.
- **File size limit:** 800 lines max. CustomerDetailHeader is 121 lines, ServiceCard is 263 lines -- both well within limits even after additions.
- **Design system:** Radix UI + Tailwind CSS. Use existing design tokens from `tailwind.config.js`.
- **No emojis:** Use Lucide icons only (from global instructions).
- **Error handling:** Handle null/undefined gracefully for all customer data fields (D-03).
- **GSD workflow:** Changes must go through GSD commands.
- **Coding style:** Functions under 50 lines, files under 800 lines, no deep nesting, proper error handling, no hardcoded values.

## Open Questions

1. **Recurring bill line item amount field name**
   - What we know: The line item entity exists and is queried. The `dollarImpact` computation uses `r.price` from reconciliation objects, and `allLineItems` is fetched separately.
   - What's unclear: The exact field name for the line item amount -- it could be `net_amount`, `amount`, or `price`. The codebase uses `parseFloat(price)` on reconciliation objects.
   - Recommendation: Inspect a sample line item at runtime or check the API entity definition. The `net_amount` field name appears in the CONTEXT.md discussion and is the most likely candidate. Fall back to 0 if undefined.

2. **Customer address format**
   - What we know: `customer.address` is a single string field used in `CustomerPortalPreview.jsx` and `CustomerSettings.jsx`.
   - What's unclear: Whether it is a single-line string or multi-line. The existing usage treats it as a single string.
   - Recommendation: Display as-is in a single line with `truncate` class. It is a single concatenated address string from HaloPSA.

## Sources

### Primary (HIGH confidence)
- Codebase inspection -- all component files, hooks, constants, and data patterns read directly
- `CustomerDetailHeader.jsx` (121 lines) -- current header structure and props
- `ServiceCard.jsx` (263 lines) -- current card layout, action bar, notes
- `Pax8SubscriptionCard.jsx` (243 lines) -- Pax8 variant with same patterns
- `ReconciliationTab.jsx` (99 lines) -- grid layout, both card sections
- `LootITCustomerDetail.jsx` (394 lines) -- orchestrator, all data queries and computed values
- `useCustomerData.js` -- contact, device, and other customer data hooks
- `useReconciliationData.js` -- reconciliation computation pipeline
- `lootit-constants.js` -- STATUS_COLORS shared design tokens
- `src/components/ui/tooltip.jsx` -- Radix Tooltip wrapper (ready to use)
- `package.json` -- Tailwind 3.4.17, Radix Tooltip 1.1.8, React 18.2, TanStack Query 5.84

### Secondary (MEDIUM confidence)
- Customer object shape inferred from usage across `CustomerPortalPreview.jsx`, `CustomerSettings.jsx`, `Dashboard.jsx`, `CustomerDetail.jsx` -- fields: name, email, phone, address, logo_url, primary_contact

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already installed and in use, verified from package.json
- Architecture: HIGH -- all components read, all data flows traced, patterns documented from actual code
- Pitfalls: HIGH -- identified from reading actual component structure and anticipating compact layout issues

**Research date:** 2026-03-31
**Valid until:** 2026-04-30 (stable -- no external dependencies, all internal code)
