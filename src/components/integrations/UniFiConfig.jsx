import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { client } from '@/api/client';
import { Button } from "@/components/ui/button";
import { RefreshCw, Info, Bug, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from "@/lib/utils";
import {
  CONNECTION_STATES, ITEMS_PER_PAGE,
  getConnectionStatusDisplay, getRelativeTime, isStale, getRowStatusDot, getSuggestedMatch,
  IntegrationHeader, FilterBar, MappingRow, TablePagination,
} from './shared/IntegrationTableParts';

const SYNC_TIMEOUT_MS = 30_000;

function ApiKeyTooltip() {
  const [show, setShow] = useState(false);
  return (
    <div className="relative inline-block">
      <button type="button" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)} className="text-slate-400 hover:text-slate-600">
        <Info className="w-3.5 h-3.5" />
      </button>
      {show && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-56 p-2 bg-slate-900 text-white text-[10px] rounded-md shadow-lg">
          <p>API key configured via environment variable <code className="bg-slate-700 px-1 rounded">unifi_api_key</code>.</p>
          <p className="mt-1">
            Get yours at{' '}
            <a href="https://developer.ui.com" target="_blank" rel="noopener noreferrer" className="text-blue-300 underline">developer.ui.com</a>
          </p>
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
        </div>
      )}
    </div>
  );
}

