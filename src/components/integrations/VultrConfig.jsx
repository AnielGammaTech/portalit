import React, { useState, useEffect } from 'react';
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
  Search,
  ChevronLeft,
  ChevronRight,
  XCircle,
  ChevronDown,
  Key,
  Server,
  Cpu,
  HardDrive,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from "@/lib/utils";

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

export default function VultrConfig() {
  const [testing, setTesting] = useState(false);
  const [configStatus, setConfigStatus] = useState(CONNECTION_STATES.NOT_CONFIGURED);
  const [loadingInstances, setLoadingInstances] = useState(false);
  const [vultrInstances, setVultrInstances] = useState([]);
  const [showMappingView, setShowMappingView] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [instanceSelections, setInstanceSelections] = useState({});
  const [mappingSearchQuery, setMappingSearchQuery] = useState('');
  const [mappingPage, setMappingPage] = useState(1);
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
    queryKey: ['vultr_mappings'],
    queryFn: () => client.entities.VultrMapping.list(),
  });

  useEffect(() => {
    if (mappings.length > 0 && configStatus === CONNECTION_STATES.NOT_CONFIGURED) {
      setConfigStatus(CONNECTION_STATES.CONNECTED);
    }
  }, [mappings.length]);

  const testConnection = async () => {
    setTesting(true);
    setErrorDetails(null);
    try {
      const response = await client.functions.invoke('syncVultr', { action: 'test_connection' });
      if (response.success) {
        setConfigStatus(CONNECTION_STATES.CONNECTED);
        toast.success(`Connected! Found ${response.instanceCount || 0} instances.`);
      } else {
        setConfigStatus(CONNECTION_STATES.CONFIGURED);
        setErrorDetails(response.error);
        toast.error(response.error || 'Connection failed');
      }
    } catch (error) {
      setConfigStatus(CONNECTION_STATES.CONFIGURED);
      setErrorDetails(error.message);
      toast.error(error.message);
    } finally {
      setTesting(false);
    }
  };

  const loadInstances = async () => {
    setLoadingInstances(true);
    setErrorDetails(null);
    try {
      const response = await client.functions.invoke('syncVultr', { action: 'list_instances' });
      if (response.success) {
        setVultrInstances(response.instances || []);
        setShowMappingView(true);
        setCurrentPage(1);
      } else {
        setErrorDetails(response.error);
        toast.error(response.error || 'Failed to load instances');
      }
    } catch (error) {
      setErrorDetails(error.message);
      toast.error(error.message);
    } finally {
      setLoadingInstances(false);
    }
  };

  const applyMapping = async (instance, customerId) => {
    if (!customerId) return;
    const customerName = customers.find(c => c.id === customerId)?.name || '';
    try {
      await client.entities.VultrMapping.create({
        customer_id: customerId,
        customer_name: customerName,
        vultr_instance_id: String(instance.id),
        vultr_instance_label: instance.label,
        vultr_plan: instance.plan,
        vultr_region: instance.region,
      });
      toast.success(`Mapped ${instance.label} successfully!`);
      refetchMappings();
      setInstanceSelections(prev => ({ ...prev, [instance.id]: '' }));
    } catch (error) {
      toast.error(`Failed to map instance: ${error.message}`);
    }
  };

  const getSuggestedMatch = (instanceLabel) => {
    const labelLower = instanceLabel.toLowerCase().trim();
    let bestMatch = null;
    let bestScore = 0;

    for (const customer of customers) {
      const customerNameLower = customer.name.toLowerCase().trim();
      if (labelLower === customerNameLower) return { customer, score: 100 };
      if (labelLower.includes(customerNameLower) || customerNameLower.includes(labelLower)) {
        const score = Math.round((Math.min(labelLower.length, customerNameLower.length) / Math.max(labelLower.length, customerNameLower.length)) * 100);
        if (score > bestScore) { bestScore = score; bestMatch = customer; }
      }
      const labelWords = labelLower.split(/[\s,.\-_]+/).filter(w => w.length > 2);
      const customerWords = customerNameLower.split(/[\s,.\-_]+/).filter(w => w.length > 2);
      const matchingWords = labelWords.filter(sw => customerWords.some(cw => cw.includes(sw) || sw.includes(cw)));
      if (matchingWords.length > 0) {
        const score = Math.round((matchingWords.length / Math.max(labelWords.length, customerWords.length)) * 100);
        if (score > bestScore) { bestScore = score; bestMatch = customer; }
      }
    }
    return bestMatch && bestScore >= 50 ? { customer: bestMatch, score: bestScore } : null;
  };

  const getFilteredInstances = () => {
    let filtered = vultrInstances;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(inst =>
        inst.label.toLowerCase().includes(q) ||
        inst.main_ip.includes(q) ||
        inst.hostname.toLowerCase().includes(q)
      );
    }
    if (filterTab === 'mapped') {
      filtered = filtered.filter(inst => mappings.some(m => m.vultr_instance_id === String(inst.id)));
    } else if (filterTab === 'unmapped') {
      filtered = filtered.filter(inst => !mappings.some(m => m.vultr_instance_id === String(inst.id)));
    }
    return filtered;
  };

  const filteredInstances = getFilteredInstances();
  const totalPages = Math.ceil(filteredInstances.length / itemsPerPage);
  const paginatedInstances = filteredInstances.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const mappedCount = vultrInstances.filter(inst => mappings.some(m => m.vultr_instance_id === String(inst.id))).length;
  const unmappedCount = vultrInstances.length - mappedCount;

  const deleteMapping = async (mappingId) => {
    try {
      await client.entities.VultrMapping.delete(mappingId);
      toast.success('Mapping removed');
      refetchMappings();
    } catch (error) {
      toast.error(`Failed to remove mapping: ${error.message}`);
    }
  };

  const syncAll = async () => {
    setSyncing(true);
    setErrorDetails(null);
    try {
      const response = await client.functions.invoke('syncVultr', { action: 'sync_all' });
      if (response.success) {
        toast.success(`Synced ${response.synced} instance(s)!`);
        queryClient.invalidateQueries({ queryKey: ['vultr_mappings'] });
      } else {
        setErrorDetails(response.error);
        toast.error(response.error || 'Sync failed');
      }
    } catch (error) {
      setErrorDetails(error.message);
      toast.error(error.message);
    } finally {
      setSyncing(false);
    }
  };

  const getCustomerName = (customerId) => customers.find(c => c.id === customerId)?.name || 'Unknown';

  const filteredMappings = mappings.filter(mapping => {
    if (!mappingSearchQuery) return true;
    const customerName = getCustomerName(mapping.customer_id).toLowerCase();
    const label = (mapping.vultr_instance_label || '').toLowerCase();
    const query = mappingSearchQuery.toLowerCase();
    return customerName.includes(query) || label.includes(query);
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
          <Key className="w-4 h-4" /> Vultr API Key
        </div>
        <p className="text-xs text-slate-500 mt-1">
          API key is configured via environment variable (<code className="bg-slate-200 px-1 rounded">VULTR_API_KEY</code>).
          Get your key from <a href="https://my.vultr.com/settings/#settingsapi" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">my.vultr.com/settings</a>
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Button onClick={testConnection} disabled={testing} variant="outline">
          <RefreshCw className={cn("w-4 h-4 mr-2", testing && "animate-spin")} />
          Test Connection
        </Button>
        <Button onClick={loadInstances} disabled={loadingInstances} variant="outline">
          <RefreshCw className={cn("w-4 h-4 mr-2", loadingInstances && "animate-spin")} />
          {showMappingView ? 'Refresh Instances' : 'Load Instances'}
        </Button>
        {mappings.length > 0 && (
          <Button onClick={syncAll} disabled={syncing} className="bg-slate-900 hover:bg-slate-800">
            <RefreshCw className={cn("w-4 h-4 mr-2", syncing && "animate-spin")} />
            {syncing ? 'Syncing...' : 'Sync All Instances'}
          </Button>
        )}
      </div>

      {/* Instance Mappings */}
      <div className="border-t border-slate-200 pt-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h4 className="font-medium text-slate-900">Instance Mappings</h4>
            <p className="text-sm text-slate-500">Map Vultr cloud instances to your customers (for 3CX hosting)</p>
          </div>
        </div>

        {!showMappingView ? (
          mappings.length === 0 ? (
            <p className="text-sm text-slate-500 py-4 text-center">
              No instances mapped yet. Click "Load Instances" to link Vultr servers to customers.
            </p>
          ) : (
            <div className="space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="Search mapped customers or instances..."
                  value={mappingSearchQuery}
                  onChange={(e) => { setMappingSearchQuery(e.target.value); setMappingPage(1); }}
                  className="pl-9 h-9 text-sm"
                />
              </div>
              <div className="space-y-2">
                {paginatedMappings.map(mapping => (
                  <div key={mapping.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Server className="w-4 h-4 text-slate-400" />
                      <div>
                        <p className="font-medium text-slate-900">{getCustomerName(mapping.customer_id)}</p>
                        <p className="text-sm text-slate-500">{'\u2192'} {mapping.vultr_instance_label || mapping.vultr_instance_id}</p>
                        {mapping.vultr_region && (
                          <p className="text-xs text-slate-400">{mapping.vultr_region} {'\u00B7'} {mapping.vultr_plan}</p>
                        )}
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
                    placeholder="Search instances..."
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                    className="pl-9 w-56 h-9 text-sm"
                  />
                </div>
                <div className="flex items-center border border-slate-200 rounded-lg bg-white">
                  <button onClick={() => { setFilterTab('all'); setCurrentPage(1); }} className={cn("px-3 py-1.5 text-xs font-medium rounded-l-lg transition-colors", filterTab === 'all' ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100")}>
                    All ({vultrInstances.length})
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
                    <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-4 py-3">Instance</th>
                    <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-4 py-3">Specs</th>
                    <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-4 py-3">Customer</th>
                    <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-4 py-3">Suggested</th>
                    <th className="text-right text-xs font-medium text-slate-500 uppercase tracking-wider px-4 py-3 w-20"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedInstances.map(inst => {
                    const instId = String(inst.id);
                    const existingMapping = mappings.find(m => m.vultr_instance_id === instId);
                    const suggestedMatch = !existingMapping ? getSuggestedMatch(inst.label) : null;
                    const selectedCustomerId = instanceSelections[instId] || '';

                    return (
                      <tr key={instId} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-900 text-sm">{inst.label}</p>
                          <p className="text-xs text-slate-400">{inst.main_ip} {'\u00B7'} {inst.region}</p>
                          <p className="text-xs text-slate-400">{inst.os}</p>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3 text-xs text-slate-500">
                            <span className="flex items-center gap-1"><Cpu className="w-3 h-3" />{inst.vcpu_count} vCPU</span>
                            <span>{inst.ram_display}</span>
                            <span className="flex items-center gap-1"><HardDrive className="w-3 h-3" />{inst.disk_display}</span>
                          </div>
                          <Badge className={cn("mt-1 text-xs font-normal", inst.power_status === 'running' ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700")}>
                            {inst.power_status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          {existingMapping ? (
                            <Badge className="bg-emerald-100 text-emerald-700 font-normal">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              {getCustomerName(existingMapping.customer_id)}
                            </Badge>
                          ) : (
                            <Select value={selectedCustomerId} onValueChange={(val) => setInstanceSelections(prev => ({ ...prev, [instId]: val }))}>
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
                            <Button size="sm" onClick={() => applyMapping(inst, selectedCustomerId || suggestedMatch?.customer.id)} className="bg-purple-600 hover:bg-purple-700 text-white text-xs h-7 px-3">
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
                  {((currentPage - 1) * itemsPerPage) + 1}{'\u2013'}{Math.min(currentPage * itemsPerPage, filteredInstances.length)} of {filteredInstances.length}
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
