# LootIT Reconciliation Reminders & Visibility — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add proactive reconciliation reminders with sign-off expiry tracking, force-match re-verification alerts, exclusion staleness badges, and Telegram notifications.

**Architecture:** Expand the existing `useStalenessData` hook to compute three new staleness dimensions (sign-off expiry, force-match age, exclusion age). Surface these via badges/banners in the UI and a daily server-side cron that sends Telegram notifications for due customers. Database changes are two new columns on existing tables.

**Tech Stack:** React (Vite), Supabase (PostgreSQL), Express server with node-cron, Telegram Bot API

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `supabase/migrations/20260420_add_reconciliation_reminder_columns.sql` | Add `exclusion_verified_at` + `reminder_sent_at` columns |
| Create | `server/src/lib/telegram.js` | Telegram Bot API utility (send messages) |
| Create | `server/src/functions/reconciliationReminders.js` | Daily cron: find due customers, send Telegram |
| Modify | `server/src/scheduled.js` | Register new cron job |
| Modify | `apps/lootit/src/hooks/useStalenessData.js` | Add sign-off expiry + exclusion staleness |
| Modify | `apps/lootit/src/hooks/useReconciliationReviews.js` | Add `reVerifyExclusion()` mutation |
| Modify | `apps/lootit/src/components/lootit/StaleBadge.jsx` | Add exclusion-stale and force-match-stale badge types |
| Modify | `apps/lootit/src/components/lootit/ServiceCard.jsx` | Pass new staleness props to StaleBadge |
| Modify | `apps/lootit/src/components/lootit/Pax8SubscriptionCard.jsx` | Same as ServiceCard |
| Modify | `apps/lootit/src/components/lootit/CustomerDetailHeaderCard.jsx` | Add "Reconciliation Due" banner |
| Modify | `apps/lootit/src/components/lootit/LootITDashboard.jsx` | Add "Due" column + filter |
| Modify | `apps/lootit/src/components/lootit/LootITCustomerDetail.jsx` | Pass sign-off expiry to header card |
| Modify | `server/src/functions/verifyReconciliation.js` | Add force-match + exclusion staleness warnings |

---

### Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260420_add_reconciliation_reminder_columns.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- Add exclusion verification tracking to reconciliation_reviews
ALTER TABLE reconciliation_reviews
ADD COLUMN IF NOT EXISTS exclusion_verified_at TIMESTAMPTZ;

-- Backfill: set exclusion_verified_at for existing exclusions
UPDATE reconciliation_reviews
SET exclusion_verified_at = COALESCE(updated_date, created_date)
WHERE exclusion_count > 0 AND exclusion_verified_at IS NULL;

-- Add reminder dedup tracking to reconciliation_sign_offs
ALTER TABLE reconciliation_sign_offs
ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;
```

- [ ] **Step 2: Apply the migration**

Run: `cd /Users/anielreyes/portalit && npx supabase db push` (or however migrations are applied in this project — check `package.json` for the migration command)

Expected: Both columns added, existing exclusions backfilled

- [ ] **Step 3: Verify columns exist**

Run: Query the database to confirm columns exist on both tables.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260420_add_reconciliation_reminder_columns.sql
git commit -m "feat(lootit): add exclusion_verified_at and reminder_sent_at columns"
```

---

### Task 2: Expand useStalenessData Hook

**Files:**
- Modify: `apps/lootit/src/hooks/useStalenessData.js`

- [ ] **Step 1: Add sign-off expiry and exclusion staleness to the hook**

