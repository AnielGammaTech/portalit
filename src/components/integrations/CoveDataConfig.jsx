import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { client } from '@/api/client';
import { Button } from "@/components/ui/button";
import { RefreshCw, Zap, Bug } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from "@/lib/utils";
import {
  CONNECTION_STATES, ITEMS_PER_PAGE,
  getConnectionStatusDisplay, getRelativeTime, getRowStatusDot,
  getSuggestedMatch, isStale,
  IntegrationHeader, FilterBar, TablePagination, MappingRow,
} from './shared/IntegrationTableParts';

const SYNC_TIMEOUT_MS = 30_000;

export default function CoveDataConfig() {
  const [testing, setTesting] = useState(false);
  const [configStatus, setConfigStatus] = useState(CONNECTION_STATES.NOT_CONFIGURED);
  const [loadingPartners, setLoadingPartners] = useState(false);
  const [covePartners, setCovePartners] = useState([]);
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

  const { data: mappings = [], refetch: refetchMappings } = useQuery({
    queryKey: ['cove-mappings'],
    queryFn: () => client.entities.CoveDataMapping.list(),
  });

  useEffect(() => {
    if (mappings.length > 0 && configStatus === CONNECTION_STATES.NOT_CONFIGURED) {
      setConfigStatus(CONNECTION_STATES.CONNECTED);
    }
  }, [mappings.length, configStatus]);

  // -- Derived data ----------------------------------------------------------

  const getCustomerName = useCallback((customerId) => {
    return customers.find(c => c.id === customerId)?.name || 'Unknown';
  }, [customers]);

  const mappedPartnerIds = useMemo(
    () => new Set(mappings.map(m => m.cove_partner_id)),
    [mappings],
  );

  const mappedCount = useMemo(
    () => allRows.filter(r => r.isMapped).length,
    [allRows],
  );

  const staleCount = useMemo(
    () => mappings.filter(m => m.last_synced && isStale(m.last_synced)).length,
    [mappings],
  );

  const allRows = useMemo(() => {
    const rows = covePartners.map(partner => {
      const partnerId = String(partner.id);
      const mapping = mappings.find(m => m.cove_partner_id === partnerId);
      return {
        partnerId, partnerName: partner.name,
        deviceCount: partner.deviceCount ?? partner.device_count ?? null,
        mapping, isMapped: Boolean(mapping),
        isStale: mapping ? isStale(mapping.last_synced) : false,
      };
    });
    const apiIds = new Set(covePartners.map(p => String(p.id)));
    for (const mapping of mappings) {
      if (!apiIds.has(mapping.cove_partner_id)) {
        rows.push({
          partnerId: mapping.cove_partner_id,
          partnerName: mapping.cove_partner_name || mapping.cove_partner_id,
          deviceCount: null, mapping, isMapped: true,
          isStale: isStale(mapping.last_synced),
        });
      }
    }
    return rows;
  }, [covePartners, mappings]);

  const totalPartners = allRows.length;
  const unmappedCount = totalPartners - mappedCount;

  const filteredRows = useMemo(() => {
    let rows = allRows;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      rows = rows.filter(r =>
        r.partnerName.toLowerCase().includes(q) ||
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

  // -- Actions ---------------------------------------------------------------

  const testConnection = useCallback(async () => {
    setTesting(true);
    try {
      const res = await client.functions.invoke('syncCoveData', { action: 'test_connection' });
      if (res.success) {
        setConfigStatus(CONNECTION_STATES.CONNECTED);
        toast.success('Connected to Cove API');
      } else {
        setConfigStatus(CONNECTION_STATES.CONFIGURED);
        toast.error(res.error || 'Connection failed');
      }
    } catch (error) {
      setConfigStatus(CONNECTION_STATES.CONFIGURED);
      toast.error(error.message || 'Connection test failed');
    } finally {
      setTesting(false);
    }
  }, []);

  const loadPartners = useCallback(async () => {
    setLoadingPartners(true);
    try {
      const res = await client.functions.invoke('syncCoveData', { action: 'list_partners' });
      if (res.success) {
        setCovePartners(res.partners || []);
        setCurrentPage(1);
        setConfigStatus(CONNECTION_STATES.CONNECTED);
        toast.success(`Found ${res.partners?.length || 0} partners`);
      } else {
        toast.error(res.error || 'Failed to load partners');
      }
    } catch (error) {
      toast.error(error.message || 'Failed to load partners');
    } finally {
      setLoadingPartners(false);
    }
  }, []);

  const applyMapping = useCallback(async (partnerId, partnerName, customer) => {
    if (!customer) return;
    try {
      const existing = mappings.find(m => m.cove_partner_id === partnerId);
      const payload = {
        customer_id: customer.id, customer_name: customer.name,
        cove_partner_id: partnerId, cove_partner_name: partnerName,
      };
      if (existing) {
        await client.entities.CoveDataMapping.update(existing.id, payload);
      } else {
        await client.entities.CoveDataMapping.create(payload);
      }
      toast.success(`Mapped ${partnerName} to ${customer.name}`);
      refetchMappings();
    } catch (error) {
      toast.error(`Failed to map: ${error.message}`);
    }
  }, [mappings, refetchMappings]);

  const deleteMapping = useCallback(async (mappingId) => {
    try {
      await client.entities.CoveDataMapping.delete(mappingId);
      toast.success('Mapping removed');
      refetchMappings();
    } catch (error) {
      toast.error(`Failed to remove mapping: ${error.message}`);
    }
  }, [refetchMappings]);

  const autoMapPartners = useCallback(async () => {
    if (covePartners.length === 0) { toast.error('Load partners first'); return; }
    let mapped = 0;
    try {
      const usedCustomers = new Set(mappings.map(m => m.customer_id));
      const usedPartners = new Set(mappings.map(m => m.cove_partner_id));
      for (const partner of covePartners) {
        if (usedPartners.has(String(partner.id))) continue;
        const match = getSuggestedMatch(partner.name, customers);
        if (match && !usedCustomers.has(match.customer.id)) {
          await client.entities.CoveDataMapping.create({
            customer_id: match.customer.id, customer_name: match.customer.name,
            cove_partner_id: String(partner.id), cove_partner_name: partner.name,
          });
          usedCustomers.add(match.customer.id);
          usedPartners.add(String(partner.id));
          mapped++;
        }
      }
      if (mapped > 0) { toast.success(`Auto-mapped ${mapped} partners`); refetchMappings(); }
      else { toast.info('No new matches found'); }
    } catch (error) {
      toast.error('Auto-map failed: ' + error.message);
    }
  }, [covePartners, mappings, customers, refetchMappings]);

  const syncAllMappings = useCallback(async () => {
    if (mappings.length === 0) return;
    setSyncing(true);
    const total = mappings.length;
    let synced = 0, failed = 0;
    setSyncProgress({ current: 0, total });
    const toastId = toast.loading(`Syncing 0/${total}...`);
    for (const mapping of mappings) {
      try {
        const timeout = setTimeout(() => {}, SYNC_TIMEOUT_MS);
        await client.functions.invoke('syncCoveData', { action: 'sync_one', mapping_id: mapping.id });
        clearTimeout(timeout);
        synced += 1;
      } catch { failed += 1; }
      const current = synced + failed;
      setSyncProgress({ current, total });
      toast.loading(`Syncing ${current}/${total}...`, { id: toastId });
    }
    const msg = `Synced ${synced}/${total}.`;
    if (failed === 0) toast.success(`${msg} All successful.`, { id: toastId });
    else toast.warning(`${msg} ${failed} failed.`, { id: toastId });
    queryClient.invalidateQueries({ queryKey: ['cove-mappings'] });
    setSyncing(false);
    setSyncProgress({ current: 0, total: 0 });
  }, [mappings, queryClient]);

  const resyncOne = useCallback(async (mappingId, partnerName) => {
    try {
      await client.functions.invoke('syncCoveData', { action: 'sync_one', mapping_id: mappingId });
      toast.success(`Re-synced ${partnerName}`);
      refetchMappings();
    } catch (err) { toast.error(`Sync failed: ${err.message}`); }
  }, [refetchMappings]);

  const debugApi = useCallback(async () => {
    try {
      await client.functions.invoke('syncCoveData', { action: 'debug_api' });
      toast.success('Debug output in console (F12)');
    } catch (err) { toast.error(err.message); }
  }, []);

  // -- Render ----------------------------------------------------------------

  const hasData = covePartners.length > 0 || mappings.length > 0;

  return (
    <div className="space-y-3">
      <IntegrationHeader
        statusDisplay={statusDisplay}
        integrationName="Cove Data Protection"
        hasData={hasData}
        mappedCount={mappedCount}
        totalCount={totalPartners}
      >
        <Button size="sm" variant="outline" onClick={testConnection} disabled={testing} className="h-7 text-xs px-2.5">
          <RefreshCw className={cn("w-3 h-3 mr-1", testing && "animate-spin")} />
          Test
        </Button>
        <Button size="sm" variant="outline" onClick={loadPartners} disabled={loadingPartners} className="h-7 text-xs px-2.5">
          <RefreshCw className={cn("w-3 h-3 mr-1", loadingPartners && "animate-spin")} />
          Refresh
        </Button>
        <Button size="sm" variant="outline" onClick={autoMapPartners} className="h-7 text-xs px-2.5 text-blue-600 border-blue-200 hover:bg-blue-50">
          <Zap className="w-3 h-3 mr-1" />
          Auto-Map
        </Button>
        <Button size="sm" onClick={syncAllMappings} disabled={syncing || mappings.length === 0} className="h-7 text-xs px-2.5 bg-slate-900 hover:bg-slate-800 text-white">
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
        totalCount={totalPartners} mappedCount={mappedCount}
        unmappedCount={unmappedCount} staleCount={staleCount}
        onPageReset={() => setCurrentPage(1)}
        searchPlaceholder="Search partners or customers..."
      />

      {!hasData ? (
        <div className="text-center py-10 text-sm text-slate-500 border border-slate-200 rounded-lg">
          No partners loaded. Click <strong>Refresh</strong> to pull Cove partners or <strong>Test</strong> to verify the connection.
        </div>
      ) : (
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-3 py-2 w-10" />
                  <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-3 py-2">Partner</th>
                  <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-3 py-2 w-16">Devices</th>
                  <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-3 py-2">Customer</th>
                  <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-3 py-2 w-24">Last Sync</th>
                  <th className="text-right text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-3 py-2 w-20" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedRows.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-6 text-xs text-slate-400">No partners match the current filter.</td></tr>
                ) : (
                  paginatedRows.map((row, idx) => (
                    <PartnerRow
                      key={row.partnerId} row={row} customers={customers}
                      getCustomerName={getCustomerName}
                      onMap={(c) => applyMapping(row.partnerId, row.partnerName, c)}
                      onDelete={() => row.mapping && deleteMapping(row.mapping.id)}
                      onResync={() => row.mapping && resyncOne(row.mapping.id, row.partnerName)}
                      isOdd={idx % 2 === 1}
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

// -- Table Row ---------------------------------------------------------------

function PartnerRow({ row, customers, getCustomerName, onMap, onDelete, onResync, isOdd }) {
  const suggestedMatch = useMemo(
    () => (!row.isMapped ? getSuggestedMatch(row.partnerName, customers) : null),
    [row.isMapped, row.partnerName, customers],
  );
  const syncTime = row.mapping ? getRelativeTime(row.mapping.last_synced) : null;

  return (
    <MappingRow
      statusDot={getRowStatusDot(row.mapping)} itemName={row.partnerName}
      countValue={row.deviceCount} countLabel="devices"
      isMapped={row.isMapped}
      customerName={row.isMapped ? getCustomerName(row.mapping.customer_id) : null}
      syncTime={syncTime} suggestedMatch={suggestedMatch} customers={customers}
      onMap={onMap} onDelete={onDelete} onResync={onResync}
      isStaleRow={row.isStale} isOdd={isOdd}
    />
  );
}
