import React, { useState } from 'react';
import { client } from '@/api/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ShieldAlert,
  RefreshCw,
  Search,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Activity,
  Clock,
  User,
  Globe,
  Calendar,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from "@/lib/utils";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { EmptyState } from "@/components/ui/empty-state";
import { motion } from 'framer-motion';
import { staggerContainer, staggerItem, fadeInUp } from '@/lib/motion';

const severityConfig = {
  critical: { color: 'bg-red-100 text-red-700 border-red-200', cardBg: 'bg-red-50', cardBorder: 'border-red-200', icon: AlertTriangle, label: 'Critical' },
  high: { color: 'bg-orange-100 text-orange-700 border-orange-200', cardBg: 'bg-orange-50', cardBorder: 'border-orange-200', icon: AlertCircle, label: 'High' },
  medium: { color: 'bg-yellow-100 text-yellow-700 border-yellow-200', cardBg: 'bg-yellow-50', cardBorder: 'border-yellow-200', icon: AlertCircle, label: 'Medium' },
  low: { color: 'bg-blue-100 text-blue-700 border-blue-200', cardBg: 'bg-blue-50', cardBorder: 'border-blue-200', icon: Activity, label: 'Low' },
  info: { color: 'bg-slate-100 text-slate-700 border-slate-200', cardBg: 'bg-slate-50', cardBorder: 'border-slate-200', icon: Activity, label: 'Info' },
};

export default function SaaSAlertsTab({ customerId, saasAlertsMapping, queryClient }) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState('all');

  const cachedData = React.useMemo(() => {
    if (!saasAlertsMapping?.cached_data) return null;
    return typeof saasAlertsMapping.cached_data === 'string'
      ? (() => { try { return JSON.parse(saasAlertsMapping.cached_data); } catch { return null; } })()
      : saasAlertsMapping.cached_data;
  }, [saasAlertsMapping?.cached_data]);

  const summary = cachedData?.summary || { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  const recentEvents = cachedData?.recent_events || [];
  const monitoredApps = cachedData?.monitored_apps || [];
  const totalEvents = cachedData?.total_events || 0;

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const response = await client.functions.invoke('syncSaaSAlerts', {
        action: 'sync_alerts',
        customer_id: customerId,
      });
      if (response.success) {
        toast.success(`Synced ${response.total_events || 0} events`);
        queryClient.invalidateQueries({ queryKey: ['saas-alerts-mapping', customerId] });
      } else {
        toast.error(response.error || 'Sync failed');
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const filteredEvents = recentEvents.filter(event => {
    if (severityFilter !== 'all' && (event.severity || '').toLowerCase() !== severityFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        (event.user || '').toLowerCase().includes(q) ||
        (event.event_type || '').toLowerCase().includes(q) ||
        (event.description || '').toLowerCase().includes(q) ||
        (event.product || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  if (!saasAlertsMapping) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="SaaS Alerts not configured"
        description="Go to Adminland > Integrations to map this customer's SaaS Alerts account."
      />
    );
  }

  return (
    <motion.div {...fadeInUp} className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-purple-500" />
            SaaS Alerts
          </h3>
          <p className="text-sm text-muted-foreground">
            Tenant: {saasAlertsMapping.saas_alerts_customer_name}
            {saasAlertsMapping.last_synced && (
              <span className="ml-2">
                • Last sync: {new Date(saasAlertsMapping.last_synced).toLocaleString()}
              </span>
            )}
          </p>
        </div>
        <Button onClick={handleSync} disabled={isSyncing} variant="outline" size="sm">
          <RefreshCw className={`w-4 h-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
          Sync Events
        </Button>
      </div>

      {/* Severity Summary Cards */}
      <motion.div variants={staggerContainer} initial="initial" animate="animate" className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { key: 'critical', label: 'Critical', value: summary.critical, color: 'text-red-600', bg: 'bg-red-50', border: summary.critical > 0 ? 'border-red-200' : '' },
          { key: 'high', label: 'High', value: summary.high, color: 'text-orange-600', bg: 'bg-orange-50', border: summary.high > 0 ? 'border-orange-200' : '' },
          { key: 'medium', label: 'Medium', value: summary.medium, color: 'text-yellow-600', bg: 'bg-yellow-50', border: '' },
          { key: 'low', label: 'Low', value: summary.low, color: 'text-blue-600', bg: 'bg-blue-50', border: '' },
          { key: 'info', label: 'Info', value: summary.info, color: 'text-slate-600', bg: 'bg-slate-50', border: '' },
        ].map(stat => (
          <motion.div key={stat.key} variants={staggerItem} className={cn("rounded-[14px] border shadow-hero-sm p-3", stat.bg, stat.border)}>
            <AnimatedCounter value={stat.value} className={cn("text-2xl font-bold", stat.color)} />
            <p className="text-xs text-muted-foreground">{stat.label}</p>
          </motion.div>
        ))}
      </motion.div>

      {/* Monitored Apps */}
      {monitoredApps.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <span className="text-xs font-medium text-muted-foreground py-1">Monitored:</span>
          {monitoredApps.map(app => (
            <Badge key={app} variant="outline" className="text-xs">
              <Globe className="w-3 h-3 mr-1" /> {app}
            </Badge>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search events..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          className="text-sm border rounded-md px-3 py-2"
        >
          <option value="all">All Severities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
          <option value="info">Info</option>
        </select>
      </div>

      {/* Events Table */}
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-base flex items-center justify-between">
            <span>Recent Events ({filteredEvents.length})</span>
            {totalEvents > 0 && (
              <span className="text-xs font-normal text-muted-foreground">{totalEvents} total in last 7 days</span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filteredEvents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {recentEvents.length === 0 ? (
                <>
                  <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-300 mb-3" />
                  <p>No events found</p>
                  <p className="text-sm">Click "Sync Events" to pull from SaaS Alerts</p>
                </>
              ) : (
                <p>No events match your filters</p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 dark:bg-zinc-800/50 border-y">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs uppercase">Severity</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs uppercase">Time</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs uppercase">User</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs uppercase">Event</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs uppercase">App</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs uppercase">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {filteredEvents.map((event, idx) => {
                    const severity = (event.severity || 'info').toLowerCase();
                    const sevConf = severityConfig[severity] || severityConfig.info;
                    const SevIcon = sevConf.icon;

                    return (
                      <tr key={event.id || idx} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                        <td className="px-4 py-2.5">
                          <Badge className={cn("text-xs gap-1", sevConf.color)}>
                            <SevIcon className="w-3 h-3" />
                            {sevConf.label}
                          </Badge>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                          {event.timestamp ? (
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(event.timestamp).toLocaleString()}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="flex items-center gap-1 text-xs">
                            <User className="w-3 h-3 text-muted-foreground" />
                            {event.user || 'Unknown'}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-xs font-medium">{event.event_type || '—'}</td>
                        <td className="px-4 py-2.5">
                          {event.product && event.product !== 'Unknown' ? (
                            <Badge variant="outline" className="text-xs">{event.product}</Badge>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground max-w-[200px] truncate">
                          {event.description || '—'}
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
