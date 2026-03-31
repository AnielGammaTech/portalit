---
phase: 02-customer-header-compact-service-cards
verified: 2026-03-31T15:30:00Z
status: gaps_found
score: 9/10 must-haves verified
re_verification: false
gaps:
  - truth: "Header shows MRR computed from recurring bill line items"
    status: failed
    reason: "financialSummary useMemo is called after a conditional early return on line 271, violating React Rules of Hooks. When isLoading is true the hook is skipped, causing inconsistent hook call order and a potential runtime crash."
    artifacts:
      - path: "src/components/lootit/LootITCustomerDetail.jsx"
        issue: "useMemo at line 282 appears after the conditional return (if isLoading) at line 271-277. React hooks must not be called after conditional returns."
    missing:
      - "Move the financialSummary useMemo block to before the isLoading early return (around line 262, after the activeIntegrations useMemo), then compute issueCount and healthPct inside the useMemo or pass healthPct as a derived variable after the guard. Alternatively, keep issueCount/healthPct as regular const derivations before the guard (they are safe — they are not hooks) and move only the useMemo above line 271."
human_verification:
  - test: "Visual inspection of compact cards and header"
    expected: "3-4 service cards visible per row on desktop; action buttons show tooltip labels on hover; notes section does not show persistent banner; header shows contact info and financial summary"
    why_human: "Visual layout, responsive breakpoints, and tooltip interactivity cannot be verified programmatically"
---

# Phase 2: Customer Header & Compact Service Cards Verification Report

**Phase Goal:** MSP operators see full customer context at a glance in the header and can scan 3-4 service cards per row in the Reconciliation tab
**Verified:** 2026-03-31T15:30:00Z
**Status:** gaps_found — 1 blocker (React Rules of Hooks violation in financialSummary useMemo placement)
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Header displays primary contact name and email from HaloPSA contacts data | VERIFIED | `CustomerDetailHeader.jsx` line 7: `const primaryContact = contacts.length > 0 ? contacts[0] : null`; line 59 renders `primaryContact.full_name` and `primaryContact.email` |
| 2 | Header displays customer address when available, or a dash when missing | VERIFIED | Lines 63-69: conditional `{customer.address && (...)}` renders `MapPin` + address; line 61 renders em-dash `\u2014` when no contact |
| 3 | Header shows MRR computed from recurring bill line items | FAILED | `financialSummary` useMemo (line 282) is placed **after** the `if (isLoading) return` guard at line 271 — React Rules of Hooks violation |
| 4 | Header shows contract value computed from completed contract extractions | FAILED | Same issue: contractValue is computed inside the same misplaced useMemo |
| 5 | Header shows billing status badge (Healthy/Needs Review/At Risk) derived from health percentage | FAILED | Same issue: billingStatus derived inside same misplaced useMemo |
| 6 | Integration stat widgets show real data from existing props (not placeholders) | VERIFIED | Lines 77-92: Users, Workstations, Servers, Services, Contracts, Monthly widgets all use live props from contacts/devices/summary/dollarImpact |
| 7 | Health score badge is present and connected to real reconciliation data | VERIFIED | Lines 39-44: health badge uses `healthPct` which is derived at line 280 from `summary.matched / summary.total` |
| 8 | Service cards fit 3-4 per row on standard desktop screens | VERIFIED | `ReconciliationTab.jsx` lines 52 and 78: both grids use `grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3` |
| 9 | Cards retain PSA vs Vendor counts, status badge, integration label, and all action buttons | VERIFIED | `ServiceCard.jsx` and `Pax8SubscriptionCard.jsx` both retain all data; numbers use `text-xl` (reduced from `text-3xl`/`text-2xl`); no `text-3xl` found |
| 10 | Action buttons are icon-only with tooltip labels on hover | VERIFIED | Both cards: `TooltipProvider` wraps action bar; OK/Skip/Undo/Note/Map all wrapped in `Tooltip`/`TooltipTrigger`/`TooltipContent`; buttons use `p-1.5` only |

