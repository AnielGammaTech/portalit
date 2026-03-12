import React, { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { client, supabase } from '@/api/client';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  RefreshCw,
  CheckCircle2,
  Building2,
  Trash2,
  Search,
  ChevronLeft,
  ChevronRight,
  Cloud,
  Clock,
  XCircle,
  ChevronDown
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from 'date-fns';

const CONNECTION_STATES = {
  CONNECTED: 'connected',
  CONFIGURED: 'configured',
  NOT_CONFIGURED: 'not_configured',
};

function getConnectionStatusDisplay(status) {
  switch (status) {
    case CONNECTION_STATES.CONNECTED:
      return { color: 'bg-emerald-500', label: 'Connected', bgClass: 'bg-emerald-50 border-emerald-200', textClass: 'text-emerald-700' };
    case CONNECTION_STATES.CONFIGURED:
      return { color: 'bg-amber-500', label: 'Configured', bgClass: 'bg-amber-50 border-amber-200', textClass: 'text-amber-700' };
    default:
      return { color: 'bg-slate-300', label: 'Not configured', bgClass: 'bg-slate-50 border-slate-200', textClass: 'text-slate-500' };
  }
}

export default function JumpCloudConfig() {
  const [testing, setTesting] = useState(false);
  const [configStatus, setConfigStatus] = useState(CONNECTION_STATES.NOT_CONFIGURED);
  const [isMsp, setIsMsp] = useState(false);
  const [loadingOrgs, setLoadingOrgs] = useState(false);
  const [jumpcloudOrgs, setJumpcloudOrgs] = useState([]);
  const [showMappingView, setShowMappingView] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncingCustomerId, setSyncingCustomerId] = useState(null);
  const [syncingUsersCustomerId, setSyncingUsersCustomerId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [orgSelections, setOrgSelections] = useState({});
  const [mappingSearchQuery, setMappingSearchQuery] = useState('');
  const [mappingPage, setMappingPage] = useState(1);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [errorDetails, setErrorDetails] = useState(null);
  const [showErrorDetails, setShowErrorDetails] = useState(false);
  const itemsPerPage = 10;
  const mappingsPerPage = 10;

  const queryClient = useQueryClient();

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => client.entities.Customer.list(),
  });

  const { data: mappings = [], refetch: refetchMappings } = useQuery({
    queryKey: ['jumpcloud_mappings'],
    queryFn: () => client.entities.JumpCloudMapping.list(),
  });

  const fetchLastSync = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('sync_logs')
        .select('completed_at')
        .eq('integration_type', 'jumpcloud')
        .eq('status', 'success')
        .order('completed_at', { ascending: false })
        .limit(1);
      if (data && data.length > 0) {
        setLastSyncTime(data[0].completed_at);
      }
    } catch (_err) {
      // Sync logs may not exist yet
    }
  }, []);

  useEffect(() => {
    fetchLastSync();
  }, [fetchLastSync]);

  const testConnection = async () => {
    setTesting(true);
    setErrorDetails(null);
    try {
      const response = await client.functions.invoke('syncJumpCloudLicenses', { action: 'test_connection' });
      if (response.success) {
        setConfigStatus(CONNECTION_STATES.CONNECTED);
        setIsMsp(!!response.isMsp);
        toast.success('Connected to JumpCloud!');
      } else {
        const errMsg = response.error || 'Connection failed';
        setConfigStatus(CONNECTION_STATES.CONFIGURED);
        setErrorDetails(errMsg);
        toast.error(errMsg);
      }
    } catch (error) {
      const errMsg = error.message || 'Connection test failed';
      setConfigStatus(CONNECTION_STATES.CONFIGURED);
      setErrorDetails(errMsg);
      toast.error(errMsg);
    } finally {
      setTesting(false);
    }
  };

  const loadOrganizations = async () => {
    setLoadingOrgs(true);
    setErrorDetails(null);
    try {
      const response = await client.functions.invoke('syncJumpCloudLicenses', { action: 'list_organizations' });
      if (response.success) {
        setJumpcloudOrgs(response.organizations);
        setShowMappingView(true);
        setCurrentPage(1);
      } else {
        const errMsg = response.error || 'Failed to load organizations';
        setErrorDetails(errMsg);
        toast.error(errMsg);
      }
    } catch (error) {
      const errMsg = error.message || 'Failed to load organizations';
      setErrorDetails(errMsg);
      toast.error(errMsg);
    } finally {
      setLoadingOrgs(false);
    }
  };

  const applyMapping = async (org, customerId) => {
    if (!customerId) return;

    try {
      await client.entities.JumpCloudMapping.create({
        customer_id: customerId,
        jumpcloud_org_id: String(org.id),
        jumpcloud_org_name: org.name
      });
      toast.success(`Mapped ${org.name} successfully!`);
      refetchMappings();
      setOrgSelections(prev => ({ ...prev, [org.id]: '' }));
    } catch (error) {
      toast.error(`Failed to map organization: ${error.message}`);
    }
  };

  const deleteMapping = async (mappingId) => {
    try {
      await client.entities.JumpCloudMapping.delete(mappingId);
      toast.success('Mapping removed');
      refetchMappings();
    } catch (error) {
      toast.error(`Failed to remove mapping: ${error.message}`);
    }
  };

  const syncAllLicenses = async () => {
    setSyncing(true);
    setErrorDetails(null);
    try {
      const response = await client.functions.invoke('syncJumpCloudLicenses', { action: 'sync_all' });
      if (response.success) {
        toast.success(`Synced ${response.created} new, ${response.updated} updated licenses!`);
        queryClient.invalidateQueries({ queryKey: ['licenses'] });
        refetchMappings();
        fetchLastSync();
      } else {
        const errMsg = response.error || 'Sync failed';
        setErrorDetails(errMsg);
        toast.error(errMsg);
      }
    } catch (error) {
      const errMsg = error.message || 'Sync failed';
      setErrorDetails(errMsg);
      toast.error(errMsg);
    } finally {
      setSyncing(false);
    }
  };

  const syncCustomerLicenses = async (customerId) => {
    setSyncingCustomerId(customerId);
    setErrorDetails(null);
    try {
      const response = await client.functions.invoke('syncJumpCloudLicenses', {
        action: 'sync_licenses',
        customer_id: customerId
      });
      if (response.success) {
        toast.success(`Synced ${response.totalUsers} users, ${response.ssoApps} SSO apps!`);
        queryClient.invalidateQueries({ queryKey: ['licenses'] });
        refetchMappings();
      } else {
        const errMsg = response.error || 'Sync failed';
        setErrorDetails(errMsg);
        toast.error(errMsg);
      }
    } catch (error) {
      const errMsg = error.message || 'Sync failed';
      setErrorDetails(errMsg);
      toast.error(errMsg);
    } finally {
      setSyncingCustomerId(null);
    }
  };

  const syncCustomerUsers = async (customerId) => {
    setSyncingUsersCustomerId(customerId);
    setErrorDetails(null);
    try {
      const response = await client.functions.invoke('syncJumpCloudLicenses', {
        action: 'sync_users',
        customer_id: customerId
      });
      if (response.success) {
        toast.success(`Synced ${response.totalJumpCloudUsers} users: ${response.created} new, ${response.matched} matched!`);
        queryClient.invalidateQueries({ queryKey: ['contacts'] });
        refetchMappings();
      } else {
        const errMsg = response.error || 'User sync failed';
        setErrorDetails(errMsg);
        toast.error(errMsg);
      }
    } catch (error) {
      const errMsg = error.message || 'User sync failed';
      setErrorDetails(errMsg);
      toast.error(errMsg);
    } finally {
      setSyncingUsersCustomerId(null);
    }
  };

  const getCustomerName = (customerId) => {
    const customer = customers.find(c => c.id === customerId);
    return customer?.name || 'Unknown';
  };

  // Filter and paginate existing mappings
  const filteredMappings = mappings.filter(mapping => {
    if (!mappingSearchQuery) return true;
    const customerName = getCustomerName(mapping.customer_id).toLowerCase();
    const orgName = (mapping.jumpcloud_org_name || '').toLowerCase();
    const query = mappingSearchQuery.toLowerCase();
    return customerName.includes(query) || orgName.includes(query);
  });

  const totalMappingPages = Math.ceil(filteredMappings.length / mappingsPerPage);
  const paginatedMappings = filteredMappings.slice(
    (mappingPage - 1) * mappingsPerPage,
    mappingPage * mappingsPerPage
  );

  // Filter and paginate orgs
  const getFilteredOrgs = () => {
    let filtered = jumpcloudOrgs;

    if (searchQuery) {
      filtered = filtered.filter(org =>
        org.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (filterTab === 'mapped') {
      filtered = filtered.filter(org =>
        mappings.some(m => m.jumpcloud_org_id === String(org.id))
      );
    } else if (filterTab === 'unmapped') {
      filtered = filtered.filter(org =>
        !mappings.some(m => m.jumpcloud_org_id === String(org.id))
      );
    }

    return filtered;
  };

  const filteredOrgs = getFilteredOrgs();
  const totalPages = Math.ceil(filteredOrgs.length / itemsPerPage);
  const paginatedOrgs = filteredOrgs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const mappedCount = jumpcloudOrgs.filter(org => mappings.some(m => m.jumpcloud_org_id === String(org.id))).length;
  const unmappedCount = jumpcloudOrgs.length - mappedCount;

  const statusDisplay = getConnectionStatusDisplay(configStatus);

  return (
    <div className="space-y-5">
      {/* Connection Status Header */}
      <div className={cn("flex items-center justify-between px-4 py-3 rounded-lg border", statusDisplay.bgClass)}>
        <div className="flex items-center gap-3">
          <div className={cn("w-2.5 h-2.5 rounded-full", statusDisplay.color)} />
          <span className={cn("text-sm font-medium", statusDisplay.textClass)}>
            {statusDisplay.label}
          </span>
          {configStatus === CONNECTION_STATES.CONNECTED && (
            <Badge className="bg-emerald-100 text-emerald-700 text-xs font-normal">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              JumpCloud {isMsp ? '(MSP)' : ''}
            </Badge>
          )}
        </div>
        {lastSyncTime && (
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Clock className="w-3.5 h-3.5" />
            Last synced: {formatDistanceToNow(new Date(lastSyncTime), { addSuffix: true })}
          </div>
        )}
      </div>

      {/* Error Details (collapsible) */}
      {errorDetails && (
        <Collapsible open={showErrorDetails} onOpenChange={setShowErrorDetails}>
          <div className="border border-red-200 bg-red-50 rounded-lg overflow-hidden">
            <CollapsibleTrigger asChild>
              <button className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-red-700 hover:bg-red-100 transition-colors">
                <div className="flex items-center gap-2">
                  <XCircle className="w-4 h-4" />
                  Error details
                </div>
                <ChevronDown className={cn("w-4 h-4 transition-transform", showErrorDetails && "rotate-180")} />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-4 pb-3 pt-1 border-t border-red-200">
                <pre className="text-xs text-red-600 whitespace-pre-wrap font-mono bg-red-100/50 rounded p-2">
                  {errorDetails}
                </pre>
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>
      )}

      {/* Info about API keys */}
      <div className="text-sm text-slate-500 bg-slate-50 rounded-lg p-3">
        JumpCloud API key is configured in app settings. Connect to sync SSO applications as SaaS licenses for your customers.
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Button
          onClick={testConnection}
          disabled={testing}
          variant="outline"
        >
          <RefreshCw className={cn("w-4 h-4 mr-2", testing && "animate-spin")} />
          Test Connection
        </Button>
        <Button
          onClick={loadOrganizations}
          disabled={loadingOrgs}
          variant="outline"
        >
          <RefreshCw className={cn("w-4 h-4 mr-2", loadingOrgs && "animate-spin")} />
          {showMappingView ? 'Refresh Orgs' : 'Load Organizations'}
        </Button>
        {mappings.length > 0 && (
          <Button
            onClick={syncAllLicenses}
            disabled={syncing}
            className="bg-slate-900 hover:bg-slate-800"
          >
            <Cloud className={cn("w-4 h-4 mr-2", syncing && "animate-spin")} />
            {syncing ? 'Syncing...' : 'Sync All Licenses'}
          </Button>
        )}
      </div>

      {/* Organization Mappings Section */}
      <div className="border-t border-slate-200 pt-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h4 className="font-medium text-slate-900">Organization Mappings</h4>
            <p className="text-sm text-slate-500">Map JumpCloud organizations to your customers</p>
          </div>
        </div>

        {!showMappingView ? (
          mappings.length === 0 ? (
            <p className="text-sm text-slate-500 py-4 text-center">
              No organizations mapped yet. Click "Load Organizations" to link JumpCloud orgs to customers.
            </p>
          ) : (
            <div className="space-y-3">
              {/* Search for existing mappings */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="Search mapped customers or orgs..."
                  value={mappingSearchQuery}
                  onChange={(e) => { setMappingSearchQuery(e.target.value); setMappingPage(1); }}
                  className="pl-9 h-9 text-sm"
                />
              </div>

              <div className="space-y-2">
                {paginatedMappings.map(mapping => (
                  <div
                    key={mapping.id}
                    className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <Building2 className="w-4 h-4 text-slate-400" />
                      <div>
                        <p className="font-medium text-slate-900">{getCustomerName(mapping.customer_id)}</p>
                        <p className="text-sm text-slate-500">{'\u2192'} {mapping.jumpcloud_org_name}</p>
                        {mapping.last_synced && (
                          <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                            <Clock className="w-3 h-3" />
                            Last synced: {format(new Date(mapping.last_synced), 'MMM d, h:mm a')}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => syncCustomerUsers(mapping.customer_id)}
                        disabled={syncingUsersCustomerId === mapping.customer_id}
                        className="text-xs h-7"
                      >
                        <RefreshCw className={cn("w-3 h-3 mr-1", syncingUsersCustomerId === mapping.customer_id && "animate-spin")} />
                        {syncingUsersCustomerId === mapping.customer_id ? 'Syncing...' : 'Sync Users'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => syncCustomerLicenses(mapping.customer_id)}
                        disabled={syncingCustomerId === mapping.customer_id}
                        className="text-xs h-7"
                      >
                        <Cloud className={cn("w-3 h-3 mr-1", syncingCustomerId === mapping.customer_id && "animate-spin")} />
                        {syncingCustomerId === mapping.customer_id ? 'Syncing...' : 'Sync Licenses'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteMapping(mapping.id)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 h-7 w-7"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination for mappings */}
              {totalMappingPages > 1 && (
                <div className="flex items-center justify-between pt-2">
                  <p className="text-xs text-slate-500">
                    {((mappingPage - 1) * mappingsPerPage) + 1}{'\u2013'}{Math.min(mappingPage * mappingsPerPage, filteredMappings.length)} of {filteredMappings.length}
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setMappingPage(p => Math.max(1, p - 1))}
                      disabled={mappingPage === 1}
                      className="h-7 px-2"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-xs text-slate-600 px-2">{mappingPage} / {totalMappingPages}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setMappingPage(p => Math.min(totalMappingPages, p + 1))}
                      disabled={mappingPage === totalMappingPages}
                      className="h-7 px-2"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}

              {filteredMappings.length === 0 && mappingSearchQuery && (
                <p className="text-sm text-slate-500 py-4 text-center">
                  No mappings found for "{mappingSearchQuery}"
                </p>
              )}
            </div>
          )
        ) : (
          /* Organization Mapping View */
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            {/* Header */}
            <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    placeholder="Search organizations..."
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                    className="pl-9 w-56 h-9 text-sm"
                  />
                </div>
                <div className="flex items-center border border-slate-200 rounded-lg bg-white">
                  <button
                    onClick={() => { setFilterTab('all'); setCurrentPage(1); }}
                    className={cn(
                      "px-3 py-1.5 text-xs font-medium rounded-l-lg transition-colors",
                      filterTab === 'all' ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
                    )}
                  >
                    All ({jumpcloudOrgs.length})
                  </button>
                  <button
                    onClick={() => { setFilterTab('mapped'); setCurrentPage(1); }}
                    className={cn(
                      "px-3 py-1.5 text-xs font-medium border-x border-slate-200 transition-colors",
                      filterTab === 'mapped' ? "bg-emerald-600 text-white" : "text-slate-600 hover:bg-slate-100"
                    )}
                  >
                    Mapped ({mappedCount})
                  </button>
                  <button
                    onClick={() => { setFilterTab('unmapped'); setCurrentPage(1); }}
                    className={cn(
                      "px-3 py-1.5 text-xs font-medium rounded-r-lg transition-colors",
                      filterTab === 'unmapped' ? "bg-amber-600 text-white" : "text-slate-600 hover:bg-slate-100"
                    )}
                  >
                    Unmapped ({unmappedCount})
                  </button>
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-4 py-3 w-1/3">JumpCloud Org</th>
                    <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-4 py-3 w-20">Users</th>
                    <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-4 py-3 w-1/3">Customer</th>
                    <th className="text-right text-xs font-medium text-slate-500 uppercase tracking-wider px-4 py-3 w-20"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedOrgs.map(org => {
                    const orgId = String(org.id);
                    const existingMapping = mappings.find(m => m.jumpcloud_org_id === orgId);
                    const selectedCustomerId = orgSelections[orgId] || '';

                    return (
                      <tr key={orgId} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-900 text-sm">{org.name}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm text-slate-500">{org.userCount || 0}</p>
                        </td>
                        <td className="px-4 py-3">
                          {existingMapping ? (
                            <Badge className="bg-emerald-100 text-emerald-700 font-normal">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              {getCustomerName(existingMapping.customer_id)}
                            </Badge>
                          ) : (
                            <Select
                              value={selectedCustomerId}
                              onValueChange={(val) => setOrgSelections(prev => ({ ...prev, [orgId]: val }))}
                            >
                              <SelectTrigger className="h-8 text-sm text-slate-500 w-44">
                                <SelectValue placeholder="Select customer..." />
                              </SelectTrigger>
                              <SelectContent>
                                {customers.map(customer => (
                                  <SelectItem key={customer.id} value={customer.id}>
                                    {customer.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {!existingMapping && selectedCustomerId ? (
                            <Button
                              size="sm"
                              onClick={() => applyMapping(org, selectedCustomerId)}
                              className="bg-green-600 hover:bg-green-700 text-white text-xs h-7 px-3"
                            >
                              Apply
                            </Button>
                          ) : existingMapping ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => deleteMapping(existingMapping.id)}
                              className="text-slate-400 hover:text-red-600 h-7"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50">
                <p className="text-xs text-slate-500">
                  {((currentPage - 1) * itemsPerPage) + 1}{'\u2013'}{Math.min(currentPage * itemsPerPage, filteredOrgs.length)} of {filteredOrgs.length}
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="h-7 px-2"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-xs text-slate-600 px-2">{currentPage} / {totalPages}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="h-7 px-2"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
