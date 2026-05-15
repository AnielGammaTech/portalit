# LootIT Reconciliation Reminders & Visibility

**Date:** 2026-04-20
**Status:** Approved

## Problem

LootIT has no proactive notification system. Users must remember to reconcile customers, manually check if force-matched items have drifted, and have no visibility into stale exclusions. This leads to customers going months without reconciliation, force-matched items becoming inaccurate, and free/excluded accounts never being re-verified.

## Solution

Three features built on the existing staleness infrastructure:

1. **Sign-Off Reminders** — notify when a customer is due for reconciliation (30 days since last sign-off)
2. **Force-Match Alerts** — flag force-matched tiles that need re-verification on the same 30-day sign-off cycle
3. **Exclusion Staleness** — flag tiles with exclusions older than 90 days without re-verification

All three surface as in-app badges/banners plus Telegram notifications via a daily cron.

## Design Decisions

- **Reminders follow sign-off expiry (30 days)**, not a fixed calendar schedule. Each customer's clock starts from their last sign-off date.
- **Force-matched alerts share the sign-off cadence** rather than having their own shorter timer. When a customer is due for reconciliation, force-matched items are highlighted as needing extra attention.
- **Exclusion staleness lives at the tile level**, not the global dashboard. Stale exclusions are flagged on reconciliation tiles and during sign-off verification.
- **Notifications go to Telegram** via a Supabase Edge Function on a daily cron. In-app badges are always visible.

---

## Feature 1: Sign-Off Reminders

### Trigger Logic

A customer needs reconciliation when:
- They have never been signed off, OR
- Their last sign-off is older than 30 days

### Data Source

Query `reconciliation_sign_offs` for the latest `signed_at` per customer where `status = 'signed_off'`. Compare against `now()`.

### UI Changes

**Global Dashboard (`LootITDashboard.jsx`):**
- New column/badge: "Due" with days overdue (e.g., "12d overdue")
- New filter option: "Due" to show only customers needing reconciliation
- Color coding: amber for 30-45 days, red for 45+ days

**Customer Detail Header (`CustomerDetailHeaderCard.jsx`):**
- Banner below header when reconciliation is due: "Reconciliation due — last signed off 42 days ago"
- Amber/red based on severity

### Notification

Daily cron checks all customers. For each customer due:
- Send Telegram message: "[LootIT] {customer_name} reconciliation due — last signed off {X} days ago. {force_matched_count} force-matched items need review."
- Track `reminder_sent_at` on sign-off record to avoid duplicate daily messages (only re-notify after 7 days)

---

## Feature 2: Force-Match Alerts

### Trigger Logic

When a customer's sign-off is expired (30+ days), any tile with `review.status = 'force_matched'` gets an additional "needs re-verification" flag.

### UI Changes

**Reconciliation Tiles (ServiceCard.jsx / Pax8SubscriptionCard.jsx):**
- Orange "Re-verify" badge on force-matched tiles when sign-off is expired
- Tooltip: "Force-matched {X} days ago — quantities may have changed"

**Filter Tabs (CustomerDetailReconciliationTab.jsx):**
- Existing "Stale" filter already captures these via `useStalenessData`
- Ensure force-matched items with expired sign-offs appear in the stale count

**Sign-Off Verification:**
- AI verification (`verifyReconciliation`) already checks force-matched items
- Add explicit warning: "{N} force-matched items haven't been re-verified in {X} days"

### Data Changes

No new columns needed — `useStalenessData` already computes staleness for force-matched items based on `reviewed_at` vs sign-off date. The hook just needs to also consider sign-off expiry (30 days from `signed_at`) as a staleness trigger.

---

## Feature 3: Exclusion Staleness

### Trigger Logic

A tile's exclusions are stale when:
- The tile has `exclusion_count > 0`
- AND the exclusion was last set/verified more than 90 days ago

### Data Changes

**New column on `reconciliation_reviews`:**
- `exclusion_verified_at` (TIMESTAMPTZ) — set when exclusion is created or explicitly re-verified
- Defaults to `created_date` for existing exclusions (migration backfill)

**New action in `useReconciliationReviews`:**
- `reVerifyExclusion(ruleId)` — updates `exclusion_verified_at` to now, logs to history with action `'exclusion_reverified'`

### UI Changes

**Reconciliation Tiles:**
- Amber "Exclusion stale" badge when exclusion is 90+ days old
- Shows: "{exclusion_count} excluded — last verified {X} days ago"
- "Re-verify" button that confirms exclusions are still valid and resets the timer

**useStalenessData expansion:**
- Add `exclusionStale: boolean` and `exclusionDaysSinceVerified: number` to staleness map
- Include in `staleCount` total

**Sign-Off Verification:**
- AI verification flags stale exclusions as warnings (not blockers): "{N} exclusions haven't been verified in 90+ days"

---

## Shared Infrastructure

### Expanded `useStalenessData` Hook

Currently tracks:
- Review staleness (reviewed_at vs sign-off date)
- Change detection (PSA/vendor qty drift from snapshot)

Add:
- **Sign-off expiry**: `signOffExpired: boolean`, `daysSinceSignOff: number`
- **Exclusion staleness**: `exclusionStale: boolean`, `exclusionDaysSinceVerified: number`
- **Combined stale reasons**: array of reasons why a tile is flagged (e.g., `['sign_off_expired', 'force_match_stale', 'exclusion_stale']`)

### Supabase Edge Function: `reconciliationReminders`

**Schedule:** Daily at 7:00 AM CT (via Supabase cron / pg_cron)

**Logic:**
1. Query all customers with their latest sign-off
2. Filter to customers where sign-off is 30+ days old (or never signed off with active rules)
3. For each due customer:
   - Count force-matched items
   - Count stale exclusions (90+ days)
   - Check if reminder was already sent in last 7 days (`reminder_sent_at`)
4. Send Telegram message per customer (or batched summary if many)
5. Update `reminder_sent_at`

**Telegram message format:**
```
LootIT Reconciliation Due

{customer_name}
Last signed off: {date} ({X} days ago)
{force_matched_count} force-matched items need review
{stale_exclusion_count} exclusions need re-verification

[Open in LootIT](https://lootit.gtools.io/customer/{id})
```

### Database Migration

```sql
-- Add exclusion verification tracking
ALTER TABLE reconciliation_reviews
ADD COLUMN IF NOT EXISTS exclusion_verified_at TIMESTAMPTZ;

-- Backfill existing exclusions
UPDATE reconciliation_reviews
SET exclusion_verified_at = COALESCE(updated_date, created_date)
WHERE exclusion_count > 0 AND exclusion_verified_at IS NULL;

-- Add reminder tracking to sign-offs
ALTER TABLE reconciliation_sign_offs
ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;
```

---

## Implementation Order

1. **Database migration** — add `exclusion_verified_at` and `reminder_sent_at` columns
2. **Expand `useStalenessData`** — add sign-off expiry and exclusion staleness
3. **UI badges/banners** — global dashboard "Due" column, customer header banner, tile badges
4. **Exclusion re-verify action** — new mutation in `useReconciliationReviews`
5. **Update sign-off verification** — AI flags force-match and exclusion staleness
6. **Supabase Edge Function** — daily cron for Telegram notifications
7. **Integration testing** — verify all staleness scenarios trigger correctly

## Success Criteria

- Customers overdue for reconciliation are visually flagged on the global dashboard
- Force-matched tiles show re-verify badges when sign-off is expired
- Tiles with 90+ day old exclusions are flagged
- Telegram notifications fire daily for due customers (max once per 7 days per customer)
- Existing staleness filter captures all three types