Replace the entire file content with:

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

    // Sign-off expiry: customer-level, shared across all tiles
    const daysSinceSignOff = signOffDate ? daysBetween(signOffDate, now) : null;
    const signOffExpired = daysSinceSignOff === null || daysSinceSignOff >= 30;

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
      const staleReasons = [];

      // Existing staleness logic (review age vs sign-off)
      if (hasManualAction && signOffDate) {
        const reviewedAt = review.reviewed_at ? new Date(review.reviewed_at) : null;
        if (!reviewedAt || reviewedAt < signOffDate) {
          stalenessDays = daysBetween(reviewedAt || signOffDate, now);
          isStale = true;
          staleReasons.push('review_stale');
        }
      } else if (hasManualAction && !signOffDate) {
        const reviewedAt = review.reviewed_at ? new Date(review.reviewed_at) : null;
        if (reviewedAt) {
          stalenessDays = daysBetween(reviewedAt, now);
          isStale = stalenessDays > 30;
          if (isStale) staleReasons.push('review_stale');
        }
      }

      // Force-match staleness: flag when sign-off is expired
      if (review?.status === 'force_matched' && signOffExpired) {
        isStale = true;
        if (!staleReasons.includes('review_stale')) {
          stalenessDays = daysSinceSignOff ?? daysBetween(new Date(review.reviewed_at), now);
        }
        staleReasons.push('force_match_stale');
      }

      // Exclusion staleness: exclusion_verified_at > 90 days ago
      let exclusionStale = false;
      let exclusionDaysSinceVerified = null;
      if (review?.exclusion_count > 0) {
        const verifiedAt = review.exclusion_verified_at
          ? new Date(review.exclusion_verified_at)
          : review.updated_date
            ? new Date(review.updated_date)
            : review.created_date
              ? new Date(review.created_date)
              : null;
        if (verifiedAt) {
          exclusionDaysSinceVerified = daysBetween(verifiedAt, now);
          exclusionStale = exclusionDaysSinceVerified >= 90;
          if (exclusionStale) {
            isStale = true;
            staleReasons.push('exclusion_stale');
          }
        }
      }

      // Change detection (existing logic)
      if (snapshot) {
        const psaChanged = tile.psaQty !== snapshot.psa_qty;
        const vendorChanged = tile.vendorQty !== snapshot.vendor_qty;
        if (psaChanged || vendorChanged) {
          changeDetected = true;
          previousPsaQty = snapshot.psa_qty;
          previousVendorQty = snapshot.vendor_qty;
          staleReasons.push('data_changed');
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
          staleReasons,
          exclusionStale,
          exclusionDaysSinceVerified,
          forceMatchStale: staleReasons.includes('force_match_stale'),
        };
      }
    }

    const staleCount = Object.values(stalenessMap).filter((s) => s.isStale || s.changeDetected).length;

    return { stalenessMap, staleCount, signOffExpired, daysSinceSignOff };
  }, [reviews, snapshotsByRuleId, latestSignOff, allRecons, pax8Recons]);
}
```

- [ ] **Step 2: Verify the app still compiles**

Run: `cd /Users/anielreyes/portalit && npm run dev` (or check the Vite dev server)

Expected: No compilation errors. The hook now returns `signOffExpired` and `daysSinceSignOff` at the top level, plus `staleReasons`, `exclusionStale`, `exclusionDaysSinceVerified`, and `forceMatchStale` per tile in the staleness map.

- [ ] **Step 3: Commit**

```bash
git add apps/lootit/src/hooks/useStalenessData.js
git commit -m "feat(lootit): expand staleness hook with sign-off expiry, force-match, and exclusion staleness"
```

---

### Task 3: Add reVerifyExclusion Mutation

**Files:**
- Modify: `apps/lootit/src/hooks/useReconciliationReviews.js`

- [ ] **Step 1: Add the reVerifyExclusion method**

After the existing `reVerify` method (line 163), add a new method. Insert before the `return` statement on line 165:

```javascript
  const reVerifyExclusion = async (ruleId) => {
    const existing = reviews.find((r) => r.rule_id === ruleId);
    if (!existing) return;
    const { error } = await supabase
      .from('reconciliation_reviews')
      .update({ exclusion_verified_at: new Date().toISOString() })
      .eq('id', existing.id);
    if (error) throw error;
    logHistory({
      reviewId: existing.id,
      ruleId,
      action: 'exclusion_reverified',
      status: existing.status,
      notes: `Exclusions re-verified (${existing.exclusion_count} excluded)`,
      psaQty: existing.psa_qty,
      vendorQty: existing.vendor_qty,
    });
    queryClient.invalidateQueries({ queryKey: reviewsKey });
    queryClient.invalidateQueries({ queryKey: historyKey });
  };
