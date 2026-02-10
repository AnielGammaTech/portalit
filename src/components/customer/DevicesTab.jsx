import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  StickyNote
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from "@/lib/utils";
import { format, parseISO } from 'date-fns';
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
  online: { icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-100', label: 'Online' },
  offline: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-100', label: 'Offline' },
  unknown: { icon: Clock, color: 'text-slate-400', bg: 'bg-slate-100', label: 'Unknown' }
};

export default function DevicesTab({ customerId, customerExternalId }) {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [syncing, setSyncing] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState(null);

  const queryClient = useQueryClient();

  const { data: devices = [], isLoading } = useQuery({
    queryKey: ['devices', customerId],
    queryFn: () => base44.entities.Device.filter({ customer_id: customerId }),
    enabled: !!customerId
  });

  const { data: mappings = [], isLoading: loadingMappings } = useQuery({
    queryKey: ['datto_mappings', customerId],
    queryFn: () => base44.entities.DattoSiteMapping.filter({ customer_id: customerId }),
    enabled: !!customerId,
    staleTime: 0,
    refetchOnMount: 'always'
  });

  const syncDevices = async () => {
    if (mappings.length === 0) {
      toast.error('No Datto RMM site mapped to this customer');
      return;
    }
    setSyncing(true);
    try {
      const response = await base44.functions.invoke('syncDattoRMMDevices', { 
        action: 'sync_devices',
        customer_id: customerId
      });
      if (response.data.success) {
        toast.success(`Synced ${response.data.recordsSynced} devices from Datto RMM`);
        queryClient.invalidateQueries({ queryKey: ['devices', customerId] });
      } else {
        toast.error(response.data.error || 'Sync failed');
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
    total: devices.length,
    online: devices.filter(d => d.status === 'online').length,
    offline: devices.filter(d => d.status === 'offline').length,
    byType: devices.reduce((acc, d) => {
      acc[d.device_type] = (acc[d.device_type] || 0) + 1;
      return acc;
    }, {})
  };

  // Show loading while checking mappings
  if (loadingMappings) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
        <RefreshCw className="w-8 h-8 text-slate-300 animate-spin mx-auto mb-4" />
        <p className="text-slate-500">Checking Datto RMM configuration...</p>
      </div>
    );
  }

  if (mappings.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
        <Monitor className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-slate-900 mb-2">No Datto RMM Site Mapped</h3>
        <p className="text-slate-500 mb-4">
          This customer doesn't have a Datto RMM site linked. Go to Settings to map a site.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <Monitor className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{deviceCounts.total}</p>
              <p className="text-xs text-slate-500">Total Devices</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{deviceCounts.online}</p>
              <p className="text-xs text-slate-500">Online</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
              <XCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{deviceCounts.offline}</p>
              <p className="text-xs text-slate-500">Offline</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
              <Server className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{deviceCounts.byType?.server || 0}</p>
              <p className="text-xs text-slate-500">Servers</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters & Actions */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search by hostname, IP, or serial..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white"
          >
            <option value="all">All Types</option>
            <option value="desktop">Desktops</option>
            <option value="laptop">Laptops</option>
            <option value="server">Servers</option>
            <option value="network">Network</option>
            <option value="printer">Printers</option>
            <option value="other">Other</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white"
          >
            <option value="all">All Status</option>
            <option value="online">Online</option>
            <option value="offline">Offline</option>
          </select>
          <Button
            onClick={syncDevices}
            disabled={syncing}
            className="gap-2 bg-blue-600 hover:bg-blue-700"
          >
            <RefreshCw className={cn("w-4 h-4", syncing && "animate-spin")} />
            Sync Devices
          </Button>
        </div>
      </div>

      {/* Device List */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center">
            <RefreshCw className="w-8 h-8 text-slate-300 animate-spin mx-auto mb-4" />
            <p className="text-slate-500">Loading devices...</p>
          </div>
        ) : filteredDevices.length === 0 ? (
          <div className="p-12 text-center">
            <Monitor className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">No devices found</p>
            <Button
              onClick={syncDevices}
              disabled={syncing}
              variant="outline"
              className="mt-4 gap-2"
            >
              <RefreshCw className={cn("w-4 h-4", syncing && "animate-spin")} />
              Sync from Datto RMM
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredDevices.map(device => {
              const DeviceIcon = deviceIcons[device.device_type] || Monitor;
              const status = statusConfig[device.status] || statusConfig.unknown;
              const StatusIcon = status.icon;

              return (
                <div 
                  key={device.id} 
                  className="p-4 hover:bg-slate-50 transition-colors cursor-pointer"
                  onClick={() => setSelectedDevice(device)}
                >
                  <div className="flex items-center gap-4">
                    <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", status.bg)}>
                      <DeviceIcon className={cn("w-6 h-6", status.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-slate-900">{device.hostname}</p>
                        <Badge className={cn(
                          "text-xs",
                          device.status === 'online' && "bg-emerald-100 text-emerald-700",
                          device.status === 'offline' && "bg-red-100 text-red-700",
                          device.status === 'unknown' && "bg-slate-100 text-slate-600"
                        )}>
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {status.label}
                        </Badge>
                        {device.notes && (
                          <StickyNote className="w-3.5 h-3.5 text-amber-500" />
                        )}
                        {device.assigned_user_id && (
                          <User className="w-3.5 h-3.5 text-purple-500" />
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-slate-500 mt-1">
                        {device.os && <span>{device.os}</span>}
                        {device.ip_address && <span>{device.ip_address}</span>}
                        {device.last_user && (
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {device.last_user}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right text-sm">
                      {device.last_seen && (
                        <p className="text-slate-500">
                          Last seen: {format(parseISO(device.last_seen), 'MMM d, h:mm a')}
                        </p>
                      )}
                      {device.serial_number && (
                        <p className="text-slate-400 text-xs mt-1">S/N: {device.serial_number}</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
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