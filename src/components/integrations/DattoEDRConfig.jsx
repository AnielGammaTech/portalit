import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { client, supabase } from '@/api/client';
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

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function DattoEDRConfig() {
  const [testing, setTesting] = useState(false);
  const [connectionSuccess, setConnectionSuccess] = useState(null);
  const [loadingTenants, setLoadingTenants] = useState(false);
  const [edrTenants, setEdrTenants] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [automapping, setAutomapping] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);

  const queryClient = useQueryClient();

  // --- Data queries (unchanged entity names & query keys) ---

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => client.entities.Customer.filter({ status: 'active' }),
  });

  const { data: mappings = [], isLoading: loadingMappings, refetch: refetchMappings } = useQuery({
    queryKey: ['datto-edr-mappings'],
    queryFn: () => client.entities.DattoEDRMapping.list(),
  });

  // --- Sync log ---

  const fetchLastSync = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('sync_logs')
        .select('completed_at')
        .eq('source', 'datto_edr')
        .eq('status', 'success')
        .order('completed_at', { ascending: false })
        .limit(1);
      // last sync is informational only; no state needed beyond the query
      return data?.[0]?.completed_at ?? null;
    } catch (_err) {
      return null;
    }
  }, []);

  useEffect(() => {
    fetchLastSync();
  }, [fetchLastSync]);

  // --- Derived data ---

  const configStatus = loadingMappings ? CONNECTION_STATES.CONFIGURED : (mappings.length > 0 ? CONNECTION_STATES.CONNECTED : CONNECTION_STATES.NOT_CONFIGURED);

  const getCustomerName = useCallback((customerId) => {
    const customer = customers.find(c => c.id === customerId);
    return customer?.name || 'Unknown';
  }, [customers]);

  const allRows = useMemo(() => {
    const normalizeId = (val) => String(val ?? '').trim();

    const mappingsByNormalizedId = new Map(
      mappings.map(m => [normalizeId(m.edr_tenant_id), m]),
    );

    const rows = edrTenants.map(tenant => {
      const tenantId = normalizeId(tenant.id);
      const mapping = mappingsByNormalizedId.get(tenantId);
      return {
        tenantId,
        tenantName: tenant.name,
        hostCount: tenant.deviceCount || tenant.host_count || 0,
        mapping,
        isMapped: Boolean(mapping),
        isStale: mapping ? isStale(mapping.last_synced) : false,
      };
    });

    const apiTenantIds = new Set(edrTenants.map(t => normalizeId(t.id)));
    for (const mapping of mappings) {
      if (!apiTenantIds.has(normalizeId(mapping.edr_tenant_id))) {
        rows.push({
          tenantId: normalizeId(mapping.edr_tenant_id),
          tenantName: mapping.edr_tenant_name || mapping.edr_tenant_id,
          hostCount: mapping.cached_data?.hostCount || 0,
          mapping,
          isMapped: true,
          isStale: isStale(mapping.last_synced),
        });
      }
    }

    return rows;
  }, [edrTenants, mappings]);

  const totalTenants = allRows.length;

  const mappedCount = useMemo(
    () => allRows.filter(r => r.isMapped).length,
    [allRows],
  );

  const unmappedCount = totalTenants - mappedCount;

  const staleCount = useMemo(
    () => mappings.filter(m => m.last_synced && isStale(m.last_synced)).length,
    [mappings],
  );

  const filteredRows = useMemo(() => {
    let rows = allRows;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      rows = rows.filter(r =>
        r.tenantName.toLowerCase().includes(q) ||
        (r.mapping && getCustomerName(r.mapping.customer_id).toLowerCase().includes(q)),
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

  // --- Actions (all original API calls preserved) ---

  const testConnection = useCallback(async () => {
    setTesting(true);
    setConnectionError(null);
    try {
      const response = await client.functions.invoke('syncDattoEDR', { action: 'test_connection' });
      if (response.success) {
        setConnectionError(null);
        setConnectionSuccess(response.message || 'Connected to Datto EDR');
        setTimeout(() => setConnectionSuccess(null), 8000);
      } else {
        setConnectionSuccess(null);
        setConnectionError(response.error || 'Connection failed');
      }
    } catch (error) {
      setConnectionSuccess(null);
      setConnectionError(error.message || 'Connection test failed');
    } finally {
      setTesting(false);
    }
  }, []);

  const loadEDRTenants = useCallback(async () => {
    setLoadingTenants(true);
    try {
      const response = await client.functions.invoke('syncDattoEDR', { action: 'list_tenants' });
      if (response.success) {
        setEdrTenants(response.tenants || []);
        setCurrentPage(1);
        setConnectionError(null);
        toast.success(`Found ${response.tenants?.length || 0} EDR tenants`);
      } else {
        setConnectionError(response.error || 'Failed to fetch tenants');
        toast.error(response.error || 'Failed to fetch tenants');
      }
    } catch (error) {
      setConnectionError(error.message || 'Failed to connect to Datto EDR');
      toast.error(error.message || 'Failed to connect to Datto EDR');
    } finally {
      setLoadingTenants(false);
    }
  }, []);

  const applyMapping = useCallback(async (tenantId, tenantName, customer) => {
    if (!customer) return;
    try {
      const existingMapping = mappings.find(m => m.customer_id === customer.id);
      if (existingMapping) {
        await client.entities.DattoEDRMapping.update(existingMapping.id, {
          edr_tenant_id: tenantId,
          edr_tenant_name: tenantName,
        });
      } else {
        await client.entities.DattoEDRMapping.create({
          customer_id: customer.id,
          customer_name: customer.name,
          edr_tenant_id: tenantId,
          edr_tenant_name: tenantName,
        });
      }
      toast.success(`Mapped ${tenantName} to ${customer.name}`);
      refetchMappings();
    } catch (error) {
      toast.error(`Failed to map: ${error.message}`);
    }
  }, [mappings, refetchMappings]);

  const deleteMapping = useCallback(async (mappingId) => {
    try {
      await client.entities.DattoEDRMapping.delete(mappingId);
      toast.success('Mapping removed');
      refetchMappings();
    } catch (error) {
      toast.error(`Failed to remove mapping: ${error.message}`);
    }
  }, [refetchMappings]);

  const autoMapTenants = useCallback(async () => {
    if (edrTenants.length === 0) {
      toast.error('Load tenants first before auto-mapping');
      return;
    }
    setAutomapping(true);
    let mapped = 0;
    try {
      const mappedCustomerIds = new Set(mappings.map(m => m.customer_id));
      const mappedTenantSet = new Set(mappings.map(m => m.edr_tenant_id));

      for (const tenant of edrTenants) {
        if (mappedTenantSet.has(String(tenant.id))) continue;
        const match = getSuggestedMatch(tenant.name, customers);
        if (match && !mappedCustomerIds.has(match.customer.id)) {
          await client.entities.DattoEDRMapping.create({
            customer_id: match.customer.id,
            customer_name: match.customer.name,
            edr_tenant_id: String(tenant.id),
            edr_tenant_name: tenant.name,
          });
          mappedCustomerIds.add(match.customer.id);
          mappedTenantSet.add(String(tenant.id));
          mapped++;
        }
      }
      if (mapped > 0) {
        toast.success(`Auto-mapped ${mapped} tenants to customers!`);
        refetchMappings();
      } else {
        toast.info('No new matches found. Tenants may already be mapped or names do not match.');
      }
    } catch (error) {
      toast.error('Auto-map failed: ' + error.message);
    } finally {
      setAutomapping(false);
    }
  }, [edrTenants, mappings, customers, refetchMappings]);

  const syncAll = useCallback(async () => {
    if (mappings.length === 0) return;
    setSyncing(true);
    try {
      const response = await client.functions.invoke('syncDattoEDR', { action: 'sync_all' });
      if (response.success) {
        toast.success(`Synced ${response.synced || 0} customers`);
        refetchMappings();
        fetchLastSync();
      } else {
        toast.error(response.error || 'Sync failed');
      }
    } catch (error) {
      toast.error(error.message || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  }, [mappings.length, refetchMappings, fetchLastSync]);

  // --- Render ---

  const hasData = edrTenants.length > 0 || mappings.length > 0;

  return (
    <div className="space-y-3">
      {/* Header Bar */}
      <IntegrationHeader
        statusDisplay={statusDisplay}
        integrationName="Datto EDR"
        hasData={hasData}
        mappedCount={mappedCount}
        totalCount={totalTenants}
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
          onClick={loadEDRTenants}
          disabled={loadingTenants}
          className="h-7 text-xs px-2.5"
        >
          <RefreshCw className={cn("w-3 h-3 mr-1", loadingTenants && "animate-spin")} />
          Refresh
        </Button>
        <Button
          size="sm" variant="outline"
          onClick={autoMapTenants}
          disabled={automapping}
          className="h-7 text-xs px-2.5 text-blue-600 border-blue-200 hover:bg-blue-50"
        >
          <Zap className={cn("w-3 h-3 mr-1", automapping && "animate-spin")} />
          Auto-Map
        </Button>
        <Button
          size="sm"
          onClick={syncAll}
          disabled={syncing || mappings.length === 0}
          className="h-7 text-xs px-2.5 bg-slate-900 hover:bg-slate-800 text-white"
        >
          <RefreshCw className={cn("w-3 h-3 mr-1", syncing && "animate-spin")} />
          {syncing ? 'Syncing...' : 'Sync All'}
        </Button>
      </IntegrationHeader>

      {/* Connection Success Banner */}
      {connectionSuccess && (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700">
          <span className="text-sm font-medium flex-shrink-0">Connected:</span>
          <span className="text-sm">{connectionSuccess}</span>
          <button
            type="button"
            onClick={() => setConnectionSuccess(null)}
            className="ml-auto text-emerald-400 hover:text-emerald-600 text-xs flex-shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Connection Error Banner */}
      {connectionError && (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700">
          <span className="text-sm font-medium flex-shrink-0">Connection Error:</span>
          <span className="text-sm">{connectionError}</span>
          <button
            type="button"
            onClick={() => setConnectionError(null)}
            className="ml-auto text-red-400 hover:text-red-600 text-xs flex-shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Filter Tabs + Search */}
      <FilterBar
        filterTab={filterTab}
        setFilterTab={setFilterTab}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        totalCount={totalTenants}
        mappedCount={mappedCount}
        unmappedCount={unmappedCount}
        staleCount={staleCount}
        onPageReset={() => setCurrentPage(1)}
        searchPlaceholder="Search tenants or customers..."
      />

      {/* Main Table */}
      {!hasData ? (
        <div className="text-center py-10 text-sm text-slate-500 border border-slate-200 rounded-lg">
          No tenants loaded. Click <strong>Refresh</strong> to pull Datto EDR tenants or <strong>Test</strong> to verify the connection.
        </div>
      ) : (
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-3 py-2 w-10" />
                  <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-3 py-2">Tenant</th>
                  <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-3 py-2 w-16">Hosts</th>
                  <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-3 py-2">Customer</th>
                  <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-3 py-2 w-24">Last Sync</th>
                  <th className="text-right text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-3 py-2 w-20" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-6 text-xs text-slate-400">
                      No tenants match the current filter.
                    </td>
                  </tr>
                ) : (
                  paginatedRows.map((row, idx) => (
                    <TenantRow
                      key={row.tenantId}
                      row={row}
                      customers={customers}
                      getCustomerName={getCustomerName}
                      onMap={(customer) => applyMapping(row.tenantId, row.tenantName, customer)}
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
// Row Component
// ---------------------------------------------------------------------------

function TenantRow({ row, customers, getCustomerName, onMap, onDelete, isOdd }) {
  const suggestedMatch = useMemo(
    () => (!row.isMapped ? getSuggestedMatch(row.tenantName, customers) : null),
    [row.isMapped, row.tenantName, customers],
  );

  const syncTime = row.mapping ? getRelativeTime(row.mapping.last_synced) : null;
  const statusDot = getRowStatusDot(row.mapping);

  const [resyncing, setResyncing] = useState(false);
  const queryClient = useQueryClient();

  const handleResync = useCallback(async () => {
    if (!row.mapping) return;
    setResyncing(true);
    try {
      const response = await client.functions.invoke('syncDattoEDR', {
        action: 'sync_customer',
        customer_id: row.mapping.customer_id,
      });
      if (response.success) {
        toast.success(`Synced ${row.tenantName} — ${response.data?.hostCount || 0} hosts`);
        queryClient.invalidateQueries({ queryKey: ['datto-edr-mappings'] });
      } else {
        toast.error(response.error || `Sync failed for ${row.tenantName}`);
      }
    } catch (err) {
      toast.error(`Sync failed: ${err.message}`);
    } finally {
      setResyncing(false);
    }
  }, [row.mapping, row.tenantName, queryClient]);

  return (
    <MappingRow
      statusDot={statusDot}
      itemName={row.tenantName}
      countValue={row.hostCount}
      countLabel="hosts"
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
