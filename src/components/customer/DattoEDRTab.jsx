import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { 
  Shield, 
  RefreshCw, 
  Monitor,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Activity
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
        toast.success(`Synced EDR data for ${edrMapping.edr_tenant_name}`);
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

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Datto EDR</h3>
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
          {syncing ? 'Syncing...' : 'Refresh'}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-cyan-100 rounded-lg">
                <Monitor className="w-5 h-5 text-cyan-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{edrData?.hostCount || 0}</p>
                <p className="text-sm text-slate-500">Endpoints</p>
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
                <p className="text-2xl font-bold">{edrData?.alertCount || 0}</p>
                <p className="text-sm text-slate-500">Active Alerts</p>
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
                <p className="text-2xl font-bold">
                  {edrData?.hosts?.filter(h => h.online)?.length || 0}
                </p>
                <p className="text-sm text-slate-500">Online</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Hosts List */}
      <Card>
        <CardHeader>
          <CardTitle>Endpoints</CardTitle>
          <CardDescription>Hosts monitored by Datto EDR</CardDescription>
        </CardHeader>
        <CardContent>
          {!edrData?.hosts || edrData.hosts.length === 0 ? (
            <div className="text-center py-8">
              <Monitor className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">No endpoints found</p>
              <p className="text-sm text-slate-400">Click Refresh to load data</p>
            </div>
          ) : (
            <div className="space-y-2">
              {edrData.hosts.map((host, idx) => (
                <div 
                  key={host.id || idx}
                  className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg"
                >
                  <div className={cn(
                    "w-2 h-2 rounded-full",
                    host.online ? "bg-green-500" : "bg-slate-300"
                  )} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 truncate">{host.hostname || host.name}</p>
                    <p className="text-sm text-slate-500">{host.ip || host.os || 'Unknown'}</p>
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

      {/* Last Sync Info */}
      {edrMapping.last_synced && (
        <p className="text-xs text-slate-400 text-center">
          Last synced: {new Date(edrMapping.last_synced).toLocaleString()}
        </p>
      )}
    </div>
  );
}