# Dynamic Item-Level Exclusions

## Problem

Exclusions are currently a static number ("8 free accounts") subtracted from vendor quantity. If vendor data changes (accounts added/removed), the count becomes stale and causes under/over-billing. Operators have no visibility into which specific items are excluded.

## Solution

Replace the static count with a dynamic, item-level selection system. When vendor data includes individual items (users, devices, subscriptions), operators select exactly which ones are excluded. The count auto-calculates from selections. Items that disappear from vendor data are auto-dropped with an audit log.

## Database Schema

```sql
CREATE TABLE reconciliation_excluded_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL,
  rule_id TEXT NOT NULL,
  vendor_item_id TEXT NOT NULL,
  vendor_item_label TEXT NOT NULL,
  reason TEXT,
  excluded_by UUID,
  excluded_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(customer_id, rule_id, vendor_item_id)
);
```

- `vendor_item_id`: unique identifier from vendor (email, device name, subscription ID)
- `vendor_item_label`: human-readable display name
- `reason`: single note shared across all excluded items for this customer+rule
- Existing `exclusion_count`/`exclusion_reason` on `reconciliation_reviews` remains for count-only integrations

## Vendor Item Extractors

New utility: `extractVendorItems(integrationKey, cachedData)` returns `[{id, label, meta}]` or `null`.

Supported integrations (returns item array):
- `spanning`: users[] -> {id: email, label: "Name (email)"}
- `cove` / `cove_workstation` / `cove_server`: devices[] -> {id: deviceName, label: name}
- `unifi` / `unifi_firewall`: devices[] -> {id: mac/name, label: name}
- `datto_edr`: hosts[]/devices[] -> {id: hostname, label: hostname}
- `pax8`: products[].subscriptions[] -> {id: subscriptionId, label: productName}

Unsupported integrations (returns null, falls back to count input):
- jumpcloud, datto_rmm, rocket_cyber, threecx, inky, darkweb, bullphish

## UI Changes (DetailDrawer)

Hybrid "Excluded Accounts" section:

**Item-level mode** (when `extractVendorItems` returns items):
1. Searchable checklist of all vendor items
2. Already-excluded items shown checked at top
3. Single "reason" text input for the batch
4. Summary shows item labels when not editing

**Fallback mode** (when `extractVendorItems` returns null):
- Unchanged: number input + reason presets

## Reconciliation Logic

```
effectiveVendorQty = vendorQty - excludedItemCount
```

- Item-level: count of `reconciliation_excluded_items` rows whose `vendor_item_id` still exists in current vendor data
- Count-only: `review.exclusion_count` (unchanged)

**Dropped-item detection:**
1. Compare stored excluded items against current vendor items
2. Missing items logged to `reconciliation_review_history` with action `"exclusion_dropped"`
3. Dropped rows deleted from `reconciliation_excluded_items`
4. Only remaining items count toward subtraction

## Data Flow

```
useReconciliationData fetches excluded_items per customer
  -> passed into reconciliation or applied at display time
  -> compared against current vendor items from cached_data
  -> stale ones logged + removed
  -> remaining count subtracted from vendorQty
```

## Migration Path

- New table added via Supabase migration
- Existing `exclusion_count`/`exclusion_reason` fields preserved (fallback mode)
- No breaking changes to current behavior for count-only integrations
