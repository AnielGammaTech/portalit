import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { 
  Shield, 
  RefreshCw, 
  Monitor,
  AlertTriangle,
  Activity,
  CheckCircle2,
  ExternalLink
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import DattoEDRDetailModal from './DattoEDRDetailModal';

export default function DattoEDRTab({ customerId, edrMapping }) {
  const [syncing, setSyncing] = useState(false);
  const [edrData, setEdrData] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

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

  const notMapped = !edrMapping;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Datto EDR Report</h3>
          <p className="text-sm text-slate-500">
            {notMapped ? 'Not configured' : `Tenant: ${edrMapping.edr_tenant_name}`}
          </p>
        </div>
        {!notMapped && (
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
        )}
      </div>

      {/* Not Mapped Banner */}
      {notMapped && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 rounded-lg border border-amber-200">
          <Shield className="w-5 h-5 text-amber-600" />
          <div>
            <p className="font-medium text-amber-900">EDR Not Configured</p>
            <p className="text-sm text-amber-700">Map a Datto EDR tenant in Settings → Integrations to enable monitoring</p>
          </div>
        </div>
      )}

      {/* Summary Stats - Clickable */}
      <div 
        className="grid grid-cols-2 md:grid-cols-4 gap-4 cursor-pointer"
        onClick={() => edrData && setShowDetailModal(true)}
      >
        <Card className="hover:shadow-md hover:border-cyan-200 transition-all">
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
        <Card className="hover:shadow-md hover:border-green-200 transition-all">
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
        <Card className={cn(
          "hover:shadow-md transition-all",
          edrData?.alertCount > 0 ? "hover:border-red-200" : "hover:border-green-200"
        )}>
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
        <Card className="hover:shadow-md hover:border-purple-200 transition-all">
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
      
      {edrData && (
        <p className="text-xs text-slate-400 text-center">
          <ExternalLink className="w-3 h-3 inline mr-1" />
          Click stats above for detailed QBR report
        </p>
      )}

      {/* EDR Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle>EDR Protection Summary</CardTitle>
          <CardDescription>
            {edrData?.hostCount || 0} total agents deployed, {edrData?.activeHostCount || 0} currently active
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Alert Status */}
            {edrData?.alertCount > 0 ? (
              <div className="flex items-center gap-3 p-4 bg-red-50 rounded-lg border border-red-200">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                <div>
                  <p className="font-medium text-red-900">
                    {edrData.alertCount} Active Alert{edrData.alertCount !== 1 ? 's' : ''}
                  </p>
                  <p className="text-sm text-red-700">Review alerts in the Datto EDR console</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 p-4 bg-green-50 rounded-lg border border-green-200">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <div>
                  <p className="font-medium text-green-900">No Active Alerts</p>
                  <p className="text-sm text-green-700">All monitored systems are operating normally</p>
                </div>
              </div>
            )}

            {/* Agent Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Monitor className="w-4 h-4 text-slate-500" />
                  <span className="text-sm font-medium text-slate-700">Agent Status</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-green-600">{edrData?.activeHostCount || 0}</span>
                  <span className="text-slate-500">/ {edrData?.hostCount || 0}</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">Active / Total Agents</p>
              </div>
              
              <div className="p-4 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="w-4 h-4 text-slate-500" />
                  <span className="text-sm font-medium text-slate-700">Coverage Rate</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-purple-600">
                    {edrData?.hostCount > 0 
                      ? Math.round((edrData?.activeHostCount / edrData?.hostCount) * 100) 
                      : 0}%
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">Agents reporting in</p>
              </div>
            </div>

            {/* Target Stats if available */}
            {edrData?.targetStats && (
              <div className="pt-4 border-t border-slate-200">
                <p className="text-xs text-slate-500 mb-2">Additional Details</p>
                <div className="flex flex-wrap gap-3 text-sm">
                  <span className="text-slate-600">
                    Total addresses: <span className="font-medium">{edrData.targetStats.totalAddressCount}</span>
                  </span>
                  {edrData.lastScannedOn && (
                    <span className="text-slate-600">
                      Last scan: <span className="font-medium">{new Date(edrData.lastScannedOn).toLocaleDateString()}</span>
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Last Sync Info */}
      {edrMapping?.last_synced && (
        <p className="text-xs text-slate-400 text-center">
          Last synced: {new Date(edrMapping.last_synced).toLocaleString()}
        </p>
      )}

      {/* Detail Modal */}
      {!notMapped && (
        <DattoEDRDetailModal
          open={showDetailModal}
          onOpenChange={setShowDetailModal}
          edrData={edrData}
          tenantName={edrMapping?.edr_tenant_name}
        />
      )}
    </div>
  );
}