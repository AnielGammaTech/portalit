import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { 
  Cloud, 
  Plus, 
  Search, 
  Filter,
  MoreVertical,
  Pencil,
  Trash2,
  Users,
  DollarSign,
  AlertCircle
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { format, parseISO } from 'date-fns';

const VENDOR_COLORS = {
  'Microsoft': 'bg-blue-500',
  'Google': 'bg-red-500',
  'Adobe': 'bg-red-600',
  'Salesforce': 'bg-sky-500',
  'Zoom': 'bg-blue-600',
  'Slack': 'bg-purple-500',
  'Dropbox': 'bg-blue-400',
  'Other': 'bg-slate-500'
};

export default function SaaSManagement() {
  const [searchQuery, setSearchQuery] = useState('');
  const [vendorFilter, setVendorFilter] = useState('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLicense, setEditingLicense] = useState(null);
  const [formData, setFormData] = useState({
    customer_id: '',
    customer_name: '',
    application_name: '',
    vendor: '',
    license_type: '',
    quantity: 1,
    assigned_users: 0,
    cost_per_license: '',
    total_cost: '',
    billing_cycle: 'monthly',
    renewal_date: '',
    status: 'active',
    notes: ''
  });

  const queryClient = useQueryClient();

  const { data: licenses = [], isLoading } = useQuery({
    queryKey: ['licenses'],
    queryFn: () => base44.entities.SaaSLicense.list('-created_date', 500),
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.SaaSLicense.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['licenses'] });
      handleCloseDialog();
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.SaaSLicense.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['licenses'] });
      handleCloseDialog();
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.SaaSLicense.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['licenses'] })
  });

  // Get unique vendors
  const vendors = [...new Set(licenses.map(l => l.vendor).filter(Boolean))];

  const handleOpenDialog = (license = null) => {
    if (license) {
      setEditingLicense(license);
      setFormData({
        customer_id: license.customer_id || '',
        customer_name: license.customer_name || '',
        application_name: license.application_name || '',
        vendor: license.vendor || '',
        license_type: license.license_type || '',
        quantity: license.quantity || 1,
        assigned_users: license.assigned_users || 0,
        cost_per_license: license.cost_per_license || '',
        total_cost: license.total_cost || '',
        billing_cycle: license.billing_cycle || 'monthly',
        renewal_date: license.renewal_date || '',
        status: license.status || 'active',
        notes: license.notes || ''
      });
    } else {
      setEditingLicense(null);
      setFormData({
        customer_id: '',
        customer_name: '',
        application_name: '',
        vendor: '',
        license_type: '',
        quantity: 1,
        assigned_users: 0,
        cost_per_license: '',
        total_cost: '',
        billing_cycle: 'monthly',
        renewal_date: '',
        status: 'active',
        notes: ''
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingLicense(null);
  };

  const handleCustomerChange = (customerId) => {
    const customer = customers.find(c => c.id === customerId);
    setFormData({ 
      ...formData, 
      customer_id: customerId,
      customer_name: customer?.name || ''
    });
  };

  const handleCostChange = (field, value) => {
    const newData = { ...formData, [field]: value };
    if (field === 'cost_per_license' || field === 'quantity') {
      const cost = parseFloat(newData.cost_per_license) || 0;
      const qty = parseInt(newData.quantity) || 0;
      newData.total_cost = cost * qty;
    }
    setFormData(newData);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = {
      ...formData,
      quantity: parseInt(formData.quantity) || 1,
      assigned_users: parseInt(formData.assigned_users) || 0,
      cost_per_license: parseFloat(formData.cost_per_license) || 0,
      total_cost: parseFloat(formData.total_cost) || 0
    };
    if (editingLicense) {
      updateMutation.mutate({ id: editingLicense.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const filteredLicenses = licenses.filter(license => {
    const matchesSearch = license.application_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         license.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         license.vendor?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesVendor = vendorFilter === 'all' || license.vendor === vendorFilter;
    return matchesSearch && matchesVendor;
  });

  // Calculate totals
  const totalSpend = licenses.filter(l => l.status === 'active').reduce((sum, l) => sum + (l.total_cost || 0), 0);
  const totalLicenses = licenses.reduce((sum, l) => sum + (l.quantity || 0), 0);
  const assignedLicenses = licenses.reduce((sum, l) => sum + (l.assigned_users || 0), 0);
  const utilizationRate = totalLicenses > 0 ? Math.round((assignedLicenses / totalLicenses) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">SaaS Management</h1>
          <p className="text-slate-500 mt-1">{licenses.length} subscriptions across {vendors.length} vendors</p>
        </div>
        <Button 
          onClick={() => handleOpenDialog()}
          className="bg-slate-900 hover:bg-slate-800"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add License
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200/50 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Monthly Spend</p>
              <p className="text-2xl font-semibold text-slate-900 mt-1">${totalSpend.toLocaleString()}</p>
            </div>
            <div className="p-3 bg-blue-50 rounded-xl">
              <DollarSign className="w-5 h-5 text-blue-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200/50 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Total Licenses</p>
              <p className="text-2xl font-semibold text-slate-900 mt-1">{totalLicenses.toLocaleString()}</p>
            </div>
            <div className="p-3 bg-purple-50 rounded-xl">
              <Cloud className="w-5 h-5 text-purple-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200/50 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Assigned</p>
              <p className="text-2xl font-semibold text-slate-900 mt-1">{assignedLicenses.toLocaleString()}</p>
            </div>
            <div className="p-3 bg-emerald-50 rounded-xl">
              <Users className="w-5 h-5 text-emerald-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200/50 p-5">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-sm text-slate-500">Utilization</p>
              <p className="text-2xl font-semibold text-slate-900 mt-1">{utilizationRate}%</p>
            </div>
            {utilizationRate < 70 && (
              <div className="p-3 bg-amber-50 rounded-xl">
                <AlertCircle className="w-5 h-5 text-amber-600" />
              </div>
            )}
          </div>
          <Progress value={utilizationRate} className="h-2" />
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search licenses..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={vendorFilter} onValueChange={setVendorFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Vendor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Vendors</SelectItem>
            {vendors.map(vendor => (
              <SelectItem key={vendor} value={vendor}>{vendor}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* License List */}
      {isLoading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      ) : filteredLicenses.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/50 p-12 text-center">
          <Cloud className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900 mb-2">No licenses found</h3>
          <p className="text-slate-500 mb-6">
            {searchQuery || vendorFilter !== 'all' 
              ? 'Try adjusting your filters' 
              : 'Get started by adding your first SaaS license'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/50 overflow-hidden">
          <div className="divide-y divide-slate-100">
            {filteredLicenses.map((license) => {
              const utilization = license.quantity > 0 
                ? Math.round((license.assigned_users / license.quantity) * 100) 
                : 0;
              const vendorColor = VENDOR_COLORS[license.vendor] || VENDOR_COLORS['Other'];

              return (
                <div
                  key={license.id}
                  className="flex items-center gap-4 p-4 sm:p-6 hover:bg-slate-50 transition-colors"
                >
                  <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 text-white",
                    vendorColor
                  )}>
                    <span className="text-lg font-semibold">
                      {license.application_name?.charAt(0) || 'S'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <p className="font-medium text-slate-900 truncate">{license.application_name}</p>
                      <Badge variant="outline" className={cn(
                        "capitalize hidden sm:inline-flex",
                        license.status === 'active' && "border-emerald-200 bg-emerald-50 text-emerald-700"
                      )}>
                        {license.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-sm text-slate-500">
                      <span>{license.customer_name}</span>
                      <span>{license.vendor}</span>
                      {license.license_type && <span>{license.license_type}</span>}
                    </div>
                  </div>
                  <div className="hidden md:flex items-center gap-6">
                    <div className="text-center w-24">
                      <div className="flex items-center justify-center gap-1">
                        <span className="font-medium text-slate-900">{license.assigned_users || 0}</span>
                        <span className="text-slate-400">/</span>
                        <span className="text-slate-600">{license.quantity || 0}</span>
                      </div>
                      <Progress value={utilization} className="h-1.5 mt-1" />
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-slate-900">${(license.total_cost || 0).toLocaleString()}</p>
                      <p className="text-xs text-slate-500 capitalize">{license.billing_cycle}</p>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="flex-shrink-0">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleOpenDialog(license)}>
                        <Pencil className="w-4 h-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        className="text-red-600"
                        onClick={() => deleteMutation.mutate(license.id)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingLicense ? 'Edit License' : 'Add New License'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="customer">Customer *</Label>
              <Select 
                value={formData.customer_id} 
                onValueChange={handleCustomerChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select customer" />
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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="application_name">Application Name *</Label>
                <Input
                  id="application_name"
                  value={formData.application_name}
                  onChange={(e) => setFormData({ ...formData, application_name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vendor">Vendor</Label>
                <Input
                  id="vendor"
                  value={formData.vendor}
                  onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                  placeholder="e.g., Microsoft"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="license_type">License Type</Label>
                <Input
                  id="license_type"
                  value={formData.license_type}
                  onChange={(e) => setFormData({ ...formData, license_type: e.target.value })}
                  placeholder="e.g., Business Basic"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select 
                  value={formData.status} 
                  onValueChange={(value) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  value={formData.quantity}
                  onChange={(e) => handleCostChange('quantity', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="assigned_users">Assigned Users</Label>
                <Input
                  id="assigned_users"
                  type="number"
                  min="0"
                  value={formData.assigned_users}
                  onChange={(e) => setFormData({ ...formData, assigned_users: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cost_per_license">Cost per License</Label>
                <Input
                  id="cost_per_license"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.cost_per_license}
                  onChange={(e) => handleCostChange('cost_per_license', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="total_cost">Total Cost</Label>
                <Input
                  id="total_cost"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.total_cost}
                  onChange={(e) => setFormData({ ...formData, total_cost: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="billing_cycle">Billing Cycle</Label>
                <Select 
                  value={formData.billing_cycle} 
                  onValueChange={(value) => setFormData({ ...formData, billing_cycle: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="annually">Annually</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="renewal_date">Renewal Date</Label>
                <Input
                  id="renewal_date"
                  type="date"
                  value={formData.renewal_date}
                  onChange={(e) => setFormData({ ...formData, renewal_date: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={handleCloseDialog}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {editingLicense ? 'Update' : 'Create'} License
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}