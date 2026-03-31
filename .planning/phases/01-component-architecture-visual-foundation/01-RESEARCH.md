# Phase 1: Component Architecture & Visual Foundation - Research

**Researched:** 2026-03-31
**Domain:** React component refactoring + Tailwind CSS visual design system
**Confidence:** HIGH

## Summary

This phase decomposes a 1679-line React monolith (`LootITCustomerDetail.jsx`) into focused, reusable components and applies a dashboard-pro visual language. The codebase already uses React 18 + Vite + Tailwind CSS 3.4 + Radix UI + TanStack Query 5, so no new dependencies are required. The file already contains clearly delineated internal functions (7 distinct components inlined in one file), making the extraction mechanical rather than architectural.

The primary risk is breaking prop threading during extraction -- the main component manages 14 useState hooks and 6 query hooks, with deeply nested callback chains passed to child components. The two-pass approach (extract first, restyle second) from CONTEXT.md decisions is the correct strategy to mitigate this.

**Primary recommendation:** Extract the 6 internal components to separate files first (preserving existing visuals exactly), verify everything still works, then apply dashboard-pro styling in a second pass using the existing Tailwind design tokens and Radix UI primitives.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Split by feature section -- extract CustomerHeader, ReconciliationTab, ContractTab, DetailDrawer, LineItemPicker, and SyncButton as separate component files
- **D-02:** Each extracted component must be <800 lines, ideally 200-400 lines
- **D-03:** Shared state (customer, reconciliation data, query client) passes via props -- no new context providers needed
- **D-04:** Keep ServiceCard.jsx (285 lines) and ReconciliationBadge.jsx (34 lines) as-is -- already properly sized
- **D-05:** Dashboard-pro aesthetic: dense data layout, clear visual hierarchy, polished typography -- inspired by financial dashboards
- **D-06:** Use dark/navy header sections with light content areas for data hierarchy contrast
- **D-07:** Typography scale: use Tailwind's font-size utilities consistently -- headings (text-lg/text-xl font-semibold), labels (text-xs uppercase tracking-wide text-muted-foreground), values (text-2xl font-bold tabular-nums)
- **D-08:** Spacing: tighter padding (p-3/p-4) for data-dense areas, consistent gap-3/gap-4 for grid layouts
- **D-09:** Unify status colors: Matched=emerald-500/50, Over-billed=amber-500/50, Under-billed=red-500/50, No data=slate-400/50, Reviewed=blue-500/50
- **D-10:** All icons must be Lucide React -- no emoji characters anywhere
- **D-11:** Extract components first (preserve existing visuals), then apply dashboard-pro styling -- reduces risk
- **D-12:** Keep all existing functionality intact -- no behavioral changes in Phase 1

### Claude's Discretion
- File naming convention for extracted components (e.g., CustomerDetailHeader.jsx vs CustomerHeader.jsx)
- Internal component organization within each new file (hooks at top, handlers, then JSX)
- Whether to extract a shared constants file for status colors or keep them inline

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UXRD-01 | Customer detail page follows dashboard-pro aesthetic (dense, polished, financial dashboard feel) | Architecture Patterns: Dashboard-Pro Visual Pattern; status color system; typography hierarchy; dark header + light content contrast |
| UXRD-02 | Typography hierarchy establishes clear data importance levels | Typography Scale section with exact Tailwind classes for each hierarchy level |
| UXRD-03 | Color system uses Lucide icons (no emojis), consistent status colors across all sections | Status Color Mapping table; Lucide icon audit confirming zero emojis present; color unification plan |
| UXRD-04 | LootITCustomerDetail.jsx split into smaller focused components (<800 lines each) | Component Split Map with exact line ranges, prop signatures, and estimated output sizes |

