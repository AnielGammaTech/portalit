import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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
  ChevronDown,
  ChevronRight,
  Monitor,
  Calendar,
  Activity,
  X
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ExternalLink, Mail, MapPin, Globe, User } from 'lucide-react';

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

export default function RocketCyberTab({ customer }) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [closingId, setClosingId] = useState(null);

  // Fetch mapping
  const { data: mappings = [], isLoading: loadingMapping } = useQuery({
    queryKey: ['rocketcyber_mapping', customer.id],
    queryFn: () => client.entities.RocketCyberMapping.filter({ customer_id: customer.id })
  });

  // Fetch incidents
  const { data: incidents = [], isLoading: loadingIncidents, refetch: refetchIncidents } = useQuery({
    queryKey: ['rocketcyber_incidents', customer.id],
    queryFn: () => client.entities.RocketCyberIncident.filter({ customer_id: customer.id }),
    enabled: mappings.length > 0
  });

  const mapping = mappings[0];

  const syncIncidents = async () => {
    setIsSyncing(true);
    try {
      const result = await client.functions.invoke('syncRocketCyber', {
        action: 'sync_incidents',
        customer_id: customer.id
      });
      if (result.success) {
        toast.success(`Synced ${result.recordsSynced} incidents`);
        refetchIncidents();
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

  if (loadingMapping || loadingIncidents) {
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
        {/* Filters skeleton */}
        <div className="flex gap-4">
          <Shimmer className="h-9 w-36 rounded-md" />
          <Shimmer className="h-9 w-36 rounded-md" />
        </div>
        {/* Incidents list skeleton */}
        <SkeletonTable rows={5} cols={4} />
      </div>
    );
  }

  if (!mapping) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Shield className="w-12 h-12 mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-medium text-slate-900 mb-2">RocketCyber Not Configured</h3>
          <p className="text-slate-500 mb-4">
            This customer hasn't been mapped to a RocketCyber account yet.
          </p>
          <p className="text-sm text-slate-400">
            Go to Integrations settings to configure RocketCyber mapping.
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
  const stats = {
    total: incidents.length,
    open: incidents.filter(i => i.status === 'open' || i.status === 'investigating').length,
    critical: incidents.filter(i => i.severity === 'critical').length,
    high: incidents.filter(i => i.severity === 'high').length
  };

  return (
    <div className="space-y-6">
      {/* Header with Sync */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Shield className="w-5 h-5 text-orange-500" />
            RocketCyber SOC
          </h3>
          <p className="text-sm text-slate-500">
            Account: {mapping.rc_account_name}
            {mapping.last_synced && (
              <span className="ml-2">
                • Last sync: {new Date(mapping.last_synced).toLocaleString()}
              </span>
            )}
          </p>
        </div>
        <Button onClick={syncIncidents} disabled={isSyncing} variant="outline" size="sm">
          <RefreshCw className={`w-4 h-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
          Sync Incidents
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-sm text-slate-500">Total Incidents</p>
          </CardContent>
        </Card>
        <Card className={stats.open > 0 ? 'border-red-200 bg-red-50' : ''}>
          <CardContent className="pt-4">
            <div className={`text-2xl font-bold ${stats.open > 0 ? 'text-red-600' : ''}`}>
              {stats.open}
            </div>
            <p className="text-sm text-slate-500">Open/Active</p>
          </CardContent>
        </Card>
        <Card className={stats.critical > 0 ? 'border-red-200 bg-red-50' : ''}>
          <CardContent className="pt-4">
            <div className={`text-2xl font-bold ${stats.critical > 0 ? 'text-red-600' : ''}`}>
              {stats.critical}
            </div>
            <p className="text-sm text-slate-500">Critical</p>
          </CardContent>
        </Card>
        <Card className={stats.high > 0 ? 'border-orange-200 bg-orange-50' : ''}>
          <CardContent className="pt-4">
            <div className={`text-2xl font-bold ${stats.high > 0 ? 'text-orange-600' : ''}`}>
              {stats.high}
            </div>
            <p className="text-sm text-slate-500">High Severity</p>
          </CardContent>
        </Card>
      </div>

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
        <CardHeader>
          <CardTitle className="text-base">
            Security Incidents ({filteredIncidents.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredIncidents.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <CheckCircle2 className="w-12 h-12 mx-auto text-green-300 mb-3" />
              <p>No incidents found</p>
              <p className="text-sm">Your environment is looking secure!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredIncidents
                .sort((a, b) => new Date(b.detected_at) - new Date(a.detected_at))
                .map(incident => {
                  const sevConfig = severityConfig[incident.severity] || severityConfig.medium;
                  const statConfig = statusConfig[incident.status] || statusConfig.open;
                  const SeverityIcon = sevConfig.icon;

                  return (
                    <div
                      key={incident.id}
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
                            {(incident.status === 'open' || incident.status === 'investigating') && (
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
                  {(selectedIncident.status === 'open' || selectedIncident.status === 'investigating') && (
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