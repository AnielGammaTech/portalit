# LootIT Customer Detail Redesign

## Overview

Redesign the LootIT customer detail view to separate **viewing reconciliation status** (Dashboard tab) from **actively performing reconciliation** (Reconciliation tab), with comprehensive audit logging on every tile.

## Goals

1. Provide a read-only Dashboard showing the frozen state from the last completed reconciliation
2. Keep the Reconciliation tab familiar (same card grid + modal pattern) but add inline staleness flags and change detection
3. Log every action with who, when, and what — visible both on cards (preview) and in the detail modal (full timeline)
4. Enable ad-hoc reconciliation at any time with a clear sign-off workflow

## Non-Goals

- Wizard or checklist-style verification flows (rejected during brainstorming)
- Changing the card grid layout or modal interaction pattern
- Redesigning the global LootIT dashboard (customer list page)
- Mobile-specific bottom sheet patterns (separate task)

---

## Architecture

### Tab Structure

Add a **Dashboard** tab as the new default landing tab. Existing tabs shift right.

```
[ Dashboard* ] [ Reconciliation ] [ Recurring ] [ Invoices ] [ Contract ]
```

- Dashboard is the default tab when navigating to a customer
- URL param: `?tab=dashboard` (default), `?tab=reconciliation`, etc.

### Data Model Changes

#### New Table: `reconciliation_snapshots`

Stores the frozen state of every card at the moment of sign-off.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `customer_id` | uuid | FK to customers |
| `sign_off_id` | uuid | FK to reconciliation_sign_offs |
| `rule_id` | text | Rule ID or Pax8 rule ID (e.g., `pax8:productName`) |
| `label` | text | Display label at time of snapshot |
| `integration_key` | text | Integration identifier |
| `status` | text | Status at sign-off: match, over, under, force_matched, dismissed, etc. |
| `psa_qty` | integer | PSA quantity at sign-off |
| `vendor_qty` | integer | Vendor quantity at sign-off |
| `difference` | integer | Calculated diff at sign-off |
| `exclusion_count` | integer | Number of excluded accounts |
| `exclusion_reason` | text | Reason for exclusions |
| `review_status` | text | Review status: reviewed, dismissed, force_matched, pending |
| `review_notes` | text | Notes from the review |
| `reviewed_by` | uuid | FK to users — who reviewed this specific tile |
| `reviewed_at` | timestamptz | When this tile was reviewed |
| `override_data` | jsonb | Serialized override/mapping data for this tile |
| `created_at` | timestamptz | Snapshot creation time |

#### Updated Table: `reconciliation_sign_offs`

Add columns to support the sign-off workflow:

| Column | Type | Description |
|--------|------|-------------|
| `total_rules` | integer | Total rules/tiles at sign-off |
| `matched_count` | integer | Number of matched tiles |
| `issues_count` | integer | Number of over/under/mismatch tiles |
| `force_matched_count` | integer | Number of force-matched tiles |
| `dismissed_count` | integer | Number of dismissed tiles |
| `excluded_count` | integer | Number of tiles with exclusions |
| `notes` | text | Optional sign-off notes |

#### Updated Table: `reconciliation_review_history`

Add an `action` value for re-verification: `re_verified`. No schema change needed — the existing `action` text column supports this.

Add tracking for sign-off events: `signed_off` action type, with `sign_off_id` stored in the `notes` field as a reference.

---

## Dashboard Tab

### Purpose

Read-only view of the last completed reconciliation. Shows exactly what was certified at sign-off time so you can see the state without risking changes.

### Behavior

1. On load, fetch the most recent `reconciliation_sign_offs` record for this customer
2. Fetch all `reconciliation_snapshots` where `sign_off_id` matches
3. Render the card grid using snapshot data (not live data)
4. Cards are clickable (opens read-only detail modal with audit log) but have no action buttons
5. If no sign-off exists yet, show an empty state: "No reconciliation completed yet" with a CTA to go to the Reconciliation tab

### Sign-Off Banner

At the top of the Dashboard tab, a banner shows:
- Green dot + "Signed off {date}" + "by {user name}"
- "Start New Reconciliation →" button that navigates to the Reconciliation tab

### Card Display

Each card shows the frozen data from the snapshot:
- Label, integration, status badge
- PSA qty, Vendor qty, Difference
- Bottom line: "{Action} by {user} · {date}" (e.g., "Reviewed by Daniel R. · Mar 15")

Cards use the same visual design as Reconciliation tab cards but with no hover effects and muted borders to signal read-only state.

### Card Click Behavior

