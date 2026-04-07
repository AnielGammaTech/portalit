import React, { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { client } from '@/api/client';
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
  Wand2,
  Search,
  ChevronLeft,
  ChevronRight,
  XCircle,
  Clock,
  ChevronDown,
  Key,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from 'date-fns';

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

export default function UniFiConfig() {
  const [testing, setTesting] = useState(false);
  const [configStatus, setConfigStatus] = useState(CONNECTION_STATES.NOT_CONFIGURED);
  const [loadingSites, setLoadingSites] = useState(false);
  const [unifiSites, setUnifiSites] = useState([]);
  const [showMappingView, setShowMappingView] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [siteSelections, setSiteSelections] = useState({});
  const [mappingSearchQuery, setMappingSearchQuery] = useState('');
  const [mappingPage, setMappingPage] = useState(1);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [errorDetails, setErrorDetails] = useState(null);
  const [showErrorDetails, setShowErrorDetails] = useState(false);
  // API key is set via environment variable (unifi_api_key)
  const itemsPerPage = 10;
  const mappingsPerPage = 10;

  const queryClient = useQueryClient();

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => client.entities.Customer.list(),
  });

  const { data: mappings = [], refetch: refetchMappings } = useQuery({
    queryKey: ['unifi_mappings'],
    queryFn: () => client.entities.UniFiMapping.list(),
  });

  // No need to load API key — it's an environment variable on the backend

  // Auto-detect configured status from existing mappings
  useEffect(() => {
    if (mappings.length > 0 && configStatus === CONNECTION_STATES.NOT_CONFIGURED) {
      setConfigStatus(CONNECTION_STATES.CONNECTED);
    }
  }, [mappings.length]);

  // API key managed via Railway environment variable

  const testConnection = async () => {
    setTesting(true);
    setErrorDetails(null);
    try {
      const response = await client.functions.invoke('syncUniFiDevices', { action: 'list_sites' });
      if (response.success) {
        setConfigStatus(CONNECTION_STATES.CONNECTED);
        toast.success(`Connected! Found ${response.sites?.length || 0} sites.`);
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

  const loadUnifiSites = async () => {
    setLoadingSites(true);
    setErrorDetails(null);
    try {
      const response = await client.functions.invoke('syncUniFiDevices', { action: 'list_sites' });
      if (response.success) {
        setUnifiSites(response.sites || []);
        setShowMappingView(true);
        setCurrentPage(1);
      } else {
        const errMsg = response.error || 'Failed to load sites';
        setErrorDetails(errMsg);
        toast.error(errMsg);
      }
    } catch (error) {
      const errMsg = error.message || 'Failed to load sites';
      setErrorDetails(errMsg);
      toast.error(errMsg);
    } finally {
      setLoadingSites(false);
    }
  };

  const applyMapping = async (site, customerId) => {
    if (!customerId) return;
    const customerName = customers.find(c => c.id === customerId)?.name || '';
    try {
      await client.entities.UniFiMapping.create({
        customer_id: customerId,
        customer_name: customerName,
        unifi_site_id: String(site.id),
        unifi_site_name: site.name,
      });
      toast.success(`Mapped host ${site.name} successfully!`);
      refetchMappings();
      setSiteSelections(prev => ({ ...prev, [site.id]: '' }));
    } catch (error) {
      toast.error(`Failed to map host: ${error.message}`);
    }
  };

  const getSuggestedMatch = (siteName) => {
    const siteNameLower = siteName.toLowerCase().trim();
    let bestMatch = null;
    let bestScore = 0;

    for (const customer of customers) {
      const customerNameLower = customer.name.toLowerCase().trim();
      if (siteNameLower === customerNameLower) return { customer, score: 100 };
      if (siteNameLower.includes(customerNameLower) || customerNameLower.includes(siteNameLower)) {
        const score = Math.round((Math.min(siteNameLower.length, customerNameLower.length) / Math.max(siteNameLower.length, customerNameLower.length)) * 100);
        if (score > bestScore) { bestScore = score; bestMatch = customer; }
      }
      const siteWords = siteNameLower.split(/[\s,.-]+/).filter(w => w.length > 2);
      const customerWords = customerNameLower.split(/[\s,.-]+/).filter(w => w.length > 2);
      const matchingWords = siteWords.filter(sw => customerWords.some(cw => cw.includes(sw) || sw.includes(cw)));
      if (matchingWords.length > 0) {
        const score = Math.round((matchingWords.length / Math.max(siteWords.length, customerWords.length)) * 100);
        if (score > bestScore) { bestScore = score; bestMatch = customer; }
      }
    }
    return bestMatch && bestScore >= 50 ? { customer: bestMatch, score: bestScore } : null;
  };

  const getFilteredSites = () => {
    let filtered = unifiSites;
    if (searchQuery) {
      filtered = filtered.filter(site => site.name.toLowerCase().includes(searchQuery.toLowerCase()));
    }
    if (filterTab === 'mapped') {
      filtered = filtered.filter(site => mappings.some(m => m.unifi_site_id === String(site.id)));
    } else if (filterTab === 'unmapped') {
      filtered = filtered.filter(site => !mappings.some(m => m.unifi_site_id === String(site.id)));
    }
    return filtered;
  };

  const filteredSites = getFilteredSites();
  const totalPages = Math.ceil(filteredSites.length / itemsPerPage);
  const paginatedSites = filteredSites.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const mappedCount = unifiSites.filter(site => mappings.some(m => m.unifi_site_id === String(site.id))).length;
  const unmappedCount = unifiSites.length - mappedCount;

  const deleteMapping = async (mappingId) => {
    try {
      await client.entities.UniFiMapping.delete(mappingId);
      toast.success('Mapping removed');
      refetchMappings();
    } catch (error) {
      toast.error(`Failed to remove mapping: ${error.message}`);
    }
  };

  const syncAllDevices = async () => {
    setSyncing(true);
    setErrorDetails(null);
    try {
      const response = await client.functions.invoke('syncUniFiDevices', { action: 'sync_all' });
      if (response.success) {
        toast.success(`Synced ${response.synced} site(s)!`);
        queryClient.invalidateQueries({ queryKey: ['unifi_mappings'] });
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

  const filteredMappings = mappings.filter(mapping => {
    if (!mappingSearchQuery) return true;
    const customerName = getCustomerName(mapping.customer_id).toLowerCase();
    const siteName = (mapping.unifi_site_name || '').toLowerCase();
    const query = mappingSearchQuery.toLowerCase();
    return customerName.includes(query) || siteName.includes(query);
  });

  const totalMappingPages = Math.ceil(filteredMappings.length / mappingsPerPage);
  const paginatedMappings = filteredMappings.slice(
    (mappingPage - 1) * mappingsPerPage,
    mappingPage * mappingsPerPage
  );

  const statusDisplay = getConnectionStatusDisplay(configStatus);

  return (
    <div className="space-y-5">
      {/* Connection Status Header */}
      <div className={cn("flex items-center justify-between px-4 py-3 rounded-lg border", statusDisplay.bgClass)}>
        <div className="flex items-center gap-3">
          <div className={cn("w-2.5 h-2.5 rounded-full", statusDisplay.color)} />
          <span className={cn("text-sm font-medium", statusDisplay.textClass)}>{statusDisplay.label}</span>
        </div>
      </div>

      {/* Error Details */}
      {errorDetails && (
        <Collapsible open={showErrorDetails} onOpenChange={setShowErrorDetails}>
          <div className="border border-red-200 bg-red-50 rounded-lg overflow-hidden">
            <CollapsibleTrigger asChild>
              <button className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-red-700 hover:bg-red-100 transition-colors">
                <div className="flex items-center gap-2"><XCircle className="w-4 h-4" />Error details</div>
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

      {/* API Key Info */}
      <div className="bg-slate-50 rounded-lg p-4">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <Key className="w-4 h-4" /> UniFi API Key
        </div>
        <p className="text-xs text-slate-500 mt-1">
          API key is configured via environment variable (<code className="bg-slate-200 px-1 rounded">unifi_api_key</code>).
          Get your key from <a href="https://developer.ui.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">developer.ui.com</a>
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Button onClick={testConnection} disabled={testing} variant="outline">
          <RefreshCw className={cn("w-4 h-4 mr-2", testing && "animate-spin")} />
          Test Connection
        </Button>
        <Button
          variant="outline"
          className="text-xs"
          onClick={async () => {
            try {
              const res = await client.functions.invoke('syncUniFiDevices', { action: 'debug_api' });
              console.log('UniFi API Debug:', JSON.stringify(res, null, 2));
              toast.success('Debug output in browser console (F12)');
            } catch (err) {
              toast.error(err.message);
            }
          }}
        >
          Debug API
        </Button>
        <Button onClick={loadUnifiSites} disabled={loadingSites} variant="outline">
          <RefreshCw className={cn("w-4 h-4 mr-2", loadingSites && "animate-spin")} />
          {showMappingView ? 'Refresh Hosts' : 'Load Hosts'}
        </Button>
        {unifiSites.length > 0 && (
          <Button
            onClick={async () => {
              try {
                const res = await client.functions.invoke('syncUniFiDevices', { action: 'auto_map' });
                if (res.success) {
                  toast.success(`Auto-mapped ${res.mapped} hosts. ${res.results?.filter(r => !r.customer).length || 0} unmatched.`);
                  loadUnifiSites();
                  queryClient.invalidateQueries({ queryKey: ['unifi-mappings'] });
                } else {
                  toast.error(res.error || 'Auto-map failed');
                }
              } catch (err) {
                toast.error(err.message);
              }
            }}
            variant="outline"
            className="text-blue-600 border-blue-200 hover:bg-blue-50"
          >
            Auto-Map by Name
          </Button>
        )}
        {mappings.length > 0 && (
          <Button onClick={syncAllDevices} disabled={syncing} className="bg-slate-900 hover:bg-slate-800">
            <RefreshCw className={cn("w-4 h-4 mr-2", syncing && "animate-spin")} />
            {syncing ? 'Syncing...' : 'Sync All Devices'}
          </Button>
        )}
      </div>

      {/* Site Mappings */}
      <div className="border-t border-slate-200 pt-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h4 className="font-medium text-slate-900">Host Mappings</h4>
            <p className="text-sm text-slate-500">Map UniFi consoles/gateways to your customers</p>
          </div>
        </div>

        {!showMappingView ? (
          mappings.length === 0 ? (
            <p className="text-sm text-slate-500 py-4 text-center">
              No hosts mapped yet. Click "Load Hosts" to link UniFi consoles to customers.
            </p>
          ) : (
            <div className="space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="Search mapped customers or hosts..."
                  value={mappingSearchQuery}
                  onChange={(e) => { setMappingSearchQuery(e.target.value); setMappingPage(1); }}
                  className="pl-9 h-9 text-sm"
                />
              </div>
              <div className="space-y-2">
                {paginatedMappings.map(mapping => (
                  <div key={mapping.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Building2 className="w-4 h-4 text-slate-400" />
                      <div>
                        <p className="font-medium text-slate-900">{getCustomerName(mapping.customer_id)}</p>
                        <p className="text-sm text-slate-500">{'\u2192'} {mapping.unifi_site_name}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => deleteMapping(mapping.id)} className="text-red-500 hover:text-red-700 hover:bg-red-50">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
              {totalMappingPages > 1 && (
                <div className="flex items-center justify-between pt-2">
                  <p className="text-xs text-slate-500">
                    {((mappingPage - 1) * mappingsPerPage) + 1}{'\u2013'}{Math.min(mappingPage * mappingsPerPage, filteredMappings.length)} of {filteredMappings.length}
                  </p>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="outline" onClick={() => setMappingPage(p => Math.max(1, p - 1))} disabled={mappingPage === 1} className="h-7 px-2">
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-xs text-slate-600 px-2">{mappingPage} / {totalMappingPages}</span>
                    <Button size="sm" variant="outline" onClick={() => setMappingPage(p => Math.min(totalMappingPages, p + 1))} disabled={mappingPage === totalMappingPages} className="h-7 px-2">
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )
        ) : (
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            {/* Header */}
            <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    placeholder="Search hosts..."
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                    className="pl-9 w-56 h-9 text-sm"
                  />
                </div>
                <div className="flex items-center border border-slate-200 rounded-lg bg-white">
                  <button onClick={() => { setFilterTab('all'); setCurrentPage(1); }} className={cn("px-3 py-1.5 text-xs font-medium rounded-l-lg transition-colors", filterTab === 'all' ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100")}>
                    All ({unifiSites.length})
                  </button>
                  <button onClick={() => { setFilterTab('mapped'); setCurrentPage(1); }} className={cn("px-3 py-1.5 text-xs font-medium border-x border-slate-200 transition-colors", filterTab === 'mapped' ? "bg-emerald-600 text-white" : "text-slate-600 hover:bg-slate-100")}>
                    Mapped ({mappedCount})
                  </button>
                  <button onClick={() => { setFilterTab('unmapped'); setCurrentPage(1); }} className={cn("px-3 py-1.5 text-xs font-medium rounded-r-lg transition-colors", filterTab === 'unmapped' ? "bg-amber-600 text-white" : "text-slate-600 hover:bg-slate-100")}>
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
                    <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-4 py-3 w-1/3">UniFi Host</th>
                    <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-4 py-3 w-1/4">Customer</th>
                    <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-4 py-3 w-1/3">Suggested Match</th>
                    <th className="text-right text-xs font-medium text-slate-500 uppercase tracking-wider px-4 py-3 w-20"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedSites.map(site => {
                    const siteId = String(site.id);
                    const existingMapping = mappings.find(m => m.unifi_site_id === siteId);
                    const suggestedMatch = !existingMapping ? getSuggestedMatch(site.name) : null;
                    const selectedCustomerId = siteSelections[siteId] || '';

                    return (
                      <tr key={siteId} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-900 text-sm">{site.name}</p>
                          <p className="text-xs text-slate-400">{site.deviceCount || 0} devices</p>
                        </td>
                        <td className="px-4 py-3">
                          {existingMapping ? (
                            <Badge className="bg-emerald-100 text-emerald-700 font-normal">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              {getCustomerName(existingMapping.customer_id)}
                            </Badge>
                          ) : (
                            <Select value={selectedCustomerId} onValueChange={(val) => setSiteSelections(prev => ({ ...prev, [siteId]: val }))}>
                              <SelectTrigger className="h-8 text-sm text-slate-500 w-44">
                                <SelectValue placeholder="Select customer..." />
                              </SelectTrigger>
                              <SelectContent>
                                {customers.map(customer => (
                                  <SelectItem key={customer.id} value={customer.id}>{customer.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {!existingMapping && suggestedMatch ? (
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-slate-700">{suggestedMatch.customer.name}</span>
                              <Badge className={cn("text-xs font-normal", suggestedMatch.score === 100 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>
                                {suggestedMatch.score}%
                              </Badge>
                            </div>
                          ) : !existingMapping ? (
                            <span className="text-sm text-slate-400">{'\u2014'}</span>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {!existingMapping && (selectedCustomerId || suggestedMatch) ? (
                            <Button size="sm" onClick={() => applyMapping(site, selectedCustomerId || suggestedMatch?.customer.id)} className="bg-purple-600 hover:bg-purple-700 text-white text-xs h-7 px-3">
                              Apply
                            </Button>
                          ) : existingMapping ? (
                            <Button size="sm" variant="ghost" onClick={() => deleteMapping(existingMapping.id)} className="text-slate-400 hover:text-red-600 h-7">
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
                  {((currentPage - 1) * itemsPerPage) + 1}{'\u2013'}{Math.min(currentPage * itemsPerPage, filteredSites.length)} of {filteredSites.length}
                </p>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="outline" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="h-7 px-2">
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-xs text-slate-600 px-2">{currentPage} / {totalPages}</span>
                  <Button size="sm" variant="outline" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="h-7 px-2">
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
