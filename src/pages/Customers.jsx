import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '../utils';
import Breadcrumbs from '../components/ui/breadcrumbs';
import { 
  Building2, 
  Plus, 
  Search, 
  Filter,
  Users,
  ChevronRight,
  MoreVertical,
  Pencil,
  Trash2,
  RefreshCw,
  AlertCircle,
  FileText,
  DollarSign,
  Cloud,
  Monitor
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
  const navigate = useNavigate();
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

  const { data: contracts = [] } = useQuery({
    queryKey: ['all_contracts'],
    queryFn: () => base44.entities.Contract.list('-created_date', 1000),
  });

  const { data: recurringBills = [] } = useQuery({
    queryKey: ['all_recurring_bills'],
    queryFn: () => base44.entities.RecurringBill.list('-created_date', 1000),
  });

  const { data: tickets = [] } = useQuery({
    queryKey: ['all_tickets'],
    queryFn: () => base44.entities.Ticket.list('-created_date', 1000),
  });

  const { data: applications = [] } = useQuery({
    queryKey: ['all_applications'],
    queryFn: () => base44.entities.Application.filter({ status: 'active' }),
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

  // Calculate stats per customer
  const getCustomerStats = (customerId) => {
    const customerContracts = contracts.filter(c => c.customer_id === customerId && c.status === 'active');
    const customerTickets = tickets.filter(t => t.customer_id === customerId && ['new', 'open', 'in_progress'].includes(t.status));
    const customerBills = recurringBills.filter(b => b.customer_id === customerId && b.status === 'active');
    const customerApps = applications.filter(a => a.customer_id === customerId);
    const mrr = customerBills.reduce((sum, b) => sum + (b.amount || 0), 0);
    return { contracts: customerContracts.length, tickets: customerTickets.length, mrr, apps: customerApps.length };
  };

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Customers' }]} />
      
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
            Sync HaloPSA
          </Button>
          <Button 
            onClick={() => handleOpenDialog()}
            className="bg-purple-600 hover:bg-purple-700"
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
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
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
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {filteredCustomers.map((customer) => {
            const stats = getCustomerStats(customer.id);
            return (
              <div
                key={customer.id}
                onClick={() => navigate(createPageUrl(`CustomerDetail?id=${customer.id}`))}
                className="bg-white rounded-xl border border-slate-200/50 p-3 hover:border-purple-200 hover:shadow-sm transition-all group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-100 to-purple-50 flex items-center justify-center flex-shrink-0">
                    {customer.logo_url ? (
                      <img src={customer.logo_url} alt={customer.name} className="w-6 h-6 rounded" />
                    ) : (
                      <Building2 className="w-5 h-5 text-purple-600" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 text-sm">{customer.name}</p>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0">
                        <MoreVertical className="w-4 h-4 text-slate-400" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={(e) => {
                        e.stopPropagation();
                        handleOpenDialog(customer);
                      }}>
                        <Pencil className="w-4 h-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        className="text-red-600"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteMutation.mutate(customer.id);
                        }}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-purple-600 flex-shrink-0" />
                </div>

                <div className="flex items-center gap-1.5 mt-2 ml-13 text-xs flex-wrap">
                  <div className="flex items-center gap-1 px-1.5 py-0.5 bg-purple-50 rounded" title="Team Members">
                    <Users className="w-3 h-3 text-purple-500" />
                    <span className="font-medium text-purple-700">{customer.total_users || 0}</span>
                    <span className="text-purple-600">Team</span>
                  </div>
                  <div className="flex items-center gap-1 px-1.5 py-0.5 bg-blue-50 rounded" title="Contracts">
                    <FileText className="w-3 h-3 text-blue-500" />
                    <span className="font-medium text-blue-700">{stats.contracts}</span>
                    <span className="text-blue-600">Contracts</span>
                  </div>
                  <div className="flex items-center gap-1 px-1.5 py-0.5 bg-orange-50 rounded" title="Open Tickets">
                    <AlertCircle className="w-3 h-3 text-orange-500" />
                    <span className="font-medium text-orange-700">{stats.tickets}</span>
                    <span className="text-orange-600">Tickets</span>
                  </div>
                  <div className="flex items-center gap-1 px-1.5 py-0.5 bg-cyan-50 rounded" title="Apps">
                    <Cloud className="w-3 h-3 text-cyan-500" />
                    <span className="font-medium text-cyan-700">{stats.apps}</span>
                    <span className="text-cyan-600">Apps</span>
                  </div>
                  <div className="flex items-center gap-1 px-1.5 py-0.5 bg-slate-100 rounded" title="Devices">
                    <Monitor className="w-3 h-3 text-slate-500" />
                    <span className="font-medium text-slate-700">{customer.total_devices || 0}</span>
                    <span className="text-slate-600">Devices</span>
                  </div>
                </div>
              </div>
            );
          })}
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
            <div className="flex justify-end">
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
                className="bg-purple-600 hover:bg-purple-700"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {editingCustomer ? 'Update' : 'Create'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}