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
  haloDevices,
}) {
  const { review, rule } = reconciliation;
  const isPax8 = !!reconciliation.ruleId;
  const ruleId = isPax8 ? reconciliation.ruleId : rule?.id;
  const integrationKey = isPax8 ? 'pax8' : rule?.integration_key;

  const cachedData = vendorMapping?.cached_data;
  const vendorItems = useMemo(
    () => extractVendorItems(integrationKey, cachedData, haloDevices),
    [integrationKey, cachedData, haloDevices]
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

      {excludedCount > 0 && !showForm && (
        <div
          className="px-3 py-2.5 rounded-lg border border-amber-200"
          style={{ backgroundImage: 'linear-gradient(135deg, #fffbeb 0%, #fef9c3 100%)' }}
        >
          <div className="flex items-center gap-2 mb-1.5">
            <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
            <p className="text-sm font-semibold text-amber-800">
              {excludedCount} excluded{currentReason ? ` \u2014 "${currentReason}"` : ''}
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

      {showForm && (
        <div className="space-y-3 bg-amber-50/50 rounded-lg px-4 py-3 border border-amber-200">
          <p className="text-xs text-amber-700">
            Select specific items to exclude from the vendor count.
          </p>

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
