import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
  Monitor,
  Laptop,
  Server,
  Wifi,
  Printer,
  HardDrive,
  RefreshCw,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  StickyNote,
  Loader2,
  X
} from 'lucide-react';
import { toast } from 'sonner';
import { cn, safeJsonParse, safeFormatDate } from "@/lib/utils";
// date-fns calls replaced by safe wrappers from @/lib/utils
import DeviceDetailModal from './DeviceDetailModal';

const deviceIcons = {
  desktop: Monitor,
  laptop: Laptop,
  server: Server,
  network: Wifi,
  printer: Printer,
  other: HardDrive
};

const statusConfig = {
  online: { icon: CheckCircle2, color: 'text-success', bg: 'bg-success/10', label: 'Online' },
  offline: { icon: XCircle, color: 'text-destructive', bg: 'bg-destructive/10', label: 'Offline' },
  unknown: { icon: Clock, color: 'text-muted-foreground', bg: 'bg-muted', label: 'Unknown' }
};

const STAT_CARDS = [
  { key: 'total', icon: Monitor, label: 'Total Devices', color: 'text-primary', bg: 'bg-primary/10' },
  { key: 'online', icon: CheckCircle2, label: 'Online', color: 'text-success', bg: 'bg-success/10' },
  { key: 'offline', icon: XCircle, label: 'Offline', color: 'text-destructive', bg: 'bg-destructive/10' },
  { key: 'servers', icon: Server, label: 'Servers', color: 'text-[#7828C8]', bg: 'bg-[#7828C8]/10' },
];

