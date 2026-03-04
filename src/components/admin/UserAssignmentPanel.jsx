import React, { useState } from 'react';
import { client } from '@/api/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  UserPlus,
  Users,
  Building2,
  Search,
  Shield,
  Trash2,
  ChevronDown,
  ChevronRight,
  Briefcase,
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

const ROLE_BADGES = {
  admin: { label: 'Admin', className: 'bg-purple-100 text-purple-700 border-purple-200' },
  sales: { label: 'Sales', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  user:  { label: 'Customer', className: 'bg-green-100 text-green-700 border-green-200' },
};

export default function UserAssignmentPanel() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [inviteType, setInviteType] = useState(null); // null, 'customer', or 'tech'
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('admin');
  const [inviteCustomerId, setInviteCustomerId] = useState('');
  const [expandedOrgs, setExpandedOrgs] = useState({});
  const [viewMode, setViewMode] = useState('all');
  const [isInviting, setIsInviting] = useState(false);

  const { data: allUsers = [], isLoading: loadingUsers } = useQuery({
    queryKey: ['all-users'],
    queryFn: () => client.entities.User.list('-created_date', 500),
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers-for-assignment'],
    queryFn: () => client.entities.Customer.list('name', 500),
  });

  const customerUsers = allUsers.filter(u => u.role === 'user');
  const techUsers = allUsers.filter(u => u.role === 'admin' || u.role === 'sales');
  const unassignedUsers = customerUsers.filter(u => !u.customer_id);

  const usersByOrg = customers.map(customer => ({
    ...customer,
    users: customerUsers.filter(u => u.customer_id === customer.id)
  })).filter(org => org.users.length > 0);

  const filteredUsers = (viewMode === 'all' ? allUsers : customerUsers).filter(u =>
    u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const updateUserMutation = useMutation({
    mutationFn: async ({ userId, data }) => {
      await client.entities.User.update(userId, data);
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
    try {
      await client.entities.User.update(user.id, {
        customer_id: customerId === 'none' ? null : customerId,
        customer_name: customerId === 'none' ? null : customer?.name
      });
      toast.success('User updated');
      queryClient.invalidateQueries({ queryKey: ['all-users'] });
    } catch (error) {
      toast.error('Failed to update user: ' + error.message);
    }
  };

  const handleRoleChange = (user, newRole) => {
    updateUserMutation.mutate({ userId: user.id, data: { role: newRole } });
  };

  const handleInviteUser = async () => {
    if (!inviteEmail) return;
    setIsInviting(true);
    try {
      const payload = {
        email: inviteEmail,
        invite_type: inviteType,
        role: inviteType === 'customer' ? 'user' : inviteRole,
        customer_id: inviteType === 'customer' ? inviteCustomerId : undefined,
      };
      await client.users.inviteUser(payload.email, payload.role, payload.invite_type, payload.customer_id);
      toast.success('Invitation sent to ' + inviteEmail);
      setInviteType(null);
      setInviteEmail('');
      setInviteRole('admin');
      setInviteCustomerId('');
      queryClient.invalidateQueries({ queryKey: ['all-users'] });
    } catch (error) {
      toast.error('Failed to invite user: ' + error.message);
    } finally {
      setIsInviting(false);
    }
  };

  const toggleOrg = (orgId) => {
    setExpandedOrgs(prev => ({ ...prev, [orgId]: !prev[orgId] }));
  };

  const getRoleBadge = (role) => {
    const config = ROLE_BADGES[role] || ROLE_BADGES.user;
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  const UserRow = ({ user, showOrgSelect = true }) => {
    const isApproved = !!user.customer_id;
    return (
      <div className="px-4 py-3 hover:bg-slate-50 transition-colors">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 min-w-[200px]">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-medium ${
              user.role === 'admin' ? 'bg-purple-500' :
              user.role === 'sales' ? 'bg-blue-500' :
              isApproved ? 'bg-green-500' : 'bg-amber-500'
            }`}>
              {user.full_name?.charAt(0)?.toLowerCase() || user.email?.charAt(0)?.toLowerCase() || '?'}
            </div>
            <div>
              <p className="font-medium text-slate-900">{user.full_name || 'No Name'}</p>
              <p className="text-sm text-slate-500">{user.email}</p>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-3">
            {getRoleBadge(user.role)}

            {user.role === 'user' && showOrgSelect && (
              <Select
                value={user.customer_id || 'none'}
                onValueChange={(value) => handleOrganizationChange(user, value)}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="No Organization" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  <SelectItem value="none">
                    <span className="text-slate-400">No Organization</span>
                  </SelectItem>
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id} className="truncate">
                      <span className="truncate max-w-[140px] block">{customer.name}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Select
              value={user.role || 'user'}
              onValueChange={(value) => handleRoleChange(user, value)}
            >
              <SelectTrigger className="w-[110px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">Customer</SelectItem>
                <SelectItem value="sales">Sales</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Invite Buttons */}
      <div className="flex flex-wrap gap-3">
        <Button onClick={() => setInviteType('customer')} variant="outline" className="gap-2">
          <Building2 className="w-4 h-4" /> Invite Customer
        </Button>
        <Button onClick={() => setInviteType('tech')} className="bg-slate-900 hover:bg-slate-800 gap-2">
          <UserPlus className="w-4 h-4" /> Invite Tech
        </Button>
      </div>

      {/* View Toggle */}
      <div className="flex gap-2">
        <Button variant={viewMode === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('all')}>
          All Users
        </Button>
        <Button variant={viewMode === 'byOrg' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('byOrg')}>
          <Building2 className="w-4 h-4 mr-2" /> By Organization
        </Button>
      </div>

      {viewMode === 'all' ? (
        <>
          {/* All Users */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">All Users</h3>
              <Badge variant="secondary">{allUsers.length} total</Badge>
            </div>

            {allUsers.length > 3 && (
              <div className="p-4 border-b border-slate-100">
                <div className="relative max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input placeholder="Search users..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
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

          {/* Tech Team */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-purple-500" />
                <h3 className="font-semibold text-slate-900">Tech Team</h3>
                <Badge variant="secondary" className="bg-purple-100 text-purple-700">{techUsers.length}</Badge>
              </div>
            </div>
            <div className="divide-y divide-slate-100">
              {techUsers.map((user) => (
                <div key={user.id} className="px-4 py-3">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-medium ${
                        user.role === 'admin' ? 'bg-purple-500' : 'bg-blue-500'
                      }`}>
                        {user.full_name?.charAt(0)?.toLowerCase() || '?'}
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">{user.full_name || 'No Name'}</p>
                        <p className="text-sm text-slate-500">{user.email}</p>
                      </div>
                    </div>
                    <div className="ml-auto flex items-center gap-3">
                      {getRoleBadge(user.role)}
                      <Select value={user.role} onValueChange={(value) => handleRoleChange(user, value)}>
                        <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="sales">Sales</SelectItem>
                          <SelectItem value="user">Customer</SelectItem>
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
            <div className="p-4 border-b border-slate-200">
              <h3 className="font-semibold text-slate-900">Users by Organization</h3>
            </div>
            <div className="divide-y divide-slate-100">
              {unassignedUsers.length > 0 && (
                <div>
                  <button onClick={() => toggleOrg('unassigned')} className="w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors">
                    {expandedOrgs['unassigned'] ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                    <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center"><Users className="w-4 h-4 text-amber-600" /></div>
                    <span className="font-medium text-slate-900">Unassigned Users</span>
                    <Badge variant="secondary" className="bg-amber-100 text-amber-700">{unassignedUsers.length}</Badge>
                  </button>
                  {expandedOrgs['unassigned'] && (
                    <div className="border-t border-slate-100 bg-slate-50">
                      {unassignedUsers.map(user => <UserRow key={user.id} user={user} />)}
                    </div>
                  )}
                </div>
              )}

              {usersByOrg.map(org => (
                <div key={org.id}>
                  <button onClick={() => toggleOrg(org.id)} className="w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors">
                    {expandedOrgs[org.id] ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                    <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center"><Building2 className="w-4 h-4 text-purple-600" /></div>
                    <span className="font-medium text-slate-900">{org.name}</span>
                    <Badge variant="secondary" className="bg-green-100 text-green-700">{org.users.length} user{org.users.length !== 1 ? 's' : ''}</Badge>
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
        </>
      )}

      {/* Invite Customer Dialog */}
      <Dialog open={inviteType === 'customer'} onOpenChange={(open) => !open && setInviteType(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-green-600" /> Invite Customer User
            </DialogTitle>
            <DialogDescription>
              Send an invitation to a customer to access their company portal.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Email Address</label>
              <Input type="email" placeholder="customer@company.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Company</label>
              <Select value={inviteCustomerId} onValueChange={setInviteCustomerId}>
                <SelectTrigger><SelectValue placeholder="Select a company..." /></SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>{customer.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteType(null)}>Cancel</Button>
            <Button onClick={handleInviteUser} disabled={!inviteEmail || !inviteCustomerId || isInviting} className="bg-green-600 hover:bg-green-700 gap-2">
              <UserPlus className="w-4 h-4" /> {isInviting ? 'Sending...' : 'Send Invitation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite Tech Dialog */}
      <Dialog open={inviteType === 'tech'} onOpenChange={(open) => !open && setInviteType(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-purple-600" /> Invite Tech Team Member
            </DialogTitle>
            <DialogDescription>
              Send an invitation to join the internal team.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Email Address</label>
              <Input type="email" placeholder="team@company.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Role</label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-purple-500" /> Admin (Full Access)
                    </div>
                  </SelectItem>
                  <SelectItem value="sales">
                    <div className="flex items-center gap-2">
                      <Briefcase className="w-4 h-4 text-blue-500" /> Sales
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteType(null)}>Cancel</Button>
            <Button onClick={handleInviteUser} disabled={!inviteEmail || isInviting} className="bg-purple-600 hover:bg-purple-700 gap-2">
              <UserPlus className="w-4 h-4" /> {isInviting ? 'Sending...' : 'Send Invitation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
