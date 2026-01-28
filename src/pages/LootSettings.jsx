import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { 
  Settings, 
  Plus, 
  Trash2, 
  Save, 
  RefreshCw,
  DollarSign,
  Percent,
  Server,
  Users,
  AlertTriangle,
  CheckCircle2,
  X,
  Download,
  Link2
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
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
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { toast } from 'sonner';

const SERVICE_TYPES = [
  { value: 'datto_rmm', label: 'Datto RMM', icon: Server },
  { value: 'jumpcloud', label: 'JumpCloud', icon: Users },
  { value: 'cove_backup', label: 'Cove Backup', icon: Server },
  { value: 'spanning', label: 'Spanning Backup', icon: Server },
  { value: 'other', label: 'Other', icon: Server },
];

export default function LootSettings() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [isSyncing, setIsSyncing] = useState({});
  const [showImportModal, setShowImportModal] = useState(false);
  const queryClient = useQueryClient();

  const { data: settings = [], isLoading } = useQuery({
    queryKey: ['loot_settings'],
    queryFn: () => base44.entities.LootSettings.list(),
  });

  const { data: vendorBilling = [] } = useQuery({
    queryKey: ['vendor_billing'],
    queryFn: () => base44.entities.VendorBilling.list(),
  });

  // Fetch all recurring bill line items to import from
  const { data: billLineItems = [] } = useQuery({
    queryKey: ['all_bill_line_items'],
    queryFn: () => base44.entities.RecurringBillLineItem.list('-created_date', 5000),
  });

  // Get unique item descriptions for import
  const uniqueLineItems = React.useMemo(() => {
    const itemMap = new Map();
    billLineItems.forEach(item => {
      const key = item.description?.trim();
      if (key && !itemMap.has(key)) {
        itemMap.set(key, {
          description: item.description,
          item_code: item.item_code,
          count: 1,
          totalQty: item.quantity || 0
        });
      } else if (key) {
        const existing = itemMap.get(key);
        existing.count++;
        existing.totalQty += item.quantity || 0;
      }
    });
    return Array.from(itemMap.values()).sort((a, b) => b.count - a.count);
  }, [billLineItems]);

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.LootSettings.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loot_settings'] });
      setIsAddModalOpen(false);
      toast.success('Service added successfully');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.LootSettings.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loot_settings'] });
      setEditingService(null);
      toast.success('Service updated successfully');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.LootSettings.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loot_settings'] });
      toast.success('Service deleted');
    },
  });

  const handleSyncVendor = async (vendorType) => {
    setIsSyncing(prev => ({ ...prev, [vendorType]: true }));
    try {
      let response;
      if (vendorType === 'datto_rmm') {
        response = await base44.functions.invoke('fetchDattoRMMBilling');
      } else if (vendorType === 'jumpcloud') {
        response = await base44.functions.invoke('fetchJumpCloudBilling');
      }
      
      if (response.data?.success) {
        toast.success(`Synced ${response.data.data?.length || 0} records from ${vendorType}`);
        queryClient.invalidateQueries({ queryKey: ['vendor_billing'] });
      } else {
        toast.error(response.data?.error || 'Sync failed');
      }
    } catch (error) {
      toast.error('Sync failed: ' + error.message);
    } finally {
      setIsSyncing(prev => ({ ...prev, [vendorType]: false }));
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Loot Settings</h1>
          <p className="text-slate-500">Configure billing reconciliation services and pricing</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowImportModal(true)}>
            <Download className="w-4 h-4 mr-2" />
            Import from HaloPSA
          </Button>
          <Button onClick={() => setIsAddModalOpen(true)} className="bg-purple-600 hover:bg-purple-700">
            <Plus className="w-4 h-4 mr-2" />
            Add Service
          </Button>
        </div>
      </div>

      {/* Vendor Sync Section */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Vendor Data Sync</h2>
        <p className="text-sm text-slate-500 mb-6">
          Sync billing data from vendors to compare against HaloPSA records.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {SERVICE_TYPES.filter(s => s.value !== 'other').map(service => {
            const Icon = service.icon;
            const isActive = isSyncing[service.value];
            const billingCount = vendorBilling.filter(v => v.vendor === service.value).length;
            
            return (
              <div key={service.value} className="bg-slate-50 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">{service.label}</p>
                    <p className="text-xs text-slate-500">{billingCount} records</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => handleSyncVendor(service.value)}
                  disabled={isActive || !['datto_rmm', 'jumpcloud'].includes(service.value)}
                >
                  <RefreshCw className={cn("w-4 h-4 mr-2", isActive && "animate-spin")} />
                  {isActive ? 'Syncing...' : 'Sync Now'}
                </Button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Services Configuration */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Service Pricing Configuration</h2>
        
        {settings.length === 0 ? (
          <div className="py-12 text-center">
            <Settings className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 mb-4">No services configured yet</p>
            <Button onClick={() => setIsAddModalOpen(true)} variant="outline">
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Service
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Service</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Cost/Unit</TableHead>
                <TableHead>Sell Price</TableHead>
                <TableHead>Margin</TableHead>
                <TableHead>PSA Match</TableHead>
                <TableHead>Active</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {settings.map(service => {
                const typeInfo = SERVICE_TYPES.find(t => t.value === service.service_type);
                const Icon = typeInfo?.icon || Server;
                const margin = service.sell_price_per_unit > 0 
                  ? ((service.sell_price_per_unit - service.cost_per_unit) / service.sell_price_per_unit * 100).toFixed(1)
                  : 0;
                
                return (
                  <TableRow key={service.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4 text-slate-400" />
                        <span className="font-medium">{service.service_name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{typeInfo?.label || service.service_type}</Badge>
                    </TableCell>
                    <TableCell>${service.cost_per_unit?.toFixed(2) || '0.00'}</TableCell>
                    <TableCell>${service.sell_price_per_unit?.toFixed(2) || '0.00'}</TableCell>
                    <TableCell>
                      <Badge className={cn(
                        margin > 20 ? 'bg-green-100 text-green-700' : 
                        margin > 0 ? 'bg-yellow-100 text-yellow-700' : 
                        'bg-red-100 text-red-700'
                      )}>
                        {margin}%
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-slate-500">{service.halopsa_item_match || '-'}</span>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={service.is_active}
                        onCheckedChange={(checked) => updateMutation.mutate({ 
                          id: service.id, 
                          data: { is_active: checked } 
                        })}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingService(service)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => deleteMutation.mutate(service.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Add/Edit Modal */}
      <ServiceModal
        open={isAddModalOpen || !!editingService}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingService(null);
        }}
        service={editingService}
        onSave={(data) => {
          if (editingService) {
            updateMutation.mutate({ id: editingService.id, data });
          } else {
            createMutation.mutate(data);
          }
        }}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />

      {/* Import from HaloPSA Modal */}
      <ImportLineItemsModal
        open={showImportModal}
        onClose={() => setShowImportModal(false)}
        lineItems={uniqueLineItems}
        existingSettings={settings}
        onImport={(items) => {
          items.forEach(item => {
            createMutation.mutate({
              service_name: item.description,
              service_type: 'other',
              cost_per_unit: 0,
              sell_price_per_unit: 0,
              halopsa_item_match: item.description,
              is_active: true,
              notes: `Imported from HaloPSA. Found in ${item.count} bills.`
            });
          });
          setShowImportModal(false);
        }}
      />
    </div>
  );
}

function ImportLineItemsModal({ open, onClose, lineItems, existingSettings, onImport }) {
  const [selected, setSelected] = useState(new Set());
  const [search, setSearch] = useState('');

  // Filter out already imported items
  const existingMatches = new Set(existingSettings.map(s => s.halopsa_item_match?.toLowerCase()));
  const availableItems = lineItems.filter(item => 
    !existingMatches.has(item.description?.toLowerCase()) &&
    item.description?.toLowerCase().includes(search.toLowerCase())
  );

  const toggleItem = (description) => {
    const newSelected = new Set(selected);
    if (newSelected.has(description)) {
      newSelected.delete(description);
    } else {
      newSelected.add(description);
    }
    setSelected(newSelected);
  };

  const handleImport = () => {
    const itemsToImport = availableItems.filter(item => selected.has(item.description));
    onImport(itemsToImport);
    setSelected(new Set());
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Import Line Items from HaloPSA</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <p className="text-sm text-slate-500">
            Select recurring bill line items to track in Loot. Each item will be created as a service you can map to a vendor API.
          </p>

          <Input
            placeholder="Search line items..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <div className="border rounded-lg max-h-96 overflow-y-auto">
            {availableItems.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                {lineItems.length === 0 ? 
                  'No line items found. Sync recurring bills from HaloPSA first.' :
                  'All line items have already been imported.'
                }
              </div>
            ) : (
              <div className="divide-y">
                {availableItems.map((item, idx) => (
                  <div
                    key={idx}
                    onClick={() => toggleItem(item.description)}
                    className={cn(
                      "p-3 cursor-pointer hover:bg-slate-50 flex items-center justify-between",
                      selected.has(item.description) && "bg-purple-50"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={selected.has(item.description)}
                        onChange={() => toggleItem(item.description)}
                        className="rounded"
                      />
                      <div>
                        <p className="font-medium text-slate-900">{item.description}</p>
                        {item.item_code && (
                          <p className="text-xs text-slate-500">Code: {item.item_code}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right text-sm text-slate-500">
                      <p>{item.count} bills</p>
                      <p>{item.totalQty} total qty</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {selected.size > 0 && (
            <p className="text-sm text-purple-600">{selected.size} items selected</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button 
            onClick={handleImport}
            disabled={selected.size === 0}
            className="bg-purple-600 hover:bg-purple-700"
          >
            <Download className="w-4 h-4 mr-2" />
            Import {selected.size} Items
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ServiceModal({ open, onClose, service, onSave, isLoading }) {
  const [formData, setFormData] = useState({
    service_name: '',
    service_type: 'datto_rmm',
    cost_per_unit: 0,
    sell_price_per_unit: 0,
    halopsa_item_match: '',
    is_active: true,
    notes: ''
  });

  React.useEffect(() => {
    if (service) {
      setFormData({
        service_name: service.service_name || '',
        service_type: service.service_type || 'datto_rmm',
        cost_per_unit: service.cost_per_unit || 0,
        sell_price_per_unit: service.sell_price_per_unit || 0,
        halopsa_item_match: service.halopsa_item_match || '',
        is_active: service.is_active ?? true,
        notes: service.notes || ''
      });
    } else {
      setFormData({
        service_name: '',
        service_type: 'datto_rmm',
        cost_per_unit: 0,
        sell_price_per_unit: 0,
        halopsa_item_match: '',
        is_active: true,
        notes: ''
      });
    }
  }, [service, open]);

  const margin = formData.sell_price_per_unit > 0 
    ? ((formData.sell_price_per_unit - formData.cost_per_unit) / formData.sell_price_per_unit * 100).toFixed(1)
    : 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{service ? 'Edit Service' : 'Add Service'}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div>
            <Label>Service Name</Label>
            <Input
              value={formData.service_name}
              onChange={(e) => setFormData({ ...formData, service_name: e.target.value })}
              placeholder="e.g., Datto RMM - Workstation"
            />
          </div>

          <div>
            <Label>Service Type</Label>
            <Select
              value={formData.service_type}
              onValueChange={(value) => setFormData({ ...formData, service_type: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SERVICE_TYPES.map(type => (
                  <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Cost Per Unit ($)</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.cost_per_unit}
                onChange={(e) => setFormData({ ...formData, cost_per_unit: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div>
              <Label>Sell Price Per Unit ($)</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.sell_price_per_unit}
                onChange={(e) => setFormData({ ...formData, sell_price_per_unit: parseFloat(e.target.value) || 0 })}
              />
            </div>
          </div>

          <div className="bg-slate-50 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Profit Margin</span>
              <Badge className={cn(
                margin > 20 ? 'bg-green-100 text-green-700' : 
                margin > 0 ? 'bg-yellow-100 text-yellow-700' : 
                'bg-red-100 text-red-700'
              )}>
                {margin}%
              </Badge>
            </div>
          </div>

          <div>
            <Label>HaloPSA Item Match</Label>
            <Input
              value={formData.halopsa_item_match}
              onChange={(e) => setFormData({ ...formData, halopsa_item_match: e.target.value })}
              placeholder="e.g., RMM-WORKSTATION"
            />
            <p className="text-xs text-slate-500 mt-1">Item code or name to match in HaloPSA billing</p>
          </div>

          <div className="flex items-center justify-between">
            <Label>Active</Label>
            <Switch
              checked={formData.is_active}
              onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button 
            onClick={() => onSave(formData)} 
            disabled={isLoading || !formData.service_name}
            className="bg-purple-600 hover:bg-purple-700"
          >
            {isLoading ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}