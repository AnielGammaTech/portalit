import React, { useState, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { client } from '@/api/client';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { RefreshCw, Plus, Upload, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from "@/lib/utils";
import {
  CONNECTION_STATES,
  getConnectionStatusDisplay,
  getRelativeTime,
  isStale,
  getRowStatusDot,
  IntegrationHeader,
  FilterBar,
  MappingRow,
  TablePagination,
  ITEMS_PER_PAGE,
} from './shared/IntegrationTableParts';
import UploadReportDialog from './shared/DarkWebUploadDialog';

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function DarkWebIDConfig() {
  const [configStatus, setConfigStatus] = useState(CONNECTION_STATES.NOT_CONFIGURED);
  const [testing, setTesting] = useState(false);
  const [syncingAll, setSyncingAll] = useState(false);
  const [syncingId, setSyncingId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [showMapModal, setShowMapModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [orgs, setOrgs] = useState([]);
  const [loadingOrgs, setLoadingOrgs] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [selectedOrg, setSelectedOrg] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const queryClient = useQueryClient();

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => client.entities.Customer.list('name', 500),
  });

  const { data: mappings = [], refetch: refetchMappings } = useQuery({
    queryKey: ['darkweb-mappings'],
    queryFn: () => client.entities.DarkWebIDMapping.list('customer_name', 100),
  });

  const { data: reports = [] } = useQuery({
    queryKey: ['darkwebid-reports'],
    queryFn: () => client.entities.DarkWebIDReport.list('-report_date', 100),
  });

  // ── Derived data ────────────────────────────────────────────────────

  const reportsByCustomer = useMemo(() => {
    const map = {};
    for (const r of reports) {
      if (!map[r.customer_id]) map[r.customer_id] = r;
    }
    return map;
  }, [reports]);

  const allRows = useMemo(() => {
    return mappings.map(mapping => {
      const report = reportsByCustomer[mapping.customer_id];
      const domainsCount = report?.report_data?.domains_count
        || report?.report_data?.domains_monitored?.length
        || 0;
      return {
        id: mapping.id,
        customerId: mapping.customer_id,
        accountName: mapping.darkweb_org_name || mapping.darkweb_organization_uuid,
        customerName: mapping.customer_name,
        domainsCount,
        mapping,
        isMapped: true,
        isStale: mapping.last_sync ? isStale(mapping.last_sync) : false,
      };
    });
  }, [mappings, reportsByCustomer]);

  const totalCount = allRows.length;
  const mappedCount = totalCount;
  const unmappedCount = 0;
  const staleCount = useMemo(
    () => allRows.filter(r => r.isStale).length,
    [allRows],
  );

  const filteredRows = useMemo(() => {
    let rows = allRows;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      rows = rows.filter(r =>
        (r.accountName || '').toLowerCase().includes(q) ||
        (r.customerName || '').toLowerCase().includes(q),
      );
    }
    switch (filterTab) {
      case 'mapped': rows = rows.filter(r => r.isMapped); break;
      case 'unmapped': rows = rows.filter(r => !r.isMapped); break;
      case 'stale': rows = rows.filter(r => r.isStale); break;
      default: break;
    }
    return rows;
  }, [allRows, searchQuery, filterTab]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedRows = filteredRows.slice(
    (safePage - 1) * ITEMS_PER_PAGE,
    safePage * ITEMS_PER_PAGE,
  );

  const statusDisplay = getConnectionStatusDisplay(
    mappings.length > 0 ? CONNECTION_STATES.CONNECTED : configStatus,
  );

  // ── API actions ─────────────────────────────────────────────────────

  const testConnection = useCallback(async () => {
    setTesting(true);
    try {
      const response = await client.functions.invoke('syncDarkWebID', { action: 'test_connection' });
      if (response.success) {
        setConfigStatus(CONNECTION_STATES.CONNECTED);
        setOrgs(response.organizations || []);
        toast.success('Connection successful!');
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

  const fetchOrgs = useCallback(async () => {
    setLoadingOrgs(true);
    try {
      const response = await client.functions.invoke('syncDarkWebID', { action: 'list_organizations' });
      if (response.success) setOrgs(response.organizations || []);
      else toast.error(response.error || 'Failed to fetch organizations');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoadingOrgs(false);
    }
  }, []);

  const handleSync = useCallback(async (customerId) => {
    setSyncingId(customerId);
    try {
      const response = await client.functions.invoke('syncDarkWebID', {
        action: 'sync_customer',
        customer_id: customerId,
      });
      if (response.success) {
        toast.success(`Synced ${response.synced} new compromises (${response.skipped} existing)`);
        refetchMappings();
      } else {
        toast.error(response.error || 'Sync failed');
      }
    } catch (error) {
      toast.error(error.message || 'Sync failed');
    } finally {
      setSyncingId(null);
    }
  }, [refetchMappings]);

  const handleSyncAll = useCallback(async () => {
    if (mappings.length === 0) return;
    setSyncingAll(true);
    let succeeded = 0;
    let failed = 0;
    for (const mapping of mappings) {
      try {
        const resp = await client.functions.invoke('syncDarkWebID', {
          action: 'sync_customer',
          customer_id: mapping.customer_id,
        });
        if (resp.success) succeeded++;
        else failed++;
      } catch {
        failed++;
      }
    }
    if (failed > 0) toast.error(`${failed} failed, ${succeeded} succeeded`);
    else toast.success(`Synced all ${succeeded} customers`);
    refetchMappings();
    setSyncingAll(false);
  }, [mappings, refetchMappings]);

  const handleDelete = useCallback(async (mappingId) => {
    try {
      await client.entities.DarkWebIDMapping.delete(mappingId);
      toast.success('Mapping removed');
      refetchMappings();
    } catch (error) {
      toast.error(error.message || 'Failed to delete');
    }
  }, [refetchMappings]);

  const handleOpenMapModal = useCallback(async () => {
    setShowMapModal(true);
    setSelectedCustomer('');
    setSelectedOrg('');
    if (orgs.length === 0) await fetchOrgs();
  }, [orgs.length, fetchOrgs]);

  const availableCustomers = useMemo(
    () => customers.filter(c => !mappings.some(m => m.customer_id === c.id)),
    [customers, mappings],
  );

  const handleSaveMapping = useCallback(async () => {
    if (!selectedCustomer || !selectedOrg) {
      toast.error('Select both a customer and a Dark Web ID organization');
      return;
    }
    setIsSaving(true);
    try {
      const customer = customers.find(c => c.id === selectedCustomer);
      const org = orgs.find(o => (o.uuid || o.id) === selectedOrg);
      await client.entities.DarkWebIDMapping.create({
        customer_id: selectedCustomer,
        customer_name: customer?.name,
        darkweb_organization_uuid: selectedOrg,
        darkweb_org_name: org?.name || org?.organization_name || selectedOrg,
      });
      toast.success('Mapping created');
      refetchMappings();
      setShowMapModal(false);
    } catch (error) {
      toast.error(error.message || 'Failed to save mapping');
    } finally {
      setIsSaving(false);
    }
  }, [selectedCustomer, selectedOrg, customers, orgs, refetchMappings]);

  const hasData = mappings.length > 0;

  // ── Render ──────────────────────────────────────────────────────────

  return (
    <div className="space-y-3">
      <IntegrationHeader
        statusDisplay={statusDisplay}
        integrationName="Dark Web ID"
        hasData={hasData}
        mappedCount={mappedCount}
        totalCount={totalCount}
      >
        <Button size="sm" variant="outline" onClick={testConnection} disabled={testing} className="h-7 text-xs px-2.5">
          <RefreshCw className={cn("w-3 h-3 mr-1", testing && "animate-spin")} />
          Test
        </Button>
        <Button size="sm" variant="outline" onClick={() => setShowUploadModal(true)} className="h-7 text-xs px-2.5">
          <Upload className="w-3 h-3 mr-1" />
          Upload Report
        </Button>
        <Button size="sm" variant="outline" onClick={handleOpenMapModal} className="h-7 text-xs px-2.5 text-blue-600 border-blue-200 hover:bg-blue-50">
          <Plus className="w-3 h-3 mr-1" />
          Map Customer
        </Button>
        <Button
          size="sm"
          onClick={handleSyncAll}
          disabled={syncingAll || mappings.length === 0}
          className="h-7 text-xs px-2.5 bg-slate-900 hover:bg-slate-800 text-white"
        >
          <RefreshCw className={cn("w-3 h-3 mr-1", syncingAll && "animate-spin")} />
          {syncingAll ? 'Syncing...' : 'Sync All'}
        </Button>
      </IntegrationHeader>

      <FilterBar
        filterTab={filterTab}
        setFilterTab={setFilterTab}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        totalCount={totalCount}
        mappedCount={mappedCount}
        unmappedCount={unmappedCount}
        staleCount={staleCount}
        onPageReset={() => setCurrentPage(1)}
        searchPlaceholder="Search accounts or customers..."
      />

      {!hasData ? (
        <div className="text-center py-10 text-sm text-slate-500 border border-slate-200 rounded-lg">
          No mappings yet. Click <strong>Test</strong> to verify the connection, then <strong>Map Customer</strong> to link customers.
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
                  <tr>
                    <td colSpan={6} className="text-center py-6 text-xs text-slate-400">
                      No mappings match the current filter.
                    </td>
                  </tr>
                ) : (
                  paginatedRows.map((row, idx) => (
                    <DarkWebRow
                      key={row.id}
                      row={row}
                      customers={customers}
                      isSyncing={syncingId === row.customerId}
                      onSync={() => handleSync(row.customerId)}
                      onDelete={() => handleDelete(row.id)}
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

      <MapCustomerDialog
        open={showMapModal}
        onOpenChange={setShowMapModal}
        availableCustomers={availableCustomers}
        selectedCustomer={selectedCustomer}
        setSelectedCustomer={setSelectedCustomer}
        orgs={orgs}
        selectedOrg={selectedOrg}
        setSelectedOrg={setSelectedOrg}
        loadingOrgs={loadingOrgs}
        fetchOrgs={fetchOrgs}
        isSaving={isSaving}
        onSave={handleSaveMapping}
      />

      <UploadReportDialog
        open={showUploadModal}
        onOpenChange={setShowUploadModal}
        customers={customers}
        queryClient={queryClient}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Table Row
// ---------------------------------------------------------------------------

function DarkWebRow({ row, customers, isSyncing, onSync, onDelete, isOdd }) {
  const syncTime = row.mapping.last_sync
    ? getRelativeTime(row.mapping.last_sync)
    : null;
  const statusDot = getRowStatusDot(
    row.mapping?.last_sync ? { last_synced: row.mapping.last_sync } : null,
  );

  return (
    <MappingRow
      statusDot={statusDot}
      itemName={row.accountName}
      countValue={row.domainsCount}
      countLabel="domains"
      isMapped={row.isMapped}
      customerName={row.customerName}
      syncTime={syncTime}
      suggestedMatch={null}
      customers={customers}
      onMap={null}
      onDelete={onDelete}
      onResync={onSync}
      isStaleRow={row.isStale || isSyncing}
      isOdd={isOdd}
    />
  );
}

// ---------------------------------------------------------------------------
// Map Customer Dialog
// ---------------------------------------------------------------------------

function MapCustomerDialog({
  open, onOpenChange, availableCustomers, selectedCustomer, setSelectedCustomer,
  orgs, selectedOrg, setSelectedOrg, loadingOrgs, fetchOrgs, isSaving, onSave,
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" style={{ zIndex: 9999 }}>
        <DialogHeader>
          <DialogTitle>Map Customer to Dark Web ID Organization</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <div>
            <Label>Customer</Label>
            <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder="Select customer..." />
              </SelectTrigger>
              <SelectContent style={{ zIndex: 10000 }}>
                {availableCustomers.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <Label>Dark Web ID Organization</Label>
              <Button variant="ghost" size="sm" onClick={fetchOrgs} disabled={loadingOrgs} className="h-6 text-xs">
                <RefreshCw className={cn("w-3 h-3 mr-1", loadingOrgs && "animate-spin")} />
                Refresh
              </Button>
            </div>
            <Select value={selectedOrg} onValueChange={setSelectedOrg}>
              <SelectTrigger>
                <SelectValue placeholder={loadingOrgs ? "Loading..." : "Select organization..."} />
              </SelectTrigger>
              <SelectContent style={{ zIndex: 10000 }}>
                {orgs.map(org => (
                  <SelectItem key={org.uuid || org.id} value={org.uuid || org.id}>
                    {org.name || org.organization_name || org.uuid}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={onSave} disabled={isSaving || !selectedCustomer || !selectedOrg}>
              {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              {isSaving ? 'Saving...' : 'Create Mapping'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