Clicking a Dashboard card opens the detail modal in **read-only mode**:
- Shows the snapshot quantities and status
- Shows the full audit log timeline (fetched from `reconciliation_review_history`)
- No action buttons (Approve, Force Match, Dismiss, etc.)
- Modal header shows "Snapshot from {sign-off date}" label

---

## Reconciliation Tab

### Purpose

Active reconciliation workspace. Shows live data with inline flags for items that need attention.

### Behavior

Same card grid as today with these additions:

#### Staleness Flags

Cards with overrides, force matches, exclusions, or dismissals that haven't been re-verified since the last sign-off get a staleness indicator:

- **Yellow badge**: "Stale · {N} days" — positioned at top-right of card
- **Yellow border**: Card border changes from default to `#eab30860`
- **Yellow footer**: Bottom line shows "⚠ Last verified by {user} · {date}" in yellow

Staleness threshold: any item not re-verified since the last sign-off date. If no sign-off exists, all items with manual actions are considered stale.

#### Change Detection

Items where live data differs from the last snapshot get a red indicator:

- **Red badge**: "New Issue" — positioned at top-right of card
- **Red footer**: "⚠ Changed since last sign-off (was {old_psa}/{old_vendor})"

This compares current reconciliation output against `reconciliation_snapshots` for the most recent sign-off.

#### New Filter: "Stale"

Add a "Stale" filter button to the existing filter bar (All, Issues, Stale, Matched, Reviewed). Shows only cards with staleness flags or change detection alerts.

#### Re-Verify Action

In the detail modal, add a "Re-verify" button for stale items. Clicking it:
1. Logs a `re_verified` action to `reconciliation_review_history` with current quantities
2. Updates `reconciliation_reviews.reviewed_at` to now
3. Clears the staleness flag on the card
4. Does NOT change the review status (reviewed/force_matched/dismissed stays the same)

#### Sign Off Button

"Sign Off Reconciliation" button in the filter bar (right side). When clicked:

1. Validates that no items have unresolved issues (over/under without a review action) — if any exist, show a confirmation dialog listing them
2. Creates a new `reconciliation_sign_offs` record with summary counts
3. Creates `reconciliation_snapshots` for every tile — capturing current state
4. Logs a `signed_off` action to `reconciliation_review_history` for each tile
5. Navigates to the Dashboard tab to show the new snapshot
6. Toast notification: "Reconciliation signed off successfully"

---

## Detail Modal — Audit Log

### Card Preview (on the card itself)

Bottom line of every card shows:
```
{Last action} by {user} · {relative date}
```

Examples:
- "Reviewed by Daniel R. · Mar 15"
- "Force Matched by Maria S. · Jan 12"
- "Dismissed by Daniel R. · Mar 15"
- "Re-verified by Daniel R. · 2 min ago"

### Full Timeline (in modal)

The existing history timeline in `ReconciliationDetailModal` is promoted to a more prominent "Audit Log" section. No structural change — the current implementation already queries `reconciliation_review_history` and renders a timeline.

Enhancements:
- Section header: "Audit Log" (currently unnamed or less prominent)
- Each entry shows: action icon, action name, timestamp, user name, notes (if any), PSA/vendor quantities captured at that moment
- New action types rendered: `re_verified` (green check with refresh icon), `signed_off` (purple seal icon)
- Entries are always newest-first

### Action Types and Icons

| Action | Icon | Color | Description |
|--------|------|-------|-------------|
| `reviewed` | ✓ | Green | Standard review confirmation |
| `force_matched` | ⚡ | Blue | Override with notes |
| `dismissed` | ✕ | Gray | Skipped/dismissed |
| `re_verified` | ↻ | Green | Re-confirmed during new reconciliation |
| `signed_off` | ◉ | Purple | Part of a sign-off event |
| `note` | 💬 | White | Note added without status change |
| `exclusion` | ⊘ | Purple | Exclusion count/reason changed |
| `reset` | ↺ | Orange | Review reset to pending |
| `rule_created` | + | Pink | Rule initially created |

---

## Component Changes

### New Components

| Component | File | Purpose |
|-----------|------|---------|
| `DashboardTab` | `components/lootit/DashboardTab.jsx` | Dashboard tab container — fetches snapshot, renders read-only card grid |
| `SnapshotCard` | `components/lootit/SnapshotCard.jsx` | Read-only card for Dashboard tab — same visual as ServiceCard but no interactions |
| `SignOffBanner` | `components/lootit/SignOffBanner.jsx` | Banner showing last sign-off info + CTA |
| `SignOffDialog` | `components/lootit/SignOffDialog.jsx` | Confirmation dialog for sign-off with issue warnings |
| `StaleBadge` | `components/lootit/StaleBadge.jsx` | Yellow/red badge component for staleness and change detection |