```

- [ ] **Step 2: Add reVerifyExclusion to the return object**

Change the return statement to include `reVerifyExclusion`:

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
    reVerifyExclusion,
    isSaving: upsertMutation.isPending,
  };
```

- [ ] **Step 3: Also update saveExclusion to set exclusion_verified_at**

In the `saveExclusion` method (around line 128), update the upsert payload to also include `exclusion_verified_at`. Modify the `upsertMutation`'s `mutationFn` to include the new column. The simplest approach: after the upsert succeeds in `saveExclusion`, do a follow-up update:

Replace the `saveExclusion` function:

```javascript
  const saveExclusion = async (ruleId, exclusionCount, exclusionReason) => {
    const existing = reviews.find((r) => r.rule_id === ruleId);
    const result = await upsertMutation.mutateAsync({
      ruleId,
      status: existing?.status || 'reviewed',
      action: 'exclusion',
      notes: existing?.notes,
      psaQty: existing?.psa_qty,
      vendorQty: existing?.vendor_qty,
      exclusionCount: exclusionCount || 0,
      exclusionReason: exclusionReason || null,
    });
    // Set exclusion_verified_at on create/update
    if (result?.id && exclusionCount > 0) {
      await supabase
        .from('reconciliation_reviews')
        .update({ exclusion_verified_at: new Date().toISOString() })
        .eq('id', result.id);
    }
    return result;
  };
```

- [ ] **Step 4: Verify no compilation errors**

Run: Check Vite dev server for errors.

- [ ] **Step 5: Commit**

```bash
git add apps/lootit/src/hooks/useReconciliationReviews.js
git commit -m "feat(lootit): add reVerifyExclusion mutation and set exclusion_verified_at on save"
```

---

### Task 4: Update StaleBadge Component

**Files:**
- Modify: `apps/lootit/src/components/lootit/StaleBadge.jsx`

- [ ] **Step 1: Expand StaleBadge to handle new staleness types**

Replace the entire file:

```jsx
import React from 'react';

export default function StaleBadge({ stalenessDays, changeDetected, forceMatchStale, exclusionStale, exclusionDaysSinceVerified }) {
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

  if (forceMatchStale) {
    return (
      <span
        className="absolute top-[-6px] right-3 text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded z-20"
        style={{ background: '#F97316', color: '#FFFFFF', letterSpacing: '0.5px' }}
        title={`Force-matched ${stalenessDays || '?'}d ago — quantities may have changed`}
      >
        Re-verify
      </span>
    );
  }

  if (exclusionStale) {
    return (
      <span
        className="absolute top-[-6px] right-3 text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded z-20"
        style={{ background: '#F59E0B', color: '#000000', letterSpacing: '0.5px' }}
        title={`Exclusions last verified ${exclusionDaysSinceVerified || '?'}d ago`}
      >
        Exclusion Stale
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

- [ ] **Step 2: Verify it compiles**

Run: Check Vite dev server.

- [ ] **Step 3: Commit**

```bash
git add apps/lootit/src/components/lootit/StaleBadge.jsx
git commit -m "feat(lootit): add force-match and exclusion stale badge types"
```

---

### Task 5: Pass New Staleness Props to Tile Cards

**Files:**
- Modify: `apps/lootit/src/components/lootit/ServiceCard.jsx`
- Modify: `apps/lootit/src/components/lootit/Pax8SubscriptionCard.jsx`

- [ ] **Step 1: Update StaleBadge usage in ServiceCard.jsx**

Find the StaleBadge usage around line 347-352:

```jsx
      {staleness && (
        <StaleBadge
          stalenessDays={staleness.stalenessDays}
          changeDetected={staleness.changeDetected}
        />
      )}
