import React, { useState } from 'react';
import { client } from '@/api/client';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Wifi,
  RefreshCw,
  Search,
  Monitor,
  Radio,
  ArrowUpDown,
  CheckCircle2,
  XCircle,
  Shield,
  Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from "@/lib/utils";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { EmptyState } from "@/components/ui/empty-state";
import { motion } from 'framer-motion';
import { staggerContainer, staggerItem, fadeInUp } from '@/lib/motion';

const deviceTypeConfig = {
  firewall: { label: 'Firewall', icon: Shield, color: 'text-red-600', bg: 'bg-red-50' },
  switch: { label: 'Switch', icon: ArrowUpDown, color: 'text-blue-600', bg: 'bg-blue-50' },
  access_point: { label: 'Access Point', icon: Radio, color: 'text-green-600', bg: 'bg-green-50' },
  other: { label: 'Other', icon: Monitor, color: 'text-slate-600', bg: 'bg-slate-50' },
};

export default function UniFiTab({ customerId, unifiMapping, queryClient }) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  const cachedData = React.useMemo(() => {
    if (!unifiMapping?.cached_data) return null;
    return typeof unifiMapping.cached_data === 'string'
      ? (() => { try { return JSON.parse(unifiMapping.cached_data); } catch { return null; } })()
      : unifiMapping.cached_data;
  }, [unifiMapping?.cached_data]);

  const devices = cachedData?.devices || [];
  const summary = cachedData?.summary || { total: 0, online: 0, offline: 0, firewalls: 0, switches: 0, access_points: 0 };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const response = await client.functions.invoke('syncUniFiDevices', {
        action: 'sync_devices',
        customer_id: customerId,
      });
      if (response.success) {
        toast.success(`Synced ${response.recordsSynced} devices`);
        queryClient.invalidateQueries({ queryKey: ['unifi-mapping', customerId] });
      } else {
        toast.error(response.error || 'Sync failed');
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const filteredDevices = devices.filter(device => {
    if (typeFilter !== 'all' && device.type !== typeFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        (device.name || '').toLowerCase().includes(q) ||
        (device.ip || '').includes(q) ||
        (device.mac || '').toLowerCase().includes(q) ||
        (device.model || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  if (!unifiMapping) {
    return (
      <EmptyState
        icon={Wifi}
        title="UniFi not configured"
        description="Go to Adminland > Integrations to map this customer's UniFi site."
      />
    );
  }

  return (
    <motion.div {...fadeInUp} className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Wifi className="w-5 h-5 text-blue-500" />
            UniFi Network
          </h3>
          <p className="text-sm text-muted-foreground">
            Site: {unifiMapping.unifi_site_name}
            {unifiMapping.last_synced && (
              <span className="ml-2">
                • Last sync: {new Date(unifiMapping.last_synced).toLocaleString()}
              </span>
            )}
          </p>
        </div>
        <Button onClick={handleSync} disabled={isSyncing} variant="outline" size="sm">
          <RefreshCw className={`w-4 h-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
          Sync Devices
        </Button>
      </div>

      {/* Summary Cards */}
      <motion.div variants={staggerContainer} initial="initial" animate="animate" className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {[
          { label: 'Total', value: summary.total, color: 'text-foreground', bg: 'bg-zinc-50' },
          { label: 'Online', value: summary.online, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Offline', value: summary.offline, color: 'text-red-600', bg: 'bg-red-50' },
          { label: 'Firewalls', value: summary.firewalls, color: 'text-red-600', bg: 'bg-red-50' },
          { label: 'Switches', value: summary.switches, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'APs', value: summary.access_points, color: 'text-green-600', bg: 'bg-green-50' },
        ].map(stat => (
          <motion.div key={stat.label} variants={staggerItem} className={cn("rounded-[14px] border shadow-hero-sm p-3", stat.bg)}>
            <AnimatedCounter value={stat.value} className={cn("text-2xl font-bold", stat.color)} />
            <p className="text-xs text-muted-foreground">{stat.label}</p>
          </motion.div>
        ))}
      </motion.div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search devices..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="text-sm border rounded-md px-3 py-2"
        >
          <option value="all">All Types</option>
          <option value="firewall">Firewalls</option>
          <option value="switch">Switches</option>
          <option value="access_point">Access Points</option>
          <option value="other">Other</option>
        </select>
      </div>

      {/* Device Table */}
      <Card>
        <CardContent className="p-0">
          {filteredDevices.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {devices.length === 0 ? (
                <>
                  <Wifi className="w-12 h-12 mx-auto text-zinc-300 mb-3" />
                  <p>No devices found</p>
                  <p className="text-sm">Click "Sync Devices" to pull from UniFi</p>
                </>
              ) : (
                <p>No devices match your filters</p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 dark:bg-zinc-800/50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase">Status</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase">Name</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase">Type</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase">Model</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase">IP Address</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase">MAC</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase">Firmware</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase">Uptime</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {filteredDevices.map((device, idx) => {
                    const typeConf = deviceTypeConfig[device.type] || deviceTypeConfig.other;
                    const TypeIcon = typeConf.icon;
                    const isOnline = device.status === 'online';

                    return (
                      <tr key={device.mac || idx} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                        <td className="px-4 py-3">
                          {isOnline ? (
                            <Badge className="bg-emerald-100 text-emerald-700 text-xs gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Online
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-red-600 border-red-200 text-xs gap-1">
                              <XCircle className="w-3 h-3" /> Offline
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 font-medium">{device.name}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <TypeIcon className={cn("w-3.5 h-3.5", typeConf.color)} />
                            <span className="text-xs">{typeConf.label}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{device.model_name || device.model}</td>
                        <td className="px-4 py-3 font-mono text-xs">{device.ip || '—'}</td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{device.mac}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{device.firmware || '—'}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {device.uptime ? (
                            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{device.uptime}</span>
                          ) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
