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
  Loader2,
  Crown,
  Ban,
  Unlock,
  AlertCircle,
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Shimmer } from "@/components/ui/shimmer-skeleton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const ROLE_BADGES = {
  admin: { label: 'Admin', className: 'bg-purple-100 text-purple-700 border-purple-200' },
  sales: { label: 'Sales', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  user:  { label: 'Customer', className: 'bg-green-100 text-green-700 border-green-200' },
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  if (!user.auth_id) {
    return { label: 'Needs setup', key: 'needs-review', color: 'text-red-700 bg-red-50 border-red-200' };
  }
  if (auth.banned_until) {
    return { label: 'Suspended', key: 'suspended', color: 'text-red-700 bg-red-50 border-red-200' };
  }
  if (!auth.last_sign_in_at) {
    return { label: 'Pending', key: 'pending', color: 'text-amber-700 bg-amber-50 border-amber-200' };
  }
  return { label: 'Active', key: 'active', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
}

function getStatusKey(user, auth = {}) {
  return getUserStatus(user, auth).key;
}

function CompanyPicker({ customers, value, onSelect, placeholder = "Search and select company..." }) {
  const [open, setOpen] = useState(false);
  const selected = customers.find(c => c.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-between h-10 font-normal">
          {selected ? (
            <span className="flex items-center gap-2 truncate">
              <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
              {selected.name}
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search companies..." className="h-9" />
          <CommandList>
            <CommandEmpty>No companies found.</CommandEmpty>
            <CommandGroup className="max-h-60 overflow-y-auto">
              {customers.map(c => (
                <CommandItem
                  key={c.id}
                  value={c.name}
                  onSelect={() => { onSelect(c.id); setOpen(false); }}
                  className="text-sm"
                >
                  <Building2 className="w-3.5 h-3.5 mr-2 text-slate-400" />
                  <span className="truncate">{c.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function UserSkeletonRows({ count = 5 }) {
  return (
    <div className="divide-y divide-slate-100">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="px-4 py-3 flex items-center gap-3">
          <Shimmer className="w-10 h-10 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <Shimmer className="h-4 w-32 rounded" />
              <Shimmer className="h-4 w-16 rounded" />
            </div>
            <Shimmer className="h-3 w-48 rounded" />
          </div>
          <Shimmer className="h-4 w-4 rounded shrink-0" />
        </div>
      ))}
    </div>
  );
}

function UserRow({
  user,
  auth,
  isExpanded,
  isOnline,
  status,
  expandedUserId,
  setExpandedUserId,
  activeUserMenu,
  setActiveUserMenu,
  openEditProfile,
  resendInviteMutation,
  deleteUserMutation,
  suspendUserMutation,
  unsuspendUserMutation,
  getRoleBadge,
  onResetPassword,
}) {
  const isSuspended = status.key === 'suspended';
  const canSuspend = user.role !== 'admin' && user.auth_id;

  return (
    <div className={cn('transition-all', isExpanded ? 'bg-slate-50/50' : '')}>
      <div
        className="px-4 py-3 grid grid-cols-1 gap-3 cursor-pointer hover:bg-slate-50 transition-colors lg:grid-cols-[minmax(260px,1fr)_150px_minmax(180px,240px)_150px_72px] lg:items-center"
        onClick={() => setExpandedUserId(isExpanded ? null : user.id)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative shrink-0">
            <div className={cn(
              'w-9 h-9 rounded-full flex items-center justify-center text-white font-medium text-sm',
              user.role === 'admin' ? 'bg-purple-500' :
              user.role === 'sales' ? 'bg-blue-500' :
              'bg-green-500'
            )}>
              {(user.full_name?.charAt(0) || user.email?.charAt(0) || '?').toUpperCase()}
            </div>
            {status.key === 'active' && isOnline && (
              <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-slate-900 text-sm truncate">{user.full_name || 'Unnamed User'}</p>
            <p className="text-xs text-slate-500 truncate">{user.email}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {getRoleBadge(user.role)}
          <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded border', status.color)}>
            {status.label}
          </span>
        </div>

        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold lg:hidden">Scope</p>
          {user.role === 'user' ? (
            user.customer_name ? (
              <span className="inline-flex max-w-full items-center gap-1 text-xs font-medium text-slate-700">
                <Building2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                <span className="truncate">{user.customer_name}</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600">
                <AlertCircle className="w-3.5 h-3.5" />
                No company assigned
              </span>
            )
          ) : (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600">
              <Shield className="w-3.5 h-3.5 text-purple-500" />
              Internal team
            </span>
          )}
        </div>

        <div>
          <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold lg:hidden">Last seen</p>
          <p className="text-xs font-medium text-slate-700">
            {auth.last_sign_in_at ? timeAgo(auth.last_sign_in_at) : 'Never'}
          </p>
          {auth.last_sign_in_at && (
            <p className="text-[11px] text-slate-400 hidden sm:block">
              {new Date(auth.last_sign_in_at).toLocaleDateString()}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 shrink-0">
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
                  {(status.key === 'pending' || status.key === 'needs-review') && (
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
                    onClick={() => openEditProfile(user)}
                  >
                    <Pencil className="w-3.5 h-3.5 text-slate-400" />
                    Edit Profile
                  </button>
                  {user.auth_id && (
                    <button
                      className="w-full px-3.5 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition-colors"
                      onClick={() => { onResetPassword(user); setActiveUserMenu(null); }}
                    >
                      <KeyRound className="w-3.5 h-3.5 text-slate-400" />
                      Reset Password
                    </button>
                  )}
                  {canSuspend && (
                    <button
                      className="w-full px-3.5 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition-colors"
                      onClick={() => {
                        if (isSuspended) {
                          unsuspendUserMutation.mutate(user.id);
                        } else if (confirm(`Suspend ${user.full_name || user.email}? They will not be able to sign in until reactivated.`)) {
                          suspendUserMutation.mutate(user.id);
                        }
                        setActiveUserMenu(null);
                      }}
                      disabled={suspendUserMutation.isPending || unsuspendUserMutation.isPending}
                    >
                      {isSuspended ? <Unlock className="w-3.5 h-3.5 text-slate-400" /> : <Ban className="w-3.5 h-3.5 text-slate-400" />}
                      {isSuspended ? 'Reactivate User' : 'Suspend User'}
                    </button>
                  )}
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
    </div>
  );
}

export default function UserAssignmentPanel() {
  const queryClient = useQueryClient();
  const [activeDirectory, setActiveDirectory] = useState('team');
  const [statusFilter, setStatusFilter] = useState('all');
  const [customerFilter, setCustomerFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [inviteType, setInviteType] = useState(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('admin');
  const [inviteName, setInviteName] = useState('');
  const [inviteCustomerId, setInviteCustomerId] = useState('');
  const [expandedUserId, setExpandedUserId] = useState(null);
  const [activeUserMenu, setActiveUserMenu] = useState(null);
  const [isInviting, setIsInviting] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [editName, setEditName] = useState('');
  const [editAvatarUrl, setEditAvatarUrl] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [resetPasswordUser, setResetPasswordUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');

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

  const teamAll = allUsers.filter(u => u.role === 'admin' || u.role === 'sales');
  const customerAll = allUsers.filter(u => u.role === 'user');
  const activeBaseUsers = activeDirectory === 'team' ? teamAll : customerAll;
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredDirectoryUsers = activeBaseUsers.filter((u) => {
    const auth = authDetails[u.auth_id] || {};
    const matchesSearch = !normalizedSearch ||
      u.full_name?.toLowerCase().includes(normalizedSearch) ||
      u.email?.toLowerCase().includes(normalizedSearch) ||
      u.customer_name?.toLowerCase().includes(normalizedSearch);
    const matchesStatus = statusFilter === 'all' || getStatusKey(u, auth) === statusFilter;
    const matchesCustomer = activeDirectory !== 'customers' || customerFilter === 'all' || u.customer_id === customerFilter;
    return matchesSearch && matchesStatus && matchesCustomer;
  });

  const summary = allUsers.reduce((acc, u) => {
    const auth = authDetails[u.auth_id] || {};
    const statusKey = getStatusKey(u, auth);
    if (u.role === 'admin') acc.admins += 1;
    if (u.role === 'sales') acc.sales += 1;
    if (u.role === 'user') {
      acc.customers += 1;
      if (u.customer_id) acc.customerCompanies.add(u.customer_id);
      else acc.reviewUserIds.add(u.id);
    }
    if (statusKey === 'pending') acc.pending += 1;
    if (statusKey === 'suspended') acc.suspended += 1;
    if (statusKey === 'pending' || statusKey === 'suspended' || statusKey === 'needs-review') {
      acc.reviewUserIds.add(u.id);
    }
    return acc;
  }, {
    admins: 0,
    sales: 0,
    customers: 0,
    customerCompanies: new Set(),
    pending: 0,
    suspended: 0,
    reviewUserIds: new Set(),
  });
  const needsReviewCount = summary.reviewUserIds.size;
  const customerFilterOptions = customers.filter(c => customerAll.some(u => u.customer_id === c.id));
  const inviteEmailValid = EMAIL_RE.test(inviteEmail.trim());

  const updateUserMutation = useMutation({
    mutationFn: async ({ userId, data }) => {
      await client.users.updateUser(userId, data);
    },
    onSuccess: () => {
      toast.success('User updated');
      queryClient.invalidateQueries({ queryKey: ['all-users'] });
      queryClient.invalidateQueries({ queryKey: ['user-auth-details'] });
    },
    onError: (error) => {
      toast.error('Failed to update user: ' + error.message);
    },
  });

  const resendInviteMutation = useMutation({
    mutationFn: (email) => client.users.resendInvite(email),
    onSuccess: () => toast.success('Invitation email resent'),
    onError: (error) => toast.error('Failed to resend: ' + error.message),
  });

  const deleteUserMutation = useMutation({
    mutationFn: (userId) => client.users.deleteUser(userId),
    onSuccess: () => {
      toast.success('User deleted');
      queryClient.invalidateQueries({ queryKey: ['all-users'] });
      queryClient.invalidateQueries({ queryKey: ['user-auth-details'] });
    },
    onError: (error) => toast.error('Failed to delete: ' + error.message),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: ({ userId, password }) => client.users.resetPassword(userId, password),
    onSuccess: (data) => {
      toast.success(data.method === 'email'
        ? `Password reset email sent to ${data.email}`
        : `Password updated for ${data.email}`
      );
      setResetPasswordUser(null);
      setNewPassword('');
    },
    onError: (error) => toast.error('Failed to reset password: ' + error.message),
  });

  const suspendUserMutation = useMutation({
    mutationFn: (userId) => client.users.suspendUser(userId),
    onSuccess: () => {
      toast.success('User suspended');
      queryClient.invalidateQueries({ queryKey: ['user-auth-details'] });
    },
    onError: (error) => toast.error('Failed to suspend: ' + error.message),
  });

  const unsuspendUserMutation = useMutation({
    mutationFn: (userId) => client.users.unsuspendUser(userId),
    onSuccess: () => {
      toast.success('User reactivated');
      queryClient.invalidateQueries({ queryKey: ['user-auth-details'] });
    },
    onError: (error) => toast.error('Failed to reactivate: ' + error.message),
  });

  const handleRoleChange = (user, newRole) => {
    const existingIsCustomer = user.role === 'user';
    const nextIsCustomer = newRole === 'user';
    if (existingIsCustomer !== nextIsCustomer) {
      toast.error('Customer users and internal team members must be invited separately.');
      return;
    }
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
    const cleanEmail = inviteEmail.trim().toLowerCase();
    const cleanName = inviteName.trim();
    if (!cleanEmail || !cleanName) return;
    if (!EMAIL_RE.test(cleanEmail)) {
      toast.error('Enter a valid email address');
      return;
    }
    if (inviteType === 'customer' && !inviteCustomerId) {
      toast.error('Select the customer company first');
      return;
    }
    setIsInviting(true);
    try {
      const result = await client.users.inviteUser(
        cleanEmail,
        inviteType === 'customer' ? 'user' : inviteRole,
        inviteType,
        inviteType === 'customer' ? inviteCustomerId : undefined,
        cleanName
      );
      if (result.email_sent === false) {
        toast.warning(`User was created, but the invitation email did not send. Try Resend Invitation for ${cleanEmail}.`);
      } else {
        toast.success('Invitation sent to ' + cleanEmail);
      }
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

  const openEditProfile = (user) => {
    setEditingUser(user);
    setEditName(user.full_name || '');
    setEditAvatarUrl(user.avatar_url || '');
    setActiveUserMenu(null);
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const { file_url } = await client.integrations.Core.UploadFile({ file });
      setEditAvatarUrl(file_url);
      toast.success('Avatar uploaded');
    } catch (error) {
      toast.error('Failed to upload avatar: ' + error.message);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!editingUser) return;
    try {
      await client.users.updateUser(editingUser.id, {
        full_name: editName,
        avatar_url: editAvatarUrl || null,
      });
      toast.success('Profile updated');
      queryClient.invalidateQueries({ queryKey: ['all-users'] });
      setEditingUser(null);
    } catch (error) {
      toast.error('Failed to update: ' + error.message);
    }
  };

  const getRoleBadge = (role) => {
    const config = ROLE_BADGES[role] || ROLE_BADGES.user;
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  const renderExpandedPanel = (user) => {
    const auth = authDetails[user.auth_id] || {};

    return (
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
                <div className="w-[240px]">
                  <CompanyPicker
                    customers={[{ id: 'none', name: 'No Organization' }, ...customers]}
                    value={user.customer_id || 'none'}
                    onSelect={(value) => handleOrganizationChange(user, value)}
                    placeholder="Select organization..."
                  />
                </div>
              </div>
            )}
            {user.role !== 'user' ? (
              <div className="space-y-1">
                <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Internal Role</p>
                <Select value={user.role || 'sales'} onValueChange={(value) => handleRoleChange(user, value)}>
                  <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sales">Sales</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-1">
                <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Access Type</p>
                <div className="h-10 px-3 rounded-md border border-slate-200 bg-white flex items-center text-sm font-medium text-green-700">
                  Customer portal
                </div>
              </div>
            )}
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
    );
  };

  const renderUserList = (users, emptyMessage) => {
    if (users.length === 0) {
      return (
        <div className="p-8 text-center text-slate-500">
          <Users className="w-8 h-8 mx-auto mb-3 text-slate-300" />
          <p className="font-medium">{emptyMessage}</p>
        </div>
      );
    }

    return (
      <div className="divide-y divide-slate-100">
        {users.map((user) => {
          const auth = authDetails[user.auth_id] || {};
          const status = getUserStatus(user, auth);
          const isExpanded = expandedUserId === user.id;
          const isOnline = auth.last_sign_in_at && (Date.now() - new Date(auth.last_sign_in_at).getTime()) < 86400000;

          return (
            <div key={user.id}>
              <UserRow
                user={user}
                auth={auth}
                isExpanded={isExpanded}
                isOnline={isOnline}
                status={status}
                expandedUserId={expandedUserId}
                setExpandedUserId={setExpandedUserId}
                activeUserMenu={activeUserMenu}
                setActiveUserMenu={setActiveUserMenu}
                openEditProfile={openEditProfile}
                resendInviteMutation={resendInviteMutation}
                deleteUserMutation={deleteUserMutation}
                suspendUserMutation={suspendUserMutation}
                unsuspendUserMutation={unsuspendUserMutation}
                getRoleBadge={getRoleBadge}
                onResetPassword={(u) => { setResetPasswordUser(u); setNewPassword(''); }}
              />
              {isExpanded && renderExpandedPanel(user)}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Internal team</p>
          <p className="mt-1 text-2xl font-bold text-slate-950">{teamAll.length}</p>
          <p className="text-xs text-slate-500">{summary.admins} admin · {summary.sales} sales</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Customer users</p>
          <p className="mt-1 text-2xl font-bold text-slate-950">{summary.customers}</p>
          <p className="text-xs text-slate-500">{summary.customerCompanies.size} companies</p>
        </div>
        <div className={cn(
          "rounded-xl border bg-white px-4 py-3",
          needsReviewCount > 0 ? "border-amber-200 bg-amber-50/50" : "border-slate-200"
        )}>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Needs review</p>
          <p className="mt-1 text-2xl font-bold text-slate-950">{needsReviewCount}</p>
          <p className="text-xs text-slate-500">pending, suspended, or incomplete</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Invitations</p>
          <p className="mt-1 text-2xl font-bold text-slate-950">{summary.pending}</p>
          <p className="text-xs text-slate-500">never signed in</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
            <button
              type="button"
              onClick={() => { setActiveDirectory('team'); setStatusFilter('all'); setCustomerFilter('all'); setExpandedUserId(null); }}
              className={cn(
                'inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition-colors',
                activeDirectory === 'team' ? 'bg-slate-950 text-white shadow-sm' : 'text-slate-600 hover:text-slate-950'
              )}
            >
              <Shield className="w-4 h-4" />
              Internal Team
              <span className={cn('rounded-full px-1.5 text-[11px]', activeDirectory === 'team' ? 'bg-white/20' : 'bg-white text-slate-500')}>
                {teamAll.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => { setActiveDirectory('customers'); setStatusFilter('all'); setExpandedUserId(null); }}
              className={cn(
                'inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition-colors',
                activeDirectory === 'customers' ? 'bg-slate-950 text-white shadow-sm' : 'text-slate-600 hover:text-slate-950'
              )}
            >
              <Building2 className="w-4 h-4" />
              Customer Users
              <span className={cn('rounded-full px-1.5 text-[11px]', activeDirectory === 'customers' ? 'bg-white/20' : 'bg-white text-slate-500')}>
                {customerAll.length}
              </span>
            </button>
          </div>

          <div className="flex gap-2 ml-auto">
            <Button onClick={() => setInviteType('customer')} variant="outline" className="gap-2">
              <Building2 className="w-4 h-4" /> Invite Customer
            </Button>
            <Button onClick={() => setInviteType('tech')} className="bg-slate-900 hover:bg-slate-800 gap-2">
              <UserPlus className="w-4 h-4" /> Invite Team
            </Button>
          </div>
        </div>

        <div className="p-4 border-b border-slate-100 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(260px,1fr)_180px_minmax(180px,240px)]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder={activeDirectory === 'team' ? 'Search team by name or email...' : 'Search customers, email, or company...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="pending">Pending invite</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
              <SelectItem value="needs-review">Needs setup</SelectItem>
            </SelectContent>
          </Select>
          {activeDirectory === 'customers' ? (
            <Select value={customerFilter} onValueChange={setCustomerFilter}>
              <SelectTrigger><SelectValue placeholder="All companies" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All companies</SelectItem>
                {customerFilterOptions.map((customer) => (
                  <SelectItem key={customer.id} value={customer.id}>{customer.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="hidden lg:flex items-center rounded-md border border-slate-200 bg-slate-50 px-3 text-xs text-slate-500">
              Team roles are limited to Admin and Sales.
            </div>
          )}
        </div>

        <div className="hidden lg:grid grid-cols-[minmax(260px,1fr)_150px_minmax(180px,240px)_150px_72px] gap-3 px-4 py-2 border-b border-slate-100 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          <span>User</span>
          <span>Access</span>
          <span>{activeDirectory === 'team' ? 'Scope' : 'Company'}</span>
          <span>Last seen</span>
          <span className="text-right">Actions</span>
        </div>

        {loadingUsers ? (
          <UserSkeletonRows count={activeDirectory === 'team' ? 4 : 7} />
        ) : (
          renderUserList(
            filteredDirectoryUsers,
            activeDirectory === 'team' ? 'No internal team members found' : 'No customer users found'
          )
        )}
      </div>

      {/* Invite Customer Dialog */}
      <Dialog open={inviteType === 'customer'} onOpenChange={(open) => !open && setInviteType(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex justify-center mb-2">
              <div className="w-12 h-12 rounded-2xl bg-green-100 flex items-center justify-center">
                <Building2 className="w-6 h-6 text-green-600" />
              </div>
            </div>
            <DialogTitle className="text-center">Invite Customer User</DialogTitle>
            <DialogDescription className="text-center">
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
              <CompanyPicker
                customers={customers}
                value={inviteCustomerId}
                onSelect={setInviteCustomerId}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteType(null)}>Cancel</Button>
            <Button onClick={handleInviteUser} disabled={!inviteName.trim() || !inviteEmailValid || !inviteCustomerId || isInviting} className="bg-green-600 hover:bg-green-700 gap-2">
              <UserPlus className="w-4 h-4" /> {isInviting ? 'Sending...' : 'Send Invitation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite Tech Dialog */}
      <Dialog open={inviteType === 'tech'} onOpenChange={(open) => !open && setInviteType(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex justify-center mb-2">
              <div className="w-12 h-12 rounded-2xl bg-purple-100 flex items-center justify-center">
                <Shield className="w-6 h-6 text-purple-600" />
              </div>
            </div>
            <DialogTitle className="text-center">Invite Internal Team Member</DialogTitle>
            <DialogDescription className="text-center">
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
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setInviteRole('admin')}
                  className={cn(
                    'rounded-xl border-2 p-3 text-left transition-all',
                    inviteRole === 'admin'
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-slate-200 hover:border-slate-300'
                  )}
                >
                  <Crown className="w-4 h-4 text-purple-500 mb-1" />
                  <span className="text-sm font-semibold block">Admin</span>
                  <p className="text-[11px] text-slate-500">Full access to everything</p>
                </button>
                <button
                  type="button"
                  onClick={() => setInviteRole('sales')}
                  className={cn(
                    'rounded-xl border-2 p-3 text-left transition-all',
                    inviteRole === 'sales'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-200 hover:border-slate-300'
                  )}
                >
                  <Briefcase className="w-4 h-4 text-blue-500 mb-1" />
                  <span className="text-sm font-semibold block">Sales</span>
                  <p className="text-[11px] text-slate-500">Customers, billing & quotes</p>
                </button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteType(null)}>Cancel</Button>
            <Button onClick={handleInviteUser} disabled={!inviteName.trim() || !inviteEmailValid || isInviting} className="bg-purple-600 hover:bg-purple-700 gap-2">
              <UserPlus className="w-4 h-4" /> {isInviting ? 'Sending...' : 'Send Invitation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={!!resetPasswordUser} onOpenChange={(open) => { if (!open) { setResetPasswordUser(null); setNewPassword(''); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Reset password for {resetPasswordUser?.full_name || resetPasswordUser?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1.5 block">New Password</label>
              <Input
                type="password"
                autoComplete="new-password"
                placeholder="Enter new password (min 8 characters)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <p className="text-xs text-slate-400 mt-1">Leave empty to send a reset email instead.</p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setResetPasswordUser(null); setNewPassword(''); }}>
              Cancel
            </Button>
            <Button
              onClick={() => resetPasswordMutation.mutate({ userId: resetPasswordUser?.id, password: newPassword || undefined })}
              disabled={resetPasswordMutation.isPending || (newPassword && newPassword.length < 8)}
            >
              {resetPasswordMutation.isPending ? (
                <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />{newPassword ? 'Setting...' : 'Sending...'}</>
              ) : (
                <><KeyRound className="w-3.5 h-3.5 mr-1.5" />{newPassword ? 'Set Password' : 'Send Reset Email'}</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Profile Dialog */}
      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex justify-center mb-2">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center">
                <Pencil className="w-6 h-6 text-slate-600" />
              </div>
            </div>
            <DialogTitle className="text-center">Edit Profile</DialogTitle>
            <DialogDescription className="text-center">
              Update name and avatar for {editingUser?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            {/* Avatar */}
            <div className="flex flex-col items-center gap-3">
              <div className="relative">
                {editAvatarUrl ? (
                  <img
                    src={editAvatarUrl}
                    alt="Avatar"
                    className="w-20 h-20 rounded-full object-cover border-2 border-slate-200"
                  />
                ) : (
                  <div className={cn(
                    'w-20 h-20 rounded-full flex items-center justify-center text-white font-bold text-2xl',
                    editingUser?.role === 'admin' ? 'bg-purple-500' :
                    editingUser?.role === 'sales' ? 'bg-blue-500' :
                    'bg-green-500'
                  )}>
                    {(editingUser?.full_name?.charAt(0) || editingUser?.email?.charAt(0) || '?').toUpperCase()}
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarUpload}
                    disabled={uploadingAvatar}
                  />
                  <span className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors',
                    uploadingAvatar
                      ? 'bg-slate-100 text-slate-400 cursor-wait'
                      : 'bg-white text-slate-700 hover:bg-slate-50 cursor-pointer'
                  )}>
                    {uploadingAvatar ? (
                      <><Loader2 className="w-3 h-3 animate-spin" /> Uploading...</>
                    ) : (
                      'Upload Photo'
                    )}
                  </span>
                </label>
                {editAvatarUrl && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-red-500 hover:text-red-600 h-8"
                    onClick={() => setEditAvatarUrl('')}
                  >
                    Remove
                  </Button>
                )}
              </div>
            </div>

            {/* Name */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Full Name</label>
              <Input
                type="text"
                placeholder="Full name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>

            {/* Email (read-only) */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Email</label>
              <Input
                type="email"
                value={editingUser?.email || ''}
                disabled
                className="bg-slate-50 text-slate-500"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)}>Cancel</Button>
            <Button
              onClick={handleSaveProfile}
              disabled={!editName.trim()}
              className="bg-slate-900 hover:bg-slate-800 gap-2"
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
