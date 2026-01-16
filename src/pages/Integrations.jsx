import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  Clock,
  Settings,
  ExternalLink,
  Database,
  Cloud,
  Shield,
  AlertTriangle
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { format, parseISO } from 'date-fns';

const INTEGRATIONS = [
  {
    id: 'halopsa',
    name: 'HaloPSA',
    description: 'Sync customers, contracts, and tickets from HaloPSA',
    icon: Database,
    color: 'bg-indigo-500',
    features: ['Customers', 'Contracts', 'Tickets', 'Assets']
  },
  {
    id: 'dattormm',
    name: 'Datto RMM',
    description: 'Sync devices and monitoring data from Datto RMM',
    icon: Shield,
    color: 'bg-emerald-500',
    features: ['Devices', 'Alerts', 'Patches', 'Monitoring']
  },
  {
    id: 'csp',
    name: 'Microsoft CSP',
    description: 'Sync Microsoft 365 licenses and subscriptions',
    icon: Cloud,
    color: 'bg-blue-500',
    features: ['Licenses', 'Subscriptions', 'Users', 'Usage']
  }
];

export default function Integrations() {
  const { data: syncLogs = [], isLoading, refetch } = useQuery({
    queryKey: ['syncLogs'],
    queryFn: () => base44.entities.SyncLog.list('-created_date', 50),
  });

  // Get latest sync for each source
  const latestSyncs = INTEGRATIONS.reduce((acc, integration) => {
    acc[integration.id] = syncLogs.find(log => log.source === integration.id);
    return acc;
  }, {});

  const getStatusIcon = (status) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
      case 'failed':
      case 'error':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'in_progress':
        return <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />;
      case 'partial':
        return <AlertTriangle className="w-5 h-5 text-amber-500" />;
      default:
        return <Clock className="w-5 h-5 text-slate-400" />;
    }
  };

  const getStatusBadge = (status) => {
    const config = {
      success: { label: 'Synced', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
      failed: { label: 'Failed', className: 'border-red-200 bg-red-50 text-red-700' },
      error: { label: 'Error', className: 'border-red-200 bg-red-50 text-red-700' },
      in_progress: { label: 'Syncing', className: 'border-blue-200 bg-blue-50 text-blue-700' },
      partial: { label: 'Partial', className: 'border-amber-200 bg-amber-50 text-amber-700' }
    };
    const { label, className } = config[status] || { label: 'Not Synced', className: 'border-slate-200 bg-slate-50 text-slate-600' };
    return <Badge variant="outline" className={className}>{label}</Badge>;
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Integrations</h1>
          <p className="text-slate-500 mt-1">Connect and sync data from your MSP tools</p>
        </div>
        <Button 
          onClick={() => refetch()}
          variant="outline"
          className="gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh Status
        </Button>
      </div>

      {/* Integration Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {INTEGRATIONS.map((integration) => {
          const latestSync = latestSyncs[integration.id];
          const Icon = integration.icon;
          
          return (
            <Card key={integration.id} className="overflow-hidden">
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <div className={cn("p-3 rounded-xl", integration.color)}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  {latestSync && getStatusBadge(latestSync.status)}
                </div>
                <CardTitle className="mt-4">{integration.name}</CardTitle>
                <CardDescription>{integration.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {integration.features.map((feature) => (
                    <Badge key={feature} variant="secondary" className="bg-slate-100 text-slate-600">
                      {feature}
                    </Badge>
                  ))}
                </div>
                
                {latestSync && (
                  <div className="pt-4 border-t border-slate-100">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">Last sync</span>
                      <span className="text-slate-900">
                        {format(parseISO(latestSync.created_date), 'MMM d, h:mm a')}
                      </span>
                    </div>
                    {latestSync.records_synced > 0 && (
                      <div className="flex items-center justify-between text-sm mt-1">
                        <span className="text-slate-500">Records synced</span>
                        <span className="text-slate-900">{latestSync.records_synced}</span>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <Button variant="outline" className="flex-1 gap-2" disabled>
                    <Settings className="w-4 h-4" />
                    Configure
                  </Button>
                  <Button className="flex-1 gap-2 bg-slate-900 hover:bg-slate-800" disabled>
                    <RefreshCw className="w-4 h-4" />
                    Sync Now
                  </Button>
                </div>
                <p className="text-xs text-center text-slate-400">
                  API integration coming soon
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Sync History */}
      <div className="bg-white rounded-2xl border border-slate-200/50 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-900">Sync History</h3>
        </div>
        {isLoading ? (
          <div className="p-6 space-y-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
        ) : syncLogs.length === 0 ? (
          <div className="p-12 text-center">
            <RefreshCw className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">No sync history yet</p>
            <p className="text-sm text-slate-400 mt-1">Syncs will appear here once integrations are configured</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {syncLogs.slice(0, 10).map((log) => (
              <div key={log.id} className="flex items-center gap-4 px-6 py-4">
                {getStatusIcon(log.status)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-slate-900 capitalize">{log.source}</p>
                    <Badge variant="outline" className="capitalize">{log.sync_type}</Badge>
                  </div>
                  <p className="text-sm text-slate-500 mt-0.5">
                    {log.details || `${log.records_synced || 0} records synced`}
                    {log.records_failed > 0 && `, ${log.records_failed} failed`}
                  </p>
                </div>
                <div className="text-right text-sm">
                  <p className="text-slate-900">
                    {format(parseISO(log.created_date), 'MMM d, yyyy')}
                  </p>
                  <p className="text-slate-500">
                    {format(parseISO(log.created_date), 'h:mm a')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}