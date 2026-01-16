import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { 
  FileText, 
  Plus, 
  Search, 
  Filter,
  Calendar,
  DollarSign,
  MoreVertical,
  Pencil,
  Trash2,
  AlertTriangle
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
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { format, parseISO, differenceInDays } from 'date-fns';

export default function Contracts() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingContract, setEditingContract] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    customer_id: '',
    customer_name: '',
    type: 'managed_services',
    status: 'active',
    start_date: '',
    end_date: '',
    renewal_date: '',
    billing_cycle: 'monthly',
    value: '',
    description: '',
    auto_renew: false
  });

  const queryClient = useQueryClient();

  const { data: contracts = [], isLoading } = useQuery({
    queryKey: ['contracts'],
    queryFn: () => base44.entities.Contract.list('-created_date', 500),
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Contract.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      handleCloseDialog();
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Contract.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      handleCloseDialog();
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Contract.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contracts'] })
  });

  const handleOpenDialog = (contract = null) => {
    if (contract) {
      setEditingContract(contract);
      setFormData({
        name: contract.name || '',
        customer_id: contract.customer_id || '',
        customer_name: contract.customer_name || '',
        type: contract.type || 'managed_services',
        status: contract.status || 'active',
        start_date: contract.start_date || '',
        end_date: contract.end_date || '',
        renewal_date: contract.renewal_date || '',
        billing_cycle: contract.billing_cycle || 'monthly',
        value: contract.value || '',
        description: contract.description || '',
        auto_renew: contract.auto_renew || false
      });
    } else {
      setEditingContract(null);
      setFormData({
        name: '',
        customer_id: '',
        customer_name: '',
        type: 'managed_services',
        status: 'active',
        start_date: '',
        end_date: '',
        renewal_date: '',
        billing_cycle: 'monthly',
        value: '',
        description: '',
        auto_renew: false
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingContract(null);
  };

  const handleCustomerChange = (customerId) => {
    const customer = customers.find(c => c.id === customerId);
    setFormData({ 
      ...formData, 
      customer_id: customerId,
      customer_name: customer?.name || ''
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = {
      ...formData,
      value: formData.value ? parseFloat(formData.value) : 0
    };
    if (editingContract) {
      updateMutation.mutate({ id: editingContract.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const getUrgencyLevel = (dateStr) => {
    if (!dateStr) return null;
    const days = differenceInDays(parseISO(dateStr), new Date());
    if (days < 0) return 'expired';
    if (days <= 30) return 'urgent';
    if (days <= 60) return 'warning';
    return 'normal';
  };

  const filteredContracts = contracts.filter(contract => {
    const matchesSearch = contract.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         contract.customer_name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || contract.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Contracts</h1>
          <p className="text-slate-500 mt-1">{contracts.length} total contracts</p>
        </div>
        <Button 
          onClick={() => handleOpenDialog()}
          className="bg-slate-900 hover:bg-slate-800"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Contract
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search contracts..."
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
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Contract List */}
      {isLoading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      ) : filteredContracts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/50 p-12 text-center">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900 mb-2">No contracts found</h3>
          <p className="text-slate-500 mb-6">
            {searchQuery || statusFilter !== 'all' 
              ? 'Try adjusting your filters' 
              : 'Get started by adding your first contract'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/50 overflow-hidden">
          <div className="divide-y divide-slate-100">
            {filteredContracts.map((contract) => {
              const renewalDate = contract.renewal_date || contract.end_date;
              const urgency = getUrgencyLevel(renewalDate);
              const daysUntil = renewalDate ? differenceInDays(parseISO(renewalDate), new Date()) : null;

              return (
                <div
                  key={contract.id}
                  className="flex items-center gap-4 p-4 sm:p-6 hover:bg-slate-50 transition-colors"
                >
                  <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0",
                    urgency === 'expired' && "bg-red-100",
                    urgency === 'urgent' && "bg-amber-100",
                    urgency === 'warning' && "bg-yellow-100",
                    (!urgency || urgency === 'normal') && "bg-slate-100"
                  )}>
                    {urgency === 'expired' || urgency === 'urgent' ? (
                      <AlertTriangle className={cn(
                        "w-6 h-6",
                        urgency === 'expired' ? "text-red-600" : "text-amber-600"
                      )} />
                    ) : (
                      <FileText className="w-6 h-6 text-slate-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <p className="font-medium text-slate-900 truncate">{contract.name}</p>
                      <Badge variant="outline" className={cn(
                        "capitalize hidden sm:inline-flex",
                        contract.status === 'active' && "border-emerald-200 bg-emerald-50 text-emerald-700",
                        contract.status === 'pending' && "border-blue-200 bg-blue-50 text-blue-700",
                        contract.status === 'expired' && "border-red-200 bg-red-50 text-red-700",
                        contract.status === 'cancelled' && "border-slate-200 bg-slate-50 text-slate-600"
                      )}>
                        {contract.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-sm text-slate-500">
                      <span>{contract.customer_name}</span>
                      <span className="capitalize">{contract.type?.replace('_', ' ')}</span>
                    </div>
                  </div>
                  <div className="hidden md:flex items-center gap-6">
                    <div className="text-center">
                      <p className="font-medium text-slate-900">${(contract.value || 0).toLocaleString()}</p>
                      <p className="text-xs text-slate-500 capitalize">{contract.billing_cycle}</p>
                    </div>
                    {renewalDate && (
                      <div className="text-center">
                        <p className="font-medium text-slate-900">
                          {format(parseISO(renewalDate), 'MMM d, yyyy')}
                        </p>
                        <p className={cn(
                          "text-xs",
                          urgency === 'expired' && "text-red-600",
                          urgency === 'urgent' && "text-amber-600",
                          urgency === 'warning' && "text-yellow-600",
                          urgency === 'normal' && "text-slate-500"
                        )}>
                          {daysUntil < 0 ? `${Math.abs(daysUntil)} days ago` : `${daysUntil} days`}
                        </p>
                      </div>
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="flex-shrink-0">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleOpenDialog(contract)}>
                        <Pencil className="w-4 h-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        className="text-red-600"
                        onClick={() => deleteMutation.mutate(contract.id)}
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
              {editingContract ? 'Edit Contract' : 'Add New Contract'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="name">Contract Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
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
                <Label htmlFor="type">Type</Label>
                <Select 
                  value={formData.type} 
                  onValueChange={(value) => setFormData({ ...formData, type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="managed_services">Managed Services</SelectItem>
                    <SelectItem value="break_fix">Break/Fix</SelectItem>
                    <SelectItem value="project">Project</SelectItem>
                    <SelectItem value="subscription">Subscription</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
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
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="value">Value</Label>
                <Input
                  id="value"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.value}
                  onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                />
              </div>
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
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="annually">Annually</SelectItem>
                    <SelectItem value="one_time">One Time</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_date">Start Date</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_date">End Date</Label>
                <Input
                  id="end_date"
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                />
              </div>
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
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="auto_renew">Auto Renew</Label>
              <Switch
                id="auto_renew"
                checked={formData.auto_renew}
                onCheckedChange={(checked) => setFormData({ ...formData, auto_renew: checked })}
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
                {editingContract ? 'Update' : 'Create'} Contract
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}