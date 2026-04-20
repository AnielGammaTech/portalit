# LootIT Customer Detail Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Dashboard tab (read-only snapshot of last sign-off), staleness/change-detection flags to the Reconciliation tab, and audit logging on every card.

**Architecture:** New `reconciliation_snapshots` table stores per-tile frozen state at sign-off. Three new hooks (`useReconciliationSnapshot`, `useStalenessData`, `useSignOff`) compute and manage this data. Dashboard tab renders `SnapshotCard` components (read-only). Existing cards get staleness badges and audit footers. The existing `ReconciliationDetailModal` gains a `readOnly` prop and re-verify action.

**Tech Stack:** React 18, Vite, Supabase (PostgreSQL + PostgREST), TanStack React Query v5, Radix UI Dialog, Tailwind CSS, Lucide icons, Sonner toasts.

**Branch:** `feat/lootit-split`

**Base paths:**
- Frontend: `apps/lootit/src/`
- Migrations: `supabase/migrations/`
- Components: `apps/lootit/src/components/lootit/`
- Hooks: `apps/lootit/src/hooks/`

---

## File Map

### New Files

| File | Responsibility |
|------|---------------|
| `supabase/migrations/20260417_add_reconciliation_snapshots.sql` | Create snapshots table, add summary cols to sign_offs |
| `apps/lootit/src/hooks/useReconciliationSnapshot.js` | Fetch latest sign-off + snapshot data for a customer |
| `apps/lootit/src/hooks/useStalenessData.js` | Compute staleness flags and change detection |
| `apps/lootit/src/hooks/useSignOff.js` | Sign-off mutation: create sign-off + snapshots + history |
| `apps/lootit/src/components/lootit/StaleBadge.jsx` | Yellow (stale) / red (new issue) badge overlay |
| `apps/lootit/src/components/lootit/AuditFooter.jsx` | Card footer showing last reviewer + date |
| `apps/lootit/src/components/lootit/SnapshotCard.jsx` | Read-only card for Dashboard tab |
| `apps/lootit/src/components/lootit/SignOffBanner.jsx` | Banner showing sign-off info + CTA |
| `apps/lootit/src/components/lootit/DashboardTab.jsx` | Dashboard tab container |
| `apps/lootit/src/components/lootit/SignOffDialog.jsx` | Confirmation dialog before sign-off |

### Modified Files

| File | Changes |
|------|---------|
| `apps/lootit/src/api/client.js` | Add `ReconciliationSnapshot` entity mapping |
| `apps/lootit/src/components/lootit/lootit-constants.js` | Add `re_verified`, `signed_off` action labels |
| `apps/lootit/src/components/lootit/ServiceCard.jsx` | Accept staleness + audit props, render StaleBadge + AuditFooter |
| `apps/lootit/src/components/lootit/Pax8SubscriptionCard.jsx` | Same staleness + audit props as ServiceCard |
| `apps/lootit/src/components/lootit/CustomerDetailReconciliationTab.jsx` | Add "Stale" filter, Sign Off button, pass staleness data |
| `apps/lootit/src/components/lootit/ReconciliationDetailModal.jsx` | Add `readOnly` prop, re-verify button, new action type icons |
| `apps/lootit/src/hooks/useReconciliationReviews.js` | Add `reVerify` action, join users table for `reviewed_by_name` |
| `apps/lootit/src/components/lootit/LootITCustomerDetail.jsx` | Add Dashboard tab (default), wire snapshot/staleness hooks |

---

## Task 1: Database Migration + Entity Registration

**Files:**
- Create: `supabase/migrations/20260417_add_reconciliation_snapshots.sql`
- Modify: `apps/lootit/src/api/client.js:141-195`

- [ ] **Step 1: Create migration file**

```sql
-- supabase/migrations/20260417_add_reconciliation_snapshots.sql

-- 1. Reconciliation snapshots — one row per tile per sign-off
CREATE TABLE IF NOT EXISTS reconciliation_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL,
  sign_off_id UUID NOT NULL REFERENCES reconciliation_sign_offs(id) ON DELETE CASCADE,
  rule_id TEXT NOT NULL,
  label TEXT NOT NULL,
  integration_key TEXT,
  status TEXT NOT NULL,
  psa_qty INTEGER,
  vendor_qty INTEGER,
  difference INTEGER DEFAULT 0,
  exclusion_count INTEGER DEFAULT 0,
  exclusion_reason TEXT,
  review_status TEXT,
  review_notes TEXT,
  reviewed_by UUID,
  reviewed_by_name TEXT,
  reviewed_at TIMESTAMPTZ,
  override_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recon_snapshots_customer
  ON reconciliation_snapshots(customer_id);
CREATE INDEX IF NOT EXISTS idx_recon_snapshots_sign_off
  ON reconciliation_snapshots(sign_off_id);

-- 2. Add summary columns to reconciliation_sign_offs
ALTER TABLE reconciliation_sign_offs
  ADD COLUMN IF NOT EXISTS total_rules INTEGER,
  ADD COLUMN IF NOT EXISTS matched_count INTEGER,
  ADD COLUMN IF NOT EXISTS issues_count INTEGER,
  ADD COLUMN IF NOT EXISTS force_matched_count INTEGER,
  ADD COLUMN IF NOT EXISTS dismissed_count INTEGER,
  ADD COLUMN IF NOT EXISTS excluded_count INTEGER;

-- 3. RLS for snapshots
ALTER TABLE reconciliation_snapshots ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "admin_all_snapshots" ON reconciliation_snapshots
    FOR ALL USING (
      auth.jwt() ->> 'role' = 'service_role'
      OR auth.uid() IS NOT NULL
    )
    WITH CHECK (
      auth.jwt() ->> 'role' = 'service_role'
      OR auth.uid() IS NOT NULL
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
```

- [ ] **Step 2: Add entity mapping in client.js**

In `apps/lootit/src/api/client.js`, find the entity-table mapping block (around line 167 where `ReconciliationSignOff` is defined) and add:

```javascript
ReconciliationSnapshot: 'reconciliation_snapshots',
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260417_add_reconciliation_snapshots.sql apps/lootit/src/api/client.js
git commit -m "feat: add reconciliation_snapshots table and entity mapping"
```

---

## Task 2: Update Constants with New Action Types

**Files:**
- Modify: `apps/lootit/src/components/lootit/lootit-constants.js`

- [ ] **Step 1: Add new action labels**

Add `re_verified` and `signed_off` entries to the `ACTION_LABELS` export in `lootit-constants.js`:

