import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  UserPlus, 
  Users, 
  Building2, 
  Check, 
  AlertCircle, 
  Search,
  Clock,
  Shield,
  ChevronRight,
  RefreshCw
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export default function UserAssignmentPanel() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);

  // Fetch all users
  const { data: allUsers = [], isLoading: loadingUsers, refetch: refetchUsers } = useQuery({
    queryKey: ['all-users'],
    queryFn: () => base44.entities.User.list('-created_date', 500),
  });

  // Fetch all customers
  const { data: customers = [], isLoading: loadingCustomers } = useQuery({
    queryKey: ['customers-for-assignment'],
    queryFn: () => base44.entities.Customer.list('name', 500),
  });

  // Filter users
  const unassignedUsers = allUsers.filter(u => u.role !== 'admin' && !u.customer_id);
  const assignedUsers = allUsers.filter(u => u.role !== 'admin' && u.customer_id);
  const adminUsers = allUsers.filter(u => u.role === 'admin');

  const filteredUnassigned = unassignedUsers.filter(u => 
    u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Assign user mutation
  const assignMutation = useMutation({
    mutationFn: async ({ userId, customerId, customerName }) => {
      await base44.entities.User.update(userId, { 
        customer_id: customerId,
        customer_name: customerName
      });
    },
    onSuccess: () => {
      toast.success('User assigned successfully');
      queryClient.invalidateQueries({ queryKey: ['all-users'] });
      setAssignDialogOpen(false);
      setSelectedUser(null);
      setSelectedCustomerId('');
    },
    onError: (error) => {
      toast.error('Failed to assign user: ' + error.message);
    }
  });

  // Unassign user mutation
  const unassignMutation = useMutation({
    mutationFn: async (userId) => {
      await base44.entities.User.update(userId, { 
        customer_id: null,
        customer_name: null
      });
    },
    onSuccess: () => {
      toast.success('User access revoked');
      queryClient.invalidateQueries({ queryKey: ['all-users'] });
    },
    onError: (error) => {
      toast.error('Failed to revoke access: ' + error.message);
    }
  });

  const handleOpenAssign = (user) => {
    setSelectedUser(user);
    setSelectedCustomerId('');
    setAssignDialogOpen(true);
  };

  const handleAssign = () => {
    if (!selectedUser || !selectedCustomerId) return;
    const customer = customers.find(c => c.id === selectedCustomerId);
    assignMutation.mutate({
      userId: selectedUser.id,
      customerId: selectedCustomerId,
      customerName: customer?.name || ''
    });
  };

  const isLoading = loadingUsers || loadingCustomers;

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-700">{unassignedUsers.length}</p>
              <p className="text-sm text-amber-600">Pending Assignment</p>
            </div>
          </div>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <Users className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-green-700">{assignedUsers.length}</p>
              <p className="text-sm text-green-600">Active Users</p>
            </div>
          </div>
        </div>

        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
              <Shield className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-purple-700">{adminUsers.length}</p>
              <p className="text-sm text-purple-600">Administrators</p>
            </div>
          </div>
        </div>
      </div>

      {/* Unassigned Users Section */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-500" />
              <h3 className="font-semibold text-slate-900">Users Awaiting Assignment</h3>
              {unassignedUsers.length > 0 && (
                <Badge variant="secondary" className="bg-amber-100 text-amber-700">
                  {unassignedUsers.length} pending
                </Badge>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={() => refetchUsers()}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {unassignedUsers.length > 0 && (
          <div className="p-4 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        )}

        <div className="divide-y divide-slate-100">
          {isLoading ? (
            <div className="p-8 text-center text-slate-500">Loading users...</div>
          ) : filteredUnassigned.length === 0 ? (
            <div className="p-8 text-center">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-green-100 flex items-center justify-center">
                <Check className="w-6 h-6 text-green-600" />
              </div>
              <p className="text-slate-600 font-medium">All users have been assigned</p>
              <p className="text-sm text-slate-500 mt-1">No pending user assignments</p>
            </div>
          ) : (
            filteredUnassigned.map((user) => (
              <div key={user.id} className="p-4 hover:bg-slate-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                      <span className="text-amber-700 font-medium">
                        {user.full_name?.charAt(0) || user.email?.charAt(0) || '?'}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">{user.full_name || 'No Name'}</p>
                      <p className="text-sm text-slate-500">{user.email}</p>
                    </div>
                  </div>
                  <Button 
                    onClick={() => handleOpenAssign(user)}
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    <UserPlus className="w-4 h-4 mr-2" />
                    Assign
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Assigned Users Section */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-green-500" />
            <h3 className="font-semibold text-slate-900">Assigned Customer Users</h3>
            <Badge variant="secondary" className="bg-green-100 text-green-700">
              {assignedUsers.length} active
            </Badge>
          </div>
        </div>

        <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
          {assignedUsers.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              No assigned users yet
            </div>
          ) : (
            assignedUsers.map((user) => (
              <div key={user.id} className="p-4 hover:bg-slate-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                      <span className="text-green-700 font-medium">
                        {user.full_name?.charAt(0) || '?'}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">{user.full_name}</p>
                      <p className="text-sm text-slate-500">{user.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="flex items-center gap-1 text-sm text-slate-600">
                        <Building2 className="w-3 h-3" />
                        {user.customer_name || 'Unknown'}
                      </div>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => unassignMutation.mutate(user.id)}
                    >
                      Revoke
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Assignment Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assign User to Organization</DialogTitle>
            <DialogDescription>
              Select the customer organization this user belongs to. They will gain access to that organization's data.
            </DialogDescription>
          </DialogHeader>

          {selectedUser && (
            <div className="space-y-4">
              {/* User Info */}
              <div className="bg-slate-50 rounded-lg p-4">
                <p className="text-sm text-slate-500 mb-1">User</p>
                <p className="font-medium text-slate-900">{selectedUser.full_name}</p>
                <p className="text-sm text-slate-600">{selectedUser.email}</p>
              </div>

              {/* Customer Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">
                  Assign to Organization
                </label>
                <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a customer..." />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-slate-400" />
                          {customer.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Warning */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-sm text-amber-800">
                  <strong>Important:</strong> This user will have access to all data for the selected organization including contracts, invoices, and team information.
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleAssign}
              disabled={!selectedCustomerId || assignMutation.isPending}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {assignMutation.isPending ? 'Assigning...' : 'Assign User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}