export default function DevicesTab({ customerId, customerExternalId }) {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [syncing, setSyncing] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState(null);

  const queryClient = useQueryClient();

  const { data: devices = [], isLoading } = useQuery({
    queryKey: ['devices', customerId],
    queryFn: () => client.entities.Device.filter({ customer_id: customerId }),
    enabled: !!customerId
  });

  const { data: mappings = [], isLoading: loadingMappings } = useQuery({
    queryKey: ['datto_mappings', customerId],
    queryFn: () => client.entities.DattoSiteMapping.filter({ customer_id: customerId }),
    enabled: !!customerId,
    staleTime: 1000 * 60 * 5
  });

  const cachedData = mappings[0]?.cached_data
    ? safeJsonParse(mappings[0].cached_data)
    : null;
  const lastSynced = mappings[0]?.last_synced;

  const syncDevices = async () => {
    if (mappings.length === 0) {
      toast.error('No Datto RMM site mapped to this customer');
      return;
    }
    setSyncing(true);
    try {
      const response = await client.functions.invoke('syncDattoRMMDevices', {
        action: 'sync_devices',
        customer_id: customerId
      });
      if (response.success) {
        toast.success(`Synced ${response.recordsSynced} devices from Datto RMM`);
        queryClient.invalidateQueries({ queryKey: ['devices', customerId] });
        queryClient.invalidateQueries({ queryKey: ['datto_mappings', customerId] });
      } else {
        toast.error(response.error || 'Sync failed');
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSyncing(false);
    }
  };

  const filteredDevices = devices.filter(device => {
    const matchesSearch = !search ||
      device.hostname?.toLowerCase().includes(search.toLowerCase()) ||
      device.ip_address?.includes(search) ||
      device.serial_number?.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === 'all' || device.device_type === typeFilter;
    const matchesStatus = statusFilter === 'all' || device.status === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  const deviceCounts = {
    total: cachedData?.total_devices ?? devices.length,
    online: cachedData?.online_count ?? devices.filter(d => d.status === 'online').length,
    offline: cachedData?.offline_count ?? devices.filter(d => d.status === 'offline').length,
    servers: cachedData?.server_count ?? devices.filter(d => d.device_type === 'server').length,
  };

  // Shimmer loading while checking mappings
  if (loadingMappings) {
    return (
      <div className="space-y-6">
        <SkeletonStats count={4} className="grid-cols-2 lg:grid-cols-4" />
        <SkeletonTable rows={5} cols={4} />
      </div>
    );
  }

  if (mappings.length === 0) {
    return (
      <EmptyState
        icon={Monitor}
        title="No Datto RMM Site Mapped"
        description="This customer doesn't have a Datto RMM site linked. Go to Adminland > Integrations to map a site."
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards — Animated counters */}
      <motion.div
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {STAT_CARDS.map(stat => (
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
                <AnimatedCounter value={deviceCounts[stat.key]} className="text-2xl font-bold text-foreground" />
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Last synced */}
      {lastSynced && (
        <p className="text-xs text-muted-foreground text-right">
          Last synced: {safeFormatDate(lastSynced, 'MMM d, yyyy h:mm a')}
        </p>
      )}

      {/* Filters & Actions */}
      <motion.div {...fadeInUp} className="bg-card rounded-[14px] border shadow-hero-sm p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by hostname, IP, or serial..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-9 rounded-hero-md bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          {/* Filter chips */}
          <div className="flex gap-2">
            {['all', 'online', 'offline'].map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-full transition-all duration-[250ms] active:scale-[0.97] capitalize',
                  statusFilter === s
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-muted-foreground hover:bg-zinc-200 dark:hover:bg-zinc-700'
                )}
              >
                {s}
              </button>
            ))}
          </div>
          <Button onClick={syncDevices} disabled={syncing}>
            {syncing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Sync Devices
          </Button>
        </div>
      </motion.div>

      {/* Device List */}
      <div className="bg-card rounded-[14px] border shadow-hero-sm overflow-hidden">
        {isLoading ? (
          <SkeletonTable rows={5} cols={4} className="shadow-none border-0" />
        ) : filteredDevices.length === 0 ? (
          <EmptyState
            icon={Monitor}
            title="No devices found"
            description={search ? 'Try adjusting your search' : 'Sync from Datto RMM to populate devices'}
            action={!search ? { label: 'Sync from Datto RMM', onClick: syncDevices } : undefined}
          />
        ) : (
          <motion.div
            variants={staggerContainer}
            initial="initial"
            animate="animate"
            className="divide-y divide-border/50"
          >
            {filteredDevices.map(device => {
              const DeviceIcon = deviceIcons[device.device_type] || Monitor;
              const status = statusConfig[device.status] || statusConfig.unknown;
              const StatusIcon = status.icon;

              return (
                <motion.div
                  key={device.id}
                  variants={staggerItem}
                  whileHover={{ backgroundColor: 'rgba(0,0,0,0.02)' }}
                  className="p-4 cursor-pointer transition-colors duration-[250ms]"
                  onClick={() => setSelectedDevice(device)}
                >
                  <div className="flex items-center gap-4">
                    <div className={cn("w-11 h-11 rounded-hero-md flex items-center justify-center", status.bg)}>
                      <DeviceIcon className={cn("w-5 h-5", status.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-foreground">{device.hostname}</p>
                        <Badge
                          variant={device.status === 'online' ? 'flat-success' : device.status === 'offline' ? 'flat-destructive' : 'secondary'}
                          className="text-[11px] gap-1"
                        >
                          <StatusIcon className="w-3 h-3" />
                          {status.label}
                        </Badge>
                        {device.notes && <StickyNote className="w-3.5 h-3.5 text-warning" />}
                        {device.assigned_user_id && <User className="w-3.5 h-3.5 text-[#7828C8]" />}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                        {device.operating_system && <span>{device.operating_system}</span>}
                        {device.ip_address && <span>{device.ip_address}</span>}
                        {device.last_user && (
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {device.last_user}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right text-sm hidden sm:block">
                      {device.last_seen && (
                        <p className="text-muted-foreground">
                          Last seen: {safeFormatDate(device.last_seen, 'MMM d, h:mm a')}
                        </p>
                      )}
                      {device.serial_number && (
                        <p className="text-muted-foreground/60 text-xs mt-1">S/N: {device.serial_number}</p>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </div>

      <DeviceDetailModal
        device={selectedDevice}
        open={!!selectedDevice}
        onClose={() => setSelectedDevice(null)}
        customerId={customerId}
      />
    </div>
  );
}
