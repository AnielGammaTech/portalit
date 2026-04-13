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

export default function Pax8Config() {
  const [testing, setTesting] = useState(false);
  const [configStatus, setConfigStatus] = useState(CONNECTION_STATES.NOT_CONFIGURED);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [pax8Companies, setPax8Companies] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [automapping, setAutomapping] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);

  const queryClient = useQueryClient();

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => client.entities.Customer.list('name', 500),
    staleTime: 1000 * 60 * 5,
  });

  const { data: mappings = [], refetch: refetchMappings } = useQuery({
    queryKey: ['pax8_mappings'],
    queryFn: () => client.entities.Pax8Mapping.list(),
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

  const allRows = useMemo(() => {
    const rows = pax8Companies.map(company => {
      const companyId = String(company.id);
      const mapping = mappings.find(m => m.pax8_company_id === companyId);
      return {
        companyId,
        companyName: company.name,
        subscriptionCount: company.totalSubscriptions ?? mapping?.cached_data?.totalSubscriptions ?? null,
        mapping,
        isMapped: Boolean(mapping),
        isStale: mapping ? isStale(mapping.last_synced) : false,
      };
    });

    // Include mappings for companies not in the current API response
    const apiCompanyIds = new Set(pax8Companies.map(c => String(c.id)));
    for (const mapping of mappings) {
      if (!apiCompanyIds.has(mapping.pax8_company_id)) {
        rows.push({
          companyId: mapping.pax8_company_id,
          companyName: mapping.pax8_company_name || mapping.pax8_company_id,
          subscriptionCount: mapping.cached_data?.totalSubscriptions ?? null,
          mapping,
          isMapped: true,
          isStale: isStale(mapping.last_synced),
        });
      }
    }

    return rows;
  }, [pax8Companies, mappings]);

  const totalCompanies = allRows.length;
  const mappedCount = allRows.filter(r => r.isMapped).length;
  const unmappedCount = totalCompanies - mappedCount;
  const staleCount = useMemo(
    () => mappings.filter(m => m.last_synced && isStale(m.last_synced)).length,
    [mappings],
  );

  const filteredRows = useMemo(() => {
    let rows = allRows;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      rows = rows.filter(r =>
        r.companyName.toLowerCase().includes(q) ||
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

  // -- API actions ------------------------------------------------------------

  const testConnection = useCallback(async () => {
    setTesting(true);
    try {
      const result = await client.functions.invoke('syncPax8Subscriptions', { action: 'test_connection' });
      if (result.success) {
        setConfigStatus(CONNECTION_STATES.CONNECTED);
        toast.success(result.message || 'Connected to Pax8');
      } else {
        setConfigStatus(CONNECTION_STATES.CONFIGURED);
        toast.error(result.error || 'Connection failed');
      }
    } catch (error) {
      setConfigStatus(CONNECTION_STATES.CONFIGURED);
      toast.error(error.message || 'Connection test failed');
    } finally {
      setTesting(false);
    }
  }, []);

  const loadCompanies = useCallback(async () => {
    setLoadingCompanies(true);
    try {
      const result = await client.functions.invoke('syncPax8Subscriptions', { action: 'list_companies' });
      if (result.success) {
        setPax8Companies(result.companies || []);
        setCurrentPage(1);
        setConfigStatus(CONNECTION_STATES.CONNECTED);
        toast.success(`Found ${(result.companies || []).length} Pax8 companies`);
      } else {
        toast.error(result.error || 'Failed to load companies');
      }
    } catch (error) {
      toast.error(error.message || 'Failed to load companies');
    } finally {
      setLoadingCompanies(false);
    }
  }, []);

  const applyMapping = useCallback(async (companyId, companyName, customer) => {
    if (!customer) return;
    try {
      await client.entities.Pax8Mapping.create({
        customer_id: customer.id,
        customer_name: customer.name,
        pax8_company_id: companyId,
        pax8_company_name: companyName,
      });
      toast.success(`Mapped ${companyName} to ${customer.name}`);
      refetchMappings();
    } catch (error) {
      toast.error(`Failed to map: ${error.message}`);
    }
  }, [refetchMappings]);

  const deleteMapping = useCallback(async (mappingId) => {
    try {
      await client.entities.Pax8Mapping.delete(mappingId);
      toast.success('Mapping removed');
      refetchMappings();
    } catch (error) {
      toast.error(`Failed to remove mapping: ${error.message}`);
    }
  }, [refetchMappings]);

  const autoMapCompanies = useCallback(() => {
    const unmappedRows = allRows.filter(r => !r.isMapped);
    let count = 0;
    for (const row of unmappedRows) {
      const match = getSuggestedMatch(row.companyName, customers);
      if (match && match.score >= 80) {
        applyMapping(row.companyId, row.companyName, match.customer);
        count += 1;
      }
    }
    if (count > 0) {
      toast.success(`Auto-mapped ${count} companies`);
    } else {
      toast.info('No new matches found. Companies may already be mapped or names do not match.');
    }
  }, [allRows, customers, applyMapping]);

  const syncAll = useCallback(async () => {
    if (mappings.length === 0) return;
    setSyncing(true);
    try {
      const result = await client.functions.invoke('syncPax8Subscriptions', { action: 'sync_all' });
      if (result.success) {
        toast.success(`Synced ${result.synced} companies (${result.errors} errors)`);
        queryClient.invalidateQueries({ queryKey: ['pax8_mappings'] });
      } else {
        toast.error(result.error || 'Sync failed');
      }
    } catch (error) {
      toast.error(error.message || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  }, [mappings.length, queryClient]);

  const hasData = pax8Companies.length > 0 || mappings.length > 0;

  return (
    <div className="space-y-3">
      {/* Header Bar */}
      <IntegrationHeader
        statusDisplay={statusDisplay}
        integrationName="Pax8"
        hasData={hasData}
        mappedCount={mappedCount}
        totalCount={totalCompanies}
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
          onClick={loadCompanies}
          disabled={loadingCompanies}
          className="h-7 text-xs px-2.5"
        >
          <RefreshCw className={cn("w-3 h-3 mr-1", loadingCompanies && "animate-spin")} />
          Refresh
        </Button>
        <Button
          size="sm" variant="outline"
          onClick={autoMapCompanies}
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
        totalCount={totalCompanies}
        mappedCount={mappedCount}
        unmappedCount={unmappedCount}
        staleCount={staleCount}
        onPageReset={() => setCurrentPage(1)}
        searchPlaceholder="Search companies or customers..."
      />

      {/* Main Table */}
      {!hasData ? (
        <div className="text-center py-10 text-sm text-slate-500 border border-slate-200 rounded-lg">
          No companies loaded. Click <strong>Refresh</strong> to pull Pax8 companies or <strong>Test</strong> to verify the connection.
        </div>
      ) : (
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-3 py-2 w-10" />
                  <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-3 py-2">Company</th>
                  <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-3 py-2 w-24">Subscriptions</th>
                  <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-3 py-2">Customer</th>
                  <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-3 py-2 w-24">Last Sync</th>
                  <th className="text-right text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-3 py-2 w-20" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-6 text-xs text-slate-400">
                      No companies match the current filter.
                    </td>
                  </tr>
                ) : (
                  paginatedRows.map((row, idx) => (
                    <CompanyRow
                      key={row.companyId}
                      row={row}
                      customers={customers}
                      getCustomerName={getCustomerName}
                      onMap={(customer) => applyMapping(row.companyId, row.companyName, customer)}
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

function CompanyRow({ row, customers, getCustomerName, onMap, onDelete, isOdd }) {
  const suggestedMatch = useMemo(
    () => (!row.isMapped ? getSuggestedMatch(row.companyName, customers) : null),
    [row.isMapped, row.companyName, customers],
  );

  const syncTime = row.mapping ? getRelativeTime(row.mapping.last_synced) : null;
  const statusDot = getRowStatusDot(row.mapping);

  const handleResync = useCallback(async () => {
    if (!row.mapping) return;
    try {
      await client.functions.invoke('syncPax8Subscriptions', { action: 'sync_all' });
      toast.success(`Re-synced ${row.companyName}`);
    } catch (err) {
      toast.error(`Sync failed: ${err.message}`);
    }
  }, [row.mapping, row.companyName]);

  return (
    <MappingRow
      statusDot={statusDot}
      itemName={row.companyName}
      countValue={row.subscriptionCount}
      countLabel="subscriptions"
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
