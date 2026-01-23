import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  UserPlus, 
  Users, 
  Building2, 
  Search,
  Shield,
  Trash2,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('user');
  const [expandedOrgs, setExpandedOrgs] = useState({});
  const [viewMode, setViewMode] = useState('all'); // 'all' or 'byOrg'

  // Fetch all users
  const { data: allUsers = [], isLoading: loadingUsers } = useQuery({
    queryKey: ['all-users'],
    queryFn: () => base44.entities.User.list('-created_date', 500),
  });

  // Fetch all customers
  const { data: customers = [] } = useQuery({
    queryKey: ['customers-for-assignment'],
    queryFn: () => base44.entities.Customer.list('name', 500),
  });

  // Filter users
  const customerUsers = allUsers.filter(u => u.role !== 'admin');
  const adminUsers = allUsers.filter(u => u.role === 'admin');
  const unassignedUsers = customerUsers.filter(u => !u.customer_id);

  // Group users by organization
  const usersByOrg = customers.map(customer => ({
    ...customer,
    users: customerUsers.filter(u => u.customer_id === customer.id)
  })).filter(org => org.users.length > 0);

  const filteredUsers = customerUsers.filter(u => 
    u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: async ({ userId, data }) => {
      await base44.entities.User.update(userId, data);
    },
    onSuccess: () => {
      toast.success('User updated');
      queryClient.invalidateQueries({ queryKey: ['all-users'] });
    },
    onError: (error) => {
      toast.error('Failed to update user: ' + error.message);
    }
  });

  const handleOrganizationChange = async (user, customerId) => {
    const customer = customers.find(c => c.id === customerId);
    console.log('Updating user', user.id, 'to customer', customerId, customer?.name);
    try {
      await base44.entities.User.update(user.id, {
        customer_id: customerId === 'none' ? null : customerId,
        customer_name: customerId === 'none' ? null : customer?.name
      });
      toast.success('User updated');
      queryClient.invalidateQueries({ queryKey: ['all-users'] });
    } catch (error) {
      console.error('Failed to update user:', error);
      toast.error('Failed to update user: ' + error.message);
    }
  };

  const handleRoleChange = (user, newRole) => {
    updateUserMutation.mutate({
      userId: user.id,
      data: { role: newRole }
    });
  };

  const handleInviteUser = async () => {
    if (!inviteEmail) return;
    try {
      await base44.users.inviteUser(inviteEmail, inviteRole);
      toast.success('Invitation sent to ' + inviteEmail);
      setInviteDialogOpen(false);
      setInviteEmail('');
      setInviteRole('user');
      queryClient.invalidateQueries({ queryKey: ['all-users'] });
    } catch (error) {
      toast.error('Failed to invite user: ' + error.message);
    }
  };

  const toggleOrg = (orgId) => {
    setExpandedOrgs(prev => ({ ...prev, [orgId]: !prev[orgId] }));
  };

  const UserRow = ({ user, showOrgSelect = true }) => {
    const isApproved = !!user.customer_id;
    return (
      <div className="px-4 py-3 hover:bg-slate-50 transition-colors">
        <div className="flex items-center gap-4">
          {/* Avatar & Name */}
          <div className="flex items-center gap-3 min-w-[200px]">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-medium ${
              isApproved ? 'bg-green-500' : 'bg-amber-500'
            }`}>
              {user.full_name?.charAt(0)?.toLowerCase() || user.email?.charAt(0)?.toLowerCase() || '?'}
            </div>
            <div>
              <p className="font-medium text-slate-900">{user.full_name || 'No Name'}</p>
              <p className="text-sm text-slate-500">{user.email}</p>
            </div>
          </div>

          {/* Approval Toggle */}
          <div className="flex items-center gap-2 ml-auto">
            <Switch
              checked={isApproved}
              onCheckedChange={(checked) => {
                if (!checked) {
                  handleOrganizationChange(user, 'none');
                }
              }}
              disabled={!isApproved}
            />
            <span className={`text-sm font-medium w-16 ${isApproved ? 'text-green-600' : 'text-slate-400'}`}>
              {isApproved ? 'Approved' : 'Pending'}
            </span>
          </div>

          {/* Organization Select */}
          {showOrgSelect && (
            <Select 
              value={user.customer_id || 'none'} 
              onValueChange={(value) => handleOrganizationChange(user, value)}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="No Organization" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">
                  <span className="text-slate-400">No Organization</span>
                </SelectItem>
                {customers.map((customer) => (
                  <SelectItem key={customer.id} value={customer.id}>
                    {customer.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Role Select */}
          <Select 
            value={user.role || 'user'} 
            onValueChange={(value) => handleRoleChange(user, value)}
          >
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="user">User</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>

          {/* Delete */}
          <Button 
            variant="ghost" 
            size="icon"
            className="text-slate-400 hover:text-red-600 hover:bg-red-50"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* View Toggle */}
      <div className="flex gap-2">
        <Button
          variant={viewMode === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setViewMode('all')}
        >
          All Users
        </Button>
        <Button
          variant={viewMode === 'byOrg' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setViewMode('byOrg')}
        >
          <Building2 className="w-4 h-4 mr-2" />
          By Organization
        </Button>
      </div>

      {viewMode === 'all' ? (
        <>
          {/* Active Users Section */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">Active Users</h3>
              <Button 
                onClick={() => setInviteDialogOpen(true)}
                className="bg-slate-900 hover:bg-slate-800"
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Invite User
              </Button>
            </div>

            {customerUsers.length > 3 && (
              <div className="p-4 border-b border-slate-100">
                <div className="relative max-w-sm">
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
              {loadingUsers ? (
                <div className="p-8 text-center text-slate-500">Loading users...</div>
              ) : filteredUsers.length === 0 ? (
                <div className="p-8 text-center text-slate-500">No users found</div>
              ) : (
                filteredUsers.map((user) => <UserRow key={user.id} user={user} />)
              )}
            </div>
          </div>

          {/* Admins Section */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-purple-500" />
                <h3 className="font-semibold text-slate-900">Administrators</h3>
                <Badge variant="secondary" className="bg-purple-100 text-purple-700">
                  {adminUsers.length}
                </Badge>
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              {adminUsers.map((user) => (
                <div key={user.id} className="px-4 py-3">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-purple-500 flex items-center justify-center text-white font-medium">
                        {user.full_name?.charAt(0)?.toLowerCase() || '?'}
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">{user.full_name}</p>
                        <p className="text-sm text-slate-500">{user.email}</p>
                      </div>
                    </div>
                    <div className="ml-auto flex items-center gap-3">
                      <Badge className="bg-orange-100 text-orange-700 border-orange-200">
                        Super Admin
                      </Badge>
                      <Select 
                        value="admin" 
                        onValueChange={(value) => handleRoleChange(user, value)}
                      >
                        <SelectTrigger className="w-[120px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user">User</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <>
          {/* By Organization View */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">Users by Organization</h3>
              <Button 
                onClick={() => setInviteDialogOpen(true)}
                className="bg-slate-900 hover:bg-slate-800"
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Invite User
              </Button>
            </div>

            <div className="divide-y divide-slate-100">
              {/* Unassigned Users */}
              {unassignedUsers.length > 0 && (
                <div>
                  <button
                    onClick={() => toggleOrg('unassigned')}
                    className="w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors"
                  >
                    {expandedOrgs['unassigned'] ? (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    )}
                    <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                      <Users className="w-4 h-4 text-amber-600" />
                    </div>
                    <span className="font-medium text-slate-900">Unassigned Users</span>
                    <Badge variant="secondary" className="bg-amber-100 text-amber-700">
                      {unassignedUsers.length}
                    </Badge>
                  </button>
                  {expandedOrgs['unassigned'] && (
                    <div className="border-t border-slate-100 bg-slate-50">
                      {unassignedUsers.map(user => <UserRow key={user.id} user={user} />)}
                    </div>
                  )}
                </div>
              )}

              {/* Organizations with users */}
              {usersByOrg.map(org => (
                <div key={org.id}>
                  <button
                    onClick={() => toggleOrg(org.id)}
                    className="w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors"
                  >
                    {expandedOrgs[org.id] ? (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    )}
                    <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
                      <Building2 className="w-4 h-4 text-purple-600" />
                    </div>
                    <span className="font-medium text-slate-900">{org.name}</span>
                    <Badge variant="secondary" className="bg-green-100 text-green-700">
                      {org.users.length} user{org.users.length !== 1 ? 's' : ''}
                    </Badge>
                  </button>
                  {expandedOrgs[org.id] && (
                    <div className="border-t border-slate-100 bg-slate-50">
                      {org.users.map(user => <UserRow key={user.id} user={user} showOrgSelect={false} />)}
                    </div>
                  )}
                </div>
              ))}

              {usersByOrg.length === 0 && unassignedUsers.length === 0 && (
                <div className="p-8 text-center text-slate-500">No users found</div>
              )}
            </div>
          </div>

          {/* Admins Section */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-purple-500" />
                <h3 className="font-semibold text-slate-900">Administrators</h3>
                <Badge variant="secondary" className="bg-purple-100 text-purple-700">
                  {adminUsers.length}
                </Badge>
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              {adminUsers.map((user) => (
                <div key={user.id} className="px-4 py-3">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-purple-500 flex items-center justify-center text-white font-medium">
                        {user.full_name?.charAt(0)?.toLowerCase() || '?'}
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">{user.full_name}</p>
                        <p className="text-sm text-slate-500">{user.email}</p>
                      </div>
                    </div>
                    <div className="ml-auto">
                      <Badge className="bg-orange-100 text-orange-700 border-orange-200">
                        Super Admin
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Invite Dialog */}
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite User</DialogTitle>
            <DialogDescription>
              Send an invitation to join the portal.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Email Address</label>
              <Input
                type="email"
                placeholder="user@company.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Role</label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User (Customer Portal)</SelectItem>
                  <SelectItem value="admin">Admin (Full Access)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleInviteUser}
              disabled={!inviteEmail}
              className="bg-slate-900 hover:bg-slate-800"
            >
              Send Invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}