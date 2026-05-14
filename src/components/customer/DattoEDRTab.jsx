import React, { useMemo, useState } from 'react';
import { client } from '@/api/client';
import { toast } from 'sonner';
import {
  Shield,
  RefreshCw,
  Monitor,
  Activity,
  ExternalLink,
  FileText,
  Search,
  Wifi,
  WifiOff,
  Clock,
  HardDrive,
  User,
  Network,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import DattoEDRDetailModal from './DattoEDRDetailModal';
import DattoEDRReportModal from './DattoEDRReportModal';

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function formatDateTime(value) {
  const date = parseDate(value);
  if (!date) return 'Unknown';
  return date.toLocaleString();
}

function formatDate(value) {
  const date = parseDate(value);
  if (!date) return 'Unknown';
  return date.toLocaleDateString();
}

function timeAgo(value) {
  const date = parseDate(value);
  if (!date) return 'Unknown';
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.max(0, Math.round(diffMs / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function getHostKey(host, index) {
  return host.id || `${host.hostname || 'host'}-${host.ip || index}`;
}

export default function DattoEDRTab({ customerId, edrMapping, customerName }) {
  const [syncing, setSyncing] = useState(false);
  const [liveEdrData, setLiveEdrData] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [endpointSearch, setEndpointSearch] = useState('');

  const cachedEdrData = useMemo(() => {
    if (!edrMapping?.cached_data) return null;
    return typeof edrMapping.cached_data === 'string'
      ? (() => { try { return JSON.parse(edrMapping.cached_data); } catch { return null; } })()
      : edrMapping.cached_data;
  }, [edrMapping?.cached_data]);

  const edrData = liveEdrData || cachedEdrData;
  const fromCache = !liveEdrData && !!cachedEdrData;
  const notMapped = !edrMapping;

  const hosts = useMemo(() => {
    const rows = Array.isArray(edrData?.hosts) ? edrData.hosts : [];
    return [...rows].sort((a, b) => {
      if (a.online !== b.online) return a.online ? 1 : -1;
      return String(a.hostname || '').localeCompare(String(b.hostname || ''));
    });
  }, [edrData?.hosts]);

  const offlineHosts = useMemo(() => hosts.filter(host => !host.online), [hosts]);
  const onlineHosts = useMemo(() => hosts.filter(host => host.online), [hosts]);
  const osBreakdown = Array.isArray(edrData?.osBreakdown) ? edrData.osBreakdown : [];
  const hostCount = edrData?.hostCount || hosts.length || 0;
  const activeHostCount = edrData?.activeHostCount ?? onlineHosts.length;
  const offlineHostCount = edrData?.offlineHostCount ?? Math.max(hostCount - activeHostCount, 0);
  const coveragePercent = hostCount > 0 ? Math.round((activeHostCount / hostCount) * 100) : 0;
  const lastScan = edrData?.lastScannedOn || edrData?.targetStats?.lastScannedOn;
  const generatedAt = edrData?.generatedAt || edrMapping?.last_synced;
  const lastSyncDate = parseDate(edrMapping?.last_synced);
  const syncStale = lastSyncDate ? Date.now() - lastSyncDate.getTime() > 36 * 60 * 60 * 1000 : false;

  const filteredHosts = useMemo(() => {
    const query = endpointSearch.trim().toLowerCase();
    if (!query) return hosts;
    return hosts.filter(host => [
      host.hostname,
      host.ip,
      host.os,
      host.username,
      host.agentVersion,
      host.status,
      host.group,
    ].some(value => String(value || '').toLowerCase().includes(query)));
  }, [endpointSearch, hosts]);

  const handleSync = async () => {
    if (!edrMapping) return;
    setSyncing(true);
    try {
      const response = await client.functions.invoke('syncDattoEDR', {
        action: 'sync_customer',
        customer_id: customerId
      });
      if (response.success) {
        setLiveEdrData(response.data);
        toast.success('EDR data refreshed');
      } else {
        toast.error(response.error || 'Sync failed');
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold text-slate-900">Datto EDR</h3>
            {fromCache && <Badge variant="outline" className="text-xs">Cached</Badge>}
            {syncStale && <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">Sync stale</Badge>}
          </div>
          <p className="text-sm text-slate-500">
            {notMapped ? 'Not configured' : `Tenant: ${edrMapping.edr_tenant_name || edrData?.targetName || 'Mapped tenant'}`}
          </p>
        </div>
        {!notMapped && (
          <div className="flex flex-wrap items-center gap-2">
            {edrData && (
              <>
                <Button onClick={() => setShowDetailModal(true)} variant="outline" size="sm" className="gap-2">
                  <ExternalLink className="w-4 h-4" />
                  Details
                </Button>
                <Button onClick={() => setShowReportModal(true)} variant="outline" size="sm" className="gap-2">
                  <FileText className="w-4 h-4" />
                  Report
                </Button>
              </>
            )}
            <Button onClick={handleSync} disabled={syncing} variant="outline" size="sm" className="gap-2">
              <RefreshCw className={cn("w-4 h-4", syncing && "animate-spin")} />
              {syncing ? 'Loading...' : (fromCache ? 'Refresh' : 'Sync')}
            </Button>
          </div>
        )}
      </div>

      {notMapped && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 rounded-lg border border-amber-200">
          <Shield className="w-5 h-5 text-amber-600" />
          <div>
            <p className="font-medium text-amber-900">EDR Not Configured</p>
            <p className="text-sm text-amber-700">Map a Datto EDR tenant in Adminland &gt; Integrations to show endpoint visibility.</p>
          </div>
        </div>
      )}

      {!notMapped && !edrData && (
        <Card>
          <CardContent className="py-10 text-center">
            <Shield className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="font-medium text-slate-900">No EDR data cached yet</p>
            <p className="text-sm text-slate-500 mt-1">Run a sync to load agents, scan metadata, and endpoint details.</p>
            <Button onClick={handleSync} disabled={syncing} className="mt-4 gap-2">
              <RefreshCw className={cn("w-4 h-4", syncing && "animate-spin")} />
              Sync EDR
            </Button>
          </CardContent>
        </Card>
      )}

      {edrData && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium text-slate-500">Coverage</p>
                    <p className="text-2xl font-bold text-slate-900">{coveragePercent}%</p>
                    <p className="text-xs text-slate-500">{activeHostCount} of {hostCount} online</p>
                  </div>
                  <div className="p-2 rounded-lg bg-cyan-50">
                    <Shield className="w-5 h-5 text-cyan-600" />
                  </div>
                </div>
                <Progress value={coveragePercent} className="mt-3 h-2" />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium text-slate-500">Online Agents</p>
                    <p className="text-2xl font-bold text-green-600">{activeHostCount}</p>
                    <p className="text-xs text-slate-500">{onlineHosts.length || activeHostCount} currently active</p>
                  </div>
                  <div className="p-2 rounded-lg bg-green-50">
                    <Wifi className="w-5 h-5 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium text-slate-500">Offline Agents</p>
                    <p className="text-2xl font-bold text-slate-700">{offlineHostCount}</p>
                    <p className="text-xs text-slate-500">Not currently connected</p>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-100">
                    <WifiOff className="w-5 h-5 text-slate-500" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium text-slate-500">Last Scan</p>
                    <p className="text-lg font-bold text-slate-900">{formatDate(lastScan)}</p>
                    <p className="text-xs text-slate-500">{lastScan ? timeAgo(lastScan) : 'No scan date'}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-100">
                    <Clock className="w-5 h-5 text-slate-500" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[1.15fr_0.85fr] gap-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle>Protection Overview</CardTitle>
                    <CardDescription>
                      {hostCount} deployed agents, {offlineHostCount} offline, last data build {timeAgo(generatedAt)}
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="bg-cyan-50 text-cyan-700 border-cyan-200">
                    {coveragePercent}% covered
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                  <div className="rounded-lg border border-slate-200 p-3">
                    <div className="flex items-center gap-2 text-slate-500">
                      <Clock className="w-4 h-4" />
                      Last scan
                    </div>
                    <p className="font-semibold text-slate-900 mt-1">{formatDate(lastScan)}</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 p-3">
                    <div className="flex items-center gap-2 text-slate-500">
                      <Network className="w-4 h-4" />
                      Addresses
                    </div>
                    <p className="font-semibold text-slate-900 mt-1">{edrData?.targetStats?.totalAddressCount ?? 'Unknown'}</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 p-3">
                    <div className="flex items-center gap-2 text-slate-500">
                      <Activity className="w-4 h-4" />
                      Last sync
                    </div>
                    <p className="font-semibold text-slate-900 mt-1">{formatDateTime(edrMapping?.last_synced)}</p>
                  </div>
                </div>

                {osBreakdown.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-slate-700 mb-2">Operating systems</p>
                    <div className="space-y-2">
                      {osBreakdown.map(item => {
                        const percent = hostCount > 0 ? Math.round((item.count / hostCount) * 100) : 0;
                        return (
                          <div key={item.name} className="grid grid-cols-[minmax(0,1fr)_52px] gap-3 items-center text-sm">
                            <div>
                              <div className="flex items-center justify-between gap-2">
                                <span className="truncate text-slate-700">{item.name}</span>
                                <span className="text-xs text-slate-500">{item.count}</span>
                              </div>
                              <Progress value={percent} className="mt-1 h-1.5" />
                            </div>
                            <span className="text-xs text-slate-500 text-right">{percent}%</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle>Offline Agents</CardTitle>
                <CardDescription>Devices not currently connected</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-slate-700">Offline endpoints</p>
                    <Badge variant="outline">{offlineHostCount}</Badge>
                  </div>
                  {offlineHosts.length > 0 ? (
                    <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                      {offlineHosts.slice(0, 8).map((host, index) => (
                        <div key={getHostKey(host, index)} className="rounded-lg border border-slate-200 p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-medium text-slate-900 truncate">{host.hostname || 'Unknown endpoint'}</p>
                              <p className="text-xs text-slate-500 truncate">{host.os || 'Unknown OS'}</p>
                            </div>
                            <Badge variant="outline" className="bg-slate-50 text-slate-600">Offline</Badge>
                          </div>
                          <p className="text-xs text-slate-500 mt-2">Last seen {formatDateTime(host.lastSeen)}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
                      All cached agents are online.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle>Endpoint Inventory</CardTitle>
                  <CardDescription>
                    Showing {filteredHosts.length} of {hosts.length} synced agents with status, OS, IP, user, and last heartbeat
                  </CardDescription>
                </div>
                <div className="relative w-full lg:w-80">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <Input
                    value={endpointSearch}
                    onChange={(event) => setEndpointSearch(event.target.value)}
                    placeholder="Search endpoints"
                    className="pl-9"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {hosts.length > 0 ? (
                <div className="overflow-hidden rounded-lg border border-slate-200">
                  <div className="max-h-[460px] overflow-auto">
                    <table className="w-full min-w-[820px] text-sm">
                      <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10">
                        <tr className="text-left text-xs font-medium text-slate-500">
                          <th className="px-4 py-3">Endpoint</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3">Last seen</th>
                          <th className="px-4 py-3">OS</th>
                          <th className="px-4 py-3">Network/User</th>
                          <th className="px-4 py-3">Agent</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {filteredHosts.map((host, index) => (
                          <tr key={getHostKey(host, index)} className="hover:bg-slate-50">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2 min-w-0">
                                <Monitor className={cn("w-4 h-4 flex-shrink-0", host.online ? "text-green-500" : "text-slate-400")} />
                                <div className="min-w-0">
                                  <p className="font-medium text-slate-900 truncate">{host.hostname || 'Unknown endpoint'}</p>
                                  {host.group && <p className="text-xs text-slate-500 truncate">{host.group}</p>}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <Badge variant="outline" className={cn(
                                host.online ? "bg-green-50 text-green-700 border-green-200" : "bg-slate-50 text-slate-600 border-slate-200"
                              )}>
                                {host.online ? 'Online' : 'Offline'}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-slate-600">
                              <div>{timeAgo(host.lastSeen)}</div>
                              <div className="text-xs text-slate-400">{formatDateTime(host.lastSeen)}</div>
                            </td>
                            <td className="px-4 py-3 text-slate-600">
                              <div className="flex items-center gap-2">
                                <HardDrive className="w-4 h-4 text-slate-400" />
                                <span className="truncate max-w-[180px]">{host.os || 'Unknown OS'}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-slate-600">
                              <div className="space-y-1">
                                {host.ip && (
                                  <div className="flex items-center gap-2">
                                    <Network className="w-3.5 h-3.5 text-slate-400" />
                                    <span>{host.ip}</span>
                                  </div>
                                )}
                                {host.username && (
                                  <div className="flex items-center gap-2">
                                    <User className="w-3.5 h-3.5 text-slate-400" />
                                    <span className="truncate max-w-[180px]">{host.username}</span>
                                  </div>
                                )}
                                {!host.ip && !host.username && <span className="text-slate-400">Unknown</span>}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-slate-600">
                              <div className="space-y-1">
                                <div>{host.agentVersion || 'Unknown'}</div>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="text-center py-10 bg-slate-50 rounded-lg">
                  <Monitor className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-600 font-medium">{hostCount} endpoints reported</p>
                  <p className="text-xs text-slate-500 mt-1">The API returned counts but no endpoint rows. Run Refresh to reload the endpoint list.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {edrMapping?.last_synced && (
            <p className="text-xs text-slate-400 text-center">
              Last synced: {new Date(edrMapping.last_synced).toLocaleString()}
            </p>
          )}
        </>
      )}

      {!notMapped && (
        <DattoEDRDetailModal
          open={showDetailModal}
          onOpenChange={setShowDetailModal}
          edrData={edrData}
          tenantName={edrMapping?.edr_tenant_name}
        />
      )}

      {!notMapped && (
        <DattoEDRReportModal
          open={showReportModal}
          onOpenChange={setShowReportModal}
          edrData={edrData}
          tenantName={edrMapping?.edr_tenant_name}
          customerName={customerName}
          customerId={customerId}
        />
      )}
    </div>
  );
}
