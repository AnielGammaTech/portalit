import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { client } from '@/api/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SkeletonStats, SkeletonTable, Shimmer } from "@/components/ui/shimmer-skeleton";
import { 
  Shield, 
  AlertTriangle, 
  AlertCircle,
  CheckCircle2,
  Clock,
  RefreshCw,
  Monitor,
  Calendar,
  Activity,
  X,
  Database,
  Wifi,
  WifiOff
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ExternalLink, Mail, MapPin, User } from 'lucide-react';

// Helper to parse structured alert details from description
const parseAlertDetails = (description) => {
  if (!description) return null;
  
  const details = {};
  
  // Extract email
  const emailMatch = description.match(/Email:\s*([^\s|•]+)/i);
  if (emailMatch) details.email = emailMatch[1];
  
  // Extract name
  const nameMatch = description.match(/Name:\s*([^|•\n]+)/i);
  if (nameMatch) details.name = nameMatch[1].trim();
  
  // Extract Risk Type
  const riskTypeMatch = description.match(/Risk Type:\s*([^|•\n]+)/i);
  if (riskTypeMatch) details.riskType = riskTypeMatch[1].trim();
  
  // Extract Risk Level
  const riskLevelMatch = description.match(/Risk Level:\s*([^|•\n]+)/i);
  if (riskLevelMatch) details.riskLevel = riskLevelMatch[1].trim();
  
  // Extract Location (City, State, Country)
  const locationMatch = description.match(/Country:\s*([^|•\n]+).*?State:\s*([^|•\n]+).*?City:\s*([^|•\n]+)/i) ||
                       description.match(/City:\s*([^|•\n]+).*?State:\s*([^|•\n]+).*?Country:\s*([^|•\n]+)/i);
  if (locationMatch) {
    details.location = `${locationMatch[3] || locationMatch[1]}, ${locationMatch[2]}, ${locationMatch[1] || locationMatch[3]}`.replace(/\s+/g, ' ').trim();
  }
  
  // Extract IP
  const ipMatch = description.match(/IP:\s*([0-9.]+)/i);
  if (ipMatch) details.ip = ipMatch[1];
  
  // Extract Organization
  const orgMatch = description.match(/Organization:\s*([^(•\n]+)/i);
  if (orgMatch) details.organization = orgMatch[1].trim();
  
  // Extract RocketCyber link
  const rcLinkMatch = description.match(/(https:\/\/app\.rocketcyber\.com[^\s•]+)/i);
  if (rcLinkMatch) details.rocketcyberUrl = rcLinkMatch[1];
  
  // Get the main message (before ===)
  const mainMessage = description.split(/={3,}/)[0]?.trim();
  if (mainMessage) details.summary = mainMessage;
  
  return Object.keys(details).length > 0 ? details : null;
};

const severityConfig = {
  critical: { color: 'bg-red-100 text-red-700 border-red-200', icon: AlertTriangle, label: 'Critical' },
  high: { color: 'bg-orange-100 text-orange-700 border-orange-200', icon: AlertCircle, label: 'High' },
  medium: { color: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: AlertCircle, label: 'Medium' },
  low: { color: 'bg-blue-100 text-blue-700 border-blue-200', icon: Activity, label: 'Low' },
  informational: { color: 'bg-slate-100 text-slate-700 border-slate-200', icon: Activity, label: 'Info' }
};

const statusConfig = {
  open: { color: 'bg-red-100 text-red-700', label: 'Open' },
  investigating: { color: 'bg-yellow-100 text-yellow-700', label: 'Investigating' },
  resolved: { color: 'bg-green-100 text-green-700', label: 'Resolved' },
  closed: { color: 'bg-slate-100 text-slate-700', label: 'Closed' }
};

function parseCachedData(value) {
  if (!value) return null;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
  return value;
}

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function formatDateTime(value) {
  const date = parseDate(value);
  return date ? date.toLocaleString() : 'Never';
}

function timeAgo(value) {
  const date = parseDate(value);
  if (!date) return 'Never synced';
  const diffMs = Math.max(0, Date.now() - date.getTime());
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function getAgentStatus(agent) {
  const rawStatus = String(agent?.status || agent?.state || '').trim();
  const normalized = rawStatus.toLowerCase();
  const isOnline = normalized.includes('online') || normalized.includes('active') || normalized.includes('connected');
  const isOffline = normalized.includes('offline') || normalized.includes('inactive') || normalized.includes('disconnected');

  if (isOnline) return { label: rawStatus || 'Online', className: 'bg-green-50 text-green-700 border-green-200', icon: Wifi };
  if (isOffline) return { label: rawStatus || 'Offline', className: 'bg-slate-100 text-slate-600 border-slate-200', icon: WifiOff };
  return null;
}

function getAgentIp(agent) {
  return agent?.ip || agent?.ipAddress || agent?.privateIp || agent?.localIp || '';
}

export default function RocketCyberTab({ customer, rocketcyberMapping = null }) {
  const queryClient = useQueryClient();
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [closingId, setClosingId] = useState(null);
  const customerId = customer?.id;

  // Fetch mapping
  const { data: queriedMapping = null, isLoading: loadingMapping } = useQuery({
    queryKey: ['rocketcyber-mapping', customerId],
    queryFn: async () => {
      const mappings = await client.entities.RocketCyberMapping.filter({ customer_id: customerId });
      return (mappings ?? [])[0] || null;
    },
    enabled: !!customerId && !rocketcyberMapping,
    staleTime: 5 * 60 * 1000,
  });

  const mapping = rocketcyberMapping || queriedMapping;

  const cachedData = useMemo(
    () => parseCachedData(mapping?.cached_data),
    [mapping?.cached_data],
  );
  const cachedAgents = useMemo(
    () => Array.isArray(cachedData?.agents) ? cachedData.agents : [],
    [cachedData?.agents],
  );
  const cachedRecentIncidents = useMemo(() => {
    if (Array.isArray(cachedData?.recentIncidents)) return cachedData.recentIncidents;
    if (Array.isArray(cachedData?.recent_incidents)) return cachedData.recent_incidents;
    if (Array.isArray(cachedData?.incidents)) return cachedData.incidents;
    return [];
  }, [cachedData]);

  // Fetch incidents
  const { data: dbIncidents = [], isLoading: loadingIncidents, refetch: refetchIncidents } = useQuery({
    queryKey: ['rocketcyber_incidents', customerId],
    queryFn: () => client.entities.RocketCyberIncident.filter({ customer_id: customerId }),
    enabled: !!customerId && !!mapping,
    staleTime: 5 * 60 * 1000,
  });
  const incidents = dbIncidents.length > 0 ? dbIncidents : cachedRecentIncidents;
  const incidentsFromCache = dbIncidents.length === 0 && cachedRecentIncidents.length > 0;
  const fromCache = !!cachedData;
  const lastSynced = mapping?.last_synced || cachedData?.synced_at;
  const lastSyncedDate = parseDate(lastSynced);
  const syncStale = lastSyncedDate ? Date.now() - lastSyncedDate.getTime() > 8 * 60 * 60 * 1000 : !cachedData;

  if (!customerId) return null;

  const syncIncidents = async () => {
    setIsSyncing(true);
    try {
      const result = await client.functions.invoke('syncRocketCyber', {
        action: 'sync_incidents',
        customer_id: customerId
      });
      if (result.success) {
        toast.success(`Refreshed ${result.recordsSynced ?? 0} incidents`);
        await Promise.allSettled([
          refetchIncidents(),
          queryClient.invalidateQueries({ queryKey: ['rocketcyber-mapping', customerId] }),
          queryClient.invalidateQueries({ queryKey: ['rocketcyber_mapping', customerId] }),
          queryClient.invalidateQueries({ queryKey: ['rocketcyber_mappings'] }),
        ]);
      }
    } catch (error) {
      toast.error('Sync failed: ' + error.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCloseIncident = async (incident, e) => {
    e?.stopPropagation();
    setClosingId(incident.id);
    try {
      await client.entities.RocketCyberIncident.update(incident.id, {
        status: 'closed',
        manually_closed: true
      });
      toast.success('Incident closed');
      refetchIncidents();
      if (selectedIncident?.id === incident.id) {
        setSelectedIncident(null);
      }
    } catch (error) {
      toast.error('Failed to close incident');
    } finally {
      setClosingId(null);
    }
  };

  if (loadingMapping && !mapping) {
    return (
      <div className="space-y-6">
        {/* Header skeleton */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Shimmer className="h-6 w-48" />
            <Shimmer className="h-4 w-64" />
          </div>
          <Shimmer className="h-9 w-32 rounded-md" />
        </div>
        {/* Stats skeleton */}
        <SkeletonStats count={4} />
      </div>
    );
  }

  if (!mapping) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Shield className="w-12 h-12 mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-medium text-slate-900 mb-2">RocketCyber data is not connected yet</h3>
          <p className="text-slate-500 mb-4">
            SOC agent and incident details will appear here once they are available for this account.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Filter incidents
  const filteredIncidents = incidents.filter(incident => {
    if (statusFilter !== 'all' && incident.status !== statusFilter) return false;
    if (severityFilter !== 'all' && incident.severity !== severityFilter) return false;
    return true;
  });

  // Stats
  const hasIncidentRows = incidents.length > 0;
  const bySeverity = cachedData?.bySeverity || cachedData?.by_severity || {};
  const stats = {
    agents: toNumber(cachedData?.total_agents ?? cachedData?.totalAgents, cachedAgents.length),
    total: hasIncidentRows ? incidents.length : toNumber(cachedData?.totalIncidents ?? cachedData?.total_incidents),
    open: hasIncidentRows
      ? incidents.filter(i => i.status === 'open' || i.status === 'investigating').length
      : toNumber(cachedData?.openIncidents ?? cachedData?.open_incidents),
    critical: hasIncidentRows
      ? incidents.filter(i => i.severity === 'critical').length
      : toNumber(bySeverity.critical),
    high: hasIncidentRows
      ? incidents.filter(i => i.severity === 'high').length
      : toNumber(bySeverity.high),
  };
  const visibleAgents = cachedAgents.slice(0, 16);
  const hasKnownAgentStatus = cachedAgents.some(agent => getAgentStatus(agent));
  const hasNetworkDetails = cachedAgents.some(agent => getAgentIp(agent) || agent?.lastSeen);
  const showAgentDetailColumn = hasKnownAgentStatus || hasNetworkDetails;
  const agentGridClass = showAgentDetailColumn
    ? 'grid grid-cols-[minmax(180px,1.2fr)_minmax(220px,1fr)] sm:grid-cols-[minmax(200px,1.1fr)_minmax(240px,1fr)_minmax(160px,0.8fr)]'
    : 'grid grid-cols-[minmax(180px,1.1fr)_minmax(220px,1fr)]';

  return (
    <div className="space-y-6">
      {/* Header with Sync */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold flex items-center gap-2 text-slate-900">
              <Shield className="w-5 h-5 text-orange-500" />
              RocketCyber SOC
            </h3>
            {fromCache && (
              <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                <Database className="w-3 h-3 mr-1" />
                Cached
              </Badge>
            )}
            {syncStale && (
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                Sync stale
              </Badge>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Account: {mapping.rc_account_name || mapping.rc_account_id}
            {lastSynced && (
              <span className="ml-2 inline-flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                Synced {timeAgo(lastSynced)}
              </span>
            )}
          </p>
        </div>
        <Button onClick={syncIncidents} disabled={isSyncing} variant="outline" size="sm">
          <RefreshCw className={`w-4 h-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
          Refresh from RocketCyber
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-slate-200">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-slate-900">{stats.agents}</div>
                <p className="text-sm text-slate-500">Security Agents</p>
              </div>
              <Monitor className="w-5 h-5 text-orange-500" />
            </div>
          </CardContent>
        </Card>
        <Card className={stats.open > 0 ? 'border-red-200 bg-red-50' : ''}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <div className={`text-2xl font-bold ${stats.open > 0 ? 'text-red-600' : 'text-slate-900'}`}>
                  {stats.open}
                </div>
                <p className="text-sm text-slate-500">Open/Active</p>
              </div>
              <AlertCircle className={`w-5 h-5 ${stats.open > 0 ? 'text-red-500' : 'text-slate-300'}`} />
            </div>
          </CardContent>
        </Card>
        <Card className={stats.critical > 0 ? 'border-red-200 bg-red-50' : ''}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <div className={`text-2xl font-bold ${stats.critical > 0 ? 'text-red-600' : 'text-slate-900'}`}>
                  {stats.critical}
                </div>
                <p className="text-sm text-slate-500">Critical</p>
              </div>
              <AlertTriangle className={`w-5 h-5 ${stats.critical > 0 ? 'text-red-500' : 'text-slate-300'}`} />
            </div>
          </CardContent>
        </Card>
        <Card className={stats.high > 0 ? 'border-orange-200 bg-orange-50' : ''}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <div className={`text-2xl font-bold ${stats.high > 0 ? 'text-orange-600' : 'text-slate-900'}`}>
                  {stats.high}
                </div>
                <p className="text-sm text-slate-500">High Severity</p>
              </div>
              <Activity className={`w-5 h-5 ${stats.high > 0 ? 'text-orange-500' : 'text-slate-300'}`} />
            </div>
          </CardContent>
        </Card>
      </div>

      {cachedAgents.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base">Cached Endpoint Inventory</CardTitle>
                <p className="text-sm text-slate-500">
                  {cachedAgents.length} cached agent{cachedAgents.length !== 1 ? 's' : ''}
                  {lastSynced && <> · Last refreshed {formatDateTime(lastSynced)}</>}
                </p>
              </div>
              <Badge variant="outline">{stats.agents} total</Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <div className={`${agentGridClass} bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500`}>
                <div className="px-3 py-2">Endpoint</div>
                <div className="px-3 py-2">Operating System</div>
                {showAgentDetailColumn && (
                  <div className="hidden px-3 py-2 sm:block">{hasKnownAgentStatus ? 'Status' : 'Details'}</div>
                )}
              </div>
              <div className="divide-y divide-slate-100">
                {visibleAgents.map((agent, index) => {
                  const agentStatus = getAgentStatus(agent);
                  const AgentStatusIcon = agentStatus?.icon;
                  const ip = getAgentIp(agent);
                  return (
                    <div
                      key={agent.id || agent.hostname || index}
                      className={`${agentGridClass} items-center bg-white text-sm`}
                    >
                      <div className="min-w-0 px-3 py-2.5">
                        <p className="truncate font-medium text-slate-900">{agent.hostname || agent.name || 'Unnamed agent'}</p>
                      </div>
                      <div className="min-w-0 px-3 py-2.5">
                        <p className="truncate text-slate-600">{agent.os || 'OS not reported'}</p>
                      </div>
                      {showAgentDetailColumn && (
                        <div className="hidden min-w-0 px-3 py-2.5 sm:block">
                          {agentStatus ? (
                            <Badge variant="outline" className={agentStatus.className}>
                              <AgentStatusIcon className="w-3 h-3 mr-1" />
                              {agentStatus.label}
                            </Badge>
                          ) : (
                            <p className="truncate text-xs text-slate-500">
                              {[ip, agent.lastSeen ? `Seen ${timeAgo(agent.lastSeen)}` : null].filter(Boolean).join(' · ')}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            {cachedAgents.length > visibleAgents.length && (
              <p className="mt-3 text-xs text-slate-500">Showing {visibleAgents.length} of {cachedAgents.length} cached agents.</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex gap-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-sm border rounded-md px-3 py-2"
        >
          <option value="all">All Statuses</option>
          <option value="open">Open</option>
          <option value="investigating">Investigating</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>
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
        </select>
      </div>

      {/* Incidents List */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="text-base">
                Security Incidents ({filteredIncidents.length})
              </CardTitle>
              <p className="text-sm text-slate-500">
                {stats.total} total incident{stats.total !== 1 ? 's' : ''} tracked
                {incidentsFromCache && <> · Showing cached recent incidents</>}
              </p>
            </div>
            {loadingIncidents && (
              <Badge variant="outline" className="bg-slate-50 text-slate-600">
                Updating from cache
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loadingIncidents && !fromCache && filteredIncidents.length === 0 ? (
            <SkeletonTable rows={4} cols={4} />
          ) : filteredIncidents.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <CheckCircle2 className="w-12 h-12 mx-auto text-green-300 mb-3" />
              <p>No incidents found</p>
              <p className="text-sm">
                {fromCache ? 'The cached RocketCyber data has no recent incidents.' : 'Click refresh to pull RocketCyber data when needed.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {[...filteredIncidents]
                .sort((a, b) => new Date(b.detected_at || 0) - new Date(a.detected_at || 0))
                .map(incident => {
                  const sevConfig = severityConfig[incident.severity] || severityConfig.medium;
                  const statConfig = statusConfig[incident.status] || statusConfig.open;
                  const SeverityIcon = sevConfig.icon;

                  return (
                    <div
                      key={incident.id || incident.incident_id}
                      className="p-4 border rounded-lg hover:bg-slate-50 cursor-pointer transition-colors"
                      onClick={() => setSelectedIncident(incident)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-lg ${sevConfig.color}`}>
                            <SeverityIcon className="w-4 h-4" />
                          </div>
                          <div>
                            <h4 className="font-medium text-slate-900">{incident.title}</h4>
                            <div className="flex items-center gap-2 mt-1 text-sm text-slate-500">
                              {incident.hostname && (
                                <span className="flex items-center gap-1">
                                  <Monitor className="w-3 h-3" />
                                  {incident.hostname}
                                </span>
                              )}
                              {incident.app_name && (
                                <span>• {incident.app_name}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <div className="flex items-center gap-2">
                            <Badge className={statConfig.color}>{statConfig.label}</Badge>
                            {incident.id && (incident.status === 'open' || incident.status === 'investigating') && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 text-slate-400 hover:text-slate-600"
                                onClick={(e) => handleCloseIncident(incident, e)}
                                disabled={closingId === incident.id}
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                          <span className="text-xs text-slate-500 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {incident.detected_at 
                              ? new Date(incident.detected_at).toLocaleDateString()
                              : 'Unknown'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Incident Detail Modal */}
      <Dialog open={!!selectedIncident} onOpenChange={() => setSelectedIncident(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-orange-500" />
              Incident Details
            </DialogTitle>
          </DialogHeader>
          {selectedIncident && (() => {
            const parsedDetails = parseAlertDetails(selectedIncident.description);
            
            return (
              <ScrollArea className="max-h-[65vh] pr-4">
                <div className="space-y-5">
                  {/* Title and Badges */}
                  <div>
                    <h3 className="font-semibold text-base leading-tight">{selectedIncident.title}</h3>
                    <div className="flex gap-2 mt-2">
                      <Badge className={severityConfig[selectedIncident.severity]?.color}>
                        {severityConfig[selectedIncident.severity]?.label || selectedIncident.severity}
                      </Badge>
                      <Badge className={statusConfig[selectedIncident.status]?.color}>
                        {statusConfig[selectedIncident.status]?.label || selectedIncident.status}
                      </Badge>
                    </div>
                  </div>

                  {/* Parsed Alert Details (if available) */}
                  {parsedDetails && (
                    <div className="bg-slate-50 rounded-lg p-4 space-y-3">
                      {parsedDetails.email && (
                        <div className="flex items-center gap-3">
                          <Mail className="w-4 h-4 text-slate-400" />
                          <div>
                            <p className="text-xs text-slate-500">Affected User</p>
                            <p className="font-medium text-sm">{parsedDetails.email}</p>
                            {parsedDetails.name && <p className="text-xs text-slate-500">{parsedDetails.name}</p>}
                          </div>
                        </div>
                      )}
                      {parsedDetails.riskType && (
                        <div className="flex items-center gap-3">
                          <AlertTriangle className="w-4 h-4 text-slate-400" />
                          <div>
                            <p className="text-xs text-slate-500">Risk Type</p>
                            <p className="font-medium text-sm">{parsedDetails.riskType}</p>
                            {parsedDetails.riskLevel && (
                              <Badge variant="outline" className="mt-1 text-xs">
                                {parsedDetails.riskLevel} Risk
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}
                      {parsedDetails.location && (
                        <div className="flex items-center gap-3">
                          <MapPin className="w-4 h-4 text-slate-400" />
                          <div>
                            <p className="text-xs text-slate-500">Location</p>
                            <p className="font-medium text-sm">{parsedDetails.location}</p>
                            {parsedDetails.ip && <p className="text-xs text-slate-500">IP: {parsedDetails.ip}</p>}
                          </div>
                        </div>
                      )}
                      {parsedDetails.organization && (
                        <div className="flex items-center gap-3">
                          <User className="w-4 h-4 text-slate-400" />
                          <div>
                            <p className="text-xs text-slate-500">Organization</p>
                            <p className="font-medium text-sm">{parsedDetails.organization}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Basic Info Grid */}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {selectedIncident.hostname && (
                      <div>
                        <p className="text-slate-500 text-xs">Hostname</p>
                        <p className="font-medium">{selectedIncident.hostname}</p>
                      </div>
                    )}
                    {selectedIncident.app_name && (
                      <div>
                        <p className="text-slate-500 text-xs">Detection App</p>
                        <p className="font-medium">{selectedIncident.app_name}</p>
                      </div>
                    )}
                    {selectedIncident.category && (
                      <div>
                        <p className="text-slate-500 text-xs">Category</p>
                        <p className="font-medium">{selectedIncident.category}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-slate-500 text-xs">Detected</p>
                      <p className="font-medium">
                        {selectedIncident.detected_at 
                          ? new Date(selectedIncident.detected_at).toLocaleString()
                          : 'N/A'}
                      </p>
                    </div>
                    {selectedIncident.resolved_at && (
                      <div>
                        <p className="text-slate-500 text-xs">Resolved</p>
                        <p className="font-medium">
                          {new Date(selectedIncident.resolved_at).toLocaleString()}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Summary / Description */}
                  {parsedDetails?.summary && (
                    <div>
                      <p className="text-slate-500 text-xs mb-1">Summary</p>
                      <p className="text-sm bg-amber-50 border border-amber-200 p-3 rounded-lg text-amber-900 whitespace-pre-wrap break-words">
                        {parsedDetails.summary}
                      </p>
                    </div>
                  )}

                  {/* RocketCyber Link */}
                  {parsedDetails?.rocketcyberUrl && (
                    <a 
                      href={parsedDetails.rocketcyberUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-orange-600 hover:text-orange-700 font-medium"
                    >
                      <ExternalLink className="w-4 h-4" />
                      View in RocketCyber Console
                    </a>
                  )}

                  {/* Close Incident Button */}
                  {selectedIncident.id && (selectedIncident.status === 'open' || selectedIncident.status === 'investigating') && (
                    <Button
                      variant="outline"
                      className="w-full mt-4"
                      onClick={() => handleCloseIncident(selectedIncident)}
                      disabled={closingId === selectedIncident.id}
                    >
                      <X className="w-4 h-4 mr-2" />
                      {closingId === selectedIncident.id ? 'Closing...' : 'Dismiss Incident'}
                    </Button>
                  )}

                  {/* Raw Description (collapsed by default if parsed) */}
                  {selectedIncident.description && !parsedDetails && (
                    <div>
                      <p className="text-slate-500 text-xs mb-1">Description</p>
                      <p className="text-sm bg-slate-50 p-3 rounded-lg whitespace-pre-wrap break-words">
                        {selectedIncident.description}
                      </p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
