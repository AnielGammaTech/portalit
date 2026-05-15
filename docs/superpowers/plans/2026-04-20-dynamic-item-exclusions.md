# Dynamic Item-Level Exclusions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace static exclusion counts with per-item selection for vendor integrations that expose item-level data, while preserving fallback number input for count-only integrations.

**Architecture:** New `reconciliation_excluded_items` table stores individual vendor items marked as excluded. A vendor item extractor utility pulls item-level data from each integration's `cached_data`. The `ExclusionSection` component in `ReconciliationDetailModal.jsx` becomes a hybrid: searchable checklist when items are available, number input when not. Reconciliation logic counts excluded items that still exist in current vendor data.

**Tech Stack:** React, Supabase (PostgreSQL), TanStack Query, Tailwind CSS, Lucide icons

---

## File Structure

| File | Responsibility |
|------|---------------|
| `supabase/migrations/20260420_add_excluded_items_table.sql` | Create the new table |
| `apps/lootit/src/lib/vendor-item-extractors.js` | Extract individual items from cached_data per integration |
| `apps/lootit/src/hooks/useExcludedItems.js` | CRUD hook for reconciliation_excluded_items |
| `apps/lootit/src/components/lootit/ExclusionSection.jsx` | New standalone component (hybrid: item picker or count fallback) |
| `apps/lootit/src/components/lootit/ReconciliationDetailModal.jsx` | Replace inline ExclusionSection with new component |
| `apps/lootit/src/components/lootit/LootITCustomerDetail.jsx` | Pass vendorMappings to modal |
| `apps/lootit/src/components/lootit/ServiceCard.jsx` | Update getEffectiveStatus to use item-level exclusion count |
| `apps/lootit/src/hooks/useReconciliationData.js` | Fetch excluded items alongside reviews |

---

### Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260420_add_excluded_items_table.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Dynamic item-level exclusions for LootIT reconciliation
-- Replaces static exclusion_count for integrations with item-level vendor data

