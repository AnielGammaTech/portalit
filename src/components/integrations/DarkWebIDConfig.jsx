import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  Shield, 
  Plus, 
  Trash2, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle,
  Building2,
  Link as LinkIcon
} from 'lucide-react';
import { cn } from "@/lib/utils";
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function DarkWebIDConfig() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [selectedOrg, setSelectedOrg] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [isLoadingOrgs, setIsLoadingOrgs] = useState(false);
  const [darkWebOrgs, setDarkWebOrgs] = useState([]);
  const queryClient = useQueryClient();

  const { data: mappings = [], isLoading: loadingMappings } = useQuery({
    queryKey: ['darkwebid-mappings'],
    queryFn: () => base44.entities.DarkWebIDMapping.list('-created_date', 100),
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list('name', 500),
  });

  const mappedCustomerIds = new Set(mappings.map(m => m.customer_id));
  const unmappedCustomers = customers.filter(c => !mappedCustomerIds.has(c.id));

  const [connectionResult, setConnectionResult] = useState(null);

  const handleTestConnection = async () => {
    setIsTesting(true);
    setConnectionResult(null);
    try {
      const response = await base44.functions.invoke('syncDarkWebID', { 
        action: 'test_connection' 
      });
      setConnectionResult(response.data);
      if (response.data.success) {
        toast.success('Connected to Dark Web ID successfully!');
      } else {
        toast.error(response.data.error || 'Connection failed');
      }
    } catch (error) {
      setConnectionResult({ success: false, error: error.message });
      toast.error(error.message);
    } finally {
      setIsTesting(false);
    }
  };

  const handleLoadOrganizations = async () => {
    setIsLoadingOrgs(true);
    try {
      const response = await base44.functions.invoke('syncDarkWebID', { 
        action: 'list_organizations' 
      });
      if (response.data.success) {
        setDarkWebOrgs(response.data.organizations || []);
        toast.success(`Loaded ${response.data.organizations?.length || 0} organizations`);
      } else {
        toast.error(response.data.error || 'Failed to load organizations');
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsLoadingOrgs(false);
    }
  };

  const handleAddMapping = async () => {
    if (!selectedCustomer || !selectedOrg) {
      toast.error('Please select both a customer and an organization');
      return;
    }

    const customer = customers.find(c => c.id === selectedCustomer);
    const org = darkWebOrgs.find(o => (o.uuid || o.id) === selectedOrg);

    try {
      await base44.entities.DarkWebIDMapping.create({
        customer_id: selectedCustomer,
        customer_name: customer?.name,
        darkweb_organization_uuid: selectedOrg
      });
      toast.success('Mapping created successfully');
      queryClient.invalidateQueries({ queryKey: ['darkwebid-mappings'] });
      setShowAddModal(false);
      setSelectedCustomer('');
      setSelectedOrg('');
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleDeleteMapping = async (mappingId) => {
    if (!confirm('Are you sure you want to remove this mapping?')) return;
    try {
      await base44.entities.DarkWebIDMapping.delete(mappingId);
      toast.success('Mapping removed');
      queryClient.invalidateQueries({ queryKey: ['darkwebid-mappings'] });
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleSyncCustomer = async (customerId) => {
    try {
      const response = await base44.functions.invoke('syncDarkWebID', {
        action: 'sync_customer',
        customer_id: customerId
      });
      if (response.data.success) {
        toast.success(`Synced ${response.data.synced} new compromises`);
        queryClient.invalidateQueries({ queryKey: ['darkwebid-mappings'] });
      } else {
        toast.error(response.data.error || 'Sync failed');
      }
    } catch (error) {
      toast.error(error.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
            <Shield className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">Dark Web ID</h3>
            <p className="text-sm text-slate-500">Monitor dark web compromises for your customers</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            onClick={handleTestConnection}
            disabled={isTesting}
          >
            {isTesting ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4 mr-2" />
            )}
            Test Connection
          </Button>
          <Button onClick={() => {
            setShowAddModal(true);
            if (darkWebOrgs.length === 0) {
              handleLoadOrganizations();
            }
          }}>
            <Plus className="w-4 h-4 mr-2" />
            Add Mapping
          </Button>
        </div>
      </div>

      {/* Connection Result */}
      {connectionResult && !connectionResult.success && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-medium text-red-800">{connectionResult.error}</h4>
              {connectionResult.outgoing_ip && (
                <p className="text-sm text-red-700 mt-1">
                  Base44 Outgoing IP: <code className="bg-red-100 px-1.5 py-0.5 rounded font-mono">{connectionResult.outgoing_ip}</code>
                </p>
              )}
              {connectionResult.hint && (
                <p className="text-sm text-red-600 mt-2">{connectionResult.hint}</p>
              )}
              {connectionResult.response_preview && (
                <details className="mt-3">
                  <summary className="text-xs text-red-600 cursor-pointer">Show response preview</summary>
                  <pre className="mt-2 text-xs bg-red-100 p-2 rounded overflow-x-auto max-h-32">
                    {connectionResult.response_preview}
                  </pre>
                </details>
              )}
              <p className="text-xs text-red-500 mt-3">
                Note: Base44 uses multiple outgoing IPs. You may need to whitelist: 34.102.44.165, 34.186.176.2, 34.102.96.46
              </p>
            </div>
          </div>
        </div>
      )}

      {connectionResult && connectionResult.success && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-500" />
            <div>
              <h4 className="font-medium text-green-800">Connected successfully!</h4>
              <p className="text-sm text-green-700">Found {connectionResult.organizations?.length || 0} organizations</p>
            </div>
          </div>
        </div>
      )}

      {/* Mappings Table */}
      <div className="bg-white rounded-xl border border-slate-200">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>Dark Web ID Organization</TableHead>
              <TableHead>Last Sync</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loadingMappings ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto text-slate-400" />
                </TableCell>
              </TableRow>
            ) : mappings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8">
                  <Shield className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-slate-500">No customer mappings configured</p>
                  <p className="text-sm text-slate-400">Add a mapping to start monitoring dark web compromises</p>
                </TableCell>
              </TableRow>
            ) : (
              mappings.map(mapping => (
                <TableRow key={mapping.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-slate-400" />
                      <span className="font-medium">{mapping.customer_name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <code className="text-xs bg-slate-100 px-2 py-1 rounded">
                      {mapping.darkweb_organization_uuid}
                    </code>
                  </TableCell>
                  <TableCell>
                    {mapping.last_sync ? (
                      <span className="text-sm text-slate-600">
                        {format(new Date(mapping.last_sync), 'MMM d, yyyy h:mm a')}
                      </span>
                    ) : (
                      <Badge variant="outline" className="text-slate-400">Never</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleSyncCustomer(mapping.customer_id)}
                      >
                        <RefreshCw className="w-3 h-3 mr-1" />
                        Sync
                      </Button>
                      <Button 
                        size="sm" 
                        variant="ghost"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => handleDeleteMapping(mapping.id)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add Mapping Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LinkIcon className="w-5 h-5 text-purple-600" />
              Map Customer to Dark Web ID
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1.5 block">
                Select Customer
              </label>
              <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a customer..." />
                </SelectTrigger>
                <SelectContent>
                  {unmappedCustomers.map(customer => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {unmappedCustomers.length === 0 && (
                <p className="text-xs text-slate-500 mt-1">All customers are already mapped</p>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 mb-1.5 block">
                Dark Web ID Organization
              </label>
              {isLoadingOrgs ? (
                <div className="flex items-center gap-2 text-sm text-slate-500 py-2">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Loading organizations...
                </div>
              ) : darkWebOrgs.length > 0 ? (
                <Select value={selectedOrg} onValueChange={setSelectedOrg}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose an organization..." />
                  </SelectTrigger>
                  <SelectContent>
                    {darkWebOrgs.map(org => (
                      <SelectItem key={org.uuid || org.id} value={org.uuid || org.id}>
                        {org.name || org.organization_name || org.uuid || org.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="space-y-2">
                  <Input 
                    placeholder="Enter organization UUID manually"
                    value={selectedOrg}
                    onChange={(e) => setSelectedOrg(e.target.value)}
                  />
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handleLoadOrganizations}
                    disabled={isLoadingOrgs}
                  >
                    <RefreshCw className={cn("w-3 h-3 mr-1", isLoadingOrgs && "animate-spin")} />
                    Load from Dark Web ID
                  </Button>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setShowAddModal(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddMapping}>
                <Plus className="w-4 h-4 mr-2" />
                Create Mapping
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}