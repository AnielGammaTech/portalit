import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2, ChevronLeft, ChevronRight, RefreshCw, Search, Trash2 } from 'lucide-react';
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from 'date-fns';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const CONNECTION_STATES = {
  CONNECTED: 'connected',
  CONFIGURED: 'configured',
  NOT_CONFIGURED: 'not_configured',
};

export const ITEMS_PER_PAGE = 25;
export const STALE_THRESHOLD_HOURS = 48;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getConnectionStatusDisplay(status) {
  switch (status) {
    case CONNECTION_STATES.CONNECTED:
      return { dotClass: 'bg-emerald-500', label: 'Connected' };
    case CONNECTION_STATES.CONFIGURED:
      return { dotClass: 'bg-amber-500', label: 'Configured' };
    default:
      return { dotClass: 'bg-slate-300', label: 'Not configured' };
  }
}

export function getRelativeTime(dateStr) {
  if (!dateStr) return { text: 'Never', colorClass: 'text-slate-400' };
  const syncDate = new Date(dateStr);
  const hoursAgo = (Date.now() - syncDate.getTime()) / (1000 * 60 * 60);
  const text = formatDistanceToNow(syncDate, { addSuffix: false }) + ' ago';
  if (hoursAgo < 24) return { text, colorClass: 'text-emerald-600' };
  if (hoursAgo < STALE_THRESHOLD_HOURS) return { text, colorClass: 'text-amber-600' };
  return { text, colorClass: 'text-red-500' };
}

export function isStale(dateStr) {
  if (!dateStr) return false;
  const hoursAgo = (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60);
  return hoursAgo >= STALE_THRESHOLD_HOURS;
}

export function getRowStatusDot(mapping) {
  if (!mapping) return 'bg-slate-300';
  if (mapping.last_synced && isStale(mapping.last_synced)) return 'bg-amber-400';
  return 'bg-emerald-500';
}

export function getSuggestedMatch(name, customers) {
  const nameLower = (name || '').toLowerCase().trim();
  if (!nameLower) return null;
  let bestMatch = null;
  let bestScore = 0;

  for (const customer of customers) {
    const customerNameLower = customer.name.toLowerCase().trim();
    if (nameLower === customerNameLower) return { customer, score: 100 };
    if (nameLower.includes(customerNameLower) || customerNameLower.includes(nameLower)) {
      const score = Math.round(
        (Math.min(nameLower.length, customerNameLower.length) /
          Math.max(nameLower.length, customerNameLower.length)) * 100,
      );
      if (score > bestScore) { bestScore = score; bestMatch = customer; }
    }
    const nameWords = nameLower.split(/[\s,.-]+/).filter(w => w.length > 2);
    const customerWords = customerNameLower.split(/[\s,.-]+/).filter(w => w.length > 2);
    const matchingWords = nameWords.filter(sw => customerWords.some(cw => cw.includes(sw) || sw.includes(cw)));
    if (matchingWords.length > 0) {
      const score = Math.round((matchingWords.length / Math.max(nameWords.length, customerWords.length)) * 100);
      if (score > bestScore) { bestScore = score; bestMatch = customer; }
    }
  }
  return bestMatch && bestScore >= 50 ? { customer: bestMatch, score: bestScore } : null;
}

// ---------------------------------------------------------------------------
// Inline Customer Search Cell
// ---------------------------------------------------------------------------