</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **GSD Workflow Enforcement:** Before using Edit, Write, or other file-changing tools, start work through a GSD command
- **Immutability:** Always create new objects, never mutate existing ones (from coding-style rules)
- **File organization:** Many small files > few large files; 200-400 lines typical, 800 max
- **Error handling:** Handle errors comprehensively at every level
- **No emojis in ProjectIT:** Always use Lucide icons, never emoji characters in UI
- **Dramatic visual changes:** Make dramatic visual changes, not subtle tweaks (from memory: feedback_quoteit_redesign)
- **Design system:** Radix UI + Tailwind CSS -- use existing design tokens

## Standard Stack

### Core (Already Installed -- No New Dependencies)

| Library | Project Version | Current | Purpose | Why Standard |
|---------|----------------|---------|---------|--------------|
| react | ^18.2.0 | 18.3.1 | UI framework | Project standard |
| tailwindcss | ^3.4.17 | 4.2.2 | Utility CSS | Project's design system foundation; v3 is project standard |
| lucide-react | ^0.475.0 | 1.7.0 | Icons | Project-wide icon library; replaces all emoji usage |
| @radix-ui/react-tabs | ^1.1.3 | 1.1.13 | Accessible tabs | Already installed; project has shadcn/ui Tabs wrapper |
| @radix-ui/react-dialog | ^1.1.6 | -- | Modal dialogs | Already installed; used by Sheet component |
| @tanstack/react-query | ^5.84.1 | 5.96.0 | Server state | All data fetching; query invalidation patterns |
| class-variance-authority | ^0.7.1 | -- | Variant styling | Already installed for component variants |
| tailwind-merge | ^3.0.2 | -- | Class merging | Used via cn() utility |
| clsx | ^2.1.1 | -- | Conditional classes | Used via cn() utility |

### Supporting (Already Available)

| Library | Purpose | When to Use |
|---------|---------|-------------|
| sonner (^2.0.1) | Toast notifications | Feedback on user actions (already used) |
| framer-motion (^11.16.4) | Animations | Available but NOT needed for Phase 1 |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom tab buttons (current) | Radix Tabs component (already installed) | Radix Tabs adds accessibility (keyboard nav, ARIA); current implementation is manual useState. Decision: Claude's discretion, but Radix Tabs is recommended for consistency |
| Inline status color maps | Shared constants file | Shared file reduces duplication across ServiceCard, Pax8SubscriptionCard, ReconciliationBadge; Decision: Claude's discretion |

**Installation:** None required. All dependencies already installed.

## Architecture Patterns

### Current File Structure (Before)
```
src/components/lootit/
  LootITCustomerDetail.jsx   # 1679 lines -- THE MONOLITH
  LootITDashboard.jsx         # 242 lines -- parent, properly sized
  LootITSettings.jsx          # (not in scope)
  ServiceCard.jsx              # 285 lines -- properly sized
  ReconciliationBadge.jsx      # 34 lines -- properly sized
```

### Recommended Project Structure (After)
```
src/components/lootit/
  LootITCustomerDetail.jsx     # ~200-300 lines (orchestrator only)
  CustomerDetailHeader.jsx     # ~250-350 lines (header card + widgets + summary)
  ReconciliationTab.jsx        # ~100-150 lines (filter bar + service card grid)
  ContractTab.jsx              # ~200-300 lines (upload zone + contract list)
  ContractCard.jsx             # ~160 lines (individual contract display)
  UploadProgressCard.jsx       # ~80 lines (upload/extract progress)
  Pax8SubscriptionCard.jsx     # ~250 lines (Pax8 reconciliation card)
  DetailDrawer.jsx             # ~320 lines (side panel for rule details)
  LineItemPicker.jsx           # ~80 lines (modal line item selector)
  RuleEditorDialog.jsx         # ~80 lines (modal rule editor)
  lootit-constants.js          # ~40 lines (shared status colors, action labels)
  LootITDashboard.jsx          # 242 lines (unchanged)
  LootITSettings.jsx           # (unchanged)
  ServiceCard.jsx              # 285 lines (unchanged per D-04)
  ReconciliationBadge.jsx      # 34 lines (unchanged per D-04)
```

