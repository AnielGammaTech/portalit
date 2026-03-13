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
  Clock,
  Loader2,
  Search
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { EmptyState } from "@/components/ui/empty-state";

// ── Stat card configs ──────────────────────────────────────────────
const STAT_CARDS = [
  { key: 'totalDevices', label: 'Total Devices', icon: HardDrive, color: 'text-primary', bg: 'bg-primary/10' },
  { key: 'activeDevices', label: 'Active', icon: CheckCircle2, color: 'text-success', bg: 'bg-success/10' },
  { key: 'devicesWithErrors', label: 'Errors', icon: AlertCircle, color: 'text-destructive', bg: 'bg-destructive/10' },
  { key: 'devicesWithWarnings', label: 'Warnings', icon: AlertTriangle, color: 'text-warning', bg: 'bg-warning/10' },
  { key: 'healthyDevices', label: 'Healthy', icon: Shield, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
];

const STATUS_COLORS = {
  Completed: 'bg-success/15 text-success',
  InProcess: 'bg-primary/15 text-primary',
  Failed: 'bg-destructive/15 text-destructive',
  active: 'bg-success/15 text-success',
  inactive: 'bg-zinc-200/60 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400',
};

export default function CoveTab({ customerId, coveMapping, queryClient: externalQC }) {
  const internalQC = useQueryClient();
  const queryClient = externalQC || internalQC;

  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 10;

  // ── Cached data from mapping ──────────────────────────────────────
  const cachedData = useMemo(() => {
    if (!coveMapping?.cached_data) return null;
    return typeof coveMapping.cached_data === 'string'
      ? (() => { try { return JSON.parse(coveMapping.cached_data); } catch { return null; } })()
      : coveMapping.cached_data;
  }, [coveMapping?.cached_data]);

  // ── Sync handler ──────────────────────────────────────────────────
  const handleSync = async () => {
    setSyncing(true);
    try {
      const response = await client.functions.invoke('syncCoveData', {
        action: 'sync_customer',
        customer_id: customerId,
      });
      if (response.success) {
        toast.success(`Synced ${response.data?.totalDevices || 0} Cove devices`);
        queryClient.invalidateQueries({ queryKey: ['cove-mapping', customerId] });
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
  const devices = cachedData?.devices || [];

  const filteredDevices = useMemo(() => {
    if (!search.trim()) return devices;
    const q = search.toLowerCase();
    return devices.filter(d =>
      (d.name || '').toLowerCase().includes(q) ||
      (d.osType || '').toLowerCase().includes(q) ||
      (d.lastBackupStatus || '').toLowerCase().includes(q)
    );
  }, [devices, search]);

  const totalPages = Math.ceil(filteredDevices.length / PAGE_SIZE);
  const pagedDevices = filteredDevices.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Reset page when search changes
  const handleSearch = (value) => {
    setSearch(value);
    setPage(0);
  };

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Stat cards */}
      <motion.div variants={staggerContainer} initial="initial" animate="animate" className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {STAT_CARDS.map((stat) => (
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
                <AnimatedCounter value={cachedData?.[stat.key] || 0} className="text-2xl font-bold text-foreground" />
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Storage + success rate row */}
      {cachedData && (
        <motion.div {...fadeInUp} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-card rounded-[14px] border shadow-hero-sm p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-hero-md bg-blue-500/10 flex items-center justify-center">
                <Database className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-lg font-bold text-foreground">{cachedData.totalStorageUsed || '0 B'}</p>
                <p className="text-xs text-muted-foreground">Storage Used</p>
              </div>
            </div>
          </div>
          <div className="bg-card rounded-[14px] border shadow-hero-sm p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-hero-md bg-indigo-500/10 flex items-center justify-center">
                <Shield className="w-5 h-5 text-indigo-500" />
              </div>
              <div>
                <p className="text-lg font-bold text-foreground">{cachedData.totalProtectedSize || '0 B'}</p>
                <p className="text-xs text-muted-foreground">Protected Data</p>
              </div>
            </div>
          </div>
          <div className="bg-card rounded-[14px] border shadow-hero-sm p-4">
            <div className="flex items-center gap-3">
              <div className={cn(
                'w-10 h-10 rounded-hero-md flex items-center justify-center',
                (cachedData.successRate || 0) >= 90 ? 'bg-success/10' : (cachedData.successRate || 0) >= 70 ? 'bg-warning/10' : 'bg-destructive/10'
              )}>
                <CheckCircle2 className={cn(
                  'w-5 h-5',
                  (cachedData.successRate || 0) >= 90 ? 'text-success' : (cachedData.successRate || 0) >= 70 ? 'text-warning' : 'text-destructive'
                )} />
              </div>
              <div>
                <p className="text-lg font-bold text-foreground">{cachedData.successRate || 0}%</p>
                <p className="text-xs text-muted-foreground">Backup Success Rate</p>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Devices table card */}
      <motion.div {...fadeInUp} className="bg-card rounded-[14px] border shadow-hero-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-border/50 flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground text-sm">Backup Devices</h3>
            <p className="text-xs text-muted-foreground">
              {filteredDevices.length} device{filteredDevices.length !== 1 ? 's' : ''}
              {coveMapping?.last_synced && (
                <> · Synced {new Date(coveMapping.last_synced).toLocaleDateString()}</>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative w-48">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
              <Input
                placeholder="Search devices..."
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSync}
              disabled={syncing}
              className="gap-2"
            >
              {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Sync
            </Button>
          </div>
        </div>

        {devices.length === 0 && !cachedData ? (
          <EmptyState
            icon={HardDrive}
            title="No Cove data yet"
            description="Click Sync to pull backup device data from N-able Cove"
            action={{ label: 'Sync Now', onClick: handleSync }}
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
                    {device.lastBackup ? new Date(device.lastBackup * 1000).toLocaleDateString() : '—'}
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
