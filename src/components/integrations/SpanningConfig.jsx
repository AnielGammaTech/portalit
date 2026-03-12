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
  Clock,
  Cloud,
  Users,
  Search,
  ChevronLeft,
  ChevronRight,
  Wand2,
  Key,
  X,
  Save,
  XCircle,
  ChevronDown
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from 'date-fns';

export default function SpanningConfig() {
  const [testing, setTesting] = useState(false);
  const [configStatus, setConfigStatus] = useState('not_configured');
  const [connectionMeta, setConnectionMeta] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncingCustomerId, setSyncingCustomerId] = useState(null);
  const [syncingUsersCustomerId, setSyncingUsersCustomerId] = useState(null);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [errorDetails, setErrorDetails] = useState(null);
  const [showErrorDetails, setShowErrorDetails] = useState(false);

  // Domain mapping
  const [loadingDomains, setLoadingDomains] = useState(false);
  const [spanningDomains, setSpanningDomains] = useState([]);
  const [showMappingView, setShowMappingView] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [domainSelections, setDomainSelections] = useState({});
  const [autoMatching, setAutoMatching] = useState(false);
  const [editingApiKeyId, setEditingApiKeyId] = useState(null);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [regionInput, setRegionInput] = useState('us');
  const [savingApiKey, setSavingApiKey] = useState(false);
  const [mappingSearchQuery, setMappingSearchQuery] = useState('');
  const [mappingPage, setMappingPage] = useState(1);
  const itemsPerPage = 10;
  const mappingsPerPage = 10;

  const queryClient = useQueryClient();

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => client.entities.Customer.list(),
  });

  const { data: mappings = [], refetch: refetchMappings } = useQuery({
    queryKey: ['spanning_mappings'],
    queryFn: () => client.entities.SpanningMapping.list(),
  });

  const fetchLastSync = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('sync_logs')
        .select('completed_at')
        .eq('integration_type', 'spanning')
        .eq('status', 'success')
        .order('completed_at', { ascending: false })
        .limit(1);
      if (data && data.length > 0) {
        setLastSyncTime(data[0].completed_at);
      }
    } catch (_err) { /* sync logs may not exist */ }
  }, []);

  useEffect(() => {
    fetchLastSync();
  }, [fetchLastSync]);

  // Auto-detect configured status from existing mappings
  useEffect(() => {
    if (mappings.length > 0 && configStatus === 'not_configured') {
      setConfigStatus('connected');
    }
  }, [mappings.length]);

  const testConnection = async () => {
    setTesting(true);
    setErrorDetails(null);
    try {
      const response = await client.functions.invoke('syncSpanningBackup', {
        action: 'test_connection'
      });
      if (response.success) {
        setConfigStatus('connected');
        setConnectionMeta({ totalCustomers: response.totalCustomers });
        toast.success('Connected to Unitrends MSP!');
      } else {
        const errMsg = response.error || 'Connection failed';
        setConfigStatus('configured');
        setErrorDetails(errMsg);
        toast.error(errMsg);
      }
    } catch (error) {
      const errMsg = error.message || 'Connection test failed';
      setConfigStatus('configured');
      setErrorDetails(errMsg);
      toast.error(errMsg);
    } finally {
      setTesting(false);
    }
  };

  const loadDomains = async () => {
    setLoadingDomains(true);
    try {
      const response = await client.functions.invoke('syncSpanningBackup', { action: 'list_domains' });
      if (response.success) {
        setSpanningDomains(response.domains);
        setShowMappingView(true);
        setCurrentPage(1);
      } else {
        toast.error(response.error || 'Failed to load domains');
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoadingDomains(false);
    }
  };

  const applyMapping = async (domain, customerId) => {
    if (!customerId) return;
    
    try {
      await client.entities.SpanningMapping.create({
        customer_id: customerId,
        spanning_tenant_id: String(domain.id),
        spanning_tenant_name: domain.name || domain.domainName
      });
      toast.success(`Mapped ${domain.name || domain.domainName} successfully!`);
      refetchMappings();
      setDomainSelections(prev => ({ ...prev, [domain.id]: '' }));
    } catch (error) {
      toast.error(error.message);
    }
  };

  const deleteMapping = async (mappingId) => {
    try {
      await client.entities.SpanningMapping.delete(mappingId);
      toast.success('Mapping removed');
      refetchMappings();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const syncCustomerLicenses = async (customerId) => {
    setSyncingCustomerId(customerId);
    try {
      const response = await client.functions.invoke('syncSpanningBackup', { 
        action: 'sync_licenses', 
        customer_id: customerId 
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
    } finally {
      setSyncingCustomerId(null);
    }
  };

  const syncCustomerUsers = async (customerId) => {
    setSyncingUsersCustomerId(customerId);
    try {
      const response = await client.functions.invoke('syncSpanningBackup', { 
        action: 'sync_users', 
        customer_id: customerId 
      });
      if (response.success) {
        toast.success(`Synced ${response.totalSpanningUsers} users: ${response.created} new, ${response.matched} matched!`);
        queryClient.invalidateQueries({ queryKey: ['contacts'] });
        refetchMappings();
      } else {
        toast.error(response.error || 'User sync failed');
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSyncingUsersCustomerId(null);
    }
  };

  const syncAllLicenses = async () => {
    setSyncing(true);
    setErrorDetails(null);
    try {
      const response = await client.functions.invoke('syncSpanningBackup', { action: 'sync_all' });
      if (response.success) {
        toast.success(`Synced ${response.synced} tenants!`);
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

  const getCustomerName = (customerId) => {
    const customer = customers.find(c => c.id === customerId);
    return customer?.name || 'Unknown';
  };

  // Filter and paginate existing mappings
  const filteredMappings = mappings.filter(mapping => {
    if (!mappingSearchQuery) return true;
    const customerName = getCustomerName(mapping.customer_id).toLowerCase();
    const tenantName = (mapping.spanning_tenant_name || '').toLowerCase();
    const query = mappingSearchQuery.toLowerCase();
    return customerName.includes(query) || tenantName.includes(query);
  });
  
  const totalMappingPages = Math.ceil(filteredMappings.length / mappingsPerPage);
  const paginatedMappings = filteredMappings.slice(
    (mappingPage - 1) * mappingsPerPage, 
    mappingPage * mappingsPerPage
  );

  // Filter and paginate domains
  const getFilteredDomains = () => {
    let filtered = spanningDomains;
    
    if (searchQuery) {
      filtered = filtered.filter(domain => 
        (domain.name || domain.domainName || '').toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    if (filterTab === 'mapped') {
      filtered = filtered.filter(domain => 
        mappings.some(m => m.spanning_tenant_id === String(domain.id))
      );
    } else if (filterTab === 'unmapped') {
      filtered = filtered.filter(domain => 
        !mappings.some(m => m.spanning_tenant_id === String(domain.id))
      );
    }
    
    return filtered;
  };

  const filteredDomains = getFilteredDomains();
  const totalPages = Math.ceil(filteredDomains.length / itemsPerPage);
  const paginatedDomains = filteredDomains.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  
  const mappedCount = spanningDomains.filter(d => mappings.some(m => m.spanning_tenant_id === String(d.id))).length;
  const unmappedCount = spanningDomains.length - mappedCount;

  // Auto-match domains to customers by name similarity
  const saveApiKey = async (mappingId) => {
    setSavingApiKey(true);
    try {
      await client.entities.SpanningMapping.update(mappingId, {
        spanning_api_key: apiKeyInput || null,
        spanning_region: regionInput
      });
      toast.success('API key saved!');
      refetchMappings();
      setEditingApiKeyId(null);
      setApiKeyInput('');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSavingApiKey(false);
    }
  };

  const autoMatchDomains = async () => {
    setAutoMatching(true);
    let matched = 0;
    
    try {
      for (const domain of spanningDomains) {
        const domainId = String(domain.id);
        const domainName = (domain.name || domain.domainName || '').toLowerCase();
        
        // Skip if already mapped
        if (mappings.some(m => m.spanning_tenant_id === domainId)) continue;
        
        // Find matching customer by name similarity
        const matchedCustomer = customers.find(customer => {
          const customerName = customer.name.toLowerCase();
          // Check if domain name contains customer name or vice versa
          return customerName.includes(domainName) || 
                 domainName.includes(customerName) ||
                 // Also check for partial matches (first word, etc.)
                 customerName.split(' ')[0] === domainName.split(' ')[0] ||
                 customerName.split(',')[0].trim() === domainName.split(',')[0].trim();
        });
        
        if (matchedCustomer) {
          await client.entities.SpanningMapping.create({
            customer_id: matchedCustomer.id,
            spanning_tenant_id: domainId,
            spanning_tenant_name: domain.name || domain.domainName
          });
          matched++;
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
  };

  const statusColor = configStatus === 'connected' ? 'bg-emerald-500' : configStatus === 'configured' ? 'bg-amber-500' : 'bg-slate-300';
  const statusLabel = configStatus === 'connected' ? 'Connected' : configStatus === 'configured' ? 'Configured' : 'Not configured';
  const statusBg = configStatus === 'connected' ? 'bg-emerald-50 border-emerald-200' : configStatus === 'configured' ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200';
  const statusText = configStatus === 'connected' ? 'text-emerald-700' : configStatus === 'configured' ? 'text-amber-700' : 'text-slate-500';

  return (
    <div className="space-y-5">
      {/* Connection Status Header */}
      <div className={cn("flex items-center justify-between px-4 py-3 rounded-lg border", statusBg)}>
        <div className="flex items-center gap-3">
          <div className={cn("w-2.5 h-2.5 rounded-full", statusColor)} />
          <span className={cn("text-sm font-medium", statusText)}>{statusLabel}</span>
          {configStatus === 'connected' && connectionMeta && (
            <Badge className="bg-emerald-100 text-emerald-700 text-xs font-normal">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              {connectionMeta.totalCustomers} customers
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
                <pre className="text-xs text-red-600 whitespace-pre-wrap font-mono bg-red-100/50 rounded p-2">{errorDetails}</pre>
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>
      )}

      {/* Info */}
      <div className="text-sm text-slate-500 bg-slate-50 rounded-lg p-3">
        Unitrends credentials are configured in app settings. Connect to sync backup domains to your customers.
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
          onClick={loadDomains}
          disabled={loadingDomains}
          variant="outline"
        >
          <RefreshCw className={cn("w-4 h-4 mr-2", loadingDomains && "animate-spin")} />
          {showMappingView ? 'Refresh Domains' : 'Load Domains'}
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

      {/* Domain Mappings Section */}
      <div className="border-t border-slate-200 pt-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h4 className="font-medium text-slate-900">Domain Mappings</h4>
            <p className="text-sm text-slate-500">Map Unitrends domains to your customers</p>
          </div>
        </div>

        {!showMappingView ? (
          mappings.length === 0 ? (
            <p className="text-sm text-slate-500 py-4 text-center">
              No domains mapped yet. Click "Load Domains" to link Unitrends tenants to customers.
            </p>
          ) : (
            <div className="space-y-3">
              {/* Search for existing mappings */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="Search mapped customers or tenants..."
                  value={mappingSearchQuery}
                  onChange={(e) => { setMappingSearchQuery(e.target.value); setMappingPage(1); }}
                  className="pl-9 h-9 text-sm"
                />
              </div>
              
              <div className="space-y-2">
                {paginatedMappings.map(mapping => (
                  <React.Fragment key={mapping.id}>
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Building2 className="w-4 h-4 text-slate-400" />
                        <div>
                          <p className="font-medium text-slate-900">{getCustomerName(mapping.customer_id)}</p>
                          <p className="text-sm text-slate-500">→ {mapping.spanning_tenant_name}</p>
                          {mapping.last_synced && (
                            <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                              <Clock className="w-3 h-3" />
                              Last synced: {format(new Date(mapping.last_synced), 'MMM d, h:mm a')}
                            </p>
                          )}
                          {mapping.spanning_api_key && (
                            <Badge className="bg-blue-100 text-blue-700 text-xs mt-1">API Key Set</Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditingApiKeyId(mapping.id);
                            setApiKeyInput(mapping.spanning_api_key || '');
                            setRegionInput(mapping.spanning_region || 'us');
                          }}
                          className="text-xs h-7"
                        >
                          <Key className="w-3 h-3 mr-1" />
                          API Key
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => syncCustomerUsers(mapping.customer_id)}
                          disabled={syncingUsersCustomerId === mapping.customer_id}
                          className="text-xs h-7"
                        >
                          <Users className={cn("w-3 h-3 mr-1", syncingUsersCustomerId === mapping.customer_id && "animate-spin")} />
                          Sync Users
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => syncCustomerLicenses(mapping.customer_id)}
                          disabled={syncingCustomerId === mapping.customer_id}
                          className="text-xs h-7"
                        >
                          <Cloud className={cn("w-3 h-3 mr-1", syncingCustomerId === mapping.customer_id && "animate-spin")} />
                          Sync Licenses
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
                    {/* API Key Editor */}
                    {editingApiKeyId === mapping.id && (
                      <div className="mt-2 p-3 bg-white border border-slate-200 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <Key className="w-4 h-4 text-slate-500" />
                          <span className="text-sm font-medium text-slate-700">Spanning Tenant API Key</span>
                        </div>
                        <p className="text-xs text-slate-500 mb-3">
                          Enter the tenant-specific API key to fetch SharePoint sites and Teams channels.
                          Get this from Spanning Admin → Settings → API.
                        </p>
                        <div className="flex items-center gap-2">
                          <Select value={regionInput} onValueChange={setRegionInput}>
                            <SelectTrigger className="h-8 w-24 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="us">US</SelectItem>
                              <SelectItem value="eu">EU</SelectItem>
                              <SelectItem value="ap">AU</SelectItem>
                              <SelectItem value="ca">CA</SelectItem>
                              <SelectItem value="uk">UK</SelectItem>
                              <SelectItem value="af">AF</SelectItem>
                            </SelectContent>
                          </Select>
                          <Input
                            type="password"
                            placeholder="API Key..."
                            value={apiKeyInput}
                            onChange={(e) => setApiKeyInput(e.target.value)}
                            className="h-8 text-sm flex-1"
                          />
                          <Button
                            size="sm"
                            onClick={() => saveApiKey(mapping.id)}
                            disabled={savingApiKey}
                            className="h-8 bg-green-600 hover:bg-green-700"
                          >
                            <Save className={cn("w-3 h-3 mr-1", savingApiKey && "animate-spin")} />
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => { setEditingApiKeyId(null); setApiKeyInput(''); }}
                            className="h-8"
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </React.Fragment>
                ))}
              </div>
              
              {/* Pagination for mappings */}
              {totalMappingPages > 1 && (
                <div className="flex items-center justify-between pt-2">
                  <p className="text-xs text-slate-500">
                    {((mappingPage - 1) * mappingsPerPage) + 1}–{Math.min(mappingPage * mappingsPerPage, filteredMappings.length)} of {filteredMappings.length}
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
          /* Domain Mapping View */
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            {/* Header */}
            <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="Search domains..."
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
                  All ({spanningDomains.length})
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
            {unmappedCount > 0 && (
              <Button
                onClick={autoMatchDomains}
                disabled={autoMatching}
                size="sm"
                className="bg-purple-600 hover:bg-purple-700 gap-2"
              >
                <Wand2 className={cn("w-4 h-4", autoMatching && "animate-spin")} />
                {autoMatching ? 'Matching...' : 'Auto-Match'}
              </Button>
            )}
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-4 py-3 w-1/3">Domain</th>
                    <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-4 py-3 w-20">Users</th>
                    <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-4 py-3 w-1/3">Customer</th>
                    <th className="text-right text-xs font-medium text-slate-500 uppercase tracking-wider px-4 py-3 w-20"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedDomains.map(domain => {
                    const domainId = String(domain.id);
                    const existingMapping = mappings.find(m => m.spanning_tenant_id === domainId);
                    const selectedCustomerId = domainSelections[domainId] || '';
                    
                    return (
                      <tr key={domainId} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-900 text-sm">{domain.name || domain.domainName}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm text-slate-500">{domain.userCount || domain.licensedUserCount || 0}</p>
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
                              onValueChange={(val) => setDomainSelections(prev => ({ ...prev, [domainId]: val }))}
                            >
                              <SelectTrigger className="h-8 text-sm text-slate-500 w-48">
                                <SelectValue placeholder="Select customer..." />
                              </SelectTrigger>
                              <SelectContent position="popper" className="z-[9999] max-h-60" sideOffset={4}>
                                {customers
                                  .sort((a, b) => a.name.localeCompare(b.name))
                                  .map(customer => (
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
                              onClick={() => applyMapping(domain, selectedCustomerId)}
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
                  {((currentPage - 1) * itemsPerPage) + 1}–{Math.min(currentPage * itemsPerPage, filteredDomains.length)} of {filteredDomains.length}
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