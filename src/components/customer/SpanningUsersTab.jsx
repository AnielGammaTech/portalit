import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { client } from '@/api/client';
import { motion } from 'framer-motion';
import { staggerContainer, staggerItem, fadeInUp } from '@/lib/motion';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Users,
  Archive,
  Mail,
  CheckCircle2,
  RefreshCw,
  Search,
  ChevronLeft,
  ChevronRight,
  X,
  Globe,
  MessageSquare,
  Calendar,
  Database,
  Cloud,
  Shield,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const ITEMS_PER_PAGE = 15;

const LICENSE_GROUPS = [
  {
    key: 'standard',
    label: 'Standard users',
    icon: Users,
    protectedKey: 'numberOfProtectedStandardUsers',
    totalKey: 'numberOfStandardLicensesTotal',
    color: 'text-cyan-700',
    bar: 'bg-cyan-500',
    bg: 'bg-cyan-50',
    border: 'border-cyan-100'
  },
  {
    key: 'archived',
    label: 'Archived users',
    icon: Archive,
    protectedKey: 'numberOfProtectedArchivedUsers',
    totalKey: 'numberOfArchivedLicensesTotal',
    color: 'text-violet-700',
    bar: 'bg-violet-500',
    bg: 'bg-violet-50',
    border: 'border-violet-100'
  },
  {
    key: 'shared',
    label: 'Shared mailboxes',
    icon: Mail,
    protectedKey: 'numberOfProtectedSharedMailboxes',
    totalKey: 'numberOfSharedMailboxesTotal',
    color: 'text-sky-700',
    bar: 'bg-sky-500',
    bg: 'bg-sky-50',
    border: 'border-sky-100'
  },
  {
    key: 'sharepoint',
    label: 'SharePoint sites',
    icon: Globe,
    protectedKey: 'numberOfProtectedSharePointSites',
    unprotectedKey: 'numberOfUnprotectedSharePointSites',
    color: 'text-emerald-700',
    bar: 'bg-emerald-500',
    bg: 'bg-emerald-50',
    border: 'border-emerald-100'
  },
  {
    key: 'teams',
    label: 'Teams channels',
    icon: MessageSquare,
    protectedKey: 'numberOfProtectedTeamChannels',
    unprotectedKey: 'numberOfUnprotectedTeamChannels',
    color: 'text-indigo-700',
    bar: 'bg-indigo-500',
    bg: 'bg-indigo-50',
    border: 'border-indigo-100'
  }
];

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function getPercent(part, total) {
  const safePart = toNumber(part);
  const safeTotal = toNumber(total);
  if (safeTotal <= 0) return safePart > 0 ? 100 : 0;
  return Math.min(100, Math.round((safePart / safeTotal) * 100));
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function formatDateTime(value) {
  const date = parseDate(value);
  if (!date) return 'Unknown';
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

function formatShortDate(value) {
  const date = parseDate(value);
  if (!date) return 'Unknown';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatRelativeTime(value) {
  const date = parseDate(value);
  if (!date) return 'Unknown';
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.max(0, Math.round(diffMs / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function humanizeStatus(status) {
  const raw = String(status || '').trim();
  if (!raw) return 'Unknown';
  return raw
    .replace(/[_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, letter => letter.toUpperCase());
}

function getStatusMeta(status, options = {}) {
  const raw = String(status || '').trim();
  const normalized = raw.toLowerCase();

  if (options.unprotected || normalized.includes('not_protected') || normalized.includes('not protected') || normalized.includes('unprotected')) {
    return {
      label: 'Not protected',
      className: 'bg-slate-50 text-slate-600 border-slate-200',
      dot: 'bg-slate-400'
    };
  }

  if (normalized.includes('success') || normalized.includes('healthy')) {
    return {
      label: 'Healthy',
      className: 'bg-green-50 text-green-700 border-green-200',
      dot: 'bg-green-500'
    };
  }

  if (normalized.includes('fail') || normalized.includes('error') || normalized.includes('miss')) {
    return {
      label: 'Review',
      className: 'bg-rose-50 text-rose-700 border-rose-200',
      dot: 'bg-rose-500'
    };
  }

  if (normalized.includes('warn') || normalized.includes('partial')) {
    return {
      label: 'Partial',
      className: 'bg-amber-50 text-amber-700 border-amber-200',
      dot: 'bg-amber-500'
    };
  }

  if (options.assigned) {
    return {
      label: 'Assigned',
      className: 'bg-cyan-50 text-cyan-700 border-cyan-200',
      dot: 'bg-cyan-500'
    };
  }

  if (normalized.includes('protected')) {
    return {
      label: 'Protected',
      className: 'bg-green-50 text-green-700 border-green-200',
      dot: 'bg-green-500'
    };
  }

  return {
    label: humanizeStatus(raw),
    className: 'bg-slate-50 text-slate-600 border-slate-200',
    dot: 'bg-slate-400'
  };
}

function getUserKind(user) {
  const type = String(user?.userType || 'standard').toLowerCase();
  if (type.includes('archiv')) return 'archived';
  if (type.includes('shared')) return 'shared';
  return 'standard';
}

function getInitials(user) {
  const label = user?.displayName || user?.email || '?';
  return label
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('') || '?';
}

function StatCard({ icon: Icon, label, value, detail, tone = 'cyan' }) {
  const toneClasses = {
    cyan: 'text-cyan-700 bg-cyan-50',
    green: 'text-green-700 bg-green-50',
    violet: 'text-violet-700 bg-violet-50',
    slate: 'text-slate-700 bg-slate-100'
  };

  return (
    <motion.div
      variants={staggerItem}
      className="min-w-0 p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
          <div className="min-h-[32px]">
            {typeof value === 'number' ? (
              <AnimatedCounter value={value} className="text-2xl font-bold tabular-nums text-slate-950" />
            ) : (
              <p className="truncate text-2xl font-bold tabular-nums text-slate-950">{value || '-'}</p>
            )}
          </div>
          {detail && <p className="truncate text-xs text-slate-500">{detail}</p>}
        </div>
        <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', toneClasses[tone] || toneClasses.cyan)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </motion.div>
  );
}

function DetailTile({ icon: Icon, label, value, detail, tone = 'slate' }) {
  const toneClasses = {
    slate: 'bg-slate-50 text-slate-600 border-slate-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    violet: 'bg-violet-50 text-violet-700 border-violet-200'
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-center gap-3">
        <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border', toneClasses[tone] || toneClasses.slate)}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
          <p className="truncate text-sm font-semibold text-slate-950">{value || '-'}</p>
          {detail && <p className="truncate text-xs text-slate-500">{detail}</p>}
        </div>
      </div>
    </div>
  );
}

function StatusPill({ status, assigned, unprotected }) {
  const meta = getStatusMeta(status, { assigned, unprotected });
  return (
    <Badge variant="outline" className={cn('gap-1.5 text-[11px]', meta.className)}>
      <span className={cn('w-1.5 h-1.5 rounded-full', meta.dot)} />
      {meta.label}
    </Badge>
  );
}

function LicenseRow({ group, stats, fallbackProtected, fallbackTotal }) {
  const Icon = group.icon;
  const protectedCount = toNumber(stats[group.protectedKey]) || fallbackProtected || 0;
  const unprotectedCount = group.unprotectedKey ? toNumber(stats[group.unprotectedKey]) : 0;
  const totalFromStats = group.totalKey ? toNumber(stats[group.totalKey]) : protectedCount + unprotectedCount;
  const totalCount = totalFromStats || fallbackTotal || protectedCount || 0;
  const percent = getPercent(protectedCount, totalCount);
  const isEmpty = protectedCount === 0 && totalCount === 0;

  return (
    <div className={cn(
      'flex min-h-[58px] items-center justify-between gap-3 border-b border-slate-100 px-3 py-3 last:border-b-0 hover:bg-slate-50/80',
      isEmpty && 'opacity-60'
    )}>
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white">
          <Icon className={cn('h-4 w-4', group.color)} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">{group.label}</p>
          <p className="text-xs text-slate-500">
            {protectedCount} protected
            {totalCount > 0 && <span> of {totalCount}</span>}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Badge variant="outline" className={cn(
          'text-[11px] font-semibold',
          percent === 100
            ? 'border-green-200 bg-green-50 text-green-700'
            : 'border-amber-200 bg-amber-50 text-amber-700'
        )}>
          {percent}%
        </Badge>
      </div>
    </div>
  );
}

function StorageLine({ icon: Icon, label, value, percent, className }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', className)}>
            <Icon className="w-4 h-4" />
          </div>
          <span className="text-sm font-medium text-slate-700 truncate">{label}</span>
        </div>
        <span className="text-sm font-semibold text-slate-900">{value}</span>
      </div>
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
        <div className={cn('h-full rounded-full', className)} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

export default function SpanningUsersTab({ customerId, spanningMapping, queryClient, canSync = false }) {
  const [syncingSpanning, setSyncingSpanning] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [userTypeFilter, setUserTypeFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState(null);

  const cachedStats = useMemo(() => {
    if (!spanningMapping?.cached_data) return null;
    const data = typeof spanningMapping.cached_data === 'string'
      ? (() => { try { return JSON.parse(spanningMapping.cached_data); } catch { return null; } })()
      : spanningMapping.cached_data;
    if (!data) return null;
    return { ...data, fromCache: true, last_synced: spanningMapping.last_synced };
  }, [spanningMapping?.cached_data, spanningMapping?.last_synced]);

  const { data: liveSpanningData, refetch, isFetching } = useQuery({
    queryKey: ['spanning-live-users', customerId],
    queryFn: () => client.functions.invoke('syncSpanningBackup', {
      action: 'list_users',
      customer_id: customerId
    }),
    enabled: false,
    staleTime: 5 * 60 * 1000
  });

  const spanningData = liveSpanningData || cachedStats;

  const { data: contacts = [] } = useQuery({
    queryKey: ['customer-contacts', customerId],
    queryFn: () => client.entities.Contact.filter({ customer_id: customerId }),
    enabled: !!customerId
  });

  const contactsByEmail = useMemo(() => {
    const map = {};
    contacts.forEach(contact => {
      if (contact.email) map[contact.email.toLowerCase()] = contact;
    });
    return map;
  }, [contacts]);

  const handleSyncSpanning = async () => {
    if (!canSync) return;
    setSyncingSpanning(true);
    try {
      const result = await refetch();
      if (result.data?.success) {
        queryClient?.invalidateQueries({ queryKey: ['spanning-mapping', customerId] });
        queryClient?.invalidateQueries({ queryKey: ['spanning-contacts', customerId] });
        queryClient?.invalidateQueries({ queryKey: ['spanning-licenses', customerId] });
        toast.success('Spanning data synced');
      } else {
        toast.error(result.data?.error || 'Sync failed');
      }
    } catch (error) {
      toast.error(error.message || 'Failed to sync Spanning data');
    } finally {
      setSyncingSpanning(false);
    }
  };

  if (!spanningData && !cachedStats) {
    return (
      <EmptyState
        icon={Cloud}
        title="No Spanning data"
        description="No cached Spanning data is available yet."
        action={canSync ? { label: 'Sync from Spanning', onClick: handleSyncSpanning } : undefined}
      />
    );
  }

  const stats = spanningData || {};
  const users = Array.isArray(stats.users) ? stats.users : [];
  const standardUsers = users.filter(user => getUserKind(user) === 'standard');
  const archivedUsers = users.filter(user => getUserKind(user) === 'archived');
  const sharedUsers = users.filter(user => getUserKind(user) === 'shared');
  const protectedRows = users.filter(user => user.isProtected).length;

  const protectedStandardFallback = standardUsers.filter(user => user.isProtected).length;
  const protectedArchivedFallback = archivedUsers.filter(user => user.isProtected).length;
  const protectedSharedFallback = sharedUsers.filter(user => user.isProtected).length;

  const totalUsers = toNumber(stats.numberOfUsers) || users.length;
  const totalProtected = toNumber(stats.numberOfProtectedUsers) || protectedRows;
  const coveragePercent = getPercent(totalProtected, totalUsers);

  const domainName = stats.domainName || spanningMapping?.spanning_tenant_name || 'Mapped tenant';
  const domainId = stats.domainId || spanningMapping?.spanning_tenant_id;
  const lastSynced = stats.last_synced || spanningMapping?.last_synced;
  const lastBackup = stats.lastBackupTimestamp;
  const syncing = syncingSpanning || isFetching;

  const filteredUsers = users
    .filter(user => {
      const kind = getUserKind(user);
      if (userTypeFilter !== 'all' && kind !== userTypeFilter) return false;
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return [
        user.email,
        user.displayName,
        user.backupStatus,
        user.userType
      ].some(value => String(value || '').toLowerCase().includes(term));
    })
    .sort((a, b) => (b.totalStorageBytes || 0) - (a.totalStorageBytes || 0));

  const totalPages = Math.ceil(filteredUsers.length / ITEMS_PER_PAGE);
  const safeCurrentPage = totalPages > 0 ? Math.min(currentPage, totalPages) : 1;
  const paginatedUsers = filteredUsers.slice(
    (safeCurrentPage - 1) * ITEMS_PER_PAGE,
    safeCurrentPage * ITEMS_PER_PAGE
  );

  const filterTabs = [
    { key: 'all', label: 'All users', count: users.length },
    { key: 'standard', label: 'Standard', count: standardUsers.length },
    { key: 'archived', label: 'Archived', count: archivedUsers.length },
    { key: 'shared', label: 'Shared', count: sharedUsers.length }
  ];

  const userCoverageGroups = LICENSE_GROUPS.filter(group => ['standard', 'archived', 'shared'].includes(group.key));
  const collaborationCoverageGroups = LICENSE_GROUPS.filter(group => ['sharepoint', 'teams'].includes(group.key));

  const renderLicenseRow = (group) => {
    const fallbackProtected = group.key === 'standard'
      ? protectedStandardFallback
      : group.key === 'archived'
        ? protectedArchivedFallback
        : group.key === 'shared'
          ? protectedSharedFallback
          : 0;
    const fallbackTotal = group.key === 'standard'
      ? standardUsers.length
      : group.key === 'archived'
        ? archivedUsers.length
        : group.key === 'shared'
          ? sharedUsers.length
          : 0;

    return (
      <LicenseRow
        key={group.key}
        group={group}
        stats={stats}
        fallbackProtected={fallbackProtected}
        fallbackTotal={fallbackTotal}
      />
    );
  };

  return (
    <div className="space-y-5">
      <motion.section {...fadeInUp} className="overflow-hidden rounded-xl border border-slate-200 bg-card shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50/80 px-5 py-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-green-200 bg-green-50">
                <Shield className="h-5 w-5 text-green-700" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-semibold text-slate-950">Spanning Backup</h3>
                  {stats.fromCache && <Badge variant="outline" className="bg-white text-xs">Cached</Badge>}
                  <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">
                    {coveragePercent}% protected
                  </Badge>
                </div>
                <p className="mt-1 truncate text-sm text-slate-600">
                  {domainName}
                  {stats.origin && <span> - {stats.origin}</span>}
                  {domainId && <span> - Tenant {domainId}</span>}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {lastSynced ? `Synced ${formatDateTime(lastSynced)}` : 'No sync timestamp available'}
                  {lastBackup ? ` - Last backup ${formatRelativeTime(lastBackup)}` : ''}
                </p>
              </div>
            </div>
            {canSync && (
              <Button onClick={handleSyncSpanning} disabled={syncing} variant="outline" className="gap-2 self-start bg-white">
                {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                {syncing ? 'Syncing...' : 'Sync Spanning'}
              </Button>
            )}
          </div>
        </div>

        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="grid grid-cols-2 divide-x divide-y divide-slate-100 lg:grid-cols-4 lg:divide-y-0"
        >
          <StatCard
            icon={Shield}
            label="Protected users"
            value={totalProtected}
            detail={`${totalUsers} total users`}
            tone="green"
          />
          <StatCard
            icon={Users}
            label="Standard licenses"
            value={toNumber(stats.numberOfProtectedStandardUsers) || protectedStandardFallback}
            detail={`${toNumber(stats.numberOfStandardLicensesTotal) || standardUsers.length} total`}
            tone="cyan"
          />
          <StatCard
            icon={Globe}
            label="SharePoint sites"
            value={toNumber(stats.numberOfProtectedSharePointSites)}
            detail={`${toNumber(stats.numberOfUnprotectedSharePointSites)} unprotected`}
            tone="violet"
          />
          <StatCard
            icon={Database}
            label="Protected data"
            value={stats.totalProtectedStorage || '0 B'}
            detail={`${stats.totalUsedStorage || '0 B'} used`}
            tone="slate"
          />
        </motion.div>

        <div className="border-t border-slate-200 px-5 py-5">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h4 className="font-semibold text-slate-950">Protection coverage</h4>
              <p className="text-sm text-slate-500">Microsoft 365 users, mailboxes, sites, and collaboration data reported by Spanning.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              <div className="border-b border-slate-100 bg-slate-50 px-3 py-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Users and mailboxes</p>
              </div>
              {userCoverageGroups.map(renderLicenseRow)}
            </div>
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              <div className="border-b border-slate-100 bg-slate-50 px-3 py-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sites and collaboration</p>
              </div>
              {collaborationCoverageGroups.map(renderLicenseRow)}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
            <DetailTile
              icon={Database}
              label="Storage protected"
              value={stats.totalProtectedStorage || '0 B'}
              detail={`${stats.totalUsedStorage || '0 B'} total used data`}
            />
            {lastBackup && (
              <DetailTile
                icon={CheckCircle2}
                label="Last backup"
                value={formatShortDate(lastBackup)}
                detail={formatDateTime(lastBackup)}
                tone="green"
              />
            )}
            <DetailTile
              icon={Calendar}
              label="Subscription"
              value={formatShortDate(stats.expirationDate)}
              detail="Expiration date from Spanning"
              tone="violet"
            />
          </div>
        </div>
      </motion.section>

      <motion.div {...fadeInUp} className="rounded-lg border bg-card p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search users, email, or backup status"
              value={searchTerm}
              onChange={(event) => { setSearchTerm(event.target.value); setCurrentPage(1); }}
              className="pl-9 pr-9"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {filterTabs.map(tab => (
            <button
              key={tab.key}
              type="button"
              onClick={() => { setUserTypeFilter(tab.key); setCurrentPage(1); }}
              className={cn(
                'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                userTypeFilter === tab.key
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              )}
            >
              {tab.label}
              <span className={cn(
                'ml-1.5 text-xs',
                userTypeFilter === tab.key ? 'text-white/70' : 'text-slate-400'
              )}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </motion.div>

      <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="font-semibold text-slate-900">Protected user inventory</h4>
            <p className="text-sm text-slate-500">Showing {filteredUsers.length} of {users.length} Spanning users.</p>
          </div>
          <Badge variant="outline">{totalProtected} protected</Badge>
        </div>

        {users.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No users found"
            description="The Spanning sync returned counts but no user rows."
            action={canSync ? { label: 'Sync from Spanning', onClick: handleSyncSpanning } : undefined}
          />
        ) : filteredUsers.length === 0 ? (
          <EmptyState
            icon={Search}
            title="No matching users"
            description="Try a different search or filter."
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>User</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Backup</TableHead>
                    <TableHead className="text-right hidden lg:table-cell">Mail</TableHead>
                    <TableHead className="text-right hidden lg:table-cell">Drive</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedUsers.map((user, index) => {
                    const email = user.email?.toLowerCase();
                    const matchedContact = email ? contactsByEmail[email] : null;
                    const kind = getUserKind(user);
                    return (
                      <TableRow
                        key={user.email || index}
                        className="cursor-pointer hover:bg-slate-50"
                        onClick={() => setSelectedUser({ ...user, contact: matchedContact })}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={cn(
                              'w-9 h-9 rounded-full flex items-center justify-center font-semibold text-sm flex-shrink-0',
                              kind === 'archived'
                                ? 'bg-violet-50 text-violet-700'
                                : kind === 'shared'
                                  ? 'bg-sky-50 text-sky-700'
                                  : 'bg-cyan-50 text-cyan-700'
                            )}>
                              {getInitials(user)}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-slate-900 truncate">{user.displayName || 'Unknown user'}</p>
                              <p className="text-xs text-slate-500 truncate">{user.email || 'No email returned'}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-[11px]',
                              kind === 'archived'
                                ? 'bg-violet-50 text-violet-700 border-violet-200'
                                : kind === 'shared'
                                  ? 'bg-sky-50 text-sky-700 border-sky-200'
                                  : 'bg-cyan-50 text-cyan-700 border-cyan-200'
                            )}
                          >
                            {kind === 'archived' ? 'Archived' : kind === 'shared' ? 'Shared' : 'Standard'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <StatusPill
                            status={user.backupStatus}
                            assigned={user.isProtected}
                            unprotected={!user.isProtected}
                          />
                        </TableCell>
                        <TableCell className="text-right hidden lg:table-cell">
                          <span className="font-mono text-sm text-slate-500">{user.mailStorage || '0 B'}</span>
                        </TableCell>
                        <TableCell className="text-right hidden lg:table-cell">
                          <span className="font-mono text-sm text-slate-500">{user.driveStorage || '0 B'}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="font-mono text-sm font-semibold text-slate-900">{user.totalStorage || '0 B'}</span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
                <p className="text-sm text-slate-500">
                  Showing {(safeCurrentPage - 1) * ITEMS_PER_PAGE + 1}-{Math.min(safeCurrentPage * ITEMS_PER_PAGE, filteredUsers.length)} of {filteredUsers.length}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(page => Math.max(1, page - 1))}
                    disabled={safeCurrentPage === 1}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-sm text-slate-500">
                    Page {safeCurrentPage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(page => Math.min(totalPages, page + 1))}
                    disabled={safeCurrentPage === totalPages}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Spanning backup user</DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-full bg-cyan-100 flex items-center justify-center text-cyan-800 font-bold text-lg flex-shrink-0">
                      {getInitials(selectedUser)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 truncate">{selectedUser.displayName || 'Unknown user'}</p>
                      <p className="text-sm text-slate-500 truncate">{selectedUser.email || 'No email returned'}</p>
                    </div>
                  </div>
                  <StatusPill
                    status={selectedUser.backupStatus}
                    assigned={selectedUser.isProtected}
                    unprotected={!selectedUser.isProtected}
                  />
                </div>
                <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">User type</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900 capitalize">{getUserKind(selectedUser)}</p>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Protected storage</p>
                    <p className="text-xs text-slate-500">Mailbox and OneDrive data reported by Spanning.</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-slate-900">{selectedUser.totalStorage || '0 B'}</p>
                    <p className="text-xs text-slate-500">Total</p>
                  </div>
                </div>
                <div className="mt-4 space-y-4">
                  <StorageLine
                    icon={Mail}
                    label="Mail"
                    value={selectedUser.mailStorage || '0 B'}
                    percent={getPercent(selectedUser.mailStorageBytes, selectedUser.totalStorageBytes)}
                    className="bg-cyan-500 text-white"
                  />
                  <StorageLine
                    icon={Database}
                    label="Drive"
                    value={selectedUser.driveStorage || '0 B'}
                    percent={getPercent(selectedUser.driveStorageBytes, selectedUser.totalStorageBytes)}
                    className="bg-violet-500 text-white"
                  />
                </div>
              </div>

              {selectedUser.contact ? (
                <div className="rounded-xl border border-green-200 bg-green-50 p-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-700 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900">Matched to HaloPSA contact</p>
                      <div className="mt-2 text-sm text-slate-600 space-y-1">
                        <p><strong className="text-slate-900">Name:</strong> {selectedUser.contact.full_name}</p>
                        {selectedUser.contact.title && <p><strong className="text-slate-900">Title:</strong> {selectedUser.contact.title}</p>}
                        {selectedUser.contact.phone && <p><strong className="text-slate-900">Phone:</strong> {selectedUser.contact.phone}</p>}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex items-start gap-3">
                    <Users className="w-5 h-5 text-slate-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-slate-900">No HaloPSA contact match</p>
                      <p className="mt-1 text-sm text-slate-500">This Spanning user exists, but no contact with this email was found in HaloPSA.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}
