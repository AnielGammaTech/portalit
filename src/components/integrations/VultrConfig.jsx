import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { client } from '@/api/client';
import { Button } from "@/components/ui/button";
import { RefreshCw } from 'lucide-react';
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

export default function VultrConfig() {
  const [testing, setTesting] = useState(false);
  const [configStatus, setConfigStatus] = useState(CONNECTION_STATES.NOT_CONFIGURED);
  const [loadingInstances, setLoadingInstances] = useState(false);
  const [vultrInstances, setVultrInstances] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);

  const queryClient = useQueryClient();

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => client.entities.Customer.list(),
  });

  const { data: mappings = [], refetch: refetchMappings } = useQuery({
    queryKey: ['vultr_mappings'],
    queryFn: () => client.entities.VultrMapping.list(),
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

  const mappedInstanceIds = useMemo(
    () => new Set(mappings.map(m => m.vultr_instance_id)),
    [mappings],
  );

  const mappedCount = useMemo(
    () => vultrInstances.filter(inst => mappedInstanceIds.has(String(inst.id))).length,
    [vultrInstances, mappedInstanceIds],
  );

  const staleCount = useMemo(
    () => mappings.filter(m => m.last_synced && isStale(m.last_synced)).length,
    [mappings],
  );

  // Unified row list: instances from API + orphaned mappings
  const allRows = useMemo(() => {
    const rows = vultrInstances.map(inst => {
      const instId = String(inst.id);
      const mapping = mappings.find(m => m.vultr_instance_id === instId);
      return {
        instanceId: instId,
        instanceLabel: inst.label,
        ipRegion: `${inst.main_ip} / ${inst.region}`,
        mapping,
        isMapped: Boolean(mapping),
        isStale: mapping ? isStale(mapping.last_synced) : false,
      };
    });

    // Include mappings for instances not in the API response
    const apiIds = new Set(vultrInstances.map(i => String(i.id)));
    for (const mapping of mappings) {
      if (!apiIds.has(mapping.vultr_instance_id)) {
        rows.push({
          instanceId: mapping.vultr_instance_id,
          instanceLabel: mapping.vultr_instance_label || mapping.vultr_instance_id,
          ipRegion: mapping.vultr_region || '--',
          mapping,
          isMapped: true,
          isStale: isStale(mapping.last_synced),
        });
      }
    }

    return rows;
  }, [vultrInstances, mappings]);

  const totalInstances = allRows.length;
  const unmappedCount = totalInstances - mappedCount;

  const filteredRows = useMemo(() => {
    let rows = allRows;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      rows = rows.filter(r =>
        r.instanceLabel.toLowerCase().includes(q) ||
        r.ipRegion.toLowerCase().includes(q) ||
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

  // ---- API actions (kept intact) ----

  const testConnection = useCallback(async () => {
    setTesting(true);
    try {
      const response = await client.functions.invoke('syncVultr', { action: 'test_connection' });
      if (response.success) {
        setConfigStatus(CONNECTION_STATES.CONNECTED);
        toast.success(`Connected! Found ${response.instanceCount || 0} instances.`);
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

  const loadInstances = useCallback(async () => {
    setLoadingInstances(true);
    try {
      const response = await client.functions.invoke('syncVultr', { action: 'list_instances' });
      if (response.success) {
        setVultrInstances(response.instances || []);
        setCurrentPage(1);
        setConfigStatus(CONNECTION_STATES.CONNECTED);
      } else {
        toast.error(response.error || 'Failed to load instances');
      }
    } catch (error) {
      toast.error(error.message || 'Failed to load instances');
    } finally {
      setLoadingInstances(false);
    }
  }, []);

  const applyMapping = useCallback(async (instanceId, instanceLabel, customer) => {
    if (!customer) return;
    const inst = vultrInstances.find(i => String(i.id) === instanceId);
    try {
      await client.entities.VultrMapping.create({
        customer_id: customer.id,
        customer_name: customer.name,
        vultr_instance_id: instanceId,
        vultr_instance_label: instanceLabel,
        vultr_plan: inst?.plan || '',
        vultr_region: inst?.region || '',
      });
      toast.success(`Mapped ${instanceLabel} to ${customer.name}`);
      refetchMappings();
    } catch (error) {
      toast.error(`Failed to map instance: ${error.message}`);
    }
  }, [vultrInstances, refetchMappings]);

  const deleteMapping = useCallback(async (mappingId) => {
    try {
      await client.entities.VultrMapping.delete(mappingId);
      toast.success('Mapping removed');
      refetchMappings();
    } catch (error) {
      toast.error(`Failed to remove mapping: ${error.message}`);
    }
  }, [refetchMappings]);

  const syncAll = useCallback(async () => {
    if (mappings.length === 0) return;
    setSyncing(true);
    try {
      const response = await client.functions.invoke('syncVultr', { action: 'sync_all' });
      if (response.success) {
        toast.success(`Synced ${response.synced} instance(s)!`);
        queryClient.invalidateQueries({ queryKey: ['vultr_mappings'] });
      } else {
        toast.error(response.error || 'Sync failed');
      }
    } catch (error) {
      toast.error(error.message || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  }, [mappings.length, queryClient]);

  const hasData = vultrInstances.length > 0 || mappings.length > 0;

  return (
    <div className="space-y-3">
      {/* Header Bar */}
      <IntegrationHeader
        statusDisplay={statusDisplay}
        integrationName="Vultr"
        hasData={hasData}
        mappedCount={mappedCount}
        totalCount={totalInstances}
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
          onClick={loadInstances}
          disabled={loadingInstances}
          className="h-7 text-xs px-2.5"
        >
          <RefreshCw className={cn("w-3 h-3 mr-1", loadingInstances && "animate-spin")} />
          Refresh
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

      {/* Filter Tabs + Search */}
      <FilterBar
        filterTab={filterTab}
        setFilterTab={setFilterTab}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        totalCount={totalInstances}
        mappedCount={mappedCount}
        unmappedCount={unmappedCount}
        staleCount={staleCount}
        onPageReset={() => setCurrentPage(1)}
        searchPlaceholder="Search instances or customers..."
      />

      {/* Main Table */}
      {!hasData ? (
        <div className="text-center py-10 text-sm text-slate-500 border border-slate-200 rounded-lg">
          No instances loaded. Click <strong>Refresh</strong> to pull Vultr instances or <strong>Test</strong> to verify the connection.
        </div>
      ) : (
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-3 py-2 w-10" />
                  <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-3 py-2">Instance</th>
                  <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-3 py-2">IP / Region</th>
                  <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-3 py-2">Customer</th>
                  <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-3 py-2 w-24">Last Sync</th>
                  <th className="text-right text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-3 py-2 w-20" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-6 text-xs text-slate-400">
                      No instances match the current filter.
                    </td>
                  </tr>
                ) : (
                  paginatedRows.map((row, idx) => (
                    <InstanceRow
                      key={row.instanceId}
                      row={row}
                      customers={customers}
                      getCustomerName={getCustomerName}
                      onMap={(customer) => applyMapping(row.instanceId, row.instanceLabel, customer)}
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
// Instance Row (mirrors DattoRMMConfig's SiteRow)
// ---------------------------------------------------------------------------

function InstanceRow({ row, customers, getCustomerName, onMap, onDelete, isOdd }) {
  const suggestedMatch = useMemo(
    () => (!row.isMapped ? getSuggestedMatch(row.instanceLabel, customers) : null),
    [row.isMapped, row.instanceLabel, customers],
  );

  const syncTime = row.mapping ? getRelativeTime(row.mapping.last_synced) : null;
  const statusDot = getRowStatusDot(row.mapping);

  const handleResync = useCallback(async () => {
    if (!row.mapping) return;
    try {
      await client.functions.invoke('syncVultr', { action: 'sync_all' });
      toast.success(`Re-synced ${row.instanceLabel}`);
    } catch (err) {
      toast.error(`Sync failed: ${err.message}`);
    }
  }, [row.mapping, row.instanceLabel]);

  return (
    <MappingRow
      statusDot={statusDot}
      itemName={row.instanceLabel}
      countValue={row.ipRegion}
      countLabel="IP / Region"
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
