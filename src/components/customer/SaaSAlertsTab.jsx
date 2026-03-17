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
  Wifi,
  MapPin,
  Server,
  Eye,
  Shield,
  TrendingUp,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";

// Safely convert any value to a renderable string
function safeStr(val, fallback = '') {
  if (val == null) return fallback;
  if (typeof val === 'string') return val;
  if (typeof val === 'object') return val.name || val.email || val.displayName || val.id || fallback;
  return String(val);
}

function formatTimeAgo(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString();
}

const severityConfig = {
  critical: { color: 'bg-red-100 text-red-700 border-red-200', dot: 'bg-red-500', label: 'Critical', ring: 'ring-red-500/20' },
  high: { color: 'bg-orange-100 text-orange-700 border-orange-200', dot: 'bg-orange-500', label: 'High', ring: 'ring-orange-500/20' },
  medium: { color: 'bg-yellow-100 text-yellow-700 border-yellow-200', dot: 'bg-yellow-500', label: 'Medium', ring: 'ring-yellow-500/20' },
  low: { color: 'bg-blue-100 text-blue-700 border-blue-200', dot: 'bg-blue-500', label: 'Low', ring: 'ring-blue-500/20' },
  info: { color: 'bg-slate-100 text-slate-600 border-slate-200', dot: 'bg-slate-400', label: 'Info', ring: 'ring-slate-500/20' },
};

function SeverityDot({ severity }) {
  const conf = severityConfig[severity] || severityConfig.info;
  return <span className={cn("w-2 h-2 rounded-full inline-block flex-shrink-0", conf.dot)} />;
}

