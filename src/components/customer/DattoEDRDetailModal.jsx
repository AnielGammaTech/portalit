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
  AlertTriangle, 
  CheckCircle2,
  Activity,
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
            Datto EDR Report
          </DialogTitle>
          {tenantName && (
            <p className="text-sm text-slate-500">Tenant: {tenantName}</p>
          )}
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Alert Status Banner */}
          {edrData?.alertCount > 0 ? (
            <div className="flex items-center gap-3 p-4 bg-red-50 rounded-lg border border-red-200">
              <AlertTriangle className="w-6 h-6 text-red-600" />
              <div>
                <p className="font-semibold text-red-900">
                  {edrData.alertCount} Active Alert{edrData.alertCount !== 1 ? 's' : ''} Detected
                </p>
                <p className="text-sm text-red-700">
                  Immediate attention recommended. Review alerts in Datto EDR console.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 p-4 bg-green-50 rounded-lg border border-green-200">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
              <div>
                <p className="font-semibold text-green-900">All Clear - No Active Threats</p>
                <p className="text-sm text-green-700">
                  All monitored endpoints are operating normally with no security alerts.
                </p>
              </div>
            </div>
          )}

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
                <AlertTriangle className={cn(
                  "w-8 h-8 mx-auto mb-2",
                  edrData?.alertCount > 0 ? "text-red-600" : "text-green-600"
                )} />
                <p className={cn(
                  "text-3xl font-bold",
                  edrData?.alertCount > 0 ? "text-red-600" : "text-green-600"
                )}>{edrData?.alertCount || 0}</p>
                <p className="text-xs text-slate-500 mt-1">Active Alerts</p>
              </CardContent>
            </Card>
          </div>

          {/* Coverage Analysis */}
          <Card>
            <CardContent className="pt-6">
              <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Coverage Analysis
              </h3>
              
              <div className="space-y-4">
                {/* Coverage Bar */}
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-slate-600">Agent Coverage Rate</span>
                    <span className={cn(
                      "font-semibold",
                      coveragePercent >= 90 ? "text-green-600" :
                      coveragePercent >= 70 ? "text-yellow-600" : "text-red-600"
                    )}>{coveragePercent}%</span>
                  </div>
                  <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className={cn(
                        "h-full rounded-full transition-all",
                        coveragePercent >= 90 ? "bg-green-500" :
                        coveragePercent >= 70 ? "bg-yellow-500" : "bg-red-500"
                      )}
                      style={{ width: `${coveragePercent}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    {edrData?.activeHostCount || 0} of {edrData?.hostCount || 0} agents actively reporting
                  </p>
                </div>

                {/* Coverage Status */}
                <div className={cn(
                  "p-3 rounded-lg",
                  coveragePercent >= 90 ? "bg-green-50 border border-green-200" :
                  coveragePercent >= 70 ? "bg-yellow-50 border border-yellow-200" : 
                  "bg-red-50 border border-red-200"
                )}>
                  <p className={cn(
                    "text-sm font-medium",
                    coveragePercent >= 90 ? "text-green-800" :
                    coveragePercent >= 70 ? "text-yellow-800" : "text-red-800"
                  )}>
                    {coveragePercent >= 90 ? "✓ Excellent Coverage" :
                     coveragePercent >= 70 ? "⚠ Good Coverage - Room for Improvement" :
                     "⚠ Coverage Needs Attention"}
                  </p>
                  <p className={cn(
                    "text-xs mt-1",
                    coveragePercent >= 90 ? "text-green-700" :
                    coveragePercent >= 70 ? "text-yellow-700" : "text-red-700"
                  )}>
                    {inactiveAgents > 0 
                      ? `${inactiveAgents} agent${inactiveAgents !== 1 ? 's' : ''} not currently reporting. These may be offline devices or require attention.`
                      : "All deployed agents are actively reporting."}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* QBR Summary Section */}
          <Card>
            <CardContent className="pt-6">
              <h3 className="font-semibold text-slate-900 mb-4">QBR Summary</h3>
              
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-cyan-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Monitor className="w-3.5 h-3.5 text-cyan-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">Endpoint Protection</p>
                    <p className="text-sm text-slate-600">
                      {edrData?.hostCount || 0} endpoints are protected with Datto EDR monitoring and threat detection.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5",
                    edrData?.alertCount > 0 ? "bg-red-100" : "bg-green-100"
                  )}>
                    <Shield className={cn(
                      "w-3.5 h-3.5",
                      edrData?.alertCount > 0 ? "text-red-600" : "text-green-600"
                    )} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">Security Status</p>
                    <p className="text-sm text-slate-600">
                      {edrData?.alertCount > 0 
                        ? `${edrData.alertCount} security alert${edrData.alertCount !== 1 ? 's' : ''} require attention.`
                        : "No active security threats detected. Environment is secure."}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5",
                    coveragePercent >= 90 ? "bg-green-100" : "bg-yellow-100"
                  )}>
                    <Activity className={cn(
                      "w-3.5 h-3.5",
                      coveragePercent >= 90 ? "text-green-600" : "text-yellow-600"
                    )} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">Agent Health</p>
                    <p className="text-sm text-slate-600">
                      {coveragePercent}% of agents are actively reporting. 
                      {inactiveAgents > 0 && ` ${inactiveAgents} agent${inactiveAgents !== 1 ? 's' : ''} offline.`}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

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

          {/* Recommendations */}
          {(inactiveAgents > 0 || edrData?.alertCount > 0) && (
            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="pt-6">
                <h3 className="font-semibold text-amber-900 mb-3">Recommendations</h3>
                <ul className="space-y-2 text-sm text-amber-800">
                  {edrData?.alertCount > 0 && (
                    <li className="flex items-start gap-2">
                      <span>•</span>
                      <span>Review and remediate {edrData.alertCount} active alert{edrData.alertCount !== 1 ? 's' : ''} in the Datto EDR console.</span>
                    </li>
                  )}
                  {inactiveAgents > 0 && (
                    <li className="flex items-start gap-2">
                      <span>•</span>
                      <span>Investigate {inactiveAgents} inactive agent{inactiveAgents !== 1 ? 's' : ''} - these may be offline devices or require reinstallation.</span>
                    </li>
                  )}
                  {coveragePercent < 90 && (
                    <li className="flex items-start gap-2">
                      <span>•</span>
                      <span>Consider deploying EDR agents to any unprotected endpoints to improve coverage.</span>
                    </li>
                  )}
                </ul>
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
                    View individual endpoint details in the Datto EDR console
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