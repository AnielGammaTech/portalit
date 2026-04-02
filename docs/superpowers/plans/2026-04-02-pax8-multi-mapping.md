# Pax8 Multi-Subscription Mapping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow mapping one PSA line item to multiple Pax8 subscriptions, comparing PSA qty against their combined vendor total. Grouped subs show as a collapsed combined card that expands to show individual subs.

**Architecture:** Add `group_id` column to `pax8_line_item_overrides`. Replace the single-select `LineItemPicker` with a new `Pax8GroupMapper` modal that shows a PSA line item selector + Pax8 sub checkboxes. Modify `reconcilePax8Subscriptions()` to detect grouped overrides and merge their vendor quantities into combined results.

**Tech Stack:** React, Supabase PostgreSQL, TanStack React Query

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `src/components/lootit/Pax8GroupMapper.jsx` | Modal for mapping PSA line to multiple Pax8 subs |
| Modify | `src/lib/lootit-reconciliation.js:396-481` | Group detection + merge in reconcilePax8Subscriptions |
| Modify | `src/components/lootit/LootITCustomerDetail.jsx:196-221` | Wire up new mapping modal + group-aware save/remove |
| Modify | `src/components/lootit/Pax8SubscriptionCard.jsx` | Collapsed/expanded group display |

---

### Task 1: Database Migration

- [ ] **Step 1: Create migration file**

Create `supabase/migrations/20260402_add_pax8_group_id.sql`:

```sql
ALTER TABLE pax8_line_item_overrides ADD COLUMN IF NOT EXISTS group_id TEXT;
CREATE INDEX IF NOT EXISTS idx_pax8_overrides_group ON pax8_line_item_overrides(group_id) WHERE group_id IS NOT NULL;
```

- [ ] **Step 2: Tell user to run the SQL in Supabase**

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260402_add_pax8_group_id.sql
git commit -m "feat: add group_id to pax8_line_item_overrides for multi-sub mapping"
```

---

### Task 2: Pax8GroupMapper Modal

**Files:**
- Create: `src/components/lootit/Pax8GroupMapper.jsx`

- [ ] **Step 1: Create the modal component**

```jsx
// src/components/lootit/Pax8GroupMapper.jsx
import React, { useState, useMemo } from 'react';
import { Search, Check, Link2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatLineItemDescription } from '@/lib/utils';

