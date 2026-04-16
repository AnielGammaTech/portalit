import React, { useState, useMemo } from 'react';
import { Search, Check, Link2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatLineItemDescription } from '@/lib/utils';

export default function Pax8GroupMapper({ pax8Recons, lineItems, existingOverrides, onSave, onClose }) {
  const [search, setSearch] = useState('');
  const [selectedLineItem, setSelectedLineItem] = useState(null);
  const [selectedSubs, setSelectedSubs] = useState(new Set());

  const filteredLineItems = useMemo(() => {
    const q = search.toLowerCase().trim();
    const items = lineItems.filter(li => li.description && li.quantity > 0);
    if (!q) return items;
    return items.filter(li => (li.description || '').toLowerCase().includes(q));
  }, [lineItems, search]);

  const allSubs = useMemo(() => {
    return pax8Recons.map(r => ({
      ruleId: r.ruleId,
      name: r.productName,
      subscriptionId: r.subscriptionId,
      vendorQty: r.vendorQty,
      billingTerm: r.billingTerm,
      price: r.price,
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
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="font-semibold text-slate-900 text-sm">Map PSA Line Item to Pax8 Subscriptions</h3>
          <p className="text-xs text-slate-500 mt-1">Select a PSA billing line, then check which Pax8 subscriptions it covers</p>
        </div>

        <div className="grid grid-cols-2 divide-x divide-slate-200" style={{ maxHeight: '60vh' }}>
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