export default function SaaSAlertsTab({ customerId, saasAlertsMapping, queryClient }) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [expandedEvent, setExpandedEvent] = useState(null);

  const cachedData = React.useMemo(() => {
    try {
      if (!saasAlertsMapping?.cached_data) return null;
      return typeof saasAlertsMapping.cached_data === 'string'
        ? JSON.parse(saasAlertsMapping.cached_data)
        : saasAlertsMapping.cached_data;
    } catch {
      return null;
    }
  }, [saasAlertsMapping?.cached_data]);

  const summary = cachedData?.summary || { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  const recentEvents = cachedData?.recent_events || [];
  const monitoredApps = cachedData?.monitored_apps || [];
  const totalEvents = cachedData?.total_events || 0;
  const uniqueUsers = cachedData?.unique_users || [];
  const eventTypeCounts = cachedData?.event_type_counts || {};
  const vpnEvents = cachedData?.vpn_events || 0;
  const threatEvents = cachedData?.threat_events || 0;
  const datacenterEvents = cachedData?.datacenter_events || 0;
  const countryCounts = cachedData?.country_counts || {};

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
    const sev = safeStr(event.severity, 'info').toLowerCase();
    if (severityFilter !== 'all' && sev !== severityFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        safeStr(event.user).toLowerCase().includes(q) ||
        safeStr(event.event_type).toLowerCase().includes(q) ||
        safeStr(event.description).toLowerCase().includes(q) ||
        safeStr(event.product).toLowerCase().includes(q) ||
        safeStr(event.ip_address).toLowerCase().includes(q) ||
        safeStr(event.app_name).toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Count non-info events for "actionable alerts"
  const actionableCount = summary.critical + summary.high + summary.medium;

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
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-violet-500" />
            SaaS Alerts
          </h3>
          <p className="text-sm text-muted-foreground">
            {safeStr(saasAlertsMapping.saas_alerts_customer_name, 'Unknown')}
            {saasAlertsMapping.last_synced && (
              <span className="ml-2 text-xs">
                · Synced {formatTimeAgo(saasAlertsMapping.last_synced)}
              </span>
            )}
          </p>
        </div>
        <Button onClick={handleSync} disabled={isSyncing} variant="outline" size="sm" className="gap-2">
          <RefreshCw className={cn("w-3.5 h-3.5", isSyncing && "animate-spin")} />
          {isSyncing ? 'Syncing…' : 'Sync Events'}
        </Button>
      </div>

      {/* Dashboard Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Actionable Alerts */}
        <div className={cn(
          "rounded-xl border p-4 shadow-sm",
          actionableCount > 0 ? "bg-red-50 border-red-200" : "bg-white border-gray-200"
        )}>
          <div className="flex items-center gap-2 mb-1">
            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", actionableCount > 0 ? "bg-red-100" : "bg-gray-100")}>
              <AlertTriangle className={cn("w-4 h-4", actionableCount > 0 ? "text-red-600" : "text-gray-400")} />
            </div>
          </div>
          <p className={cn("text-2xl font-bold", actionableCount > 0 ? "text-red-700" : "text-gray-900")}>{actionableCount}</p>
          <p className="text-xs text-muted-foreground">Actionable Alerts</p>
          {actionableCount > 0 && (
            <div className="flex gap-2 mt-2">
              {summary.critical > 0 && <span className="text-[10px] font-medium text-red-600">{summary.critical} critical</span>}
              {summary.high > 0 && <span className="text-[10px] font-medium text-orange-600">{summary.high} high</span>}
              {summary.medium > 0 && <span className="text-[10px] font-medium text-yellow-600">{summary.medium} medium</span>}
            </div>
          )}
        </div>

        {/* Total Events */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center">
              <Activity className="w-4 h-4 text-violet-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">{totalEvents.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">Events (7 days)</p>
          <p className="text-[10px] text-muted-foreground mt-1">{uniqueUsers.length} unique user{uniqueUsers.length !== 1 ? 's' : ''}</p>
        </div>

        {/* VPN / Datacenter */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-sky-50 flex items-center justify-center">
              <Wifi className="w-4 h-4 text-sky-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">{vpnEvents}</p>
          <p className="text-xs text-muted-foreground">VPN Logins</p>
          {datacenterEvents > 0 && (
            <p className="text-[10px] text-muted-foreground mt-1">{datacenterEvents} from datacenters</p>
          )}
        </div>

        {/* Monitored Apps */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
              <Shield className="w-4 h-4 text-emerald-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">{monitoredApps.length}</p>
          <p className="text-xs text-muted-foreground">Monitored Apps</p>
          <div className="flex flex-wrap gap-1 mt-2">
            {monitoredApps.slice(0, 3).map((app, i) => (
              <span key={i} className="text-[10px] px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">{safeStr(app)}</span>
            ))}
            {monitoredApps.length > 3 && (
              <span className="text-[10px] text-muted-foreground">+{monitoredApps.length - 3}</span>
            )}
          </div>
        </div>
      </div>

      {/* Severity Breakdown + Top Event Types (side by side) */}
      {totalEvents > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {/* Severity Breakdown Bar */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Severity Breakdown</h4>
            <div className="space-y-2">
              {['critical', 'high', 'medium', 'low', 'info'].map(level => {
                const count = summary[level] || 0;
                const pct = totalEvents > 0 ? (count / totalEvents * 100) : 0;
                const conf = severityConfig[level];
                return (
                  <div key={level} className="flex items-center gap-3">
                    <span className="text-xs font-medium text-gray-600 w-14">{conf.label}</span>
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className={cn("h-full rounded-full transition-all", conf.dot)} style={{ width: `${Math.max(pct, count > 0 ? 1 : 0)}%` }} />
                    </div>
                    <span className="text-xs font-mono text-muted-foreground w-12 text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top Event Types */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Top Event Types</h4>
            <div className="space-y-2">
              {Object.entries(eventTypeCounts)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 5)
                .map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between gap-2">
                    <span className="text-xs text-gray-700 truncate flex-1">{type}</span>
                    <span className="text-xs font-mono font-medium text-gray-500">{count}</span>
                  </div>
                ))}
              {Object.keys(eventTypeCounts).length === 0 && (
                <p className="text-xs text-muted-foreground">No event data yet</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Geo Summary (compact) */}
      {Object.keys(countryCounts).length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <MapPin className="w-3 h-3" /> Locations:
          </span>
          {Object.entries(countryCounts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 8)
            .map(([country, count]) => (
              <Badge key={country} variant="outline" className="text-xs gap-1 font-normal">
                {country} <span className="font-mono text-muted-foreground">{count}</span>
              </Badge>
            ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search users, events, IPs…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          className="text-sm border rounded-md px-3 py-2 bg-white"
        >
          <option value="all">All Severities</option>
          <option value="critical">Critical ({summary.critical})</option>
          <option value="high">High ({summary.high})</option>
          <option value="medium">Medium ({summary.medium})</option>
          <option value="low">Low ({summary.low})</option>
          <option value="info">Info ({summary.info})</option>
        </select>
      </div>

      {/* Events List */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h4 className="text-sm font-semibold text-gray-900">Recent Events</h4>
            <p className="text-xs text-muted-foreground">{filteredEvents.length} of {recentEvents.length} events shown</p>
          </div>
          {totalEvents > 0 && (
            <span className="text-xs text-muted-foreground">{totalEvents.toLocaleString()} total in 7 days</span>
          )}
        </div>

        {filteredEvents.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            {recentEvents.length === 0 ? (
              <>
                <Shield className="w-10 h-10 mx-auto text-gray-200 mb-3" />
                <p className="font-medium text-gray-500">No events synced</p>
                <p className="text-sm mt-1">Click "Sync Events" to pull from SaaS Alerts</p>
              </>
            ) : (
              <>
                <Search className="w-8 h-8 mx-auto text-gray-200 mb-2" />
                <p className="text-sm">No events match your filters</p>
              </>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredEvents.map((event, idx) => {
              const severity = safeStr(event.severity, 'info').toLowerCase();
              const conf = severityConfig[severity] || severityConfig.info;
              const isExpanded = expandedEvent === (event.id || idx);
              const hasLocation = event.city || event.region || event.country;
              const hasFlags = event.is_vpn || event.is_datacenter || event.is_threat;

              return (
                <div
                  key={event.id || idx}
                  className={cn(
                    "px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer",
                    severity === 'critical' && "bg-red-50/30",
                    severity === 'high' && "bg-orange-50/20"
                  )}
                  onClick={() => setExpandedEvent(isExpanded ? null : (event.id || idx))}
                >
                  <div className="flex items-start gap-3">
                    {/* Severity dot */}
                    <div className="pt-1">
                      <SeverityDot severity={severity} />
                    </div>

                    {/* Main content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-gray-900 truncate">
                          {safeStr(event.description) || safeStr(event.event_type, 'Unknown Event')}
                        </span>
                        <Badge variant="outline" className="text-[10px] font-normal">{safeStr(event.product, '—')}</Badge>
                      </div>

                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {safeStr(event.user, 'Unknown')}
                        </span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatTimeAgo(event.timestamp)}
                        </span>
                        {event.ip_address && (
                          <span className="text-xs text-muted-foreground font-mono">
                            {safeStr(event.ip_address)}
                          </span>
                        )}
                        {hasFlags && (
                          <div className="flex gap-1">
                            {event.is_vpn && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">VPN</span>
                            )}
                            {event.is_datacenter && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-100 text-sky-700 font-medium">DC</span>
                            )}
                            {event.is_threat && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-medium">Threat</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Expand */}
                    <div className="pt-1 text-gray-400">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </div>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="mt-3 ml-5 grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs bg-gray-50 rounded-lg p-3 border border-gray-100">
                      <div>
                        <span className="text-muted-foreground block mb-0.5">Event Type</span>
                        <span className="font-medium">{safeStr(event.event_type, '—')}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block mb-0.5">Application</span>
                        <span className="font-medium">{safeStr(event.app_name) || safeStr(event.user, '—')}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block mb-0.5">IP Address</span>
                        <span className="font-mono">{safeStr(event.ip_address, '—')}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block mb-0.5">Location</span>
                        <span>{hasLocation ? [event.city, event.region, event.country].filter(Boolean).join(', ') : '—'}</span>
                      </div>
                      {event.ip_owner && (
                        <div>
                          <span className="text-muted-foreground block mb-0.5">IP Owner</span>
                          <span>{safeStr(event.ip_owner)}</span>
                        </div>
                      )}
                      <div>
                        <span className="text-muted-foreground block mb-0.5">Severity</span>
                        <Badge className={cn("text-[10px]", conf.color)}>{conf.label}</Badge>
                      </div>
                      {(event.threat_score > 0 || event.trust_score > 0) && (
                        <>
                          <div>
                            <span className="text-muted-foreground block mb-0.5">Threat Score</span>
                            <span className={cn("font-medium", event.threat_score >= 80 ? "text-red-600" : event.threat_score >= 50 ? "text-yellow-600" : "text-green-600")}>
                              {event.threat_score}/100
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block mb-0.5">Trust Score</span>
                            <span className={cn("font-medium", event.trust_score <= 30 ? "text-red-600" : event.trust_score <= 60 ? "text-yellow-600" : "text-green-600")}>
                              {event.trust_score}/100
                            </span>
                          </div>
                        </>
                      )}
                      <div className="col-span-full">
                        <span className="text-muted-foreground block mb-0.5">Full Timestamp</span>
                        <span>{event.timestamp ? new Date(event.timestamp).toLocaleString() : '—'}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
