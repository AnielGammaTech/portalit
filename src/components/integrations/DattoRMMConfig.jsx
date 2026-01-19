import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const [filterTab, setFilterTab] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [siteSelections, setSiteSelections] = useState({});
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
    <div className="space-y-5">
      {/* Connection Status */}
      {connectionStatus?.success && (
        <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 px-3 py-2 rounded-lg">
          <CheckCircle2 className="w-4 h-4" />
          Connected to {connectionStatus.account?.name}
        </div>
      )}

      {/* Info about API keys */}
      <div className="text-sm text-slate-500 bg-slate-50 rounded-lg p-3">
        API credentials are configured in the app settings. Use the buttons below to test the connection and manage site mappings.
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
          onClick={loadDattoSites}
          disabled={loadingSites}
          variant="outline"
        >
          <RefreshCw className={cn("w-4 h-4 mr-2", loadingSites && "animate-spin")} />
          {showMappingView ? 'Refresh Sites' : 'Load Sites'}
        </Button>
        {mappings.length > 0 && (
          <Button
            onClick={syncAllDevices}
            disabled={syncing}
            className="bg-slate-900 hover:bg-slate-800"
          >
            <RefreshCw className={cn("w-4 h-4 mr-2", syncing && "animate-spin")} />
            Sync All Devices
          </Button>
        )}
      </div>

      {/* Site Mappings Section */}
      <div className="border-t border-slate-200 pt-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h4 className="font-medium text-slate-900">Site Mappings</h4>
            <p className="text-sm text-slate-500">Map Datto RMM sites to your customers</p>
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
            /* Client Mapping View - Clean Light Design */
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              {/* Header */}
              <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <Input
                      placeholder="Search sites..."
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
                      All ({dattoSites.length})
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
                <div className="flex items-center gap-2">
                  <Button
                    onClick={autoMapSites}
                    disabled={automapping}
                    size="sm"
                    variant="outline"
                    className="gap-2 text-xs"
                  >
                    <Wand2 className={cn("w-3 h-3", automapping && "animate-spin")} />
                    Auto-Map All
                  </Button>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-4 py-3 w-1/3">Datto Site</th>
                      <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-4 py-3 w-1/4">Customer</th>
                      <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-4 py-3 w-1/3">Suggested Match</th>
                      <th className="text-right text-xs font-medium text-slate-500 uppercase tracking-wider px-4 py-3 w-20"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedSites.map(site => {
                      const siteId = String(site.id || site.uid);
                      const existingMapping = mappings.find(m => m.datto_site_id === siteId);
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
                              <Select
                                value={selectedCustomerId}
                                onValueChange={(val) => setSiteSelections(prev => ({ ...prev, [siteId]: val }))}
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
                          <td className="px-4 py-3">
                            {!existingMapping && suggestedMatch ? (
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-slate-700">{suggestedMatch.customer.name}</span>
                                <Badge className={cn(
                                  "text-xs font-normal",
                                  suggestedMatch.score === 100 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                                )}>
                                  {suggestedMatch.score}%
                                </Badge>
                              </div>
                            ) : !existingMapping ? (
                              <span className="text-sm text-slate-400">—</span>
                            ) : null}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {!existingMapping && (selectedCustomerId || suggestedMatch) ? (
                              <Button
                                size="sm"
                                onClick={() => applyMapping(site, selectedCustomerId || suggestedMatch?.customer.id)}
                                className="bg-purple-600 hover:bg-purple-700 text-white text-xs h-7 px-3"
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
                    {((currentPage - 1) * itemsPerPage) + 1}–{Math.min(currentPage * itemsPerPage, filteredSites.length)} of {filteredSites.length}
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