**Score:** 7/10 truths verified (truths 3, 4, 5 fail from same root cause)

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/components/lootit/CustomerDetailHeader.jsx` | Header with contact row, financial summary row, and integration widgets | VERIFIED (171 lines) | Contains `financialSummary` prop destructure, `primaryContact` derivation, `BILLING_STATUS_CONFIG` usage, contact + address row in dark band, financial summary row in light area |
| `src/components/lootit/LootITCustomerDetail.jsx` | Orchestrator computing financialSummary and passing to header | STUB/BROKEN | `financialSummary` useMemo exists and passes prop correctly (line 309: `financialSummary={financialSummary}`), but useMemo placement after early return violates React Rules of Hooks |
| `src/components/lootit/lootit-constants.js` | BILLING_STATUS_CONFIG constant for billing status badge styling | VERIFIED (31 lines) | Lines 27-31: `BILLING_STATUS_CONFIG` exported with `healthy`, `needs_review`, `at_risk` keys and correct className values |
| `src/components/lootit/ServiceCard.jsx` | Compact service card with icon-only actions and reduced sizes | VERIFIED (286 lines) | `TooltipProvider` present; `text-xl font-black` (not `text-3xl`); `w-px bg-slate-200 self-stretch my-1` divider; all actions icon-only with tooltips |
| `src/components/lootit/Pax8SubscriptionCard.jsx` | Compact Pax8 card with identical size reductions | VERIFIED (267 lines) | Identical treatment: `TooltipProvider`, `text-xl font-bold`, same divider, same collapsed notes pattern |
| `src/components/lootit/ReconciliationTab.jsx` | 3-4 column responsive grid for both card sections | VERIFIED (99 lines) | Lines 52 and 78: both grids use `sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3`; no `md:grid-cols-2` remains |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `LootITCustomerDetail.jsx` | `CustomerDetailHeader.jsx` | `financialSummary` prop | WIRED (with defect) | Line 309 passes `financialSummary={financialSummary}` correctly; however the source useMemo is after an early return — the prop may be undefined at runtime when `isLoading` was true on prior render |
| `CustomerDetailHeader.jsx` | `lootit-constants.js` | `BILLING_STATUS_CONFIG` import | VERIFIED | Line 3: `import { STATUS_COLORS, BILLING_STATUS_CONFIG } from './lootit-constants'`; used at lines 117 and 119 |
| `ServiceCard.jsx` | `@/components/ui/tooltip` | Tooltip imports | VERIFIED | Line 4: `import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip'` |
| `Pax8SubscriptionCard.jsx` | `@/components/ui/tooltip` | Tooltip imports | VERIFIED | Line 7: same import pattern |
| `ReconciliationTab.jsx` | `ServiceCard.jsx` | renders ServiceCard in 3-4 grid | VERIFIED | Line 52: correct `md:grid-cols-3 lg:grid-cols-4` grid; ServiceCard rendered at line 54 |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `CustomerDetailHeader.jsx` | `financialSummary.mrr` | `allLineItems` (useQuery line 52 of orchestrator) — queries `RecurringBillLineItem` filtered by `customer_id` | Real DB query via `client.entities.RecurringBillLineItem.filterIn` | FLOWING (when hook order is fixed) |
| `CustomerDetailHeader.jsx` | `financialSummary.contractValue` | `contracts` (useQuery line 94 of orchestrator) — queries `LootITContract` filtered by `customer_id` | Real DB query via `client.entities.LootITContract.filter` | FLOWING (when hook order is fixed) |
| `CustomerDetailHeader.jsx` | `financialSummary.billingStatus` | Derived from `healthPct` which comes from `summary.matched / summary.total` | Real reconciliation count | FLOWING (when hook order is fixed) |
| `CustomerDetailHeader.jsx` | Integration widget counts (contacts, devices) | `useCustomerContacts`, `useCustomerDevices` hooks | Real DB queries | FLOWING |
| `ServiceCard.jsx` | `psaQty`, `vendorQty`, `status` | `reconciliation` prop from `LootITCustomerDetail` via `useReconciliationData` | Real reconciliation hook | FLOWING |

---

## Behavioral Spot-Checks

