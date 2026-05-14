import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { client } from '@/api/client';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { staggerContainer, staggerItem, fadeInUp } from '@/lib/motion';
import {
  HardDrive,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Database,
  Shield,
  Loader2,
  Search
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";

const STATUS_COLORS = {
  Completed: 'bg-success/15 text-success',
  InProcess: 'bg-primary/15 text-primary',
  Failed: 'bg-destructive/15 text-destructive',
  active: 'bg-success/15 text-success',
  inactive: 'bg-zinc-200/60 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400',
};

function formatBackupDate(value) {
  if (!value) return '—';
  const raw = Number(value);
  const date = Number.isFinite(raw) && raw > 0
    ? new Date(raw * 1000)
    : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString() : '—';
}

export default function CoveTab({ customerId, coveMapping, queryClient: externalQC }) {
  const internalQC = useQueryClient();
  const queryClient = externalQC || internalQC;

  const [syncing, setSyncing] = useState(false);
  const [liveData, setLiveData] = useState(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 40;

  // ── Cached data from mapping ──────────────────────────────────────
  const cachedData = useMemo(() => {
    if (!coveMapping?.cached_data) return null;
    return typeof coveMapping.cached_data === 'string'
      ? (() => { try { return JSON.parse(coveMapping.cached_data); } catch { return null; } })()
      : coveMapping.cached_data;
  }, [coveMapping?.cached_data]);
  const { data: backendCache } = useQuery({
    queryKey: ['cove-cached', customerId],
    queryFn: async () => {
      const res = await client.functions.invoke('syncCoveData', {
        action: 'get_cached',
        customer_id: customerId,
      });
      return res?.success ? res : null;
    },
    enabled: !!customerId && !!coveMapping && !cachedData,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  const data = liveData || cachedData || backendCache?.data;
  const fromCache = !liveData && !!data;
  const lastSynced = coveMapping?.last_synced || backendCache?.last_synced || data?.syncedAt;

  // ── Sync handler ──────────────────────────────────────────────────
  const handleSync = async () => {
    setSyncing(true);
    try {
      const response = await client.functions.invoke('syncCoveData', {
        action: 'sync_customer',
        customer_id: customerId,
      });
      if (response.success) {
        setLiveData(response.data);
        toast.success(`Synced ${response.data?.totalDevices || 0} Cove devices`);
        queryClient.invalidateQueries({ queryKey: ['cove-mapping', customerId] });
        queryClient.invalidateQueries({ queryKey: ['cove-cached', customerId] });
      } else {
        toast.error(response.error || 'Cove sync failed');
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSyncing(false);
    }
  };

  // ── Devices filtering + pagination ────────────────────────────────
  const devices = data?.devices || [];

  const filteredDevices = useMemo(() => {
    if (!search.trim()) return devices;
    const q = search.toLowerCase();
    return devices.filter(d =>
      (d.name || '').toLowerCase().includes(q) ||
      (d.osType || '').toLowerCase().includes(q) ||
      (d.lastBackupStatus || '').toLowerCase().includes(q) ||
      (d.state || '').toLowerCase().includes(q)
    );
  }, [devices, search]);

  const totalPages = Math.ceil(filteredDevices.length / PAGE_SIZE);
  const pagedDevices = filteredDevices.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Reset page when search changes
  const handleSearch = (value) => {
    setSearch(value);
    setPage(0);
  };

  const quickMetrics = [
    { key: 'totalDevices', value: data?.totalDevices || 0, label: 'Devices', icon: HardDrive, color: 'text-slate-900', bg: 'bg-slate-100' },
    { key: 'successRate', value: `${data?.successRate || 0}%`, label: 'Success Rate', icon: CheckCircle2, color: (data?.successRate || 0) >= 90 ? 'text-emerald-600' : 'text-amber-600', bg: (data?.successRate || 0) >= 90 ? 'bg-emerald-50' : 'bg-amber-50' },
    { key: 'failed', value: data?.lastBackupFailed || data?.devicesWithErrors || 0, label: 'Failed Backups', icon: AlertCircle, color: (data?.lastBackupFailed || data?.devicesWithErrors || 0) > 0 ? 'text-red-600' : 'text-slate-500', bg: (data?.lastBackupFailed || data?.devicesWithErrors || 0) > 0 ? 'bg-red-50' : 'bg-slate-100' },
    { key: 'warnings', value: data?.devicesWithWarnings || 0, label: 'Warnings', icon: AlertTriangle, color: (data?.devicesWithWarnings || 0) > 0 ? 'text-amber-600' : 'text-slate-500', bg: (data?.devicesWithWarnings || 0) > 0 ? 'bg-amber-50' : 'bg-slate-100' },
  ];

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold text-slate-900">Cove Backup</h3>
            {fromCache && <Badge variant="outline" className="text-xs">Cached</Badge>}
          </div>
          <p className="text-sm text-slate-500">
            {coveMapping?.cove_partner_name || 'Mapped Cove partner'}
            {lastSynced && <> · Synced {new Date(lastSynced).toLocaleString()}</>}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleSync}
          disabled={syncing}
          className="gap-2"
        >
          {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Refresh Cove
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {quickMetrics.map((stat) => (
          <Card key={stat.key} className="shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className={cn("text-2xl font-bold", stat.color)}>{stat.value}</p>
                  <p className="text-xs text-slate-500">{stat.label}</p>
                </div>
                <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center', stat.bg)}>
                  <stat.icon className={cn('w-4 h-4', stat.color)} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {data && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="bg-card rounded-[14px] border shadow-sm p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
                <Database className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <p className="text-lg font-bold text-foreground">{data.totalStorageUsed || '0 B'}</p>
                <p className="text-xs text-muted-foreground">Storage Used</p>
              </div>
            </div>
          </div>
          <div className="bg-card rounded-[14px] border shadow-sm p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center">
                <Shield className="w-4 h-4 text-indigo-600" />
              </div>
              <div>
                <p className="text-lg font-bold text-foreground">{data.totalProtectedSize || '0 B'}</p>
                <p className="text-xs text-muted-foreground">Protected Data</p>
              </div>
            </div>
          </div>
          <div className="bg-card rounded-[14px] border shadow-sm p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center">
                <HardDrive className="w-4 h-4 text-slate-600" />
              </div>
              <div>
                <p className="text-lg font-bold text-foreground">{data.workstation_count || 0}</p>
                <p className="text-xs text-muted-foreground">Workstations</p>
              </div>
            </div>
          </div>
          <div className="bg-card rounded-[14px] border shadow-sm p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center">
                <HardDrive className="w-4 h-4 text-slate-600" />
              </div>
              <div>
                <p className="text-lg font-bold text-foreground">{data.server_count || 0}</p>
                <p className="text-xs text-muted-foreground">Servers</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Devices table card */}
      <motion.div {...fadeInUp} className="bg-card rounded-[14px] border shadow-hero-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-border/50 flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground text-sm">Backup Devices</h3>
            <p className="text-xs text-muted-foreground">
              {filteredDevices.length} device{filteredDevices.length !== 1 ? 's' : ''}
              {lastSynced && (
                <> · Synced {new Date(lastSynced).toLocaleDateString()}</>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative w-64 max-w-full">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
              <Input
                placeholder="Search device, OS, status..."
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>
          </div>
        </div>

        {devices.length === 0 && !data ? (
          <EmptyState
            icon={HardDrive}
            title="No Cove data yet"
            description="Click Refresh to pull backup device data from N-able Cove"
            action={{ label: 'Refresh Now', onClick: handleSync }}
          />
        ) : pagedDevices.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-muted-foreground">No devices match your search</p>
          </div>
        ) : (
          <>
            {/* Table header */}
            <div className="grid grid-cols-[1fr_100px_100px_120px_80px_80px] gap-2 px-5 py-2 bg-zinc-50 dark:bg-zinc-800/40 text-xs font-medium text-muted-foreground border-b border-border/30">
              <span>Device</span>
              <span>OS</span>
              <span>Status</span>
              <span>Last Backup</span>
              <span className="text-right">Storage</span>
              <span className="text-right">Errors</span>
            </div>

            {/* Rows */}
            <motion.div variants={staggerContainer} initial="initial" animate="animate" className="divide-y divide-border/30">
              {pagedDevices.map((device) => (
                <motion.div
                  key={device.id}
                  variants={staggerItem}
                  className="grid grid-cols-[1fr_100px_100px_120px_80px_80px] gap-2 px-5 py-3 items-center hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors duration-[250ms]"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={cn(
                      'w-8 h-8 rounded-hero-sm flex items-center justify-center flex-shrink-0',
                      device.state === 'active' ? 'bg-primary/10' : 'bg-zinc-100 dark:bg-zinc-800'
                    )}>
                      <HardDrive className={cn('w-4 h-4', device.state === 'active' ? 'text-primary' : 'text-muted-foreground')} />
                    </div>
                    <span className="text-sm font-medium text-foreground truncate">{device.name || 'Unknown'}</span>
                  </div>
                  <span className="text-xs text-muted-foreground truncate">{device.osType || '—'}</span>
                  <Badge variant="flat" className={cn('text-[10px] w-fit', STATUS_COLORS[device.state] || STATUS_COLORS[device.lastBackupStatus] || '')}>
                    {device.lastBackupStatus || device.state || '—'}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatBackupDate(device.lastBackup)}
                  </span>
                  <span className="text-xs text-muted-foreground text-right">{device.usedStorage || '—'}</span>
                  <span className={cn('text-xs text-right font-medium', device.errors > 0 ? 'text-destructive' : 'text-muted-foreground')}>
                    {device.errors || 0}
                  </span>
                </motion.div>
              ))}
            </motion.div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-border/50">
                <p className="text-xs text-muted-foreground">
                  {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filteredDevices.length)} of {filteredDevices.length}
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setPage(p => p - 1)} disabled={page === 0}>Previous</Button>
                  <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page + 1 >= totalPages}>Next</Button>
                </div>
              </div>
            )}
          </>
        )}
      </motion.div>
    </div>
  );
}
