import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { client } from '@/api/client';
import { Button } from "@/components/ui/button";
import { RefreshCw, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from "@/lib/utils";
import {
  CONNECTION_STATES,
  getConnectionStatusDisplay,
  getRelativeTime,
  isStale,
  getRowStatusDot,
  getSuggestedMatch,
  IntegrationHeader,
  FilterBar,
  MappingRow,
  TablePagination,
  ITEMS_PER_PAGE,
} from './shared/IntegrationTableParts';

export default function DattoRMMConfig() {
  const [testing, setTesting] = useState(false);
  const [configStatus, setConfigStatus] = useState(CONNECTION_STATES.NOT_CONFIGURED);
  const [loadingSites, setLoadingSites] = useState(false);
  const [dattoSites, setDattoSites] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [automapping, setAutomapping] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);

  const queryClient = useQueryClient();

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => client.entities.Customer.list(),
  });

  const { data: mappings = [], refetch: refetchMappings } = useQuery({
    queryKey: ['datto_mappings'],
    queryFn: () => client.entities.DattoSiteMapping.list(),
  });

  // Auto-detect configured status from existing mappings
  useEffect(() => {
    if (mappings.length > 0 && configStatus === CONNECTION_STATES.NOT_CONFIGURED) {
      setConfigStatus(CONNECTION_STATES.CONNECTED);
    }
  }, [mappings.length, configStatus]);

  const getCustomerName = useCallback((customerId) => {
    const customer = customers.find(c => c.id === customerId);
    return customer?.name || 'Unknown';
  }, [customers]);

  const mappedSiteIds = useMemo(
    () => new Set(mappings.map(m => m.datto_site_id)),
    [mappings],
  );


  const staleCount = useMemo(
    () => mappings.filter(m => m.last_synced && isStale(m.last_synced)).length,
    [mappings],
  );

  // Build a unified list: sites from API + any mappings not in the API list
  const allRows = useMemo(() => {
    const rows = dattoSites.map(site => {
      const siteId = String(site.id || site.uid);
      const mapping = mappings.find(m => m.datto_site_id === siteId);
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
    const apiSiteIds = new Set(dattoSites.map(s => String(s.id || s.uid)));
    for (const mapping of mappings) {
      if (!apiSiteIds.has(mapping.datto_site_id)) {
        rows.push({
          siteId: mapping.datto_site_id,
          siteName: mapping.datto_site_name || mapping.datto_site_id,
          deviceCount: 0,
          mapping,
          isMapped: true,
          isStale: isStale(mapping.last_synced),
        });
      }
    }

    return rows;
  }, [dattoSites, mappings]);

  const mappedCount = useMemo(
    () => allRows.filter(r => r.isMapped).length,
    [allRows],
  );

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
      default: break;
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

  const testConnection = useCallback(async () => {
    setTesting(true);
    try {
      const response = await client.functions.invoke('syncDattoRMMDevices', { action: 'test_connection' });
      if (response.success) {
        setConfigStatus(CONNECTION_STATES.CONNECTED);
        toast.success(`Connected to ${response.account?.name || 'Datto RMM'}`);
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
  }, []);
  const loadDattoSites = useCallback(async () => {
    setLoadingSites(true);
    try {
      const response = await client.functions.invoke('syncDattoRMMDevices', { action: 'list_sites' });
      if (response.success) {
        setDattoSites(response.sites || []);
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
  }, []);
  const applyMapping = useCallback(async (siteId, siteName, customer) => {
    if (!customer) return;
    try {
      await client.entities.DattoSiteMapping.create({
        customer_id: customer.id,
        datto_site_id: siteId,
        datto_site_name: siteName,
      });
      toast.success(`Mapped ${siteName} to ${customer.name}`);
      refetchMappings();
    } catch (error) {
      toast.error(`Failed to map: ${error.message}`);
    }
  }, [refetchMappings]);
  const deleteMapping = useCallback(async (mappingId) => {
    try {
      await client.entities.DattoSiteMapping.delete(mappingId);
      toast.success('Mapping removed');
      refetchMappings();
    } catch (error) {
      toast.error(`Failed to remove mapping: ${error.message}`);
    }
  }, [refetchMappings]);
  const autoMapSites = useCallback(async () => {
    setAutomapping(true);
    try {
      const response = await client.functions.invoke('syncDattoRMMDevices', { action: 'automap' });
      if (response.success) {
        if (response.mappedCount > 0) {
          toast.success(`Auto-mapped ${response.mappedCount} sites to customers!`);
        } else {
          toast.info('No new matches found. Sites may already be mapped or names do not match.');
        }
        refetchMappings();
      } else {
        toast.error(response.error || 'Auto-map failed');
      }
    } catch (error) {
      toast.error(error.message || 'Auto-map failed');
    } finally {
      setAutomapping(false);
    }
  }, [refetchMappings]);
  const syncAllDevices = useCallback(async () => {
    if (mappings.length === 0) return;
    setSyncing(true);
    try {
      const response = await client.functions.invoke('syncDattoRMMDevices', { action: 'sync_all' });
      if (response.success) {
        toast.success(`Synced ${response.recordsSynced} devices!`);
        queryClient.invalidateQueries({ queryKey: ['devices'] });
        queryClient.invalidateQueries({ queryKey: ['datto_mappings'] });
      } else {
        toast.error(response.error || 'Sync failed');
      }
    } catch (error) {
      toast.error(error.message || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  }, [mappings.length, queryClient]);

  const hasData = dattoSites.length > 0 || mappings.length > 0;

  return (
    <div className="space-y-3">
      {/* Header Bar */}
      <IntegrationHeader
        statusDisplay={statusDisplay}
        integrationName="Datto RMM"
        hasData={hasData}
        mappedCount={mappedCount}
        totalCount={totalSites}
      >
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
          onClick={loadDattoSites}
          disabled={loadingSites}
          className="h-7 text-xs px-2.5"
        >
          <RefreshCw className={cn("w-3 h-3 mr-1", loadingSites && "animate-spin")} />
          Refresh
        </Button>
        <Button
          size="sm" variant="outline"
          onClick={autoMapSites}
          disabled={automapping}
          className="h-7 text-xs px-2.5 text-blue-600 border-blue-200 hover:bg-blue-50"
        >
          <Zap className={cn("w-3 h-3 mr-1", automapping && "animate-spin")} />
          Auto-Map
        </Button>
        <Button
          size="sm"
          onClick={syncAllDevices}
          disabled={syncing || mappings.length === 0}
          className="h-7 text-xs px-2.5 bg-slate-900 hover:bg-slate-800 text-white"
        >
          <RefreshCw className={cn("w-3 h-3 mr-1", syncing && "animate-spin")} />
          {syncing ? 'Syncing...' : 'Sync All'}
        </Button>
      </IntegrationHeader>

      {/* Filter Tabs + Search */}
      <FilterBar
        filterTab={filterTab}
        setFilterTab={setFilterTab}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        totalCount={totalSites}
        mappedCount={mappedCount}
        unmappedCount={unmappedCount}
        staleCount={staleCount}
        onPageReset={() => setCurrentPage(1)}
        searchPlaceholder="Search sites or customers..."
      />

      {/* Main Table */}
      {!hasData ? (
        <div className="text-center py-10 text-sm text-slate-500 border border-slate-200 rounded-lg">
          No sites loaded. Click <strong>Refresh</strong> to pull Datto RMM sites or <strong>Test</strong> to verify the connection.
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

function SiteRow({ row, customers, getCustomerName, onMap, onDelete, isOdd }) {
  const suggestedMatch = useMemo(
    () => (!row.isMapped ? getSuggestedMatch(row.siteName, customers) : null),
    [row.isMapped, row.siteName, customers],
  );

  const syncTime = row.mapping ? getRelativeTime(row.mapping.last_synced) : null;
  const statusDot = getRowStatusDot(row.mapping);

  const handleResync = useCallback(async () => {
    if (!row.mapping) return;
    try {
      await client.functions.invoke('syncDattoRMMDevices', {
        action: 'sync_all',
      });
      toast.success(`Re-synced ${row.siteName}`);
    } catch (err) {
      toast.error(`Sync failed: ${err.message}`);
    }
  }, [row.mapping, row.siteName]);

  return (
    <MappingRow
      statusDot={statusDot}
      itemName={row.siteName}
      countValue={row.deviceCount}
      countLabel="devices"
      isMapped={row.isMapped}
      customerName={row.isMapped ? getCustomerName(row.mapping.customer_id) : null}
      syncTime={syncTime}
      suggestedMatch={suggestedMatch}
      customers={customers}
      onMap={onMap}
      onDelete={onDelete}
      onResync={handleResync}
      isStaleRow={row.isStale}
      isOdd={isOdd}
    />
  );
}