Step 7b: SKIPPED — Phase 2 is a pure UI/component change with no runnable API endpoints or CLI entry points to test without a running server.

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| HEAD-01 | 02-01-PLAN.md | Header displays real customer details (company name, contact, address) | SATISFIED | `CustomerDetailHeader.jsx` shows customer name (line 32), primary contact name+email (lines 58-60), address (lines 63-69) |
| HEAD-02 | 02-01-PLAN.md | Header shows financial summary (MRR, contract value, billing status) | BLOCKED | financialSummary renders correctly in header JSX but useMemo violates Rules of Hooks — may not execute reliably |
| HEAD-03 | 02-01-PLAN.md | Header shows reconciliation health score with visual indicator | SATISFIED | `healthPct` badge (lines 39-44) and progress bar (lines 12-20) both present and wired to real data |
| HEAD-04 | 02-01-PLAN.md | Header redesigned in dashboard-pro style | SATISFIED | Dark gradient band, integration widgets, reconciliation summary boxes — all present, Phase 1 styling preserved |
| HEAD-05 | 02-01-PLAN.md | Integration stat widgets compact and informative | SATISFIED | 6-column grid (lines 76-93) with real counts from props |
| CARD-01 | 02-02-PLAN.md | Service cards shrunk ~50% so 3-4 cards fit per row | SATISFIED | Both ReconciliationTab grids use `sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4`; card numbers reduced to `text-xl` |
| CARD-02 | 02-02-PLAN.md | Card layout retains PSA vs Vendor counts, status badge, action buttons at smaller size | SATISFIED | All data fields, ReconciliationBadge, and action buttons preserved in both card files |
| CARD-03 | 02-02-PLAN.md | Cards remain interactive (review, dismiss, map, notes) at compact size | SATISFIED | All handlers (onReview, onDismiss, onReset, onMapLineItem, onSaveNotes) wired; tooltips on all action buttons |

**Orphaned requirements check:** REQUIREMENTS.md traceability table maps HEAD-01 through HEAD-05 and CARD-01 through CARD-03 to Phase 2. All 8 IDs appear in plan frontmatter. No orphans.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/components/lootit/LootITCustomerDetail.jsx` | 282 | `useMemo` called after conditional `return` at line 271 | BLOCKER | Violates React Rules of Hooks. During the loading state, the hook is skipped. On the next render when `isLoading` is false, React sees more hooks than on the first render, causing an invariant violation. The `financialSummary` prop passed to the header will be `undefined` when this crashes, breaking the MRR/contract value/billing status display entirely. |

---

## Human Verification Required

### 1. Visual compact card layout

**Test:** Navigate to LootIT customer detail for a customer with reconciliation data. Count how many service cards appear side-by-side at 1280px browser width.
**Expected:** 3-4 service cards visible per row without horizontal scroll.
**Why human:** CSS grid column counts are not verifiable programmatically; browser rendering required.

### 2. Tooltip accessibility on action buttons

**Test:** Hover over the OK, Skip, and Map icon buttons on a service card.
**Expected:** Tooltip label appears ("OK", "Skip", "Map") after ~300ms delay.
**Why human:** Radix tooltip rendering and delay behavior requires an actual browser with pointer events.

### 3. Notes icon indicator (not banner)

**Test:** On a card known to have existing notes, observe the default card state (before clicking anything).
**Expected:** No note banner is shown. The StickyNote icon in the action bar appears amber to indicate notes exist. The full note textarea only appears after clicking the StickyNote icon.
**Why human:** State-gated conditional rendering requires interaction testing.

### 4. Responsive breakpoints

**Test:** Resize the browser from full-width to tablet (~768px) to narrow mobile (~375px).
**Expected:** Cards progress from 4 columns to 3, then 2, then 1.
**Why human:** Responsive CSS behavior requires live browser testing at multiple viewport widths.

---

## Gaps Summary

One blocker prevents full goal achievement for HEAD-02 (financial summary): the `financialSummary` `useMemo` in `LootITCustomerDetail.jsx` is placed at line 282, **after** the conditional early return at lines 271-277. This violates React's Rules of Hooks — hooks must be called unconditionally and in the same order on every render.

The fix is straightforward: move the `financialSummary` useMemo above the `if (isLoading) return` guard. The `issueCount` and `healthPct` constants (lines 279-280) are plain `const` derivations, not hooks, and are safe where they are. The `financialSummary` useMemo is the only hook called after the guard. Moving it requires referencing `healthPct` before the guard, so `healthPct` must also move above the guard, or be computed inline inside the useMemo using the same formula.

All other must-haves are verified. The compact card work (CARD-01, CARD-02, CARD-03) is complete and correct. The header contact display (HEAD-01, HEAD-03, HEAD-04, HEAD-05) is complete and correct. Only the financial summary row (HEAD-02) is blocked by this hook ordering defect.

---

_Verified: 2026-03-31T15:30:00Z_
_Verifier: Claude (gsd-verifier)_
