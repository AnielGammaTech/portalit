import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { client } from '@/api/client';
import { Button } from "@/components/ui/button";
import { RefreshCw, Zap, Cloud } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from "@/lib/utils";
import {
  CONNECTION_STATES,
  ITEMS_PER_PAGE,
  getConnectionStatusDisplay,
  getRelativeTime,
  isStale,
  getRowStatusDot,
  getSuggestedMatch,
  IntegrationHeader,
  FilterBar,
  MappingRow,
  TablePagination,
} from './shared/IntegrationTableParts';

export default function SpanningConfig() {
  const [testing, setTesting] = useState(false);
  const [configStatus, setConfigStatus] = useState(CONNECTION_STATES.NOT_CONFIGURED);
  const [loadingDomains, setLoadingDomains] = useState(false);
  const [spanningDomains, setSpanningDomains] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [autoMatching, setAutoMatching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const queryClient = useQueryClient();

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => client.entities.Customer.list(),
  });

  const { data: mappings = [], refetch: refetchMappings } = useQuery({
    queryKey: ['spanning_mappings'],
    queryFn: () => client.entities.SpanningMapping.list(),
  });

  useEffect(() => {
    if (mappings.length > 0 && configStatus === CONNECTION_STATES.NOT_CONFIGURED) {
      setConfigStatus(CONNECTION_STATES.CONNECTED);
    }
  }, [mappings.length, configStatus]);

  // Derived data

  const getCustomerName = useCallback((customerId) => {
    const customer = customers.find(c => c.id === customerId);
    return customer?.name || 'Unknown';
  }, [customers]);

  const mappedDomainIds = useMemo(
    () => new Set(mappings.map(m => m.spanning_tenant_id)),
    [mappings],
  );

  const allRows = useMemo(() => {
    const rows = spanningDomains.map(domain => {
      const domainId = String(domain.id);
      const mapping = mappings.find(m => m.spanning_tenant_id === domainId);
      return {
        domainId,
        domainName: domain.name || domain.domainName,
        userCount: domain.userCount || domain.licensedUserCount || 0,
        mapping,
        isMapped: Boolean(mapping),
        isStale: mapping ? isStale(mapping.last_synced) : false,
      };
    });

    const apiDomainIds = new Set(spanningDomains.map(d => String(d.id)));
    for (const mapping of mappings) {
      if (!apiDomainIds.has(mapping.spanning_tenant_id)) {
        rows.push({
          domainId: mapping.spanning_tenant_id,
          domainName: mapping.spanning_tenant_name || mapping.spanning_tenant_id,
          userCount: 0,
          mapping,
          isMapped: true,
          isStale: isStale(mapping.last_synced),
        });
      }
    }
    return rows;
  }, [spanningDomains, mappings]);

  const totalDomains = allRows.length;
  const mappedCount = useMemo(() => allRows.filter(r => r.isMapped).length, [allRows]);
  const unmappedCount = totalDomains - mappedCount;
  const staleCount = useMemo(
    () => mappings.filter(m => m.last_synced && isStale(m.last_synced)).length,
    [mappings],
  );

  const filteredRows = useMemo(() => {
    let rows = allRows;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      rows = rows.filter(r =>
        r.domainName.toLowerCase().includes(q) ||
        (r.mapping && getCustomerName(r.mapping.customer_id).toLowerCase().includes(q)),
      );
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
  const paginatedRows = filteredRows.slice(
    (safePage - 1) * ITEMS_PER_PAGE,
    safePage * ITEMS_PER_PAGE,
  );

  const statusDisplay = getConnectionStatusDisplay(configStatus);
  const hasData = spanningDomains.length > 0 || mappings.length > 0;

  // Actions

  const testConnection = useCallback(async () => {
    setTesting(true);
    try {
      const response = await client.functions.invoke('syncSpanningBackup', { action: 'test_connection' });
      if (response.success) {
        setConfigStatus(CONNECTION_STATES.CONNECTED);
        toast.success('Connected to Unitrends MSP!');
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

  const loadDomains = useCallback(async () => {
    setLoadingDomains(true);
    try {
      const response = await client.functions.invoke('syncSpanningBackup', { action: 'list_domains' });
      if (response.success) {
        setSpanningDomains(response.domains || []);
        setCurrentPage(1);
        setConfigStatus(CONNECTION_STATES.CONNECTED);
      } else {
        toast.error(response.error || 'Failed to load domains');
      }
    } catch (error) {
      toast.error(error.message || 'Failed to load domains');
    } finally {
      setLoadingDomains(false);
    }
  }, []);

  const applyMapping = useCallback(async (domainId, domainName, customer) => {
    if (!customer) return;
    try {
      await client.entities.SpanningMapping.create({
        customer_id: customer.id,
        spanning_tenant_id: domainId,
        spanning_tenant_name: domainName,
      });
      toast.success(`Mapped ${domainName} to ${customer.name}`);
      refetchMappings();
    } catch (error) {
      toast.error(`Failed to map: ${error.message}`);
    }
  }, [refetchMappings]);

  const deleteMapping = useCallback(async (mappingId) => {
    try {
      await client.entities.SpanningMapping.delete(mappingId);
      toast.success('Mapping removed');
      refetchMappings();
    } catch (error) {
      toast.error(`Failed to remove mapping: ${error.message}`);
    }
  }, [refetchMappings]);

  const syncAllLicenses = useCallback(async () => {
    setSyncing(true);
    try {
      const response = await client.functions.invoke('syncSpanningBackup', { action: 'sync_all' });
      if (response.success) {
        toast.success(`Synced ${response.synced} tenants!`);
        queryClient.invalidateQueries({ queryKey: ['licenses'] });
        refetchMappings();
      } else {
        toast.error(response.error || 'Sync failed');
      }
    } catch (error) {
      toast.error(error.message || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  }, [queryClient, refetchMappings]);

  const resyncMapping = useCallback(async (customerId) => {
    try {
      const response = await client.functions.invoke('syncSpanningBackup', {
        action: 'sync_licenses',
        customer_id: customerId,
      });
      if (response.success) {
        toast.success(`Synced ${response.totalUsers} users!`);
        queryClient.invalidateQueries({ queryKey: ['licenses'] });
        refetchMappings();
      } else {
        toast.error(response.error || 'Sync failed');
      }
    } catch (error) {
      toast.error(error.message);
    }
  }, [queryClient, refetchMappings]);

  const autoMatchDomains = useCallback(async () => {
    setAutoMatching(true);
    let matched = 0;
    try {
      for (const domain of spanningDomains) {
        const domainId = String(domain.id);
        if (mappedDomainIds.has(domainId)) continue;

        const domainName = (domain.name || domain.domainName || '').toLowerCase();
        const matchedCustomer = customers.find(c => {
          const cn = c.name.toLowerCase();
          return cn.includes(domainName) || domainName.includes(cn) ||
            cn.split(' ')[0] === domainName.split(' ')[0] ||
            cn.split(',')[0].trim() === domainName.split(',')[0].trim();
        });

        if (matchedCustomer) {
          await client.entities.SpanningMapping.create({
            customer_id: matchedCustomer.id,
            spanning_tenant_id: domainId,
            spanning_tenant_name: domain.name || domain.domainName,
          });
          matched += 1;
        }
      }
      if (matched > 0) {
        toast.success(`Auto-matched ${matched} domains!`);
        refetchMappings();
      } else {
        toast.info('No new matches found');
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setAutoMatching(false);
    }
  }, [spanningDomains, mappedDomainIds, customers, refetchMappings]);

  return (
    <div className="space-y-3">
      <IntegrationHeader
        statusDisplay={statusDisplay}
        integrationName="Spanning Backup"
        hasData={hasData}
        mappedCount={mappedCount}
        totalCount={totalDomains}
      >
        <Button size="sm" variant="outline" onClick={testConnection} disabled={testing} className="h-7 text-xs px-2.5">
          <RefreshCw className={cn("w-3 h-3 mr-1", testing && "animate-spin")} />
          Test
        </Button>
        <Button size="sm" variant="outline" onClick={loadDomains} disabled={loadingDomains} className="h-7 text-xs px-2.5">
          <RefreshCw className={cn("w-3 h-3 mr-1", loadingDomains && "animate-spin")} />
          Refresh
        </Button>
        <Button size="sm" variant="outline" onClick={autoMatchDomains} disabled={autoMatching} className="h-7 text-xs px-2.5 text-blue-600 border-blue-200 hover:bg-blue-50">
          <Zap className={cn("w-3 h-3 mr-1", autoMatching && "animate-spin")} />
          Auto-Map
        </Button>
        <Button size="sm" onClick={syncAllLicenses} disabled={syncing || mappings.length === 0} className="h-7 text-xs px-2.5 bg-slate-900 hover:bg-slate-800 text-white">
          <Cloud className={cn("w-3 h-3 mr-1", syncing && "animate-spin")} />
          {syncing ? 'Syncing...' : 'Sync All'}
        </Button>
      </IntegrationHeader>

      <FilterBar
        filterTab={filterTab}
        setFilterTab={setFilterTab}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        totalCount={totalDomains}
        mappedCount={mappedCount}
        unmappedCount={unmappedCount}
        staleCount={staleCount}
        onPageReset={() => setCurrentPage(1)}
        searchPlaceholder="Search domains or customers..."
      />

      {!hasData ? (
        <div className="text-center py-10 text-sm text-slate-500 border border-slate-200 rounded-lg">
          No domains loaded. Click <strong>Refresh</strong> to pull Spanning domains or <strong>Test</strong> to verify the connection.
        </div>
      ) : (
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-3 py-2 w-10" />
                  <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-3 py-2">Domain</th>
                  <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-3 py-2 w-16">Users</th>
                  <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-3 py-2">Customer</th>
                  <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-3 py-2 w-24">Last Sync</th>
                  <th className="text-right text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-3 py-2 w-20" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-6 text-xs text-slate-400">
                      No domains match the current filter.
                    </td>
                  </tr>
                ) : (
                  paginatedRows.map((row, idx) => (
                    <DomainRow
                      key={row.domainId}
                      row={row}
                      customers={customers}
                      getCustomerName={getCustomerName}
                      onMap={(customer) => applyMapping(row.domainId, row.domainName, customer)}
                      onDelete={() => row.mapping && deleteMapping(row.mapping.id)}
                      onResync={() => row.mapping && resyncMapping(row.mapping.customer_id)}
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

function DomainRow({ row, customers, getCustomerName, onMap, onDelete, onResync, isOdd }) {
  const suggestedMatch = useMemo(
    () => (!row.isMapped ? getSuggestedMatch(row.domainName, customers) : null),
    [row.isMapped, row.domainName, customers],
  );
  const syncTime = row.mapping ? getRelativeTime(row.mapping.last_synced) : null;
  const statusDot = getRowStatusDot(row.mapping);

  return (
    <MappingRow
      statusDot={statusDot}
      itemName={row.domainName}
      countValue={row.userCount}
      countLabel="users"
      isMapped={row.isMapped}
      customerName={row.isMapped ? getCustomerName(row.mapping.customer_id) : null}
      syncTime={syncTime}
      suggestedMatch={suggestedMatch}
      customers={customers}
      onMap={onMap}
      onDelete={onDelete}
      onResync={row.isStale ? onResync : undefined}
      isStaleRow={row.isStale}
      isOdd={isOdd}
    />
  );
}