### Component Split Map

Exact line boundaries in the current 1679-line file:

| Component | Current Lines | Estimated Extracted Size | Props Required |
|-----------|---------------|--------------------------|----------------|
| `LootITCustomerDetail` (main) | L1-689 | ~200-300 (after extraction) | `{ customer, onBack }` |
| `UploadProgressCard` | L691-773 | ~80 | `{ isUploading, isExtracting }` |
| `ContractCard` | L775-941 | ~165 | `{ contract, extractingId, onDownload, onDelete, onRetryExtract }` |
| `DetailDrawer` | L953-1271 | ~320 | `{ reconciliation, customerId, onSaveExclusion }` |
| `Pax8SubscriptionCard` | L1274-1519 | ~250 | `{ recon, onReview, onDismiss, onReset, onDetails, onMapLineItem, onRemoveMapping, onSaveNotes, hasOverride, isSaving }` |
| `LineItemPicker` | L1521-1601 | ~80 | `{ productName, lineItems, onSelect, onClose }` |
| `RuleEditorDialog` | L1603-1679 | ~80 | `{ rule, onSave, onClose }` |

The main component (L1-689) further breaks down into:
- **Lines 1-14:** Imports
- **Lines 16-310:** All hooks, queries, handlers, computed values
- **Lines 333-447:** Header card JSX -- extract as `CustomerDetailHeader`
- **Lines 449-472:** Tab bar JSX
- **Lines 474-553:** Contract tab JSX -- extract as `ContractTab`
- **Lines 555-647:** Reconciliation tab JSX -- extract as `ReconciliationTab`
- **Lines 649-688:** Drawers/dialogs

### Pattern 1: Prop-Driven Component Extraction

**What:** Move internal functions to separate files, passing all dependencies via props from the parent orchestrator.
**When to use:** When internal components have clear boundaries but share parent state.
**Example:**
```jsx
// CustomerDetailHeader.jsx
import { cn } from '@/lib/utils';
import { ArrowLeft, RefreshCw, Users, Monitor, Server, Hash, FileText, DollarSign, Check, AlertTriangle, CheckCircle2 } from 'lucide-react';

export default function CustomerDetailHeader({
  customer,
  onBack,
  onSync,
  isSyncing,
  healthPct,
  activeIntegrations,
  summary,
  contacts,
  devices,
  contracts,
  dollarImpact,
  issueCount,
}) {
  return (
    <div className="relative bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Health bar */}
      <div className="h-1.5 bg-slate-100">
        <div
          className={cn(
            'h-full transition-all duration-700 rounded-r-full',
            healthPct >= 80 ? 'bg-emerald-500' : healthPct >= 50 ? 'bg-orange-500' : 'bg-red-500'
          )}
          style={{ width: `${healthPct}%` }}
        />
      </div>
      {/* ... rest of header content */}
    </div>
  );
}
```

### Pattern 2: Shared Constants File

**What:** Extract duplicated status color maps and action label configs into a single source of truth.
**When to use:** When 3+ components reference the same status-to-color mapping.
**Example:**
```javascript
// lootit-constants.js
export const STATUS_COLORS = {
  match:   { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-600', icon: 'text-emerald-500', bar: 'bg-emerald-500' },
  over:    { bg: 'bg-amber-50',   border: 'border-amber-200',   text: 'text-amber-600',   icon: 'text-amber-500',   bar: 'bg-amber-500' },
  under:   { bg: 'bg-red-50',     border: 'border-red-200',     text: 'text-red-600',     icon: 'text-red-500',     bar: 'bg-red-500' },
  neutral: { bg: 'bg-slate-50',   border: 'border-slate-200',   text: 'text-slate-400',   icon: 'text-slate-400',   bar: 'bg-slate-300' },
  reviewed:{ bg: 'bg-blue-50',    border: 'border-blue-200',    text: 'text-blue-600',    icon: 'text-blue-500',    bar: 'bg-blue-500' },
};

export const ACTION_LABELS = {
  reviewed:  { label: 'Marked OK',      color: 'text-emerald-600', bg: 'bg-emerald-50' },
  dismissed: { label: 'Skipped',        color: 'text-slate-500',   bg: 'bg-slate-50' },
  reset:     { label: 'Reset',          color: 'text-amber-600',   bg: 'bg-amber-50' },
  note:      { label: 'Note added',     color: 'text-blue-600',    bg: 'bg-blue-50' },
  exclusion: { label: 'Exclusion set',  color: 'text-amber-600',   bg: 'bg-amber-50' },
};
```

