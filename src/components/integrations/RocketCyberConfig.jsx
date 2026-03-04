import React, { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { client, supabase } from '@/api/client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Shield,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Search,
  Link as LinkIcon,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Clock,
  ChevronDown
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from 'date-fns';

export default function RocketCyberConfig() {
  const [mspAccountId, setMspAccountId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [mappingSearchTerm, setMappingSearchTerm] = useState('');
  const [accounts, setAccounts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [configStatus, setConfigStatus] = useState('not_configured');
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [errorDetails, setErrorDetails] = useState(null);
  const [showErrorDetails, setShowErrorDetails] = useState(false);
  const [mappingPage, setMappingPage] = useState(1);
  const mappingsPerPage = 10;

  const queryClient = useQueryClient();

  // Fetch customers and existing mappings
  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => client.entities.Customer.list()
  });

  const { data: mappings = [], refetch: refetchMappings } = useQuery({
    queryKey: ['rocketcyber_mappings'],
    queryFn: () => client.entities.RocketCyberMapping.list()
  });

  const fetchLastSync = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('sync_logs')
        .select('completed_at')
        .eq('integration_type', 'rocketcyber')
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

  const testConnection = async () => {
    setIsTesting(true);
    setErrorDetails(null);
    try {
      const result = await client.functions.invoke('syncRocketCyber', {
        action: 'test_connection'
      });
      if (result.data.success) {
        setConfigStatus('connected');
        toast.success('RocketCyber API connection successful');
      } else {
        const errMsg = result.data.error || 'Connection failed';
        setConfigStatus('configured');
        setErrorDetails(errMsg);
        toast.error(errMsg);
      }
    } catch (error) {
      const errMsg = error.message || 'Connection test failed';
      setConfigStatus('configured');
      setErrorDetails(errMsg);
      toast.error('Failed to connect: ' + errMsg);
    } finally {
      setIsTesting(false);
    }
  };

  const listAccounts = async () => {
    if (!mspAccountId) {
      toast.error('Please enter your MSP Account ID');
      return;
    }
    
    setIsLoading(true);
    try {
      const result = await client.functions.invoke('syncRocketCyber', { 
        action: 'list_accounts',
        msp_account_id: mspAccountId
      });
      if (result.data.success) {
        setAccounts(result.data.customers || []);
        toast.success(`Found ${result.data.customers?.length || 0} customer accounts`);
      }
    } catch (error) {
      toast.error('Failed to list accounts: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const createMapping = async (rcAccount, customer) => {
    try {
      await client.entities.RocketCyberMapping.create({
        customer_id: customer.id,
        customer_name: customer.name,
        rocketcyber_account_id: String(rcAccount.id),
        rocketcyber_account_name: rcAccount.name
      });
      toast.success(`Mapped ${rcAccount.name} to ${customer.name}`);
      refetchMappings();
    } catch (error) {
      toast.error('Failed to create mapping: ' + error.message);
    }
  };

  const deleteMapping = async (mappingId) => {
    try {
      await client.entities.RocketCyberMapping.delete(mappingId);
      toast.success('Mapping removed');
      refetchMappings();
    } catch (error) {
      toast.error('Failed to remove mapping: ' + error.message);
    }
  };

  const syncAll = async () => {
    setIsLoading(true);
    setErrorDetails(null);
    try {
      const result = await client.functions.invoke('syncRocketCyber', {
        action: 'sync_all'
      });
      if (result.data.success) {
        toast.success(`Synced ${result.data.recordsSynced} incidents`);
        queryClient.invalidateQueries(['rocketcyber_incidents']);
        fetchLastSync();
      } else {
        const errMsg = result.data.error || 'Sync failed';
        setErrorDetails(errMsg);
        toast.error(errMsg);
      }
    } catch (error) {
      const errMsg = error.message || 'Sync failed';
      setErrorDetails(errMsg);
      toast.error('Sync failed: ' + errMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const mappedAccountIds = new Set(mappings.map(m => m.rocketcyber_account_id));
  const unmappedAccounts = accounts.filter(a => !mappedAccountIds.has(String(a.id)));
  const filteredAccounts = unmappedAccounts.filter(a => 
    a.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  // Filter and paginate existing mappings
  const filteredMappings = mappings.filter(mapping => {
    if (!mappingSearchTerm) return true;
    const customerName = (mapping.customer_name || '').toLowerCase();
    const accountName = (mapping.rocketcyber_account_name || '').toLowerCase();
    const query = mappingSearchTerm.toLowerCase();
    return customerName.includes(query) || accountName.includes(query);
  });
  
  const totalMappingPages = Math.ceil(filteredMappings.length / mappingsPerPage);
  const paginatedMappings = filteredMappings.slice(
    (mappingPage - 1) * mappingsPerPage, 
    mappingPage * mappingsPerPage
  );

  const statusColor = configStatus === 'connected' ? 'bg-emerald-500' : configStatus === 'configured' ? 'bg-amber-500' : 'bg-slate-300';
  const statusLabel = configStatus === 'connected' ? 'Connected' : configStatus === 'configured' ? 'Configured' : 'Not configured';
  const statusBg = configStatus === 'connected' ? 'bg-emerald-50 border-emerald-200' : configStatus === 'configured' ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200';
  const statusTextCls = configStatus === 'connected' ? 'text-emerald-700' : configStatus === 'configured' ? 'text-amber-700' : 'text-slate-500';

  return (
    <div className="space-y-6">
      {/* Connection Status Header */}
      <div className={cn("flex items-center justify-between px-4 py-3 rounded-lg border", statusBg)}>
        <div className="flex items-center gap-3">
          <div className={cn("w-2.5 h-2.5 rounded-full", statusColor)} />
          <span className={cn("text-sm font-medium", statusTextCls)}>{statusLabel}</span>
          {configStatus === 'connected' && (
            <Badge className="bg-emerald-100 text-emerald-700 text-xs font-normal">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              RocketCyber
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

      {/* Connection Test */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-orange-500" />
            RocketCyber SOC Integration
          </CardTitle>
          <CardDescription>
            Connect to RocketCyber to sync security incidents and alerts
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Button
              onClick={testConnection}
              disabled={isTesting}
              variant="outline"
            >
              {isTesting ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : configStatus === 'connected' ? (
                <CheckCircle2 className="w-4 h-4 mr-2 text-green-500" />
              ) : configStatus === 'configured' ? (
                <XCircle className="w-4 h-4 mr-2 text-red-500" />
              ) : (
                <Shield className="w-4 h-4 mr-2" />
              )}
              Test Connection
            </Button>
            {configStatus === 'connected' && (
              <Badge variant="outline" className="text-green-600 border-green-300">
                Connected
              </Badge>
            )}
          </div>

          <div className="border-t pt-4">
            <Label>MSP Account ID</Label>
            <p className="text-sm text-slate-500 mb-2">
              Enter your RocketCyber MSP/Provider account ID to list customer accounts
            </p>
            <div className="flex gap-2">
              <Input
                value={mspAccountId}
                onChange={(e) => setMspAccountId(e.target.value)}
                placeholder="e.g., 12345"
                className="max-w-xs"
              />
              <Button onClick={listAccounts} disabled={isLoading}>
                {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'List Accounts'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Current Mappings */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Mapped Customers</CardTitle>
            <CardDescription>{mappings.length} customers mapped</CardDescription>
          </div>
          {mappings.length > 0 && (
            <Button onClick={syncAll} disabled={isLoading} size="sm">
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Sync All Incidents
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {mappings.length === 0 ? (
            <p className="text-slate-500 text-sm">No customers mapped yet. List accounts above to start mapping.</p>
          ) : (
            <div className="space-y-3">
              {/* Search for existing mappings */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="Search mapped customers..."
                  value={mappingSearchTerm}
                  onChange={(e) => { setMappingSearchTerm(e.target.value); setMappingPage(1); }}
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
                      <LinkIcon className="w-4 h-4 text-slate-400" />
                      <div>
                        <p className="font-medium">{mapping.customer_name}</p>
                        <p className="text-sm text-slate-500">
                          RC Account: {mapping.rocketcyber_account_name} ({mapping.rocketcyber_account_id})
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {mapping.last_synced && (
                        <span className="text-xs text-slate-500">
                          Last sync: {new Date(mapping.last_synced).toLocaleDateString()}
                        </span>
                      )}
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
              
              {filteredMappings.length === 0 && mappingSearchTerm && (
                <p className="text-sm text-slate-500 py-4 text-center">
                  No mappings found for "{mappingSearchTerm}"
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Available Accounts to Map */}
      {accounts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Available RocketCyber Accounts</CardTitle>
            <CardDescription>
              Map RocketCyber accounts to your customers
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search accounts..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredAccounts.map(account => (
                <div 
                  key={account.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div>
                    <p className="font-medium">{account.name}</p>
                    <p className="text-sm text-slate-500">ID: {account.id}</p>
                  </div>
                  <select
                    className="text-sm border rounded px-2 py-1"
                    defaultValue=""
                    onChange={(e) => {
                      const customer = customers.find(c => c.id === e.target.value);
                      if (customer) {
                        createMapping(account, customer);
                        e.target.value = '';
                      }
                    }}
                  >
                    <option value="">Map to customer...</option>
                    {customers
                      .filter(c => !mappings.some(m => m.customer_id === c.id))
                      .map(customer => (
                        <option key={customer.id} value={customer.id}>
                          {customer.name}
                        </option>
                      ))}
                  </select>
                </div>
              ))}
              {filteredAccounts.length === 0 && (
                <p className="text-slate-500 text-sm text-center py-4">
                  {accounts.length === mappings.length 
                    ? 'All accounts have been mapped'
                    : 'No accounts match your search'}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}