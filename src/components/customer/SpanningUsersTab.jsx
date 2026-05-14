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
  HardDrive,
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
  }
];

const WORKLOADS = [
  { key: 'mail', label: 'Mail', icon: Mail },
  { key: 'drive', label: 'OneDrive', icon: HardDrive },
  { key: 'calendar', label: 'Calendar', icon: Calendar },
  { key: 'contacts', label: 'Contacts', icon: Users },
  { key: 'sharePoint', label: 'SharePoint', icon: Globe, details: 'sharepoint' },
  { key: 'teams', label: 'Teams', icon: MessageSquare, details: 'teams' }
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
    cyan: 'bg-cyan-50 text-cyan-700 border-cyan-100',
    green: 'bg-green-50 text-green-700 border-green-100',
    violet: 'bg-violet-50 text-violet-700 border-violet-100',
    slate: 'bg-slate-50 text-slate-700 border-slate-200'
  };

  return (
    <motion.div
      variants={staggerItem}
      className="rounded-lg border bg-card p-4 shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          {typeof value === 'number' ? (
            <AnimatedCounter value={value} className="text-2xl font-bold text-foreground" />
          ) : (
            <p className="text-2xl font-bold text-foreground truncate">{value}</p>
          )}
          {detail && <p className="text-xs text-muted-foreground mt-1">{detail}</p>}
        </div>
        <div className={cn('p-2 rounded-lg border', toneClasses[tone] || toneClasses.cyan)}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </motion.div>
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
  const totalCount = toNumber(stats[group.totalKey]) || fallbackTotal || 0;
  const percent = getPercent(protectedCount, totalCount);

  return (
    <div className={cn('rounded-lg border p-3', group.bg, group.border)}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-white/75 flex items-center justify-center">
            <Icon className={cn('w-4 h-4', group.color)} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900">{group.label}</p>
            <p className="text-xs text-slate-500">{protectedCount} protected of {totalCount} total</p>
          </div>
        </div>
        <p className={cn('text-sm font-bold', group.color)}>{percent}%</p>
      </div>
      <div className="mt-3 h-2 rounded-full bg-white/70 overflow-hidden">
        <div className={cn('h-full rounded-full', group.bar)} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function WorkloadRow({ workload, status, protectedCount, totalCount, lastBackup, onDetails }) {
  const Icon = workload.icon;
  const percent = getPercent(protectedCount, totalCount);

  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-slate-50 flex items-center justify-center">
            <Icon className="w-4 h-4 text-slate-600" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900">{workload.label}</p>
            <p className="text-xs text-slate-500">
              {totalCount > 0 ? `${protectedCount} protected of ${totalCount} total` : 'Backup status from Spanning'}
              {lastBackup ? ` - ${formatRelativeTime(lastBackup)}` : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusPill status={status} />
          {onDetails && (
            <Button variant="outline" size="sm" onClick={onDetails}>
              Details
            </Button>
          )}
        </div>
      </div>
      {totalCount > 0 && (
        <div className="mt-3 h-2 rounded-full bg-slate-100 overflow-hidden">
          <div className="h-full rounded-full bg-cyan-500" style={{ width: `${percent}%` }} />
        </div>
      )}
    </div>
  );
}

function SummaryCount({ label, value }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-center">
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}

export default function SpanningUsersTab({ customerId, spanningMapping, queryClient }) {
  const [syncingSpanning, setSyncingSpanning] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [userTypeFilter, setUserTypeFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState(null);
  const [sharePointModalOpen, setSharePointModalOpen] = useState(false);
  const [teamsModalOpen, setTeamsModalOpen] = useState(false);
  const [sharePointSites, setSharePointSites] = useState([]);
  const [teamsChannels, setTeamsChannels] = useState([]);
  const [sharePointInfo, setSharePointInfo] = useState(null);
  const [teamsInfo, setTeamsInfo] = useState(null);
  const [loadingSharePoint, setLoadingSharePoint] = useState(false);
  const [loadingTeams, setLoadingTeams] = useState(false);

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

  const handleOpenSharePointModal = async () => {
    setSharePointModalOpen(true);
    setLoadingSharePoint(true);
    setSharePointSites([]);
    setSharePointInfo(null);
    try {
      const response = await client.functions.invoke('syncSpanningBackup', {
        action: 'list_sharepoint_sites',
        customer_id: customerId
      });
      if (response.success) {
        setSharePointSites(response.sites || []);
        setSharePointInfo({
          message: response.message,
          summary: response.sharePointSummary,
          tenantName: response.tenantName
        });
      } else {
        toast.error(response.error || 'Failed to fetch SharePoint sites');
      }
    } catch (error) {
      toast.error(error.message || 'Failed to fetch SharePoint sites');
    } finally {
      setLoadingSharePoint(false);
    }
  };

  const handleOpenTeamsModal = async () => {
    setTeamsModalOpen(true);
    setLoadingTeams(true);
    setTeamsChannels([]);
    setTeamsInfo(null);
    try {
      const response = await client.functions.invoke('syncSpanningBackup', {
        action: 'list_teams_channels',
        customer_id: customerId
      });
      if (response.success) {
        setTeamsChannels(response.teams || []);
        setTeamsInfo({
          message: response.message,
          summary: response.teamsSummary,
          tenantName: response.tenantName
        });
      } else {
        toast.error(response.error || 'Failed to fetch Teams channels');
      }
    } catch (error) {
      toast.error(error.message || 'Failed to fetch Teams channels');
    } finally {
      setLoadingTeams(false);
    }
  };

  if (!spanningData && !cachedStats) {
    return (
      <EmptyState
        icon={Cloud}
        title="No Spanning data"
        description="No cached Spanning data is available yet."
        action={{ label: 'Sync from Spanning', onClick: handleSyncSpanning }}
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
  const backupStatus = stats.overallBackupStatus7Days || stats.lastBackupStatus;
  const backupStatus7Days = stats.backupStatus7Days || {};
  const healthyWorkloads = WORKLOADS.filter(workload =>
    getStatusMeta(backupStatus7Days[workload.key]).label === 'Healthy'
  ).length;

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

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold text-slate-900">Spanning Backup</h3>
            {stats.fromCache && <Badge variant="outline" className="text-xs">Cached</Badge>}
            <StatusPill status={backupStatus} />
          </div>
          <p className="text-sm text-slate-500 mt-1">
            {domainName}
            {stats.origin && <span> - {stats.origin}</span>}
            {domainId && <span> - Tenant {domainId}</span>}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {lastSynced ? `Last synced ${formatDateTime(lastSynced)}` : 'No sync timestamp available'}
            {lastBackup ? ` - Last backup ${formatRelativeTime(lastBackup)}` : ''}
          </p>
        </div>
        <Button onClick={handleSyncSpanning} disabled={syncing} className="gap-2 self-start">
          {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {syncing ? 'Syncing...' : 'Sync Spanning'}
        </Button>
      </div>

      <motion.div
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        className="grid grid-cols-2 xl:grid-cols-4 gap-4"
      >
        <StatCard
          icon={Shield}
          label="Protected users"
          value={totalProtected}
          detail={`${coveragePercent}% of ${totalUsers} users`}
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

      <div className="grid grid-cols-1 xl:grid-cols-[0.95fr_1.05fr] gap-4">
        <motion.section {...fadeInUp} className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h4 className="font-semibold text-slate-900">License coverage</h4>
              <p className="text-sm text-slate-500">Protected users compared to Spanning license totals.</p>
            </div>
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              {coveragePercent}% protected
            </Badge>
          </div>
          <div className="space-y-3">
            <LicenseRow
              group={LICENSE_GROUPS[0]}
              stats={stats}
              fallbackProtected={protectedStandardFallback}
              fallbackTotal={standardUsers.length}
            />
            <LicenseRow
              group={LICENSE_GROUPS[1]}
              stats={stats}
              fallbackProtected={protectedArchivedFallback}
              fallbackTotal={archivedUsers.length}
            />
            <LicenseRow
              group={LICENSE_GROUPS[2]}
              stats={stats}
              fallbackProtected={protectedSharedFallback}
              fallbackTotal={sharedUsers.length}
            />
          </div>
        </motion.section>

        <motion.section {...fadeInUp} className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h4 className="font-semibold text-slate-900">Microsoft 365 backup health</h4>
              <p className="text-sm text-slate-500">{healthyWorkloads} of {WORKLOADS.length} workloads healthy in the last 7 days.</p>
            </div>
            <StatusPill status={backupStatus} />
          </div>
          <div className="space-y-3">
            {WORKLOADS.map(workload => {
              const isSharePoint = workload.key === 'sharePoint';
              const isTeams = workload.key === 'teams';
              const protectedCount = isSharePoint
                ? toNumber(stats.numberOfProtectedSharePointSites)
                : isTeams
                  ? toNumber(stats.numberOfProtectedTeamChannels)
                  : 0;
              const unprotectedCount = isSharePoint
                ? toNumber(stats.numberOfUnprotectedSharePointSites)
                : isTeams
                  ? toNumber(stats.numberOfUnprotectedTeamChannels)
                  : 0;

              return (
                <WorkloadRow
                  key={workload.key}
                  workload={workload}
                  status={backupStatus7Days[workload.key]}
                  protectedCount={protectedCount}
                  totalCount={protectedCount + unprotectedCount}
                  lastBackup={isSharePoint ? stats.sharePointLastBackup : isTeams ? stats.teamsLastBackup : null}
                  onDetails={workload.details === 'sharepoint'
                    ? handleOpenSharePointModal
                    : workload.details === 'teams'
                      ? handleOpenTeamsModal
                      : null}
                />
              );
            })}
          </div>
        </motion.section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center">
              <Database className="w-5 h-5 text-slate-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Storage protected</p>
              <p className="text-2xl font-bold text-slate-900">{stats.totalProtectedStorage || '0 B'}</p>
              <p className="text-xs text-slate-500">{stats.totalUsedStorage || '0 B'} total used data</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-green-700" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Last backup</p>
              <p className="text-lg font-bold text-slate-900">{formatShortDate(lastBackup)}</p>
              <p className="text-xs text-slate-500">{lastBackup ? formatDateTime(lastBackup) : 'No timestamp from Spanning'}</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-violet-50 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-violet-700" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Subscription</p>
              <p className="text-lg font-bold text-slate-900">{formatShortDate(stats.expirationDate)}</p>
              <p className="text-xs text-slate-500">Expiration date from Spanning</p>
            </div>
          </div>
        </div>
      </div>

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
            action={{ label: 'Sync from Spanning', onClick: handleSyncSpanning }}
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
                    <TableHead className="hidden md:table-cell">Last backup</TableHead>
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
                        <TableCell className="hidden md:table-cell text-slate-600">
                          <div>{formatRelativeTime(user.lastBackupDate)}</div>
                          <div className="text-xs text-slate-400">{formatDateTime(user.lastBackupDate)}</div>
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Spanning user details</DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg">
                <div className="w-12 h-12 rounded-full bg-cyan-50 flex items-center justify-center text-cyan-700 font-bold text-lg">
                  {getInitials(selectedUser)}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900 truncate">{selectedUser.displayName || 'Unknown user'}</p>
                  <p className="text-sm text-slate-500 truncate">{selectedUser.email || 'No email returned'}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <SummaryCount label="Mail" value={selectedUser.mailStorage || '0 B'} />
                <SummaryCount label="Drive" value={selectedUser.driveStorage || '0 B'} />
                <SummaryCount label="Total" value={selectedUser.totalStorage || '0 B'} />
              </div>

              <div className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Backup status</p>
                    <p className="text-xs text-slate-500">Last backup {formatDateTime(selectedUser.lastBackupDate)}</p>
                  </div>
                  <StatusPill
                    status={selectedUser.backupStatus}
                    assigned={selectedUser.isProtected}
                    unprotected={!selectedUser.isProtected}
                  />
                </div>
              </div>

              {selectedUser.contact ? (
                <div className="p-4 border border-cyan-200 bg-cyan-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="w-4 h-4 text-cyan-700" />
                    <span className="font-medium text-slate-900">Matched to HaloPSA contact</span>
                  </div>
                  <div className="text-sm text-slate-600 space-y-1">
                    <p><strong className="text-slate-900">Name:</strong> {selectedUser.contact.full_name}</p>
                    {selectedUser.contact.title && <p><strong className="text-slate-900">Title:</strong> {selectedUser.contact.title}</p>}
                    {selectedUser.contact.phone && <p><strong className="text-slate-900">Phone:</strong> {selectedUser.contact.phone}</p>}
                  </div>
                </div>
              ) : (
                <div className="p-4 border border-slate-200 bg-slate-50 rounded-lg">
                  <p className="text-sm text-slate-500">No matching HaloPSA contact found for this email.</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={sharePointModalOpen} onOpenChange={setSharePointModalOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-cyan-700" />
              SharePoint backup details
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto">
            {loadingSharePoint ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
              </div>
            ) : sharePointSites.length === 0 ? (
              <div className="space-y-4">
                {sharePointInfo?.summary && (
                  <div className="grid grid-cols-3 gap-3">
                    <SummaryCount label="Protected" value={sharePointInfo.summary.protectedSites || 0} />
                    <SummaryCount label="Unprotected" value={sharePointInfo.summary.unprotectedSites || 0} />
                    <SummaryCount label="Total" value={sharePointInfo.summary.totalSites || 0} />
                  </div>
                )}
                <EmptyState
                  icon={Globe}
                  title="No site rows returned"
                  description={sharePointInfo?.message || 'Spanning returned summary counts but no SharePoint site rows.'}
                />
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead>Site</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Storage</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sharePointSites.map((site, index) => (
                      <TableRow key={site.id || site.url || index}>
                        <TableCell>
                          <p className="font-medium text-slate-900">{site.name}</p>
                          {site.url && <p className="text-xs text-slate-500 truncate max-w-[300px]">{site.url}</p>}
                        </TableCell>
                        <TableCell>
                          <StatusPill status={site.isProtected ? 'protected' : 'not_protected'} unprotected={!site.isProtected} />
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="font-mono text-sm">{site.storage || '0 B'}</span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={teamsModalOpen} onOpenChange={setTeamsModalOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-violet-700" />
              Teams backup details
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto">
            {loadingTeams ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
              </div>
            ) : teamsChannels.length === 0 ? (
              <div className="space-y-4">
                {teamsInfo?.summary && (
                  <div className="grid grid-cols-3 gap-3">
                    <SummaryCount label="Protected" value={teamsInfo.summary.protectedChannels || 0} />
                    <SummaryCount label="Unprotected" value={teamsInfo.summary.unprotectedChannels || 0} />
                    <SummaryCount label="Total" value={teamsInfo.summary.totalChannels || 0} />
                  </div>
                )}
                <EmptyState
                  icon={MessageSquare}
                  title="No team rows returned"
                  description={teamsInfo?.message || 'Spanning returned summary counts but no Teams rows.'}
                />
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead>Team</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Storage</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {teamsChannels.map((team, index) => (
                      <TableRow key={team.id || team.name || index}>
                        <TableCell>
                          <p className="font-medium text-slate-900">{team.name}</p>
                          {team.description && <p className="text-xs text-slate-500 truncate max-w-[300px]">{team.description}</p>}
                        </TableCell>
                        <TableCell>
                          <StatusPill status={team.isProtected ? 'protected' : 'not_protected'} unprotected={!team.isProtected} />
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="font-mono text-sm">{team.storage || '0 B'}</span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
