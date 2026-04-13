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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getUserCount(mapping) {
  if (!mapping?.cached_data) return null;
  const { users, groups, mailboxes } = mapping.cached_data;
  const parts = [];
  if (users != null) parts.push(`${users}U`);
  if (groups != null) parts.push(`${groups}G`);
  if (mailboxes != null) parts.push(`${mailboxes}M`);
  return parts.length > 0 ? parts.join('/') : null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CIPPConfig() {
  const [testing, setTesting] = useState(false);
  const [configStatus, setConfigStatus] = useState(CONNECTION_STATES.NOT_CONFIGURED);
  const [loadingTenants, setLoadingTenants] = useState(false);
  const [cippTenants, setCippTenants] = useState([]);
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
    queryKey: ['cipp_mappings'],
    queryFn: () => client.entities.CIPPMapping.list(),
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

  const mappedTenantIds = useMemo(
    () => new Set(mappings.map(m => m.cipp_tenant_id)),
    [mappings],
  );


  const staleCount = useMemo(
    () => mappings.filter(m => m.last_synced && isStale(m.last_synced)).length,
    [mappings],
  );

  // Build unified list: tenants from API + mappings not in the API list
  const allRows = useMemo(() => {
    const rows = cippTenants.map(tenant => {
      const tenantId = tenant.id;
      const mapping = mappings.find(m => m.cipp_tenant_id === tenantId);
      return {
        tenantId,
        tenantName: tenant.name,
        defaultDomain: tenant.defaultDomain,
        userCount: getUserCount(mapping),
        mapping,
        isMapped: Boolean(mapping),
        isStale: mapping ? isStale(mapping.last_synced) : false,
      };
    });

    const apiTenantIds = new Set(cippTenants.map(t => t.id));
    for (const mapping of mappings) {
      if (!apiTenantIds.has(mapping.cipp_tenant_id)) {
        rows.push({
          tenantId: mapping.cipp_tenant_id,
          tenantName: mapping.cipp_tenant_name || mapping.cipp_tenant_id,
          defaultDomain: mapping.cipp_default_domain || '',
          userCount: getUserCount(mapping),
          mapping,
          isMapped: true,
          isStale: isStale(mapping.last_synced),
        });
      }
    }

    return rows;
  }, [cippTenants, mappings]);

  const mappedCount = useMemo(
    () => allRows.filter(r => r.isMapped).length,
    [allRows],
  );

  const totalTenants = allRows.length;
  const unmappedCount = totalTenants - mappedCount;

  const filteredRows = useMemo(() => {
    let rows = allRows;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      rows = rows.filter(r =>
        r.tenantName.toLowerCase().includes(q) ||
        (r.defaultDomain && r.defaultDomain.toLowerCase().includes(q)) ||
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

  // ---------------------------------------------------------------------------
  // API handlers
  // ---------------------------------------------------------------------------

  const testConnection = useCallback(async () => {
    setTesting(true);
    try {
      const response = await client.functions.invoke('syncCIPP', { action: 'test_connection' });
      if (response.success) {
        setConfigStatus(CONNECTION_STATES.CONNECTED);
        toast.success(response.message || 'Connected to CIPP');
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

  const loadTenants = useCallback(async () => {
    setLoadingTenants(true);
    try {
      const response = await client.functions.invoke('syncCIPP', { action: 'list_tenants' });
      if (response.success) {
        setCippTenants(response.tenants || []);
        setCurrentPage(1);
        setConfigStatus(CONNECTION_STATES.CONNECTED);
      } else {
        toast.error(response.error || 'Failed to load tenants');
      }
    } catch (error) {
      toast.error(error.message || 'Failed to load tenants');
    } finally {
      setLoadingTenants(false);
    }
  }, []);

  const applyMapping = useCallback(async (tenantId, tenantName, defaultDomain, customer) => {
    if (!customer) return;
    try {
      await client.entities.CIPPMapping.create({
        customer_id: customer.id,
        customer_name: customer.name,
        cipp_tenant_id: tenantId,
        cipp_tenant_name: tenantName,
        cipp_default_domain: defaultDomain,
      });
      toast.success(`Mapped ${tenantName} to ${customer.name}`);
      refetchMappings();
    } catch (error) {
      toast.error(`Failed to map: ${error.message}`);
    }
  }, [refetchMappings]);

  const deleteMapping = useCallback(async (mappingId) => {
    try {
      await client.entities.CIPPMapping.delete(mappingId);
      toast.success('Mapping removed');
      refetchMappings();
    } catch (error) {
      toast.error(`Failed to remove mapping: ${error.message}`);
    }
  }, [refetchMappings]);

  const autoMapTenants = useCallback(async () => {
    setAutomapping(true);
    try {
      const unmappedTenants = cippTenants.filter(t => !mappedTenantIds.has(t.id));
      let matchCount = 0;

      for (const tenant of unmappedTenants) {
        const tenantNameLower = (tenant.name || '').toLowerCase();
        const domainLower = (tenant.defaultDomain || '').toLowerCase().split('.')[0];

        const match = customers.find(c => {
          const custLower = (c.name || '').toLowerCase();
          return (
            custLower === tenantNameLower ||
            custLower.includes(tenantNameLower) ||
            tenantNameLower.includes(custLower) ||
            custLower.includes(domainLower)
          );
        });

        if (match) {
          await applyMapping(tenant.id, tenant.name, tenant.defaultDomain, match);
          matchCount++;
        }
      }

      if (matchCount > 0) {
        toast.success(`Auto-mapped ${matchCount} tenant${matchCount !== 1 ? 's' : ''}`);
      } else {
        toast.info('No new matches found. Tenants may already be mapped or names do not match.');
      }
    } catch (error) {
      toast.error(error.message || 'Auto-map failed');
    } finally {
      setAutomapping(false);
    }
  }, [cippTenants, mappedTenantIds, customers, applyMapping]);

  const syncAll = useCallback(async () => {
    if (mappings.length === 0) return;
    setSyncing(true);
    try {
      const response = await client.functions.invoke('syncCIPP', { action: 'sync_all' });
      if (response.success) {
        toast.success(response.message || 'Sync complete');
        queryClient.invalidateQueries({ queryKey: ['cipp_mappings'] });
      } else {
        toast.error(response.error || 'Sync failed');
      }
    } catch (error) {
      toast.error(error.message || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  }, [mappings.length, queryClient]);

  const hasData = cippTenants.length > 0 || mappings.length > 0;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-3">
      {/* Header Bar */}
      <IntegrationHeader
        statusDisplay={statusDisplay}
        integrationName="CIPP"
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
          onClick={loadTenants}
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
          No tenants loaded. Click <strong>Refresh</strong> to pull CIPP tenants or <strong>Test</strong> to verify the connection.
        </div>
      ) : (
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-3 py-2 w-10" />
                  <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-3 py-2">Tenant</th>
                  <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-3 py-2 w-24">Users</th>
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
                      onMap={(customer) => applyMapping(row.tenantId, row.tenantName, row.defaultDomain, customer)}
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
// Row
// ---------------------------------------------------------------------------

function TenantRow({ row, customers, getCustomerName, onMap, onDelete, isOdd }) {
  const suggestedMatch = useMemo(
    () => (!row.isMapped ? getSuggestedMatch(row.tenantName, customers) : null),
    [row.isMapped, row.tenantName, customers],
  );

  const syncTime = row.mapping ? getRelativeTime(row.mapping.last_synced) : null;
  const statusDot = getRowStatusDot(row.mapping);

  const handleResync = useCallback(async () => {
    if (!row.mapping) return;
    try {
      await client.functions.invoke('syncCIPP', {
        action: 'sync_customer',
        customerId: row.mapping.customer_id,
        tenantId: row.mapping.cipp_tenant_id,
      });
      toast.success(`Re-synced ${row.tenantName}`);
    } catch (err) {
      toast.error(`Sync failed: ${err.message}`);
    }
  }, [row.mapping, row.tenantName]);

  return (
    <MappingRow
      statusDot={statusDot}
      itemName={row.tenantName}
      countValue={row.userCount}
      countLabel="users"
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
