import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { client } from '@/api/client';
import {
  Users, Mail, Shield, Search, ChevronDown, ChevronRight,
  Briefcase, MapPin, Phone, Globe, Building2, Clock,
  KeyRound, X, Monitor, ShieldCheck, ShieldAlert, ShieldX,
  LogIn, Wifi, UserCheck, AlertTriangle,
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

const GROUP_TYPE_COLORS = {
  'Distribution List': 'text-blue-600 border-blue-200 bg-blue-50',
  'distributionList': 'text-blue-600 border-blue-200 bg-blue-50',
  'M365 Group': 'text-purple-600 border-purple-200 bg-purple-50',
  'microsoft365': 'text-purple-600 border-purple-200 bg-purple-50',
  'Mail-Enabled Security': 'text-amber-600 border-amber-200 bg-amber-50',
  'mailEnabledSecurity': 'text-amber-600 border-amber-200 bg-amber-50',
  'Security': 'text-slate-600 border-slate-200 bg-slate-50',
  'security': 'text-slate-600 border-slate-200 bg-slate-50',
};

function parseCachedData(raw) {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return {}; }
  }
  return raw;
}

// ── MFA Badge helper ────────────────────────────────────────────────
const MFA_CONFIG = {
  enforced: { icon: ShieldCheck, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200', label: 'MFA Enforced' },
  enabled: { icon: ShieldCheck, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200', label: 'MFA Enabled' },
  disabled: { icon: ShieldX, color: 'text-red-600', bg: 'bg-red-50 border-red-200', label: 'MFA Disabled' },
  unknown: { icon: ShieldAlert, color: 'text-slate-400', bg: 'bg-slate-50 border-slate-200', label: 'MFA Unknown' },
};

function getMfaConfig(status) {
  if (!status) return MFA_CONFIG.unknown;
  const s = String(status).toLowerCase();
  if (s.includes('enforced')) return MFA_CONFIG.enforced;
  if (s.includes('enabled')) return MFA_CONFIG.enabled;
  if (s.includes('disabled')) return MFA_CONFIG.disabled;
  return MFA_CONFIG.unknown;
}

// ── User Detail Drawer ──────────────────────────────────────────────
function UserDetailDrawer({ user, onClose }) {
  if (!user) return null;
  const cd = parseCachedData(user.cached_data);
  const licenses = (cd.licenses || '').split(',').map(l => l.trim()).filter(Boolean);
  const mfaCfg = getMfaConfig(cd.mfa_status);
  const MfaIcon = mfaCfg.icon;
  const mfaMethods = cd.mfa_methods || [];
  const signIn = cd.last_sign_in_details;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/20" />
      <div
        className="relative w-full max-w-md bg-white shadow-xl overflow-y-auto animate-in slide-in-from-right"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10">
          <h3 className="font-semibold text-slate-900">User Details</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center gap-4">
            <div className={cn(
              "w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold",
              user.account_enabled ? "bg-sky-100 text-sky-700" : "bg-slate-100 text-slate-400"
            )}>
              {(user.display_name || '?').charAt(0).toUpperCase()}
            </div>
            <div>
              <h4 className="text-lg font-semibold text-slate-900">{user.display_name}</h4>
              <p className="text-sm text-slate-500">{user.mail || user.user_principal_name}</p>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {user.account_enabled ? (
                  <Badge className="text-[10px] bg-emerald-100 text-emerald-700 border-0">Active</Badge>
                ) : (
                  <Badge className="text-[10px] bg-red-100 text-red-700 border-0">Disabled</Badge>
                )}
                <Badge className={cn("text-[10px] border", mfaCfg.bg, mfaCfg.color)}>{mfaCfg.label}</Badge>
                {user.user_type === 'Guest' && (
                  <Badge className="text-[10px] bg-amber-100 text-amber-700 border-0">Guest</Badge>
                )}
                {user.on_premises_sync_enabled && (
                  <Badge className="text-[10px] bg-blue-100 text-blue-700 border-0">Hybrid</Badge>
                )}
              </div>
            </div>
          </div>

          {/* MFA Section */}
          <div className={cn("rounded-lg border p-3", mfaCfg.bg)}>
            <div className="flex items-center gap-2 mb-1">
              <MfaIcon className={cn("w-4 h-4", mfaCfg.color)} />
              <span className={cn("text-xs font-semibold", mfaCfg.color)}>{mfaCfg.label}</span>
            </div>
            {mfaMethods.length > 0 ? (
              <div className="flex flex-wrap gap-1 mt-1">
                {mfaMethods.map((m, i) => (
                  <Badge key={i} variant="outline" className="text-[10px] bg-white/60">
                    {typeof m === 'string' ? m : m['@odata.type']?.replace('#microsoft.graph.', '') || 'Auth Method'}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-[10px] text-slate-500">No MFA methods registered</p>
            )}
          </div>

          {/* Last Sign-In Section */}
          {signIn && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center gap-2 mb-2">
                <LogIn className="w-4 h-4 text-slate-500" />
                <span className="text-xs font-semibold text-slate-600">Last Sign-In (30 days)</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {signIn.date && (
                  <div>
                    <p className="text-[10px] text-slate-400">When</p>
                    <p className="text-slate-700">{format(new Date(signIn.date), 'MMM d, yyyy h:mm a')}</p>
                  </div>
                )}
                {signIn.app && (
                  <div>
                    <p className="text-[10px] text-slate-400">App</p>
                    <p className="text-slate-700 truncate">{signIn.app}</p>
                  </div>
                )}
                {signIn.ip && (
                  <div>
                    <p className="text-[10px] text-slate-400">IP</p>
                    <p className="text-slate-700">{signIn.ip}</p>
                  </div>
                )}
                {signIn.location && (
                  <div>
                    <p className="text-[10px] text-slate-400">Location</p>
                    <p className="text-slate-700 truncate">{signIn.location}</p>
                  </div>
                )}
                {signIn.status && (
                  <div>
                    <p className="text-[10px] text-slate-400">Status</p>
                    <Badge className={cn("text-[10px]",
                      signIn.status === 'success' ? "bg-emerald-100 text-emerald-700 border-0" : "bg-red-100 text-red-700 border-0"
                    )}>
                      {signIn.status === 'success' ? 'Success' : 'Failed'}
                    </Badge>
                  </div>
                )}
              </div>
              {signIn.error && signIn.status !== 'success' && (
                <p className="text-[10px] text-red-500 mt-1">Error: {signIn.error}</p>
              )}
            </div>
          )}

          {/* Info Grid */}
          <div className="grid grid-cols-1 gap-3">
            {user.job_title && (
              <InfoRow icon={Briefcase} label="Job Title" value={user.job_title} />
            )}
            {user.department && (
              <InfoRow icon={Building2} label="Department" value={user.department} />
            )}
            {cd.manager && (
              <InfoRow icon={UserCheck} label="Manager" value={cd.manager} />
            )}
            {cd.office_location && (
              <InfoRow icon={MapPin} label="Office" value={cd.office_location} />
            )}
            {cd.company_name && (
              <InfoRow icon={Building2} label="Company" value={cd.company_name} />
            )}
            {(cd.city || cd.state) && (
              <InfoRow icon={Globe} label="Location" value={[cd.city, cd.state, cd.country].filter(Boolean).join(', ')} />
            )}
            {cd.usage_location && (
              <InfoRow icon={Globe} label="Usage Location" value={cd.usage_location} />
            )}
            {cd.mobile_phone && (
              <InfoRow icon={Phone} label="Mobile" value={cd.mobile_phone} />
            )}
            {cd.business_phones?.length > 0 && (
              <InfoRow icon={Phone} label="Business Phone" value={cd.business_phones.join(', ')} />
            )}
            {user.created_date_time && (
              <InfoRow icon={Clock} label="Created" value={format(new Date(user.created_date_time), 'MMM d, yyyy')} />
            )}
            {user.last_sign_in && !signIn && (
              <InfoRow icon={Clock} label="Last Sign-In" value={format(new Date(user.last_sign_in), 'MMM d, yyyy h:mm a')} />
            )}
            {cd.on_premises_domain && (
              <InfoRow icon={Monitor} label="On-Prem Domain" value={cd.on_premises_domain} />
            )}
            {cd.on_premises_last_sync && (
              <InfoRow icon={Clock} label="Last AD Sync" value={format(new Date(cd.on_premises_last_sync), 'MMM d, yyyy h:mm a')} />
            )}
          </div>

          {/* Licenses */}
          {licenses.length > 0 ? (
            <div>
              <h5 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5" /> Assigned Licenses ({licenses.length})
              </h5>
              <div className="space-y-1">
                {licenses.map((lic, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg text-xs text-slate-700">
                    <div className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                    {lic}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-4 bg-amber-50 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-amber-400 mx-auto mb-1" />
              <p className="text-xs text-amber-600 font-medium">No licenses assigned</p>
            </div>
          )}

          {/* Aliases */}
          {cd.aliases && cd.aliases.length > 0 && (
            <div>
              <h5 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" /> Email Aliases
              </h5>
              <div className="space-y-1">
                {(Array.isArray(cd.aliases) ? cd.aliases : (cd.aliases || '').split(',').filter(Boolean)).map((alias, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-lg text-xs text-slate-600">
                    <Mail className="w-3 h-3 text-slate-400" />
                    {alias.trim()}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3 text-sm">
      <Icon className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
      <div>
        <p className="text-[10px] uppercase tracking-wide text-slate-400">{label}</p>
        <p className="text-slate-700">{value}</p>
      </div>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────
export default function CIPPMicrosoftTab({ customerId }) {
  const [activeTab, setActiveTab] = useState('users');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedUser, setSelectedUser] = useState(null);
  const [expandedGroup, setExpandedGroup] = useState(null);

  const { data: usersRaw = [], isLoading: loadingUsers } = useQuery({
    queryKey: ['cipp-users', customerId],
    queryFn: () => client.entities.CIPPUser.filter({ customer_id: customerId }),
    enabled: !!customerId,
    staleTime: 1000 * 60 * 5,
  });
  const users = usersRaw ?? [];

  const { data: mailboxesRaw = [], isLoading: loadingMailboxes } = useQuery({
    queryKey: ['cipp-mailboxes', customerId],
    queryFn: () => client.entities.CIPPMailbox.filter({ customer_id: customerId }),
    enabled: !!customerId,
    staleTime: 1000 * 60 * 5,
  });
  const mailboxes = mailboxesRaw ?? [];

  const { data: groupsRaw = [], isLoading: loadingGroups } = useQuery({
    queryKey: ['cipp-groups', customerId],
    queryFn: () => client.entities.CIPPGroup.filter({ customer_id: customerId }),
    enabled: !!customerId,
    staleTime: 1000 * 60 * 5,
  });
  const groups = groupsRaw ?? [];

  const stats = useMemo(() => ({
    totalUsers: users.length,
    activeUsers: users.filter(u => u.account_enabled === true).length,
    licensedUsers: users.filter(u => {
      const cd = parseCachedData(u.cached_data);
      return cd.licenses && cd.licenses.length > 0;
    }).length,
    totalMailboxes: mailboxes.length,
    sharedMailboxes: mailboxes.filter(m => (m.mailbox_type || '').toLowerCase().includes('shared')).length,
    totalGroups: groups.length,
  }), [users, mailboxes, groups]);

  const searchLower = search.toLowerCase();

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const cd = parseCachedData(u.cached_data);
      const matchesSearch = !search
        || (u.display_name || '').toLowerCase().includes(searchLower)
        || (u.mail || '').toLowerCase().includes(searchLower)
        || (u.user_principal_name || '').toLowerCase().includes(searchLower)
        || (u.department || '').toLowerCase().includes(searchLower)
        || (u.job_title || '').toLowerCase().includes(searchLower)
        || (cd.licenses || '').toLowerCase().includes(searchLower);
      const matchesStatus = statusFilter === 'all'
        || (statusFilter === 'active' && u.account_enabled === true)
        || (statusFilter === 'disabled' && u.account_enabled === false)
        || (statusFilter === 'licensed' && cd.licenses && cd.licenses.length > 0)
        || (statusFilter === 'unlicensed' && (!cd.licenses || cd.licenses.length === 0));
      return matchesSearch && matchesStatus;
    });
  }, [users, search, searchLower, statusFilter]);

  const filteredMailboxes = useMemo(() => {
    return mailboxes.filter(m =>
      !search
      || (m.display_name || '').toLowerCase().includes(searchLower)
      || (m.primary_smtp_address || '').toLowerCase().includes(searchLower)
    );
  }, [mailboxes, search, searchLower]);

  const filteredGroups = useMemo(() => {
    return groups.filter(g =>
      !search
      || (g.display_name || '').toLowerCase().includes(searchLower)
      || (g.description || '').toLowerCase().includes(searchLower)
      || (g.mail || '').toLowerCase().includes(searchLower)
    );
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
          const subtitle = tab.key === 'users' ? `${stats.activeUsers} active · ${stats.licensedUsers} licensed`
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
                <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center", isActive ? "bg-sky-100" : "bg-slate-100")}>
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
              { key: 'licensed', label: 'Licensed' },
              { key: 'unlicensed', label: 'Unlicensed' },
            ].map(f => (
              <button
                key={f.key}
                onClick={() => setStatusFilter(f.key)}
                className={cn(
                  "px-3 py-1.5 text-xs rounded-lg font-medium transition-colors",
                  statusFilter === f.key ? "bg-sky-100 text-sky-700" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
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
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      )}

      {/* ── Users ──────────────────────────────────────────────────── */}
      {activeTab === 'users' && !loadingUsers && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {filteredUsers.length === 0 ? (
            <EmptyState icon={Users} title="No users found" description={search ? "Try a different search" : "No CIPP user data synced yet"} />
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredUsers.map(user => {
                const cd = parseCachedData(user.cached_data);
                const licenses = (cd.licenses || '').split(',').map(l => l.trim()).filter(Boolean);
                const hasLicense = licenses.length > 0;
                const mfaCfg = getMfaConfig(cd.mfa_status);
                const MfaIcon = mfaCfg.icon;

                return (
                  <button
                    key={user.id}
                    onClick={() => setSelectedUser(user)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left"
                  >
                    <div className={cn(
                      "w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                      user.account_enabled ? "bg-sky-100 text-sky-700" : "bg-slate-100 text-slate-400"
                    )}>
                      {(user.display_name || '?').charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-slate-900 truncate">{user.display_name}</p>
                        {user.account_enabled ? (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                        ) : (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-red-500 border-red-200 shrink-0">Disabled</Badge>
                        )}
                        {user.user_type === 'Guest' && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0 text-amber-600 border-amber-200">Guest</Badge>
                        )}
                        <MfaIcon className={cn("w-3.5 h-3.5 shrink-0", mfaCfg.color)} title={mfaCfg.label} />
                      </div>
                      <p className="text-xs text-slate-400 truncate">{user.mail || user.user_principal_name}</p>
                    </div>
                    <div className="text-right shrink-0 hidden sm:block max-w-[200px]">
                      {hasLicense ? (
                        <p className="text-[11px] text-sky-600 font-medium truncate">{licenses[0]}</p>
                      ) : (
                        <p className="text-[11px] text-slate-300">No license</p>
                      )}
                      {licenses.length > 1 && (
                        <p className="text-[10px] text-slate-400">+{licenses.length - 1} more</p>
                      )}
                    </div>
                    <div className="text-right shrink-0 hidden md:block min-w-[70px]">
                      {user.department && (
                        <p className="text-[11px] text-slate-500 truncate">{user.department}</p>
                      )}
                      {user.job_title && (
                        <p className="text-[10px] text-slate-400 truncate">{user.job_title}</p>
                      )}
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Mailboxes ──────────────────────────────────────────────── */}
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
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-purple-600 border-purple-200 shrink-0">
                    {(mb.mailbox_type || 'Unknown').replace(/Mailbox$/i, '').replace(/([A-Z])/g, ' $1').trim()}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Groups ─────────────────────────────────────────────────── */}
      {activeTab === 'groups' && !loadingGroups && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {filteredGroups.length === 0 ? (
            <EmptyState icon={Shield} title="No groups found" description={search ? "Try a different search" : "No CIPP group data synced yet"} />
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredGroups.map(group => {
                const cd = parseCachedData(group.cached_data);
                const members = cd.members || [];
                const isExpanded = expandedGroup === group.id;
                const typeColor = GROUP_TYPE_COLORS[group.group_type] || 'text-slate-600 border-slate-200 bg-slate-50';

                return (
                  <div key={group.id}>
                    <button
                      onClick={() => setExpandedGroup(isExpanded ? null : group.id)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left"
                    >
                      <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                        <Shield className="w-4 h-4 text-indigo-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-slate-900 truncate">{group.display_name}</p>
                          <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 shrink-0", typeColor)}>
                            {group.group_type}
                          </Badge>
                          {cd.teams_enabled && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-violet-600 border-violet-200 shrink-0">Teams</Badge>
                          )}
                        </div>
                        {group.mail && (
                          <p className="text-xs text-slate-400 truncate">{group.mail}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="text-right">
                          <p className="text-sm font-semibold text-slate-700">{members.length}</p>
                          <p className="text-[10px] text-slate-400">members</p>
                        </div>
                        <ChevronDown className={cn("w-4 h-4 text-slate-400 transition-transform", isExpanded && "rotate-180")} />
                      </div>
                    </button>

                    {/* Expanded members */}
                    {isExpanded && (
                      <div className="px-4 pb-3">
                        <div className="bg-slate-50 rounded-lg p-3">
                          {group.description && (
                            <p className="text-xs text-slate-500 mb-3 italic">{group.description}</p>
                          )}
                          {members.length === 0 ? (
                            <p className="text-xs text-slate-400 text-center py-2">No members</p>
                          ) : (
                            <div className="space-y-1">
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5">
                                Members ({members.length})
                              </p>
                              {members.filter(Boolean).map((member, i) => (
                                <div key={i} className="flex items-center gap-2 text-xs text-slate-700 py-1">
                                  <div className="w-6 h-6 rounded-full bg-white border border-slate-200 flex items-center justify-center text-[10px] font-medium text-slate-500 shrink-0">
                                    {(member || '?').charAt(0).toUpperCase()}
                                  </div>
                                  <span className="truncate">{member}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* User Detail Drawer */}
      {selectedUser && (
        <UserDetailDrawer user={selectedUser} onClose={() => setSelectedUser(null)} />
      )}
    </div>
  );
}
