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
  Loader2,
  Crown,
  Globe,
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
  getRoleBadge,
}) {
  return (
    <div className={cn('transition-all', isExpanded ? 'bg-slate-50/50' : '')}>
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
              {user.role === 'user' && user.customer_name && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-green-50 text-green-700 border border-green-200 rounded-full px-2 py-0.5 shrink-0">
                  <Building2 className="w-3 h-3" />
                  {user.customer_name}
                </span>
              )}
              {auth.last_sign_in_at && (
                <p className="text-[11px] text-slate-400 shrink-0 hidden sm:block">
                  Last seen {timeAgo(auth.last_sign_in_at)}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
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
                    onClick={() => openEditProfile(user)}
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
    </div>
  );
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
  const [editingUser, setEditingUser] = useState(null);
  const [editName, setEditName] = useState('');
  const [editAvatarUrl, setEditAvatarUrl] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

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
    u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.customer_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const teamUsers = filteredUsers.filter(u => u.role === 'admin' || u.role === 'sales');
  const customerUsers = filteredUsers.filter(u => u.role === 'user');

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
      await client.entities.User.update(editingUser.id, {
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
                getRoleBadge={getRoleBadge}
              />
              {isExpanded && renderExpandedPanel(user)}
            </div>
          );
        })}
      </div>
    );
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

      {/* Top Bar: Search + Invite Buttons */}
      <div className="flex flex-wrap items-center gap-3">
        {allUsers.length > 3 && (
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input placeholder="Search users..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
          </div>
        )}
        <div className="flex gap-3 ml-auto">
          <Button onClick={() => setInviteType('customer')} variant="outline" className="gap-2">
            <Building2 className="w-4 h-4" /> Invite Customer
          </Button>
          <Button onClick={() => setInviteType('tech')} className="bg-slate-900 hover:bg-slate-800 gap-2">
            <UserPlus className="w-4 h-4" /> Invite Tech
          </Button>
        </div>
      </div>

      {/* Loading Skeletons */}
      {loadingUsers && (
        <>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center gap-2">
              <Shimmer className="h-5 w-16 rounded" />
              <Shimmer className="h-5 w-10 rounded-full" />
            </div>
            <UserSkeletonRows count={3} />
          </div>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center gap-2">
              <Shimmer className="h-5 w-32 rounded" />
              <Shimmer className="h-5 w-10 rounded-full" />
            </div>
            <UserSkeletonRows count={4} />
          </div>
        </>
      )}

      {/* Team Section */}
      {!loadingUsers && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <Shield className="w-4 h-4 text-purple-500" />
              Team
            </h3>
            <Badge variant="secondary">{teamUsers.length}</Badge>
          </div>
          {renderUserList(teamUsers, 'No team members found')}
        </div>
      )}

      {/* Customer Users Section */}
      {!loadingUsers && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-green-500" />
              Customer Users
            </h3>
            <Badge variant="secondary">{customerUsers.length}</Badge>
          </div>
          {renderUserList(customerUsers, 'No customer users found')}
        </div>
      )}

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
            <div className="flex justify-center mb-2">
              <div className="w-12 h-12 rounded-2xl bg-purple-100 flex items-center justify-center">
                <Shield className="w-6 h-6 text-purple-600" />
              </div>
            </div>
            <DialogTitle className="text-center">Invite Tech Team Member</DialogTitle>
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
            <Button onClick={handleInviteUser} disabled={!inviteName || !inviteEmail || isInviting} className="bg-purple-600 hover:bg-purple-700 gap-2">
              <UserPlus className="w-4 h-4" /> {isInviting ? 'Sending...' : 'Send Invitation'}
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
