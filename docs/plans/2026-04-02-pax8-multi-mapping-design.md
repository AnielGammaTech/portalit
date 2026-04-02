# Pax8 Multi-Subscription Mapping Design

## Problem

Currently, one PSA line item can only map to one Pax8 subscription. When a customer has multiple Pax8 subs for the same product (e.g., monthly + annual, or two tiers), the reconciliation can't compare the PSA qty against their combined vendor total.

## Solution

Allow mapping one PSA line item to multiple Pax8 subscriptions. Grouped subs share a `group_id` and their vendor quantities are combined for reconciliation.

## Data Model

Add `group_id` to existing `pax8_line_item_overrides` table:

```sql
ALTER TABLE pax8_line_item_overrides ADD COLUMN IF NOT EXISTS group_id TEXT;
```

- Multiple overrides with the same `group_id` = grouped subs
- No `group_id` = solo mapping (backward compatible)

## Mapping Flow

1. Click PSA line item in reconciliation view
2. Modal shows all Pax8 subs for this customer with checkboxes
3. User checks subs to group → hits "Map"
4. Creates one override record per checked sub, all sharing a generated `group_id` (UUID)
5. Existing single mappings continue to work unchanged

## Display

### Collapsed (default)
- Single combined card: "Product Name (N subs)"
- Combined vendor qty vs PSA qty
- Chain link icon indicating grouped mapping
- Unmap button removes entire group

### Expanded (click)
- Individual sub cards underneath showing:
  - Individual vendor qty
  - Billing term, price, start date
  - Option to remove individual sub from group

## Reconciliation Engine Changes

In `reconcilePax8Subscriptions()` (lootit-reconciliation.js):

1. After building individual results, collect all overrides with a `group_id`
2. Group results by `group_id`
3. For each group: merge into single result with `vendorQty = sum of all grouped subs`
4. PSA qty comes from the shared matched line item
5. Un-grouped results pass through unchanged

## Key Files

- `src/lib/lootit-reconciliation.js` — reconciliation engine
- `src/components/lootit/Pax8SubscriptionCard.jsx` — card display
- `src/components/lootit/LootITCustomerDetail.jsx` — mapping flow + modal
- `pax8_line_item_overrides` table — data model
