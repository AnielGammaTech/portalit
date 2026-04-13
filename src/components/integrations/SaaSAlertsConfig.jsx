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

export default function SaaSAlertsConfig() {
  const [testing, setTesting] = useState(false);
  const [configStatus, setConfigStatus] = useState(CONNECTION_STATES.NOT_CONFIGURED);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [saasCustomers, setSaasCustomers] = useState([]);
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
    queryKey: ['saas_alerts_mappings'],
    queryFn: () => client.entities.SaaSAlertsMapping.list(),
  });

  useEffect(() => {
    if (mappings.length > 0 && configStatus === CONNECTION_STATES.NOT_CONFIGURED) {
      setConfigStatus(CONNECTION_STATES.CONNECTED);
    }
  }, [mappings.length, configStatus]);

  const getCustomerName = useCallback((customerId) => {
    const customer = customers.find(c => c.id === customerId);
    return customer?.name || 'Unknown';
  }, [customers]);

  const mappedSaasIds = useMemo(
    () => new Set(mappings.map(m => m.saas_alerts_customer_id)),
    [mappings],
  );


  const staleCount = useMemo(
    () => mappings.filter(m => m.last_synced && isStale(m.last_synced)).length,
    [mappings],
  );

  // Build unified list: API customers + orphaned mappings
  const allRows = useMemo(() => {
    const rows = saasCustomers.map(sc => {
      const saasId = String(sc.id);
      const mapping = mappings.find(m => m.saas_alerts_customer_id === saasId);
      return {
        saasId,
        saasName: sc.name,
        eventCount: sc.eventCount || sc.event_count || 0,
        mapping,
        isMapped: Boolean(mapping),
        isStale: mapping ? isStale(mapping.last_synced) : false,
      };
    });

    const apiIds = new Set(saasCustomers.map(sc => String(sc.id)));
    for (const mapping of mappings) {
      if (!apiIds.has(mapping.saas_alerts_customer_id)) {
        rows.push({
          saasId: mapping.saas_alerts_customer_id,
          saasName: mapping.saas_alerts_customer_name || mapping.saas_alerts_customer_id,
          eventCount: 0,
          mapping,
          isMapped: true,
          isStale: isStale(mapping.last_synced),
        });
      }
    }

    return rows;
  }, [saasCustomers, mappings]);

  const mappedCount = useMemo(
    () => allRows.filter(r => r.isMapped).length,
    [allRows],
  );

  const totalItems = allRows.length;
  const unmappedCount = totalItems - mappedCount;

  const filteredRows = useMemo(() => {
    let rows = allRows;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      rows = rows.filter(r =>
        r.saasName.toLowerCase().includes(q) ||
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

  // ---- API actions (unchanged logic) ----

  const testConnection = useCallback(async () => {
    setTesting(true);
    try {
      const response = await client.functions.invoke('syncSaaSAlerts', { action: 'test_connection' });
      if (response.success) {
        setConfigStatus(CONNECTION_STATES.CONNECTED);
        toast.success(`Connected! Found ${response.totalCustomers || 0} customers.`);
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

  const loadSaaSCustomers = useCallback(async () => {
    setLoadingCustomers(true);
    try {
      const response = await client.functions.invoke('syncSaaSAlerts', { action: 'list_customers' });
      if (response.success) {
        setSaasCustomers(response.customers || []);
        setCurrentPage(1);
        setConfigStatus(CONNECTION_STATES.CONNECTED);
      } else {
        toast.error(response.error || 'Failed to load customers');
      }
    } catch (error) {
      toast.error(error.message || 'Failed to load customers');
    } finally {
      setLoadingCustomers(false);
    }
  }, []);

  const applyMapping = useCallback(async (saasId, saasName, customer) => {
    if (!customer) return;
    try {
      await client.entities.SaaSAlertsMapping.create({
        customer_id: customer.id,
        customer_name: customer.name,
        saas_alerts_customer_id: saasId,
        saas_alerts_customer_name: saasName,
      });
      toast.success(`Mapped ${saasName} to ${customer.name}`);
      refetchMappings();
    } catch (error) {
      toast.error(`Failed to map: ${error.message}`);
    }
  }, [refetchMappings]);

  const deleteMapping = useCallback(async (mappingId) => {
    try {
      await client.entities.SaaSAlertsMapping.delete(mappingId);
      toast.success('Mapping removed');
      refetchMappings();
    } catch (error) {
      toast.error(`Failed to remove mapping: ${error.message}`);
    }
  }, [refetchMappings]);

  const autoMapCustomers = useCallback(async () => {
    setAutomapping(true);
    let mapped = 0;
    try {
      for (const sc of saasCustomers) {
        const saasId = String(sc.id);
        if (mappedSaasIds.has(saasId)) continue;

        const match = getSuggestedMatch(sc.name, customers);
        if (match && match.score >= 80) {
          const alreadyLinked = mappings.some(m => m.customer_id === match.customer.id);
          if (!alreadyLinked) {
            await client.entities.SaaSAlertsMapping.create({
              customer_id: match.customer.id,
              customer_name: match.customer.name,
              saas_alerts_customer_id: saasId,
              saas_alerts_customer_name: sc.name,
            });
            mapped++;
          }
        }
      }
      if (mapped > 0) {
        toast.success(`Auto-mapped ${mapped} customer(s)!`);
        refetchMappings();
      } else {
        toast.info('No new matches found.');
      }
    } catch (error) {
      toast.error('Auto-map failed: ' + error.message);
    } finally {
      setAutomapping(false);
    }
  }, [saasCustomers, mappedSaasIds, customers, mappings, refetchMappings]);

  const syncAllAlerts = useCallback(async () => {
    if (mappings.length === 0) return;
    setSyncing(true);
    try {
      const response = await client.functions.invoke('syncSaaSAlerts', { action: 'sync_all' });
      if (response.success) {
        toast.success(`Synced ${response.synced} customer(s)!`);
        queryClient.invalidateQueries({ queryKey: ['saas_alerts_mappings'] });
      } else {
        toast.error(response.error || 'Sync failed');
      }
    } catch (error) {
      toast.error(error.message || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  }, [mappings.length, queryClient]);

  const hasData = saasCustomers.length > 0 || mappings.length > 0;

  return (
    <div className="space-y-3">
      {/* Header Bar */}
      <IntegrationHeader
        statusDisplay={statusDisplay}
        integrationName="SaaS Alerts"
        hasData={hasData}
        mappedCount={mappedCount}
        totalCount={totalItems}
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
          onClick={loadSaaSCustomers}
          disabled={loadingCustomers}
          className="h-7 text-xs px-2.5"
        >
          <RefreshCw className={cn("w-3 h-3 mr-1", loadingCustomers && "animate-spin")} />
          Refresh
        </Button>
        <Button
          size="sm" variant="outline"
          onClick={autoMapCustomers}
          disabled={automapping}
          className="h-7 text-xs px-2.5 text-blue-600 border-blue-200 hover:bg-blue-50"
        >
          <Zap className={cn("w-3 h-3 mr-1", automapping && "animate-spin")} />
          Auto-Map
        </Button>
        <Button
          size="sm"
          onClick={syncAllAlerts}
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
        totalCount={totalItems}
        mappedCount={mappedCount}
        unmappedCount={unmappedCount}
        staleCount={staleCount}
        onPageReset={() => setCurrentPage(1)}
        searchPlaceholder="Search tenants or customers..."
      />

      {/* Main Table */}
      {!hasData ? (
        <div className="text-center py-10 text-sm text-slate-500 border border-slate-200 rounded-lg">
          No tenants loaded. Click <strong>Refresh</strong> to pull SaaS Alerts customers or <strong>Test</strong> to verify the connection.
        </div>
      ) : (
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-3 py-2 w-10" />
                  <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-3 py-2">Customer / Account</th>
                  <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-3 py-2 w-16">Events</th>
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
                      key={row.saasId}
                      row={row}
                      customers={customers}
                      getCustomerName={getCustomerName}
                      onMap={(customer) => applyMapping(row.saasId, row.saasName, customer)}
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

function TenantRow({ row, customers, getCustomerName, onMap, onDelete, isOdd }) {
  const suggestedMatch = useMemo(
    () => (!row.isMapped ? getSuggestedMatch(row.saasName, customers) : null),
    [row.isMapped, row.saasName, customers],
  );

  const syncTime = row.mapping ? getRelativeTime(row.mapping.last_synced) : null;
  const statusDot = getRowStatusDot(row.mapping);

  const handleResync = useCallback(async () => {
    if (!row.mapping) return;
    try {
      await client.functions.invoke('syncSaaSAlerts', { action: 'sync_all' });
      toast.success(`Re-synced ${row.saasName}`);
    } catch (err) {
      toast.error(`Sync failed: ${err.message}`);
    }
  }, [row.mapping, row.saasName]);

  return (
    <MappingRow
      statusDot={statusDot}
      itemName={row.saasName}
      countValue={row.eventCount}
      countLabel="events"
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
