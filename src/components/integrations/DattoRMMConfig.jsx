import React, { useState, useEffect } from 'react';
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
  Monitor, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle,
  Link2,
  Building2,
  Trash2,
  Wand2,
  Search,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from "@/lib/utils";

export default function DattoRMMConfig() {
  const [testing, setTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [loadingSites, setLoadingSites] = useState(false);
  const [dattoSites, setDattoSites] = useState([]);
  const [showMappingView, setShowMappingView] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [automapping, setAutomapping] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState('all'); // 'all', 'mapped', 'unmapped'
  const [currentPage, setCurrentPage] = useState(1);
  const [siteSelections, setSiteSelections] = useState({}); // siteId -> customerId
  const itemsPerPage = 10;

  const queryClient = useQueryClient();

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
  });

  const { data: mappings = [], refetch: refetchMappings } = useQuery({
    queryKey: ['datto_mappings'],
    queryFn: () => base44.entities.DattoSiteMapping.list(),
  });

  const testConnection = async () => {
    setTesting(true);
    try {
      const response = await base44.functions.invoke('syncDattoRMMDevices', { action: 'test_connection' });
      if (response.data.success) {
        setConnectionStatus({ success: true, account: response.data.account });
        toast.success(`Connected to ${response.data.account.name}`);
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

  const loadDattoSites = async () => {
    setLoadingSites(true);
    try {
      const response = await base44.functions.invoke('syncDattoRMMDevices', { action: 'list_sites' });
      if (response.data.success) {
        setDattoSites(response.data.sites);
        setShowMappingView(true);
        setCurrentPage(1);
      } else {
        toast.error(response.data.error || 'Failed to load sites');
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoadingSites(false);
    }
  };

  const applyMapping = async (site, customerId) => {
    if (!customerId) return;
    
    try {
      await base44.entities.DattoSiteMapping.create({
        customer_id: customerId,
        datto_site_id: String(site.id || site.uid),
        datto_site_name: site.name
      });
      toast.success(`Mapped ${site.name} successfully!`);
      refetchMappings();
      setSiteSelections(prev => ({ ...prev, [site.id || site.uid]: '' }));
    } catch (error) {
      toast.error(error.message);
    }
  };

  // Calculate suggested match for a site based on name similarity
  const getSuggestedMatch = (siteName) => {
    const siteNameLower = siteName.toLowerCase().trim();
    let bestMatch = null;
    let bestScore = 0;
    
    for (const customer of customers) {
      const customerNameLower = customer.name.toLowerCase().trim();
      
      // Exact match
      if (siteNameLower === customerNameLower) {
        return { customer, score: 100 };
      }
      
      // Contains match
      if (siteNameLower.includes(customerNameLower) || customerNameLower.includes(siteNameLower)) {
        const score = Math.round((Math.min(siteNameLower.length, customerNameLower.length) / Math.max(siteNameLower.length, customerNameLower.length)) * 100);
        if (score > bestScore) {
          bestScore = score;
          bestMatch = customer;
        }
      }
      
      // Word-based matching
      const siteWords = siteNameLower.split(/[\s,.-]+/).filter(w => w.length > 2);
      const customerWords = customerNameLower.split(/[\s,.-]+/).filter(w => w.length > 2);
      const matchingWords = siteWords.filter(sw => customerWords.some(cw => cw.includes(sw) || sw.includes(cw)));
      
      if (matchingWords.length > 0) {
        const score = Math.round((matchingWords.length / Math.max(siteWords.length, customerWords.length)) * 100);
        if (score > bestScore) {
          bestScore = score;
          bestMatch = customer;
        }
      }
    }
    
    return bestMatch && bestScore >= 50 ? { customer: bestMatch, score: bestScore } : null;
  };

  // Filter and paginate sites
  const getFilteredSites = () => {
    let filtered = dattoSites;
    
    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(site => 
        site.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    // Tab filter
    if (filterTab === 'mapped') {
      filtered = filtered.filter(site => 
        mappings.some(m => m.datto_site_id === String(site.id || site.uid))
      );
    } else if (filterTab === 'unmapped') {
      filtered = filtered.filter(site => 
        !mappings.some(m => m.datto_site_id === String(site.id || site.uid))
      );
    }
    
    return filtered;
  };

  const filteredSites = getFilteredSites();
  const totalPages = Math.ceil(filteredSites.length / itemsPerPage);
  const paginatedSites = filteredSites.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  
  const mappedCount = dattoSites.filter(site => mappings.some(m => m.datto_site_id === String(site.id || site.uid))).length;
  const unmappedCount = dattoSites.length - mappedCount;

  const deleteMapping = async (mappingId) => {
    try {
      await base44.entities.DattoSiteMapping.delete(mappingId);
      toast.success('Mapping removed');
      refetchMappings();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const autoMapSites = async () => {
    setAutomapping(true);
    try {
      const response = await base44.functions.invoke('syncDattoRMMDevices', { action: 'automap' });
      if (response.data.success) {
        if (response.data.mappedCount > 0) {
          toast.success(`Auto-mapped ${response.data.mappedCount} sites to customers!`);
        } else {
          toast.info('No new matches found. Sites may already be mapped or names don\'t match.');
        }
        refetchMappings();
      } else {
        toast.error(response.data.error || 'Auto-map failed');
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setAutomapping(false);
    }
  };

  const syncAllDevices = async () => {
    setSyncing(true);
    try {
      const response = await base44.functions.invoke('syncDattoRMMDevices', { action: 'sync_all' });
      if (response.data.success) {
        toast.success(`Synced ${response.data.recordsSynced} devices!`);
        queryClient.invalidateQueries({ queryKey: ['devices'] });
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

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
            <Monitor className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">Datto RMM</h3>
            <p className="text-sm text-slate-500">Sync devices and monitoring data</p>
          </div>
        </div>
        {connectionStatus?.success && (
          <Badge className="bg-emerald-100 text-emerald-700">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Connected
          </Badge>
        )}
      </div>

      <div className="space-y-4">
        {/* Test Connection */}
        <div className="flex items-center gap-3">
          <Button
            onClick={testConnection}
            disabled={testing}
            variant="outline"
            className="gap-2"
          >
            <RefreshCw className={cn("w-4 h-4", testing && "animate-spin")} />
            Test Connection
          </Button>
          
          {connectionStatus && (
            <span className={cn(
              "text-sm",
              connectionStatus.success ? "text-emerald-600" : "text-red-600"
            )}>
              {connectionStatus.success 
                ? `Connected to ${connectionStatus.account?.name}` 
                : connectionStatus.error}
            </span>
          )}
        </div>

        {/* Site Mappings */}
        <div className="border-t border-slate-100 pt-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-slate-900">Site Mappings</h4>
            <div className="flex items-center gap-2">
              <Button
                onClick={loadDattoSites}
                disabled={loadingSites}
                size="sm"
                variant="outline"
                className="gap-2"
              >
                <Link2 className={cn("w-4 h-4", loadingSites && "animate-spin")} />
                {showMappingView ? 'Refresh Sites' : 'Client Mapping'}
              </Button>
              {mappings.length > 0 && (
                <Button
                  onClick={syncAllDevices}
                  disabled={syncing}
                  size="sm"
                  className="gap-2 bg-blue-600 hover:bg-blue-700"
                >
                  <RefreshCw className={cn("w-4 h-4", syncing && "animate-spin")} />
                  Sync All Devices
                </Button>
              )}
            </div>
          </div>

          {!showMappingView ? (
            mappings.length === 0 ? (
              <p className="text-sm text-slate-500 py-4 text-center">
                No sites mapped yet. Click "Client Mapping" to link Datto sites to customers.
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
                        <p className="text-sm text-slate-500">→ {mapping.datto_site_name}</p>
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
            /* Client Mapping View */
            <div className="bg-slate-900 rounded-xl p-4 text-white">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold">Client Mapping</h4>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={autoMapSites}
                    disabled={automapping}
                    size="sm"
                    variant="outline"
                    className="gap-2 bg-transparent border-slate-600 text-white hover:bg-slate-800"
                  >
                    <Wand2 className={cn("w-4 h-4", automapping && "animate-spin")} />
                    Apply 100% Matches
                  </Button>
                  <Button
                    onClick={() => { setShowMappingView(false); loadDattoSites(); }}
                    size="sm"
                    variant="ghost"
                    className="gap-2 text-slate-400 hover:text-white"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Refresh
                  </Button>
                </div>
              </div>

              {/* Search and Filters */}
              <div className="flex items-center justify-between mb-4">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    placeholder="Search clients..."
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                    className="pl-9 w-64 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                  />
                </div>
                <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1">
                  <button
                    onClick={() => { setFilterTab('all'); setCurrentPage(1); }}
                    className={cn(
                      "px-3 py-1.5 text-sm rounded-md transition-colors",
                      filterTab === 'all' ? "bg-slate-700 text-white" : "text-slate-400 hover:text-white"
                    )}
                  >
                    All ({dattoSites.length})
                  </button>
                  <button
                    onClick={() => { setFilterTab('mapped'); setCurrentPage(1); }}
                    className={cn(
                      "px-3 py-1.5 text-sm rounded-md transition-colors",
                      filterTab === 'mapped' ? "bg-slate-700 text-white" : "text-slate-400 hover:text-white"
                    )}
                  >
                    Mapped ({mappedCount})
                  </button>
                  <button
                    onClick={() => { setFilterTab('unmapped'); setCurrentPage(1); }}
                    className={cn(
                      "px-3 py-1.5 text-sm rounded-md transition-colors",
                      filterTab === 'unmapped' ? "bg-slate-700 text-white" : "text-slate-400 hover:text-white"
                    )}
                  >
                    Unmapped ({unmappedCount})
                  </button>
                </div>
              </div>

              {/* Table Header */}
              <div className="grid grid-cols-12 gap-4 px-3 py-2 text-xs font-medium text-slate-400 uppercase tracking-wider border-b border-slate-700">
                <div className="col-span-4">Datto Site</div>
                <div className="col-span-3">Mapped To</div>
                <div className="col-span-4">Suggested Mapping</div>
                <div className="col-span-1"></div>
              </div>

              {/* Site Rows */}
              <div className="divide-y divide-slate-800">
                {paginatedSites.map(site => {
                  const siteId = String(site.id || site.uid);
                  const existingMapping = mappings.find(m => m.datto_site_id === siteId);
                  const suggestedMatch = !existingMapping ? getSuggestedMatch(site.name) : null;
                  const selectedCustomerId = siteSelections[siteId] || '';
                  
                  return (
                    <div key={siteId} className="grid grid-cols-12 gap-4 px-3 py-3 items-center hover:bg-slate-800/50">
                      {/* Site Name */}
                      <div className="col-span-4">
                        <p className="font-medium text-white">{site.name}</p>
                        <p className="text-xs text-slate-500">{siteId}</p>
                      </div>
                      
                      {/* Mapped To */}
                      <div className="col-span-3">
                        {existingMapping ? (
                          <div className="flex items-center gap-2">
                            <Select
                              value={existingMapping.customer_id}
                              onValueChange={async (newCustomerId) => {
                                await deleteMapping(existingMapping.id);
                                await applyMapping(site, newCustomerId);
                              }}
                            >
                              <SelectTrigger className="bg-slate-800 border-slate-700 text-white text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="_none">No mapping</SelectItem>
                                {customers.map(customer => (
                                  <SelectItem key={customer.id} value={customer.id}>
                                    {customer.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        ) : (
                          <Select
                            value={selectedCustomerId}
                            onValueChange={(val) => setSiteSelections(prev => ({ ...prev, [siteId]: val }))}
                          >
                            <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-400 text-sm">
                              <SelectValue placeholder="No mapping" />
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
                      </div>
                      
                      {/* Suggested Mapping */}
                      <div className="col-span-4">
                        {!existingMapping && suggestedMatch ? (
                          <Select
                            value={selectedCustomerId || suggestedMatch.customer.id}
                            onValueChange={(val) => setSiteSelections(prev => ({ ...prev, [siteId]: val }))}
                          >
                            <SelectTrigger className="bg-slate-800 border-slate-700 text-white text-sm">
                              <SelectValue>
                                {(selectedCustomerId ? customers.find(c => c.id === selectedCustomerId)?.name : suggestedMatch.customer.name)?.toUpperCase()} ({selectedCustomerId ? '—' : `${suggestedMatch.score}%`})
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {customers.map(customer => (
                                <SelectItem key={customer.id} value={customer.id}>
                                  {customer.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : !existingMapping ? (
                          <span className="text-slate-500 text-sm">No suggestion</span>
                        ) : (
                          <span className="text-emerald-500 text-sm flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Mapped
                          </span>
                        )}
                      </div>
                      
                      {/* Apply Button */}
                      <div className="col-span-1 flex justify-end">
                        {!existingMapping && (selectedCustomerId || suggestedMatch) && (
                          <Button
                            size="sm"
                            onClick={() => applyMapping(site, selectedCustomerId || suggestedMatch?.customer.id)}
                            className="bg-purple-600 hover:bg-purple-700 text-white text-xs px-3"
                          >
                            Apply
                          </Button>
                        )}
                        {existingMapping && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => deleteMapping(existingMapping.id)}
                            className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-700">
                  <p className="text-sm text-slate-400">
                    Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredSites.length)} of {filteredSites.length} clients
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="bg-transparent border-slate-600 text-white hover:bg-slate-800"
                    >
                      <ChevronLeft className="w-4 h-4" /> Previous
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="bg-transparent border-slate-600 text-white hover:bg-slate-800"
                    >
                      Next <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}