### Modified Components

| Component | Changes |
|-----------|---------|
| `LootITCustomerDetail.jsx` | Add Dashboard tab to tab array, make it the default, add sign-off logic |
| `CustomerDetailReconciliationTab.jsx` | Add "Stale" filter, pass staleness/change data to cards, add Sign Off button |
| `ServiceCard.jsx` | Accept `stalenessDays`, `changeDetected`, `lastReviewedBy`, `lastReviewedAt` props; render StaleBadge and audit preview footer |
| `Pax8SubscriptionCard.jsx` | Same staleness/audit props as ServiceCard |
| `ReconciliationDetailModal.jsx` | Add "Re-verify" button, promote audit log section header, add `readOnly` prop for Dashboard usage, render new action types |

### New Hooks

| Hook | File | Purpose |
|------|------|---------|
| `useReconciliationSnapshot` | `hooks/useReconciliationSnapshot.js` | Fetches latest sign-off + snapshot data for a customer |
| `useSignOff` | `hooks/useSignOff.js` | Sign-off mutation — creates sign-off record + snapshots + history entries |
| `useStalenessData` | `hooks/useStalenessData.js` | Computes staleness flags by comparing current reviews against last sign-off date; compares live reconciliation against snapshot for change detection |

---

## Data Flow

### Dashboard Tab Load

```
CustomerDetailPage (tab=dashboard)
  → useReconciliationSnapshot(customerId)
    → fetch latest reconciliation_sign_offs WHERE customer_id
    → fetch reconciliation_snapshots WHERE sign_off_id
  → DashboardTab renders SignOffBanner + SnapshotCard[]
  → Click card → ReconciliationDetailModal (readOnly=true)
    → useReconciliationReviewHistory for audit log
```

### Reconciliation Tab Load

```
CustomerDetailPage (tab=reconciliation)
  → useReconciliationData(customerId)          // existing — live data
  → useReconciliationReviews(customerId)       // existing — current reviews
  → useReconciliationSnapshot(customerId)      // new — for change detection
  → useStalenessData(reviews, snapshot)        // new — compute flags
  → CustomerDetailReconciliationTab renders cards with staleness props
  → Click card → ReconciliationDetailModal (readOnly=false)
    → Re-verify, Force Match, Dismiss, etc.
```

### Sign-Off Flow

```
User clicks "Sign Off Reconciliation"
  → SignOffDialog opens
    → Shows summary: X matched, Y issues, Z force-matched
    → If unresolved issues exist, lists them with warning
  → User confirms
  → useSignOff.mutate()
    → INSERT reconciliation_sign_offs (summary counts)
    → INSERT reconciliation_snapshots[] (one per tile)
    → INSERT reconciliation_review_history[] (signed_off action per tile)
  → Navigate to ?tab=dashboard
  → Toast: "Reconciliation signed off successfully"
```

---

## Migration

Single Supabase migration file:

1. Create `reconciliation_snapshots` table with indexes on `(customer_id)` and `(sign_off_id)`
2. Add summary columns to `reconciliation_sign_offs` (all nullable for backwards compatibility)
3. Add RLS policies matching existing patterns (authenticated users, company-scoped)

No data backfill needed — the Dashboard tab shows an empty state ("No reconciliation completed yet") until the first sign-off happens through the new workflow.

---

## Testing Plan

### Unit Tests
- `useStalenessData` — correctly identifies stale items (days since last sign-off vs review date)
- `useStalenessData` — correctly detects quantity changes vs snapshot
- Sign-off mutation — creates correct number of snapshots matching current tile count
- Snapshot card renders read-only without action buttons

### Integration Tests
- Full sign-off flow: click sign off → snapshots created → navigate to dashboard → snapshot data displayed
- Re-verify flow: click re-verify → history logged → staleness cleared → card updates
- Change detection: modify vendor data after sign-off → red "New Issue" badge appears
- Dashboard empty state when no sign-offs exist

### Manual Verification
- Navigate to customer → lands on Dashboard tab
- Dashboard cards match what was signed off (not live data)
- Reconciliation tab shows staleness flags on appropriate cards
- "Stale" filter works correctly
- Sign-off creates snapshots and redirects to Dashboard
- Audit log in modal shows all action types with correct icons/colors
- Card footer shows last reviewer preview
