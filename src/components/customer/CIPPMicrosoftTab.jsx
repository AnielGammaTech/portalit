import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { client } from '@/api/client';
import {
  Users,
  Mail,
  Shield,
  Search,
  CheckCircle2,
  XCircle,
  UserCheck,
  UserX,
  ChevronDown,
  Briefcase,
} from 'lucide-react';
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from 'date-fns';

const SUB_TABS = [
  { key: 'users', label: 'Users', icon: Users },
  { key: 'mailboxes', label: 'Shared Mailboxes', icon: Mail },
  { key: 'groups', label: 'Groups', icon: Shield },
];

export default function CIPPMicrosoftTab({ customerId }) {
  const [activeTab, setActiveTab] = useState('users');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const { data: users = [], isLoading: loadingUsers } = useQuery({
    queryKey: ['cipp-users', customerId],
    queryFn: () => client.entities.CIPPUser.filter({ customer_id: customerId }),
    enabled: !!customerId,
    staleTime: 1000 * 60 * 5,
  });

  const { data: mailboxes = [], isLoading: loadingMailboxes } = useQuery({
    queryKey: ['cipp-mailboxes', customerId],
    queryFn: () => client.entities.CIPPMailbox.filter({ customer_id: customerId }),
    enabled: !!customerId,
    staleTime: 1000 * 60 * 5,
  });

  const { data: groups = [], isLoading: loadingGroups } = useQuery({
    queryKey: ['cipp-groups', customerId],
    queryFn: () => client.entities.CIPPGroup.filter({ customer_id: customerId }),
    enabled: !!customerId,
    staleTime: 1000 * 60 * 5,
  });

  // Stats
  const stats = useMemo(() => {
    const activeUsers = users.filter(u => u.account_enabled === true);
    const disabledUsers = users.filter(u => u.account_enabled === false);
    const sharedMailboxes = mailboxes.filter(m => (m.mailbox_type || '').toLowerCase().includes('shared'));
    return {
      totalUsers: users.length,
      activeUsers: activeUsers.length,
      disabledUsers: disabledUsers.length,
      totalMailboxes: mailboxes.length,
      sharedMailboxes: sharedMailboxes.length,
      totalGroups: groups.length,
    };
  }, [users, mailboxes, groups]);

  // Filtered data
  const searchLower = search.toLowerCase();

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const matchesSearch = !search
        || (u.display_name || '').toLowerCase().includes(searchLower)
        || (u.mail || '').toLowerCase().includes(searchLower)
        || (u.user_principal_name || '').toLowerCase().includes(searchLower)
        || (u.department || '').toLowerCase().includes(searchLower);
      const matchesStatus = statusFilter === 'all'
        || (statusFilter === 'active' && u.account_enabled === true)
        || (statusFilter === 'disabled' && u.account_enabled === false);
      return matchesSearch && matchesStatus;
    });
  }, [users, search, searchLower, statusFilter]);

  const filteredMailboxes = useMemo(() => {
    return mailboxes.filter(m => {
      return !search
        || (m.display_name || '').toLowerCase().includes(searchLower)
        || (m.primary_smtp_address || '').toLowerCase().includes(searchLower);
    });
  }, [mailboxes, search, searchLower]);

  const filteredGroups = useMemo(() => {
    return groups.filter(g => {
      return !search
        || (g.display_name || '').toLowerCase().includes(searchLower)
        || (g.description || '').toLowerCase().includes(searchLower)
        || (g.mail || '').toLowerCase().includes(searchLower);
    });
  }, [groups, search, searchLower]);

  const isLoading = activeTab === 'users' ? loadingUsers
    : activeTab === 'mailboxes' ? loadingMailboxes
    : loadingGroups;

  return (
    <div className="space-y-4">
      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-3">
        {SUB_TABS.map(tab => {
          const count = tab.key === 'users' ? stats.totalUsers
            : tab.key === 'mailboxes' ? stats.totalMailboxes
            : stats.totalGroups;
          const subtitle = tab.key === 'users' ? `${stats.activeUsers} active`
            : tab.key === 'mailboxes' ? `${stats.sharedMailboxes} shared`
            : `${stats.totalGroups} total`;
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;

          return (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setSearch(''); setStatusFilter('all'); }}
              className={cn(
                "bg-white rounded-xl border-2 p-4 text-left transition-all hover:shadow-md",
                isActive ? "border-sky-400 shadow-md" : "border-slate-200 hover:border-slate-300"
              )}
            >
              <div className="flex items-center gap-2 mb-1">
                <div className={cn(
                  "w-7 h-7 rounded-lg flex items-center justify-center",
                  isActive ? "bg-sky-100" : "bg-slate-100"
                )}>
                  <Icon className={cn("w-4 h-4", isActive ? "text-sky-600" : "text-slate-500")} />
                </div>
                <span className="text-xs text-slate-500">{tab.label}</span>
              </div>
              <p className="text-xl font-bold text-slate-900"><AnimatedCounter value={count} /></p>
              <p className="text-xs text-slate-400">{subtitle}</p>
            </button>
          );
        })}
      </div>

      {/* Search & filters */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder={`Search ${activeTab}…`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        {activeTab === 'users' && (
          <div className="flex gap-1">
            {[
              { key: 'all', label: 'All' },
              { key: 'active', label: 'Active' },
              { key: 'disabled', label: 'Disabled' },
            ].map(f => (
              <button
                key={f.key}
                onClick={() => setStatusFilter(f.key)}
                className={cn(
                  "px-3 py-1.5 text-xs rounded-lg font-medium transition-colors",
                  statusFilter === f.key
                    ? "bg-sky-100 text-sky-700"
                    : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      )}

      {/* Users list */}
      {activeTab === 'users' && !loadingUsers && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {filteredUsers.length === 0 ? (
            <EmptyState icon={Users} title="No users found" description={search ? "Try a different search" : "No CIPP user data synced yet"} />
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredUsers.map(user => (
                <div key={user.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors">
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                    user.account_enabled ? "bg-sky-100 text-sky-700" : "bg-slate-100 text-slate-400"
                  )}>
                    {(user.display_name || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-slate-900 truncate">{user.display_name}</p>
                      {user.account_enabled ? (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-emerald-600 border-emerald-200">Active</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-slate-400 border-slate-200">Disabled</Badge>
                      )}
                      {user.user_type === 'Guest' && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-amber-600 border-amber-200">Guest</Badge>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 truncate">{user.mail || user.user_principal_name}</p>
                  </div>
                  <div className="text-right shrink-0 hidden sm:block">
                    {user.department && (
                      <p className="text-xs text-slate-500 flex items-center gap-1 justify-end">
                        <Briefcase className="w-3 h-3" />
                        {user.department}
                      </p>
                    )}
                    {user.job_title && (
                      <p className="text-[11px] text-slate-400">{user.job_title}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0 hidden md:block min-w-[80px]">
                    {user.last_sign_in && (
                      <p className="text-[10px] text-slate-400">
                        Last sign-in<br />
                        {format(new Date(user.last_sign_in), 'MMM d, yyyy')}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Mailboxes list */}
      {activeTab === 'mailboxes' && !loadingMailboxes && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {filteredMailboxes.length === 0 ? (
            <EmptyState icon={Mail} title="No mailboxes found" description={search ? "Try a different search" : "No CIPP mailbox data synced yet"} />
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredMailboxes.map(mb => (
                <div key={mb.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                    <Mail className="w-4 h-4 text-purple-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{mb.display_name}</p>
                    <p className="text-xs text-slate-400 truncate">{mb.primary_smtp_address}</p>
                  </div>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-purple-600 border-purple-200 capitalize shrink-0">
                    {(mb.mailbox_type || 'Unknown').replace(/Mailbox$/i, '')}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Groups list */}
      {activeTab === 'groups' && !loadingGroups && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {filteredGroups.length === 0 ? (
            <EmptyState icon={Shield} title="No groups found" description={search ? "Try a different search" : "No CIPP group data synced yet"} />
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredGroups.map(group => (
                <div key={group.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                    <Shield className="w-4 h-4 text-indigo-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-slate-900 truncate">{group.display_name}</p>
                      {group.group_type && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-indigo-600 border-indigo-200 capitalize shrink-0">
                          {group.group_type}
                        </Badge>
                      )}
                    </div>
                    {group.description && (
                      <p className="text-xs text-slate-400 truncate">{group.description}</p>
                    )}
                    {group.mail && (
                      <p className="text-xs text-slate-400 truncate">{group.mail}</p>
                    )}
                  </div>
                  {group.member_count != null && (
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-slate-700">{group.member_count}</p>
                      <p className="text-[10px] text-slate-400">members</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
