import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  Shield, 
  Monitor, 
  Wifi,
  WifiOff,
  Clock
} from 'lucide-react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export default function DattoEDRDetailModal({ open, onOpenChange, edrData, tenantName }) {
  const coveragePercent = edrData?.hostCount > 0 
    ? Math.round((edrData?.activeHostCount / edrData?.hostCount) * 100) 
    : 0;

  const inactiveAgents = (edrData?.hostCount || 0) - (edrData?.activeHostCount || 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-cyan-600" />
            Datto EDR Details
          </DialogTitle>
          {tenantName && (
            <p className="text-sm text-slate-500">Tenant: {tenantName}</p>
          )}
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4 text-center">
                <Monitor className="w-8 h-8 text-cyan-600 mx-auto mb-2" />
                <p className="text-3xl font-bold">{edrData?.hostCount || 0}</p>
                <p className="text-xs text-slate-500 mt-1">Total Agents</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <Wifi className="w-8 h-8 text-green-600 mx-auto mb-2" />
                <p className="text-3xl font-bold text-green-600">{edrData?.activeHostCount || 0}</p>
                <p className="text-xs text-slate-500 mt-1">Online Agents</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <WifiOff className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-3xl font-bold text-slate-600">{inactiveAgents}</p>
                <p className="text-xs text-slate-500 mt-1">Offline Agents</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <Shield className="w-8 h-8 text-cyan-600 mx-auto mb-2" />
                <p className="text-3xl font-bold text-cyan-700">{coveragePercent}%</p>
                <p className="text-xs text-slate-500 mt-1">Coverage</p>
              </CardContent>
            </Card>
          </div>

          {/* Additional Stats if available */}
          {edrData?.targetStats && (
            <Card>
              <CardContent className="pt-6">
                <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Additional Information
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <p className="text-slate-500">Total Addresses</p>
                    <p className="font-semibold">{edrData.targetStats.totalAddressCount || 'N/A'}</p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <p className="text-slate-500">Last Scan</p>
                    <p className="font-semibold">
                      {edrData.lastScannedOn 
                        ? new Date(edrData.lastScannedOn).toLocaleDateString() 
                        : 'N/A'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Endpoint List or Info */}
          <Card>
            <CardContent className="pt-6">
              <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <Monitor className="w-4 h-4" />
                Protected Endpoints
              </h3>
              {edrData?.hosts && edrData.hosts.length > 0 ? (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {edrData.hosts.map((host, idx) => (
                    <div 
                      key={host.id || idx}
                      className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg"
                    >
                      <div className={cn(
                        "w-2.5 h-2.5 rounded-full flex-shrink-0",
                        host.online ? "bg-green-500" : "bg-slate-300"
                      )} />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-900 truncate">{host.hostname || 'Unknown'}</p>
                        <p className="text-xs text-slate-500">
                          {host.ip && <span>{host.ip} • </span>}
                          {host.os || 'Unknown OS'}
                        </p>
                      </div>
                      <Badge variant="outline" className={cn(
                        "text-xs",
                        host.online ? "text-green-600 border-green-200" : "text-slate-500"
                      )}>
                        {host.online ? 'Online' : 'Offline'}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 bg-slate-50 rounded-lg">
                  <Monitor className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-600 font-medium">
                    {edrData?.hostCount || 0} endpoints protected
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Refresh EDR to load endpoint rows when available
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
