import React, { useMemo, useState } from 'react';
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
  X,
  Network,
  Cpu
} from 'lucide-react';
import { toast } from 'sonner';
import { cn, safeJsonParse, safeFormatDate, safeFormatDistanceToNow } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
  online: { icon: CheckCircle2, className: 'bg-green-50 text-green-700 border-green-200', label: 'Online' },
  offline: { icon: XCircle, className: 'bg-rose-50 text-rose-700 border-rose-200', label: 'Offline' },
  unknown: { icon: Clock, className: 'bg-slate-50 text-slate-600 border-slate-200', label: 'Unknown' }
};

const typeLabels = {
  desktop: 'Desktop',
  laptop: 'Laptop',
  server: 'Server',
  network: 'Network',
  printer: 'Printer',
  other: 'Other'
};

function getDeviceName(device) {
  return device.hostname || device.name || 'Unknown device';
}

function normalizeStatus(status) {
  return statusConfig[status] ? status : 'unknown';
}

function getTypeLabel(type) {
  if (!type) return 'Other';
  return typeLabels[type] || String(type).replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
}

function getLastSeenSort(value) {
  if (!value) return 0;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.getTime() : 0;
}

function DeviceStatCard({ icon: Icon, label, value, detail, className }) {
  return (
    <motion.div
      variants={staggerItem}
      className="bg-card rounded-lg border shadow-sm p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <AnimatedCounter value={value} className="text-2xl font-bold text-foreground" />
          {detail && <p className="text-xs text-muted-foreground mt-1 truncate">{detail}</p>}
        </div>
        <div className={cn('p-2 rounded-lg border', className)}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </motion.div>
  );
}

function StatusBadge({ status }) {
  const config = statusConfig[normalizeStatus(status)];
  const StatusIcon = config.icon;

  return (
    <Badge variant="outline" className={cn('gap-1.5 text-[11px]', config.className)}>
      <StatusIcon className="w-3 h-3" />
      {config.label}
    </Badge>
  );
}

