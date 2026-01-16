import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { 
  Building2, 
  Plus, 
  Search, 
  Filter,
  Users,
  Monitor,
  ChevronRight,
  MoreVertical,
  Pencil,
  Trash2,
  Mail,
  Phone,
  RefreshCw,
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
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from 'sonner';
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
import { cn } from "@/lib/utils";

export default function Customers() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);
  const [syncError, setSyncError] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    primary_contact: '',
    email: '',
    phone: '',
    address: '',
    status: 'active',
    notes: ''
  });

  const queryClient = useQueryClient();

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list('-created_date', 500),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Customer.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      handleCloseDialog();
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Customer.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      handleCloseDialog();
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Customer.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['customers'] })
  });

  const handleOpenDialog = (customer = null) => {
    if (customer) {
      setEditingCustomer(customer);
      setFormData({
        name: customer.name || '',
        primary_contact: customer.primary_contact || '',
        email: customer.email || '',
        phone: customer.phone || '',
        address: customer.address || '',
        status: customer.status || 'active',
        notes: customer.notes || ''
      });
    } else {
      setEditingCustomer(null);
      setFormData({
        name: '',
        primary_contact: '',
        email: '',
        phone: '',
        address: '',
        status: 'active',
        notes: ''
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingCustomer(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingCustomer) {
      updateMutation.mutate({ id: editingCustomer.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleSyncHaloPSA = async () => {
    try {
      setIsSyncing(true);
      const response = await base44.functions.invoke('syncHaloPSACustomers', { action: 'sync_now' });
      if (response.data.success) {
        toast.success(`Sync completed! ${response.data.recordsSynced} records synced.`);
        queryClient.invalidateQueries({ queryKey: ['customers'] });
      } else {
        setSyncError(response.data.error || 'Sync failed');
        setErrorDialogOpen(true);
      }
    } catch (error) {
      setSyncError(error.message || 'An error occurred during sync');
      setErrorDialogOpen(true);
    } finally {
      setIsSyncing(false);
    }
  };

  const filteredCustomers = customers.filter(customer => {
    const matchesSearch = customer.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         customer.email?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || customer.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Customers</h1>
          <p className="text-slate-500 mt-1">{customers.length} total customers</p>
        </div>
        <div className="flex gap-3">
          <Button 
            onClick={handleSyncHaloPSA}
            disabled={isSyncing}
            variant="outline"
            className="border-slate-200"
          >
            <RefreshCw className={cn("w-4 h-4 mr-2", isSyncing && "animate-spin")} />
            Sync from HaloPSA
          </Button>
          <Button 
            onClick={() => handleOpenDialog()}
            className="bg-slate-900 hover:bg-slate-800"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Customer
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search customers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Customer List */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-lg" />
          ))}
        </div>
      ) : filteredCustomers.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/50 p-12 text-center">
          <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900 mb-2">No customers found</h3>
          <p className="text-slate-500 mb-6">
            {searchQuery || statusFilter !== 'all' 
              ? 'Try adjusting your filters' 
              : 'Get started by adding your first customer'}
          </p>
          {!searchQuery && statusFilter === 'all' && (
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="w-4 h-4 mr-2" />
              Add Customer
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredCustomers.map((customer) => (
            <div
              key={customer.id}
              className="bg-white rounded border border-slate-200/50 p-3 hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center flex-shrink-0">
                  {customer.logo_url ? (
                    <img src={customer.logo_url} alt={customer.name} className="w-6 h-6 rounded" />
                  ) : (
                    <Building2 className="w-4 h-4 text-slate-500" />
                  )}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-5 w-5 -mr-1">
                      <MoreVertical className="w-3 h-3 text-slate-400" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-32">
                    <DropdownMenuItem onClick={() => handleOpenDialog(customer)} className="text-xs">
                      <Pencil className="w-3 h-3 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      className="text-red-600 text-xs"
                      onClick={() => deleteMutation.mutate(customer.id)}
                    >
                      <Trash2 className="w-3 h-3 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="mb-2">
                <Link to={createPageUrl(`CustomerDetail?id=${customer.id}`)}>
                  <p className="font-semibold text-slate-900 text-xs hover:text-blue-600 line-clamp-1">{customer.name}</p>
                </Link>
                {customer.source === 'halopsa' && (
                  <Badge className="bg-blue-100 text-blue-700 text-xs py-0 px-1.5 mt-1">Halo</Badge>
                )}
              </div>

              <div className="flex justify-around text-center text-xs">
                <div>
                  <p className="font-semibold text-slate-900 text-sm">{customer.total_devices || 0}</p>
                  <p className="text-slate-500">Devices</p>
                </div>
                <div>
                  <p className="font-semibold text-slate-900 text-sm">{customer.total_users || 0}</p>
                  <p className="text-slate-500">Users</p>
                </div>
                <div>
                  <p className="font-semibold text-slate-900 text-sm">0</p>
                  <p className="text-slate-500">Sites</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error Dialog */}
      <Dialog open={errorDialogOpen} onOpenChange={setErrorDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <DialogTitle>Sync Error</DialogTitle>
            </div>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-slate-700">{syncError}</p>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setErrorDialogOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingCustomer ? 'Edit Customer' : 'Add New Customer'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="name">Company Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="primary_contact">Primary Contact</Label>
                <Input
                  id="primary_contact"
                  value={formData.primary_contact}
                  onChange={(e) => setFormData({ ...formData, primary_contact: e.target.value })}
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
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
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
                {editingCustomer ? 'Update' : 'Create'} Customer
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}