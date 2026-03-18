import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { client } from '@/api/client';
import { motion } from 'framer-motion';
import { staggerContainer, staggerItem, fadeInUp } from '@/lib/motion';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { SkeletonStats, SkeletonTable } from "@/components/ui/shimmer-skeleton";
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
  FolderOpen,
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

// ── Stat Card Configs ────────────────────────────────────────────────────

const USER_STATS = [
  { key: 'standard', icon: Users, label: 'Standard Users', color: 'text-primary', bg: 'bg-primary/10' },
  { key: 'archived', icon: Archive, label: 'Archived', color: 'text-[#7828C8]', bg: 'bg-[#7828C8]/10' },
  { key: 'shared', icon: Mail, label: 'Shared Mailboxes', color: 'text-[#06B6D4]', bg: 'bg-[#06B6D4]/10' },
  { key: 'total', icon: CheckCircle2, label: 'Total Protected', color: 'text-success', bg: 'bg-success/10' },
];

const SERVICE_STATS = [
  { key: 'sharepoint', icon: Globe, label: 'SharePoint Sites', color: 'text-[#2563EB]', bg: 'bg-[#2563EB]/10', clickable: true },
  { key: 'teams', icon: MessageSquare, label: 'Teams Channels', color: 'text-[#6366F1]', bg: 'bg-[#6366F1]/10', clickable: true },
  { key: 'storage', icon: Database, label: 'Protected Data', color: 'text-muted-foreground', bg: 'bg-muted' },
  { key: 'backup', icon: Shield, label: '7-Day Backup', color: 'text-[#059669]', bg: 'bg-[#059669]/10' },
];

const BACKUP_SERVICES = [
  { key: 'mail', label: 'Mail' },
  { key: 'drive', label: 'Drive' },
  { key: 'sharePoint', label: 'SP' },
  { key: 'teams', label: 'Teams' },
  { key: 'calendar', label: 'Cal' },
  { key: 'contacts', label: 'Cont' },
];

const ITEMS_PER_PAGE = 15;

// ── Component ────────────────────────────────────────────────────────────