export default function DevicesTab({ customerId }) {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [syncing, setSyncing] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState(null);

  const queryClient = useQueryClient();

  const { data: devices = [], isLoading } = useQuery({
    queryKey: ['devices', customerId],
    queryFn: () => client.entities.Device.filter({ customer_id: customerId }),
    enabled: !!customerId,
    staleTime: 1000 * 60 * 5
  });

  const { data: mappings = [], isLoading: loadingMappings } = useQuery({
    queryKey: ['datto_mappings', customerId],
    queryFn: () => client.entities.DattoSiteMapping.filter({ customer_id: customerId }),
    enabled: !!customerId,
    staleTime: 1000 * 60 * 5
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ['device-contacts', customerId],
    queryFn: () => client.entities.Contact.filter({ customer_id: customerId }),
    enabled: !!customerId,
    staleTime: 1000 * 60 * 5
  });

  const safeMappings = mappings ?? [];
  const mapping = safeMappings[0] || null;
  const cachedData = mapping?.cached_data ? safeJsonParse(mapping.cached_data) : null;
  const lastSynced = mapping?.last_synced;

  const contactsById = useMemo(() => {
    const map = {};
    contacts.forEach(contact => {
      if (contact.id) map[contact.id] = contact;
    });
    return map;
  }, [contacts]);

  const availableTypes = useMemo(() => (
    Array.from(new Set(devices.map(device => device.device_type || 'other'))).sort()
  ), [devices]);

  const deviceCounts = useMemo(() => {
    const total = devices.length || cachedData?.total_devices || 0;
    const online = devices.length
      ? devices.filter(device => device.status === 'online').length
      : cachedData?.online_count || 0;
    const offline = devices.length
      ? devices.filter(device => device.status === 'offline').length
      : cachedData?.offline_count || 0;
    const servers = devices.length
      ? devices.filter(device => device.device_type === 'server').length
      : cachedData?.server_count || 0;
    const workstations = devices.filter(device => ['desktop', 'laptop'].includes(device.device_type)).length;
    const withUser = devices.filter(device => device.last_user || device.assigned_contact_id).length;

    return { total, online, offline, servers, workstations, withUser };
  }, [cachedData, devices]);

  const lastSeenDevice = useMemo(() => {
    return [...devices]
      .filter(device => device.last_seen)
      .sort((a, b) => getLastSeenSort(b.last_seen) - getLastSeenSort(a.last_seen))[0] || null;
  }, [devices]);

  const filteredDevices = useMemo(() => {
    const query = search.trim().toLowerCase();
    const statusRank = { online: 0, offline: 1, unknown: 2 };

    return devices
      .filter(device => {
        const assignedContact = contactsById[device.assigned_contact_id];
        const matchesSearch = !query || [
          device.name,
          device.hostname,
          device.ip_address,
          device.serial_number,
          device.manufacturer,
          device.model,
          device.operating_system,
          device.os_version,
          device.last_user,
          assignedContact?.full_name,
          assignedContact?.email
        ].some(value => String(value || '').toLowerCase().includes(query));
        const matchesType = typeFilter === 'all' || (device.device_type || 'other') === typeFilter;
        const matchesStatus = statusFilter === 'all' || normalizeStatus(device.status) === statusFilter;
        return matchesSearch && matchesType && matchesStatus;
      })
      .sort((a, b) => {
        const statusDelta = (statusRank[normalizeStatus(a.status)] ?? 3) - (statusRank[normalizeStatus(b.status)] ?? 3);
        if (statusDelta !== 0) return statusDelta;
        return getDeviceName(a).localeCompare(getDeviceName(b));
      });
  }, [contactsById, devices, search, statusFilter, typeFilter]);

  const statusFilters = [
    { key: 'all', label: 'All', count: devices.length },
    { key: 'online', label: 'Online', count: devices.filter(device => device.status === 'online').length },
    { key: 'offline', label: 'Offline', count: devices.filter(device => device.status === 'offline').length },
    { key: 'unknown', label: 'Unknown', count: devices.filter(device => !statusConfig[device.status]).length }
  ].filter(filter => filter.key !== 'unknown' || filter.count > 0);

  const syncDevices = async () => {
    if (safeMappings.length === 0) {
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

  if (loadingMappings) {
    return (
      <div className="space-y-6">
        <SkeletonStats count={4} className="grid-cols-2 lg:grid-cols-4" />
        <SkeletonTable rows={5} cols={5} />
      </div>
    );
  }

  if (safeMappings.length === 0) {
    return (
      <EmptyState
        icon={Monitor}
        title="No Datto RMM site mapped"
        description="This customer does not have a Datto RMM site linked. Go to Adminland > Integrations to map a site."
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Datto RMM Devices</h3>
          <p className="text-sm text-slate-500">
            {mapping?.datto_site_name || 'Mapped Datto site'}
            {lastSynced && <span> - Last synced {safeFormatDate(lastSynced, 'MMM d, yyyy h:mm a')}</span>}
          </p>
          {lastSeenDevice?.last_seen && (
            <p className="text-xs text-slate-400 mt-1">
              Most recent heartbeat: {safeFormatDistanceToNow(lastSeenDevice.last_seen, { addSuffix: true }, 'Unknown')}
            </p>
          )}
        </div>
        <Button onClick={syncDevices} disabled={syncing} className="gap-2 self-start">
          {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {syncing ? 'Syncing...' : 'Sync Devices'}
        </Button>
      </div>

      <motion.div
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        className="grid grid-cols-2 xl:grid-cols-4 gap-4"
      >
        <DeviceStatCard
          icon={Monitor}
          label="Total devices"
          value={deviceCounts.total}
          detail={`${deviceCounts.workstations} workstations`}
          className="bg-cyan-50 text-cyan-700 border-cyan-100"
        />
        <DeviceStatCard
          icon={CheckCircle2}
          label="Online"
          value={deviceCounts.online}
          detail={deviceCounts.total ? `${Math.round((deviceCounts.online / deviceCounts.total) * 100)}% online` : 'No devices'}
          className="bg-green-50 text-green-700 border-green-100"
        />
        <DeviceStatCard
          icon={XCircle}
          label="Offline"
          value={deviceCounts.offline}
          detail="Not currently connected"
          className="bg-rose-50 text-rose-700 border-rose-100"
        />
        <DeviceStatCard
          icon={Server}
          label="Servers"
          value={deviceCounts.servers}
          detail={`${deviceCounts.withUser} with user/contact`}
          className="bg-violet-50 text-violet-700 border-violet-100"
        />
      </motion.div>

      <motion.div {...fadeInUp} className="bg-card rounded-lg border shadow-sm p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative min-w-[260px] flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search device, IP, serial, user, or model"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="pl-9 pr-9"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:flex-nowrap">
            {statusFilters.map(filter => (
              <button
                key={filter.key}
                type="button"
                onClick={() => setStatusFilter(filter.key)}
                className={cn(
                  'whitespace-nowrap px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                  statusFilter === filter.key
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                )}
              >
                {filter.label}
                <span className={cn('ml-1.5', statusFilter === filter.key ? 'text-white/70' : 'text-slate-400')}>
                  {filter.count}
                </span>
              </button>
            ))}

            {availableTypes.length > 1 && (
              <div className="flex flex-wrap items-center gap-2 lg:flex-nowrap">
                {['all', ...availableTypes].map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setTypeFilter(type)}
                    className={cn(
                      'whitespace-nowrap px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                      typeFilter === type
                        ? 'bg-cyan-600 text-white'
                        : 'bg-cyan-50 text-cyan-700 hover:bg-cyan-100'
                    )}
                  >
                    {type === 'all' ? 'All types' : getTypeLabel(type)}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </motion.div>

      <div className="bg-card rounded-lg border shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="font-semibold text-slate-900">Device inventory</h4>
            <p className="text-sm text-slate-500">Showing {filteredDevices.length} of {devices.length} Datto RMM devices.</p>
          </div>
          <Badge variant="outline">{mapping?.datto_site_name || 'Datto site'}</Badge>
        </div>

        {isLoading ? (
          <SkeletonTable rows={6} cols={5} className="shadow-none border-0" />
        ) : filteredDevices.length === 0 ? (
          <EmptyState
            icon={Monitor}
            title="No devices found"
            description={search || statusFilter !== 'all' || typeFilter !== 'all' ? 'Try adjusting the search or filters.' : 'Sync from Datto RMM to populate devices.'}
            action={!search && statusFilter === 'all' && typeFilter === 'all' ? { label: 'Sync from Datto RMM', onClick: syncDevices } : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-[980px]">
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>Device</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last seen</TableHead>
                  <TableHead>OS / Hardware</TableHead>
                  <TableHead>Network / User</TableHead>
                  <TableHead className="text-right">Info</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDevices.map(device => {
                  const type = device.device_type || 'other';
                  const DeviceIcon = deviceIcons[type] || Monitor;
                  const assignedContact = contactsById[device.assigned_contact_id];
                  const hardware = [device.manufacturer, device.model].filter(Boolean).join(' ');
                  const os = [device.operating_system, device.os_version].filter(Boolean).join(' ');

                  return (
                    <TableRow
                      key={device.id}
                      className="cursor-pointer hover:bg-slate-50"
                      onClick={() => setSelectedDevice(device)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-lg bg-slate-50 flex items-center justify-center flex-shrink-0">
                            <DeviceIcon className="w-4 h-4 text-slate-600" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 truncate">{getDeviceName(device)}</p>
                            <p className="text-xs text-slate-500 truncate">{getTypeLabel(type)}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={device.status} />
                      </TableCell>
                      <TableCell className="text-slate-600">
                        <div>{safeFormatDistanceToNow(device.last_seen, { addSuffix: true }, 'Unknown')}</div>
                        <div className="text-xs text-slate-400">{safeFormatDate(device.last_seen, 'MMM d, yyyy h:mm a', '')}</div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1 max-w-[260px]">
                          <div className="flex items-center gap-2 text-slate-700">
                            <Cpu className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                            <span className="truncate">{os || 'Unknown OS'}</span>
                          </div>
                          {hardware && <div className="text-xs text-slate-500 truncate">{hardware}</div>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1 max-w-[260px]">
                          <div className="flex items-center gap-2 text-slate-700">
                            <Network className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                            <span className="truncate">{device.ip_address || 'No IP'}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <User className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                            <span className="truncate">{assignedContact?.full_name || device.last_user || 'No user linked'}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {device.notes && (
                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 gap-1">
                              <StickyNote className="w-3 h-3" />
                              Notes
                            </Badge>
                          )}
                          {device.serial_number && (
                            <span className="hidden xl:inline text-xs text-slate-400 font-mono">
                              {device.serial_number}
                            </span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
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
