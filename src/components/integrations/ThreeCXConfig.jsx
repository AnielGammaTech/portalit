import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { client } from '@/api/client';
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Phone,
  Plus,
  Trash2,
  RefreshCw,
  Building2,
  Clock,
  Key,
  CheckCircle2,
  Search,
  XCircle,
  ChevronDown,
  Loader2,
  Globe,
  Users,
  Pencil
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from 'date-fns';

export default function ThreeCXConfig() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingMapping, setEditingMapping] = useState(null);
  const [errorDetails, setErrorDetails] = useState(null);
  const [showErrorDetails, setShowErrorDetails] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [syncingId, setSyncingId] = useState(null);
  const [syncingAll, setSyncingAll] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Form state
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [instanceUrl, setInstanceUrl] = useState('');
  const [instanceName, setInstanceName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const queryClient = useQueryClient();

  const { data: mappings = [], isLoading: loadingMappings, refetch: refetchMappings } = useQuery({
    queryKey: ['threecx-mappings'],
    queryFn: () => client.entities.ThreeCXMapping.list('customer_name', 100),
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => client.entities.Customer.list('name', 500),
  });

  // Customers that don't already have a 3CX mapping
  const availableCustomers = customers.filter(c =>
    !mappings.some(m => m.customer_id === c.id) || editingMapping
  );

  const testConnection = async () => {
    if (!instanceUrl || !apiKey) {
      toast.error('Instance URL and API key are required');
      return;
    }

    setTesting(true);
    setTestResult(null);
    setErrorDetails(null);
    try {
      const response = await client.functions.invoke('sync3CX', {
        action: 'test_connection',
        instance_url: instanceUrl,
        api_key: apiKey,
        api_secret: apiSecret || undefined
      });
      if (response.success) {
        setTestResult(response);
        toast.success(response.message || 'Connection successful!');
      } else {
        setErrorDetails(response.error || 'Connection failed');
        toast.error(response.error || 'Connection failed');
      }
    } catch (error) {
      const errMsg = error.message || 'Connection test failed';
      setErrorDetails(errMsg);
      toast.error(errMsg);
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!selectedCustomer || !instanceUrl || !apiKey) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsSaving(true);
    try {
      const customer = customers.find(c => c.id === selectedCustomer);
      const payload = {
        customer_id: selectedCustomer,
        customer_name: customer?.name,
        instance_url: instanceUrl.replace(/\/$/, ''),
        instance_name: instanceName || customer?.name,
        api_key: apiKey,
        api_secret: apiSecret || null,
      };

      if (editingMapping) {
        await client.entities.ThreeCXMapping.update(editingMapping.id, payload);
        toast.success('3CX mapping updated');
      } else {
        await client.entities.ThreeCXMapping.create(payload);
        toast.success('3CX mapping created');
      }

      refetchMappings();
      resetForm();
    } catch (error) {
      toast.error(error.message || 'Failed to save mapping');
    } finally {
      setIsSaving(false);
    }
  };

  const resetForm = () => {
    setShowAddModal(false);
    setEditingMapping(null);
    setSelectedCustomer('');
    setInstanceUrl('');
    setInstanceName('');
    setApiKey('');
    setApiSecret('');
    setTestResult(null);
    setErrorDetails(null);
  };

  const handleEdit = (mapping) => {
    setEditingMapping(mapping);
    setSelectedCustomer(mapping.customer_id);
    setInstanceUrl(mapping.instance_url || '');
    setInstanceName(mapping.instance_name || '');
    setApiKey(mapping.api_key || '');
    setApiSecret(mapping.api_secret || '');
    setTestResult(null);
    setShowAddModal(true);
  };

  const handleDelete = async (mappingId) => {
    if (!confirm('Remove this 3CX mapping?')) return;
    try {
      await client.entities.ThreeCXMapping.delete(mappingId);
      toast.success('Mapping removed');
      refetchMappings();
    } catch (error) {
      toast.error(error.message || 'Failed to delete');
    }
  };

  const handleSync = async (customerId) => {
    setSyncingId(customerId);
    try {
      const response = await client.functions.invoke('sync3CX', {
        action: 'sync_extensions',
        customer_id: customerId
      });
      if (response.success) {
        toast.success(`Synced ${response.totalExtensions} extensions (${response.userExtensions} users)`);
        refetchMappings();
      } else {
        toast.error(response.error || 'Sync failed');
      }
    } catch (error) {
      toast.error(error.message || 'Sync failed');
    } finally {
      setSyncingId(null);
    }
  };

  const handleSyncAll = async () => {
    setSyncingAll(true);
    setErrorDetails(null);
    try {
      const response = await client.functions.invoke('sync3CX', { action: 'sync_all' });
      if (response.success) {
        toast.success(`Synced ${response.synced}/${response.total} customers`);
        if (response.failed > 0) {
          setErrorDetails(`${response.failed} failed:\n${(response.errors || []).join('\n')}`);
        }
        refetchMappings();
      } else {
        setErrorDetails(response.error || 'Sync failed');
        toast.error(response.error || 'Sync all failed');
      }
    } catch (error) {
      setErrorDetails(error.message);
      toast.error(error.message);
    } finally {
      setSyncingAll(false);
    }
  };

  const filteredMappings = mappings.filter(m => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (m.customer_name || '').toLowerCase().includes(q) ||
           (m.instance_name || '').toLowerCase().includes(q) ||
           (m.instance_url || '').toLowerCase().includes(q);
  });

  return (
    <div className="space-y-5">
      {/* Error Details */}
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
            <Phone className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">3CX VoIP</h3>
            <p className="text-sm text-slate-500">
              Connect per-customer 3CX instances to sync extensions
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {mappings.length > 0 && (
            <Button
              variant="outline"
              onClick={handleSyncAll}
              disabled={syncingAll}
            >
              <RefreshCw className={cn("w-4 h-4 mr-2", syncingAll && "animate-spin")} />
              {syncingAll ? 'Syncing...' : 'Sync All'}
            </Button>
          )}
          <Button onClick={() => { resetForm(); setShowAddModal(true); }}>
            <Plus className="w-4 h-4 mr-2" />
            Add Customer
          </Button>
        </div>
      </div>

      {/* Info */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
        <p className="text-sm text-emerald-800">
          <strong>Per-customer setup:</strong> Each customer has their own 3CX instance.
          Add each customer's 3CX URL and API key to sync their extensions.
          Extension counts are used for LootIT reconciliation against the "GTVoice extension" recurring bill.
        </p>
      </div>

      {/* Mappings List */}
      {mappings.length > 0 && (
        <div className="space-y-3">
          {mappings.length > 5 && (
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Search customers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>
          )}

          <div className="space-y-2">
            {filteredMappings.map(mapping => {
              const cached = mapping.cached_data;
              const isSyncing = syncingId === mapping.customer_id;

              return (
                <div key={mapping.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Building2 className="w-5 h-5 text-slate-400 flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-slate-900">{mapping.customer_name}</p>
                        {cached?.user_extensions !== undefined && (
                          <Badge className="bg-emerald-100 text-emerald-700 text-xs font-normal">
                            <Phone className="w-3 h-3 mr-1" />
                            {cached.user_extensions} extensions
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        <p className="text-xs text-slate-500 flex items-center gap-1">
                          <Globe className="w-3 h-3" />
                          {mapping.instance_url}
                        </p>
                        {mapping.last_synced && (
                          <p className="text-xs text-slate-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDistanceToNow(new Date(mapping.last_synced), { addSuffix: true })}
                          </p>
                        )}
                      </div>
                      {cached && (
                        <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                          {cached.ring_groups > 0 && <span>{cached.ring_groups} ring groups</span>}
                          {cached.ivr_menus > 0 && <span>{cached.ivr_menus} IVR</span>}
                          {cached.queues > 0 && <span>{cached.queues} queues</span>}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSync(mapping.customer_id)}
                      disabled={isSyncing}
                      className="text-xs h-7"
                    >
                      <RefreshCw className={cn("w-3 h-3 mr-1", isSyncing && "animate-spin")} />
                      Sync
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(mapping)}
                      className="text-xs h-7"
                    >
                      <Pencil className="w-3 h-3 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(mapping.id)}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 h-7 w-7"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!loadingMappings && mappings.length === 0 && (
        <div className="text-center py-8 bg-white rounded-xl border border-slate-200">
          <Phone className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No 3CX instances configured</p>
          <p className="text-sm text-slate-400 mt-1">Click "Add Customer" to connect a customer's 3CX</p>
        </div>
      )}

      {/* Add/Edit Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-lg" style={{ zIndex: 9999 }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Phone className="w-5 h-5 text-emerald-600" />
              {editingMapping ? 'Edit 3CX Connection' : 'Add 3CX Connection'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <Label>Customer</Label>
              <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Select customer..." />
                </SelectTrigger>
                <SelectContent style={{ zIndex: 10000 }}>
                  {availableCustomers
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map(customer => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>3CX Instance URL</Label>
              <Input
                placeholder="https://mycompany.3cx.us:5001"
                value={instanceUrl}
                onChange={(e) => setInstanceUrl(e.target.value)}
                className="mt-1.5"
              />
              <p className="text-xs text-slate-400 mt-1">The full URL to the 3CX web client (include port if needed)</p>
            </div>

            <div>
              <Label>Instance Name (optional)</Label>
              <Input
                placeholder="Company 3CX"
                value={instanceName}
                onChange={(e) => setInstanceName(e.target.value)}
                className="mt-1.5"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>API Key / Security Code</Label>
                <Input
                  type="password"
                  placeholder="API Key..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label>API Secret (if required)</Label>
                <Input
                  type="password"
                  placeholder="Optional..."
                  value={apiSecret}
                  onChange={(e) => setApiSecret(e.target.value)}
                  className="mt-1.5"
                />
              </div>
            </div>

            {/* Test Connection */}
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={testConnection}
                disabled={testing || !instanceUrl || !apiKey}
              >
                <RefreshCw className={cn("w-4 h-4 mr-2", testing && "animate-spin")} />
                Test Connection
              </Button>
              {testResult && (
                <Badge className="bg-emerald-100 text-emerald-700">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  {testResult.extensionCount} extensions found
                </Badge>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={resetForm}>
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={isSaving || !selectedCustomer || !instanceUrl || !apiKey}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    {editingMapping ? 'Update' : 'Save'}
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
