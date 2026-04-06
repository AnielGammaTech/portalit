import React, { useState, useMemo } from 'react';
import { formatLineItemDescription } from '@/lib/utils';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';

const SOURCE_TABS = [
  { key: 'psa', label: 'HaloPSA Billing' },
  { key: 'pax8', label: 'Pax8 Subscriptions' },
  { key: 'devices', label: 'Devices' },
  { key: 'vendors', label: 'Other Vendors' },
];

export default function LineItemPicker({ productName, lineItems, pax8Products = [], devices = [], vendorItems = [], onSelect, onClose }) {
  const [search, setSearch] = useState('');
  const [source, setSource] = useState('psa');

  const currentItems = useMemo(() => {
    const q = search.toLowerCase().trim();

    if (source === 'psa') {
      const items = (lineItems || []).filter(li => li.description && li.quantity > 0);
      return q ? items.filter(li => (li.description || '').toLowerCase().includes(q)) : items;
    }

    if (source === 'pax8') {
      const items = (pax8Products || []).map(p => ({
        id: `pax8:${p.name}`,
        description: p.name,
        quantity: p.quantity || 0,
        unit_price: p.price || 0,
        total: (p.quantity || 0) * (p.price || 0),
      }));
      return q ? items.filter(i => i.description.toLowerCase().includes(q)) : items;
    }

    if (source === 'devices') {
      const items = (devices || []).map(d => ({
        id: `device:${d.id}`,
        description: d.name || d.hostname || 'Unknown device',
        quantity: 1,
        unit_price: 0,
        total: 0,
        _meta: `${d.device_type || 'device'} · ${d.status || ''}`,
      }));
      return q ? items.filter(i => i.description.toLowerCase().includes(q)) : items;
    }

    if (source === 'vendors') {
      const items = (vendorItems || []).map(v => ({
        id: `vendor:${v.id || v.name}`,
        description: v.name || v.description || 'Unknown',
        quantity: v.quantity || v.count || 1,
        unit_price: 0,
        total: 0,
        _meta: v.integration || v.source || '',
      }));
      return q ? items.filter(i => i.description.toLowerCase().includes(q)) : items;
    }

    return [];
  }, [lineItems, pax8Products, devices, vendorItems, search, source]);

  // Only show tabs that have data
  const visibleTabs = SOURCE_TABS.filter(tab => {
    if (tab.key === 'psa') return (lineItems || []).length > 0;
    if (tab.key === 'pax8') return (pax8Products || []).length > 0;
    if (tab.key === 'devices') return (devices || []).length > 0;
    if (tab.key === 'vendors') return (vendorItems || []).length > 0;
    return false;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <div
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="font-semibold text-slate-900 text-sm">Map Line Item</h3>
          <p className="text-xs text-slate-500 mt-1">
            Select an item for <span className="font-medium text-slate-700">{productName}</span>
          </p>
        </div>

        {/* Source tabs */}
        {visibleTabs.length > 1 && (
          <div className="px-4 pt-3 pb-1 border-b border-slate-100 flex gap-1 overflow-x-auto">
            {visibleTabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => { setSource(tab.key); setSearch(''); }}
                className={cn(
                  'px-3 py-1.5 text-[10px] font-semibold rounded-full transition-colors whitespace-nowrap',
                  source === tab.key
                    ? 'bg-slate-800 text-white'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* Search */}
        <div className="px-6 py-3 border-b border-slate-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-300 focus:border-slate-400"
              autoFocus
            />
          </div>
        </div>

        {/* Item list */}
        <div className="max-h-80 overflow-y-auto">
          {currentItems.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">No items found</p>
          ) : (
            currentItems.map((li) => (
              <button
                key={li.id}
                onClick={() => onSelect(li.id)}
                className="w-full text-left px-6 py-3 hover:bg-slate-50 border-b border-slate-50 transition-colors"
              >
                <p className="text-sm font-medium text-slate-700 truncate">
                  {source === 'psa' ? formatLineItemDescription(li.description) : li.description}
                </p>
                <div className="flex gap-4 mt-0.5 text-xs text-slate-400">
                  <span>Qty: {li.quantity}</span>
                  {li.unit_price > 0 && <span>Price: ${parseFloat(li.unit_price).toFixed(2)}</span>}
                  {li.total > 0 && <span>Total: ${parseFloat(li.total).toFixed(2)}</span>}
                  {li._meta && <span className="text-slate-300">{li._meta}</span>}
                </div>
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