```javascript
export const ACTION_LABELS = {
  reviewed:      { label: 'Marked OK',     color: 'text-emerald-600', bg: 'bg-emerald-50' },
  dismissed:     { label: 'Skipped',       color: 'text-slate-500',   bg: 'bg-slate-50' },
  reset:         { label: 'Reset',         color: 'text-amber-600',   bg: 'bg-amber-50' },
  note:          { label: 'Note added',    color: 'text-blue-600',    bg: 'bg-blue-50' },
  exclusion:     { label: 'Exclusion set', color: 'text-amber-600',   bg: 'bg-amber-50' },
  force_matched: { label: 'Force Matched', color: 'text-blue-600',    bg: 'bg-blue-50' },
  re_verified:   { label: 'Re-verified',   color: 'text-emerald-600', bg: 'bg-emerald-50' },
  signed_off:    { label: 'Signed Off',    color: 'text-purple-600',  bg: 'bg-purple-50' },
};
```

- [ ] **Step 2: Commit**

```bash
git add apps/lootit/src/components/lootit/lootit-constants.js
git commit -m "feat: add re_verified and signed_off action labels"
```

---

## Task 3: useReconciliationSnapshot Hook

**Files:**
- Create: `apps/lootit/src/hooks/useReconciliationSnapshot.js`

- [ ] **Step 1: Create the hook**

```javascript
import { useQuery } from '@tanstack/react-query';
import { client, supabase } from '@/api/client';

export function useReconciliationSnapshot(customerId) {
  const signOffKey = ['reconciliation_sign_off_latest', customerId];
  const snapshotsKey = ['reconciliation_snapshots', customerId];

  const { data: latestSignOff, isLoading: signOffLoading } = useQuery({
    queryKey: signOffKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reconciliation_sign_offs')
        .select('*, signed_by_user:users!reconciliation_sign_offs_signed_by_fkey(full_name, email)')
        .eq('customer_id', customerId)
        .order('signed_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!customerId,
    staleTime: 1000 * 60 * 2,
  });

  const signOffId = latestSignOff?.id;

  const { data: snapshots = [], isLoading: snapshotsLoading } = useQuery({
    queryKey: [...snapshotsKey, signOffId],
    queryFn: () =>
      client.entities.ReconciliationSnapshot.filter({ sign_off_id: signOffId }),
    enabled: !!signOffId,
    staleTime: 1000 * 60 * 2,
  });

  const snapshotsByRuleId = snapshots.reduce((acc, snap) => {
    acc[snap.rule_id] = snap;
    return acc;
  }, {});

  return {
    latestSignOff,
    snapshots,
    snapshotsByRuleId,
    isLoading: signOffLoading || snapshotsLoading,
    signOffKey,
    snapshotsKey,
  };
}
```

- [ ] **Step 2: Verify build**

Run: `cd apps/lootit && npx vite build --mode development 2>&1 | tail -5`
Expected: Build succeeds (hook is not yet imported anywhere).

- [ ] **Step 3: Commit**

```bash
git add apps/lootit/src/hooks/useReconciliationSnapshot.js
git commit -m "feat: add useReconciliationSnapshot hook"
```

---

## Task 4: useStalenessData Hook

**Files:**
- Create: `apps/lootit/src/hooks/useStalenessData.js`

- [ ] **Step 1: Create the hook**

This hook is pure computation — takes reviews, snapshot data, and current reconciliation data, returns staleness flags per rule.

```javascript
import { useMemo } from 'react';

function daysBetween(dateA, dateB) {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.floor(Math.abs(dateB - dateA) / msPerDay);
}

export function useStalenessData({ reviews, snapshotsByRuleId, latestSignOff, allRecons, pax8Recons }) {
  return useMemo(() => {
    const stalenessMap = {};
    const signOffDate = latestSignOff?.signed_at ? new Date(latestSignOff.signed_at) : null;
    const now = new Date();

    const allTiles = [
      ...(allRecons || []).map((r) => ({ ruleId: r.rule.id, psaQty: r.psaQty, vendorQty: r.vendorQty })),
      ...(pax8Recons || []).map((r) => ({ ruleId: r.ruleId, psaQty: r.psaQty, vendorQty: r.vendorQty })),
    ];

    for (const tile of allTiles) {
      const review = (reviews || []).find((r) => r.rule_id === tile.ruleId);
      const snapshot = snapshotsByRuleId?.[tile.ruleId];
      const hasManualAction = review && ['reviewed', 'force_matched', 'dismissed'].includes(review.status);

      let stalenessDays = null;
      let isStale = false;
      let changeDetected = false;
      let previousPsaQty = null;
      let previousVendorQty = null;

      if (hasManualAction && signOffDate) {
        const reviewedAt = review.reviewed_at ? new Date(review.reviewed_at) : null;
        if (!reviewedAt || reviewedAt < signOffDate) {
          stalenessDays = daysBetween(reviewedAt || signOffDate, now);
          isStale = true;
        }
      } else if (hasManualAction && !signOffDate) {
        const reviewedAt = review.reviewed_at ? new Date(review.reviewed_at) : null;
        if (reviewedAt) {
          stalenessDays = daysBetween(reviewedAt, now);
          isStale = stalenessDays > 30;
        }
      }

      if (snapshot) {
        const psaChanged = tile.psaQty !== snapshot.psa_qty;
        const vendorChanged = tile.vendorQty !== snapshot.vendor_qty;
        if (psaChanged || vendorChanged) {
          changeDetected = true;
          previousPsaQty = snapshot.psa_qty;
          previousVendorQty = snapshot.vendor_qty;
        }
      }

      if (isStale || changeDetected) {
        stalenessMap[tile.ruleId] = {
          stalenessDays,
          isStale,
          changeDetected,
          previousPsaQty,
          previousVendorQty,
          lastReviewedBy: review?.reviewed_by,
          lastReviewedAt: review?.reviewed_at,
        };
      }
    }

    const staleCount = Object.values(stalenessMap).filter((s) => s.isStale || s.changeDetected).length;

    return { stalenessMap, staleCount };
  }, [reviews, snapshotsByRuleId, latestSignOff, allRecons, pax8Recons]);
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/lootit/src/hooks/useStalenessData.js
git commit -m "feat: add useStalenessData hook for staleness flags and change detection"
```

---

## Task 5: useSignOff Hook

**Files:**
- Create: `apps/lootit/src/hooks/useSignOff.js`

- [ ] **Step 1: Create the hook**

