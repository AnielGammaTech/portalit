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
  Monitor,
  Smartphone,
  Wifi,
  CalendarDays,
  LogIn,
  UserCheck,
  Mail,
  KeyRound,
  MoreVertical,
  Pencil,
  RefreshCw,
  RotateCcw,
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
import { cn } from "@/lib/utils";

const ROLE_BADGES = {
  admin: { label: 'Admin', className: 'bg-purple-100 text-purple-700 border-purple-200' },
  sales: { label: 'Sales', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  user:  { label: 'Customer', className: 'bg-green-100 text-green-700 border-green-200' },
};

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function parseUA(ua) {
  if (!ua) return { device: 'Unknown', browser: 'Unknown' };
  const isIPhone = ua.includes('iPhone');
  const isMac = ua.includes('Macintosh');
  const isWindows = ua.includes('Windows');
  const isAndroid = ua.includes('Android');
  const device = isIPhone ? 'iPhone' : isMac ? 'Mac' : isWindows ? 'Windows' : isAndroid ? 'Android' : 'Unknown';
  const chrome = ua.match(/Chrome\/(\d+)/);
  const safari = ua.match(/Version\/(\S+).*Safari/);
  const firefox = ua.match(/Firefox\/(\d+)/);
  const edge = ua.match(/Edg\/(\d+)/);
  const browser = chrome && !ua.includes('Edg') ? `Chrome ${chrome[1]}`
    : safari ? `Safari ${safari[1]}`
    : firefox ? `Firefox ${firefox[1]}`
    : edge ? `Edge ${edge[1]}`
    : 'Browser';
  return { device, browser };
}

function getUserStatus(user, auth) {
  if (!auth.email_confirmed_at && !auth.last_sign_in_at) {
    return { label: 'Invited', color: 'text-amber-700 bg-amber-50 border-amber-200' };
  }
  if (auth.banned_until) {
    return { label: 'Banned', color: 'text-red-700 bg-red-50 border-red-200' };
  }
  return { label: 'Active', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
}

export default function UserAssignmentPanel() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [inviteType, setInviteType] = useState(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('admin');
  const [inviteName, setInviteName] = useState('');
  const [inviteCustomerId, setInviteCustomerId] = useState('');
  const [expandedUserId, setExpandedUserId] = useState(null);
  const [activeUserMenu, setActiveUserMenu] = useState(null);
  const [isInviting, setIsInviting] = useState(false);

  const { data: allUsers = [], isLoading: loadingUsers } = useQuery({
    queryKey: ['all-users'],
    queryFn: () => client.entities.User.list('-created_date', 500),
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers-for-assignment'],
    queryFn: () => client.entities.Customer.list('name', 500),
  });

  const { data: authDetailsData } = useQuery({
    queryKey: ['user-auth-details'],
    queryFn: () => client.users.getAuthDetails(),
  });
  const authDetails = authDetailsData?.details || {};

  const { data: signInsData, isLoading: isLoadingSignIns } = useQuery({
    queryKey: ['user-sign-ins', expandedUserId],
    queryFn: () => {
      const user = allUsers.find(u => u.id === expandedUserId);
      if (!user?.auth_id) return { sessions: [] };
      return client.users.getSignIns(user.auth_id);
    },
    enabled: !!expandedUserId,
  });

  const filteredUsers = allUsers.filter(u =>
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
    },
  });

  const resendInviteMutation = useMutation({
    mutationFn: (email) => client.users.resendInvite(email),
    onSuccess: () => toast.success('Invitation resent'),
    onError: (error) => toast.error('Failed to resend: ' + error.message),
  });

  const deleteUserMutation = useMutation({
    mutationFn: (userId) => client.entities.User.delete(userId),
    onSuccess: () => {
      toast.success('User deleted');
      queryClient.invalidateQueries({ queryKey: ['all-users'] });
    },
    onError: (error) => toast.error('Failed to delete: ' + error.message),
  });

  const handleRoleChange = (user, newRole) => {
    updateUserMutation.mutate({ userId: user.id, data: { role: newRole } });
  };

  const handleOrganizationChange = async (user, customerId) => {
    const customer = customers.find(c => c.id === customerId);
    updateUserMutation.mutate({
      userId: user.id,
      data: {
        customer_id: customerId === 'none' ? null : customerId,
        customer_name: customerId === 'none' ? null : customer?.name,
      },
    });
  };

  const handleInviteUser = async () => {
    if (!inviteEmail) return;
    setIsInviting(true);
    try {
      await client.users.inviteUser(
        inviteEmail,
        inviteType === 'customer' ? 'user' : inviteRole,
        inviteType,
        inviteType === 'customer' ? inviteCustomerId : undefined,
        inviteName
      );
      toast.success('Invitation sent to ' + inviteEmail);
      setInviteType(null);
      setInviteEmail('');
      setInviteName('');
      setInviteRole('admin');
      setInviteCustomerId('');
      queryClient.invalidateQueries({ queryKey: ['all-users'] });
    } catch (error) {
      toast.error('Failed to invite user: ' + error.message);
    } finally {
      setIsInviting(false);
    }
  };

  const getRoleBadge = (role) => {
    const config = ROLE_BADGES[role] || ROLE_BADGES.user;
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Role Permissions Reference */}
      <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5" /> Role Permissions
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-white rounded-lg border border-purple-100 p-3">
            <Badge className="bg-purple-100 text-purple-700 border-purple-200 mb-2">Admin</Badge>
            <p className="text-xs text-slate-600">Full access — Dashboard, Customers, LootIT, Integrations, Settings, User Management</p>
          </div>
          <div className="bg-white rounded-lg border border-blue-100 p-3">
            <Badge className="bg-blue-100 text-blue-700 border-blue-200 mb-2">Sales</Badge>
            <p className="text-xs text-slate-600">Dashboard, Customers, Billing, Quotes — no LootIT, Integrations, or Settings</p>
          </div>
          <div className="bg-white rounded-lg border border-green-100 p-3">
            <Badge className="bg-green-100 text-green-700 border-green-200 mb-2">Customer</Badge>
            <p className="text-xs text-slate-600">Own data only — Overview, Billing, Services, SaaS (can add/remove apps), Quotes, Tickets</p>
          </div>
        </div>
      </div>

      {/* Invite Buttons */}
      <div className="flex flex-wrap gap-3">
        <Button onClick={() => setInviteType('customer')} variant="outline" className="gap-2">
          <Building2 className="w-4 h-4" /> Invite Customer
        </Button>
        <Button onClick={() => setInviteType('tech')} className="bg-slate-900 hover:bg-slate-800 gap-2">
          <UserPlus className="w-4 h-4" /> Invite Tech
        </Button>
      </div>

      {/* User List */}
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
            <div className="p-8 text-center text-slate-500">
              <Users className="w-8 h-8 mx-auto mb-3 text-slate-300" />
              <p className="font-medium">No users found</p>
            </div>
          ) : (
            filteredUsers.map((user) => {
              const auth = authDetails[user.auth_id] || {};
              const status = getUserStatus(user, auth);
              const isExpanded = expandedUserId === user.id;
              const isOnline = auth.last_sign_in_at && (Date.now() - new Date(auth.last_sign_in_at).getTime()) < 86400000;

              return (
                <div key={user.id} className={cn(
                  'transition-all',
                  isExpanded ? 'bg-slate-50/50' : ''
                )}>
                  {/* User Row */}
                  <div
                    className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
                    onClick={() => setExpandedUserId(isExpanded ? null : user.id)}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="relative shrink-0">
                        <div className={cn(
                          'w-10 h-10 rounded-full flex items-center justify-center text-white font-medium text-sm',
                          user.role === 'admin' ? 'bg-purple-500' :
                          user.role === 'sales' ? 'bg-blue-500' :
                          'bg-green-500'
                        )}>
                          {(user.full_name?.charAt(0) || user.email?.charAt(0) || '?').toUpperCase()}
                        </div>
                        {status.label === 'Active' && isOnline && (
                          <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-slate-900 text-sm">{user.full_name || 'Unnamed User'}</p>
                          <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded border', status.color)}>
                            {status.label}
                          </span>
                          {getRoleBadge(user.role)}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          <p className="text-xs text-slate-500 truncate">{user.email}</p>
                          {auth.last_sign_in_at && (
                            <p className="text-[11px] text-slate-400 shrink-0 hidden sm:block">
                              Last seen {timeAgo(auth.last_sign_in_at)}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {/* Actions Menu */}
                      <div className="relative" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-400 hover:text-slate-700"
                          onClick={() => setActiveUserMenu(activeUserMenu === user.id ? null : user.id)}
                        >
                          <MoreVertical className="w-4 h-4" />
                        </Button>

                        {activeUserMenu === user.id && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setActiveUserMenu(null)} />
                            <div className="absolute right-0 top-9 z-50 w-52 bg-white rounded-xl border shadow-xl py-1.5 animate-in fade-in slide-in-from-top-2 duration-150">
                              {(status.label === 'Invited' || !auth.last_sign_in_at) && (
                                <button
                                  className="w-full px-3.5 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition-colors"
                                  onClick={() => {
                                    if (confirm(`Re-send invitation email to ${user.email}?`)) {
                                      resendInviteMutation.mutate(user.email);
                                    }
                                    setActiveUserMenu(null);
                                  }}
                                  disabled={resendInviteMutation.isPending}
                                >
                                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                                  Resend Invitation
                                </button>
                              )}
                              <button
                                className="w-full px-3.5 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition-colors"
                                onClick={() => {
                                  setActiveUserMenu(null);
                                }}
                              >
                                <Pencil className="w-3.5 h-3.5 text-slate-400" />
                                Edit Profile
                              </button>
                              {user.role !== 'admin' && (
                                <>
                                  <div className="border-t border-slate-100 my-1" />
                                  <button
                                    className="w-full px-3.5 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2.5 transition-colors"
                                    onClick={() => {
                                      if (confirm(`Remove ${user.full_name || user.email}? This deletes their account permanently.`)) {
                                        deleteUserMutation.mutate(user.id);
                                      }
                                      setActiveUserMenu(null);
                                    }}
                                    disabled={deleteUserMutation.isPending}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    Delete User
                                  </button>
                                </>
                              )}
                            </div>
                          </>
                        )}
                      </div>

                      <ChevronDown className={cn(
                        'w-4 h-4 text-slate-400 transition-transform duration-200',
                        isExpanded && 'rotate-180'
                      )} />
                    </div>
                  </div>

                  {/* Expanded Detail Panel */}
                  {isExpanded && (
                    <div className="border-t border-slate-100 bg-slate-50/60 animate-in fade-in slide-in-from-top-2 duration-200">
                      <div className="p-5 space-y-5">
                        {/* Account Details Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                          <div className="space-y-1">
                            <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider flex items-center gap-1">
                              <CalendarDays className="w-3 h-3" /> Created
                            </p>
                            <p className="text-sm font-medium text-slate-900">
                              {auth.created_at ? new Date(auth.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Unknown'}
                            </p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider flex items-center gap-1">
                              <LogIn className="w-3 h-3" /> Last Sign In
                            </p>
                            <p className="text-sm font-medium text-slate-900">
                              {auth.last_sign_in_at
                                ? new Date(auth.last_sign_in_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
                                : 'Never'}
                            </p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider flex items-center gap-1">
                              <UserCheck className="w-3 h-3" /> Email Verified
                            </p>
                            <p className="text-sm font-medium text-slate-900">
                              {auth.email_confirmed_at
                                ? new Date(auth.email_confirmed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                : <span className="text-amber-600">Not yet</span>}
                            </p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider flex items-center gap-1">
                              <Shield className="w-3 h-3" /> Auth Provider
                            </p>
                            <p className="text-sm font-medium text-slate-900 capitalize">
                              {auth.provider || 'Email'}
                            </p>
                          </div>
                        </div>

                        {/* Organization & Role Management */}
                        <div className="flex flex-wrap gap-3">
                          {user.role === 'user' && (
                            <div className="space-y-1">
                              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Organization</p>
                              <Select
                                value={user.customer_id || 'none'}
                                onValueChange={(value) => handleOrganizationChange(user, value)}
                              >
                                <SelectTrigger className="w-[200px]">
                                  <SelectValue placeholder="No Organization" />
                                </SelectTrigger>
                                <SelectContent className="max-h-[300px]">
                                  <SelectItem value="none">
                                    <span className="text-slate-400">No Organization</span>
                                  </SelectItem>
                                  {customers.map((customer) => (
                                    <SelectItem key={customer.id} value={customer.id}>
                                      <span className="truncate max-w-[140px] block">{customer.name}</span>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                          <div className="space-y-1">
                            <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Role</p>
                            <Select value={user.role || 'user'} onValueChange={(value) => handleRoleChange(user, value)}>
                              <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="user">Customer</SelectItem>
                                <SelectItem value="sales">Sales</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        {/* Sign-in Sessions */}
                        <div>
                          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                            <Wifi className="w-3.5 h-3.5" /> Recent Sessions
                          </h4>
                          {isLoadingSignIns ? (
                            <div className="text-center py-4">
                              <RefreshCw className="w-4 h-4 animate-spin mx-auto text-slate-400" />
                            </div>
                          ) : (signInsData?.sessions || []).length === 0 ? (
                            <p className="text-xs text-slate-400 italic py-2">No sign-in sessions found</p>
                          ) : (
                            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="bg-slate-50 border-b border-slate-100">
                                    <th className="text-left px-3 py-2 font-medium text-slate-500">Date</th>
                                    <th className="text-left px-3 py-2 font-medium text-slate-500">IP Address</th>
                                    <th className="text-left px-3 py-2 font-medium text-slate-500 hidden sm:table-cell">Device</th>
                                    <th className="text-left px-3 py-2 font-medium text-slate-500 hidden md:table-cell">Browser</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                  {(signInsData?.sessions || []).slice(0, 10).map((session, i) => {
                                    const { device, browser } = parseUA(session.user_agent);
                                    return (
                                      <tr key={i} className="hover:bg-slate-50/50">
                                        <td className="px-3 py-2 text-slate-700">
                                          {new Date(session.event_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                                        </td>
                                        <td className="px-3 py-2">
                                          <code className="text-[11px] bg-slate-100 px-1.5 py-0.5 rounded font-mono text-slate-700">
                                            {session.ip}
                                          </code>
                                        </td>
                                        <td className="px-3 py-2 text-slate-600 hidden sm:table-cell">
                                          <span className="flex items-center gap-1">
                                            {device === 'iPhone' || device === 'Android' ? <Smartphone className="w-3 h-3" /> : <Monitor className="w-3 h-3" />}
                                            {device}
                                          </span>
                                        </td>
                                        <td className="px-3 py-2 text-slate-600 hidden md:table-cell">{browser}</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

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
              <label className="text-sm font-medium text-slate-700">Full Name</label>
              <Input type="text" placeholder="John Smith" value={inviteName} onChange={(e) => setInviteName(e.target.value)} />
            </div>
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
            <Button onClick={handleInviteUser} disabled={!inviteName || !inviteEmail || !inviteCustomerId || isInviting} className="bg-green-600 hover:bg-green-700 gap-2">
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
              <label className="text-sm font-medium text-slate-700">Full Name</label>
              <Input type="text" placeholder="Jane Doe" value={inviteName} onChange={(e) => setInviteName(e.target.value)} />
            </div>
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
            <Button onClick={handleInviteUser} disabled={!inviteName || !inviteEmail || isInviting} className="bg-purple-600 hover:bg-purple-700 gap-2">
              <UserPlus className="w-4 h-4" /> {isInviting ? 'Sending...' : 'Send Invitation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
