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
  Plus,
  Clock,
  Cloud,
  Users
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from "@/lib/utils";
import { format } from 'date-fns';

export default function SpanningConfig() {
  const [testing, setTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncingCustomerId, setSyncingCustomerId] = useState(null);
  const [syncingUsersCustomerId, setSyncingUsersCustomerId] = useState(null);
  
  // New mapping form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newMapping, setNewMapping] = useState({
    customer_id: '',
    api_token: '',
    region: 'us'
  });

  const queryClient = useQueryClient();

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
  });

  const { data: mappings = [], refetch: refetchMappings } = useQuery({
    queryKey: ['spanning_mappings'],
    queryFn: () => base44.entities.SpanningMapping.list(),
  });

  const testConnection = async () => {
    if (!newMapping.api_token) {
      toast.error('Please enter an API token');
      return;
    }
    
    setTesting(true);
    try {
      const response = await base44.functions.invoke('syncSpanningBackup', { 
        action: 'test_connection',
        api_token: newMapping.api_token,
        region: newMapping.region
      });
      if (response.data.success) {
        setConnectionStatus({ success: true, tenant: response.data.tenant });
        toast.success(`Connected to ${response.data.tenant.name}`);
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

  const addMapping = async () => {
    if (!newMapping.customer_id || !newMapping.api_token) {
      toast.error('Please select a customer and enter an API token');
      return;
    }

    try {
      await base44.entities.SpanningMapping.create({
        customer_id: newMapping.customer_id,
        api_token: newMapping.api_token,
        region: newMapping.region,
        spanning_tenant_name: connectionStatus?.tenant?.name || ''
      });
      toast.success('Mapping added successfully!');
      refetchMappings();
      setShowAddForm(false);
      setNewMapping({ customer_id: '', api_token: '', region: 'us' });
      setConnectionStatus(null);
    } catch (error) {
      toast.error(error.message);
    }
  };

  const deleteMapping = async (mappingId) => {
    try {
      await base44.entities.SpanningMapping.delete(mappingId);
      toast.success('Mapping removed');
      refetchMappings();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const syncCustomerLicenses = async (customerId) => {
    setSyncingCustomerId(customerId);
    try {
      const response = await base44.functions.invoke('syncSpanningBackup', { 
        action: 'sync_licenses', 
        customer_id: customerId 
      });
      if (response.data.success) {
        toast.success(`Synced ${response.data.totalUsers} users!`);
        queryClient.invalidateQueries({ queryKey: ['licenses'] });
        refetchMappings();
      } else {
        toast.error(response.data.error || 'Sync failed');
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
      const response = await base44.functions.invoke('syncSpanningBackup', { 
        action: 'sync_users', 
        customer_id: customerId 
      });
      if (response.data.success) {
        toast.success(`Synced ${response.data.totalSpanningUsers} users: ${response.data.created} new, ${response.data.matched} matched!`);
        queryClient.invalidateQueries({ queryKey: ['contacts'] });
        refetchMappings();
      } else {
        toast.error(response.data.error || 'User sync failed');
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSyncingUsersCustomerId(null);
    }
  };

  const syncAllLicenses = async () => {
    setSyncing(true);
    try {
      const response = await base44.functions.invoke('syncSpanningBackup', { action: 'sync_all' });
      if (response.data.success) {
        toast.success(`Synced ${response.data.synced} tenants!`);
        queryClient.invalidateQueries({ queryKey: ['licenses'] });
        refetchMappings();
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
      {/* Info */}
      <div className="text-sm text-slate-500 bg-slate-50 rounded-lg p-3">
        Connect Spanning Backup tenants to sync backup user data. Each customer needs their own API token from Spanning.
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Button
          onClick={() => setShowAddForm(!showAddForm)}
          variant="outline"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Mapping
        </Button>
        {mappings.length > 0 && (
          <Button
            onClick={syncAllLicenses}
            disabled={syncing}
            className="bg-slate-900 hover:bg-slate-800"
          >
            <RefreshCw className={cn("w-4 h-4 mr-2", syncing && "animate-spin")} />
            Sync All
          </Button>
        )}
      </div>

      {/* Add Mapping Form */}
      {showAddForm && (
        <div className="border border-slate-200 rounded-lg p-4 bg-white space-y-4">
          <h4 className="font-medium text-slate-900">Add New Spanning Mapping</h4>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Customer</Label>
              <Select
                value={newMapping.customer_id}
                onValueChange={(val) => setNewMapping({ ...newMapping, customer_id: val })}
              >
                <SelectTrigger>
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
            </div>
            
            <div className="space-y-2">
              <Label>Region</Label>
              <Select
                value={newMapping.region}
                onValueChange={(val) => setNewMapping({ ...newMapping, region: val })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="us">United States</SelectItem>
                  <SelectItem value="eu">European Union</SelectItem>
                  <SelectItem value="uk">United Kingdom</SelectItem>
                  <SelectItem value="ca">Canada</SelectItem>
                  <SelectItem value="ap">Australia</SelectItem>
                  <SelectItem value="af">Africa</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label>API Token</Label>
            <Input
              type="password"
              placeholder="Enter Spanning API token..."
              value={newMapping.api_token}
              onChange={(e) => setNewMapping({ ...newMapping, api_token: e.target.value })}
            />
            <p className="text-xs text-slate-500">
              Get this from Spanning → Settings → API Token
            </p>
          </div>

          {connectionStatus?.success && (
            <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 px-3 py-2 rounded-lg">
              <CheckCircle2 className="w-4 h-4" />
              Connected to {connectionStatus.tenant?.name} ({connectionStatus.tenant?.users} users)
            </div>
          )}

          <div className="flex items-center gap-3">
            <Button
              onClick={testConnection}
              disabled={testing || !newMapping.api_token}
              variant="outline"
            >
              <RefreshCw className={cn("w-4 h-4 mr-2", testing && "animate-spin")} />
              Test Connection
            </Button>
            <Button
              onClick={addMapping}
              disabled={!connectionStatus?.success || !newMapping.customer_id}
              className="bg-purple-600 hover:bg-purple-700"
            >
              Add Mapping
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setShowAddForm(false);
                setNewMapping({ customer_id: '', api_token: '', region: 'us' });
                setConnectionStatus(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Mappings List */}
      <div className="border-t border-slate-200 pt-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h4 className="font-medium text-slate-900">Tenant Mappings</h4>
            <p className="text-sm text-slate-500">Map Spanning tenants to your customers</p>
          </div>
        </div>

        {mappings.length === 0 ? (
          <p className="text-sm text-slate-500 py-4 text-center">
            No Spanning tenants mapped yet. Click "Add Mapping" to connect a tenant.
          </p>
        ) : (
          <div className="space-y-2">
            {mappings.map(mapping => (
              <div 
                key={mapping.id} 
                className="flex items-center justify-between p-4 bg-slate-50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <Building2 className="w-4 h-4 text-slate-400" />
                  <div>
                    <p className="font-medium text-slate-900">{getCustomerName(mapping.customer_id)}</p>
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                      <span>{mapping.spanning_tenant_name || 'Spanning Backup'}</span>
                      <Badge variant="outline" className="text-xs uppercase">{mapping.region}</Badge>
                      {mapping.last_synced && (
                        <span className="flex items-center gap-1 text-xs text-slate-400">
                          <Clock className="w-3 h-3" />
                          {format(new Date(mapping.last_synced), 'MMM d, h:mm a')}
                        </span>
                      )}
                    </div>
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
}