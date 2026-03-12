import React, { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { client, supabase } from '@/api/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Shield,
  RefreshCw,
  Link2,
  Unlink,
  CheckCircle2,
  AlertCircle,
  Search,
  Building2,
  Loader2,
  XCircle,
  ChevronDown,
  Clock
} from 'lucide-react';
import { cn } from "@/lib/utils";
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function DattoEDRConfig() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [edrTenants, setEdrTenants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [testing, setTesting] = useState(false);
  const [configStatus, setConfigStatus] = useState('not_configured');
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [errorDetails, setErrorDetails] = useState(null);
  const [showErrorDetails, setShowErrorDetails] = useState(false);
  const itemsPerPage = 10;

  // Fetch customers
  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => client.entities.Customer.filter({ status: 'active' })
  });

  // Fetch existing mappings
  const { data: mappings = [], refetch: refetchMappings } = useQuery({
    queryKey: ['datto-edr-mappings'],
    queryFn: () => client.entities.DattoEDRMapping.list()
  });

  const fetchLastSync = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('sync_logs')
        .select('completed_at')
        .eq('integration_type', 'datto_edr')
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

  // Test connection to EDR API
  const testConnection = async () => {
    setTesting(true);
    setErrorDetails(null);
    try {
      const response = await client.functions.invoke('syncDattoEDR', { action: 'test_connection' });
      if (response.success) {
        setConfigStatus('connected');
        toast.success('Connected to Datto EDR');
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

  // Fetch EDR tenants from API
  const fetchEDRTenants = async () => {
    setLoading(true);
    try {
      const response = await client.functions.invoke('syncDattoEDR', { action: 'list_tenants' });
      if (response.success) {
        setEdrTenants(response.tenants || []);
        toast.success(`Found ${response.tenants?.length || 0} EDR tenants`);
      } else {
        toast.error(response.error || 'Failed to fetch tenants');
      }
    } catch (error) {
      const errMsg = error.message || 'Failed to connect to Datto EDR';
      setErrorDetails(errMsg);
      toast.error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  // Map a customer to an EDR tenant
  const mapCustomer = async (customerId, tenantId, tenantName) => {
    const customer = customers.find(c => c.id === customerId);
    
    // Check if already mapped
    const existingMapping = mappings.find(m => m.customer_id === customerId);
    if (existingMapping) {
      await client.entities.DattoEDRMapping.update(existingMapping.id, {
        edr_tenant_id: tenantId,
        edr_tenant_name: tenantName
      });
    } else {
      await client.entities.DattoEDRMapping.create({
        customer_id: customerId,
        customer_name: customer?.name,
        edr_tenant_id: tenantId,
        edr_tenant_name: tenantName
      });
    }
    
    refetchMappings();
    toast.success(`Mapped ${customer?.name} to ${tenantName}`);
  };

  // Remove mapping
  const removeMapping = async (mappingId) => {
    await client.entities.DattoEDRMapping.delete(mappingId);
    refetchMappings();
    toast.success('Mapping removed');
  };

  // Sync all mapped customers
  const syncAll = async () => {
    setSyncing(true);
    setErrorDetails(null);
    try {
      const response = await client.functions.invoke('syncDattoEDR', { action: 'sync_all' });
      if (response.success) {
        toast.success(`Synced ${response.synced || 0} customers`);
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

  // Filter customers
  const filteredCustomers = customers.filter(c => 
    c.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  // Pagination for filtered customers
  const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage);
  const paginatedCustomers = filteredCustomers.slice(
    (currentPage - 1) * itemsPerPage, 
    currentPage * itemsPerPage
  );

  // Get mapping for a customer
  const getMapping = (customerId) => mappings.find(m => m.customer_id === customerId);

  // Get unmapped tenants
  const mappedTenantIds = mappings.map(m => m.edr_tenant_id);
  const unmappedTenants = edrTenants.filter(t => !mappedTenantIds.includes(t.id));

  const statusColor = configStatus === 'connected' ? 'bg-emerald-500' : configStatus === 'configured' ? 'bg-amber-500' : 'bg-slate-300';
  const statusLabel = configStatus === 'connected' ? 'Connected' : configStatus === 'configured' ? 'Configured' : 'Not configured';
  const statusBg = configStatus === 'connected' ? 'bg-emerald-50 border-emerald-200' : configStatus === 'configured' ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200';
  const statusText = configStatus === 'connected' ? 'text-emerald-700' : configStatus === 'configured' ? 'text-amber-700' : 'text-slate-500';

  return (
    <div className="space-y-6">
      {/* Connection Status Header */}
      <div className={cn("flex items-center justify-between px-4 py-3 rounded-lg border", statusBg)}>
        <div className="flex items-center gap-3">
          <div className={cn("w-2.5 h-2.5 rounded-full", statusColor)} />
          <span className={cn("text-sm font-medium", statusText)}>{statusLabel}</span>
          {configStatus === 'connected' && (
            <Badge className="bg-emerald-100 text-emerald-700 text-xs font-normal">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Datto EDR
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

      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-lg">Datto EDR Integration</CardTitle>
                <p className="text-sm text-slate-500">
                  {mappings.length} customer{mappings.length !== 1 ? 's' : ''} mapped
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={testConnection}
                disabled={testing}
              >
                {testing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Shield className="w-4 h-4 mr-2" />}
                Test Connection
              </Button>
              <Button
                variant="outline"
                onClick={fetchEDRTenants}
                disabled={loading}
              >
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                {edrTenants.length > 0 ? 'Refresh Tenants' : 'Load Tenants'}
              </Button>
              {mappings.length > 0 && (
                <Button onClick={syncAll} disabled={syncing}>
                  {syncing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                  {syncing ? 'Syncing...' : 'Sync All'}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Search & Filter */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input 
            placeholder="Search customers..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            className="pl-9"
          />
        </div>
        <Badge variant="outline" className="py-2">
          {mappings.length} Mapped
        </Badge>
        <Badge variant="outline" className="py-2 bg-amber-50 text-amber-700 border-amber-200">
          {customers.length - mappings.length} Unmapped
        </Badge>
      </div>

      {/* Tenants Status */}
      {edrTenants.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center">
            <Shield className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="font-medium text-slate-900 mb-1">No EDR Tenants Loaded</h3>
            <p className="text-sm text-slate-500 mb-4">
              Click "Load Tenants" to fetch available tenants from Datto EDR
            </p>
            <Button onClick={fetchEDRTenants} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Shield className="w-4 h-4 mr-2" />}
              Load EDR Tenants
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">
              Customer Mappings ({edrTenants.length} tenants available)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {paginatedCustomers.map(customer => {
                const mapping = getMapping(customer.id);
                return (
                  <div 
                    key={customer.id}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-lg border",
                      mapping ? "bg-green-50 border-green-200" : "bg-slate-50 border-slate-200"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center",
                        mapping ? "bg-green-100" : "bg-slate-200"
                      )}>
                        {mapping ? (
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                        ) : (
                          <Building2 className="w-4 h-4 text-slate-500" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">{customer.name}</p>
                        {mapping && (
                          <p className="text-xs text-green-600">
                            Mapped to: {mapping.edr_tenant_name}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {mapping ? (
                        <Button 
                          size="sm" 
                          variant="ghost"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => removeMapping(mapping.id)}
                        >
                          <Unlink className="w-4 h-4 mr-1" />
                          Unmap
                        </Button>
                      ) : (
                        <Select onValueChange={(value) => {
                          const tenant = edrTenants.find(t => t.id === value);
                          if (tenant) {
                            mapCustomer(customer.id, tenant.id, tenant.name);
                          }
                        }}>
                          <SelectTrigger className="w-48 h-8">
                            <SelectValue placeholder="Select EDR tenant..." />
                          </SelectTrigger>
                          <SelectContent>
                            {unmappedTenants.map(tenant => (
                              <SelectItem key={tenant.id} value={tenant.id}>
                                {tenant.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4 border-t border-slate-200 mt-4">
                <p className="text-xs text-slate-500">
                  {((currentPage - 1) * itemsPerPage) + 1}–{Math.min(currentPage * itemsPerPage, filteredCustomers.length)} of {filteredCustomers.length}
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
          </CardContent>
        </Card>
      )}
    </div>
  );
}