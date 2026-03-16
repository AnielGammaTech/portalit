import React, { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { client } from '@/api/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Phone,
  Users,
  PhoneForwarded,
  Voicemail,
  Headphones,
  RefreshCw,
  Clock,
  Search,
  Globe,
  CheckCircle2,
  XCircle,
  FileText,
  Calendar,
  UserX,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Building2,
  Server,
  Cpu,
  HardDrive,
  Network,
  Activity,
  ArrowUpDown,
  Shield,
  Tag,
  MapPin,
} from 'lucide-react';
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

const ITEMS_PER_PAGE = 15;

/** Format bandwidth bytes to human-readable */
function formatBandwidth(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

/** Format region code to friendly name */
function formatRegion(code) {
  const regions = {
    ewr: 'New Jersey', ord: 'Chicago', dfw: 'Dallas', sea: 'Seattle', lax: 'Los Angeles',
    atl: 'Atlanta', ams: 'Amsterdam', lhr: 'London', fra: 'Frankfurt', cdg: 'Paris',
    nrt: 'Tokyo', icn: 'Seoul', sgp: 'Singapore', syd: 'Sydney', yto: 'Toronto',
    mia: 'Miami', sjc: 'Silicon Valley', hnl: 'Honolulu', mex: 'Mexico City',
    sao: 'São Paulo', mad: 'Madrid', waw: 'Warsaw', sto: 'Stockholm',
    del: 'Delhi', blr: 'Bangalore', bom: 'Mumbai', jnb: 'Johannesburg',
  };
  return regions[code] || code?.toUpperCase() || 'Unknown';
}

function VultrServerCard({ vultrMapping }) {
  const [expanded, setExpanded] = useState(false);
  const inst = vultrMapping?.cached_data?.instance;
  const bandwidth = vultrMapping?.cached_data?.bandwidth;
  const syncedAt = vultrMapping?.cached_data?.synced_at || vultrMapping?.last_synced;

  if (!inst) return null;

  // Compute bandwidth totals from the bandwidth object (daily breakdown keyed by date)
  const bwTotals = useMemo(() => {
    if (!bandwidth || typeof bandwidth !== 'object') return null;
    let inbound = 0;
    let outbound = 0;
    for (const day of Object.values(bandwidth)) {
      inbound += day.incoming_bytes || 0;
      outbound += day.outgoing_bytes || 0;
    }
    return { inbound, outbound, total: inbound + outbound };
  }, [bandwidth]);

  return (
    <Card className="border-blue-100 dark:border-blue-800/50 bg-gradient-to-r from-blue-50/50 to-slate-50/50 dark:from-blue-950/20 dark:to-slate-950/20 overflow-hidden">
      <CardContent className="p-0">
        {/* Main row — always visible */}
        <button
          onClick={() => setExpanded(prev => !prev)}
          className="w-full flex items-center justify-between p-4 text-left hover:bg-blue-50/50 dark:hover:bg-blue-950/30 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
              <Server className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-foreground">{inst.label}</p>
                <Badge className={cn(
                  "text-[10px] font-normal",
                  inst.power_status === 'running'
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                    : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                )}>
                  {inst.power_status}
                </Badge>
                {inst.server_status && inst.server_status !== 'none' && inst.server_status !== 'ok' && (
                  <Badge variant="secondary" className="text-[10px]">{inst.server_status}</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {inst.main_ip} · {formatRegion(inst.region)} · {inst.os}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Cpu className="w-3.5 h-3.5" />{inst.vcpu_count} vCPU</span>
              <span>{inst.ram_display}</span>
              <span className="flex items-center gap-1"><HardDrive className="w-3.5 h-3.5" />{inst.disk_display}</span>
            </div>
            <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", expanded && "rotate-180")} />
          </div>
        </button>

        {/* Expanded details */}
        {expanded && (
          <div className="border-t border-blue-100 dark:border-blue-800/50">
            {/* Spec cards row — visible on mobile too */}
            <div className="grid grid-cols-3 sm:hidden gap-3 p-4 pb-0">
              <div className="bg-white dark:bg-slate-900/50 rounded-lg p-2.5 text-center border border-blue-50 dark:border-blue-900/30">
                <Cpu className="w-4 h-4 text-blue-500 mx-auto mb-1" />
                <p className="text-sm font-bold text-foreground">{inst.vcpu_count}</p>
                <p className="text-[10px] text-muted-foreground">vCPU</p>
              </div>
              <div className="bg-white dark:bg-slate-900/50 rounded-lg p-2.5 text-center border border-blue-50 dark:border-blue-900/30">
                <Activity className="w-4 h-4 text-purple-500 mx-auto mb-1" />
                <p className="text-sm font-bold text-foreground">{inst.ram_display}</p>
                <p className="text-[10px] text-muted-foreground">RAM</p>
              </div>
              <div className="bg-white dark:bg-slate-900/50 rounded-lg p-2.5 text-center border border-blue-50 dark:border-blue-900/30">
                <HardDrive className="w-4 h-4 text-amber-500 mx-auto mb-1" />
                <p className="text-sm font-bold text-foreground">{inst.disk_display}</p>
                <p className="text-[10px] text-muted-foreground">Storage</p>
              </div>
            </div>

            {/* Detail grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 p-4 text-sm">
              {/* Network section */}
              <div className="space-y-2.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Network className="w-3.5 h-3.5" /> Network
                </p>
                <div className="space-y-1.5 pl-0.5">
                  <div className="flex justify-between">
                    <span className="text-xs text-muted-foreground">IPv4</span>
                    <span className="text-xs font-mono text-foreground">{inst.main_ip}</span>
                  </div>
                  {inst.v6_main_ip && inst.v6_main_ip !== '::' && (
                    <div className="flex justify-between">
                      <span className="text-xs text-muted-foreground">IPv6</span>
                      <span className="text-xs font-mono text-foreground truncate ml-4 max-w-[200px]">{inst.v6_main_ip}</span>
                    </div>
                  )}
                  {inst.gateway_v4 && (
                    <div className="flex justify-between">
                      <span className="text-xs text-muted-foreground">Gateway</span>
                      <span className="text-xs font-mono text-foreground">{inst.gateway_v4}</span>
                    </div>
                  )}
                  {inst.netmask_v4 && (
                    <div className="flex justify-between">
                      <span className="text-xs text-muted-foreground">Netmask</span>
                      <span className="text-xs font-mono text-foreground">{inst.netmask_v4}</span>
                    </div>
                  )}
                  {inst.allowed_bandwidth > 0 && (
                    <div className="flex justify-between">
                      <span className="text-xs text-muted-foreground">Bandwidth Allowed</span>
                      <span className="text-xs text-foreground">{inst.allowed_bandwidth >= 1024 ? `${(inst.allowed_bandwidth / 1024).toFixed(0)} TB` : `${inst.allowed_bandwidth} GB`}/mo</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Server section */}
              <div className="space-y-2.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5" /> Server
                </p>
                <div className="space-y-1.5 pl-0.5">
                  {inst.hostname && (
                    <div className="flex justify-between">
                      <span className="text-xs text-muted-foreground">Hostname</span>
                      <span className="text-xs font-mono text-foreground">{inst.hostname}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-xs text-muted-foreground">Plan</span>
                    <span className="text-xs text-foreground">{inst.plan}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-muted-foreground">Region</span>
                    <span className="text-xs text-foreground flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {formatRegion(inst.region)} ({inst.region})
                    </span>
                  </div>
                  {inst.date_created && (
                    <div className="flex justify-between">
                      <span className="text-xs text-muted-foreground">Created</span>
                      <span className="text-xs text-foreground">
                        {new Date(inst.date_created).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  )}
                  {inst.features?.length > 0 && (
                    <div className="flex justify-between">
                      <span className="text-xs text-muted-foreground">Features</span>
                      <div className="flex gap-1 flex-wrap justify-end">
                        {inst.features.map(f => (
                          <Badge key={f} variant="secondary" className="text-[10px] py-0 px-1.5">
                            {f}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Bandwidth usage bar */}
            {bwTotals && inst.allowed_bandwidth > 0 && (
              <div className="px-4 pb-4">
                <div className="bg-white dark:bg-slate-900/50 rounded-lg border border-blue-50 dark:border-blue-900/30 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <ArrowUpDown className="w-3.5 h-3.5" /> Bandwidth Usage (This Month)
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatBandwidth(bwTotals.total)} / {inst.allowed_bandwidth >= 1024 ? `${(inst.allowed_bandwidth / 1024).toFixed(0)} TB` : `${inst.allowed_bandwidth} GB`}
                    </p>
                  </div>
                  {/* Progress bar */}
                  {(() => {
                    const allowedBytes = inst.allowed_bandwidth * 1024 * 1024 * 1024;
                    const pct = Math.min((bwTotals.total / allowedBytes) * 100, 100);
                    return (
                      <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            pct > 90 ? "bg-red-500" : pct > 70 ? "bg-amber-500" : "bg-blue-500"
                          )}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    );
                  })()}
                  <div className="flex justify-between mt-2 text-[10px] text-muted-foreground">
                    <span>Inbound: {formatBandwidth(bwTotals.inbound)}</span>
                    <span>Outbound: {formatBandwidth(bwTotals.outbound)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Tags */}
            {inst.tags?.length > 0 && (
              <div className="px-4 pb-4">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Tag className="w-3 h-3 text-muted-foreground" />
                  {inst.tags.map(tag => (
                    <Badge key={tag} variant="outline" className="text-[10px] py-0">{tag}</Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Last synced */}
            {syncedAt && (
              <div className="px-4 pb-3 flex items-center gap-1.5 text-[10px] text-muted-foreground/60">
                <Clock className="w-3 h-3" />
                Last synced {formatDistanceToNow(new Date(syncedAt), { addSuffix: true })}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Safely parse extensions_detail — handles double-encoded JSON strings and arrays */
function parseExtensionsDetail(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return []; }
  }
  return [];
}

function ReportView({ report, searchQuery, setSearchQuery, vultrMapping }) {
  const [page, setPage] = useState(0);

  const extensionsDetail = useMemo(
    () => parseExtensionsDetail(report?.extensions_detail),
    [report?.extensions_detail]
  );

  const activeExtensions = extensionsDetail.filter(ext => ext.type === 'user');
  const disabledExtensions = extensionsDetail.filter(ext => ext.type === 'disabled');
  const systemExtensions = extensionsDetail.filter(ext => ext.type === 'system');

  const filteredExtensions = useMemo(() => {
    if (!searchQuery) return extensionsDetail;
    const q = searchQuery.toLowerCase();
    return extensionsDetail.filter(ext =>
      (ext.name || '').toLowerCase().includes(q) ||
      String(ext.number || '').includes(q) ||
      (ext.department || '').toLowerCase().includes(q) ||
      (ext.type || '').toLowerCase().includes(q)
    );
  }, [extensionsDetail, searchQuery]);

  // Reset to page 0 when search changes
  const currentPage = searchQuery ? 0 : page;
  const totalPages = Math.ceil(filteredExtensions.length / ITEMS_PER_PAGE);
  const pagedExtensions = filteredExtensions.slice(
    currentPage * ITEMS_PER_PAGE,
    (currentPage + 1) * ITEMS_PER_PAGE
  );

  const getTypeBadge = (type) => {
    switch (type) {
      case 'disabled':
        return (
          <Badge variant="secondary" className="text-[10px] gap-0.5">
            <XCircle className="w-2.5 h-2.5" />
            Disabled
          </Badge>
        );
      case 'system':
        return (
          <Badge className="bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-[10px] gap-0.5">
            <Building2 className="w-2.5 h-2.5" />
            System
          </Badge>
        );
      default:
        return (
          <Badge className="bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-[10px] gap-0.5">
            <CheckCircle2 className="w-2.5 h-2.5" />
            Active
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Report Header */}
      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 rounded-2xl border border-emerald-100 dark:border-emerald-800/50 p-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
            <Phone className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">3CX VoIP System</h3>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="w-3.5 h-3.5" />
              <span>Report from {report.report_date || 'Unknown date'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Vultr Hosting Server */}
      <VultrServerCard vultrMapping={vultrMapping} />

      {/* Metrics */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total</p>
                <p className="text-3xl font-bold text-foreground mt-1">{report.total_extensions || extensionsDetail.length}</p>
                <p className="text-xs text-muted-foreground/70 mt-1">extensions</p>
              </div>
              <Phone className="w-5 h-5 text-emerald-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Active</p>
                <p className="text-3xl font-bold text-foreground mt-1">{report.user_extensions || activeExtensions.length}</p>
                <p className="text-xs text-muted-foreground/70 mt-1">user extensions</p>
              </div>
              <Users className="w-5 h-5 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Disabled</p>
                <p className="text-3xl font-bold text-foreground mt-1">{disabledExtensions.length}</p>
                <p className="text-xs text-muted-foreground/70 mt-1">extensions</p>
              </div>
              <UserX className="w-5 h-5 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Extension List — paginated */}
      {extensionsDetail.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Extensions ({filteredExtensions.length}{searchQuery ? ` of ${extensionsDetail.length}` : ''})
              </CardTitle>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
                <Input
                  placeholder="Search by name, ext, dept..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setPage(0); }}
                  className="pl-8 h-7 text-xs w-56"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-0">
            {/* Table header */}
            <div className="grid grid-cols-[60px_1fr_120px_100px] gap-2 px-5 py-2 border-b border-border/50 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              <span>DID</span>
              <span>Name</span>
              <span>Department</span>
              <span className="text-right">Status</span>
            </div>

            {/* Rows */}
            <div className="divide-y divide-border/30">
              {pagedExtensions.map((ext, idx) => (
                <div
                  key={ext.number || idx}
                  className="grid grid-cols-[60px_1fr_120px_100px] gap-2 px-5 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors items-center"
                >
                  <span className={cn(
                    "font-mono text-sm font-semibold",
                    ext.type === 'disabled' ? "text-muted-foreground/50" : "text-emerald-600 dark:text-emerald-400"
                  )}>
                    {ext.number}
                  </span>
                  <p className={cn(
                    "text-sm truncate",
                    ext.type === 'disabled' ? "text-muted-foreground line-through" : "text-foreground font-medium"
                  )}>
                    {ext.name || `Ext ${ext.number}`}
                  </p>
                  <span className="text-xs text-muted-foreground truncate">
                    {ext.department || '—'}
                  </span>
                  <div className="flex justify-end">
                    {getTypeBadge(ext.type)}
                  </div>
                </div>
              ))}
            </div>

            {filteredExtensions.length === 0 && searchQuery && (
              <p className="text-sm text-muted-foreground text-center py-6">No extensions match "{searchQuery}"</p>
            )}

            {/* Pagination */}
            {totalPages > 1 && !searchQuery && (
              <div className="flex items-center justify-between px-5 pt-3 mt-2 border-t border-border/50">
                <p className="text-xs text-muted-foreground">
                  {currentPage * ITEMS_PER_PAGE + 1}–{Math.min((currentPage + 1) * ITEMS_PER_PAGE, filteredExtensions.length)} of {filteredExtensions.length}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => p - 1)}
                    disabled={currentPage === 0}
                    className="h-7 px-2"
                  >
                    <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => p + 1)}
                    disabled={currentPage >= totalPages - 1}
                    className="h-7 px-2"
                  >
                    Next
                    <ChevronRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ApiSyncView({ threecxMapping, vultrMapping, customerId, queryClient }) {
  const [syncing, setSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const cached = threecxMapping?.cached_data;
  const extensions = cached?.extensions || [];

  const handleSync = async () => {
    setSyncing(true);
    try {
      const response = await client.functions.invoke('sync3CX', {
        action: 'sync_extensions',
        customer_id: customerId
      });
      if (response.success) {
        toast.success(`Synced ${response.totalExtensions} extensions`);
        queryClient.invalidateQueries({ queryKey: ['threecx-mapping', customerId] });
      } else {
        toast.error(response.error || 'Sync failed');
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSyncing(false);
    }
  };

  const userExtensions = extensions.filter(ext => {
    const type = (ext.type || '').toLowerCase();
    return type === 'user' || type === '' || type === 'extension';
  });

  const filteredExtensions = userExtensions.filter(ext => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (ext.name || '').toLowerCase().includes(q) ||
           (ext.email || '').toLowerCase().includes(q) ||
           String(ext.number || '').includes(q);
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 rounded-2xl border border-emerald-100 dark:border-emerald-800/50 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
              <Phone className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">3CX VoIP System</h3>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Globe className="w-3.5 h-3.5" />
                {threecxMapping.instance_name || threecxMapping.instance_url}
                {threecxMapping.last_synced && (
                  <span className="text-xs text-muted-foreground/60 flex items-center gap-1 ml-2">
                    <Clock className="w-3 h-3" />
                    {formatDistanceToNow(new Date(threecxMapping.last_synced), { addSuffix: true })}
                  </span>
                )}
              </div>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSync}
            disabled={syncing}
          >
            <RefreshCw className={cn("w-4 h-4 mr-2", syncing && "animate-spin")} />
            Sync
          </Button>
        </div>
      </div>

      {/* Vultr Hosting Server */}
      <VultrServerCard vultrMapping={vultrMapping} />

      {/* Metrics */}
      {cached && (
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Extensions</p>
                  <p className="text-3xl font-bold text-foreground mt-1">{cached.user_extensions || 0}</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">user extensions</p>
                </div>
                <Phone className="w-5 h-5 text-emerald-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">IVR Menus</p>
                  <p className="text-3xl font-bold text-foreground mt-1">{cached.ivr_menus || 0}</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">auto attendants</p>
                </div>
                <Voicemail className="w-5 h-5 text-purple-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Queues</p>
                  <p className="text-3xl font-bold text-foreground mt-1">{cached.queues || 0}</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">call queues</p>
                </div>
                <Headphones className="w-5 h-5 text-orange-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Extension List */}
      {userExtensions.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                User Extensions ({userExtensions.length})
              </CardTitle>
              {userExtensions.length > 5 && (
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
                  <Input
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 h-7 text-xs w-40"
                  />
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5 max-h-80 overflow-y-auto">
              {filteredExtensions.map((ext, idx) => (
                <div
                  key={ext.number || idx}
                  className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-emerald-700 dark:text-emerald-300 font-medium text-xs flex-shrink-0">
                    {ext.number || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground text-sm truncate">
                      {ext.name || `${ext.firstName || ''} ${ext.lastName || ''}`.trim() || `Ext ${ext.number}`}
                    </p>
                    {ext.email && (
                      <p className="text-xs text-muted-foreground truncate">{ext.email}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {ext.registered === true ? (
                      <Badge className="bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-[10px]">
                        <CheckCircle2 className="w-2.5 h-2.5 mr-0.5" />
                        Online
                      </Badge>
                    ) : ext.registered === false ? (
                      <Badge variant="secondary" className="text-[10px]">
                        <XCircle className="w-2.5 h-2.5 mr-0.5" />
                        Offline
                      </Badge>
                    ) : null}
                  </div>
                </div>
              ))}
              {filteredExtensions.length === 0 && searchQuery && (
                <p className="text-sm text-muted-foreground text-center py-4">No extensions match "{searchQuery}"</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {!cached && (
        <div className="text-center py-8 bg-card rounded-xl border">
          <Phone className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">No data synced yet</p>
          <p className="text-sm text-muted-foreground/70 mt-1">Click "Sync" to pull extensions from 3CX</p>
        </div>
      )}
    </div>
  );
}

export default function ThreeCXTab({ customerId, threecxMapping, threecxReports = [], vultrMapping, queryClient: qc }) {
  const [searchQuery, setSearchQuery] = useState('');
  const internalQC = useQueryClient();
  const queryClient = qc || internalQC;

  // Sort reports by date descending, use the latest one
  const sortedReports = useMemo(() =>
    [...threecxReports].sort((a, b) => (b.report_date || '').localeCompare(a.report_date || '')),
    [threecxReports]
  );
  const latestReport = sortedReports[0] || null;

  // If there's an API mapping, show the API sync view
  if (threecxMapping) {
    return (
      <ApiSyncView
        threecxMapping={threecxMapping}
        vultrMapping={vultrMapping}
        customerId={customerId}
        queryClient={queryClient}
      />
    );
  }

  // If there are uploaded reports, show the report view
  if (latestReport) {
    return (
      <ReportView
        report={latestReport}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        vultrMapping={vultrMapping}
      />
    );
  }

  // No data at all
  return (
    <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 rounded-2xl p-8 text-center">
      <Phone className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
      <h3 className="font-semibold text-foreground mb-2">3CX Not Configured</h3>
      <p className="text-sm text-muted-foreground">
        Go to Adminland &rarr; Integrations to add this customer's 3CX instance or upload a report
      </p>
    </div>
  );
}
