import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
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
import { 
  RefreshCw, 
  CheckCircle2,
  Building2,
  Trash2,
  Wand2,
  Search,
  ChevronLeft,
  ChevronRight,
  Cloud
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from "@/lib/utils";

export default function JumpCloudConfig() {
  const [testing, setTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [loadingOrgs, setLoadingOrgs] = useState(false);
  const [jumpcloudOrgs, setJumpcloudOrgs] = useState([]);
  const [showMappingView, setShowMappingView] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [orgSelections, setOrgSelections] = useState({});
  const itemsPerPage = 10;

  const queryClient = useQueryClient();

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
  });

  const { data: mappings = [], refetch: refetchMappings } = useQuery({
    queryKey: ['jumpcloud_mappings'],
    queryFn: () => base44.entities.JumpCloudMapping.list(),
  });

  const testConnection = async () => {
    setTesting(true);
    try {
      const response = await base44.functions.invoke('syncJumpCloudLicenses', { action: 'test_connection' });
      if (response.data.success) {
        setConnectionStatus({ success: true, isMsp: response.data.isMsp });
        toast.success('Connected to JumpCloud!');
      } else {
        setConnectionStatus({ success: false, error: response.data.error });
        toast.error(response.data.error || 'Connection failed');
      }
    } catch (error) {
      setConnectionStatus({ success: false, error: error.message });
      toast.error(error.message);
    } finally {
      setTesting(false);
    }
  };

  const loadOrganizations = async () => {
    setLoadingOrgs(true);
    try {
      const response = await base44.functions.invoke('syncJumpCloudLicenses', { action: 'list_organizations' });
      if (response.data.success) {
        setJumpcloudOrgs(response.data.organizations);
        setShowMappingView(true);
        setCurrentPage(1);
      } else {
        toast.error(response.data.error || 'Failed to load organizations');
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoadingOrgs(false);
    }
  };

  const applyMapping = async (org, customerId) => {
    if (!customerId) return;
    
    try {
      await base44.entities.JumpCloudMapping.create({
        customer_id: customerId,
        jumpcloud_org_id: String(org.id),
        jumpcloud_org_name: org.name
      });
      toast.success(`Mapped ${org.name} successfully!`);
      refetchMappings();
      setOrgSelections(prev => ({ ...prev, [org.id]: '' }));
    } catch (error) {
      toast.error(error.message);
    }
  };

  const deleteMapping = async (mappingId) => {
    try {
      await base44.entities.JumpCloudMapping.delete(mappingId);
      toast.success('Mapping removed');
      refetchMappings();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const syncAllLicenses = async () => {
    setSyncing(true);
    try {
      const response = await base44.functions.invoke('syncJumpCloudLicenses', { action: 'sync_all' });
      if (response.data.success) {
        toast.success(`Synced ${response.data.created} new, ${response.data.updated} updated licenses!`);
        queryClient.invalidateQueries({ queryKey: ['licenses'] });
      } else {
        toast.error(response.data.error || 'Sync failed');
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSyncing(false);
    }
  };

  const getCustomerName = (customerId) => {
    const customer = customers.find(c => c.id === customerId);
    return customer?.name || 'Unknown';
  };

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

  return (
    <div className="space-y-5">
      {/* Connection Status */}
      {connectionStatus?.success && (
        <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 px-3 py-2 rounded-lg">
          <CheckCircle2 className="w-4 h-4" />
          Connected to JumpCloud {connectionStatus.isMsp ? '(MSP Account)' : ''}
        </div>
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
            Sync All Licenses
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
            <div className="space-y-2">
              {mappings.map(mapping => (
                <div 
                  key={mapping.id} 
                  className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <Building2 className="w-4 h-4 text-slate-400" />
                    <div>
                      <p className="font-medium text-slate-900">{getCustomerName(mapping.customer_id)}</p>
                      <p className="text-sm text-slate-500">→ {mapping.jumpcloud_org_name}</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteMapping(mapping.id)}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
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
                  {((currentPage - 1) * itemsPerPage) + 1}–{Math.min(currentPage * itemsPerPage, filteredOrgs.length)} of {filteredOrgs.length}
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