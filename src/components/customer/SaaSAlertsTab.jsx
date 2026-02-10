import React, { useState } from 'react';
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
  ChevronRight
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { format, parseISO } from 'date-fns';

export default function SaaSAlertsTab({ customer, saasAlertsMapping }) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [expandedAlert, setExpandedAlert] = useState(null);

  // Fetch SaaS Alerts for this customer
  const { data: alerts = [], isLoading, refetch } = useQuery({
    queryKey: ['saas-alerts', customer?.id],
    queryFn: () => base44.entities.SaaSAlert.filter({ customer_id: customer?.id }),
    enabled: !!customer?.id
  });

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
          ) : filteredAlerts.length === 0 ? (
            <div className="py-12 text-center">
              <Shield className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">No alerts found</p>
              <p className="text-sm text-slate-400 mt-1">Click "Sync" to pull alerts from SaaS Alerts</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredAlerts.map(alert => (
                <div 
                  key={alert.id}
                  className="border border-slate-200 rounded-lg overflow-hidden"
                >
                  <button
                    onClick={() => setExpandedAlert(expandedAlert === alert.id ? null : alert.id)}
                    className="w-full px-4 py-3 flex items-center gap-4 hover:bg-slate-50 transition-colors text-left"
                  >
                    <div className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
                      alert.severity === 'critical' && "bg-red-100",
                      alert.severity === 'high' && "bg-orange-100",
                      alert.severity === 'medium' && "bg-yellow-100",
                      alert.severity === 'low' && "bg-blue-100",
                      !alert.severity && "bg-slate-100"
                    )}>
                      <AlertTriangle className={cn(
                        "w-5 h-5",
                        alert.severity === 'critical' && "text-red-600",
                        alert.severity === 'high' && "text-orange-600",
                        alert.severity === 'medium' && "text-yellow-600",
                        alert.severity === 'low' && "text-blue-600",
                        !alert.severity && "text-slate-500"
                      )} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-slate-900 truncate">{alert.event_type || 'Security Event'}</p>
                        <Badge className={cn("text-xs capitalize", getSeverityColor(alert.severity))}>
                          {alert.severity || 'unknown'}
                        </Badge>
                        <Badge className={cn("text-xs capitalize", getStatusColor(alert.status))}>
                          {alert.status || 'open'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-slate-500">
                        {alert.user_email && (
                          <span className="flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            {alert.user_email}
                          </span>
                        )}
                        {alert.application && (
                          <span className="flex items-center gap-1">
                            <Globe className="w-3 h-3" />
                            {alert.application}
                          </span>
                        )}
                        {alert.detected_at && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {format(parseISO(alert.detected_at), 'MMM d, yyyy h:mm a')}
                          </span>
                        )}
                      </div>
                    </div>
                    {expandedAlert === alert.id ? (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    )}
                  </button>
                  
                  {expandedAlert === alert.id && (
                    <div className="px-4 py-3 bg-slate-50 border-t border-slate-200">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        {alert.description && (
                          <div className="col-span-2">
                            <p className="text-slate-500 text-xs uppercase tracking-wide mb-1">Description</p>
                            <p className="text-slate-700">{alert.description}</p>
                          </div>
                        )}
                        {alert.ip_address && (
                          <div>
                            <p className="text-slate-500 text-xs uppercase tracking-wide mb-1">IP Address</p>
                            <p className="text-slate-700">{alert.ip_address}</p>
                          </div>
                        )}
                        {alert.location && (
                          <div>
                            <p className="text-slate-500 text-xs uppercase tracking-wide mb-1">Location</p>
                            <p className="text-slate-700">{alert.location}</p>
                          </div>
                        )}
                        {alert.alert_id && (
                          <div>
                            <p className="text-slate-500 text-xs uppercase tracking-wide mb-1">Alert ID</p>
                            <p className="text-slate-700 font-mono text-xs">{alert.alert_id}</p>
                          </div>
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
    </div>
  );
}