### Pattern 3: Dashboard-Pro Typography Hierarchy

**What:** A consistent scale applied across all extracted components.
**When to use:** Every text element in the page.
```
Level 1 - Page/Section Titles:  text-lg font-bold text-slate-900  (or text-xl for the customer name)
Level 2 - Card Headings:        text-sm font-semibold text-slate-900
Level 3 - Section Labels:       text-xs font-semibold uppercase tracking-wider text-muted-foreground
Level 4 - Data Values (large):  text-2xl font-bold tabular-nums text-slate-900
Level 5 - Data Values (medium): text-sm font-semibold text-slate-700
Level 6 - Metadata/Secondary:   text-xs text-slate-400
Level 7 - Micro Labels:         text-[10px] uppercase tracking-wide font-medium text-muted-foreground
```

### Pattern 4: Dark/Navy Header Contrast

**What:** Header sections use a dark background with light text, content areas use light backgrounds.
**When to use:** The CustomerDetailHeader component.
**Example:**
```jsx
// Navy/dark header section
<div className="bg-slate-900 rounded-t-2xl px-5 py-4">
  <h2 className="text-lg font-bold text-white">{customer.name}</h2>
  <p className="text-xs text-slate-400">...</p>
</div>
// Light content area below
<div className="bg-white rounded-b-2xl px-5 py-4">
  {/* Integration widgets, summary stats */}
</div>
```

### Anti-Patterns to Avoid

- **Lifting state too early:** Do NOT create a React Context for this phase. The main component already has all state -- just pass props downward. Context is overhead with no benefit here.
- **Deep prop drilling:** If a component needs more than 8-10 props, consider grouping related data into objects (e.g., `summary` object rather than individual `matched`, `over`, `under` props). The existing code already does this well.
- **Circular imports:** Extracted components should NOT import from `LootITCustomerDetail.jsx`. Shared constants go in `lootit-constants.js`.
- **Restyling during extraction:** Decision D-11 is critical -- extract first with ZERO visual changes, verify, then restyle. Mixing both creates untraceable regressions.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tab switching with keyboard/ARIA | Custom tab buttons with useState | Radix `<Tabs>` component (already installed at `src/components/ui/tabs.jsx`) | Handles keyboard navigation, ARIA roles, focus management |
| Class name merging | String concatenation | `cn()` from `@/lib/utils` (clsx + tailwind-merge) | Handles Tailwind class conflicts correctly |
| Drawer/Sheet panels | Custom positioned divs | Radix `<Sheet>` (already used) | Handles focus trap, escape key, backdrop |
| Modal dialogs | Custom fixed overlays (LineItemPicker, RuleEditorDialog currently do this) | Radix `<Dialog>` (already installed) | Focus trap, body scroll lock, accessible; current custom modals lack these |
| Toast notifications | Custom alert system | `sonner` (already used) | Already integrated project-wide |

**Key insight:** The project already has a full shadcn/ui component library in `src/components/ui/`. The monolith currently bypasses some of these (custom tab buttons instead of Radix Tabs, custom modal overlays instead of Dialog). During the restyle pass, consider migrating LineItemPicker and RuleEditorDialog to use Radix Dialog for accessibility.

## Common Pitfalls

