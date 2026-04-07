import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { client } from '@/api/client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  RefreshCw,
  CheckCircle2,
  Trash2,
  Search,
  ChevronLeft,
  ChevronRight,
  Info,
  Bug,
  Zap,
  RotateCcw,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from 'date-fns';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CONNECTION_STATES = {
  CONNECTED: 'connected',
  CONFIGURED: 'configured',
  NOT_CONFIGURED: 'not_configured',
};

const ITEMS_PER_PAGE = 25;
const SYNC_TIMEOUT_MS = 30_000;
const STALE_THRESHOLD_HOURS = 48;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getConnectionStatusDisplay(status) {
  switch (status) {
    case CONNECTION_STATES.CONNECTED:
      return { dotClass: 'bg-emerald-500', label: 'Connected' };
    case CONNECTION_STATES.CONFIGURED:
      return { dotClass: 'bg-amber-500', label: 'Configured' };
    default:
      return { dotClass: 'bg-slate-300', label: 'Not configured' };
  }
}

function getRelativeTime(dateStr) {
  if (!dateStr) return { text: 'Never', colorClass: 'text-slate-400' };
  const syncDate = new Date(dateStr);
  const hoursAgo = (Date.now() - syncDate.getTime()) / (1000 * 60 * 60);
  const text = formatDistanceToNow(syncDate, { addSuffix: false }) + ' ago';
  if (hoursAgo < 24) return { text, colorClass: 'text-emerald-600' };
  if (hoursAgo < STALE_THRESHOLD_HOURS) return { text, colorClass: 'text-amber-600' };
  return { text, colorClass: 'text-red-500' };
}

function isStale(dateStr) {
  if (!dateStr) return false;
  const hoursAgo = (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60);
  return hoursAgo >= STALE_THRESHOLD_HOURS;
}

function getRowStatusDot(mapping) {
  if (!mapping) return 'bg-slate-300';
  if (mapping.last_synced && isStale(mapping.last_synced)) return 'bg-amber-400';
  return 'bg-emerald-500';
}

function getSuggestedMatch(siteName, customers) {
  const siteNameLower = siteName.toLowerCase().trim();
  let bestMatch = null;
  let bestScore = 0;

  for (const customer of customers) {
    const customerNameLower = customer.name.toLowerCase().trim();
    if (siteNameLower === customerNameLower) return { customer, score: 100 };
    if (siteNameLower.includes(customerNameLower) || customerNameLower.includes(siteNameLower)) {
      const score = Math.round(
        (Math.min(siteNameLower.length, customerNameLower.length) /
          Math.max(siteNameLower.length, customerNameLower.length)) * 100,
      );
      if (score > bestScore) { bestScore = score; bestMatch = customer; }
    }
    const siteWords = siteNameLower.split(/[\s,.-]+/).filter(w => w.length > 2);
    const customerWords = customerNameLower.split(/[\s,.-]+/).filter(w => w.length > 2);
    const matchingWords = siteWords.filter(sw => customerWords.some(cw => cw.includes(sw) || sw.includes(cw)));
    if (matchingWords.length > 0) {
      const score = Math.round((matchingWords.length / Math.max(siteWords.length, customerWords.length)) * 100);
      if (score > bestScore) { bestScore = score; bestMatch = customer; }
    }
  }
  return bestMatch && bestScore >= 50 ? { customer: bestMatch, score: bestScore } : null;
}

// ---------------------------------------------------------------------------
// Inline Customer Search Cell
// ---------------------------------------------------------------------------