```javascript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/api/client';
import { useAuth } from '@/lib/AuthContext';

export function useSignOff(customerId) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const signOffMutation = useMutation({
    mutationFn: async ({ allRecons, pax8Recons, reviews, overrides, notes }) => {
      const allTiles = [
        ...(allRecons || []).map((r) => ({
          ruleId: r.rule.id,
          label: r.rule.label,
          integrationKey: r.rule.integration_key || r.integrationLabel,
          psaQty: r.psaQty,
          vendorQty: r.vendorQty,
          status: r.status,
          review: (reviews || []).find((rv) => rv.rule_id === r.rule.id),
        })),
        ...(pax8Recons || []).map((r) => ({
          ruleId: r.ruleId,
          label: r.productName,
          integrationKey: 'pax8',
          psaQty: r.psaQty,
          vendorQty: r.vendorQty,
          status: r.status,
          review: (reviews || []).find((rv) => rv.rule_id === r.ruleId),
        })),
      ];

      const matched = allTiles.filter((t) => t.status === 'match').length;
      const issues = allTiles.filter((t) => ['over', 'under'].includes(t.status)).length;
      const forcedMatched = allTiles.filter((t) => t.review?.status === 'force_matched').length;
      const dismissed = allTiles.filter((t) => t.review?.status === 'dismissed').length;
      const excluded = allTiles.filter((t) => (t.review?.exclusion_count || 0) > 0).length;

      const { data: signOff, error: signOffError } = await supabase
        .from('reconciliation_sign_offs')
        .insert({
          customer_id: customerId,
          signed_by: user?.id,
          signed_at: new Date().toISOString(),
          status: 'signed_off',
          manual_notes: notes || null,
          total_rules: allTiles.length,
          matched_count: matched,
          issues_count: issues,
          force_matched_count: forcedMatched,
          dismissed_count: dismissed,
          excluded_count: excluded,
        })
        .select()
        .single();

      if (signOffError) throw signOffError;

      const snapshotRows = allTiles.map((tile) => {
        const tileOverrides = (overrides || []).filter((o) => o.rule_id === tile.ruleId);
        return {
          customer_id: customerId,
          sign_off_id: signOff.id,
          rule_id: tile.ruleId,
          label: tile.label,
          integration_key: tile.integrationKey,
          status: tile.status,
          psa_qty: tile.psaQty,
          vendor_qty: tile.vendorQty,
          difference: (tile.psaQty || 0) - (tile.vendorQty || 0),
          exclusion_count: tile.review?.exclusion_count || 0,
          exclusion_reason: tile.review?.exclusion_reason || null,
          review_status: tile.review?.status || 'pending',
          review_notes: tile.review?.notes || null,
          reviewed_by: tile.review?.reviewed_by || null,
          reviewed_by_name: user?.full_name || user?.email || null,
          reviewed_at: tile.review?.reviewed_at || null,
          override_data: tileOverrides.length > 0 ? tileOverrides : null,
        };
      });

      if (snapshotRows.length > 0) {
        const { error: snapError } = await supabase
          .from('reconciliation_snapshots')
          .insert(snapshotRows);
        if (snapError) throw snapError;
      }

      const historyRows = allTiles.map((tile) => ({
        customer_id: customerId,
        rule_id: tile.ruleId,
        action: 'signed_off',
        status: tile.review?.status || 'pending',
        notes: `Sign-off ${signOff.id}`,
        psa_qty: tile.psaQty,
        vendor_qty: tile.vendorQty,
        created_by: user?.id || null,
      }));

      if (historyRows.length > 0) {
        supabase.from('reconciliation_review_history').insert(historyRows);
      }

      return signOff;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reconciliation_sign_off_latest', customerId] });
      queryClient.invalidateQueries({ queryKey: ['reconciliation_snapshots', customerId] });
      queryClient.invalidateQueries({ queryKey: ['reconciliation_review_history', customerId] });
      queryClient.invalidateQueries({ queryKey: ['sign_off_status', customerId] });
    },
  });

  return {
    signOff: signOffMutation.mutateAsync,
    isSigningOff: signOffMutation.isPending,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/lootit/src/hooks/useSignOff.js
git commit -m "feat: add useSignOff hook for reconciliation sign-off workflow"
```

---

## Task 6: StaleBadge + AuditFooter Components

**Files:**
- Create: `apps/lootit/src/components/lootit/StaleBadge.jsx`
- Create: `apps/lootit/src/components/lootit/AuditFooter.jsx`

- [ ] **Step 1: Create StaleBadge**

```jsx
import React from 'react';

export default function StaleBadge({ stalenessDays, changeDetected }) {
  if (changeDetected) {
    return (
      <span
        className="absolute top-[-6px] right-3 text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded z-20"
        style={{ background: '#EF4444', color: '#FFFFFF', letterSpacing: '0.5px' }}
      >
        New Issue
      </span>
    );
  }

  if (stalenessDays != null) {
    return (
      <span
        className="absolute top-[-6px] right-3 text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded z-20"
        style={{ background: '#EAB308', color: '#000000', letterSpacing: '0.5px' }}
      >
        Stale · {stalenessDays}d
      </span>
    );
  }

  return null;
}
```

- [ ] **Step 2: Create AuditFooter**

```jsx
import React from 'react';

function formatRelativeDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getActionLabel(reviewStatus) {
  switch (reviewStatus) {
    case 'reviewed': return 'Reviewed';
    case 'force_matched': return 'Force Matched';
    case 'dismissed': return 'Dismissed';
    default: return 'Reviewed';
  }
}

export default function AuditFooter({ reviewStatus, reviewedByName, reviewedAt, isStale, changeDetected, previousPsaQty, previousVendorQty }) {
  if (!reviewedAt && !changeDetected) return null;

  if (changeDetected) {
    return (
      <div className="px-3 pb-1.5">
        <p className="text-[9px] text-red-500 truncate leading-tight">
          Changed since sign-off (was {previousPsaQty ?? '—'}/{previousVendorQty ?? '—'})
        </p>
      </div>
    );
  }

  const label = getActionLabel(reviewStatus);
  const dateStr = formatRelativeDate(reviewedAt);
  const nameDisplay = reviewedByName || 'Unknown';
  const color = isStale ? 'text-amber-500' : 'text-slate-400';
  const prefix = isStale ? '⚠ ' : '';

  return (
    <div className="px-3 pb-1.5">
      <p className={`text-[9px] ${color} truncate leading-tight`}>
        {prefix}{label} by {nameDisplay} · {dateStr}
      </p>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/lootit/src/components/lootit/StaleBadge.jsx apps/lootit/src/components/lootit/AuditFooter.jsx
git commit -m "feat: add StaleBadge and AuditFooter components"
```

---

