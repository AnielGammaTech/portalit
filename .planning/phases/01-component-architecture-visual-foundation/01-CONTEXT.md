# Phase 1: Component Architecture & Visual Foundation - Context

**Gathered:** 2026-03-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Split LootITCustomerDetail.jsx (1679 lines) into focused, reusable components and establish a dashboard-pro visual language across the customer detail page. No new features — purely architectural refactor and visual upgrade.

</domain>

<decisions>
## Implementation Decisions

### Component Splitting Strategy
- **D-01:** Split by feature section — extract CustomerHeader, ReconciliationTab, ContractTab, DetailDrawer, LineItemPicker, and SyncButton as separate component files
- **D-02:** Each extracted component must be <800 lines, ideally 200-400 lines
- **D-03:** Shared state (customer, reconciliation data, query client) passes via props — no new context providers needed
- **D-04:** Keep ServiceCard.jsx (285 lines) and ReconciliationBadge.jsx (34 lines) as-is — already properly sized

### Visual Design System (Dashboard Pro)
- **D-05:** Dashboard-pro aesthetic: dense data layout, clear visual hierarchy, polished typography — inspired by financial dashboards
- **D-06:** Use dark/navy header sections with light content areas for data hierarchy contrast
- **D-07:** Typography scale: use Tailwind's font-size utilities consistently — headings (text-lg/text-xl font-semibold), labels (text-xs uppercase tracking-wide text-muted-foreground), values (text-2xl font-bold tabular-nums)
- **D-08:** Spacing: tighter padding (p-3/p-4) for data-dense areas, consistent gap-3/gap-4 for grid layouts

### Status Color System
- **D-09:** Unify status colors across all sections using Tailwind design tokens:
  - Matched/OK: emerald-500/emerald-50
  - Over-billed: amber-500/amber-50
  - Under-billed: red-500/red-50
  - No data/neutral: slate-400/slate-50
  - Reviewed/dismissed: blue-500/blue-50
- **D-10:** All icons must be Lucide React — no emoji characters anywhere. Existing emojis must be replaced.

### Refactor Approach
- **D-11:** Extract components first (preserve existing visuals), then apply dashboard-pro styling to each component in a second pass — reduces risk of breaking functionality during the restyle
- **D-12:** Keep all existing functionality intact — no behavioral changes in Phase 1

### Claude's Discretion
- File naming convention for extracted components (e.g., CustomerDetailHeader.jsx vs CustomerHeader.jsx)
- Internal component organization within each new file (hooks at top, handlers, then JSX)
- Whether to extract a shared constants file for status colors or keep them inline

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### LootIT Components
- `src/components/lootit/LootITCustomerDetail.jsx` — The 1679-line monolith to split (primary target)
- `src/components/lootit/ServiceCard.jsx` — 285 lines, already properly sized, reference for component style
- `src/components/lootit/ReconciliationBadge.jsx` — 34 lines, status badge pattern
- `src/components/lootit/LootITDashboard.jsx` — 242 lines, parent component that renders CustomerDetail

### Hooks & Data Layer
- `src/hooks/useReconciliationData.js` — Core data hook (reconciliations, pax8Reconciliations)
- `src/hooks/useReconciliationReviews.js` — Review/dismiss/reset actions
- `src/hooks/useCustomerData.js` — Customer contacts and devices
- `src/hooks/useCustomerSync.js` — Sync hook

### UI Foundation
- `src/components/ui/` — Full Radix UI component library (card, tabs, sheet, badge, button, etc.)
- `src/lib/lootit-reconciliation.js` — Pure reconciliation engine (getDiscrepancySummary, etc.)
- `src/lib/utils.js` — Shared utilities (cn, formatLineItemDescription)
- `tailwind.config.js` — Tailwind design tokens and theme

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Radix UI components**: Full set in src/components/ui/ — card, tabs, sheet, badge, button, table, etc. All ready to use.
- **ServiceCard.jsx**: Good reference for component structure — self-contained, receives data via props
- **TanStack Query**: All data fetching uses useQuery/useMutation with queryKey conventions
- **cn() utility**: Tailwind class merging via clsx + tailwind-merge
- **Lucide icons**: Already imported extensively — ArrowLeft, Filter, Check, X, RefreshCw, AlertTriangle, etc.

### Established Patterns
- **State management**: useState + useMemo for local state, TanStack Query for server state — no Redux/Zustand
- **Query invalidation**: Pattern of invalidating related queries after mutations (queryClient.invalidateQueries)
- **Tab system**: useState('reconciliation') with conditional rendering — not using Radix Tabs component
- **Sheet/Drawer**: Radix Sheet component for side panels (detail view)

### Integration Points
- **LootIT.jsx page**: Routes between Dashboard/CustomerDetail/Settings views — renders `<LootITCustomerDetail customer={selectedCustomer} onBack={...} />`
- **Customer prop**: The customer object passed from parent contains: id, name, and HaloPSA metadata
- **Shared query keys**: reconciliation_rules, recurring_bills, recurring_bill_line_items, reconciliation_reviews, pax8_line_item_overrides, lootit_contracts

</code_context>

<specifics>
## Specific Ideas

- User explicitly wants "dashboard-pro" style — dense but polished, like a financial dashboard with clear data hierarchy
- User wants dramatic visual changes, not subtle tweaks (from memory: feedback_quoteit_redesign)
- No emojis — Lucide icons only (from memory: feedback_no_emojis)
- The existing pink/gradient header background can be retained or evolved but the stat widgets and cards need the polished dashboard treatment

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-component-architecture-visual-foundation*
*Context gathered: 2026-03-31*
