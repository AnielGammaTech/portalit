import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { client } from '@/api/client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RefreshCw, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from "@/lib/utils";
import {
  CONNECTION_STATES,
  ITEMS_PER_PAGE,
  getConnectionStatusDisplay,
  getRelativeTime,
  getRowStatusDot,
  getSuggestedMatch,
  isStale,
  IntegrationHeader,
  FilterBar,
  TablePagination,
  MappingRow,
} from './shared/IntegrationTableParts';

const TH = "text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-3 py-2";

export default function RocketCyberConfig() {
  const [testing, setTesting] = useState(false);
  // configStatus is now derived from data, not manual state
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [rcAccounts, setRcAccounts] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [mspAccountId, setMspAccountId] = useState('');

  const queryClient = useQueryClient();
  const { data: customers = [] } = useQuery({
    queryKey: ['customers'], queryFn: () => client.entities.Customer.list(),
  });
  const { data: mappings = [], isLoading: loadingMappings, refetch: refetchMappings } = useQuery({
    queryKey: ['rocketcyber_mappings'], queryFn: () => client.entities.RocketCyberMapping.list(),
  });
  const configStatus = loadingMappings ? CONNECTION_STATES.CONFIGURED : (mappings.length > 0 ? CONNECTION_STATES.CONNECTED : CONNECTION_STATES.NOT_CONFIGURED);

  const getCustomerName = useCallback((customerId) => {
    const customer = customers.find(c => c.id === customerId);
    return customer?.name || 'Unknown';
  }, [customers]);
  const mappedAccountIds = useMemo(
    () => new Set(mappings.map(m => m.rc_account_id)),
    [mappings],
  );
  const staleCount = useMemo(
    () => mappings.filter(m => m.last_synced && isStale(m.last_synced)).length,
    [mappings],
  );
  // Build a unified list: accounts from API + any mappings not in the API list
  const allRows = useMemo(() => {
    const rows = rcAccounts.map(account => {
      const accountId = String(account.id);
      const mapping = mappings.find(m => m.rc_account_id === accountId);
      return {
        accountId,
        accountName: account.name,
        agentCount: account.agentCount || account.agent_count || 0,
        mapping,
        isMapped: Boolean(mapping),
        isStale: mapping ? isStale(mapping.last_synced) : false,
      };
    });
    const apiAccountIds = new Set(rcAccounts.map(a => String(a.id)));
    for (const mapping of mappings) {
      if (!apiAccountIds.has(mapping.rc_account_id)) {
        rows.push({
          accountId: mapping.rc_account_id,
          accountName: mapping.rc_account_name || mapping.rc_account_id,
          agentCount: 0,
          mapping,
          isMapped: true,
          isStale: isStale(mapping.last_synced),
        });
      }
    }
    return rows;
  }, [rcAccounts, mappings]);
  const mappedCount = useMemo(
    () => allRows.filter(r => r.isMapped).length,
    [allRows],
  );

  const totalAccounts = allRows.length;
  const unmappedCount = totalAccounts - mappedCount;

  const filteredRows = useMemo(() => {
    let rows = allRows;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      rows = rows.filter(r =>
        r.accountName.toLowerCase().includes(q) ||
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

  const testConnection = useCallback(async () => {
    setTesting(true);
    try {
      const result = await client.functions.invoke('syncRocketCyber', { action: 'test_connection' });
      if (result.success) {
                toast.success('RocketCyber API connection successful');
      } else {
                toast.error(result.error || 'Connection failed');
      }
    } catch (error) {
            toast.error(error.message || 'Connection test failed');
    } finally {
      setTesting(false);
    }
  }, []);
  const loadAccounts = useCallback(async () => {
    if (!mspAccountId) {
      toast.error('Enter your MSP Account ID first');
      return;
    }
    setLoadingAccounts(true);
    try {
      const result = await client.functions.invoke('syncRocketCyber', { action: 'list_accounts', msp_account_id: mspAccountId });
      if (result.success) {
        setRcAccounts(result.customers || []);
        setCurrentPage(1);
                toast.success(`Found ${result.customers?.length || 0} accounts`);
      } else {
        toast.error(result.error || 'Failed to load accounts');
      }
    } catch (error) {
      toast.error(error.message || 'Failed to load accounts');
    } finally {
      setLoadingAccounts(false);
    }
  }, [mspAccountId]);
  const applyMapping = useCallback(async (accountId, accountName, customer) => {
    if (!customer) return;
    try {
      await client.entities.RocketCyberMapping.create({
        customer_id: customer.id,
        customer_name: customer.name,
        rc_account_id: String(accountId),
        rc_account_name: accountName,
      });
      toast.success(`Mapped ${accountName} to ${customer.name}`);
      refetchMappings();
    } catch (error) {
      toast.error(`Failed to map: ${error.message}`);
    }
  }, [refetchMappings]);
  const deleteMapping = useCallback(async (mappingId) => {
    try {
      await client.entities.RocketCyberMapping.delete(mappingId);
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
      const result = await client.functions.invoke('syncRocketCyber', { action: 'sync_all' });
      if (result.success) {
        toast.success(`Synced ${result.recordsSynced || 0} incidents`);
        queryClient.invalidateQueries({ queryKey: ['rocketcyber_incidents'] });
        queryClient.invalidateQueries({ queryKey: ['rocketcyber_mappings'] });
      } else {
        toast.error(result.error || 'Sync failed');
      }
    } catch (error) {
      toast.error(`Sync failed: ${error.message}`);
    } finally {
      setSyncing(false);
    }
  }, [mappings.length, queryClient]);
  const autoMapAccounts = useCallback(async () => {
    if (rcAccounts.length === 0) {
      toast.error('Load accounts first before auto-mapping');
      return;
    }
    let mapped = 0;
    try {
      const unmapped = rcAccounts.filter(a => !mappedAccountIds.has(String(a.id)));
      for (const account of unmapped) {
        const match = getSuggestedMatch(account.name, customers);
        if (match && !mappings.some(m => m.customer_id === match.customer.id)) {
          await client.entities.RocketCyberMapping.create({
            customer_id: match.customer.id,
            customer_name: match.customer.name,
            rc_account_id: String(account.id),
            rc_account_name: account.name,
          });
          mapped += 1;
        }
      }
      if (mapped > 0) {
        toast.success(`Auto-mapped ${mapped} accounts`);
        refetchMappings();
      } else {
        toast.info('No new matches found');
      }
    } catch (error) {
      toast.error(`Auto-map failed: ${error.message}`);
    }
  }, [rcAccounts, mappedAccountIds, customers, mappings, refetchMappings]);
  const resyncMapping = useCallback(async (mapping) => {
    try {
      await client.functions.invoke('syncRocketCyber', { action: 'sync_all' });
      toast.success(`Re-synced ${mapping.rc_account_name}`);
      queryClient.invalidateQueries({ queryKey: ['rocketcyber_mappings'] });
    } catch (error) {
      toast.error(`Sync failed: ${error.message}`);
    }
  }, [queryClient]);
  const hasData = rcAccounts.length > 0 || mappings.length > 0;

  return (
    <div className="space-y-3">
      <IntegrationHeader
        statusDisplay={statusDisplay}
        integrationName="RocketCyber"
        hasData={hasData}
        mappedCount={mappedCount}
        totalCount={totalAccounts}
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
        <div className="flex items-center gap-1">
          <Input
            value={mspAccountId}
            onChange={(e) => setMspAccountId(e.target.value)}
            placeholder="MSP ID"
            className="h-7 text-xs w-20 px-2"
          />
          <Button
            size="sm" variant="outline"
            onClick={loadAccounts}
            disabled={loadingAccounts}
            className="h-7 text-xs px-2.5"
          >
            <RefreshCw className={cn("w-3 h-3 mr-1", loadingAccounts && "animate-spin")} />
            Refresh
          </Button>
        </div>
        <Button
          size="sm" variant="outline"
          onClick={autoMapAccounts}
          className="h-7 text-xs px-2.5 text-blue-600 border-blue-200 hover:bg-blue-50"
        >
          <Zap className="w-3 h-3 mr-1" />
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
      <FilterBar
        filterTab={filterTab}
        setFilterTab={setFilterTab}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        totalCount={totalAccounts}
        mappedCount={mappedCount}
        unmappedCount={unmappedCount}
        staleCount={staleCount}
        onPageReset={() => setCurrentPage(1)}
        searchPlaceholder="Search accounts or customers..."
      />
      {!hasData ? (
        <div className="text-center py-10 text-sm text-slate-500 border border-slate-200 rounded-lg">
          No accounts loaded. Enter your MSP ID and click <strong>Refresh</strong> to pull RocketCyber accounts, or <strong>Test</strong> to verify the connection.
        </div>
      ) : (
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className={cn(TH, "w-10")} />
                  <th className={TH}>Account</th>
                  <th className={cn(TH, "w-16")}>Agents</th>
                  <th className={TH}>Customer</th>
                  <th className={cn(TH, "w-24")}>Last Sync</th>
                  <th className={cn(TH, "text-right w-20")} />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-6 text-xs text-slate-400">
                      No accounts match the current filter.
                    </td>
                  </tr>
                ) : (
                  paginatedRows.map((row, idx) => (
                    <AccountRow
                      key={row.accountId}
                      row={row}
                      customers={customers}
                      getCustomerName={getCustomerName}
                      onMap={(customer) => applyMapping(row.accountId, row.accountName, customer)}
                      onDelete={() => row.mapping && deleteMapping(row.mapping.id)}
                      onResync={() => row.mapping && resyncMapping(row.mapping)}
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

function AccountRow({ row, customers, getCustomerName, onMap, onDelete, onResync, isOdd }) {
  const suggestedMatch = useMemo(
    () => (!row.isMapped ? getSuggestedMatch(row.accountName, customers) : null),
    [row.isMapped, row.accountName, customers],
  );

  const syncTime = row.mapping ? getRelativeTime(row.mapping.last_synced) : null;
  return (
    <MappingRow
      statusDot={getRowStatusDot(row.mapping)}
      itemName={row.accountName}
      countValue={row.agentCount}
      countLabel="Agents"
      isMapped={row.isMapped}
      customerName={row.isMapped ? getCustomerName(row.mapping.customer_id) : null}
      syncTime={syncTime}
      suggestedMatch={suggestedMatch}
      customers={customers}
      onMap={onMap}
      onDelete={onDelete}
      onResync={onResync}
      isStaleRow={row.isStale}
      isOdd={isOdd}
    />
  );
}