## Task 7: Update ServiceCard + Pax8SubscriptionCard

**Files:**
- Modify: `apps/lootit/src/components/lootit/ServiceCard.jsx`
- Modify: `apps/lootit/src/components/lootit/Pax8SubscriptionCard.jsx`

- [ ] **Step 1: Update ServiceCard**

Add imports at top of `ServiceCard.jsx`:

```javascript
import StaleBadge from './StaleBadge';
import AuditFooter from './AuditFooter';
```

Add new props to the `ServiceCard` function signature. Update from:

```javascript
export default function ServiceCard({
  reconciliation,
  onReview,
  onDismiss,
  onDetails,
  onReset,
  onEditRule,
  onSaveNotes,
  onMapLineItem,
  onRemoveMapping,
  onForceMatch,
  hasOverride,
  overrideCount = 0,
  isSaving,
}) {
```

To:

```javascript
export default function ServiceCard({
  reconciliation,
  onReview,
  onDismiss,
  onDetails,
  onReset,
  onEditRule,
  onSaveNotes,
  onMapLineItem,
  onRemoveMapping,
  onForceMatch,
  hasOverride,
  overrideCount = 0,
  isSaving,
  staleness,
}) {
```

Add the StaleBadge right after the DiffBadge inside the card div (after `{showDiff && <DiffBadge diff={diff} />}`):

```jsx
{staleness && (
  <StaleBadge
    stalenessDays={staleness.stalenessDays}
    changeDetected={staleness.changeDetected}
  />
)}
```

Update the card border style when stale. Change the card's `style` prop from:

```javascript
style={{
  height: '190px',
  background: styles.bg,
  border: styles.border,
  opacity: isDismissed ? 0.7 : 1,
  transition: 'all 0.2s ease',
}}
```

To:

```javascript
style={{
  height: '210px',
  background: styles.bg,
  border: staleness?.changeDetected
    ? '1.5px solid rgba(239, 68, 68, 0.4)'
    : staleness?.isStale
    ? '1.5px solid rgba(234, 179, 8, 0.4)'
    : styles.border,
  opacity: isDismissed ? 0.7 : 1,
  transition: 'all 0.2s ease',
}}
```

Add `AuditFooter` right before the closing `</div>` of the card, after the `CardActionZone` `</div>`:

```jsx
<AuditFooter
  reviewStatus={review?.status}
  reviewedByName={review?.reviewed_by_name}
  reviewedAt={review?.reviewed_at}
  isStale={staleness?.isStale}
  changeDetected={staleness?.changeDetected}
  previousPsaQty={staleness?.previousPsaQty}
  previousVendorQty={staleness?.previousVendorQty}
/>
```

- [ ] **Step 2: Update Pax8SubscriptionCard**

Apply the same pattern to `Pax8SubscriptionCard.jsx`:

Add imports:

```javascript
import StaleBadge from './StaleBadge';
import AuditFooter from './AuditFooter';
```

Add `staleness` to the props destructuring.

Add `StaleBadge` after the diff badge.

Update card height from `190px` to `210px` and add staleness border logic (same as ServiceCard).

Add `AuditFooter` before the card's closing `</div>`, after the action zone. For Pax8 cards, use `recon.review` for review data:

```jsx
<AuditFooter
  reviewStatus={recon.review?.status}
  reviewedByName={recon.review?.reviewed_by_name}
  reviewedAt={recon.review?.reviewed_at}
  isStale={staleness?.isStale}
  changeDetected={staleness?.changeDetected}
  previousPsaQty={staleness?.previousPsaQty}
  previousVendorQty={staleness?.previousVendorQty}
/>
```

- [ ] **Step 3: Verify build**

Run: `cd apps/lootit && npx vite build --mode development 2>&1 | tail -5`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add apps/lootit/src/components/lootit/ServiceCard.jsx apps/lootit/src/components/lootit/Pax8SubscriptionCard.jsx
git commit -m "feat: add staleness badges and audit footers to reconciliation cards"
```

---

## Task 8: SnapshotCard + SignOffBanner + DashboardTab

**Files:**
- Create: `apps/lootit/src/components/lootit/SnapshotCard.jsx`
- Create: `apps/lootit/src/components/lootit/SignOffBanner.jsx`
- Create: `apps/lootit/src/components/lootit/DashboardTab.jsx`

- [ ] **Step 1: Create SnapshotCard**

Read-only card based on ServiceCard's visual structure, using snapshot data.

```jsx
import React from 'react';

const STATUS_STYLES = {
  match:          { bg: 'linear-gradient(135deg, #F0FDF4 0%, #ECFDF5 100%)', border: '1.5px solid #BBF7D0', bar: '#22C55E', num: '#166534', badge: { bg: '#DCFCE7', text: '#166534', label: 'Match' } },
  over:           { bg: 'linear-gradient(135deg, #FFF7ED 0%, #FFFBEB 100%)', border: '1.5px solid #FED7AA', bar: '#F97316', num: '#C2410C', badge: { bg: '#FEF3C7', text: '#B45309', label: 'Over' } },
  under:          { bg: 'linear-gradient(135deg, #FEF2F2 0%, #FFF5F5 100%)', border: '1.5px solid #FECACA', bar: '#EF4444', num: '#DC2626', badge: { bg: '#FEE2E2', text: '#DC2626', label: 'Under' } },
  force_matched:  { bg: 'linear-gradient(135deg, #EFF6FF 0%, #F0F9FF 100%)', border: '1.5px solid #BFDBFE', bar: '#3B82F6', num: '#1E40AF', badge: { bg: '#DBEAFE', text: '#1E40AF', label: 'Force Matched' } },
  dismissed:      { bg: '#F8FAFC', border: '1.5px solid #E2E8F0', bar: '#CBD5E1', num: '#94A3B8', badge: { bg: '#F1F5F9', text: '#94A3B8', label: 'Dismissed' } },
  no_vendor_data: { bg: 'linear-gradient(135deg, #FFF1F5 0%, #FFF5F7 100%)', border: '1.5px solid #FBCFE8', bar: '#EC4899', num: '#9D174D', badge: { bg: '#FCE7F3', text: '#9D174D', label: 'No Vendor' } },
};

function getSnapshotStyle(snapshot) {
  if (snapshot.review_status === 'force_matched') return STATUS_STYLES.force_matched;
  if (snapshot.review_status === 'dismissed') return STATUS_STYLES.dismissed;
  return STATUS_STYLES[snapshot.status] || STATUS_STYLES.no_vendor_data;
}