export default function Pax8GroupMapper({ pax8Recons, lineItems, existingOverrides, onSave, onClose }) {
  const [search, setSearch] = useState('');
  const [selectedLineItem, setSelectedLineItem] = useState(null);
  const [selectedSubs, setSelectedSubs] = useState(new Set());

  // Filter line items with qty > 0
  const filteredLineItems = useMemo(() => {
    const q = search.toLowerCase().trim();
    const items = lineItems.filter(li => li.description && li.quantity > 0);
    if (!q) return items;
    return items.filter(li => (li.description || '').toLowerCase().includes(q));
  }, [lineItems, search]);

  // All Pax8 subs available for mapping
  const allSubs = useMemo(() => {
    return pax8Recons.map(r => ({
      ruleId: r.ruleId,
      name: r.productName,
      subscriptionId: r.subscriptionId,
      vendorQty: r.vendorQty,
      billingTerm: r.billingTerm,
      price: r.price,
      // Check if already mapped to something
      isMapped: existingOverrides.some(o => o.rule_id === r.ruleId),
    }));
  }, [pax8Recons, existingOverrides]);

  const toggleSub = (ruleId) => {
    setSelectedSubs(prev => {
      const next = new Set(prev);
      if (next.has(ruleId)) next.delete(ruleId);
      else next.add(ruleId);
      return next;
    });
  };

  const combinedVendorQty = useMemo(() => {
    return allSubs.filter(s => selectedSubs.has(s.ruleId)).reduce((sum, s) => sum + (s.vendorQty || 0), 0);
  }, [allSubs, selectedSubs]);

  const selectedPsaQty = selectedLineItem ? (parseFloat(selectedLineItem.quantity) || 0) : 0;

  const handleSave = () => {
    if (!selectedLineItem || selectedSubs.size === 0) return;
    onSave(selectedLineItem.id, [...selectedSubs]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden mx-4" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="font-semibold text-slate-900 text-sm">Map PSA Line Item to Pax8 Subscriptions</h3>
          <p className="text-xs text-slate-500 mt-1">Select a PSA billing line, then check which Pax8 subscriptions it covers</p>
        </div>

        <div className="grid grid-cols-2 divide-x divide-slate-200" style={{ maxHeight: '60vh' }}>
          {/* Left: PSA Line Items */}
          <div className="flex flex-col">
            <div className="px-4 py-2 border-b border-slate-100">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">1. Select PSA Line Item</p>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-300"
                  autoFocus
                />
              </div>
            </div>
            <div className="overflow-y-auto flex-1" style={{ maxHeight: '45vh' }}>
              {filteredLineItems.map(li => (
                <button
                  key={li.id}
                  onClick={() => setSelectedLineItem(li)}
                  className={cn(
                    'w-full text-left px-4 py-2.5 border-b border-slate-50 transition-colors text-xs',
                    selectedLineItem?.id === li.id ? 'bg-blue-50 border-l-2 border-l-blue-500' : 'hover:bg-slate-50'
                  )}
                >
                  <p className="font-medium text-slate-700 truncate">{formatLineItemDescription(li.description)}</p>
                  <p className="text-slate-400 mt-0.5">Qty: {li.quantity}{li.total > 0 ? ` · $${parseFloat(li.total).toFixed(2)}` : ''}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Right: Pax8 Subscriptions */}
          <div className="flex flex-col">
            <div className="px-4 py-2 border-b border-slate-100">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">2. Check Pax8 Subscriptions</p>
            </div>
            <div className="overflow-y-auto flex-1" style={{ maxHeight: '45vh' }}>
              {allSubs.map(sub => {
                const isChecked = selectedSubs.has(sub.ruleId);
                return (
                  <button
                    key={sub.ruleId}
                    onClick={() => toggleSub(sub.ruleId)}
                    className={cn(
                      'w-full text-left px-4 py-2.5 border-b border-slate-50 transition-colors text-xs flex items-center gap-2',
                      isChecked ? 'bg-emerald-50' : 'hover:bg-slate-50'
                    )}
                  >
                    <div className={cn(
                      'w-4 h-4 rounded border flex items-center justify-center shrink-0',
                      isChecked ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300'
                    )}>
                      {isChecked && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-700 truncate">{sub.name}</p>
                      <p className="text-slate-400 mt-0.5">
                        Qty: {sub.vendorQty}
                        {sub.billingTerm ? ` · ${sub.billingTerm}` : ''}
                        {sub.price > 0 ? ` · $${parseFloat(sub.price).toFixed(2)}` : ''}
                      </p>
                    </div>
                    {sub.isMapped && <span className="text-[9px] text-blue-400 shrink-0">mapped</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer with preview */}
        <div className="px-6 py-3 border-t border-slate-200 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            {selectedSubs.size > 0 && selectedLineItem ? (
              <span>
                PSA: <strong className="text-slate-700">{selectedPsaQty}</strong> vs
                Pax8: <strong className="text-slate-700">{combinedVendorQty}</strong>
                ({selectedSubs.size} sub{selectedSubs.size !== 1 ? 's' : ''})
                {selectedPsaQty === combinedVendorQty ? (
                  <span className="text-emerald-600 font-semibold ml-1">Match</span>
                ) : (
                  <span className="text-red-500 font-semibold ml-1">
                    {selectedPsaQty > combinedVendorQty ? 'Over' : 'Under'} by {Math.abs(selectedPsaQty - combinedVendorQty)}
                  </span>
                )}
              </span>
            ) : (
              <span className="text-slate-400">Select a line item and check subscriptions</span>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-xs font-medium rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors">Cancel</button>
            <button
              onClick={handleSave}
              disabled={!selectedLineItem || selectedSubs.size === 0}
              className="px-4 py-2 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Link2 className="w-3.5 h-3.5 inline mr-1.5" />
              Map {selectedSubs.size} Sub{selectedSubs.size !== 1 ? 's' : ''}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `cd /Users/anielreyes/portalit && npx vite build`

- [ ] **Step 3: Commit**

```bash
git add src/components/lootit/Pax8GroupMapper.jsx
git commit -m "feat: Pax8GroupMapper modal — select PSA line + check multiple Pax8 subs"
```

---

### Task 3: Wire Up Group Mapping in LootITCustomerDetail

**Files:**
- Modify: `src/components/lootit/LootITCustomerDetail.jsx`

- [ ] **Step 1: Import Pax8GroupMapper**

Add after the other lootit imports:

```javascript
import Pax8GroupMapper from './Pax8GroupMapper';
```

- [ ] **Step 2: Add group mapping state**

After the existing `mappingRecon` state (line 40), add:

```javascript
const [showGroupMapper, setShowGroupMapper] = useState(false);
```

- [ ] **Step 3: Replace handleSaveMapping to support groups**

Replace the existing `handleSaveMapping` function (lines 196-206) with:

```javascript
  const handleSaveMapping = async (ruleId, productName, lineItemId) => {
    await client.entities.Pax8LineItemOverride.create({
      customer_id: customer.id,
      rule_id: ruleId,
      pax8_product_name: productName || null,
      line_item_id: lineItemId,
    });
    await queryClient.invalidateQueries({ queryKey: ['pax8_line_item_overrides', customer.id] });
    await queryClient.invalidateQueries({ queryKey: ['pax8_line_item_overrides_all'] });
    setMappingRecon(null);
  };

  const handleSaveGroupMapping = async (lineItemId, ruleIds) => {
    const groupId = crypto.randomUUID();
    for (const ruleId of ruleIds) {
      // Remove any existing overrides for this rule
      const existing = existingOverrides.filter(o => o.rule_id === ruleId);
      for (const ov of existing) {
        await client.entities.Pax8LineItemOverride.delete(ov.id);
      }
      // Create new override with group_id
      await client.entities.Pax8LineItemOverride.create({
        customer_id: customer.id,
        rule_id: ruleId,
        line_item_id: lineItemId,
        group_id: groupId,
      });
    }
    await queryClient.invalidateQueries({ queryKey: ['pax8_line_item_overrides', customer.id] });
    await queryClient.invalidateQueries({ queryKey: ['pax8_line_item_overrides_all'] });
    setShowGroupMapper(false);
  };
```

- [ ] **Step 4: Add "Group Map" button above the Pax8 section**

Find the "Pax8 / M365 Licence Reconciliation" heading and add a button:

Replace:
```jsx
          <h3 className="text-sm font-semibold text-slate-700">
            Pax8 / M365 Licence Reconciliation
          </h3>
```

With:
```jsx
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700">
              Pax8 / M365 Licence Reconciliation
            </h3>
            <button
              onClick={() => setShowGroupMapper(true)}
              className="text-[10px] font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors"
            >
              <Link2 className="w-3 h-3" />
              Group Map
            </button>
          </div>
```

- [ ] **Step 5: Render Pax8GroupMapper modal**

Before the closing `</div>` of the component (right after the LineItemPicker), add:

```jsx
      {showGroupMapper && (
        <Pax8GroupMapper
          pax8Recons={pax8Recons}
          lineItems={allLineItems}
          existingOverrides={existingOverrides}
          onSave={handleSaveGroupMapping}
          onClose={() => setShowGroupMapper(false)}
        />
      )}
```

- [ ] **Step 6: Verify build and commit**

```bash
npx vite build
git add src/components/lootit/LootITCustomerDetail.jsx
git commit -m "feat: wire up Pax8 group mapping modal with group_id support"
```

---

### Task 4: Reconciliation Engine — Group Merging

**Files:**
- Modify: `src/lib/lootit-reconciliation.js:396-481`

- [ ] **Step 1: Add group merging after individual results are built**

In `reconcilePax8Subscriptions()`, after the `for (const product of products)` loop ends (after line 471) and before the `pax8MatchedLineItemIds` collection (line 473), insert:

```javascript
  // ── Group merge: combine results that share a group_id ──
  const groupMap = {};
  for (const ov of overrides) {
    if (ov.group_id) {
      if (!groupMap[ov.group_id]) groupMap[ov.group_id] = [];
      groupMap[ov.group_id].push(ov.rule_id);
    }
  }

  // For each group, merge individual results into one combined result
  const groupedRuleIds = new Set();
  const mergedResults = [];

  for (const [groupId, ruleIds] of Object.entries(groupMap)) {
    if (ruleIds.length < 2) continue; // Not a real group
    const groupResults = results.filter(r => ruleIds.includes(r.ruleId));
    if (groupResults.length === 0) continue;

    // Mark these as grouped so they don't appear individually
    for (const r of groupResults) groupedRuleIds.add(r.ruleId);

    // Combine vendor quantities
    const combinedVendorQty = groupResults.reduce((sum, r) => sum + (r.vendorQty || 0), 0);
    const matched = groupResults[0].matchedLineItems || [];
    const psaQty = matched.reduce((sum, li) => sum + (parseFloat(li.quantity) || 0), 0);
    const difference = psaQty !== null ? psaQty - combinedVendorQty : 0;

    let status = 'missing_from_psa';
    if (matched.length > 0) {
      if (difference === 0) status = 'match';
      else if (difference > 0) status = 'over';
      else status = 'under';
    }

    mergedResults.push({
      ruleId: `group:${groupId}`,
      groupId,
      productName: groupResults.map(r => r.productName).filter((v, i, a) => a.indexOf(v) === i).join(' + '),
      vendorQty: combinedVendorQty,
      totalVendorQty: combinedVendorQty,
      psaQty: matched.length > 0 ? psaQty : null,
      difference,
      status,
      matchedLineItems: matched,
      billingTerm: '',
      price: groupResults.reduce((sum, r) => sum + (r.price || 0), 0),
      startDate: null,
      review: groupResults[0].review,
      integrationLabel: 'Pax8',
      isGroup: true,
      groupSubs: groupResults,
    });
  }

  // Replace individual results with merged groups + ungrouped individuals
  const finalResults = [
    ...mergedResults,
    ...results.filter(r => !groupedRuleIds.has(r.ruleId)),
  ];
```

- [ ] **Step 2: Update the return to use finalResults**

Replace:
```javascript
  // Collect all matched line item IDs from Pax8 reconciliations
  for (const r of results) {
```

With:
```javascript
  // Collect all matched line item IDs from Pax8 reconciliations
  const outputResults = finalResults.length > 0 ? finalResults : results;
  for (const r of outputResults) {
```

And replace:
```javascript
  results._pax8MatchedLineItemIds = pax8MatchedLineItemIds;
  return results;
```

With:
```javascript
  outputResults._pax8MatchedLineItemIds = pax8MatchedLineItemIds;
  return outputResults;
```

- [ ] **Step 3: Verify module loads and commit**

```bash
node -e "import('./src/lib/lootit-reconciliation.js').then(() => console.log('OK')).catch(e => console.error(e.message))"
git add src/lib/lootit-reconciliation.js
git commit -m "feat: reconciliation engine merges grouped Pax8 subs into combined results"
```

---

### Task 5: Pax8SubscriptionCard — Group Display

**Files:**
- Modify: `src/components/lootit/Pax8SubscriptionCard.jsx`

- [ ] **Step 1: Add group collapsed/expanded rendering**

At the top of the component, after destructuring props, add:

```javascript
  const [expanded, setExpanded] = useState(false);
  const isGroup = recon.isGroup && recon.groupSubs?.length > 0;
```

- [ ] **Step 2: Add group header to the card**

In the card title area, after the product name, add group indicator:

Find where `productName` is rendered and after it add:

```jsx
{isGroup && (
  <span className="text-[9px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full font-medium ml-1">
    {recon.groupSubs.length} subs
  </span>
)}
```

- [ ] **Step 3: Add expandable sub-list below the card numbers**

After the numbers section (PSA vs VENDOR), add:

```jsx
{isGroup && (
  <div className="mb-2">
    <button
      onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
      className="text-[10px] text-blue-500 hover:text-blue-700 font-medium"
    >
      {expanded ? 'Hide' : 'Show'} individual subs
    </button>
    {expanded && (
      <div className="mt-1.5 space-y-1 pl-2 border-l-2 border-blue-200">
        {recon.groupSubs.map(sub => (
          <div key={sub.ruleId} className="text-[10px] text-slate-500 flex justify-between">
            <span className="truncate">{sub.productName}</span>
            <span className="font-medium text-slate-600 shrink-0 ml-2">qty {sub.vendorQty}</span>
          </div>
        ))}
      </div>
    )}
  </div>
)}
```

- [ ] **Step 4: Verify build and commit**

```bash
npx vite build
git add src/components/lootit/Pax8SubscriptionCard.jsx
git commit -m "feat: Pax8 cards show collapsed/expanded group display with sub breakdown"
```

---

### Task 6: Manual Verification

- [ ] **Step 1: Run the SQL migration**

User runs in Supabase:
```sql
ALTER TABLE pax8_line_item_overrides ADD COLUMN IF NOT EXISTS group_id TEXT;
CREATE INDEX IF NOT EXISTS idx_pax8_overrides_group ON pax8_line_item_overrides(group_id) WHERE group_id IS NOT NULL;
```

- [ ] **Step 2: Test the flow**

1. Open a customer in LootIT with Pax8 data
2. Click "Group Map" above the Pax8 section
3. Select a PSA line item on the left
4. Check 2+ Pax8 subs on the right
5. Verify the footer shows combined qty comparison
6. Click "Map 2 Subs"
7. Verify the grouped subs now show as one combined card
8. Click "Show individual subs" to expand
9. Verify unmap removes the entire group
