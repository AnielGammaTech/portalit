import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from 'sonner';
import {
  Shield,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  Link2,
  Plus,
  Trash2,
  Building2,
  AlertTriangle
} from 'lucide-react';

export default function SaaSAlertsConfig() {
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [isLoadingOrgs, setIsLoadingOrgs] = useState(false);
  const [saasAlertsOrgs, setSaasAlertsOrgs] = useState([]);
  const [showMappingDialog, setShowMappingDialog] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [selectedOrg, setSelectedOrg] = useState('');
  
  const queryClient = useQueryClient();

  // Fetch customers
  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list()
  });

  // Fetch existing mappings
  const { data: mappings = [], isLoading: isLoadingMappings } = useQuery({
    queryKey: ['saas_alerts_mappings'],
    queryFn: () => base44.entities.SaaSAlertsMapping.list()
  });

  // Test connection
  const handleTestConnection = async () => {
    setIsTestingConnection(true);
    setConnectionStatus(null);
    try {
      const response = await base44.functions.invoke('syncSaaSAlerts', {
        action: 'test_connection'
      });
      if (response.data?.success) {
        setConnectionStatus({
          success: true,
          partner: response.data.partner
        });
        toast.success('Connected to SaaS Alerts successfully!');
      } else {
        setConnectionStatus({ success: false, error: response.data?.error });
        toast.error('Connection failed');
      }
    } catch (error) {
      setConnectionStatus({ success: false, error: error.message });
      toast.error('Connection failed: ' + error.message);
    } finally {
      setIsTestingConnection(false);
    }
  };

  // Load organizations from SaaS Alerts
  const handleLoadOrganizations = async () => {
    setIsLoadingOrgs(true);
    try {
      const response = await base44.functions.invoke('syncSaaSAlerts', {
        action: 'list_organizations'
      });
      if (response.data?.success) {
        setSaasAlertsOrgs(response.data.organizations || []);
        toast.success(`Loaded ${response.data.organizations?.length || 0} organizations`);
      } else {
        toast.error('Failed to load organizations');
      }
    } catch (error) {
      toast.error('Failed to load organizations: ' + error.message);
    } finally {
      setIsLoadingOrgs(false);
    }
  };

  // Create mapping
  const createMappingMutation = useMutation({
    mutationFn: async (data) => {
      return base44.entities.SaaSAlertsMapping.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saas_alerts_mappings'] });
      setShowMappingDialog(false);
      setSelectedCustomer('');
      setSelectedOrg('');
      toast.success('Mapping created successfully');
    },
    onError: (error) => {
      toast.error('Failed to create mapping: ' + error.message);
    }
  });

  // Delete mapping
  const deleteMappingMutation = useMutation({
    mutationFn: async (id) => {
      return base44.entities.SaaSAlertsMapping.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saas_alerts_mappings'] });
      toast.success('Mapping deleted');
    }
  });

  const handleCreateMapping = () => {
    if (!selectedCustomer || !selectedOrg) {
      toast.error('Please select both a customer and organization');
      return;
    }

    const customer = customers.find(c => c.id === selectedCustomer);
    const org = saasAlertsOrgs.find(o => o.id === selectedOrg);

    createMappingMutation.mutate({
      customer_id: selectedCustomer,
      customer_name: customer?.name || '',
      saas_alerts_org_id: selectedOrg,
      saas_alerts_org_name: org?.name || org?.domain || selectedOrg
    });
  };

  // Get unmapped customers
  const mappedCustomerIds = new Set(mappings.map(m => m.customer_id));
  const unmappedCustomers = customers.filter(c => !mappedCustomerIds.has(c.id));

  // Get unmapped orgs
  const mappedOrgIds = new Set(mappings.map(m => m.saas_alerts_org_id));
  const unmappedOrgs = saasAlertsOrgs.filter(o => !mappedOrgIds.has(o.id));

  return (
    <div className="space-y-6">
      {/* Connection Status Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
              <Shield className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">SaaS Alerts Connection</h3>
              <p className="text-sm text-slate-500">Monitor SaaS security events</p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={handleTestConnection}
            disabled={isTestingConnection}
            className="gap-2"
          >
            {isTestingConnection ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Test Connection
          </Button>
        </div>

        {connectionStatus && (
          <div className={`p-4 rounded-lg ${connectionStatus.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            <div className="flex items-center gap-2">
              {connectionStatus.success ? (
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              ) : (
                <XCircle className="w-5 h-5 text-red-600" />
              )}
              <span className={connectionStatus.success ? 'text-green-700' : 'text-red-700'}>
                {connectionStatus.success ? 'Connected' : 'Connection Failed'}
              </span>
            </div>
            {connectionStatus.success && connectionStatus.partner && (
              <div className="mt-2 text-sm text-green-700">
                <p><strong>Partner:</strong> {connectionStatus.partner.name}</p>
                <p><strong>Total Accounts:</strong> {connectionStatus.partner.totalAccountsAmount?.count || 'N/A'}</p>
                <p><strong>Billing Users:</strong> {connectionStatus.partner.billingUsers?.count || 'N/A'}</p>
              </div>
            )}
            {!connectionStatus.success && connectionStatus.error && (
              <p className="mt-2 text-sm text-red-600">{connectionStatus.error}</p>
            )}
          </div>
        )}
      </div>

      {/* Customer Mappings */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-slate-900">Customer Mappings</h3>
            <p className="text-sm text-slate-500">Link your customers to SaaS Alerts organizations</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleLoadOrganizations}
              disabled={isLoadingOrgs}
              className="gap-2"
            >
              {isLoadingOrgs ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              Load Organizations
            </Button>
            <Button
              onClick={() => setShowMappingDialog(true)}
              disabled={saasAlertsOrgs.length === 0}
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Mapping
            </Button>
          </div>
        </div>

        {saasAlertsOrgs.length === 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
            <div className="flex items-center gap-2 text-amber-700">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm">Click "Load Organizations" to fetch your SaaS Alerts customers</span>
            </div>
          </div>
        )}

        {isLoadingMappings ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : mappings.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <Link2 className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            <p>No mappings configured yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {mappings.map((mapping) => (
              <div
                key={mapping.id}
                className="flex items-center justify-between p-4 bg-slate-50 rounded-lg"
              >
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-slate-400" />
                    <span className="font-medium text-slate-900">{mapping.customer_name}</span>
                  </div>
                  <span className="text-slate-400">→</span>
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-orange-500" />
                    <span className="text-slate-600">{mapping.saas_alerts_org_name}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {mapping.last_synced && (
                    <Badge variant="outline" className="text-xs">
                      Synced: {new Date(mapping.last_synced).toLocaleDateString()}
                    </Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteMappingMutation.mutate(mapping.id)}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Mapping Dialog */}
      <Dialog open={showMappingDialog} onOpenChange={setShowMappingDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Customer Mapping</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">
                Portal Customer
              </label>
              <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a customer" />
                </SelectTrigger>
                <SelectContent>
                  {unmappedCustomers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">
                SaaS Alerts Organization
              </label>
              <Select value={selectedOrg} onValueChange={setSelectedOrg}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an organization" />
                </SelectTrigger>
                <SelectContent>
                  {unmappedOrgs.map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name || org.domain || org.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMappingDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateMapping}
              disabled={!selectedCustomer || !selectedOrg || createMappingMutation.isPending}
            >
              {createMappingMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Create Mapping
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}