```

Replace with:

```jsx
      {staleness && (
        <StaleBadge
          stalenessDays={staleness.stalenessDays}
          changeDetected={staleness.changeDetected}
          forceMatchStale={staleness.forceMatchStale}
          exclusionStale={staleness.exclusionStale}
          exclusionDaysSinceVerified={staleness.exclusionDaysSinceVerified}
        />
      )}
```

- [ ] **Step 2: Do the same in Pax8SubscriptionCard.jsx**

Find the StaleBadge usage in Pax8SubscriptionCard.jsx (search for `<StaleBadge`) and add the same three new props.

- [ ] **Step 3: Verify both cards render correctly in the browser**

Open LootIT, navigate to a customer with force-matched or exclusion tiles. Verify badges render correctly.

- [ ] **Step 4: Commit**

```bash
git add apps/lootit/src/components/lootit/ServiceCard.jsx apps/lootit/src/components/lootit/Pax8SubscriptionCard.jsx
git commit -m "feat(lootit): pass force-match and exclusion staleness to tile badges"
```

---

### Task 6: Add "Reconciliation Due" Banner to Customer Header

**Files:**
- Modify: `apps/lootit/src/components/lootit/CustomerDetailHeaderCard.jsx`
- Modify: `apps/lootit/src/components/lootit/LootITCustomerDetail.jsx`

- [ ] **Step 1: Add signOffExpired and daysSinceSignOff props to CustomerDetailHeaderCard**

In `CustomerDetailHeaderCard.jsx`, add `signOffExpired` and `daysSinceSignOff` to the destructured props (line 6):

```jsx
export default function CustomerDetailHeaderCard({
  customer,
  onBack,
  onSync,
  isSyncing,
  syncStatus,
  healthPct,
  activeIntegrations,
  summary,
  issueCount,
  dollarImpact,
  contacts,
  devices,
  contracts,
  recons,
  pax8Recons,
  allRecons,
  hasUnresolvedItems,
  unresolvedCount,
  signOffExpired,
  daysSinceSignOff,
}) {
```

- [ ] **Step 2: Add the banner after syncStatus (line 80)**

After the `syncStatus` block (line 81), add the due banner:

```jsx
        {signOffExpired && (
          <div className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium mb-3',
            daysSinceSignOff !== null && daysSinceSignOff >= 45
              ? 'bg-red-50 border border-red-200 text-red-700'
              : 'bg-amber-50 border border-amber-200 text-amber-700'
          )}>
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            <span>
              {daysSinceSignOff === null
                ? 'Reconciliation due — never signed off'
                : `Reconciliation due — last signed off ${daysSinceSignOff} days ago`}
            </span>
          </div>
        )}
```

- [ ] **Step 3: Pass the props from LootITCustomerDetail.jsx**

In `LootITCustomerDetail.jsx`, the `useStalenessData` hook is called around line 94. It now returns `signOffExpired` and `daysSinceSignOff`. Find where `<CustomerDetailHeaderCard>` is rendered (around line 310-320) and add the two new props:

```jsx
        signOffExpired={signOffExpired}
        daysSinceSignOff={daysSinceSignOff}
```

Also update the destructuring of `useStalenessData` to include the new returns. Find the line that looks like:

```javascript
  const { stalenessMap, staleCount } = useStalenessData({...});
```

Change to:

```javascript
  const { stalenessMap, staleCount, signOffExpired, daysSinceSignOff } = useStalenessData({...});
```

- [ ] **Step 4: Verify the banner renders in the browser**

Open a customer that hasn't been signed off in 30+ days. Confirm the amber/red banner appears.

- [ ] **Step 5: Commit**

```bash
git add apps/lootit/src/components/lootit/CustomerDetailHeaderCard.jsx apps/lootit/src/components/lootit/LootITCustomerDetail.jsx
git commit -m "feat(lootit): add reconciliation due banner to customer detail header"
```

---

### Task 7: Add "Due" Column and Filter to Global Dashboard

**Files:**
- Modify: `apps/lootit/src/components/lootit/LootITDashboard.jsx`

- [ ] **Step 1: Fetch sign-off data for all customers**

The dashboard already queries `all_sign_offs` (the signed-off customer IDs). We need the actual `signed_at` dates. Find the sign-off query (look for `signedOffCustomerIds` or `all_sign_offs`). Read that section first.

Around line 36-60, find the sign-off query. We need to also store the `signed_at` date per customer. After the existing sign-off query, build a map:

```javascript
  const signOffDateMap = useMemo(() => {
    const map = {};
    for (const so of (signOffs || [])) {
      map[so.customer_id] = so.signed_at;
    }
    return map;
  }, [signOffs]);