### Pitfall 1: Breaking Callback Chain During Extraction
**What goes wrong:** Handler functions in the main component reference closures over local state. When extracting, forgetting to pass a required closure variable causes silent bugs (e.g., `customer.id` undefined in a handler).
**Why it happens:** The main component's handlers close over `customer`, `queryClient`, `existingOverrides`, `reviews`, and other state. Each must be explicitly threaded.
**How to avoid:** For each extracted component, trace every variable reference back to its source. Create an explicit props interface. Test each extraction immediately before moving to the next.
**Warning signs:** Runtime errors mentioning "cannot read property of undefined", or mutations that fire but don't refresh the correct query keys.

### Pitfall 2: Import Path Confusion After Split
**What goes wrong:** After splitting into multiple files, relative imports between sibling components in the same directory break or become circular.
**Why it happens:** Components in the same directory import each other; copy-paste from the monolith includes imports that no longer make sense.
**How to avoid:** Use `@/components/lootit/` alias paths consistently. Shared utilities go in `lootit-constants.js`. Each extracted file should be self-contained with its own import block.
**Warning signs:** Vite build errors about circular dependencies or missing modules.

### Pitfall 3: Status Color Inconsistency After Unification
**What goes wrong:** Decision D-09 changes the color system (e.g., `over` moves from `orange` to `amber`). If only some components are updated, the page shows mixed color vocabularies.
**Why it happens:** Status colors are currently defined in 4 separate places: `ServiceCard.jsx` STATUS_STYLES, `ReconciliationBadge.jsx` STATUS_CONFIG, `PAX8_STATUS_STYLES` in the monolith, and inline in the header JSX. ServiceCard is marked "keep as-is" (D-04) but its colors need alignment.
**How to avoid:** Create `lootit-constants.js` with the canonical color mapping. Import it in all components. D-04 says keep ServiceCard as-is structurally, but its color values should reference the shared constants for consistency.
**Warning signs:** Matched status showing emerald-500 in one card and a different green in another.

### Pitfall 4: Restyle Changes Breaking Layout at Different Viewport Widths
**What goes wrong:** The dashboard-pro restyle looks great at desktop width but breaks at smaller screens (tablets used by MSP operators).
**Why it happens:** Tighter padding (D-08: p-3/p-4) and grid-cols-6 widget layouts assume sufficient width. The existing code uses responsive classes (`grid-cols-3 sm:grid-cols-6`).
**How to avoid:** Preserve all existing responsive breakpoint classes during the restyle. Test at 768px and 1024px.
**Warning signs:** Widgets overlapping or truncating at tablet width.

### Pitfall 5: DetailDrawer Supabase Direct Query
**What goes wrong:** DetailDrawer directly imports and uses `supabase` for its history query (line 966). When extracting, this import dependency is easy to miss.
**Why it happens:** The component uses a raw Supabase query instead of going through the `client` abstraction, making it a hidden dependency.
**How to avoid:** During extraction, verify ALL imports for each component. DetailDrawer needs: `supabase` (from @/api/client), `useQuery` (from @tanstack/react-query), `SheetHeader`/`SheetTitle`/`SheetDescription` (from @/components/ui/sheet), and multiple Lucide icons.
**Warning signs:** Missing import errors on the `supabase` client.

## Code Examples

