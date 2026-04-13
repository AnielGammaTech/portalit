import React, { useState, useMemo } from 'react';
import { formatLineItemDescription } from '@/lib/utils';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { INTEGRATION_LABELS } from '@/lib/lootit-reconciliation';

/**
 * Extract displayable items from a vendor mapping's cached_data.
 * Returns an array of { id, description, quantity, unit_price?, total?, _meta? }.
 */
function extractVendorItems(integrationKey, mapping) {
  const raw = typeof mapping.cached_data === 'string'
    ? (() => { try { return JSON.parse(mapping.cached_data); } catch { return {}; } })()
    : (mapping.cached_data || {});

  // Device arrays (UniFi, Datto RMM, Cove)
  if (Array.isArray(raw.devices) && raw.devices.length > 0) {
    return raw.devices.map((d, i) => ({
      id: `${integrationKey}:${d.id || d.mac || i}`,
      description: d.name || d.hostname || d.model || 'Unknown device',
      quantity: 1,
      unit_price: 0,
      total: 0,
      _meta: [d.device_type || d.type, d.model, d.status].filter(Boolean).join(' · '),
    }));
  }

  // Host arrays (Datto EDR)
  if (Array.isArray(raw.hosts) && raw.hosts.length > 0) {
    return raw.hosts.map((h, i) => ({
      id: `${integrationKey}:${h.id || h.hostname || i}`,
      description: h.hostname || h.name || 'Unknown host',
      quantity: 1,
      unit_price: 0,
      total: 0,
      _meta: [h.os, h.status].filter(Boolean).join(' · '),
    }));
  }

  // User arrays (Spanning, JumpCloud)
  if (Array.isArray(raw.users) && raw.users.length > 0) {
    return raw.users.map((u, i) => ({
      id: `${integrationKey}:${u.id || u.email || i}`,
      description: u.displayName || u.email || u.username || u.name || 'Unknown user',
      quantity: 1,
      unit_price: 0,
      total: 0,
      _meta: u.userType || u.type || '',
    }));
  }

  // Domain arrays (Dark Web ID)
  if (Array.isArray(raw.domains_monitored) && raw.domains_monitored.length > 0) {
    return raw.domains_monitored.map((d) => ({
      id: `${integrationKey}:${d}`,
      description: d,
      quantity: 1,
      unit_price: 0,
      total: 0,
      _meta: 'monitored domain',
    }));
  }

  // Product arrays (Pax8 via vendorMappings)
  if (Array.isArray(raw.products) && raw.products.length > 0) {
    return raw.products.map((p, i) => ({
      id: `${integrationKey}:${p.id || p.name || i}`,
      description: p.name || p.productName || 'Unknown product',
      quantity: p.quantity || 1,
      unit_price: p.price || 0,
      total: (p.quantity || 1) * (p.price || 0),
      _meta: p.billingTerm || '',
    }));
  }

  // Count-only vendors: show a single summary row
  const countKeys = [
    'total_devices', 'totalDevices', 'hostCount', 'total_agents', 'totalAgents',
    'totalUsers', 'total_users', 'workstation_count', 'server_count',
    'user_extensions', 'total_extensions', 'domains_count', 'domain_count',
    'total_emails_sent', 'user_count',
    'numberOfProtectedStandardUsers', 'numberOfProtectedArchivedUsers',
  ];
  for (const k of countKeys) {
    if (typeof raw[k] === 'number' && raw[k] > 0) {
      const label = INTEGRATION_LABELS[integrationKey] || integrationKey;
      return [{
        id: `${integrationKey}:count`,
        description: `${label}`,
        quantity: raw[k],
        unit_price: 0,
        total: 0,
        _meta: `${raw[k]} total`,
      }];
    }
  }

  return [];
}

/**
 * Build dynamic tabs from available data sources.
 */
function buildTabs(lineItems, pax8Products, devices, vendorMappings) {
  const tabs = [];

  if ((lineItems || []).length > 0) {
    tabs.push({ key: 'psa', label: 'HaloPSA Billing' });
  }

  if ((pax8Products || []).length > 0) {
    tabs.push({ key: 'pax8', label: 'Pax8 Subscriptions' });
  }

  if ((devices || []).length > 0) {
    tabs.push({ key: 'devices', label: 'Devices' });
  }

  // Add a tab per vendor integration that has data (skip pax8 — handled above)
  if (vendorMappings) {
    for (const [key, mapping] of Object.entries(vendorMappings)) {
      if (key === 'pax8') continue;
      const items = extractVendorItems(key, mapping);
      if (items.length > 0) {
        tabs.push({
          key: `vendor:${key}`,
          label: INTEGRATION_LABELS[key] || key,
        });
      }
    }
  }

  return tabs;
}

export default function LineItemPicker({ productName, lineItems, pax8Products = [], devices = [], vendorMappings = {}, onSelect, onClose }) {
  const [search, setSearch] = useState('');
  const [source, setSource] = useState('psa');

  const visibleTabs = useMemo(
    () => buildTabs(lineItems, pax8Products, devices, vendorMappings),
    [lineItems, pax8Products, devices, vendorMappings],
  );

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

    // Dynamic vendor tabs: "vendor:<integration_key>"
    if (source.startsWith('vendor:')) {
      const integrationKey = source.replace('vendor:', '');
      const mapping = vendorMappings[integrationKey];
      if (!mapping) return [];
      const items = extractVendorItems(integrationKey, mapping);
      return q ? items.filter(i => (i.description || '').toLowerCase().includes(q) || (i._meta || '').toLowerCase().includes(q)) : items;
    }

    return [];
  }, [lineItems, pax8Products, devices, vendorMappings, search, source]);

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
                className="w-full text-left px-6 py-3 hover:bg-slate-50 border-b border-slate-50 transition-colors cursor-pointer"
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