export default function SpanningUsersTab({ customerId, spanningMapping, queryClient }) {
  const [syncingSpanning, setSyncingSpanning] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [userTypeFilter, setUserTypeFilter] = useState('all'); // 'all' | 'standard' | 'archived'
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState(null);
  const [sharePointModalOpen, setSharePointModalOpen] = useState(false);
  const [teamsModalOpen, setTeamsModalOpen] = useState(false);
  const [sharePointSites, setSharePointSites] = useState([]);
  const [teamsChannels, setTeamsChannels] = useState([]);
  const [loadingSharePoint, setLoadingSharePoint] = useState(false);
  const [loadingTeams, setLoadingTeams] = useState(false);

  // ── Cached data from mapping (instant, no API call) ──────────────────

  const cachedStats = useMemo(() => {
    if (!spanningMapping?.cached_data) return null;
    const data = typeof spanningMapping.cached_data === 'string'
      ? (() => { try { return JSON.parse(spanningMapping.cached_data); } catch { return null; } })()
      : spanningMapping.cached_data;
    if (!data) return null;
    return { ...data, fromCache: true, last_synced: spanningMapping.last_synced };
  }, [spanningMapping?.cached_data, spanningMapping?.last_synced]);

  // ── Live data query (manual refresh only) ────────────────────────────

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

  // ── Licenses & contacts for user matching ────────────────────────────

  const { data: spanningLicenses = [] } = useQuery({
    queryKey: ['spanning-licenses', customerId],
    queryFn: () => client.entities.SaaSLicense.filter({ customer_id: customerId, source: 'spanning' }),
    enabled: !!customerId
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ['customer-contacts', customerId],
    queryFn: () => client.entities.Contact.filter({ customer_id: customerId }),
    enabled: !!customerId
  });

  const contactsByEmail = useMemo(() => {
    const map = {};
    contacts.forEach(c => { if (c.email) map[c.email.toLowerCase()] = c; });
    return map;
  }, [contacts]);

  // ── Handlers ─────────────────────────────────────────────────────────

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
      console.error('Sync failed:', error);
      toast.error('Failed to sync Spanning data');
    } finally {
      setSyncingSpanning(false);
    }
  };

  const handleOpenSharePointModal = async () => {
    setSharePointModalOpen(true);
    setLoadingSharePoint(true);
    try {
      const response = await client.functions.invoke('syncSpanningBackup', {
        action: 'list_sharepoint_sites',
        customer_id: customerId
      });
      if (response.success) setSharePointSites(response.sites || []);
    } catch (error) {
      console.error('Failed to fetch SharePoint sites:', error);
    } finally {
      setLoadingSharePoint(false);
    }
  };

  const handleOpenTeamsModal = async () => {
    setTeamsModalOpen(true);
    setLoadingTeams(true);
    try {
      const response = await client.functions.invoke('syncSpanningBackup', {
        action: 'list_teams_channels',
        customer_id: customerId
      });
      if (response.success) setTeamsChannels(response.teams || []);
    } catch (error) {
      console.error('Failed to fetch Teams channels:', error);
    } finally {
      setLoadingTeams(false);
    }
  };

  // ── Empty state ──────────────────────────────────────────────────────

  if (!spanningData && !cachedStats) {
    return (
      <EmptyState
        icon={Cloud}
        title="No Spanning Data"
        description="No cached data available. Click sync to fetch data from Spanning Backup."
        action={{ label: 'Sync from Spanning', onClick: handleSyncSpanning }}
      />
    );
  }

  // ── Computed values ──────────────────────────────────────────────────

  const stats = spanningData || {};

  const protectedStandard = stats.numberOfProtectedStandardUsers || 0;
  const standardLicenses = stats.numberOfStandardLicensesTotal || 0;
  const protectedArchived = stats.numberOfProtectedArchivedUsers || 0;
  const archivedLicenses = stats.numberOfArchivedLicensesTotal || 0;
  const protectedShared = stats.numberOfProtectedSharedMailboxes || 0;
  const sharedMailboxes = stats.numberOfSharedMailboxesTotal || 0;
  const totalProtected = stats.numberOfProtectedUsers || 0;
  const totalUsers = stats.numberOfUsers || 0;

  const userCounts = {
    standard: protectedStandard,
    archived: protectedArchived,
    shared: protectedShared,
    total: totalProtected,
  };

  const userSubtitles = {
    standard: `${standardLicenses} licenses`,
    archived: `${archivedLicenses} licenses`,
    shared: `${sharedMailboxes} total`,
    total: `${totalUsers} total users`,
  };

  const serviceCounts = {
    sharepoint: stats.numberOfProtectedSharePointSites || 0,
    teams: stats.numberOfProtectedTeamChannels || 0,
    backup: stats.backupStatus7Days
      ? Object.values(stats.backupStatus7Days).filter(v => v === 'success').length
      : 0,
  };

  const backupTotalCount = stats.backupStatus7Days
    ? Object.keys(stats.backupStatus7Days).length
    : 0;

  const serviceSubtitles = {
    sharepoint: stats.sharePointBackupStatus || '',
    teams: stats.teamsBackupStatus || '',
    storage: `Used: ${stats.totalUsedStorage || '0 B'}`,
    backup: backupTotalCount > 0 ? `of ${backupTotalCount} services` : '',
  };

  // Users table
  const users = stats.users || [];

  // Separate counts for filter tabs
  const standardUsers = users.filter(u => (u.userType || 'standard') !== 'archived');
  const archivedUsers = users.filter(u => u.userType === 'archived');

  const filteredUsers = users
    .filter(u => {
      // Type filter
      if (userTypeFilter === 'standard' && u.userType === 'archived') return false;
      if (userTypeFilter === 'archived' && (u.userType || 'standard') !== 'archived') return false;
      // Search filter
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return u.email?.toLowerCase().includes(term) || u.displayName?.toLowerCase().includes(term);
    })
    .sort((a, b) => (b.totalStorageBytes || 0) - (a.totalStorageBytes || 0));

  const totalPages = Math.ceil(filteredUsers.length / ITEMS_PER_PAGE);
  const paginatedUsers = filteredUsers.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // ── Render ───────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* User Stats Cards */}
      <motion.div
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {USER_STATS.map(stat => (
          <motion.div
            key={stat.key}
            variants={staggerItem}
            className="bg-card rounded-[14px] border shadow-hero-sm p-4 hover:shadow-hero-md transition-all duration-[250ms]"
          >
            <div className="flex items-center gap-3">
              <div className={cn('w-10 h-10 rounded-hero-md flex items-center justify-center', stat.bg)}>
                <stat.icon className={cn('w-5 h-5', stat.color)} />
              </div>
              <div>
                <AnimatedCounter value={userCounts[stat.key]} className="text-2xl font-bold text-foreground" />
                <p className="text-xs text-muted-foreground">{stat.label}</p>
                <p className="text-[10px] text-muted-foreground/60">{userSubtitles[stat.key]}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Service Stats Cards */}
      {stats.domainName && (
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="grid grid-cols-2 lg:grid-cols-4 gap-4"
        >
          {SERVICE_STATS.map(stat => {
            const isClickable = stat.clickable;
            const handleClick = stat.key === 'sharepoint'
              ? handleOpenSharePointModal
              : stat.key === 'teams'
                ? handleOpenTeamsModal
                : undefined;

            return (
              <motion.div
                key={stat.key}
                variants={staggerItem}
                className={cn(
                  'bg-card rounded-[14px] border shadow-hero-sm p-4 hover:shadow-hero-md transition-all duration-[250ms]',
                  isClickable && 'cursor-pointer'
                )}
                onClick={handleClick}
              >
                <div className="flex items-center gap-3">
                  <div className={cn('w-10 h-10 rounded-hero-md flex items-center justify-center', stat.bg)}>
                    <stat.icon className={cn('w-5 h-5', stat.color)} />
                  </div>
                  <div>
                    {stat.key === 'storage' ? (
                      <p className="text-2xl font-bold text-foreground">{stats.totalProtectedStorage || '0 B'}</p>
                    ) : stat.key === 'backup' ? (
                      <>
                        <AnimatedCounter value={serviceCounts.backup} className="text-2xl font-bold text-foreground" />
                        {stats.backupStatus7Days && (
                          <div className="flex items-center gap-1 mt-0.5">
                            {BACKUP_SERVICES.map(svc => (
                              <div
                                key={svc.key}
                                className={cn(
                                  'w-2 h-2 rounded-full',
                                  stats.backupStatus7Days[svc.key] === 'success' ? 'bg-success' : 'bg-warning'
                                )}
                                title={`${svc.label}: ${stats.backupStatus7Days[svc.key]}`}
                              />
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      <AnimatedCounter value={serviceCounts[stat.key]} className="text-2xl font-bold text-foreground" />
                    )}
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                    {serviceSubtitles[stat.key] && (
                      <p className="text-[10px] text-muted-foreground/60">{serviceSubtitles[stat.key]}</p>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {/* Domain info + Last synced */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{stats.domainName}</span>
          {stats.origin && <span className="ml-2">• {stats.origin}</span>}
          {stats.expirationDate && (
            <span className="ml-2">• Expires {new Date(stats.expirationDate).toLocaleDateString()}</span>
          )}
        </p>
        {stats.fromCache && stats.last_synced && (
          <p className="text-xs text-muted-foreground text-right">
            Last synced: {new Date(stats.last_synced).toLocaleDateString('en-US', {
              month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit'
            })}
          </p>
        )}
      </div>

      {/* Search & Sync Bar */}
      <motion.div {...fadeInUp} className="bg-card rounded-[14px] border shadow-hero-sm p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search users by name or email..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="pl-9 pr-9 rounded-hero-md bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <Button onClick={handleSyncSpanning} disabled={syncingSpanning}>
            {syncingSpanning
              ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              : <RefreshCw className="w-4 h-4 mr-2" />}
            Sync Spanning
          </Button>
        </div>

        {/* User Type Filter Tabs */}
        <div className="flex items-center gap-2">
          {[
            { key: 'all', label: 'All Users', count: users.length },
            { key: 'standard', label: 'Standard', count: standardUsers.length },
            { key: 'archived', label: 'Archived', count: archivedUsers.length },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => { setUserTypeFilter(tab.key); setCurrentPage(1); }}
              className={cn(
                'px-3 py-1.5 rounded-hero-md text-sm font-medium transition-all duration-200',
                userTypeFilter === tab.key
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              )}
            >
              {tab.label}
              <span className={cn(
                'ml-1.5 text-xs',
                userTypeFilter === tab.key ? 'text-primary-foreground/70' : 'text-muted-foreground/60'
              )}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </motion.div>

      {/* Users Table */}
      <div className="bg-card rounded-[14px] border shadow-hero-sm overflow-hidden">
        {users.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No users found"
            description="Sync from Spanning to populate the user list"
            action={{ label: 'Sync from Spanning', onClick: handleSyncSpanning }}
          />
        ) : filteredUsers.length === 0 ? (
          <EmptyState
            icon={Search}
            title="No matching users"
            description="Try adjusting your search term"
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>User</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Mail</TableHead>
                    <TableHead className="text-right">Drive</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedUsers.map((user, idx) => {
                    const matchedContact = contactsByEmail[user.email?.toLowerCase()];
                    const isArchived = user.userType === 'archived';
                    return (
                      <TableRow
                        key={user.email || idx}
                        className="cursor-pointer hover:bg-muted/30 transition-colors duration-[250ms]"
                        onClick={() => setSelectedUser({ ...user, contact: matchedContact })}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              'w-8 h-8 rounded-full flex items-center justify-center font-medium text-sm',
                              isArchived ? 'bg-[#7828C8]/10 text-[#7828C8]' : 'bg-primary/10 text-primary'
                            )}>
                              {user.displayName?.charAt(0)?.toUpperCase() || '?'}
                            </div>
                            <div>
                              <p className="font-medium text-foreground">{user.displayName}</p>
                              <p className="text-xs text-muted-foreground">{user.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={isArchived ? 'secondary' : 'outline'}
                            className={cn('text-[11px] gap-1', isArchived && 'bg-[#7828C8]/10 text-[#7828C8] border-[#7828C8]/20')}
                          >
                            {isArchived ? <Archive className="w-3 h-3" /> : <Users className="w-3 h-3" />}
                            {isArchived ? 'Archived' : 'Standard'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="flat-success" className="text-[11px] gap-1">
                            <Shield className="w-3 h-3" />
                            Protected
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="font-mono text-sm text-muted-foreground">{user.mailStorage}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="font-mono text-sm text-muted-foreground">{user.driveStorage}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="font-mono text-sm font-semibold text-foreground">{user.totalStorage}</span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border/50">
                <p className="text-sm text-muted-foreground">
                  Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, filteredUsers.length)} of {filteredUsers.length}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── User Detail Modal ─────────────────────────────────────────── */}
      <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Spanning User Details</DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 bg-muted rounded-hero-md">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                  {selectedUser.displayName?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <div>
                  <p className="font-semibold text-foreground">{selectedUser.displayName}</p>
                  <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="font-medium text-foreground">Storage Usage</h4>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { icon: Mail, value: selectedUser.mailStorage, label: 'Mail', color: 'text-[#2563EB]', bg: 'bg-[#2563EB]/10' },
                    { icon: HardDrive, value: selectedUser.driveStorage, label: 'Drive', color: 'text-[#7828C8]', bg: 'bg-[#7828C8]/10' },
                    { icon: CheckCircle2, value: selectedUser.totalStorage, label: 'Total', color: 'text-success', bg: 'bg-success/10' },
                  ].map(item => (
                    <div key={item.label} className={cn('p-3 rounded-hero-md text-center', item.bg)}>
                      <item.icon className={cn('w-5 h-5 mx-auto mb-1', item.color)} />
                      <p className="text-lg font-bold text-foreground">{item.value}</p>
                      <p className="text-xs text-muted-foreground">{item.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-3 bg-success/10 rounded-hero-md flex items-center gap-2">
                <Shield className="w-5 h-5 text-success" />
                <span className="text-success font-medium">Protected by Spanning Backup</span>
              </div>

              {selectedUser.contact ? (
                <div className="p-4 border border-primary/20 bg-primary/5 rounded-hero-md">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    <span className="font-medium text-foreground">Matched to HaloPSA Contact</span>
                  </div>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p><strong className="text-foreground">Name:</strong> {selectedUser.contact.full_name}</p>
                    {selectedUser.contact.title && <p><strong className="text-foreground">Title:</strong> {selectedUser.contact.title}</p>}
                    {selectedUser.contact.phone && <p><strong className="text-foreground">Phone:</strong> {selectedUser.contact.phone}</p>}
                  </div>
                </div>
              ) : (
                <div className="p-4 border border-border bg-muted rounded-hero-md">
                  <p className="text-sm text-muted-foreground">No matching contact found in HaloPSA</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── SharePoint Sites Modal ────────────────────────────────────── */}
      <Dialog open={sharePointModalOpen} onOpenChange={setSharePointModalOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-[#2563EB]" />
              SharePoint Sites
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto">
            {loadingSharePoint ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : sharePointSites.length === 0 ? (
              <EmptyState icon={Globe} title="No SharePoint sites found" description="No sites returned from Spanning API" />
            ) : (
              <div className="border rounded-hero-md overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Site</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Storage</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sharePointSites.map((site, idx) => (
                      <TableRow key={idx}>
                        <TableCell>
                          <p className="font-medium text-foreground">{site.name}</p>
                          {site.url && <p className="text-xs text-muted-foreground truncate max-w-[300px]">{site.url}</p>}
                        </TableCell>
                        <TableCell>
                          <Badge variant={site.isProtected ? 'flat-success' : 'secondary'} className="text-[11px]">
                            {site.isProtected ? 'Protected' : 'Not Protected'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="font-mono text-sm">{site.storage}</span>
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

      {/* ── Teams Channels Modal ──────────────────────────────────────── */}
      <Dialog open={teamsModalOpen} onOpenChange={setTeamsModalOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-[#6366F1]" />
              Teams
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto">
            {loadingTeams ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : teamsChannels.length === 0 ? (
              <EmptyState icon={MessageSquare} title="No Teams found" description="No teams returned from Spanning API" />
            ) : (
              <div className="border rounded-hero-md overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Team</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Storage</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {teamsChannels.map((team, idx) => (
                      <TableRow key={idx}>
                        <TableCell>
                          <p className="font-medium text-foreground">{team.name}</p>
                          {team.description && <p className="text-xs text-muted-foreground truncate max-w-[300px]">{team.description}</p>}
                        </TableCell>
                        <TableCell>
                          <Badge variant={team.isProtected ? 'flat-success' : 'secondary'} className="text-[11px]">
                            {team.isProtected ? 'Protected' : 'Not Protected'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="font-mono text-sm">{team.storage}</span>
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