```

- [ ] **Step 2: Add "due" filter to FILTERS array**

Change the FILTERS array at line 16:

```javascript
const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'due', label: 'Due' },
  { key: 'issues', label: 'Issues' },
  { key: 'matched', label: 'Matched' },
  { key: 'signed_off', label: 'Signed Off' },
  { key: 'pending', label: 'Pending' },
];
```

- [ ] **Step 3: Add "due" filter logic**

In the filter logic around line 103-111, add the due case. A customer is "due" when their sign-off is 30+ days old or they've never been signed off:

```javascript
      if (filter === 'due') {
        const signedAt = signOffDateMap[entry.customer.id];
        if (!signedAt) return true; // never signed off = due
        const days = Math.floor((Date.now() - new Date(signedAt).getTime()) / (1000 * 60 * 60 * 24));
        return days >= 30;
      }
```

- [ ] **Step 4: Add "Due" column to the table**

Add a new `<th>` header after the "Issues" column header (around line 284):

```jsx
                <th className="text-center px-3 py-2 w-20">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Due</span>
                </th>
```

Add the corresponding `<td>` in the row rendering (after the issues td, around line 376):

```jsx
                    {/* Due badge */}
                    <td className="px-3 py-2 text-center">
                      {(() => {
                        const signedAt = signOffDateMap[customer.id];
                        if (!signedAt) {
                          return (
                            <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">
                              Never
                            </span>
                          );
                        }
                        const days = Math.floor((Date.now() - new Date(signedAt).getTime()) / (1000 * 60 * 60 * 24));
                        if (days >= 45) {
                          return (
                            <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">
                              {days}d
                            </span>
                          );
                        }
                        if (days >= 30) {
                          return (
                            <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                              {days}d
                            </span>
                          );
                        }
                        return <span className="text-slate-300">—</span>;
                      })()}
                    </td>
```

- [ ] **Step 5: Verify in browser**

Open the global LootIT dashboard. Confirm:
- "Due" filter appears and filters correctly
- "Due" column shows days overdue with correct color coding

- [ ] **Step 6: Commit**

```bash
git add apps/lootit/src/components/lootit/LootITDashboard.jsx
git commit -m "feat(lootit): add Due column and filter to global dashboard"
```

---

### Task 8: Create Telegram Utility

**Files:**
- Create: `server/src/lib/telegram.js`

- [ ] **Step 1: Create the telegram utility module**

```javascript
const TELEGRAM_API = 'https://api.telegram.org';

export function isTelegramConfigured() {
  return !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
}

export async function sendTelegramMessage(text, options = {}) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = options.chatId || process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.warn('[Telegram] TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set — skipping');
    return { success: false, skipped: true };
  }

  const url = `${TELEGRAM_API}/bot${token}/sendMessage`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error('[Telegram] Send failed:', res.status, body);
    return { success: false, error: body };
  }

  return { success: true };
}
```

- [ ] **Step 2: Commit**

```bash
git add server/src/lib/telegram.js
git commit -m "feat: add Telegram Bot API utility module"
```

---

### Task 9: Create Reconciliation Reminders Cron Job

**Files:**
- Create: `server/src/functions/reconciliationReminders.js`
- Modify: `server/src/scheduled.js`

- [ ] **Step 1: Create the cron function**

```javascript
import { getServiceSupabase } from '../lib/supabase.js';
import { sendTelegramMessage, isTelegramConfigured } from '../lib/telegram.js';

