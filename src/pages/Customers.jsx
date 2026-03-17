import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { client } from '@/api/client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { motion, AnimatePresence } from 'framer-motion';
import { staggerContainer, staggerItem, fadeInUp } from '@/lib/motion';
import { cn } from '@/lib/utils';
import Breadcrumbs from '../components/ui/breadcrumbs';
import {
  Building2,
  Plus,
  Search,
  X,
  Users,
  ChevronRight,
  MoreVertical,
  Pencil,
  Trash2,
  RefreshCw,
  AlertCircle,
  FileText,
  DollarSign,
  Loader2
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
import { SkeletonGrid } from "@/components/ui/shimmer-skeleton";
import { EmptyState } from "@/components/ui/empty-state";

const STATUS_COLORS = {
  active: { bg: 'bg-success/15', text: 'text-success', dot: 'bg-success' },
  inactive: { bg: 'bg-zinc-100 dark:bg-zinc-800', text: 'text-zinc-500', dot: 'bg-zinc-400' },
  suspended: { bg: 'bg-destructive/15', text: 'text-destructive', dot: 'bg-destructive' },
};

const FILTER_CHIPS = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'suspended', label: 'Suspended' },
];

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
    queryFn: () => client.entities.Customer.list('-created_date', 500),
  });

  const { data: contracts = [] } = useQuery({
    queryKey: ['all_contracts'],
    queryFn: () => client.entities.Contract.list('-created_date', 1000),
  });

  const { data: recurringBills = [] } = useQuery({
    queryKey: ['all_recurring_bills'],
    queryFn: () => client.entities.RecurringBill.list('-created_date', 1000),
  });

  const { data: tickets = [] } = useQuery({
    queryKey: ['all_tickets'],
    queryFn: () => client.entities.Ticket.list('-created_date', 1000),
  });

  const createMutation = useMutation({
    mutationFn: (data) => client.entities.Customer.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      handleCloseDialog();
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => client.entities.Customer.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      handleCloseDialog();
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => client.entities.Customer.delete(id),
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
      const result = await client.halo.syncAll();
      if (result.success) {
        toast.success(result.message || `Sync completed! ${result.recordsSynced || 0} records synced.`);
        queryClient.invalidateQueries({ queryKey: ['customers'] });
      } else {
        setSyncError(result.error || 'Sync failed');
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

  const getCustomerStats = (customerId) => {
    const customerContracts = contracts.filter(c => c.customer_id === customerId && c.status === 'active');
    const customerTickets = tickets.filter(t => t.customer_id === customerId && ['new', 'open', 'in_progress'].includes(t.status));
    const customerBills = recurringBills.filter(b => b.customer_id === customerId && b.status === 'active');
    const mrr = customerBills.reduce((sum, b) => sum + (b.amount || 0), 0);
    return { contracts: customerContracts.length, tickets: customerTickets.length, mrr };
  };

  const activeCount = customers.filter(c => c.status === 'active').length;

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Customers' }]} />

      {/* Header */}
      <motion.div
        {...fadeInUp}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Customers</h1>
          <p className="text-muted-foreground mt-1">
            {customers.length} total &middot; {activeCount} active
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={handleSyncHaloPSA}
            disabled={isSyncing}
            variant="outline"
          >
            {isSyncing ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Sync HaloPSA
          </Button>
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="w-4 h-4 mr-2" />
            Add Customer
          </Button>
        </div>
      </motion.div>

      {/* Search + Filter Chips */}
      <motion.div {...fadeInUp} className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search customers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-10 h-10 rounded-hero-md bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 focus:bg-white dark:focus:bg-zinc-800 transition-colors duration-[250ms]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="flex gap-2">
          {FILTER_CHIPS.map((chip) => (
            <button
              key={chip.value}
              onClick={() => setStatusFilter(chip.value)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-full transition-all duration-[250ms] ease-out active:scale-[0.97]',
                statusFilter === chip.value
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-muted-foreground hover:bg-zinc-200 dark:hover:bg-zinc-700'
              )}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Customer List */}
      {isLoading ? (
        <SkeletonGrid count={6} cols={2} className="grid-cols-1 lg:grid-cols-2" />
      ) : filteredCustomers.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No customers found"
          description={
            searchQuery || statusFilter !== 'all'
              ? 'Try adjusting your search or filters'
              : 'Get started by adding your first customer'
          }
          action={!searchQuery && statusFilter === 'all' ? {
            label: 'Add Customer',
            onClick: () => handleOpenDialog()
          } : undefined}
        />
      ) : (
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="grid grid-cols-1 lg:grid-cols-2 gap-3"
        >
          {filteredCustomers.map((customer) => {
            const stats = getCustomerStats(customer.id);
            const statusStyle = STATUS_COLORS[customer.status] || STATUS_COLORS.active;
            return (
              <motion.div
                key={customer.id}
                variants={staggerItem}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate(createPageUrl(`CustomerDetail?id=${customer.id}`))}
                className="flex items-center gap-3 bg-card rounded-[14px] border border-border/50 p-3.5 hover:shadow-hero-md transition-all duration-[250ms] group cursor-pointer"
              >
                {/* Avatar */}
                <div className="w-10 h-10 rounded-hero-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                  {customer.logo_url ? (
                    <img src={customer.logo_url} alt={customer.name} className="w-6 h-6 rounded" />
                  ) : (
                    <Building2 className="w-5 h-5 text-primary" />
                  )}
                </div>

                {/* Name + Status */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-foreground truncate text-sm">{customer.name}</p>
                    <Badge
                      variant="dot"
                      dotColor={statusStyle.dot}
                      className="text-[10px] px-1.5 py-0 h-5"
                    >
                      {customer.status || 'active'}
                    </Badge>
                  </div>
                  {customer.email && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{customer.email}</p>
                  )}
                </div>

                {/* Stats */}
                <div className="hidden sm:flex items-center gap-2 text-xs">
                  <div className="flex items-center gap-1 px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-full" title="Contracts">
                    <FileText className="w-3 h-3 text-muted-foreground" />
                    <span className="font-medium">{stats.contracts}</span>
                  </div>
                  <div className="flex items-center gap-1 px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-full" title="Open Tickets">
                    <AlertCircle className="w-3 h-3 text-muted-foreground" />
                    <span className="font-medium">{stats.tickets}</span>
                  </div>
                  <div className="flex items-center gap-1 px-2 py-1 bg-success/10 rounded-full" title="Monthly Revenue">
                    <DollarSign className="w-3 h-3 text-success" />
                    <span className="font-medium text-success">${stats.mrr.toLocaleString()}</span>
                  </div>
                </div>

                {/* Actions */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <MoreVertical className="w-4 h-4 text-muted-foreground" />
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
                      className="text-destructive"
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

                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {/* Error Dialog */}
      <Dialog open={errorDialogOpen} onOpenChange={setErrorDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-destructive/15 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-destructive" />
              </div>
              <DialogTitle>Sync Error</DialogTitle>
            </div>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{syncError}</p>
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
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {(createMutation.isPending || updateMutation.isPending) && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                {editingCustomer ? 'Update' : 'Create'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