### Example 1: Main Orchestrator After Extraction
```jsx
// LootITCustomerDetail.jsx (~200-300 lines)
import React, { useState, useMemo, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { client, supabase } from '@/api/client';
import { useReconciliationData } from '@/hooks/useReconciliationData';
import { useReconciliationReviews } from '@/hooks/useReconciliationReviews';
import { useCustomerContacts, useCustomerDevices } from '@/hooks/useCustomerData';
import { useAuth } from '@/lib/AuthContext';
import { getDiscrepancySummary } from '@/lib/lootit-reconciliation';
import { Sheet, SheetContent } from '@/components/ui/sheet';

import CustomerDetailHeader from './CustomerDetailHeader';
import ReconciliationTab from './ReconciliationTab';
import ContractTab from './ContractTab';
import DetailDrawer from './DetailDrawer';
import LineItemPicker from './LineItemPicker';
import RuleEditorDialog from './RuleEditorDialog';

export default function LootITCustomerDetail({ customer, onBack }) {
  // All hooks and state remain here
  // Computed values (summary, healthPct, issueCount, etc.) remain here
  // Handler functions remain here
  
  return (
    <div className="space-y-5 relative">
      <CustomerDetailHeader
        customer={customer}
        onBack={onBack}
        onSync={handleSync}
        isSyncing={isSyncing}
        healthPct={healthPct}
        activeIntegrations={activeIntegrations}
        summary={summary}
        contacts={contacts}
        devices={devices}
        contracts={contracts}
        dollarImpact={dollarImpact}
        issueCount={issueCount}
      />
      
      {/* Tab bar */}
      {/* ... */}
      
      {activeTab === 'reconciliation' && (
        <ReconciliationTab
          filteredRecons={filteredRecons}
          filteredPax8={filteredPax8}
          statusFilter={statusFilter}
          onFilterChange={setStatusFilter}
          allRecons={allRecons}
          summary={summary}
          issueCount={issueCount}
          existingOverrides={existingOverrides}
          isSaving={isSaving}
          onReview={handleReview}
          onDismiss={handleDismiss}
          onReset={resetReview}
          onDetails={setDetailItem}
          onEditRule={setEditingRule}
          onSaveNotes={saveNotes}
          onMapLineItem={(ruleId, label) => setMappingRecon({ ruleId, productName: label })}
          onRemoveMapping={handleRemoveMapping}
        />
      )}
      
      {activeTab === 'contract' && (
        <ContractTab
          contracts={contracts}
          extractingId={extractingId}
          fileInputRef={fileInputRef}
          isDragging={isDragging}
          uploadPending={uploadMutation.isPending}
          onFileUpload={handleFileUpload}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onDownload={handleDownloadContract}
          onDelete={handleDeleteContract}
          onRetryExtract={extractContractData}
        />
      )}
      
      <Sheet open={!!detailItem} onOpenChange={(open) => { if (!open) setDetailItem(null); }}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto p-0">
          {detailItem && (
            <DetailDrawer
              reconciliation={detailItem}
              customerId={customer.id}
              onSaveExclusion={/* ... */}
            />
          )}
        </SheetContent>
      </Sheet>
      
      {editingRule && <RuleEditorDialog rule={editingRule} onSave={handleSaveRule} onClose={() => setEditingRule(null)} />}
      {mappingRecon && <LineItemPicker productName={mappingRecon.productName} lineItems={allLineItems} onSelect={/* ... */} onClose={() => setMappingRecon(null)} />}
    </div>
  );
}
```

### Example 2: Dashboard-Pro Header With Dark/Light Contrast
```jsx
// CustomerDetailHeader.jsx -- dashboard-pro styling
<div className="relative bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
  {/* Dark navy header band */}
  <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-5 py-4">
    <div className="flex items-center gap-3">
      <button onClick={onBack} className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors">
        <ArrowLeft className="w-4 h-4 text-white" />
      </button>
      <div className="flex-1 min-w-0">
        <h2 className="text-lg font-bold text-white truncate">{customer.name}</h2>
        <p className="text-xs text-slate-400 mt-0.5">
          {activeIntegrations} integrations -- {summary?.total || 0} rules tracked
        </p>
      </div>
      {/* Health badge */}
      <div className={cn(
        'px-3 py-1.5 rounded-lg text-sm font-bold',
        healthPct >= 80 ? 'bg-emerald-500/20 text-emerald-300' : healthPct >= 50 ? 'bg-amber-500/20 text-amber-300' : 'bg-red-500/20 text-red-300'
      )}>
        {healthPct}%
      </div>
      {/* Sync button */}
    </div>
  </div>
  
  {/* Light content area */}
  <div className="p-4 space-y-4">
    {/* Integration widgets grid */}
    {/* Reconciliation summary boxes */}
  </div>
</div>
```