export default function UniFiConfig() {
  const [testing, setTesting] = useState(false);
  // configStatus is now derived from data, not manual state
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
  const { data: mappings = [], isLoading: loadingMappings, refetch: refetchMappings } = useQuery({
    queryKey: ['unifi_mappings'],
    queryFn: () => client.entities.UniFiMapping.list(),
  });

  useEffect(() => {
    if (mappings.length > 0 && configStatus === CONNECTION_STATES.NOT_CONFIGURED) {
          }
  }, [mappings.length, configStatus]);

  // -- Derived data --

    const configStatus = loadingMappings ? CONNECTION_STATES.CONFIGURED : (mappings.length > 0 ? CONNECTION_STATES.CONNECTED : CONNECTION_STATES.NOT_CONFIGURED);

  const getCustomerName = useCallback((customerId) => {
    const customer = customers.find(c => c.id === customerId);
    return customer?.name || 'Unknown';
  }, [customers]);

  const mappedSiteIds = useMemo(() => new Set(mappings.map(m => m.unifi_site_id)), [mappings]);
  const staleCount = useMemo(() => mappings.filter(m => m.last_synced && isStale(m.last_synced)).length, [mappings]);

  const allRows = useMemo(() => {
    const rows = unifiSites.map(site => {
      const siteId = String(site.id);
      const mapping = mappings.find(m => m.unifi_site_id === siteId);
      return { siteId, siteName: site.name, deviceCount: site.deviceCount || 0, mapping, isMapped: Boolean(mapping), isStale: mapping ? isStale(mapping.last_synced) : false };
    });
    const apiSiteIds = new Set(unifiSites.map(s => String(s.id)));
    for (const mapping of mappings) {
      if (!apiSiteIds.has(mapping.unifi_site_id)) {
        rows.push({ siteId: mapping.unifi_site_id, siteName: mapping.unifi_site_name || mapping.unifi_site_id, deviceCount: 0, mapping, isMapped: true, isStale: isStale(mapping.last_synced) });
      }
    }
    return rows;
  }, [unifiSites, mappings]);

  const mappedCount = useMemo(() => allRows.filter(r => r.isMapped).length, [allRows]);

  const totalSites = allRows.length;
  const unmappedCount = totalSites - mappedCount;

  const filteredRows = useMemo(() => {
    let rows = allRows;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      rows = rows.filter(r => r.siteName.toLowerCase().includes(q) || (r.mapping && getCustomerName(r.mapping.customer_id).toLowerCase().includes(q)));
    }
    switch (filterTab) {
      case 'mapped': rows = rows.filter(r => r.isMapped); break;
      case 'unmapped': rows = rows.filter(r => !r.isMapped); break;
      case 'stale': rows = rows.filter(r => r.isStale); break;
      default: break;
    }
    return rows;
  }, [allRows, searchQuery, filterTab, getCustomerName]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedRows = filteredRows.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE);
  const statusDisplay = getConnectionStatusDisplay(configStatus);

  // -- Actions --

  const testConnection = useCallback(async () => {
    setTesting(true);
    try {
      const response = await client.functions.invoke('syncUniFiDevices', { action: 'list_sites' });
      if (response.success) {
                toast.success(`Connected! Found ${response.sites?.length || 0} sites.`);
      } else {
                toast.error(response.error || 'Connection failed');
      }
    } catch (error) {
            toast.error(error.message || 'Connection test failed');
    } finally {
      setTesting(false);
    }
  }, []);

  const loadUnifiSites = useCallback(async () => {
    setLoadingSites(true);
    try {
      const response = await client.functions.invoke('syncUniFiDevices', { action: 'list_sites' });
      if (response.success) {
        setUnifiSites(response.sites || []);
        setCurrentPage(1);
              } else {
        toast.error(response.error || 'Failed to load sites');
      }
    } catch (error) {
      toast.error(error.message || 'Failed to load sites');
    } finally {
      setLoadingSites(false);
    }
  }, []);

  const applyMapping = useCallback(async (siteId, siteName, customer) => {
    if (!customer) return;
    try {
      await client.entities.UniFiMapping.create({ customer_id: customer.id, customer_name: customer.name, unifi_site_id: siteId, unifi_site_name: siteName });
      toast.success(`Mapped ${siteName} to ${customer.name}`);
      refetchMappings();
    } catch (error) {
      toast.error(`Failed to map: ${error.message}`);
    }
  }, [refetchMappings]);

  const deleteMapping = useCallback(async (mappingId) => {
    try {
      await client.entities.UniFiMapping.delete(mappingId);
      toast.success('Mapping removed');
      refetchMappings();
    } catch (error) {
      toast.error(`Failed to remove mapping: ${error.message}`);
    }
  }, [refetchMappings]);

  const syncAllDevices = useCallback(async () => {
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
        await client.functions.invoke('syncUniFiDevices', { action: 'sync_one', mapping_id: mapping.id });
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
  }, [mappings, queryClient]);

  const autoMapByName = useCallback(async () => {
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
  }, [loadUnifiSites, queryClient]);

  const debugApi = useCallback(async () => {
    try {
      const res = await client.functions.invoke('syncUniFiDevices', { action: 'debug_api' });
      console.log('UniFi Debug:', JSON.stringify(res, null, 2));
      toast.success('Debug output in console (F12)');
    } catch (err) {
      toast.error(err.message);
    }
  }, []);

  // -- Render --

  const hasData = unifiSites.length > 0 || mappings.length > 0;
  const thClass = "text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-3 py-2";

  return (
    <div className="space-y-3">
      <IntegrationHeader statusDisplay={statusDisplay} integrationName="UniFi Network" hasData={hasData} mappedCount={mappedCount} totalCount={totalSites}>
        <ApiKeyTooltip />
        <Button size="sm" variant="outline" onClick={testConnection} disabled={testing} className="h-7 text-xs px-2.5">
          <RefreshCw className={cn("w-3 h-3 mr-1", testing && "animate-spin")} /> Test
        </Button>
        <Button size="sm" variant="outline" onClick={loadUnifiSites} disabled={loadingSites} className="h-7 text-xs px-2.5">
          <RefreshCw className={cn("w-3 h-3 mr-1", loadingSites && "animate-spin")} /> Refresh
        </Button>
        <Button size="sm" variant="outline" onClick={autoMapByName} className="h-7 text-xs px-2.5 text-blue-600 border-blue-200 hover:bg-blue-50">
          <Zap className="w-3 h-3 mr-1" /> Auto-Map
        </Button>
        <Button size="sm" onClick={syncAllDevices} disabled={syncing || mappings.length === 0} className="h-7 text-xs px-2.5 bg-slate-900 hover:bg-slate-800 text-white">
          <RefreshCw className={cn("w-3 h-3 mr-1", syncing && "animate-spin")} />
          {syncing ? `${syncProgress.current}/${syncProgress.total}` : 'Sync All'}
        </Button>
        <Button size="sm" variant="ghost" onClick={debugApi} className="h-7 text-xs px-2 text-slate-400 hover:text-slate-600" title="Debug API (logs to console)">
          <Bug className="w-3 h-3" />
        </Button>
      </IntegrationHeader>

      <FilterBar
        filterTab={filterTab} setFilterTab={setFilterTab}
        searchQuery={searchQuery} setSearchQuery={setSearchQuery}
        totalCount={totalSites} mappedCount={mappedCount} unmappedCount={unmappedCount} staleCount={staleCount}
        onPageReset={() => setCurrentPage(1)} searchPlaceholder="Search sites or customers..."
      />

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
                  <th className={cn(thClass, "w-10")} />
                  <th className={thClass}>Site</th>
                  <th className={cn(thClass, "w-16")}>Devices</th>
                  <th className={thClass}>Customer</th>
                  <th className={cn(thClass, "w-24")}>Last Sync</th>
                  <th className={cn(thClass, "text-right w-20")} />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedRows.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-6 text-xs text-slate-400">No sites match the current filter.</td></tr>
                ) : (
                  paginatedRows.map((row, idx) => (
                    <SiteRow
                      key={row.siteId} row={row} customers={customers} getCustomerName={getCustomerName}
                      onMap={(customer) => applyMapping(row.siteId, row.siteName, customer)}
                      onDelete={() => row.mapping && deleteMapping(row.mapping.id)} isOdd={idx % 2 === 1}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
          {filteredRows.length > ITEMS_PER_PAGE && (
            <TablePagination page={safePage} totalPages={totalPages} totalItems={filteredRows.length} perPage={ITEMS_PER_PAGE} onPageChange={setCurrentPage} />
          )}
        </div>
      )}
    </div>
  );
}

function SiteRow({ row, customers, getCustomerName, onMap, onDelete, isOdd }) {
  const suggestedMatch = useMemo(() => (!row.isMapped ? getSuggestedMatch(row.siteName, customers) : null), [row.isMapped, row.siteName, customers]);
  const syncTime = row.mapping ? getRelativeTime(row.mapping.last_synced) : null;
  const statusDot = getRowStatusDot(row.mapping);

  const handleResync = useCallback(async () => {
    if (!row.mapping) return;
    try {
      await client.functions.invoke('syncUniFiDevices', { action: 'sync_one', mapping_id: row.mapping.id });
      toast.success(`Re-synced ${row.siteName}`);
    } catch (err) {
      toast.error(`Sync failed: ${err.message}`);
    }
  }, [row.mapping, row.siteName]);

  return (
    <MappingRow
      statusDot={statusDot} itemName={row.siteName} countValue={row.deviceCount} countLabel="devices"
      isMapped={row.isMapped} customerName={row.isMapped ? getCustomerName(row.mapping.customer_id) : null}
      syncTime={syncTime} suggestedMatch={suggestedMatch} customers={customers}
      onMap={onMap} onDelete={onDelete} onResync={handleResync} isStaleRow={row.isStale} isOdd={isOdd}
    />
  );
}
