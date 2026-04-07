import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { client } from '@/api/client';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  RefreshCw,
  CheckCircle2,
  Building2,
  Trash2,
  Search,
  ChevronLeft,
  ChevronRight,
  XCircle,
  ChevronDown,
  Key,
  AlertCircle,
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

const ITEMS_PER_PAGE = 10;
const MAPPINGS_PER_PAGE = 10;
const SYNC_TIMEOUT_MS = 30_000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getConnectionStatusDisplay(status) {
  switch (status) {
    case CONNECTION_STATES.CONNECTED:
      return { color: 'bg-emerald-500', label: 'Connected', bgClass: 'bg-emerald-50 border-emerald-200', textClass: 'text-emerald-700' };
    case CONNECTION_STATES.CONFIGURED:
      return { color: 'bg-amber-500', label: 'Configured', bgClass: 'bg-amber-50 border-amber-200', textClass: 'text-amber-700' };
    default:
      return { color: 'bg-slate-300', label: 'Not configured', bgClass: 'bg-slate-50 border-slate-200', textClass: 'text-slate-500' };
  }
}

function getFreshnessDisplay(lastSynced) {
  if (!lastSynced) return { label: 'Never synced', colorClass: 'text-slate-400' };
  const now = new Date();
  const syncDate = new Date(lastSynced);
  const hoursAgo = (now - syncDate) / (1000 * 60 * 60);
  const label = `Last synced: ${formatDistanceToNow(syncDate, { addSuffix: true })}`;
  if (hoursAgo < 24) return { label, colorClass: 'text-emerald-600' };
  if (hoursAgo < 48) return { label, colorClass: 'text-amber-600' };
  return { label, colorClass: 'text-red-600' };
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
// Progress Ring SVG
// ---------------------------------------------------------------------------

function ProgressRing({ mapped, total }) {
  const percentage = total === 0 ? 0 : Math.round((mapped / total) * 100);
  const radius = 20;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  const ringColor = percentage >= 80 ? 'stroke-emerald-500' : percentage >= 50 ? 'stroke-amber-500' : 'stroke-red-500';
  const textColor = percentage >= 80 ? 'text-emerald-700' : percentage >= 50 ? 'text-amber-700' : 'text-red-700';

  return (
    <div className="flex items-center gap-4">
      <div className="relative w-12 h-12 flex-shrink-0">
        <svg className="w-12 h-12 -rotate-90" viewBox="0 0 48 48">
          <circle cx="24" cy="24" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="4" />
          <circle
            cx="24" cy="24" r={radius} fill="none"
            className={ringColor}
            strokeWidth="4" strokeLinecap="round"
            strokeDasharray={circumference} strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 0.4s ease' }}
          />
        </svg>
        <span className={cn("absolute inset-0 flex items-center justify-center text-[10px] font-bold", textColor)}>
          {percentage}%
        </span>
      </div>
      <div className="text-sm">
        <p className={cn("font-semibold", textColor)}>{mapped}/{total} mapped</p>
        <p className="text-xs text-slate-500">
          {mapped} Mapped{' '}&middot;{' '}{total - mapped} Unmapped
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Searchable Customer Dropdown
// ---------------------------------------------------------------------------

function SearchableCustomerDropdown({ customers, value, onChange, className }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  const selected = useMemo(
    () => customers.find(c => c.id === value),
    [customers, value],
  );

  const filtered = useMemo(() => {
    if (!query) return customers;
    const q = query.toLowerCase();
    return customers.filter(c => c.name.toLowerCase().includes(q));
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

  const handleSelect = useCallback((customerId) => {
    onChange(customerId);
    setOpen(false);
    setQuery('');
  }, [onChange]);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {selected && !open ? (
        <button
          type="button"
          onClick={() => { setOpen(true); setQuery(''); }}
          className="flex items-center gap-1.5 h-8 px-2 w-full text-left text-sm border border-slate-200 rounded-md bg-white hover:bg-slate-50 truncate"
        >
          <span className="truncate">{selected.name}</span>
          <ChevronDown className="w-3 h-3 text-slate-400 ml-auto flex-shrink-0" />
        </button>
      ) : (
        <Input
          autoFocus={open}
          placeholder="Search customer..."
          value={query}
          onChange={(e) => { setQuery(e.target.value); if (!open) setOpen(true); }}
          onFocus={() => setOpen(true)}
          className="h-8 text-sm w-full"
        />
      )}
      {open && (
        <div className="absolute z-50 mt-1 w-56 max-h-48 overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg">
          {filtered.length === 0 ? (
            <p className="px-3 py-2 text-xs text-slate-400">No customers found</p>
          ) : (
            filtered.map(customer => (
              <button
                key={customer.id}
                type="button"
                onClick={() => handleSelect(customer.id)}
                className={cn(
                  "w-full text-left px-3 py-1.5 text-sm hover:bg-slate-100 transition-colors",
                  customer.id === value && "bg-slate-50 font-medium",
                )}
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
// Freshness Badge
// ---------------------------------------------------------------------------

function FreshnessBadge({ lastSynced }) {
  const { label, colorClass } = getFreshnessDisplay(lastSynced);
  return <span className={cn("text-[11px]", colorClass)}>{label}</span>;
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function UniFiConfig() {
  const [testing, setTesting] = useState(false);
  const [configStatus, setConfigStatus] = useState(CONNECTION_STATES.NOT_CONFIGURED);
  const [loadingSites, setLoadingSites] = useState(false);
  const [unifiSites, setUnifiSites] = useState([]);
  const [showMappingView, setShowMappingView] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0 });
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [siteSelections, setSiteSelections] = useState({});
  const [mappingSearchQuery, setMappingSearchQuery] = useState('');
  const [mappingPage, setMappingPage] = useState(1);
  const [errorDetails, setErrorDetails] = useState(null);
  const [showErrorDetails, setShowErrorDetails] = useState(false);

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

  const mappedCount = useMemo(
    () => unifiSites.filter(site => mappings.some(m => m.unifi_site_id === String(site.id))).length,
    [unifiSites, mappings],
  );
  const unmappedCount = unifiSites.length - mappedCount;

  const filteredSites = useMemo(() => {
    let filtered = unifiSites;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(site => site.name.toLowerCase().includes(q));
    }
    if (filterTab === 'mapped') {
      filtered = filtered.filter(site => mappings.some(m => m.unifi_site_id === String(site.id)));
    } else if (filterTab === 'unmapped') {
      filtered = filtered.filter(site => !mappings.some(m => m.unifi_site_id === String(site.id)));
    }
    return filtered;
  }, [unifiSites, searchQuery, filterTab, mappings]);

  const totalPages = Math.ceil(filteredSites.length / ITEMS_PER_PAGE);
  const paginatedSites = filteredSites.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  const filteredMappings = useMemo(() => {
    if (!mappingSearchQuery) return mappings;
    const q = mappingSearchQuery.toLowerCase();
    return mappings.filter(mapping => {
      const customerName = getCustomerName(mapping.customer_id).toLowerCase();
      const siteName = (mapping.unifi_site_name || '').toLowerCase();
      return customerName.includes(q) || siteName.includes(q);
    });
  }, [mappings, mappingSearchQuery, getCustomerName]);

  const totalMappingPages = Math.ceil(filteredMappings.length / MAPPINGS_PER_PAGE);
  const paginatedMappings = filteredMappings.slice(
    (mappingPage - 1) * MAPPINGS_PER_PAGE,
    mappingPage * MAPPINGS_PER_PAGE,
  );

  const statusDisplay = getConnectionStatusDisplay(configStatus);

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  const testConnection = async () => {
    setTesting(true);
    setErrorDetails(null);
    try {
      const response = await client.functions.invoke('syncUniFiDevices', { action: 'list_sites' });
      if (response.success) {
        setConfigStatus(CONNECTION_STATES.CONNECTED);
        toast.success(`Connected! Found ${response.sites?.length || 0} sites.`);
      } else {
        const errMsg = response.error || 'Connection failed';
        setConfigStatus(CONNECTION_STATES.CONFIGURED);
        setErrorDetails(errMsg);
        toast.error(errMsg);
      }
    } catch (error) {
      const errMsg = error.message || 'Connection test failed';
      setConfigStatus(CONNECTION_STATES.CONFIGURED);
      setErrorDetails(errMsg);
      toast.error(errMsg);
    } finally {
      setTesting(false);
    }
  };

  const loadUnifiSites = async () => {
    setLoadingSites(true);
    setErrorDetails(null);
    try {
      const response = await client.functions.invoke('syncUniFiDevices', { action: 'list_sites' });
      if (response.success) {
        setUnifiSites(response.sites || []);
        setShowMappingView(true);
        setCurrentPage(1);
      } else {
        const errMsg = response.error || 'Failed to load sites';
        setErrorDetails(errMsg);
        toast.error(errMsg);
      }
    } catch (error) {
      const errMsg = error.message || 'Failed to load sites';
      setErrorDetails(errMsg);
      toast.error(errMsg);
    } finally {
      setLoadingSites(false);
    }
  };

  const applyMapping = async (site, customerId) => {
    if (!customerId) return;
    const customerName = customers.find(c => c.id === customerId)?.name || '';
    try {
      await client.entities.UniFiMapping.create({
        customer_id: customerId,
        customer_name: customerName,
        unifi_site_id: String(site.id),
        unifi_site_name: site.name,
      });
      toast.success(`Mapped host ${site.name} successfully!`);
      refetchMappings();
      setSiteSelections(prev => {
        const next = { ...prev };
        delete next[site.id];
        return next;
      });
    } catch (error) {
      toast.error(`Failed to map host: ${error.message}`);
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
    setErrorDetails(null);
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
        queryClient.invalidateQueries({ queryKey: ['unifi-mappings'] });
      } else {
        toast.error(res.error || 'Auto-map failed');
      }
    } catch (err) {
      toast.error(err.message);
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-5">
      {/* Connection Status Header */}
      <div className={cn("flex items-center justify-between px-4 py-3 rounded-lg border", statusDisplay.bgClass)}>
        <div className="flex items-center gap-3">
          <div className={cn("w-2.5 h-2.5 rounded-full", statusDisplay.color)} />
          <span className={cn("text-sm font-medium", statusDisplay.textClass)}>{statusDisplay.label}</span>
        </div>
      </div>

      {/* Error Details */}
      {errorDetails && (
        <Collapsible open={showErrorDetails} onOpenChange={setShowErrorDetails}>
          <div className="border border-red-200 bg-red-50 rounded-lg overflow-hidden">
            <CollapsibleTrigger asChild>
              <button className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-red-700 hover:bg-red-100 transition-colors">
                <div className="flex items-center gap-2"><XCircle className="w-4 h-4" />Error details</div>
                <ChevronDown className={cn("w-4 h-4 transition-transform", showErrorDetails && "rotate-180")} />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-4 pb-3 pt-1 border-t border-red-200">
                <pre className="text-xs text-red-600 whitespace-pre-wrap font-mono bg-red-100/50 rounded p-2">{errorDetails}</pre>
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>
      )}

      {/* API Key Info */}
      <div className="bg-slate-50 rounded-lg p-4">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <Key className="w-4 h-4" /> UniFi API Key
        </div>
        <p className="text-xs text-slate-500 mt-1">
          API key is configured via environment variable (<code className="bg-slate-200 px-1 rounded">unifi_api_key</code>).
          Get your key from{' '}
          <a href="https://developer.ui.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
            developer.ui.com
          </a>
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button onClick={testConnection} disabled={testing} variant="outline">
          <RefreshCw className={cn("w-4 h-4 mr-2", testing && "animate-spin")} />
          Test Connection
        </Button>
        <Button onClick={loadUnifiSites} disabled={loadingSites} variant="outline">
          <RefreshCw className={cn("w-4 h-4 mr-2", loadingSites && "animate-spin")} />
          {showMappingView ? 'Refresh Hosts' : 'Load Hosts'}
        </Button>
        {unifiSites.length > 0 && (
          <Button
            onClick={autoMapByName}
            variant="outline"
            className="text-blue-600 border-blue-200 hover:bg-blue-50"
          >
            Auto-Map by Name
          </Button>
        )}
        {mappings.length > 0 && (
          <Button onClick={syncAllDevices} disabled={syncing} className="bg-slate-900 hover:bg-slate-800">
            <RefreshCw className={cn("w-4 h-4 mr-2", syncing && "animate-spin")} />
            {syncing
              ? `Syncing ${syncProgress.current}/${syncProgress.total}...`
              : 'Sync All Devices'}
          </Button>
        )}
      </div>

      {/* Host Mappings Section */}
      <div className="border-t border-slate-200 pt-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h4 className="font-medium text-slate-900">Host Mappings</h4>
            <p className="text-sm text-slate-500">Map UniFi consoles/gateways to your customers</p>
          </div>
        </div>

        {/* Summary Progress Bar */}
        {(showMappingView && unifiSites.length > 0) && (
          <div className="mb-4 px-4 py-3 bg-slate-50 rounded-xl border border-slate-200">
            <ProgressRing mapped={mappedCount} total={unifiSites.length} />
          </div>
        )}

        {!showMappingView ? (
          <MappingListView
            mappings={mappings}
            filteredMappings={filteredMappings}
            paginatedMappings={paginatedMappings}
            mappingSearchQuery={mappingSearchQuery}
            onSearchChange={(val) => { setMappingSearchQuery(val); setMappingPage(1); }}
            mappingPage={mappingPage}
            totalMappingPages={totalMappingPages}
            onPageChange={setMappingPage}
            getCustomerName={getCustomerName}
            deleteMapping={deleteMapping}
          />
        ) : (
          <HostTableView
            paginatedSites={paginatedSites}
            filteredSites={filteredSites}
            unifiSites={unifiSites}
            mappings={mappings}
            customers={customers}
            siteSelections={siteSelections}
            onSiteSelectionChange={(siteId, val) =>
              setSiteSelections(prev => ({ ...prev, [siteId]: val }))
            }
            searchQuery={searchQuery}
            onSearchChange={(val) => { setSearchQuery(val); setCurrentPage(1); }}
            filterTab={filterTab}
            onFilterChange={(tab) => { setFilterTab(tab); setCurrentPage(1); }}
            mappedCount={mappedCount}
            unmappedCount={unmappedCount}
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            getCustomerName={getCustomerName}
            applyMapping={applyMapping}
            deleteMapping={deleteMapping}
          />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mapping List View (no host table loaded)
// ---------------------------------------------------------------------------

function MappingListView({
  mappings,
  filteredMappings,
  paginatedMappings,
  mappingSearchQuery,
  onSearchChange,
  mappingPage,
  totalMappingPages,
  onPageChange,
  getCustomerName,
  deleteMapping,
}) {
  if (mappings.length === 0) {
    return (
      <p className="text-sm text-slate-500 py-4 text-center">
        No hosts mapped yet. Click &quot;Load Hosts&quot; to link UniFi consoles to customers.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <Input
          placeholder="Search mapped customers or hosts..."
          value={mappingSearchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 h-9 text-sm"
        />
      </div>
      <div className="space-y-2">
        {paginatedMappings.map(mapping => {
          const isMapped = Boolean(mapping.customer_id);
          const freshness = getFreshnessDisplay(mapping.last_synced);
          return (
            <div
              key={mapping.id}
              className={cn(
                "flex items-center justify-between p-3 rounded-lg",
                isMapped ? "bg-emerald-50/60 border border-emerald-100" : "bg-slate-50 border border-slate-100",
              )}
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-2 h-2 rounded-full flex-shrink-0",
                  isMapped ? "bg-emerald-500" : "bg-slate-300",
                )} />
                <Building2 className="w-4 h-4 text-slate-400" />
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-slate-900">{getCustomerName(mapping.customer_id)}</p>
                    {isMapped && (
                      <Badge className="bg-emerald-100 text-emerald-700 font-normal text-[10px] px-1.5 py-0">
                        Mapped
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-slate-500">{'\u2192'} {mapping.unifi_site_name}</p>
                  <FreshnessBadge lastSynced={mapping.last_synced} />
                </div>
              </div>
              <Button
                variant="ghost" size="icon"
                onClick={() => deleteMapping(mapping.id)}
                className="text-red-500 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          );
        })}
      </div>
      {totalMappingPages > 1 && (
        <Pagination
          page={mappingPage}
          totalPages={totalMappingPages}
          totalItems={filteredMappings.length}
          perPage={MAPPINGS_PER_PAGE}
          onPageChange={onPageChange}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Host Table View
// ---------------------------------------------------------------------------

function HostTableView({
  paginatedSites,
  filteredSites,
  unifiSites,
  mappings,
  customers,
  siteSelections,
  onSiteSelectionChange,
  searchQuery,
  onSearchChange,
  filterTab,
  onFilterChange,
  mappedCount,
  unmappedCount,
  currentPage,
  totalPages,
  onPageChange,
  getCustomerName,
  applyMapping,
  deleteMapping,
}) {
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search hosts..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-9 w-56 h-9 text-sm"
            />
          </div>
          <div className="flex items-center border border-slate-200 rounded-lg bg-white">
            <button
              onClick={() => onFilterChange('all')}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-l-lg transition-colors",
                filterTab === 'all' ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100",
              )}
            >
              All ({unifiSites.length})
            </button>
            <button
              onClick={() => onFilterChange('mapped')}
              className={cn(
                "px-3 py-1.5 text-xs font-medium border-x border-slate-200 transition-colors",
                filterTab === 'mapped' ? "bg-emerald-600 text-white" : "text-slate-600 hover:bg-slate-100",
              )}
            >
              Mapped ({mappedCount})
            </button>
            <button
              onClick={() => onFilterChange('unmapped')}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-r-lg transition-colors",
                filterTab === 'unmapped' ? "bg-amber-600 text-white" : "text-slate-600 hover:bg-slate-100",
              )}
            >
              Unmapped ({unmappedCount})
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-4 py-3 w-[30%]">UniFi Host</th>
              <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-4 py-3 w-[25%]">Customer</th>
              <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-4 py-3 w-[25%]">Suggested Match</th>
              <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-4 py-3 w-[20%]">Freshness</th>
              <th className="text-right text-xs font-medium text-slate-500 uppercase tracking-wider px-4 py-3 w-20"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginatedSites.map(site => {
              const siteId = String(site.id);
              const existingMapping = mappings.find(m => m.unifi_site_id === siteId);
              const suggestedMatch = !existingMapping ? getSuggestedMatch(site.name, customers) : null;
              const selectedCustomerId = siteSelections[siteId] || '';
              const isMapped = Boolean(existingMapping);

              return (
                <tr
                  key={siteId}
                  className={cn(
                    "transition-colors",
                    isMapped
                      ? "bg-emerald-50/40 hover:bg-emerald-50/70"
                      : "bg-white hover:bg-slate-50",
                  )}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "w-2 h-2 rounded-full flex-shrink-0",
                        isMapped ? "bg-emerald-500" : "bg-slate-300",
                      )} />
                      <div>
                        <p className="font-medium text-slate-900 text-sm">{site.name}</p>
                        <p className="text-xs text-slate-400">{site.deviceCount || 0} devices</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {existingMapping ? (
                      <Badge className="bg-emerald-100 text-emerald-700 font-normal">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        {getCustomerName(existingMapping.customer_id)}
                      </Badge>
                    ) : (
                      <SearchableCustomerDropdown
                        customers={customers}
                        value={selectedCustomerId}
                        onChange={(val) => onSiteSelectionChange(siteId, val)}
                        className="w-44"
                      />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {!existingMapping && suggestedMatch ? (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-700">{suggestedMatch.customer.name}</span>
                        <Badge className={cn(
                          "text-xs font-normal",
                          suggestedMatch.score === 100
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-amber-100 text-amber-700",
                        )}>
                          {suggestedMatch.score}%
                        </Badge>
                      </div>
                    ) : !existingMapping ? (
                      <span className="text-sm text-slate-400">{'\u2014'}</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    {existingMapping ? (
                      <FreshnessBadge lastSynced={existingMapping.last_synced} />
                    ) : (
                      <span className="flex items-center gap-1 text-[11px] text-slate-400">
                        <AlertCircle className="w-3 h-3" />
                        Action needed
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {!existingMapping && (selectedCustomerId || suggestedMatch) ? (
                      <Button
                        size="sm"
                        onClick={() => applyMapping(site, selectedCustomerId || suggestedMatch?.customer.id)}
                        className="bg-purple-600 hover:bg-purple-700 text-white text-xs h-7 px-3"
                      >
                        Apply
                      </Button>
                    ) : existingMapping ? (
                      <Button
                        size="sm" variant="ghost"
                        onClick={() => deleteMapping(existingMapping.id)}
                        className="text-slate-400 hover:text-red-600 h-7"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-4 py-3 border-t border-slate-200 bg-slate-50">
          <Pagination
            page={currentPage}
            totalPages={totalPages}
            totalItems={filteredSites.length}
            perPage={ITEMS_PER_PAGE}
            onPageChange={onPageChange}
          />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared Pagination
// ---------------------------------------------------------------------------

function Pagination({ page, totalPages, totalItems, perPage, onPageChange }) {
  const start = ((page - 1) * perPage) + 1;
  const end = Math.min(page * perPage, totalItems);
  return (
    <div className="flex items-center justify-between pt-2">
      <p className="text-xs text-slate-500">{start}&ndash;{end} of {totalItems}</p>
      <div className="flex items-center gap-1">
        <Button
          size="sm" variant="outline"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page === 1}
          className="h-7 px-2"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <span className="text-xs text-slate-600 px-2">{page} / {totalPages}</span>
        <Button
          size="sm" variant="outline"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page === totalPages}
          className="h-7 px-2"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