function InlineCustomerSearch({ customers, suggestedMatch, onSelect }) {
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
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    function handleEscape(e) {
      if (e.key === 'Escape') setOpen(false);
    }
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
        onClick={() => {
          setOpen(true);
          setTimeout(() => inputRef.current?.focus(), 0);
        }}
      >
        <input
          ref={inputRef}
          type="text"
          placeholder="Select customer..."
          value={query}
          onChange={(e) => { setQuery(e.target.value); if (!open) setOpen(true); }}
          onFocus={() => setOpen(true)}
          className="h-6 w-40 text-xs border border-slate-200 rounded px-2 bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 placeholder:text-slate-400"
        />
        {suggestedMatch && !query && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleSelect(suggestedMatch.customer); }}
            className="text-[10px] text-slate-400 hover:text-slate-600 text-left truncate max-w-[160px]"
            title={`Auto-match: ${suggestedMatch.customer.name} (${suggestedMatch.score}%)`}
          >
            Suggested: {suggestedMatch.customer.name}
          </button>
        )}
      </div>
      {open && (
        <div className="absolute z-50 mt-0.5 w-52 max-h-44 overflow-y-auto rounded border border-slate-200 bg-white shadow-lg">
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
// Compact Progress Bar
// ---------------------------------------------------------------------------

function MiniProgressBar({ mapped, total }) {
  const pct = total === 0 ? 0 : Math.round((mapped / total) * 100);
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-slate-700">
        {mapped}/{total} mapped
      </span>
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

function TablePagination({ page, totalPages, totalItems, perPage, onPageChange }) {
  const start = ((page - 1) * perPage) + 1;
  const end = Math.min(page * perPage, totalItems);
  return (
    <div className="flex items-center justify-between px-4 py-2 border-t border-slate-200 bg-slate-50/50">
      <p className="text-[11px] text-slate-500">Showing {start}-{end} of {totalItems}</p>
      <div className="flex items-center gap-1">
        <Button
          size="sm" variant="ghost"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page === 1}
          className="h-6 w-6 p-0"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </Button>
        <span className="text-[11px] text-slate-600 px-1.5">{page}/{totalPages}</span>
        <Button
          size="sm" variant="ghost"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page === totalPages}
          className="h-6 w-6 p-0"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// API Key Tooltip
// ---------------------------------------------------------------------------

function ApiKeyTooltip() {
  const [show, setShow] = useState(false);
  return (
    <div className="relative inline-block">
      <button
        type="button"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        className="text-slate-400 hover:text-slate-600"
      >
        <Info className="w-3.5 h-3.5" />
      </button>
      {show && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-56 p-2 bg-slate-900 text-white text-[10px] rounded-md shadow-lg">
          <p>API key configured via environment variable <code className="bg-slate-700 px-1 rounded">unifi_api_key</code>.</p>
          <p className="mt-1">
            Get yours at{' '}
            <a href="https://developer.ui.com" target="_blank" rel="noopener noreferrer" className="text-blue-300 underline">
              developer.ui.com
            </a>
          </p>
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function UniFiConfig() {
  const [testing, setTesting] = useState(false);
  const [configStatus, setConfigStatus] = useState(CONNECTION_STATES.NOT_CONFIGURED);
  const [loadingSites, setLoadingSites] = useState(false);
  const [unifiSites, setUnifiSites] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0 });
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);

  const queryClient = useQueryClient();

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => client.entities.Customer.list(),
  });

  const { data: mappings = [], refetch: refetchMappings } = useQuery({
    queryKey: ['unifi_mappings'],
    queryFn: () => client.entities.UniFiMapping.list(),
  });

  // Auto-detect configured status from existing mappings
  useEffect(() => {
    if (mappings.length > 0 && configStatus === CONNECTION_STATES.NOT_CONFIGURED) {
      setConfigStatus(CONNECTION_STATES.CONNECTED);
    }
  }, [mappings.length, configStatus]);

  // ---------------------------------------------------------------------------
  // Derived data
  // ---------------------------------------------------------------------------

  const getCustomerName = useCallback((customerId) => {
    const customer = customers.find(c => c.id === customerId);
    return customer?.name || 'Unknown';
  }, [customers]);

  const mappedSiteIds = useMemo(
    () => new Set(mappings.map(m => m.unifi_site_id)),
    [mappings],
  );

  const mappedCount = useMemo(
    () => unifiSites.filter(site => mappedSiteIds.has(String(site.id))).length,
    [unifiSites, mappedSiteIds],
  );

  const staleCount = useMemo(
    () => mappings.filter(m => m.last_synced && isStale(m.last_synced)).length,
    [mappings],
  );

  // Build a unified list: sites from API + any mappings not in the API list
  const allRows = useMemo(() => {
    const rows = unifiSites.map(site => {
      const siteId = String(site.id);
      const mapping = mappings.find(m => m.unifi_site_id === siteId);
      return {
        siteId,
        siteName: site.name,
        deviceCount: site.deviceCount || 0,
        mapping,
        isMapped: Boolean(mapping),
        isStale: mapping ? isStale(mapping.last_synced) : false,
      };
    });

    // Include mappings for sites not currently in the API response
    const apiSiteIds = new Set(unifiSites.map(s => String(s.id)));
    for (const mapping of mappings) {
      if (!apiSiteIds.has(mapping.unifi_site_id)) {
        rows.push({
          siteId: mapping.unifi_site_id,
          siteName: mapping.unifi_site_name || mapping.unifi_site_id,
          deviceCount: 0,
          mapping,
          isMapped: true,
          isStale: isStale(mapping.last_synced),
        });
      }
    }

    return rows;
  }, [unifiSites, mappings]);

  const totalSites = allRows.length;
  const unmappedCount = totalSites - mappedCount;

  const filteredRows = useMemo(() => {
    let rows = allRows;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      rows = rows.filter(r =>
        r.siteName.toLowerCase().includes(q) ||
        (r.mapping && getCustomerName(r.mapping.customer_id).toLowerCase().includes(q))
      );
    }

    switch (filterTab) {
      case 'mapped':
        rows = rows.filter(r => r.isMapped);
        break;
      case 'unmapped':
        rows = rows.filter(r => !r.isMapped);
        break;
      case 'stale':
        rows = rows.filter(r => r.isStale);
        break;
      default:
        break;
    }

    return rows;
  }, [allRows, searchQuery, filterTab, getCustomerName]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedRows = filteredRows.slice(
    (safePage - 1) * ITEMS_PER_PAGE,
    safePage * ITEMS_PER_PAGE,
  );

  const statusDisplay = getConnectionStatusDisplay(configStatus);

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  const testConnection = async () => {
    setTesting(true);
    try {
      const response = await client.functions.invoke('syncUniFiDevices', { action: 'list_sites' });
      if (response.success) {
        setConfigStatus(CONNECTION_STATES.CONNECTED);
        toast.success(`Connected! Found ${response.sites?.length || 0} sites.`);
      } else {
        setConfigStatus(CONNECTION_STATES.CONFIGURED);
        toast.error(response.error || 'Connection failed');
      }
    } catch (error) {
      setConfigStatus(CONNECTION_STATES.CONFIGURED);
      toast.error(error.message || 'Connection test failed');
    } finally {
      setTesting(false);
    }
  };

  const loadUnifiSites = async () => {
    setLoadingSites(true);
    try {
      const response = await client.functions.invoke('syncUniFiDevices', { action: 'list_sites' });
      if (response.success) {
        setUnifiSites(response.sites || []);
        setCurrentPage(1);
        setConfigStatus(CONNECTION_STATES.CONNECTED);
      } else {
        toast.error(response.error || 'Failed to load sites');
      }
    } catch (error) {
      toast.error(error.message || 'Failed to load sites');
    } finally {
      setLoadingSites(false);
    }
  };

  const applyMapping = async (siteId, siteName, customer) => {
    if (!customer) return;
    try {
      await client.entities.UniFiMapping.create({
        customer_id: customer.id,
        customer_name: customer.name,
        unifi_site_id: siteId,
        unifi_site_name: siteName,
      });
      toast.success(`Mapped ${siteName} to ${customer.name}`);
      refetchMappings();
    } catch (error) {
      toast.error(`Failed to map: ${error.message}`);
    }
  };

  const deleteMapping = async (mappingId) => {
    try {
      await client.entities.UniFiMapping.delete(mappingId);
      toast.success('Mapping removed');
      refetchMappings();
    } catch (error) {
      toast.error(`Failed to remove mapping: ${error.message}`);
    }
  };

  const syncAllDevices = async () => {
    if (mappings.length === 0) return;
    setSyncing(true);
    const total = mappings.length;
    let synced = 0;
    let failed = 0;

    setSyncProgress({ current: 0, total });
    const toastId = toast.loading(`Syncing 0/${total}...`);

    for (const mapping of mappings) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), SYNC_TIMEOUT_MS);

        await client.functions.invoke('syncUniFiDevices', {
          action: 'sync_one',
          mapping_id: mapping.id,
        });

        clearTimeout(timeout);
        synced += 1;
      } catch {
        failed += 1;
      }

      const current = synced + failed;
      setSyncProgress({ current, total });
      toast.loading(`Syncing ${current}/${total}...`, { id: toastId });
    }

    if (failed === 0) {
      toast.success(`Synced ${synced}/${total}. All successful.`, { id: toastId });
    } else {
      toast.warning(`Synced ${synced}/${total}. ${failed} failed.`, { id: toastId });
    }

    queryClient.invalidateQueries({ queryKey: ['unifi_mappings'] });
    setSyncing(false);
    setSyncProgress({ current: 0, total: 0 });
  };

  const autoMapByName = async () => {
    try {
      const res = await client.functions.invoke('syncUniFiDevices', { action: 'auto_map' });
      if (res.success) {
        toast.success(`Auto-mapped ${res.mapped} hosts. ${res.results?.filter(r => !r.customer).length || 0} unmatched.`);
        loadUnifiSites();
        queryClient.invalidateQueries({ queryKey: ['unifi_mappings'] });
      } else {
        toast.error(res.error || 'Auto-map failed');
      }
    } catch (err) {
      toast.error(err.message);
    }
  };

  const debugApi = async () => {
    try {
      const res = await client.functions.invoke('syncUniFiDevices', { action: 'debug_api' });
      console.log('UniFi Debug:', JSON.stringify(res, null, 2));
      toast.success('Debug output in console (F12)');
    } catch (err) {
      toast.error(err.message);
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const hasData = unifiSites.length > 0 || mappings.length > 0;

  return (
    <div className="space-y-3">
      {/* ── Header Bar ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap px-3 py-2 bg-slate-50 rounded-lg border border-slate-200">
        {/* Status dot + label */}
        <div className="flex items-center gap-2 mr-1">
          <div className={cn("w-2 h-2 rounded-full", statusDisplay.dotClass)} />
          <span className="text-xs font-medium text-slate-700">{statusDisplay.label}</span>
        </div>

        <span className="text-slate-300">|</span>
        <span className="text-xs text-slate-600 font-medium">UniFi Network</span>
        <ApiKeyTooltip />

        {/* Inline progress */}
        {hasData && (
          <>
            <span className="text-slate-300">|</span>
            <MiniProgressBar mapped={mappedCount} total={totalSites} />
          </>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Action buttons */}
        <div className="flex items-center gap-1.5">
          <Button
            size="sm" variant="outline"
            onClick={testConnection}
            disabled={testing}
            className="h-7 text-xs px-2.5"
          >
            <RefreshCw className={cn("w-3 h-3 mr-1", testing && "animate-spin")} />
            Test
          </Button>
          <Button
            size="sm" variant="outline"
            onClick={loadUnifiSites}
            disabled={loadingSites}
            className="h-7 text-xs px-2.5"
          >
            <RefreshCw className={cn("w-3 h-3 mr-1", loadingSites && "animate-spin")} />
            Refresh
          </Button>
          <Button
            size="sm" variant="outline"
            onClick={autoMapByName}
            className="h-7 text-xs px-2.5 text-blue-600 border-blue-200 hover:bg-blue-50"
          >
            <Zap className="w-3 h-3 mr-1" />
            Auto-Map
          </Button>
          <Button
            size="sm"
            onClick={syncAllDevices}
            disabled={syncing || mappings.length === 0}
            className="h-7 text-xs px-2.5 bg-slate-900 hover:bg-slate-800 text-white"
          >
            <RefreshCw className={cn("w-3 h-3 mr-1", syncing && "animate-spin")} />
            {syncing ? `${syncProgress.current}/${syncProgress.total}` : 'Sync All'}
          </Button>
          <Button
            size="sm" variant="ghost"
            onClick={debugApi}
            className="h-7 text-xs px-2 text-slate-400 hover:text-slate-600"
            title="Debug API (logs to console)"
          >
            <Bug className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* ── Filter Tabs + Search ───────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="flex items-center border border-slate-200 rounded-md bg-white">
          {[
            { key: 'all', label: `All ${totalSites}` },
            { key: 'mapped', label: `Mapped ${mappedCount}` },
            { key: 'unmapped', label: `Unmapped ${unmappedCount}` },
            { key: 'stale', label: `Stale ${staleCount}` },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => { setFilterTab(tab.key); setCurrentPage(1); }}
              className={cn(
                "px-3 py-1.5 text-[11px] font-medium transition-colors",
                tab.key === 'all' && "rounded-l-md",
                tab.key === 'stale' && "rounded-r-md",
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
            placeholder="Search sites or customers..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            className="pl-8 h-7 text-xs w-60"
          />
        </div>
      </div>

      {/* ── Main Table ─────────────────────────────────────────────────── */}
      {!hasData ? (
        <div className="text-center py-10 text-sm text-slate-500 border border-slate-200 rounded-lg">
          No hosts loaded. Click <strong>Refresh</strong> to pull UniFi sites or <strong>Test</strong> to verify the connection.
        </div>
      ) : (
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-3 py-2 w-10" />
                  <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-3 py-2">Site</th>
                  <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-3 py-2 w-16">Devices</th>
                  <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-3 py-2">Customer</th>
                  <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-3 py-2 w-24">Last Sync</th>
                  <th className="text-right text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-3 py-2 w-20" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-6 text-xs text-slate-400">
                      No sites match the current filter.
                    </td>
                  </tr>
                ) : (
                  paginatedRows.map((row, idx) => (
                    <SiteRow
                      key={row.siteId}
                      row={row}
                      customers={customers}
                      getCustomerName={getCustomerName}
                      onMap={(customer) => applyMapping(row.siteId, row.siteName, customer)}
                      onDelete={() => row.mapping && deleteMapping(row.mapping.id)}
                      isOdd={idx % 2 === 1}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>

          {filteredRows.length > ITEMS_PER_PAGE && (
            <TablePagination
              page={safePage}
              totalPages={totalPages}
              totalItems={filteredRows.length}
              perPage={ITEMS_PER_PAGE}
              onPageChange={setCurrentPage}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Table Row
// ---------------------------------------------------------------------------

function SiteRow({ row, customers, getCustomerName, onMap, onDelete, isOdd }) {
  const suggestedMatch = useMemo(
    () => (!row.isMapped ? getSuggestedMatch(row.siteName, customers) : null),
    [row.isMapped, row.siteName, customers],
  );

  const syncTime = row.mapping ? getRelativeTime(row.mapping.last_synced) : null;
  const statusDot = getRowStatusDot(row.mapping);

  return (
    <tr className={cn(
      "transition-colors",
      isOdd ? "bg-slate-50/40" : "bg-white",
      "hover:bg-slate-100/60",
    )}>
      {/* Status dot */}
      <td className="px-3 py-2 text-center">
        <div className={cn("w-2 h-2 rounded-full mx-auto", statusDot)} />
      </td>

      {/* Site name */}
      <td className="px-3 py-2">
        <span className="text-sm font-medium text-slate-900">{row.siteName}</span>
      </td>

      {/* Device count */}
      <td className="px-3 py-2">
        <span className="text-xs text-slate-500">{row.deviceCount}</span>
      </td>

      {/* Customer */}
      <td className="px-3 py-2">
        {row.isMapped ? (
          <span className="inline-flex items-center gap-1 text-sm text-slate-800">
            {getCustomerName(row.mapping.customer_id)}
            <CheckCircle2 className="w-3 h-3 text-emerald-500 flex-shrink-0" />
          </span>
        ) : (
          <InlineCustomerSearch
            customers={customers}
            suggestedMatch={suggestedMatch}
            onSelect={onMap}
          />
        )}
      </td>

      {/* Last sync */}
      <td className="px-3 py-2">
        {syncTime ? (
          <span className={cn("text-[11px]", syncTime.colorClass)}>
            {syncTime.text}
          </span>
        ) : (
          <span className="text-[11px] text-slate-400">Never</span>
        )}
      </td>

      {/* Actions */}
      <td className="px-3 py-2 text-right">
        <div className="flex items-center justify-end gap-1">
          {row.isStale && row.mapping && (
            <button
              type="button"
              onClick={async () => {
                try {
                  await client.functions.invoke('syncUniFiDevices', {
                    action: 'sync_one',
                    mapping_id: row.mapping.id,
                  });
                  toast.success(`Re-synced ${row.siteName}`);
                } catch (err) {
                  toast.error(`Sync failed: ${err.message}`);
                }
              }}
              className="p-1 text-amber-500 hover:text-amber-700 hover:bg-amber-50 rounded"
              title="Re-sync stale site"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
          {row.isMapped && (
            <button
              type="button"
              onClick={onDelete}
              className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
              title="Remove mapping"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
