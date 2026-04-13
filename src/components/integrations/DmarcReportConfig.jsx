import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { client } from '@/api/client';
import { Button } from "@/components/ui/button";
import { RefreshCw, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from "@/lib/utils";
import {
  CONNECTION_STATES, getConnectionStatusDisplay, getRelativeTime,
  isStale, getRowStatusDot, getSuggestedMatch,
  IntegrationHeader, FilterBar, MappingRow, TablePagination, ITEMS_PER_PAGE,
} from './shared/IntegrationTableParts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function flattenAccountDomains(accounts) {
  const rows = [];
  for (const account of accounts) {
    for (const domain of (account.domains || [])) {
      rows.push({
        accountId: String(account.id), accountName: account.title,
        domainId: String(domain.id), domainName: domain.address,
        domainCount: (account.domains || []).length,
      });
    }
  }
  return rows;
}

function buildUnifiedRows(flatDomains, mappings) {
  const rows = flatDomains.map(fd => {
    const mapping = mappings.find(m => m.dmarc_domain_id === fd.domainId);
    return { ...fd, mapping, isMapped: Boolean(mapping), isStale: mapping ? isStale(mapping.last_synced) : false };
  });
  const apiDomainIds = new Set(flatDomains.map(fd => fd.domainId));
  for (const mapping of mappings) {
    if (!apiDomainIds.has(mapping.dmarc_domain_id)) {
      rows.push({
        accountId: mapping.dmarc_account_id || '', accountName: mapping.dmarc_account_name || '',
        domainId: mapping.dmarc_domain_id, domainName: mapping.dmarc_domain_name || mapping.dmarc_domain_id,
        domainCount: 0, mapping, isMapped: true, isStale: isStale(mapping.last_synced),
      });
    }
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function DmarcReportConfig() {
  const [testing, setTesting] = useState(false);
  // configStatus is now derived from data, not manual state
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [accounts, setAccounts] = useState([]);
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

  const { data: mappings = [], isLoading: loadingMappings, refetch: refetchMappings } = useQuery({
    queryKey: ['dmarc_report_mappings'],
    queryFn: () => client.entities.DmarcReportMapping.list(),
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    if (mappings.length > 0 && configStatus === CONNECTION_STATES.NOT_CONFIGURED) {
          }
  }, [mappings.length, configStatus]);

  // -- Derived data --------------------------------------------------------

  const flatDomains = useMemo(() => flattenAccountDomains(accounts), [accounts]);
  const allRows = useMemo(() => buildUnifiedRows(flatDomains, mappings), [flatDomains, mappings]);
  const mappedDomainIds = useMemo(() => new Set(mappings.map(m => m.dmarc_domain_id)), [mappings]);
  const mappedCount = useMemo(() => allRows.filter(r => r.isMapped).length, [allRows]);
  const staleCount = useMemo(() => mappings.filter(m => m.last_synced && isStale(m.last_synced)).length, [mappings]);
  const totalDomains = allRows.length;
  const unmappedCount = totalDomains - mappedCount;

    const configStatus = loadingMappings ? CONNECTION_STATES.CONFIGURED : (mappings.length > 0 ? CONNECTION_STATES.CONNECTED : CONNECTION_STATES.NOT_CONFIGURED);

  const getCustomerName = useCallback((customerId) => {
    return customers.find(c => c.id === customerId)?.name || 'Unknown';
  }, [customers]);

  const filteredRows = useMemo(() => {
    let rows = allRows;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      rows = rows.filter(r =>
        r.domainName.toLowerCase().includes(q) ||
        r.accountName.toLowerCase().includes(q) ||
        (r.mapping && getCustomerName(r.mapping.customer_id).toLowerCase().includes(q)),
      );
    }
    switch (filterTab) {
      case 'mapped':   return rows.filter(r => r.isMapped);
      case 'unmapped': return rows.filter(r => !r.isMapped);
      case 'stale':    return rows.filter(r => r.isStale);
      default:         return rows;
    }
  }, [allRows, searchQuery, filterTab, getCustomerName]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedRows = filteredRows.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE);
  const statusDisplay = getConnectionStatusDisplay(configStatus);
  const hasData = accounts.length > 0 || mappings.length > 0;

  // -- Actions -------------------------------------------------------------

  const testConnection = useCallback(async () => {
    setTesting(true);
    try {
      const res = await client.functions.invoke('syncDmarcReport', { action: 'test_connection' });
      if (res.success) {
                toast.success(res.message || 'Connected to DMARC Report');
      } else {
                toast.error(res.error || 'Connection failed');
      }
    } catch (error) {
            toast.error(error.message || 'Connection test failed');
    } finally { setTesting(false); }
  }, []);

  const loadAccounts = useCallback(async () => {
    setLoadingAccounts(true);
    try {
      const res = await client.functions.invoke('syncDmarcReport', { action: 'list_accounts' });
      if (res.success) {
        setAccounts(res.accounts || []);
        setCurrentPage(1);
                const total = (res.accounts || []).reduce((s, a) => s + (a.domainCount || 0), 0);
        toast.success(`Loaded ${res.accounts?.length || 0} accounts with ${total} domains`);
      } else {
        toast.error(res.error || 'Failed to load accounts');
      }
    } catch (error) {
      toast.error(error.message || 'Failed to load accounts');
    } finally { setLoadingAccounts(false); }
  }, []);

  const applyMapping = useCallback(async (row, customer) => {
    if (!customer) return;
    try {
      await client.entities.DmarcReportMapping.create({
        customer_id: customer.id, customer_name: customer.name,
        dmarc_account_id: row.accountId, dmarc_account_name: row.accountName,
        dmarc_domain_id: row.domainId, dmarc_domain_name: row.domainName,
      });
      toast.success(`Mapped ${row.domainName} to ${customer.name}`);
      refetchMappings();
    } catch (error) {
      toast.error(`Failed to map: ${error.message}`);
    }
  }, [refetchMappings]);

  const deleteMapping = useCallback(async (mappingId) => {
    try {
      await client.entities.DmarcReportMapping.delete(mappingId);
      toast.success('Mapping removed');
      refetchMappings();
    } catch (error) {
      toast.error(`Failed to remove mapping: ${error.message}`);
    }
  }, [refetchMappings]);

  const autoMapDomains = useCallback(async () => {
    setAutomapping(true);
    let mapped = 0;
    for (const account of accounts) {
      for (const domain of (account.domains || [])) {
        if (mappedDomainIds.has(String(domain.id))) continue;
        const dn = (domain.address || '').toLowerCase().replace(/\.\w+$/, '');
        const match = customers.find(c => {
          const cn = c.name.toLowerCase();
          return cn.includes(dn) || dn.includes(cn);
        });
        if (match) {
          try {
            await client.entities.DmarcReportMapping.create({
              customer_id: match.id, customer_name: match.name,
              dmarc_account_id: String(account.id), dmarc_account_name: account.title,
              dmarc_domain_id: String(domain.id), dmarc_domain_name: domain.address,
            });
            mapped++;
          } catch { /* skip duplicates */ }
        }
      }
    }
    if (mapped > 0) {
      toast.success(`Auto-mapped ${mapped} domains`);
      queryClient.invalidateQueries({ queryKey: ['dmarc_report_mappings'] });
    } else { toast.info('No new matches found'); }
    setAutomapping(false);
  }, [accounts, customers, mappedDomainIds, queryClient]);

  const syncAll = useCallback(async () => {
    if (mappings.length === 0) return;
    setSyncing(true);
    try {
      const res = await client.functions.invoke('syncDmarcReport', { action: 'sync_all' });
      if (res.success) {
        toast.success(`Synced ${res.synced}/${res.total} customers`);
        queryClient.invalidateQueries({ queryKey: ['dmarc_report_mappings'] });
      } else { toast.error(res.error || 'Sync failed'); }
    } catch (error) {
      toast.error(error.message || 'Sync failed');
    } finally { setSyncing(false); }
  }, [mappings.length, queryClient]);

  // -- Render --------------------------------------------------------------

  return (
    <div className="space-y-3">
      <IntegrationHeader
        statusDisplay={statusDisplay} integrationName="DMARC Report"
        hasData={hasData} mappedCount={mappedCount} totalCount={totalDomains}
      >
        <Button size="sm" variant="outline" onClick={testConnection} disabled={testing} className="h-7 text-xs px-2.5">
          <RefreshCw className={cn("w-3 h-3 mr-1", testing && "animate-spin")} /> Test
        </Button>
        <Button size="sm" variant="outline" onClick={loadAccounts} disabled={loadingAccounts} className="h-7 text-xs px-2.5">
          <RefreshCw className={cn("w-3 h-3 mr-1", loadingAccounts && "animate-spin")} /> Refresh
        </Button>
        <Button size="sm" variant="outline" onClick={autoMapDomains} disabled={automapping || accounts.length === 0} className="h-7 text-xs px-2.5 text-blue-600 border-blue-200 hover:bg-blue-50">
          <Zap className={cn("w-3 h-3 mr-1", automapping && "animate-spin")} /> Auto-Map
        </Button>
        <Button size="sm" onClick={syncAll} disabled={syncing || mappings.length === 0} className="h-7 text-xs px-2.5 bg-slate-900 hover:bg-slate-800 text-white">
          <RefreshCw className={cn("w-3 h-3 mr-1", syncing && "animate-spin")} /> {syncing ? 'Syncing...' : 'Sync All'}
        </Button>
      </IntegrationHeader>

      <FilterBar
        filterTab={filterTab} setFilterTab={setFilterTab}
        searchQuery={searchQuery} setSearchQuery={setSearchQuery}
        totalCount={totalDomains} mappedCount={mappedCount}
        unmappedCount={unmappedCount} staleCount={staleCount}
        onPageReset={() => setCurrentPage(1)} searchPlaceholder="Search domains or customers..."
      />

      {!hasData ? (
        <div className="text-center py-10 text-sm text-slate-500 border border-slate-200 rounded-lg">
          No accounts loaded. Click <strong>Refresh</strong> to pull DMARC Report accounts or <strong>Test</strong> to verify the connection.
        </div>
      ) : (
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-3 py-2 w-10" />
                  <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-3 py-2">Account / Domain</th>
                  <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-3 py-2 w-16">Domains</th>
                  <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-3 py-2">Customer</th>
                  <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-3 py-2 w-24">Last Sync</th>
                  <th className="text-right text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-3 py-2 w-20" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedRows.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-6 text-xs text-slate-400">No domains match the current filter.</td></tr>
                ) : paginatedRows.map((row, idx) => (
                  <DomainRow
                    key={row.domainId} row={row} customers={customers}
                    getCustomerName={getCustomerName}
                    onMap={(customer) => applyMapping(row, customer)}
                    onDelete={() => row.mapping && deleteMapping(row.mapping.id)}
                    isOdd={idx % 2 === 1}
                  />
                ))}
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

// ---------------------------------------------------------------------------
// Row component
// ---------------------------------------------------------------------------

function DomainRow({ row, customers, getCustomerName, onMap, onDelete, isOdd }) {
  const suggestedMatch = useMemo(
    () => (!row.isMapped ? getSuggestedMatch(row.domainName, customers) : null),
    [row.isMapped, row.domainName, customers],
  );
  const syncTime = row.mapping ? getRelativeTime(row.mapping.last_synced) : null;
  const statusDot = getRowStatusDot(row.mapping);
  const itemLabel = row.accountName ? `${row.accountName} / ${row.domainName}` : row.domainName;

  const handleResync = useCallback(async () => {
    if (!row.mapping) return;
    try {
      await client.functions.invoke('syncDmarcReport', { action: 'sync_customer', customer_id: row.mapping.customer_id });
      toast.success(`Re-synced ${row.domainName}`);
    } catch (err) { toast.error(`Sync failed: ${err.message}`); }
  }, [row.mapping, row.domainName]);

  return (
    <MappingRow
      statusDot={statusDot} itemName={itemLabel}
      countValue={row.domainCount} countLabel="domains"
      isMapped={row.isMapped}
      customerName={row.isMapped ? getCustomerName(row.mapping.customer_id) : null}
      syncTime={syncTime} suggestedMatch={suggestedMatch} customers={customers}
      onMap={onMap} onDelete={onDelete} onResync={handleResync}
      isStaleRow={row.isStale} isOdd={isOdd}
    />
  );
}