CREATE TABLE IF NOT EXISTS reconciliation_excluded_items (
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

-- Index for fast lookups by customer + rule
CREATE INDEX idx_excluded_items_customer_rule
  ON reconciliation_excluded_items(customer_id, rule_id);

-- RLS: authenticated users can read/write
ALTER TABLE reconciliation_excluded_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage excluded items"
  ON reconciliation_excluded_items
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
```

- [ ] **Step 2: Apply migration locally**

Run: `cd /Users/anielreyes/portalit && npx supabase db push` or apply via Supabase dashboard.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260420_add_excluded_items_table.sql
git commit -m "feat: add reconciliation_excluded_items table for item-level exclusions"
```

---

### Task 2: Vendor Item Extractors

**Files:**
- Create: `apps/lootit/src/lib/vendor-item-extractors.js`

- [ ] **Step 1: Create the extractor module**

```javascript
/**
 * Extracts individual vendor items from cached_data for integrations
 * that store item-level details. Returns null for count-only integrations.
 *
 * @param {string} integrationKey
 * @param {object} cachedData
 * @returns {Array<{id: string, label: string, meta?: object}>|null}
 */
export function extractVendorItems(integrationKey, cachedData) {
  const extractor = ITEM_EXTRACTORS[integrationKey];
  if (!extractor) return null;
  const data = typeof cachedData === 'string'
    ? (() => { try { return JSON.parse(cachedData); } catch { return null; } })()
    : cachedData;
  if (!data) return null;
  return extractor(data);
}

const ITEM_EXTRACTORS = {
  spanning: (data) => {
    if (!Array.isArray(data.users)) return null;
    return data.users
      .filter(u => (u.userType || 'standard') !== 'archived')
      .map(u => ({
        id: u.email || u.userPrincipalName || u.id || '',
        label: u.displayName
          ? `${u.displayName} (${u.email || u.userPrincipalName || ''})`
          : u.email || u.userPrincipalName || u.id || 'Unknown',
        meta: { userType: u.userType },
      }))
      .filter(item => item.id);
  },

  spanning_archived: (data) => {
    if (!Array.isArray(data.users)) return null;
    return data.users
      .filter(u => u.userType === 'archived')
      .map(u => ({
        id: u.email || u.userPrincipalName || u.id || '',
        label: u.displayName
          ? `${u.displayName} (${u.email || u.userPrincipalName || ''})`
          : u.email || u.userPrincipalName || u.id || 'Unknown',
        meta: { userType: u.userType },
      }))
      .filter(item => item.id);
  },

  cove: (data) => {
    if (!Array.isArray(data.devices)) return null;
    return data.devices.map(d => ({
      id: d.name || d.deviceName || d.id || '',
      label: d.name || d.deviceName || d.id || 'Unknown Device',
      meta: { osType: d.osType },
    })).filter(item => item.id);
  },

  cove_workstation: (data) => {
    if (!Array.isArray(data.devices)) return null;
    return data.devices
      .filter(d => d.osType === 'Workstation')
      .map(d => ({
        id: d.name || d.deviceName || d.id || '',
        label: d.name || d.deviceName || d.id || 'Unknown Device',
        meta: { osType: d.osType },
      }))
      .filter(item => item.id);
  },

  cove_server: (data) => {
    if (!Array.isArray(data.devices)) return null;
    return data.devices
      .filter(d => d.osType === 'Server')
      .map(d => ({
        id: d.name || d.deviceName || d.id || '',
        label: d.name || d.deviceName || d.id || 'Unknown Device',
        meta: { osType: d.osType },
      }))
      .filter(item => item.id);
  },

  datto_edr: (data) => {
    const items = data.hosts || data.devices || data.agents;
    if (!Array.isArray(items)) return null;
    return items.map(d => ({
      id: d.hostname || d.name || d.id || '',
      label: d.hostname || d.name || d.id || 'Unknown Host',
      meta: {},
    })).filter(item => item.id);
  },

  unifi: (data) => {
    if (!Array.isArray(data.devices)) return null;
    return data.devices.map(d => ({
      id: d.mac || d.name || d.id || '',
      label: d.name || d.model || d.mac || 'Unknown Device',
      meta: { type: d.type || d.device_type, model: d.model },
    })).filter(item => item.id);
  },

  unifi_firewall: (data) => {
    if (!Array.isArray(data.devices)) return null;
    return data.devices
      .filter(d =>
        d.type === 'firewall' ||
        d.device_type === 'firewall' ||
        d.model?.toLowerCase().includes('udm') ||
        d.model?.toLowerCase().includes('usg') ||
        d.model?.toLowerCase().includes('gateway')
      )
      .map(d => ({
        id: d.mac || d.name || d.id || '',
        label: d.name || d.model || d.mac || 'Unknown Device',
        meta: { type: d.type || d.device_type, model: d.model },
      }))
      .filter(item => item.id);
  },

  pax8: (data) => {
    if (!Array.isArray(data.products)) return null;
    const items = [];
    for (const product of data.products) {
      const subs = product.subscriptions || [];
      if (subs.length === 0) {
        items.push({
          id: `product:${product.name}`,
          label: `${product.name} (qty: ${product.quantity || 0})`,
          meta: { quantity: product.quantity },
        });
      } else {
        for (const sub of subs) {
          items.push({
            id: sub.id || `sub:${product.name}:${sub.billingTerm || ''}`,
            label: `${product.name} — ${sub.billingTerm || 'subscription'} (qty: ${sub.quantity || 1})`,
            meta: { quantity: sub.quantity, billingTerm: sub.billingTerm },
          });
        }
      }
    }
    return items.length > 0 ? items : null;
  },
};
```

- [ ] **Step 2: Commit**

```bash
git add apps/lootit/src/lib/vendor-item-extractors.js
git commit -m "feat: add vendor item extractors for item-level exclusion selection"
```

---

### Task 3: useExcludedItems Hook

**Files:**
- Create: `apps/lootit/src/hooks/useExcludedItems.js`

- [ ] **Step 1: Create the hook**

```javascript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/api/client';
import { useAuth } from '@/lib/AuthContext';
import { toast } from 'sonner';

export function useExcludedItems(customerId) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const queryKey = ['reconciliation_excluded_items', customerId];

  const { data: excludedItems = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reconciliation_excluded_items')
        .select('*')
        .eq('customer_id', customerId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!customerId,
    staleTime: 1000 * 60 * 2,
  });

  const saveExcludedItemsMutation = useMutation({
    mutationFn: async ({ ruleId, selectedItems, reason }) => {
      const existing = excludedItems.filter(i => i.rule_id === ruleId);
      const existingIds = new Set(existing.map(i => i.vendor_item_id));
      const selectedIds = new Set(selectedItems.map(i => i.id));

      const toAdd = selectedItems.filter(i => !existingIds.has(i.id));
      const toRemove = existing.filter(i => !selectedIds.has(i.vendor_item_id));

      if (toRemove.length > 0) {
        const { error } = await supabase
          .from('reconciliation_excluded_items')
          .delete()
          .in('id', toRemove.map(i => i.id));
        if (error) throw error;
      }

      if (toAdd.length > 0) {
        const rows = toAdd.map(item => ({
          customer_id: customerId,
          rule_id: ruleId,
          vendor_item_id: item.id,
          vendor_item_label: item.label,
          reason: reason || null,
          excluded_by: user?.id || null,
        }));
        const { error } = await supabase
          .from('reconciliation_excluded_items')
          .upsert(rows, { onConflict: 'customer_id,rule_id,vendor_item_id' });
        if (error) throw error;
      }

      if (reason !== undefined) {
        const { error } = await supabase
          .from('reconciliation_excluded_items')
          .update({ reason })
          .eq('customer_id', customerId)
          .eq('rule_id', ruleId);
        if (error) throw error;
      }

      return { added: toAdd.length, removed: toRemove.length };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (err) => {
      toast.error(`Failed to save exclusions: ${err.message}`);
    },
  });

  const removeAllForRule = useMutation({
    mutationFn: async (ruleId) => {
      const { error } = await supabase
        .from('reconciliation_excluded_items')
        .delete()
        .eq('customer_id', customerId)
        .eq('rule_id', ruleId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const logDroppedItems = async (ruleId, droppedItems) => {
    for (const item of droppedItems) {
      await supabase.from('reconciliation_review_history').insert({
        customer_id: customerId,
        rule_id: ruleId,
        action: 'exclusion_dropped',
        status: 'auto',
        notes: `${item.vendor_item_label} (${item.vendor_item_id}) no longer in vendor data`,
        created_by: null,
        created_by_name: 'System',
      });
    }

    if (droppedItems.length > 0) {
      const { error } = await supabase
        .from('reconciliation_excluded_items')
        .delete()
        .in('id', droppedItems.map(i => i.id));
      if (error) console.warn('[logDroppedItems] cleanup error:', error.message);
    }
  };

  const getExcludedForRule = (ruleId) =>
    excludedItems.filter(i => i.rule_id === ruleId);

  const getExclusionCount = (ruleId, currentVendorItems) => {
    const excluded = getExcludedForRule(ruleId);
    if (excluded.length === 0) return 0;
    if (!currentVendorItems) return excluded.length;
    const currentIds = new Set(currentVendorItems.map(i => i.id));
    return excluded.filter(i => currentIds.has(i.vendor_item_id)).length;
  };

  return {
    excludedItems,
    isLoading,
    getExcludedForRule,
    getExclusionCount,
    saveExcludedItems: saveExcludedItemsMutation.mutateAsync,
    removeAllForRule: removeAllForRule.mutateAsync,
    logDroppedItems,
    isSaving: saveExcludedItemsMutation.isPending,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/lootit/src/hooks/useExcludedItems.js
git commit -m "feat: add useExcludedItems hook for CRUD on excluded vendor items"
```

---

### Task 4: ExclusionSection Component (Hybrid UI)

**Files:**
- Create: `apps/lootit/src/components/lootit/ExclusionSection.jsx`

- [ ] **Step 1: Create the hybrid exclusion component**

```jsx
import React, { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { ShieldCheck, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import { extractVendorItems } from '@/lib/vendor-item-extractors';

const EXCLUSION_PRESETS = [
  { label: 'Service Account', value: 'service account' },
  { label: 'Free Account', value: 'free account' },
  { label: 'Admin Account', value: 'admin account' },
  { label: 'Shared Mailbox', value: 'shared mailbox' },
  { label: 'Test Account', value: 'test account' },
];

export default function ExclusionSection({
  reconciliation,
  vendorMapping,
  excludedItemsForRule,
  onSaveExcludedItems,
  onRemoveAllExcludedItems,
  onSaveExclusion,
  isSaving,
}) {
  const { review, rule } = reconciliation;
  const isPax8 = !!reconciliation.ruleId;
  const ruleId = isPax8 ? reconciliation.ruleId : rule?.id;
  const integrationKey = isPax8 ? 'pax8' : rule?.integration_key;

  const cachedData = vendorMapping?.cached_data;
  const vendorItems = useMemo(
    () => extractVendorItems(integrationKey, cachedData),
    [integrationKey, cachedData]
  );

  const hasItemLevelData = vendorItems !== null && vendorItems.length > 0;

  if (hasItemLevelData) {
    return (
      <ItemLevelExclusion
        ruleId={ruleId}
        vendorItems={vendorItems}
        excludedItems={excludedItemsForRule}
        onSave={onSaveExcludedItems}
        onRemoveAll={onRemoveAllExcludedItems}
        isSaving={isSaving}
      />
    );
  }

  return (
    <CountFallbackExclusion
      reconciliation={reconciliation}
      onSaveExclusion={onSaveExclusion}
    />
  );
}

function ItemLevelExclusion({ ruleId, vendorItems, excludedItems, onSave, onRemoveAll, isSaving }) {
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [reason, setReason] = useState(excludedItems[0]?.reason || '');
  const [selectedIds, setSelectedIds] = useState(
    () => new Set(excludedItems.map(i => i.vendor_item_id))
  );

  const excludedCount = excludedItems.length;
  const currentReason = excludedItems[0]?.reason || '';

  const filteredItems = useMemo(() => {
    if (!search.trim()) return vendorItems;
    const q = search.toLowerCase();
    return vendorItems.filter(item =>
      item.label.toLowerCase().includes(q) || item.id.toLowerCase().includes(q)
    );
  }, [vendorItems, search]);

  const sortedItems = useMemo(() => {
    return [...filteredItems].sort((a, b) => {
      const aSelected = selectedIds.has(a.id) ? 0 : 1;
      const bSelected = selectedIds.has(b.id) ? 0 : 1;
      if (aSelected !== bSelected) return aSelected - bSelected;
      return a.label.localeCompare(b.label);
    });
  }, [filteredItems, selectedIds]);

  const toggleItem = (itemId) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const handleSave = async () => {
    const selectedItems = vendorItems.filter(i => selectedIds.has(i.id));
    try {
      await onSave({ ruleId, selectedItems, reason });
      setShowForm(false);
      toast.success(`${selectedItems.length} item${selectedItems.length !== 1 ? 's' : ''} excluded`);
    } catch (err) {
      toast.error(`Failed: ${err.message}`);
    }
  };

  const handleRemoveAll = async () => {
    try {
      await onRemoveAll(ruleId);
      setSelectedIds(new Set());
      setReason('');
      setShowForm(false);
      toast.success('Exclusions removed');
    } catch (err) {
      toast.error(`Failed: ${err.message}`);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Excluded Accounts
        </h4>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="text-xs font-semibold text-amber-600 hover:text-amber-700 transition-colors"
          >
            {excludedCount > 0 ? 'Edit' : '+ Add'}
          </button>
        )}
      </div>

      {/* Summary (non-edit mode) */}
      {excludedCount > 0 && !showForm && (
        <div
          className="px-3 py-2.5 rounded-lg border border-amber-200"
          style={{ backgroundImage: 'linear-gradient(135deg, #fffbeb 0%, #fef9c3 100%)' }}
        >
          <div className="flex items-center gap-2 mb-1.5">
            <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
            <p className="text-sm font-semibold text-amber-800">
              {excludedCount} excluded{currentReason ? ` — "${currentReason}"` : ''}
            </p>
          </div>
          <ul className="ml-6 space-y-0.5">
            {excludedItems.slice(0, 8).map(item => (
              <li key={item.id} className="text-xs text-amber-700 truncate">
                {item.vendor_item_label}
              </li>
            ))}
            {excludedItems.length > 8 && (
              <li className="text-xs text-amber-500 italic">
                +{excludedItems.length - 8} more
              </li>
            )}
          </ul>
        </div>
      )}

      {/* Item picker (edit mode) */}
      {showForm && (
        <div className="space-y-3 bg-amber-50/50 rounded-lg px-4 py-3 border border-amber-200">
          <p className="text-xs text-amber-700">
            Select specific items to exclude from the vendor count.
          </p>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search items..."
              className="w-full text-sm border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2"
              >
                <X className="w-3.5 h-3.5 text-slate-400" />
              </button>
            )}
          </div>

          {/* Item list */}
          <div className="max-h-48 overflow-y-auto space-y-0.5 border border-slate-200 rounded-lg bg-white p-1.5">
            {sortedItems.map(item => (
              <label
                key={item.id}
                className={cn(
                  'flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer text-xs transition-colors',
                  selectedIds.has(item.id)
                    ? 'bg-amber-100 text-amber-900'
                    : 'hover:bg-slate-50 text-slate-700'
                )}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(item.id)}
                  onChange={() => toggleItem(item.id)}
                  className="rounded border-slate-300 text-amber-600 focus:ring-amber-300"
                />
                <span className="truncate flex-1">{item.label}</span>
              </label>
            ))}
            {sortedItems.length === 0 && (
              <p className="text-xs text-slate-400 italic text-center py-2">
                {search ? 'No items match search' : 'No vendor items available'}
              </p>
            )}
          </div>

          <p className="text-[11px] text-slate-500">
            {selectedIds.size} of {vendorItems.length} selected
          </p>

          {/* Reason */}
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Note</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {EXCLUSION_PRESETS.map(preset => (
                <button
                  key={preset.value}
                  onClick={() => setReason(preset.value)}
                  className={cn(
                    'px-2.5 py-1 text-[11px] font-medium rounded-full border transition-colors',
                    reason === preset.value
                      ? 'bg-amber-200 border-amber-300 text-amber-800'
                      : 'bg-white border-slate-200 text-slate-500 hover:border-amber-200 hover:text-amber-700'
                  )}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Or type a custom note..."
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={isSaving || selectedIds.size === 0}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 transition-colors"
            >
              {isSaving ? 'Saving...' : `Exclude ${selectedIds.size} Item${selectedIds.size !== 1 ? 's' : ''}`}
            </button>
            {excludedCount > 0 && (
              <button
                onClick={handleRemoveAll}
                disabled={isSaving}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-100 text-red-600 hover:bg-red-200 transition-colors disabled:opacity-50"
              >
                Remove All
              </button>
            )}
            <button
              onClick={() => {
                setShowForm(false);
                setSelectedIds(new Set(excludedItems.map(i => i.vendor_item_id)));
                setReason(currentReason);
              }}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {excludedCount === 0 && !showForm && (
        <p className="text-sm text-slate-400 italic">No excluded accounts</p>
      )}
    </div>
  );
}

function CountFallbackExclusion({ reconciliation, onSaveExclusion }) {
  const { review, rule } = reconciliation;
  const isPax8 = !!reconciliation.ruleId;
  const ruleId = isPax8 ? reconciliation.ruleId : rule?.id;

  const [exclusionCount, setExclusionCount] = useState(review?.exclusion_count || 0);
  const [exclusionReason, setExclusionReason] = useState(review?.exclusion_reason || '');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!onSaveExclusion) return;
    setSaving(true);
    try {
      await onSaveExclusion(ruleId, exclusionCount, exclusionReason);
      setShowForm(false);
      toast.success('Exclusion saved');
    } catch (err) {
      toast.error(`Failed to save exclusion: ${err.message || 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!onSaveExclusion) return;
    setSaving(true);
    try {
      await onSaveExclusion(ruleId, 0, '');
      setExclusionCount(0);
      setExclusionReason('');
      setShowForm(false);
      toast.success('Exclusion removed');
    } catch (err) {
      toast.error(`Failed to remove exclusion: ${err.message || 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setExclusionCount(review?.exclusion_count || 0);
    setExclusionReason(review?.exclusion_reason || '');
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Excluded Accounts</h4>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="text-xs font-semibold text-amber-600 hover:text-amber-700 transition-colors"
          >
            {review?.exclusion_count > 0 ? 'Edit' : '+ Add'}
          </button>
        )}
      </div>

      {review?.exclusion_count > 0 && !showForm && (
        <div
          className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-amber-200"
          style={{ backgroundImage: 'linear-gradient(135deg, #fffbeb 0%, #fef9c3 100%)' }}
        >
          <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-800">
              {review.exclusion_count} {review.exclusion_reason || 'excluded'}
            </p>
            <p className="text-[11px] text-amber-600">These don't count against the vendor total</p>
          </div>
        </div>
      )}

      {showForm && (
        <div className="space-y-3 bg-amber-50/50 rounded-lg px-4 py-3 border border-amber-200">
          <p className="text-xs text-amber-700">
            Add accounts that shouldn't count against the licence total (e.g. service accounts, free accounts).
          </p>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">How many?</label>
            <input
              type="number"
              min="0"
              value={exclusionCount}
              onChange={(e) => setExclusionCount(parseInt(e.target.value) || 0)}
              className="w-24 text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Reason</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {EXCLUSION_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  onClick={() => setExclusionReason(preset.value)}
                  className={cn(
                    'px-2.5 py-1 text-[11px] font-medium rounded-full border transition-colors',
                    exclusionReason === preset.value
                      ? 'bg-amber-200 border-amber-300 text-amber-800'
                      : 'bg-white border-slate-200 text-slate-500 hover:border-amber-200 hover:text-amber-700'
                  )}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={exclusionReason}
              onChange={(e) => setExclusionReason(e.target.value)}
              placeholder="Or type a custom reason..."
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving || exclusionCount <= 0}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving...' : 'Save Exclusion'}
            </button>
            {review?.exclusion_count > 0 && (
              <button
                onClick={handleRemove}
                disabled={saving}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-100 text-red-600 hover:bg-red-200 transition-colors disabled:opacity-50"
              >
                Remove
              </button>
            )}
            <button
              onClick={handleCancel}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {!review?.exclusion_count && !showForm && (
        <p className="text-sm text-slate-400 italic">No excluded accounts</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/lootit/src/components/lootit/ExclusionSection.jsx
git commit -m "feat: add hybrid ExclusionSection component with item picker and count fallback"
```

---

### Task 5: Wire Up ExclusionSection in ReconciliationDetailModal

**Files:**
- Modify: `apps/lootit/src/components/lootit/ReconciliationDetailModal.jsx` (lines 284-435, 554-718)

- [ ] **Step 1: Replace inline ExclusionSection with new component import**

At the top of `ReconciliationDetailModal.jsx`, add the import:

```javascript
import ExclusionSection from './ExclusionSection';
```

- [ ] **Step 2: Remove the old `ExclusionSection` function**

Delete the entire function from line 283 (`// Exclusion Section`) through line 435 (closing `}`). This is the old `function ExclusionSection({ reconciliation, onSaveExclusion })` block and the `EXCLUSION_PRESETS` constant at line 30-36.

- [ ] **Step 3: Update props on ReconciliationDetailModal**

Add new props to the component signature:

```javascript
export default function ReconciliationDetailModal({
  reconciliation,
  customerId,
  onClose,
  onForceMatch,
  onReview,
  onDismiss,
  onReset,
  onSaveNotes,
  onSaveExclusion,
  onSaveExcludedItems,
  onRemoveAllExcludedItems,
  excludedItemsForRule,
  vendorMapping,
  isExclusionSaving,
  onMapLineItem,
  overrides = [],
  readOnly = false,
  snapshotDate,
  onReVerify,
}) {
```

- [ ] **Step 4: Update the ExclusionSection usage in the render (around line 714-720)**

Replace:
```jsx
<ExclusionSection
  reconciliation={reconciliation}
  onSaveExclusion={onSaveExclusion}
/>
```

With:
```jsx
<ExclusionSection
  reconciliation={reconciliation}
  vendorMapping={vendorMapping}
  excludedItemsForRule={excludedItemsForRule || []}
  onSaveExcludedItems={onSaveExcludedItems}
  onRemoveAllExcludedItems={onRemoveAllExcludedItems}
  onSaveExclusion={onSaveExclusion}
  isSaving={isExclusionSaving}
/>
```

- [ ] **Step 5: Commit**

```bash
git add apps/lootit/src/components/lootit/ReconciliationDetailModal.jsx
git commit -m "refactor: replace inline ExclusionSection with new hybrid component in modal"
```

---

### Task 6: Wire Up in LootITCustomerDetail

**Files:**
- Modify: `apps/lootit/src/components/lootit/LootITCustomerDetail.jsx`

- [ ] **Step 1: Import the useExcludedItems hook**

Add at the top with other imports:

```javascript
import { useExcludedItems } from '@/hooks/useExcludedItems';
```

- [ ] **Step 2: Add the hook call after existing hooks (around line 41)**

After the `useReconciliationReviews` line:

```javascript
const { excludedItems, getExcludedForRule, saveExcludedItems, removeAllForRule, isSaving: isExclusionSaving } = useExcludedItems(customer.id);
```

- [ ] **Step 3: Pass new props to ReconciliationDetailModal (around line 462)**

Add new props to the existing `<ReconciliationDetailModal>` usage. After the `onSaveExclusion` prop:

```jsx
onSaveExcludedItems={saveExcludedItems}
onRemoveAllExcludedItems={removeAllForRule}
excludedItemsForRule={detailItem ? getExcludedForRule(
  detailItem.ruleId || detailItem.rule?.id
) : []}
vendorMapping={
  detailItem
    ? (customerData?.vendorMappings || {})[
        detailItem.ruleId ? 'pax8' : detailItem.rule?.integration_key
      ]
    : null
}
isExclusionSaving={isExclusionSaving}
```

- [ ] **Step 4: Commit**

```bash
git add apps/lootit/src/components/lootit/LootITCustomerDetail.jsx
git commit -m "feat: wire useExcludedItems hook and pass vendor data to exclusion UI"
```

---

### Task 7: Update ServiceCard Effective Status Calculation

**Files:**
- Modify: `apps/lootit/src/components/lootit/ServiceCard.jsx` (lines 11-19)

- [ ] **Step 1: Update getEffectiveStatus to accept item-level exclusion count**

The `ServiceCard` component's `getEffectiveStatus` currently reads `review?.exclusion_count`. It needs to also accept an `itemExclusionCount` that takes priority when present.

Update the function signature and logic:

```javascript
function getEffectiveStatus(reconciliation, itemExclusionCount) {
  const { psaQty, vendorQty, status, review } = reconciliation;
  const exclusionCount = itemExclusionCount ?? review?.exclusion_count ?? 0;
  if (exclusionCount <= 0) return status;
  const effectiveVendorQty = vendorQty !== null ? vendorQty - exclusionCount : null;
  if (psaQty === null || effectiveVendorQty === null) return status;
  const diff = psaQty - effectiveVendorQty;
  if (diff === 0) return 'match';
  return diff > 0 ? 'over' : 'under';
}
```

- [ ] **Step 2: Update getCardState to pass it through**

```javascript
function getCardState(reconciliation, itemExclusionCount) {
  const { status, review } = reconciliation;
  const reviewStatus = review?.status;
  const effectiveStatus = getEffectiveStatus(reconciliation, itemExclusionCount);

  if (reviewStatus === 'force_matched') return 'force_matched';
  if (reviewStatus === 'dismissed') return 'dismissed';
  if (effectiveStatus === 'match') return 'auto_matched';
  if (
    status === 'no_vendor_data' ||
    status === 'no_data' ||
    status === 'unmatched_line_item' ||
    status === 'no_psa_data' ||
    status === 'missing_from_psa'
  ) {
    return 'no_vendor';
  }
  if (effectiveStatus === 'over' || effectiveStatus === 'under') return 'mismatch';
  return 'no_vendor';
}
```

- [ ] **Step 3: Add `itemExclusionCount` prop to ServiceCard**

Update the component to accept and use the new prop:

```javascript
export default function ServiceCard({ reconciliation, onDetails, staleness, itemExclusionCount }) {
  const cardState = getCardState(reconciliation, itemExclusionCount);
  // ... rest unchanged
  const exclusionCount = itemExclusionCount ?? reconciliation.review?.exclusion_count ?? 0;
  const effectiveVendorQty = reconciliation.vendorQty != null ? reconciliation.vendorQty - exclusionCount : null;
```

- [ ] **Step 4: Commit**

```bash
git add apps/lootit/src/components/lootit/ServiceCard.jsx
git commit -m "feat: ServiceCard accepts itemExclusionCount for dynamic exclusion display"
```

---

### Task 8: Pass Item Exclusion Count to ServiceCards

**Files:**
- Modify: `apps/lootit/src/components/lootit/CustomerDetailReconciliationTab.jsx`

- [ ] **Step 1: Check how ServiceCard is rendered**

Find where `<ServiceCard>` is rendered and add the `itemExclusionCount` prop. The parent needs access to excluded items and vendor mappings.

Add `useExcludedItems` and `extractVendorItems` to the tab:

```javascript
import { useExcludedItems } from '@/hooks/useExcludedItems';
import { extractVendorItems } from '@/lib/vendor-item-extractors';
```

- [ ] **Step 2: Use the hook in CustomerDetailReconciliationTab**

Inside the component, add:

```javascript
const { getExcludedForRule, getExclusionCount } = useExcludedItems(customerId);
```

- [ ] **Step 3: Compute itemExclusionCount for each ServiceCard**

When rendering each `<ServiceCard>`, compute and pass the count:

```jsx
<ServiceCard
  key={recon.rule?.id || recon.ruleId}
  reconciliation={recon}
  onDetails={() => onDetailItem(recon)}
  staleness={stalenessMap?.[recon.rule?.id || recon.ruleId]}
  itemExclusionCount={(() => {
    const integrationKey = recon.rule?.integration_key;
    const mapping = vendorMappings?.[integrationKey];
    const vendorItems = mapping ? extractVendorItems(integrationKey, mapping.cached_data) : null;
    if (!vendorItems) return undefined;
    return getExclusionCount(recon.rule?.id, vendorItems);
  })()}
/>
```

- [ ] **Step 4: Commit**

```bash
git add apps/lootit/src/components/lootit/CustomerDetailReconciliationTab.jsx
git commit -m "feat: pass dynamic item exclusion count to ServiceCards"
```

---

### Task 9: Dropped-Item Detection on Data Load

**Files:**
- Modify: `apps/lootit/src/hooks/useExcludedItems.js`
- Modify: `apps/lootit/src/components/lootit/LootITCustomerDetail.jsx`

- [ ] **Step 1: Add a `detectDroppedItems` function to useExcludedItems**

Add this function to the hook return:

```javascript
const detectDroppedItems = async (ruleId, currentVendorItems) => {
  const excluded = excludedItems.filter(i => i.rule_id === ruleId);
  if (excluded.length === 0 || !currentVendorItems) return;
  const currentIds = new Set(currentVendorItems.map(i => i.id));
  const dropped = excluded.filter(i => !currentIds.has(i.vendor_item_id));
  if (dropped.length > 0) {
    await logDroppedItems(ruleId, dropped);
    queryClient.invalidateQueries({ queryKey });
  }
};
```

Add `detectDroppedItems` to the return object.

- [ ] **Step 2: Run detection when opening detail modal**

In `LootITCustomerDetail.jsx`, when `detailItem` changes (or inside the modal's mount effect), trigger detection:

```javascript
import { extractVendorItems } from '@/lib/vendor-item-extractors';

// Add useEffect after the hook calls:
const { excludedItems, getExcludedForRule, getExclusionCount, saveExcludedItems, removeAllForRule, detectDroppedItems, isSaving: isExclusionSaving } = useExcludedItems(customer.id);
```

Add a `useMemo` or `useEffect` that runs detection when data loads:

```javascript
React.useEffect(() => {
  if (!customerData?.vendorMappings || excludedItems.length === 0) return;
  const mappings = customerData.vendorMappings;
  for (const [key, mapping] of Object.entries(mappings)) {
    const items = extractVendorItems(key, mapping?.cached_data);
    if (!items) continue;
    const ruleExclusions = excludedItems.filter(e => {
      const recon = recons.find(r => r.rule?.integration_key === key);
      return recon && e.rule_id === recon.rule?.id;
    });
    if (ruleExclusions.length > 0) {
      const ruleId = ruleExclusions[0].rule_id;
      detectDroppedItems(ruleId, items);
    }
  }
}, [customerData?.vendorMappings, excludedItems.length]);
```

- [ ] **Step 3: Commit**

```bash
git add apps/lootit/src/hooks/useExcludedItems.js apps/lootit/src/components/lootit/LootITCustomerDetail.jsx
git commit -m "feat: detect and log dropped excluded items when vendor data changes"
```

---

### Task 10: Integration Test & Deploy

**Files:**
- No new files

- [ ] **Step 1: Run TypeScript/build check**

```bash
cd /Users/anielreyes/portalit/apps/lootit && npm run build
```

Fix any import/type errors.

- [ ] **Step 2: Manual test flow**

1. Open LootIT → pick a customer with Spanning or Cove data
2. Click a service card → modal opens
3. In "Excluded Accounts" section, verify item picker appears (not number input)
4. Select 2-3 items, add reason "free account", save
5. Verify card shows updated effective vendor qty
6. Reopen modal → verify items show as checked
7. Open a 3CX or JumpCloud card → verify it falls back to number input

- [ ] **Step 3: Deploy to Railway**

```bash
cd /Users/anielreyes/portalit/apps/lootit && railway up
```

- [ ] **Step 4: Commit any fixes and tag**

```bash
git add -A && git commit -m "fix: integration fixes for dynamic exclusions"
```