### Example 3: Consistent Status Color Usage
```jsx
// Using shared constants
import { STATUS_COLORS } from './lootit-constants';

const colors = STATUS_COLORS[status] || STATUS_COLORS.neutral;

<div className={cn('rounded-xl border px-3 py-2.5', colors.bg, colors.border)}>
  <span className={cn('text-2xl font-bold tabular-nums', colors.text)}>{value}</span>
  <p className={cn('text-[10px] font-medium uppercase tracking-wide mt-0.5', colors.icon)}>{label}</p>
</div>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single monolith component | Feature-based split with prop threading | React best practice (stable) | Maintainability, testability |
| Custom tab buttons with useState | Radix Tabs (accessible, keyboard-navigable) | Available in project already | Accessibility compliance |
| Inline color maps per component | Shared constants file | Team pattern (recommended) | Color consistency across page |
| Custom modal overlays | Radix Dialog/Sheet | Available in project already | Focus trapping, scroll lock, ARIA |
| Tailwind v3 | Tailwind v4 released | 2025 | NOT relevant -- project uses v3, stay on v3 |

**Deprecated/outdated:**
- Tailwind CSS v4 is released but this project uses v3.4.17. Do NOT attempt to upgrade in this phase. The v3 API is fully stable and correct for this project.

## Open Questions

1. **ServiceCard.jsx color alignment with D-09**
   - What we know: D-04 says keep ServiceCard as-is. D-09 says unify colors. ServiceCard uses `orange-500` for "over" status; D-09 specifies `amber-500`.
   - What's unclear: Whether D-04 ("keep as-is") takes precedence over D-09 ("unify colors") for ServiceCard's color values.
   - Recommendation: Update ServiceCard's color MAP values to match D-09 without changing the component's structure. This honors both decisions: structure stays, colors unify.

2. **Tab bar migration to Radix Tabs**
   - What we know: Current tabs use `useState('reconciliation')` with custom buttons. Radix `<Tabs>` component is installed and available at `src/components/ui/tabs.jsx`.
   - What's unclear: Whether migrating to Radix Tabs counts as a "behavioral change" (D-12 says no behavioral changes).
   - Recommendation: Migrate to Radix Tabs during the restyle pass. It is a visual/accessibility upgrade, not a behavioral change. The tab switching behavior remains identical.

3. **LineItemPicker and RuleEditorDialog as custom modals**
   - What we know: Both use custom `fixed inset-0 z-50` overlays without focus trapping or body scroll lock. Radix Dialog is installed.
   - What's unclear: Whether migrating these to Radix Dialog is in scope for Phase 1.
   - Recommendation: Flag for the planner but keep as LOW priority in Phase 1. The migration is safe but not required by any UXRD requirement.

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis of `LootITCustomerDetail.jsx` (1679 lines, read in full)
- Direct codebase analysis of `ServiceCard.jsx`, `ReconciliationBadge.jsx`, `LootITDashboard.jsx`, `LootIT.jsx`
- `package.json` for exact dependency versions
- `tailwind.config.js` for design token configuration
- `src/index.css` for CSS custom properties (design tokens)
- `src/components/ui/tabs.jsx` and `src/components/ui/card.jsx` for available Radix wrappers

### Secondary (MEDIUM confidence)
- npm registry version checks (lucide-react 1.7.0, @tanstack/react-query 5.96.0, tailwindcss 4.2.2, @radix-ui/react-tabs 1.1.13) -- verified 2026-03-31

### Tertiary (LOW confidence)
- None. All findings are based on direct codebase inspection.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all dependencies verified in package.json, no new installs needed
- Architecture: HIGH -- component boundaries are clear, internal functions already exist as extraction targets
- Pitfalls: HIGH -- identified from direct code analysis of prop threading patterns and color duplication

**Research date:** 2026-03-31
**Valid until:** Indefinite (project-specific, no external API dependencies for this phase)
