import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { 
  Shield, 
  RefreshCw, 
  Monitor,
  AlertTriangle,
  AlertCircle,
  Activity,
  Flag,
  Clock,
  CheckCircle2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export default function DattoEDRTab({ customerId, edrMapping }) {
  const [syncing, setSyncing] = useState(false);
  const [edrData, setEdrData] = useState(null);

  const handleSync = async () => {
    if (!edrMapping) return;
    setSyncing(true);
    try {
      const response = await base44.functions.invoke('syncDattoEDR', {
        action: 'sync_customer',
        customer_id: customerId
      });
      if (response.data.success) {
        setEdrData(response.data.data);
        toast.success(`Synced EDR data`);
      } else {
        toast.error(response.data.error || 'Sync failed');
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSyncing(false);
    }
  };

  // Auto-load data on mount
  React.useEffect(() => {
    if (edrMapping && !edrData) {
      handleSync();
    }
  }, [edrMapping]);

  if (!edrMapping) {
    return (
      <div className="text-center py-12">
        <Shield className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <p className="text-slate-500">No Datto EDR tenant mapped to this customer</p>
        <p className="text-sm text-slate-400 mt-1">Map a tenant in Settings → Integrations</p>
      </div>
    );
  }

  const getSeverityColor = (severity) => {
    switch (severity?.toLowerCase()) {
      case 'critical': return 'bg-red-100 text-red-700 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'low': return 'bg-blue-100 text-blue-700 border-blue-200';
      default: return 'bg-slate-100 text-slate-600';
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Datto EDR Report</h3>
          <p className="text-sm text-slate-500">Tenant: {edrMapping.edr_tenant_name}</p>
        </div>
        <Button
          onClick={handleSync}
          disabled={syncing}
          variant="outline"
          size="sm"
          className="gap-2"
        >
          <RefreshCw className={cn("w-4 h-4", syncing && "animate-spin")} />
          {syncing ? 'Loading...' : 'Refresh'}
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-cyan-100 rounded-lg">
                <Monitor className="w-5 h-5 text-cyan-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{edrData?.hostCount || 0}</p>
                <p className="text-xs text-slate-500">Total Agents</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Activity className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{edrData?.activeHostCount || 0}</p>
                <p className="text-xs text-slate-500">Active Agents</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className={cn(
                "p-2 rounded-lg",
                edrData?.alertCount > 0 ? "bg-red-100" : "bg-green-100"
              )}>
                <AlertTriangle className={cn(
                  "w-5 h-5",
                  edrData?.alertCount > 0 ? "text-red-600" : "text-green-600"
                )} />
              </div>
              <div>
                <p className="text-2xl font-bold">{edrData?.alertCount || 0}</p>
                <p className="text-xs text-slate-500">Alerts</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Shield className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {edrData?.hostCount > 0 
                    ? Math.round((edrData?.activeHostCount / edrData?.hostCount) * 100) 
                    : 0}%
                </p>
                <p className="text-xs text-slate-500">Coverage</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabbed Content */}
      <Tabs defaultValue="alerts" className="space-y-4">
        <TabsList className="bg-white border">
          <TabsTrigger value="alerts" className="gap-2">
            <AlertTriangle className="w-4 h-4" />
            Alerts ({edrData?.alertCount || 0})
          </TabsTrigger>
          <TabsTrigger value="hosts" className="gap-2">
            <Monitor className="w-4 h-4" />
            Endpoints ({edrData?.hostCount || 0})
          </TabsTrigger>
          <TabsTrigger value="flags" className="gap-2">
            <Flag className="w-4 h-4" />
            Flags ({edrData?.flagCount || 0})
          </TabsTrigger>
        </TabsList>

        {/* Alerts Tab */}
        <TabsContent value="alerts">
          <Card>
            <CardHeader>
              <CardTitle>Security Alerts</CardTitle>
              <CardDescription>Active alerts from Datto EDR</CardDescription>
            </CardHeader>
            <CardContent>
              {!edrData?.alerts || edrData.alerts.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle2 className="w-10 h-10 text-green-300 mx-auto mb-3" />
                  <p className="text-slate-500 font-medium">No active alerts</p>
                  <p className="text-sm text-slate-400">All systems operating normally</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {edrData.alerts.map((alert, idx) => (
                    <div 
                      key={alert.id || idx}
                      className="flex items-start gap-3 p-4 bg-slate-50 rounded-lg border border-slate-100"
                    >
                      <div className={cn(
                        "p-1.5 rounded-lg",
                        alert.severity === 'critical' ? "bg-red-100" : 
                        alert.severity === 'high' ? "bg-orange-100" : "bg-yellow-100"
                      )}>
                        <AlertTriangle className={cn(
                          "w-4 h-4",
                          alert.severity === 'critical' ? "text-red-600" : 
                          alert.severity === 'high' ? "text-orange-600" : "text-yellow-600"
                        )} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-slate-900">{alert.name || 'Unknown Alert'}</p>
                          <Badge className={getSeverityColor(alert.severity)}>
                            {alert.severity || 'unknown'}
                          </Badge>
                        </div>
                        <p className="text-sm text-slate-500 mt-1">
                          {alert.hostname && <span>Host: {alert.hostname} • </span>}
                          {alert.threatScore && <span>Threat Score: {alert.threatScore} • </span>}
                          {alert.createdOn && new Date(alert.createdOn).toLocaleDateString()}
                        </p>
                      </div>
                      {alert.status && (
                        <Badge variant="outline">{alert.status}</Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Hosts Tab */}
        <TabsContent value="hosts">
          <Card>
            <CardHeader>
              <CardTitle>Monitored Endpoints</CardTitle>
              <CardDescription>Hosts with Datto EDR agent installed</CardDescription>
            </CardHeader>
            <CardContent>
              {!edrData?.hosts || edrData.hosts.length === 0 ? (
                <div className="text-center py-8">
                  <Monitor className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500">No endpoints found</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {edrData.hosts.map((host, idx) => (
                    <div 
                      key={host.id || idx}
                      className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg"
                    >
                      <div className={cn(
                        "w-2.5 h-2.5 rounded-full",
                        host.online ? "bg-green-500" : "bg-slate-300"
                      )} />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-900 truncate">{host.hostname || 'Unknown'}</p>
                        <p className="text-sm text-slate-500">
                          {host.ip && <span>{host.ip} • </span>}
                          {host.os || 'Unknown OS'}
                          {host.lastSeen && (
                            <span className="text-slate-400"> • Last seen: {new Date(host.lastSeen).toLocaleDateString()}</span>
                          )}
                        </p>
                      </div>
                      <Badge variant="outline" className={cn(
                        host.online ? "text-green-600 border-green-200" : "text-slate-500"
                      )}>
                        {host.online ? 'Online' : 'Offline'}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Flags Tab */}
        <TabsContent value="flags">
          <Card>
            <CardHeader>
              <CardTitle>Detection Flags</CardTitle>
              <CardDescription>Items flagged by Datto EDR analysis</CardDescription>
            </CardHeader>
            <CardContent>
              {!edrData?.flags || edrData.flags.length === 0 ? (
                <div className="text-center py-8">
                  <Flag className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500">No flags found</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {edrData.flags.map((flag, idx) => (
                    <div 
                      key={flag.id || idx}
                      className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg"
                    >
                      <div className="p-1.5 bg-purple-100 rounded-lg">
                        <Flag className="w-4 h-4 text-purple-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-900 truncate">{flag.name || 'Unknown Flag'}</p>
                        <p className="text-sm text-slate-500">
                          {flag.hostname && <span>Host: {flag.hostname} • </span>}
                          {flag.type && <span>Type: {flag.type} • </span>}
                          {flag.createdOn && new Date(flag.createdOn).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Last Sync Info */}
      {edrMapping.last_synced && (
        <p className="text-xs text-slate-400 text-center">
          Last synced: {new Date(edrMapping.last_synced).toLocaleString()}
        </p>
      )}
    </div>
  );
}