function getReviewLabel(reviewStatus) {
  switch (reviewStatus) {
    case 'reviewed': return 'Reviewed';
    case 'force_matched': return 'Force Matched';
    case 'dismissed': return 'Dismissed';
    default: return 'Pending';
  }
}

export default function SnapshotCard({ snapshot, onDetails }) {
  const style = getSnapshotStyle(snapshot);
  const diff = snapshot.difference || 0;
  const showDiff = diff !== 0 && !['force_matched', 'dismissed'].includes(snapshot.review_status);

  const reviewDate = snapshot.reviewed_at
    ? new Date(snapshot.reviewed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null;

  return (
    <div
      className="relative rounded-[14px] overflow-hidden flex flex-col cursor-pointer"
      style={{
        height: '210px',
        background: style.bg,
        border: style.border,
        opacity: snapshot.review_status === 'dismissed' ? 0.7 : 1,
      }}
      onClick={() => onDetails?.(snapshot)}
    >
      <div className="h-[3px] w-full" style={{ background: style.bar }} />

      {showDiff && (
        <span
          className="absolute top-[10px] right-[10px] text-[10px] font-bold tabular-nums px-2 py-0.5 rounded-full z-10"
          style={{
            background: diff > 0 ? '#FEF3C7' : '#FEE2E2',
            color: diff > 0 ? '#B45309' : '#DC2626',
          }}
        >
          {diff > 0 ? '+' : ''}{diff}
        </span>
      )}

      <div className="px-3 pt-[10px]">
        <h4 className="text-[13px] font-bold text-slate-800 leading-tight truncate">
          {snapshot.label}
        </h4>
        <p className="text-[10px] text-slate-400 leading-tight truncate">
          {snapshot.integration_key}
        </p>
      </div>

      <div className="flex items-center justify-center gap-1.5 flex-1">
        <div className="text-center w-16">
          <div className="text-[28px] font-bold leading-none tabular-nums h-[32px] flex items-end justify-center" style={{ color: style.num }}>
            {snapshot.psa_qty ?? '—'}
          </div>
          <div className="text-[9px] font-semibold uppercase tracking-wider mt-1" style={{ color: style.num, opacity: 0.5 }}>PSA</div>
        </div>
        <span className="text-[10px] font-medium text-slate-300 mx-0.5">
          {snapshot.status === 'match' || snapshot.review_status === 'force_matched' ? '=' : 'vs'}
        </span>
        <div className="text-center w-16">
          <div className="text-[28px] font-bold leading-none tabular-nums h-[32px] flex items-end justify-center" style={{ color: style.num }}>
            {snapshot.vendor_qty ?? '—'}
          </div>
          <div className="text-[9px] font-semibold uppercase tracking-wider mt-1" style={{ color: style.num, opacity: 0.5 }}>Vendor</div>
        </div>
      </div>

      <div className="px-2 pb-[10px]">
        <div
          className="block w-full py-[7px] rounded-lg text-[12px] font-semibold text-center"
          style={{ background: style.badge.bg, color: style.badge.text }}
        >
          {style.badge.label}
        </div>
      </div>

      <div className="px-3 pb-1.5">
        <p className="text-[9px] text-slate-400 truncate leading-tight">
          {getReviewLabel(snapshot.review_status)} by {snapshot.reviewed_by_name || 'Unknown'} · {reviewDate || '—'}
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create SignOffBanner**

```jsx
import React from 'react';

export default function SignOffBanner({ signOff, onStartReconciliation }) {
  if (!signOff) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-lg px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-slate-300" />
          <span className="text-sm text-slate-500">No reconciliation completed yet</span>
        </div>
        <button
          onClick={onStartReconciliation}
          className="text-xs font-medium text-pink-600 hover:text-pink-800 border border-pink-200 bg-pink-50 px-4 py-1.5 rounded-lg transition-colors"
        >
          Start Reconciliation →
        </button>
      </div>
    );
  }

  const signedDate = new Date(signOff.signed_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const signerName = signOff.signed_by_user?.full_name || signOff.signed_by_user?.email || 'Unknown';

  return (
    <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-5 py-4 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-emerald-500" />
        <span className="text-sm font-medium text-emerald-700">Signed off {signedDate}</span>
        <span className="text-sm text-emerald-600/70">by {signerName}</span>
      </div>
      <button
        onClick={onStartReconciliation}
        className="text-xs font-medium text-pink-600 hover:text-pink-800 border border-pink-200 bg-pink-50 px-4 py-1.5 rounded-lg transition-colors"
      >
        Start New Reconciliation →
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Create DashboardTab**

```jsx
import React from 'react';
import { useReconciliationSnapshot } from '@/hooks/useReconciliationSnapshot';
import SignOffBanner from './SignOffBanner';
import SnapshotCard from './SnapshotCard';

export default function DashboardTab({ customerId, onTabChange, onShowSnapshotDetail }) {
  const { latestSignOff, snapshots, isLoading } = useReconciliationSnapshot(customerId);

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400 text-sm">Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SignOffBanner
        signOff={latestSignOff}
        onStartReconciliation={() => onTabChange('reconciliation')}
      />

      {snapshots.length > 0 && (
        <div className="grid grid-cols-4 gap-3 auto-rows-fr">
          {snapshots.map((snapshot) => (
            <SnapshotCard
              key={snapshot.id}
              snapshot={snapshot}
              onDetails={onShowSnapshotDetail}
            />
          ))}
        </div>
      )}

      {!latestSignOff && (
        <div className="text-center py-8">
          <p className="text-slate-400 text-sm">
            Complete your first reconciliation to see the dashboard snapshot here.
          </p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Verify build**

Run: `cd apps/lootit && npx vite build --mode development 2>&1 | tail -5`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add apps/lootit/src/components/lootit/SnapshotCard.jsx apps/lootit/src/components/lootit/SignOffBanner.jsx apps/lootit/src/components/lootit/DashboardTab.jsx
git commit -m "feat: add SnapshotCard, SignOffBanner, and DashboardTab components"
```

---

## Task 9: SignOffDialog + Update CustomerDetailReconciliationTab

**Files:**
- Create: `apps/lootit/src/components/lootit/SignOffDialog.jsx`
- Modify: `apps/lootit/src/components/lootit/CustomerDetailReconciliationTab.jsx`

- [ ] **Step 1: Create SignOffDialog**

```jsx
import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

export default function SignOffDialog({ open, onClose, summary, unresolvedItems, onConfirm, isSigningOff }) {
  const [notes, setNotes] = useState('');

  const handleConfirm = () => {
    onConfirm(notes);
    setNotes('');
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>Sign Off Reconciliation</DialogTitle>
          <DialogDescription>
            This will create a snapshot of the current reconciliation state.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-emerald-50 rounded-lg p-2">
              <div className="text-lg font-bold text-emerald-700">{summary?.matched || 0}</div>
              <div className="text-[10px] text-emerald-600">Matched</div>
            </div>
            <div className="bg-blue-50 rounded-lg p-2">
              <div className="text-lg font-bold text-blue-700">{summary?.forceMatched || 0}</div>
              <div className="text-[10px] text-blue-600">Force Matched</div>
            </div>
            <div className="bg-slate-50 rounded-lg p-2">
              <div className="text-lg font-bold text-slate-600">{summary?.dismissed || 0}</div>
              <div className="text-[10px] text-slate-500">Dismissed</div>
            </div>
          </div>

          {unresolvedItems.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-xs font-medium text-amber-700 mb-1">
                {unresolvedItems.length} unresolved item{unresolvedItems.length > 1 ? 's' : ''}:
              </p>
              <ul className="text-xs text-amber-600 space-y-0.5">
                {unresolvedItems.slice(0, 5).map((item) => (
                  <li key={item.ruleId}>• {item.label} ({item.status})</li>
                ))}
                {unresolvedItems.length > 5 && (
                  <li>...and {unresolvedItems.length - 5} more</li>
                )}
              </ul>
            </div>
          )}

          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional sign-off notes..."
            className="w-full text-sm border border-slate-200 rounded-lg p-2.5 resize-none h-20 focus:outline-none focus:ring-2 focus:ring-pink-300 focus:border-pink-300"
          />
        </div>

        <DialogFooter className="gap-2">
          <button
            onClick={onClose}
            disabled={isSigningOff}
            className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isSigningOff}
            className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors disabled:opacity-50"
          >
            {isSigningOff ? 'Signing off...' : 'Sign Off'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Update CustomerDetailReconciliationTab**

Replace the entire file content of `CustomerDetailReconciliationTab.jsx`:

```jsx
import React from 'react';
import { cn } from '@/lib/utils';
import { Filter, Link2, ClipboardCheck } from 'lucide-react';
import ServiceCard from './ServiceCard';
import Pax8SubscriptionCard from './Pax8SubscriptionCard';

export default function CustomerDetailReconciliationTab({
  filteredRecons,
  filteredPax8,
  statusFilter,
  onFilterChange,
  allRecons,
  summary,
  issueCount,
  existingOverrides,
  isSaving,
  onReview,
  onDismiss,
  onReset,
  onDetails,
  onEditRule,
  onSaveNotes,
  onForceMatch,
  onMapLineItem,
  onRemoveMapping,
  onShowGroupMapper,
  stalenessMap,
  staleCount,
  onSignOff,
}) {
  return (
    <>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1.5">
          {[
            { key: 'all', label: 'All', count: allRecons.filter(r => r.status !== 'no_data').length },
            { key: 'issues', label: 'Issues', count: issueCount },
            { key: 'stale', label: 'Stale', count: staleCount || 0 },
            { key: 'matched', label: 'Matched', count: summary?.matched || 0 },
            { key: 'reviewed', label: 'Reviewed', count: summary?.reviewed || 0 },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => onFilterChange(f.key)}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
                statusFilter === f.key
                  ? 'bg-pink-500 text-white shadow-sm shadow-pink-200'
                  : 'bg-white text-slate-500 border border-slate-200 hover:bg-pink-50'
              )}
            >
              {f.label}
              <span className={cn(
                'text-[10px] px-1.5 py-0.5 rounded-full',
                statusFilter === f.key ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-400'
              )}>
                {f.count}
              </span>
            </button>
          ))}
        </div>
        {onSignOff && (
          <button
            onClick={onSignOff}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors"
          >
            <ClipboardCheck className="w-3.5 h-3.5" />
            Sign Off Reconciliation
          </button>
        )}
      </div>

      {filteredRecons.length === 0 && filteredPax8.length === 0 ? (
        <div className="text-center py-12">
          <Filter className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">
            {statusFilter === 'all'
              ? 'No reconciliation data for this customer'
              : 'No services match this filter'}
          </p>
        </div>
      ) : filteredRecons.length === 0 ? null : (
        <div className="grid grid-cols-4 gap-3 auto-rows-fr">
          {filteredRecons.map((recon) => (
            <ServiceCard
              key={recon.rule.id}
              reconciliation={recon}
              onReview={onReview}
              onDismiss={onDismiss}
              onReset={onReset}
              onDetails={onDetails}
              onEditRule={onEditRule}
              onSaveNotes={onSaveNotes}
              onForceMatch={onForceMatch}
              onMapLineItem={onMapLineItem}
              onRemoveMapping={onRemoveMapping}
              hasOverride={existingOverrides.some((o) => o.rule_id === recon.rule.id)}
              overrideCount={existingOverrides.filter((o) => o.rule_id === recon.rule.id && o.pax8_product_name !== 'approved_as_is').length}
              isSaving={isSaving}
              staleness={stalenessMap?.[recon.rule.id]}
            />
          ))}
        </div>
      )}

      {filteredPax8.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700">
              Pax8 / M365 Licence Reconciliation
            </h3>
            <button
              onClick={onShowGroupMapper}
              className="text-[10px] font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors"
            >
              <Link2 className="w-3 h-3" />
              Group Map
            </button>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {filteredPax8.map((recon) => (
              <Pax8SubscriptionCard
                key={recon.ruleId}
                recon={recon}
                onReview={onReview}
                onDismiss={onDismiss}
                onReset={onReset}
                onForceMatch={onForceMatch}
                onDetails={onDetails}
                onMapLineItem={() => onMapLineItem(recon)}
                onRemoveMapping={() => onRemoveMapping(recon.ruleId)}
                onSaveNotes={onSaveNotes}
                hasOverride={existingOverrides.some((o) => o.rule_id === recon.ruleId)}
                isSaving={isSaving}
                staleness={stalenessMap?.[recon.ruleId]}
              />
            ))}
          </div>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `cd apps/lootit && npx vite build --mode development 2>&1 | tail -5`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add apps/lootit/src/components/lootit/SignOffDialog.jsx apps/lootit/src/components/lootit/CustomerDetailReconciliationTab.jsx
git commit -m "feat: add SignOffDialog, update ReconciliationTab with stale filter and sign-off button"
```

---

## Task 10: Update ReconciliationDetailModal

**Files:**
- Modify: `apps/lootit/src/components/lootit/ReconciliationDetailModal.jsx`

- [ ] **Step 1: Add re_verified and signed_off to ACTION_ICONS**

Find the `ACTION_ICONS` object (around line 36) and add:

```javascript
re_verified: RefreshCw,
signed_off: ShieldCheck,
```

Add `RefreshCw` to the Lucide import at the top of the file.

- [ ] **Step 2: Add readOnly prop and re-verify button**

Add `readOnly` and `onReVerify` to the component's props destructuring.

When `readOnly` is true:
- Hide all action buttons (Approve, Force Match, Dismiss, Reset, Map)
- Hide the note textarea and exclusion form
- Show only the audit log section
- Add a "Snapshot from {date}" label in the header

When `readOnly` is false and the reconciliation has a staleness flag:
- Add a "Re-verify" button at the top of the action section:

```jsx
{!readOnly && onReVerify && (
  <button
    onClick={() => onReVerify(reconciliation.rule?.id || reconciliation.ruleId)}
    className="w-full py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors"
  >
    Re-verify
  </button>
)}
```

- [ ] **Step 3: Enhance audit log section header**

Find the history/timeline section and update the section header from whatever it currently is to:

```jsx
<h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
  Audit Log
  <span className="text-[10px] font-normal text-slate-400">
    {history.length} {history.length === 1 ? 'entry' : 'entries'}
  </span>
</h3>
```

- [ ] **Step 4: Verify build**

Run: `cd apps/lootit && npx vite build --mode development 2>&1 | tail -5`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add apps/lootit/src/components/lootit/ReconciliationDetailModal.jsx
git commit -m "feat: add readOnly mode, re-verify button, and audit log header to detail modal"
```

---

## Task 11: Wire Everything in LootITCustomerDetail

**Files:**
- Modify: `apps/lootit/src/components/lootit/LootITCustomerDetail.jsx`

This is the integration task — add the Dashboard tab, wire up the new hooks, and connect sign-off.

- [ ] **Step 1: Add imports**

Add to the top of `LootITCustomerDetail.jsx`:

```javascript
import { LayoutDashboard } from 'lucide-react';
import { useReconciliationSnapshot } from '@/hooks/useReconciliationSnapshot';
import { useStalenessData } from '@/hooks/useStalenessData';
import { useSignOff } from '@/hooks/useSignOff';
import DashboardTab from './DashboardTab';
import SignOffDialog from './SignOffDialog';
```

- [ ] **Step 2: Add hooks and state**

Inside the component function, after the existing hook calls (after `useSyncCustomer`), add:

```javascript
const { latestSignOff, snapshots, snapshotsByRuleId } = useReconciliationSnapshot(customer.id);
const { signOff, isSigningOff } = useSignOff(customer.id);
const [showSignOffDialog, setShowSignOffDialog] = useState(false);
```

After the `allRecons` and `pax8Recons` are computed (around where `customerData` is extracted), add:

```javascript
const { stalenessMap, staleCount } = useStalenessData({
  reviews,
  snapshotsByRuleId,
  latestSignOff,
  allRecons,
  pax8Recons,
});
```

- [ ] **Step 3: Add stale filter logic**

Find the existing filter logic that computes `filteredRecons` and `filteredPax8` (this is likely in a `useMemo`). Add a `'stale'` case:

For the `stale` filter, filter to only items that exist in `stalenessMap`:

```javascript
case 'stale':
  return allRecons.filter((r) => stalenessMap[r.rule.id]);
```

And for Pax8:

```javascript
case 'stale':
  return pax8Recons.filter((r) => stalenessMap[r.ruleId]);
```

- [ ] **Step 4: Add sign-off handler**

```javascript
const handleSignOff = async (notes) => {
  await signOff({
    allRecons,
    pax8Recons,
    reviews,
    overrides: existingOverrides,
    notes,
  });
  setShowSignOffDialog(false);
  toast.success('Reconciliation signed off successfully');
  setActiveTab('dashboard');
};
```

Also compute the unresolved items for the dialog:

```javascript
const unresolvedItems = useMemo(() => {
  const allTiles = [
    ...(allRecons || []).map((r) => ({ ruleId: r.rule.id, label: r.rule.label, status: r.status, review: reviews.find((rv) => rv.rule_id === r.rule.id) })),
    ...(pax8Recons || []).map((r) => ({ ruleId: r.ruleId, label: r.productName, status: r.status, review: reviews.find((rv) => rv.rule_id === r.ruleId) })),
  ];
  return allTiles.filter((t) =>
    ['over', 'under'].includes(t.status) &&
    !['reviewed', 'force_matched', 'dismissed'].includes(t.review?.status)
  );
}, [allRecons, pax8Recons, reviews]);
```

- [ ] **Step 5: Add re-verify handler**

```javascript
const handleReVerify = async (ruleId) => {
  const review = reviews.find((r) => r.rule_id === ruleId);
  if (!review) return;
  await upsertMutation.mutateAsync({
    ruleId,
    status: review.status,
    action: 're_verified',
    notes: review.notes,
    psaQty: review.psa_qty,
    vendorQty: review.vendor_qty,
  });
  toast.success('Re-verified successfully');
};
```

Wait — the `upsertMutation` is inside `useReconciliationReviews`. We need to expose a `reVerify` action from that hook. Instead, add a `reVerify` method to `useReconciliationReviews.js`:

In `apps/lootit/src/hooks/useReconciliationReviews.js`, add after the `forceMatch` function (around line 150):

```javascript
const reVerify = (ruleId) => {
  const existing = reviews.find((r) => r.rule_id === ruleId);
  if (!existing) return Promise.resolve();
  return upsertMutation.mutateAsync({
    ruleId,
    status: existing.status,
    action: 're_verified',
    notes: existing.notes,
    psaQty: existing.psa_qty,
    vendorQty: existing.vendor_qty,
  });
};
```

And add `reVerify` to the return object:

```javascript
return {
  reviews,
  isLoading,
  error,
  markReviewed,
  dismiss,
  resetReview,
  saveNotes,
  saveExclusion,
  forceMatch,
  reVerify,
  isSaving: upsertMutation.isPending,
};
```

Then back in `LootITCustomerDetail.jsx`, destructure `reVerify` from the hook:

```javascript
const { reviews, markReviewed, dismiss, resetReview, saveNotes, saveExclusion, forceMatch, reVerify, isSaving } = useReconciliationReviews(customer.id);
```

- [ ] **Step 6: Update tab array**

Replace the tab array to add Dashboard as the first/default tab:

```javascript
{[
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'reconciliation', label: 'Reconciliation', icon: RotateCcw },
  { key: 'recurring', label: 'Recurring', icon: Repeat2, badge: allLineItems.length || null },
  { key: 'invoices', label: 'Invoices', icon: DollarSign, badge: customerInvoices.length || null },
  { key: 'contract', label: 'Contract', icon: FileText, badge: contracts.length || null },
].map((tab) => (
```

- [ ] **Step 7: Update default tab**

Change the default `activeTab` prop from `'reconciliation'` to `'dashboard'`:

```javascript
export default function LootITCustomerDetail({ customer, onBack, activeTab: activeTabProp = 'dashboard', onTabChange }) {
```

- [ ] **Step 8: Add Dashboard tab render and sign-off dialog**

Add the Dashboard tab conditional render before the reconciliation tab render:

```jsx
{activeTab === 'dashboard' && (
  <DashboardTab
    customerId={customer.id}
    onTabChange={setActiveTab}
    onShowSnapshotDetail={(snapshot) => {
      setDetailItem({
        rule: { id: snapshot.rule_id, label: snapshot.label, integration_key: snapshot.integration_key },
        psaQty: snapshot.psa_qty,
        vendorQty: snapshot.vendor_qty,
        status: snapshot.status,
        review: {
          status: snapshot.review_status,
          notes: snapshot.review_notes,
          reviewed_by: snapshot.reviewed_by,
          reviewed_at: snapshot.reviewed_at,
          exclusion_count: snapshot.exclusion_count,
          exclusion_reason: snapshot.exclusion_reason,
        },
        integrationLabel: snapshot.integration_key,
        _readOnly: true,
        _snapshotDate: latestSignOff?.signed_at,
      });
    }}
  />
)}
```

Update the `CustomerDetailReconciliationTab` render to pass new props:

```jsx
{activeTab === 'reconciliation' && (
  <CustomerDetailReconciliationTab
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
    onSaveNotes={(ruleId, notes) => saveNotes(ruleId, notes)}
    onForceMatch={(ruleId, notes) => forceMatch(ruleId, notes)}
    onMapLineItem={(ruleId, label) => setMappingRecon({ ruleId, productName: label })}
    onRemoveMapping={(ruleId) => handleRemoveMapping(ruleId)}
    onShowGroupMapper={() => setShowGroupMapper(true)}
    stalenessMap={stalenessMap}
    staleCount={staleCount}
    onSignOff={() => setShowSignOffDialog(true)}
  />
)}
```

Update the `ReconciliationDetailModal` render to pass `readOnly` and `onReVerify`:

```jsx
{detailItem && (
  <ReconciliationDetailModal
    reconciliation={detailItem}
    customerId={customer.id}
    overrides={existingOverrides}
    onClose={() => setDetailItem(null)}
    readOnly={detailItem._readOnly || false}
    snapshotDate={detailItem._snapshotDate}
    onReVerify={async (ruleId) => {
      await reVerify(ruleId);
      toast.success('Re-verified');
    }}
    onForceMatch={/* ... existing handler unchanged ... */}
    onReview={(ruleId, opts) => markReviewed(ruleId, opts)}
    onDismiss={(ruleId, opts) => dismiss(ruleId, opts)}
    onReset={(ruleId) => resetReview(ruleId)}
    onSaveNotes={(ruleId, notes) => saveNotes(ruleId, notes)}
    onSaveExclusion={/* ... existing handler unchanged ... */}
    onMapLineItem={(ruleId, label) => setMappingRecon({ ruleId, productName: label })}
  />
)}
```

Add the `SignOffDialog` at the end, before the closing `</div>`:

```jsx
<SignOffDialog
  open={showSignOffDialog}
  onClose={() => setShowSignOffDialog(false)}
  summary={{
    matched: summary?.matched || 0,
    forceMatched: allRecons.filter((r) => reviews.find((rv) => rv.rule_id === r.rule.id)?.status === 'force_matched').length,
    dismissed: allRecons.filter((r) => reviews.find((rv) => rv.rule_id === r.rule.id)?.status === 'dismissed').length,
  }}
  unresolvedItems={unresolvedItems}
  onConfirm={handleSignOff}
  isSigningOff={isSigningOff}
/>
```

- [ ] **Step 9: Verify build**

Run: `cd apps/lootit && npx vite build --mode development 2>&1 | tail -5`
Expected: Build succeeds with no errors.

- [ ] **Step 10: Commit**

```bash
git add apps/lootit/src/components/lootit/LootITCustomerDetail.jsx apps/lootit/src/hooks/useReconciliationReviews.js
git commit -m "feat: wire Dashboard tab, staleness flags, sign-off flow, and re-verify action"
```

---

## Task 12: Manual Verification + Cleanup

**Files:** None (verification only)

- [ ] **Step 1: Start dev server**

Run: `cd apps/lootit && npm run dev`

- [ ] **Step 2: Verify Dashboard tab**

1. Navigate to a customer in LootIT
2. Confirm it lands on the Dashboard tab by default
3. If no sign-off exists, verify "No reconciliation completed yet" empty state with CTA
4. Click "Start Reconciliation →" — should switch to Reconciliation tab

- [ ] **Step 3: Verify Reconciliation tab**

1. Check that existing cards render correctly with the new 210px height
2. Verify filter buttons include "Stale" with count
3. If items have old review dates, verify yellow "Stale · Xd" badges appear
4. Click a stale card — verify detail modal shows "Re-verify" button
5. Click "Re-verify" — verify staleness clears, toast appears, history logs

- [ ] **Step 4: Test sign-off flow**

1. Click "Sign Off Reconciliation" button
2. Verify SignOffDialog opens with summary counts
3. If unresolved items exist, verify warning list appears
4. Add optional notes, click "Sign Off"
5. Verify toast: "Reconciliation signed off successfully"
6. Verify auto-navigation to Dashboard tab
7. Verify Dashboard now shows the sign-off banner with date and user
8. Verify snapshot cards display frozen data matching what was just signed off

- [ ] **Step 5: Verify change detection**

1. After a sign-off exists, if vendor data changes, verify red "New Issue" badge appears
2. Verify card footer shows "Changed since sign-off (was X/Y)"

- [ ] **Step 6: Verify audit log**

1. Click any card on Dashboard tab — verify modal opens in read-only mode
2. Verify no action buttons are shown
3. Verify "Audit Log" section header with entry count
4. Verify timeline shows `signed_off` entries with purple icon
5. Click a card on Reconciliation tab — verify full audit log with all action types
6. Card footers should show last reviewer name and date

- [ ] **Step 7: Run build check**

Run: `cd apps/lootit && npx vite build 2>&1 | tail -5`
Expected: Production build succeeds.