export function InlineCustomerSearch({ customers, suggestedMatch, onSelect }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  const filtered = useMemo(() => {
    if (!query) return customers.slice(0, 20);
    const q = query.toLowerCase();
    return customers.filter(c => c.name.toLowerCase().includes(q)).slice(0, 20);
  }, [customers, query]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    function handleEscape(e) { if (e.key === 'Escape') setOpen(false); }
    if (open) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [open]);

  const handleSelect = useCallback((customer) => {
    onSelect(customer);
    setOpen(false);
    setQuery('');
  }, [onSelect]);

  return (
    <div ref={containerRef} className="relative">
      <div
        className="flex flex-col gap-0.5 cursor-text"
        onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 0); }}
      >
        <input
          ref={inputRef}
          type="text"
          placeholder="Select customer..."
          value={query}
          onChange={(e) => { setQuery(e.target.value); if (!open) setOpen(true); }}
          onFocus={() => setOpen(true)}
          className="h-6 w-56 text-xs border border-slate-200 rounded px-2 bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 placeholder:text-slate-400"
        />
        {suggestedMatch && !query && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleSelect(suggestedMatch.customer); }}
            className="text-[10px] text-slate-400 hover:text-slate-600 text-left truncate max-w-[220px]"
            title={`Auto-match: ${suggestedMatch.customer.name} (${suggestedMatch.score}%)`}
          >
            Suggested: {suggestedMatch.customer.name}
          </button>
        )}
      </div>
      {open && (
        <div className="absolute z-50 mt-0.5 w-72 max-h-44 overflow-y-auto rounded border border-slate-200 bg-white shadow-lg">
          {filtered.length === 0 ? (
            <p className="px-3 py-2 text-xs text-slate-400">No customers found</p>
          ) : (
            filtered.map(customer => (
              <button
                key={customer.id}
                type="button"
                onClick={() => handleSelect(customer)}
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-100 transition-colors truncate"
              >
                {customer.name}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mini Progress Bar
// ---------------------------------------------------------------------------

export function MiniProgressBar({ mapped, total }) {
  const pct = total === 0 ? 0 : Math.round((mapped / total) * 100);
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-slate-700">{mapped}/{total} mapped</span>
      <div className="w-20 h-1.5 bg-slate-200 rounded-full overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-300",
            pct >= 80 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-red-500",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Table Pagination
// ---------------------------------------------------------------------------

export function TablePagination({ page, totalPages, totalItems, perPage, onPageChange }) {
  const start = ((page - 1) * perPage) + 1;
  const end = Math.min(page * perPage, totalItems);
  return (
    <div className="flex items-center justify-between px-4 py-2 border-t border-slate-200 bg-slate-50/50">
      <p className="text-[11px] text-slate-500">Showing {start}-{end} of {totalItems}</p>
      <div className="flex items-center gap-1">
        <Button size="sm" variant="ghost" onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page === 1} className="h-6 w-6 p-0">
          <ChevronLeft className="w-3.5 h-3.5" />
        </Button>
        <span className="text-[11px] text-slate-600 px-1.5">{page}/{totalPages}</span>
        <Button size="sm" variant="ghost" onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="h-6 w-6 p-0">
          <ChevronRight className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Filter Tabs + Search Bar
// ---------------------------------------------------------------------------

export function FilterBar({ filterTab, setFilterTab, searchQuery, setSearchQuery, totalCount, mappedCount, unmappedCount, staleCount, onPageReset, searchPlaceholder = 'Search...' }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center border border-slate-200 rounded-md bg-white">
        {[
          { key: 'all', label: `All ${totalCount}` },
          { key: 'mapped', label: `Mapped ${mappedCount}` },
          { key: 'unmapped', label: `Unmapped ${unmappedCount}` },
          ...(staleCount > 0 ? [{ key: 'stale', label: `Stale ${staleCount}` }] : []),
        ].map((tab, idx, arr) => (
          <button
            key={tab.key}
            onClick={() => { setFilterTab(tab.key); onPageReset(); }}
            className={cn(
              "px-3 py-1.5 text-[11px] font-medium transition-colors",
              idx === 0 && "rounded-l-md",
              idx === arr.length - 1 && "rounded-r-md",
              filterTab === tab.key
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-100",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="flex-1" />
      <div className="relative">
        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <Input
          placeholder={searchPlaceholder}
          value={searchQuery}
          onChange={(e) => { setSearchQuery(e.target.value); onPageReset(); }}
          className="pl-8 h-7 text-xs w-60"
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Header Bar
// ---------------------------------------------------------------------------

export function IntegrationHeader({ statusDisplay, integrationName, hasData, mappedCount, totalCount, children }) {
  return (
    <div className="flex items-center gap-3 flex-wrap px-3 py-2 bg-slate-50 rounded-lg border border-slate-200">
      <div className="flex items-center gap-2 mr-1">
        <div className={cn("w-2 h-2 rounded-full", statusDisplay.dotClass)} />
        <span className="text-xs font-medium text-slate-700">{statusDisplay.label}</span>
      </div>
      <span className="text-slate-300">|</span>
      <span className="text-xs text-slate-600 font-medium">{integrationName}</span>
      {hasData && (
        <>
          <span className="text-slate-300">|</span>
          <MiniProgressBar mapped={mappedCount} total={totalCount} />
        </>
      )}
      <div className="flex-1" />
      <div className="flex items-center gap-1.5">
        {children}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mapping Table Row (generic)
// ---------------------------------------------------------------------------

export function MappingRow({ statusDot, itemName, countValue, countLabel, isMapped, customerName, syncTime, suggestedMatch, customers, onMap, onDelete, onResync, isStaleRow, isOdd }) {
  return (
    <tr className={cn("transition-colors", isOdd ? "bg-slate-50/40" : "bg-white", "hover:bg-slate-100/60")}>
      <td className="px-3 py-2 text-center">
        <div className={cn("w-2 h-2 rounded-full mx-auto", statusDot)} />
      </td>
      <td className="px-3 py-2">
        <span className="text-sm font-medium text-slate-900">{itemName}</span>
      </td>
      <td className="px-3 py-2">
        <span className="text-xs text-slate-500">{countValue ?? '—'}</span>
      </td>
      <td className="px-3 py-2">
        {isMapped ? (
          <span className="inline-flex items-center gap-1 text-sm text-slate-800">
            {customerName}
            <CheckCircle2 className="w-3 h-3 text-emerald-500 flex-shrink-0" />
          </span>
        ) : (
          <InlineCustomerSearch customers={customers} suggestedMatch={suggestedMatch} onSelect={onMap} />
        )}
      </td>
      <td className="px-3 py-2">
        {syncTime ? (
          <span className={cn("text-[11px]", syncTime.colorClass)}>{syncTime.text}</span>
        ) : (
          <span className="text-[11px] text-slate-400">Never</span>
        )}
      </td>
      <td className="px-3 py-2 text-right">
        <div className="flex items-center justify-end gap-1">
          {isStaleRow && onResync && (
            <button type="button" onClick={onResync} className="p-1 text-amber-500 hover:text-amber-700 hover:bg-amber-50 rounded" title="Re-sync">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}
          {isMapped && onDelete && (
            <button type="button" onClick={onDelete} className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded" title="Remove mapping">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

