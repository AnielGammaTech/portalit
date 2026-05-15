import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { client, resolveFileUrl } from '@/api/client';
import { useAutoRetry } from '@/hooks/useAutoRetry';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { cn } from '@/lib/utils';
import Breadcrumbs from '../components/ui/breadcrumbs';
import {
  Building2,
  Plus,
  Search,
  X,
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
import { PortalMetricCard, PortalPageHeader, PortalSection, PortalStatusPill } from "@/components/ui/portal-primitives";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  const [deleteConfirmCustomer, setDeleteConfirmCustomer] = useState(null);
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

  const { data: contracts = [], isLoading: loadingContracts } = useQuery({
    queryKey: ['all_contracts'],
    queryFn: () => client.entities.Contract.list('-created_date', 1000),
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
  });

  const { data: recurringBills = [], isLoading: loadingBills } = useQuery({
    queryKey: ['all_recurring_bills'],
    queryFn: () => client.entities.RecurringBill.list('-created_date', 1000),
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
  });

  // Auto-retry if any of the main queries loads empty
  useAutoRetry(
    [customers, contracts, recurringBills],
    isLoading || loadingContracts || loadingBills,
    [['customers'], ['all_contracts'], ['all_recurring_bills']]
  );

  const statsReady = !loadingContracts && !loadingBills;

  const createMutation = useMutation({
    mutationFn: (data) => client.entities.Customer.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      handleCloseDialog();
    },
    onError: (error) => toast.error(error.message || 'Failed to create customer')
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => client.entities.Customer.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      handleCloseDialog();
    },
    onError: (error) => toast.error(error.message || 'Failed to update customer')
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => client.entities.Customer.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setDeleteConfirmCustomer(null);
    },
    onError: (error) => toast.error(error.message || 'Failed to delete customer')
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

  const filteredCustomers = customers
    .filter(customer => {
      const query = searchQuery.toLowerCase();
      const matchesSearch = [
        customer.name,
        customer.email,
        customer.primary_contact,
        customer.phone,
        customer.address,
      ].some(value => String(value || '').toLowerCase().includes(query));
      const matchesStatus = statusFilter === 'all' || customer.status === statusFilter;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  const getCustomerStats = (customerId) => {
    const customerContracts = contracts.filter(c => c.customer_id === customerId && c.status === 'active');
    const now = new Date();
    const customerBills = recurringBills.filter(b => {
      if (b.customer_id !== customerId) return false;
      if ((b.status || '').toLowerCase() === 'inactive') return false;
      if (b.end_date) {
        const end = new Date(b.end_date);
        if (end.getFullYear() < 2090 && end < now) return false;
      }
      return true;
    });
    const mrr = customerBills.reduce((sum, b) => {
      const freq = (b.frequency || 'monthly').toLowerCase();
      const amount = b.amount || 0;
      if (freq === 'quarterly' || freq === 'quarter') return sum + amount / 3;
      if (['yearly', 'annual', 'annually', 'year'].includes(freq)) return sum + amount / 12;
      return sum + amount;
    }, 0);
    return { contracts: customerContracts.length, services: customerBills.length, mrr };
  };

  const activeCount = customers.filter(c => c.status === 'active').length;
  const totalMonthly = customers.reduce((sum, customer) => sum + getCustomerStats(customer.id).mrr, 0);
  const accountsWithServices = customers.filter(customer => getCustomerStats(customer.id).services > 0).length;
  const activeContracts = contracts.filter(c => c.status === 'active').length;

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Customers' }]} />

      <PortalPageHeader
        title="Customers"
        description={`${customers.length} total accounts, ${activeCount} currently active.`}
        actions={(
          <>
            <Button onClick={handleSyncHaloPSA} disabled={isSyncing} variant="outline" size="sm" className="gap-2">
              {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Sync HaloPSA
            </Button>
            <Button onClick={() => handleOpenDialog()} size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Add Customer
            </Button>
          </>
        )}
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <PortalMetricCard icon={Building2} label="Total customers" value={customers.length} detail={`${activeCount} active`} tone="violet" />
        <PortalMetricCard icon={DollarSign} label="Monthly billing" value={`$${Math.round(totalMonthly).toLocaleString()}`} detail="recurring services" tone="emerald" />
        <PortalMetricCard icon={FileText} label="Active contracts" value={activeContracts} detail="current agreements" tone="blue" />
        <PortalMetricCard icon={RefreshCw} label="Service accounts" value={accountsWithServices} detail="with recurring billing" tone="slate" />
      </div>

      <PortalSection
        title="Customer directory"
        description="Search accounts and open a customer workspace."
        actions={(
          <div className="flex flex-wrap items-center gap-2">
            {FILTER_CHIPS.map((chip) => (
              <button
                key={chip.value}
                onClick={() => setStatusFilter(chip.value)}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
                  statusFilter === chip.value
                    ? 'bg-slate-950 text-white'
                    : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                )}
              >
                {chip.label}
              </button>
            ))}
          </div>
        )}
      >
        <div className="border-b border-slate-100 p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search customer, email, or primary contact"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-10 rounded-lg border-slate-200 bg-white pl-10 pr-10"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="p-4">
            <SkeletonGrid count={6} cols={1} className="grid-cols-1" />
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={Building2}
              title="No customers found"
              description={
                searchQuery || statusFilter !== 'all'
                  ? 'Try adjusting the search or status filter.'
                  : 'Create the first customer account to get started.'
              }
              action={!searchQuery && statusFilter === 'all' ? {
                label: 'Add Customer',
                onClick: () => handleOpenDialog()
              } : undefined}
            />
          </div>
        ) : (
          <>
            <div className="hidden grid-cols-[minmax(0,1.3fr)_minmax(170px,0.9fr)_120px_120px_120px_72px] gap-3 border-b border-slate-100 bg-slate-50 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 lg:grid">
              <div>Customer</div>
              <div>Primary contact</div>
              <div className="text-right">Monthly</div>
              <div className="text-center">Contracts</div>
              <div className="text-center">Status</div>
              <div />
            </div>
            <div className="divide-y divide-slate-100">
              {filteredCustomers.map((customer) => {
                const stats = getCustomerStats(customer.id);
                return (
                  <div
                    key={customer.id}
                    onClick={() => navigate(createPageUrl(`CustomerDetail?id=${customer.id}`))}
                    className="grid cursor-pointer grid-cols-1 gap-3 px-5 py-3 transition-colors hover:bg-slate-50 lg:grid-cols-[minmax(0,1.3fr)_minmax(170px,0.9fr)_120px_120px_120px_72px] lg:items-center"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                        {customer.logo_url ? (
                          <img src={resolveFileUrl(customer.logo_url)} alt={customer.name} className="h-7 w-7 object-contain" />
                        ) : (
                          <Building2 className="h-5 w-5 text-slate-500" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-semibold text-slate-950">{customer.name}</p>
                          <PortalStatusPill
                            tone={customer.status === 'active' ? 'emerald' : customer.status === 'suspended' ? 'rose' : 'slate'}
                            label={customer.status || 'active'}
                            className="hidden py-0.5 text-[10px] sm:inline-flex"
                          />
                        </div>
                        <p className="truncate text-xs text-slate-500">{customer.email || customer.address || 'No email on file'}</p>
                      </div>
                    </div>
                    <div className="min-w-0 text-sm text-slate-700">
                      <p className="truncate font-medium text-slate-800">{customer.primary_contact || 'No primary contact'}</p>
                      <p className="truncate text-xs text-slate-500">{customer.phone || customer.email || 'No contact detail'}</p>
                    </div>
                    <div className="lg:text-right">
                      <p className="text-sm font-semibold tabular-nums text-slate-950">
                        {statsReady ? `$${Math.round(stats.mrr).toLocaleString()}` : '-'}
                      </p>
                      <p className="text-xs text-slate-500">{statsReady ? `${stats.services} service${stats.services === 1 ? '' : 's'}` : 'loading'}</p>
                    </div>
                    <div className="lg:text-center">
                      <span className={cn(
                        'inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold',
                        statsReady && stats.contracts > 0
                          ? 'border-blue-200 bg-blue-50 text-blue-700'
                          : 'border-slate-200 bg-slate-50 text-slate-500'
                      )}>
                        {statsReady ? `${stats.contracts} active` : '-'}
                      </span>
                    </div>
                    <div className="lg:text-center">
                      <PortalStatusPill
                        tone={customer.status === 'active' ? 'emerald' : customer.status === 'suspended' ? 'rose' : 'slate'}
                        label={customer.status || 'active'}
                        className="py-1 text-[11px]"
                      />
                    </div>
                    <div className="flex items-center justify-end gap-1" onClick={(event) => event.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4 text-slate-500" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleOpenDialog(customer)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setDeleteConfirmCustomer(customer)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <ChevronRight className="h-4 w-4 text-slate-300" />
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </PortalSection>

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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirmCustomer} onOpenChange={(open) => { if (!open) setDeleteConfirmCustomer(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Customer</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <span className="font-semibold">{deleteConfirmCustomer?.name}</span>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteMutation.mutate(deleteConfirmCustomer.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
