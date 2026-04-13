import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { client } from '@/api/client';
import { Button } from "@/components/ui/button";
import { RefreshCw, Zap, Cloud, Bug } from 'lucide-react';
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
  MappingRow,
  TablePagination,
} from './shared/IntegrationTableParts';

export default function JumpCloudConfig() {
  const [testing, setTesting] = useState(false);
  // configStatus is now derived from data, not manual state
  const [loadingOrgs, setLoadingOrgs] = useState(false);
  const [jumpcloudOrgs, setJumpcloudOrgs] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [automapping, setAutomapping] = useState(false);

  const queryClient = useQueryClient();

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => client.entities.Customer.list(),
  });

  const { data: mappings = [], isLoading: loadingMappings, refetch: refetchMappings } = useQuery({
    queryKey: ['jumpcloud_mappings'],
    queryFn: () => client.entities.JumpCloudMapping.list(),
  });

  

  // -- Derived data -----------------------------------------------------------

    const configStatus = loadingMappings ? CONNECTION_STATES.CONFIGURED : (mappings.length > 0 ? CONNECTION_STATES.CONNECTED : CONNECTION_STATES.NOT_CONFIGURED);

  const getCustomerName = useCallback((customerId) => {
    const customer = customers.find(c => c.id === customerId);
    return customer?.name || 'Unknown';
  }, [customers]);

  const mappedOrgIds = useMemo(
    () => new Set(mappings.map(m => m.jumpcloud_org_id)),
    [mappings],
  );


  const staleCount = useMemo(
    () => mappings.filter(m => m.last_synced && isStale(m.last_synced)).length,
    [mappings],
  );

  // Build unified list: orgs from API + any mappings not in the API list
  const allRows = useMemo(() => {
    const rows = jumpcloudOrgs.map(org => {
      const orgId = String(org.id);
      const mapping = mappings.find(m => m.jumpcloud_org_id === orgId);
      return {
        orgId,
        orgName: org.name,
        userCount: org.userCount || 0,
        mapping,
        isMapped: Boolean(mapping),
        isStale: mapping ? isStale(mapping.last_synced) : false,
      };
    });

    // Include mappings for orgs not currently in the API response
    const apiOrgIds = new Set(jumpcloudOrgs.map(o => String(o.id)));
    for (const mapping of mappings) {
      if (!apiOrgIds.has(mapping.jumpcloud_org_id)) {
        rows.push({
          orgId: mapping.jumpcloud_org_id,
          orgName: mapping.jumpcloud_org_name || mapping.jumpcloud_org_id,
          userCount: 0,
          mapping,
          isMapped: true,
          isStale: isStale(mapping.last_synced),
        });
      }
    }

    return rows;
  }, [jumpcloudOrgs, mappings]);

  const mappedCount = useMemo(
    () => allRows.filter(r => r.isMapped).length,
    [allRows],
  );

  const totalOrgs = allRows.length;
  const unmappedCount = totalOrgs - mappedCount;

  const filteredRows = useMemo(() => {
    let rows = allRows;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      rows = rows.filter(r =>
        r.orgName.toLowerCase().includes(q) ||
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

  // -- Actions ----------------------------------------------------------------

  const invoke = useCallback(
    (payload) => client.functions.invoke('syncJumpCloudLicenses', payload),
    [],
  );

  const testConnection = useCallback(async () => {
    setTesting(true);
    try {
      const res = await invoke({ action: 'test_connection' });
      setConfigStatus(res.success ? CONNECTION_STATES.CONNECTED : CONNECTION_STATES.CONFIGURED);
      res.success ? toast.success('Connected to JumpCloud!') : toast.error(res.error || 'Connection failed');
    } catch (err) {
            toast.error(err.message || 'Connection test failed');
    } finally { setTesting(false); }
  }, [invoke]);

  const loadOrganizations = useCallback(async () => {
    setLoadingOrgs(true);
    try {
      const res = await invoke({ action: 'list_organizations' });
      if (res.success) { setJumpcloudOrgs(res.organizations || []); setCurrentPage(1);  }
      else toast.error(res.error || 'Failed to load organizations');
    } catch (err) { toast.error(err.message || 'Failed to load organizations'); }
    finally { setLoadingOrgs(false); }
  }, [invoke]);

  const applyMapping = useCallback(async (orgId, orgName, customer) => {
    if (!customer) return;
    try {
      await client.entities.JumpCloudMapping.create({ customer_id: customer.id, jumpcloud_org_id: orgId, jumpcloud_org_name: orgName });
      toast.success(`Mapped ${orgName} to ${customer.name}`);
      refetchMappings();
    } catch (err) { toast.error(`Failed to map: ${err.message}`); }
  }, [refetchMappings]);

  const deleteMapping = useCallback(async (mappingId) => {
    try { await client.entities.JumpCloudMapping.delete(mappingId); toast.success('Mapping removed'); refetchMappings(); }
    catch (err) { toast.error(`Failed to remove mapping: ${err.message}`); }
  }, [refetchMappings]);

  const syncAllLicenses = useCallback(async () => {
    if (mappings.length === 0) return;
    setSyncing(true);
    try {
      const res = await invoke({ action: 'sync_all' });
      if (res.success) { toast.success(`Synced ${res.created} new, ${res.updated} updated licenses!`); queryClient.invalidateQueries({ queryKey: ['licenses'] }); refetchMappings(); }
      else toast.error(res.error || 'Sync failed');
    } catch (err) { toast.error(err.message || 'Sync failed'); }
    finally { setSyncing(false); }
  }, [mappings.length, queryClient, refetchMappings, invoke]);

  const syncCustomerLicenses = useCallback(async (customerId) => {
    try {
      const res = await invoke({ action: 'sync_licenses', customer_id: customerId });
      if (res.success) { toast.success(`Synced ${res.totalUsers} users, ${res.ssoApps} SSO apps!`); queryClient.invalidateQueries({ queryKey: ['licenses'] }); refetchMappings(); }
      else toast.error(res.error || 'Sync failed');
    } catch (err) { toast.error(err.message || 'Sync failed'); }
  }, [queryClient, refetchMappings, invoke]);

  const autoMapOrgs = useCallback(async () => {
    if (jumpcloudOrgs.length === 0) { toast.error('Load organizations first before auto-mapping'); return; }
    setAutomapping(true);
    let mapped = 0;
    try {
      const usedOrgIds = new Set(mappings.map(m => m.jumpcloud_org_id));
      const usedCustomerIds = new Set(mappings.map(m => m.customer_id));
      for (const org of jumpcloudOrgs) {
        const orgId = String(org.id);
        if (usedOrgIds.has(orgId)) continue;
        const match = getSuggestedMatch(org.name, customers);
        if (match && !usedCustomerIds.has(match.customer.id)) {
          await client.entities.JumpCloudMapping.create({ customer_id: match.customer.id, jumpcloud_org_id: orgId, jumpcloud_org_name: org.name });
          usedOrgIds.add(orgId); usedCustomerIds.add(match.customer.id); mapped++;
        }
      }
      mapped > 0 ? (toast.success(`Auto-mapped ${mapped} organizations!`), refetchMappings()) : toast.info('No new matches found.');
    } catch (err) { toast.error('Auto-map failed: ' + err.message); }
    finally { setAutomapping(false); }
  }, [jumpcloudOrgs, mappings, customers, refetchMappings]);

  const debugApi = useCallback(async () => {
    try {
      const res = await invoke({ action: 'test_connection' });
      console.log('JumpCloud Debug:', JSON.stringify(res, null, 2)); // eslint-disable-line no-console
      toast.success('Debug output in console (F12)');
    } catch (err) { toast.error(err.message); }
  }, [invoke]);

  // -- Render -----------------------------------------------------------------

  const hasData = jumpcloudOrgs.length > 0 || mappings.length > 0;

  return (
    <div className="space-y-3">
      {/* Header Bar */}
      <IntegrationHeader
        statusDisplay={statusDisplay}
        integrationName="JumpCloud"
        hasData={hasData}
        mappedCount={mappedCount}
        totalCount={totalOrgs}
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
          onClick={loadOrganizations}
          disabled={loadingOrgs}
          className="h-7 text-xs px-2.5"
        >
          <RefreshCw className={cn("w-3 h-3 mr-1", loadingOrgs && "animate-spin")} />
          Refresh
        </Button>
        <Button
          size="sm" variant="outline"
          onClick={autoMapOrgs}
          disabled={automapping}
          className="h-7 text-xs px-2.5 text-blue-600 border-blue-200 hover:bg-blue-50"
        >
          <Zap className="w-3 h-3 mr-1" />
          Auto-Map
        </Button>
        <Button
          size="sm"
          onClick={syncAllLicenses}
          disabled={syncing || mappings.length === 0}
          className="h-7 text-xs px-2.5 bg-slate-900 hover:bg-slate-800 text-white"
        >
          <Cloud className={cn("w-3 h-3 mr-1", syncing && "animate-spin")} />
          {syncing ? 'Syncing...' : 'Sync All'}
        </Button>
        <Button
          size="sm" variant="ghost"
          onClick={debugApi}
          className="h-7 text-xs px-2 text-slate-400 hover:text-slate-600"
          title="Debug API (logs to console)"
        >
          <Bug className="w-3 h-3" />
        </Button>
      </IntegrationHeader>

      {/* Filter Tabs + Search */}
      <FilterBar
        filterTab={filterTab}
        setFilterTab={setFilterTab}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        totalCount={totalOrgs}
        mappedCount={mappedCount}
        unmappedCount={unmappedCount}
        staleCount={staleCount}
        onPageReset={() => setCurrentPage(1)}
        searchPlaceholder="Search orgs or customers..."
      />

      {/* Main Table */}
      {!hasData ? (
        <div className="text-center py-10 text-sm text-slate-500 border border-slate-200 rounded-lg">
          No organizations loaded. Click <strong>Refresh</strong> to pull JumpCloud orgs or <strong>Test</strong> to verify the connection.
        </div>
      ) : (
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {[{ l: '', w: 'w-10' }, { l: 'Organization' }, { l: 'Users', w: 'w-16' }, { l: 'Customer' }, { l: 'Last Sync', w: 'w-24' }, { l: '', w: 'w-20', r: true }].map((col, i) => (
                    <th key={i} className={cn("text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-3 py-2", col.r ? "text-right" : "text-left", col.w)}>{col.l}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-6 text-xs text-slate-400">
                      No organizations match the current filter.
                    </td>
                  </tr>
                ) : (
                  paginatedRows.map((row, idx) => (
                    <OrgRow
                      key={row.orgId}
                      row={row}
                      customers={customers}
                      getCustomerName={getCustomerName}
                      onMap={(customer) => applyMapping(row.orgId, row.orgName, customer)}
                      onDelete={() => row.mapping && deleteMapping(row.mapping.id)}
                      onResync={() => row.mapping && syncCustomerLicenses(row.mapping.customer_id)}
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

function OrgRow({ row, customers, getCustomerName, onMap, onDelete, onResync, isOdd }) {
  const suggestedMatch = useMemo(
    () => (!row.isMapped ? getSuggestedMatch(row.orgName, customers) : null),
    [row.isMapped, row.orgName, customers],
  );

  const syncTime = row.mapping ? getRelativeTime(row.mapping.last_synced) : null;
  const statusDot = getRowStatusDot(row.mapping);

  return (
    <MappingRow
      statusDot={statusDot}
      itemName={row.orgName}
      countValue={row.userCount}
      countLabel="users"
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
