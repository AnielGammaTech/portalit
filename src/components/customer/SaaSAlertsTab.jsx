import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { 
  Shield, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle2,
  AlertCircle,
  Clock,
  Globe,
  Mail,
  ChevronDown,
  ChevronRight,
  Users,
  ExternalLink,
  User
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import UserDetailModal from './UserDetailModal';

export default function SaaSAlertsTab({ customer, saasAlertsMapping }) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [expandedAlert, setExpandedAlert] = useState(null);
  const [selectedContact, setSelectedContact] = useState(null);

  // Fetch SaaS Alerts for this customer
  const { data: alerts = [], isLoading, refetch } = useQuery({
    queryKey: ['saas-alerts', customer?.id],
    queryFn: () => base44.entities.SaaSAlert.filter({ customer_id: customer?.id }),
    enabled: !!customer?.id
  });

  // Fetch contacts for this customer to match user emails
  const { data: contacts = [] } = useQuery({
    queryKey: ['contacts', customer?.id],
    queryFn: () => base44.entities.Contact.filter({ customer_id: customer?.id }),
    enabled: !!customer?.id
  });

  // Create a lookup map for contacts by email
  const contactsByEmail = useMemo(() => {
    const map = {};
    contacts.forEach(contact => {
      if (contact.email) {
        map[contact.email.toLowerCase()] = contact;
      }
    });
    return map;
  }, [contacts]);

  const getContactFromEmail = (email) => {
    if (!email) return null;
    return contactsByEmail[email.toLowerCase()] || null;
  };

  const handleSync = async () => {
    if (!saasAlertsMapping) return;
    setIsSyncing(true);
    try {
      const response = await base44.functions.invoke('syncSaaSAlerts', {
        action: 'sync_events',
        customer_id: customer.id
      });
      if (response.data?.success) {
        toast.success(`Synced ${response.data.alertsSynced || 0} alerts`);
        refetch();
      } else {
        toast.error(response.data?.error || 'Sync failed');
      }
    } catch (error) {
      toast.error(error.message || 'An error occurred');
    } finally {
      setIsSyncing(false);
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-700 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'low': return 'bg-blue-100 text-blue-700 border-blue-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'resolved': return 'bg-emerald-100 text-emerald-700';
      case 'acknowledged': return 'bg-blue-100 text-blue-700';
      case 'open': return 'bg-amber-100 text-amber-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const filteredAlerts = alerts.filter(alert => {
    const matchesStatus = statusFilter === 'all' || alert.status === statusFilter;
    const matchesSeverity = severityFilter === 'all' || alert.severity === severityFilter;
    return matchesStatus && matchesSeverity;
  }).sort((a, b) => new Date(b.detected_at || 0) - new Date(a.detected_at || 0));

  // Group alerts by event_type for cleaner display
  const groupedAlerts = useMemo(() => {
    const groups = {};
    filteredAlerts.forEach(alert => {
      const key = `${alert.event_type || 'Unknown'}_${alert.severity || 'unknown'}_${alert.status || 'open'}`;
      if (!groups[key]) {
        groups[key] = {
          event_type: alert.event_type || 'Unknown Event',
          severity: alert.severity,
          status: alert.status,
          count: 0,
          alerts: [],
          latestDate: null,
          users: new Set()
        };
      }
      groups[key].count++;
      groups[key].alerts.push(alert);
      if (alert.user_email) groups[key].users.add(alert.user_email);
      const alertDate = alert.detected_at ? new Date(alert.detected_at) : null;
      if (alertDate && (!groups[key].latestDate || alertDate > groups[key].latestDate)) {
        groups[key].latestDate = alertDate;
      }
    });
    return Object.values(groups).sort((a, b) => {
      // Sort by severity first, then by count
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      const aSev = severityOrder[a.severity] ?? 4;
      const bSev = severityOrder[b.severity] ?? 4;
      if (aSev !== bSev) return aSev - bSev;
      return b.count - a.count;
    });
  }, [filteredAlerts]);

  const criticalCount = alerts.filter(a => a.severity === 'critical' && a.status === 'open').length;
  const openCount = alerts.filter(a => a.status === 'open').length;
  const resolvedCount = alerts.filter(a => a.status === 'resolved').length;

  return (
    <div className="space-y-4">
      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-100 rounded-lg">
                <Shield className="w-5 h-5 text-slate-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{alerts.length}</p>
                <p className="text-sm text-slate-500">Total Alerts</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-red-600">{criticalCount}</p>
                <p className="text-sm text-slate-500">Critical Open</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <AlertCircle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-600">{openCount}</p>
                <p className="text-sm text-slate-500">Open Alerts</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-600">{resolvedCount}</p>
                <p className="text-sm text-slate-500">Resolved</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerts List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>SaaS Security Alerts</CardTitle>
            <CardDescription>
              Monitoring events from {saasAlertsMapping?.saas_alerts_org_name || 'SaaS Alerts'}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-1.5"
            >
              <option value="all">All Severity</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-1.5"
            >
              <option value="all">All Status</option>
              <option value="open">Open</option>
              <option value="acknowledged">Acknowledged</option>
              <option value="resolved">Resolved</option>
            </select>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleSync}
              disabled={isSyncing}
              className="gap-2"
            >
              <RefreshCw className={cn("w-4 h-4", isSyncing && "animate-spin")} />
              Sync
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-12 text-center">
              <RefreshCw className="w-8 h-8 animate-spin text-slate-400 mx-auto" />
              <p className="text-slate-500 mt-2">Loading alerts...</p>
            </div>
          ) : groupedAlerts.length === 0 ? (
            <div className="py-12 text-center">
              <Shield className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">No alerts found</p>
              <p className="text-sm text-slate-400 mt-1">Click "Sync" to pull alerts from SaaS Alerts</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {groupedAlerts.map((group, idx) => (
                <div key={idx}>
                  <button
                    onClick={() => setExpandedAlert(expandedAlert === idx ? null : idx)}
                    className="w-full px-4 py-3 flex items-center gap-4 hover:bg-slate-50 transition-colors text-left"
                  >
                    {/* Severity indicator bar */}
                    <div className={cn(
                      "w-1 h-12 rounded-full flex-shrink-0",
                      group.severity === 'critical' && "bg-red-500",
                      group.severity === 'high' && "bg-orange-500",
                      group.severity === 'medium' && "bg-yellow-500",
                      group.severity === 'low' && "bg-blue-400",
                      !group.severity && "bg-slate-300"
                    )} />
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-slate-900 text-sm">{group.event_type}</p>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                        {group.latestDate && (
                          <span>{formatDistanceToNow(group.latestDate, { addSuffix: true })}</span>
                        )}
                        {group.users.size > 0 && (
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {group.users.size} user{group.users.size !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge className={cn("text-xs capitalize font-normal", getSeverityColor(group.severity))}>
                        {group.severity || 'unknown'}
                      </Badge>
                      <Badge className={cn("text-xs capitalize font-normal", getStatusColor(group.status))}>
                        {group.status || 'open'}
                      </Badge>
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-sm font-medium text-slate-600">
                        {group.count}
                      </div>
                      {expandedAlert === idx ? (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                  </button>
                  
                  {expandedAlert === idx && (
                    <div className="bg-slate-50 border-t border-slate-100 px-4 py-3">
                      <p className="text-xs text-slate-500 mb-2">{group.count} occurrence{group.count !== 1 ? 's' : ''}</p>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {group.alerts.slice(0, 20).map(alert => {
                          const contact = getContactFromEmail(alert.user_email);
                          const displayName = contact?.full_name || alert.user_email || 'Unknown user';
                          
                          return (
                            <div 
                              key={alert.id} 
                              className={cn(
                                "bg-white rounded-lg px-3 py-2 text-sm border border-slate-200",
                                contact && "cursor-pointer hover:border-purple-300 hover:bg-purple-50/30 transition-colors"
                              )}
                              onClick={() => contact && setSelectedContact(contact)}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  {contact ? (
                                    <>
                                      <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 text-xs font-medium flex-shrink-0">
                                        {displayName.charAt(0)}
                                      </div>
                                      <span className="text-purple-600 font-medium truncate">{displayName}</span>
                                    </>
                                  ) : (
                                    <>
                                      <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 flex-shrink-0">
                                        <User className="w-3 h-3" />
                                      </div>
                                      <span className="text-slate-600 truncate">{displayName}</span>
                                    </>
                                  )}
                                </div>
                                <span className="text-xs text-slate-400 flex-shrink-0">
                                  {alert.detected_at && format(parseISO(alert.detected_at), 'MMM d, h:mm a')}
                                </span>
                              </div>
                              {(alert.ip_address || alert.location) && (
                                <div className="text-xs text-slate-400 mt-1 ml-8">
                                  {alert.ip_address && <span>{alert.ip_address}</span>}
                                  {alert.ip_address && alert.location && <span> · </span>}
                                  {alert.location && <span>{alert.location}</span>}
                                </div>
                              )}
                            </div>
                          );
                        })}
                        {group.alerts.length > 20 && (
                          <p className="text-xs text-slate-400 text-center py-2">
                            +{group.alerts.length - 20} more alerts
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Link to SaaS Alerts */}
      <div className="text-center pt-2">
        <a 
          href="https://app.saasalerts.com" 
          target="_blank" 
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm text-purple-600 hover:text-purple-700 font-medium"
        >
          View full details in SaaS Alerts
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>

      {/* User Detail Modal */}
      <UserDetailModal 
        contact={selectedContact}
        open={!!selectedContact}
        onClose={() => setSelectedContact(null)}
        customerId={customer?.id}
      />
    </div>
  );
}