const SIGN_OFF_EXPIRY_DAYS = 30;
const REMINDER_COOLDOWN_DAYS = 7;
const EXCLUSION_STALE_DAYS = 90;
const LOOTIT_URL = process.env.LOOTIT_URL || 'https://lootit.gtools.io';

export async function reconciliationReminders(_body, _user) {
  if (!isTelegramConfigured()) {
    return { success: true, message: 'Telegram not configured — skipping', sent: 0 };
  }

  const supabase = getServiceSupabase();
  const now = new Date();
  const expiryThreshold = new Date(now - SIGN_OFF_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const cooldownThreshold = new Date(now - REMINDER_COOLDOWN_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const exclusionThreshold = new Date(now - EXCLUSION_STALE_DAYS * 24 * 60 * 60 * 1000).toISOString();

  // Get all customers
  const { data: customers, error: custErr } = await supabase
    .from('customers')
    .select('id, name')
    .eq('active', true);

  if (custErr) return { success: false, error: custErr.message };

  // Get latest sign-off per customer
  const { data: signOffs } = await supabase
    .from('reconciliation_sign_offs')
    .select('customer_id, signed_at, reminder_sent_at')
    .eq('status', 'signed_off')
    .order('signed_at', { ascending: false });

  const latestSignOffMap = {};
  for (const so of (signOffs || [])) {
    if (!latestSignOffMap[so.customer_id]) {
      latestSignOffMap[so.customer_id] = so;
    }
  }

  // Get force-matched and exclusion reviews
  const { data: activeReviews } = await supabase
    .from('reconciliation_reviews')
    .select('customer_id, rule_id, status, exclusion_count, exclusion_verified_at, reviewed_at');

  const reviewsByCustomer = {};
  for (const r of (activeReviews || [])) {
    if (!reviewsByCustomer[r.customer_id]) reviewsByCustomer[r.customer_id] = [];
    reviewsByCustomer[r.customer_id].push(r);
  }

  let sent = 0;
  let skipped = 0;
  const dueCustomers = [];

  for (const customer of (customers || [])) {
    const signOff = latestSignOffMap[customer.id];
    const signedAt = signOff?.signed_at ? new Date(signOff.signed_at) : null;
    const daysSinceSignOff = signedAt
      ? Math.floor((now - signedAt) / (1000 * 60 * 60 * 24))
      : null;

    const isDue = daysSinceSignOff === null || daysSinceSignOff >= SIGN_OFF_EXPIRY_DAYS;
    if (!isDue) continue;

    // Check cooldown — don't re-notify within 7 days
    if (signOff?.reminder_sent_at && signOff.reminder_sent_at > cooldownThreshold) {
      skipped++;
      continue;
    }

    const reviews = reviewsByCustomer[customer.id] || [];
    const forceMatchedCount = reviews.filter((r) => r.status === 'force_matched').length;
    const staleExclusionCount = reviews.filter((r) =>
      r.exclusion_count > 0 &&
      (!r.exclusion_verified_at || r.exclusion_verified_at < exclusionThreshold)
    ).length;

    // Skip customers with no active reviews at all (no rules set up)
    if (reviews.length === 0 && daysSinceSignOff === null) {
      skipped++;
      continue;
    }

    dueCustomers.push({
      name: customer.name,
      id: customer.id,
      daysSinceSignOff,
      forceMatchedCount,
      staleExclusionCount,
      signOffId: signOff?.id,
    });
  }

  if (dueCustomers.length === 0) {
    return { success: true, message: 'No customers due for reconciliation', sent: 0, skipped };
  }

  // Build and send Telegram message
  const lines = ['<b>LootIT — Reconciliation Due</b>', ''];

  for (const c of dueCustomers) {
    const parts = [`<b>${c.name}</b>`];
    if (c.daysSinceSignOff === null) {
      parts.push('Never signed off');
    } else {
      parts.push(`Last signed off ${c.daysSinceSignOff}d ago`);
    }
    if (c.forceMatchedCount > 0) {
      parts.push(`${c.forceMatchedCount} force-matched`);
    }
    if (c.staleExclusionCount > 0) {
      parts.push(`${c.staleExclusionCount} stale exclusions`);
    }
    lines.push(parts.join(' · '));
  }

  lines.push('');
  lines.push(`<a href="${LOOTIT_URL}">Open LootIT</a>`);

  const result = await sendTelegramMessage(lines.join('\n'));

  if (result.success) {
    sent = dueCustomers.length;
    // Update reminder_sent_at for dedup
    for (const c of dueCustomers) {
      if (c.signOffId) {
        await supabase
          .from('reconciliation_sign_offs')
          .update({ reminder_sent_at: now.toISOString() })
          .eq('id', c.signOffId);
      }
    }
  }

  return {
    success: true,
    message: `Sent reminder for ${sent} customers (${skipped} skipped/cooldown)`,
    sent,
    skipped,
    dueCustomers: dueCustomers.map((c) => c.name),
  };
}
```

- [ ] **Step 2: Register in scheduled.js**

Add the import at the top of `server/src/scheduled.js`:

```javascript
import { reconciliationReminders } from './functions/reconciliationReminders.js';
```

Add to the `CRON_JOBS` array (after the `expireReconciliationReviews` entry, line 53):

```javascript
  { name: 'reconciliationReminders', label: 'Reconciliation Reminders', description: 'Telegram alerts for customers due for reconciliation', schedule: '0 12 * * *', category: 'lootit', fn: reconciliationReminders, action: 'remind' },
```

Note: `0 12 * * *` = noon UTC = 7 AM CT.

- [ ] **Step 3: Verify server starts without errors**

Run: `cd /Users/anielreyes/portalit && npm run dev` (server side)

Expected: No import errors, cron job registered in the console log.

- [ ] **Step 4: Commit**

```bash
git add server/src/functions/reconciliationReminders.js server/src/scheduled.js
git commit -m "feat(lootit): add daily reconciliation reminder cron with Telegram notifications"
```

---

### Task 10: Update Sign-Off AI Verification

**Files:**
- Modify: `server/src/functions/verifyReconciliation.js`

- [ ] **Step 1: Read the current verify action to find the AI prompt section**

Read `server/src/functions/verifyReconciliation.js` and find where the AI system prompt is constructed (around lines 69-97 where the rules are listed).

- [ ] **Step 2: Add force-match and exclusion staleness context to the AI prompt**

In the AI verification prompt, after the existing rules, add:

```
8. Force-matched items that haven't been re-verified in 30+ days should be flagged as WARNINGS — they may have drifted from original approval.
9. Exclusions older than 90 days without re-verification should be flagged as WARNINGS — the excluded accounts may no longer be valid.
```

- [ ] **Step 3: Commit**

```bash
git add server/src/functions/verifyReconciliation.js
git commit -m "feat(lootit): add force-match and exclusion staleness warnings to AI verification"
```

---

### Task 11: End-to-End Verification

- [ ] **Step 1: Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID env vars**

Add to the server's `.env` file (or Railway environment):
```
TELEGRAM_BOT_TOKEN=<your-bot-token>
TELEGRAM_CHAT_ID=<your-chat-id>
```

- [ ] **Step 2: Test the reconciliation reminders cron manually**

From the admin dashboard or via API, trigger `reconciliationReminders` manually. Verify:
- Customers due for reconciliation are identified
- Telegram message is received
- `reminder_sent_at` is updated
- Re-running within 7 days skips previously notified customers

- [ ] **Step 3: Verify UI end-to-end**

1. Open global dashboard — confirm "Due" column shows correct data
2. Click "Due" filter — confirm only overdue customers show
3. Open a customer that's 30+ days since sign-off — confirm amber banner
4. Open a customer 45+ days — confirm red banner
5. Check force-matched tiles on expired customer — confirm orange "Re-verify" badge
6. Check tile with old exclusion — confirm amber "Exclusion Stale" badge
7. Click sign-off on an expired customer — confirm AI mentions force-match/exclusion warnings

- [ ] **Step 4: Commit any fixes from testing**

```bash
git add -A
git commit -m "fix(lootit): adjustments from end-to-end verification"
```
