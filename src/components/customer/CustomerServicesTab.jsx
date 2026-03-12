import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { client } from '@/api/client';
import { toast } from 'sonner';
import { 
  Cloud, 
  Users, 
  Shield, 
  HardDrive,
  RefreshCw,
  ChevronDown,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  AlertTriangle,
  Fish,
  Monitor
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import UserDetailModal from './UserDetailModal';
import DarkWebTab from './DarkWebTab';
import BullPhishTab from './BullPhishTab';
import SpanningUsersTab from './SpanningUsersTab';
import DevicesTab from './DevicesTab';
import DattoEDRTab from './DattoEDRTab';
import RocketCyberTab from './RocketCyberTab';

export default function CustomerServicesTab({ 
  customerId, 
  customer, 
  lineItems = [],
  expandedBills,
  setExpandedBills,
  isSyncing,
  setIsSyncing,
  queryClient,
  devices = []
}) {
  const [syncingJumpCloud, setSyncingJumpCloud] = useState(false);
  const [syncingSpanning, setSyncingSpanning] = useState(false);
  const [syncingDatto, setSyncingDatto] = useState(false);
  const [syncingHalo, setSyncingHalo] = useState(false);
  const [syncingAll, setSyncingAll] = useState(false);
  const [jcUsersPage, setJcUsersPage] = useState(0);
  const [spanningUsersPage, setSpanningUsersPage] = useState(0);
  const [selectedContact, setSelectedContact] = useState(null);
  const [syncStatuses, setSyncStatuses] = useState({
    halopsa: { status: 'idle', lastSync: null, error: null },
    datto: { status: 'idle', lastSync: null, error: null },
    jumpcloud: { status: 'idle', lastSync: null, error: null },
    spanning: { status: 'idle', lastSync: null, error: null }
  });

  // Fetch JumpCloud mapping for this customer (includes cached_data)
  const { data: jumpcloudMapping } = useQuery({
    queryKey: ['jumpcloud-mapping', customerId],
    queryFn: async () => {
      const mappings = await client.entities.JumpCloudMapping.filter({ customer_id: customerId });
      return mappings[0] || null;
    },
    enabled: !!customerId,
    staleTime: 1000 * 60 * 5 // Cache for 5 minutes
  });

  // Fetch Spanning mapping for this customer (includes cached_data)
  const { data: spanningMapping } = useQuery({
    queryKey: ['spanning-mapping', customerId],
    queryFn: async () => {
      const mappings = await client.entities.SpanningMapping.filter({ customer_id: customerId });
      return mappings[0] || null;
    },
    enabled: !!customerId,
    staleTime: 1000 * 60 * 5 // Cache for 5 minutes
  });

  // Fetch JumpCloud contacts for this customer
  const { data: jumpcloudContacts = [] } = useQuery({
    queryKey: ['jumpcloud-contacts', customerId],
    queryFn: () => client.entities.Contact.filter({ customer_id: customerId, source: 'jumpcloud' }),
    enabled: !!customerId && !!jumpcloudMapping,
    staleTime: 1000 * 60 * 5 // Cache for 5 minutes
  });

  // Fetch JumpCloud licenses for this customer
  const { data: jumpcloudLicenses = [] } = useQuery({
    queryKey: ['jumpcloud-licenses', customerId],
    queryFn: () => client.entities.SaaSLicense.filter({ customer_id: customerId, source: 'jumpcloud' }),
    enabled: !!customerId && !!jumpcloudMapping,
    staleTime: 1000 * 60 * 5 // Cache for 5 minutes
  });

  // Fetch Spanning contacts for this customer (any contact with spanning_status set)
  const { data: spanningContacts = [] } = useQuery({
    queryKey: ['spanning-contacts', customerId],
    queryFn: async () => {
      const contacts = await client.entities.Contact.filter({ customer_id: customerId });
      return contacts.filter(c => c.spanning_status);
    },
    enabled: !!customerId && !!spanningMapping
  });

  // Fetch Spanning licenses for this customer
  const { data: spanningLicenses = [] } = useQuery({
    queryKey: ['spanning-licenses', customerId],
    queryFn: () => client.entities.SaaSLicense.filter({ customer_id: customerId, vendor: 'Unitrends' }),
    enabled: !!customerId && !!spanningMapping
  });

  // Fetch Datto site mapping for this customer
  const { data: dattoMapping } = useQuery({
    queryKey: ['datto-mapping', customerId],
    queryFn: async () => {
      const mappings = await client.entities.DattoSiteMapping.filter({ customer_id: customerId });
      return mappings[0] || null;
    },
    enabled: !!customerId
  });

  // Fetch Dark Web ID mapping for this customer
  const { data: darkwebMapping } = useQuery({
    queryKey: ['darkwebid-mapping', customerId],
    queryFn: async () => {
      const mappings = await client.entities.DarkWebIDMapping.filter({ customer_id: customerId });
      return mappings[0] || null;
    },
    enabled: !!customerId
  });

  // Fetch Dark Web ID reports for this customer (reports can exist without mapping)
  const { data: darkwebReports = [] } = useQuery({
    queryKey: ['darkwebid-reports', customerId],
    queryFn: () => client.entities.DarkWebIDReport.filter({ customer_id: customerId }),
    enabled: !!customerId
  });

  // Fetch BullPhish ID reports for this customer
  const { data: bullphishReports = [] } = useQuery({
    queryKey: ['bullphishid-reports', customerId],
    queryFn: () => client.entities.BullPhishIDReport.filter({ customer_id: customerId }),
    enabled: !!customerId
  });

  // Fetch Datto EDR mapping for this customer
  const { data: edrMapping } = useQuery({
    queryKey: ['edr-mapping', customerId],
    queryFn: async () => {
      const mappings = await client.entities.DattoEDRMapping.filter({ customer_id: customerId });
      return mappings[0] || null;
    },
    enabled: !!customerId
  });

  // Fetch RocketCyber mapping for this customer
  const { data: rocketcyberMapping } = useQuery({
    queryKey: ['rocketcyber-mapping', customerId],
    queryFn: async () => {
      const mappings = await client.entities.RocketCyberMapping.filter({ customer_id: customerId });
      return mappings[0] || null;
    },
    enabled: !!customerId
  });

  const hasBullPhish = bullphishReports.length > 0;
  const hasDarkWeb = !!darkwebMapping || darkwebReports.length > 0;
  const hasEDR = !!edrMapping;
  const hasRocketCyber = !!rocketcyberMapping;

  const updateSyncStatus = (service, status, error = null) => {
    setSyncStatuses(prev => ({
      ...prev,
      [service]: {
        status,
        lastSync: status === 'success' ? new Date().toISOString() : prev[service].lastSync,
        error: error
      }
    }));
  };

  const handleSyncHaloPSA = async () => {
    if (!customer?.source === 'halopsa' || !customer?.external_id) return;
    setSyncingHalo(true);
    updateSyncStatus('halopsa', 'syncing');
    try {
      const response = await client.functions.invoke('syncHaloPSAContacts', {
        action: 'sync_customer',
        customer_id: customer.external_id
      });
      if (response.success) {
        updateSyncStatus('halopsa', 'success');
        toast.success(`HaloPSA: Synced ${response.recordsSynced || 0} contacts`);
        queryClient.invalidateQueries();
      } else {
        updateSyncStatus('halopsa', 'error', response.error);
        toast.error(response.error || 'HaloPSA sync failed');
      }
    } catch (error) {
      updateSyncStatus('halopsa', 'error', error.message);
      toast.error(error.message);
    } finally {
      setSyncingHalo(false);
    }
  };

  const handleSyncDatto = async () => {
    if (!dattoMapping) return;
    setSyncingDatto(true);
    updateSyncStatus('datto', 'syncing');
    try {
      const response = await client.functions.invoke('syncDattoRMMDevices', {
        action: 'sync_devices',
        customer_id: customerId
      });
      if (response.success) {
        updateSyncStatus('datto', 'success');
        toast.success(`Datto: Synced ${response.recordsSynced || 0} devices`);
        queryClient.invalidateQueries();
      } else {
        updateSyncStatus('datto', 'error', response.error);
        toast.error(response.error || 'Datto sync failed');
      }
    } catch (error) {
      updateSyncStatus('datto', 'error', error.message);
      toast.error(error.message);
    } finally {
      setSyncingDatto(false);
    }
  };

  const handleSyncAll = async () => {
    setSyncingAll(true);
    const results = [];
    const errors = [];
    
    try {
      // Sync HaloPSA contacts if customer is from HaloPSA
      if (customer?.source === 'halopsa' && customer?.external_id) {
        updateSyncStatus('halopsa', 'syncing');
        try {
          const res = await client.functions.invoke('syncHaloPSAContacts', {
            action: 'sync_customer',
            customer_id: customer.external_id
          });
          if (res.success) {
            updateSyncStatus('halopsa', 'success');
            results.push(`HaloPSA (${res.recordsSynced || 0} contacts)`);
          } else {
            updateSyncStatus('halopsa', 'error', res.error);
            errors.push('HaloPSA');
          }
        } catch (e) {
          updateSyncStatus('halopsa', 'error', e.message);
          errors.push('HaloPSA');
        }
      }

      // Sync Datto RMM if mapped
      if (dattoMapping) {
        updateSyncStatus('datto', 'syncing');
        try {
          const res = await client.functions.invoke('syncDattoRMMDevices', {
            action: 'sync_devices',
            customer_id: customerId
          });
          if (res.success) {
            updateSyncStatus('datto', 'success');
            results.push(`Datto (${res.recordsSynced || 0} devices)`);
          } else {
            updateSyncStatus('datto', 'error', res.error);
            errors.push('Datto');
          }
        } catch (e) {
          updateSyncStatus('datto', 'error', e.message);
          errors.push('Datto');
        }
      }

      // Sync JumpCloud if mapped
      if (jumpcloudMapping) {
        updateSyncStatus('jumpcloud', 'syncing');
        try {
          const res = await client.functions.invoke('syncJumpCloudLicenses', {
            action: 'sync_licenses',
            customer_id: customerId
          });
          if (res.success) {
            updateSyncStatus('jumpcloud', 'success');
            results.push(`JumpCloud (${(res.contactsCreated || 0) + (res.contactsUpdated || 0)} users)`);
          } else {
            updateSyncStatus('jumpcloud', 'error', res.error);
            errors.push('JumpCloud');
          }
        } catch (e) {
          updateSyncStatus('jumpcloud', 'error', e.message);
          errors.push('JumpCloud');
        }
      }

      // Sync Spanning if mapped
      if (spanningMapping) {
        updateSyncStatus('spanning', 'syncing');
        try {
          const res = await client.functions.invoke('syncSpanningBackup', {
            action: 'sync_licenses',
            customer_id: customerId
          });
          if (res.success) {
            updateSyncStatus('spanning', 'success');
            results.push(`Spanning (${res.contactsUpdated || 0} users)`);
          } else {
            updateSyncStatus('spanning', 'error', res.error);
            errors.push('Spanning');
          }
        } catch (e) {
          updateSyncStatus('spanning', 'error', e.message);
          errors.push('Spanning');
        }
      }

      if (results.length > 0) {
        toast.success(`Synced: ${results.join(', ')}`);
        queryClient.invalidateQueries();
      }
      if (errors.length > 0) {
        toast.error(`Failed: ${errors.join(', ')}`);
      }
      if (results.length === 0 && errors.length === 0) {
        toast.info('No integrations to sync');
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSyncingAll(false);
    }
  };

  const handleSyncJumpCloud = async () => {
    if (!jumpcloudMapping) return;
    setSyncingJumpCloud(true);
    try {
      const response = await client.functions.invoke('syncJumpCloudLicenses', {
        action: 'sync_licenses',
        customer_id: customerId
      });
      if (response.success) {
        toast.success('JumpCloud data synced!');
        queryClient.invalidateQueries({ queryKey: ['jumpcloud-contacts', customerId] });
        queryClient.invalidateQueries({ queryKey: ['jumpcloud-licenses', customerId] });
        queryClient.invalidateQueries({ queryKey: ['jumpcloud-mapping', customerId] });
      } else {
        toast.error(response.error || 'Sync failed');
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSyncingJumpCloud(false);
    }
  };

  // Get cached JumpCloud stats
  const jumpcloudCachedStats = React.useMemo(() => {
    if (!jumpcloudMapping?.cached_data) return null;
    try {
      return JSON.parse(jumpcloudMapping.cached_data);
    } catch (e) {
      return null;
    }
  }, [jumpcloudMapping?.cached_data]);

  const handleSyncSpanning = async () => {
    if (!spanningMapping) return;
    setSyncingSpanning(true);
    try {
      const response = await client.functions.invoke('syncSpanningBackup', {
        action: 'sync_licenses',
        customer_id: customerId
      });
      if (response.success) {
        toast.success('Unitrends data synced!');
        queryClient.invalidateQueries({ queryKey: ['spanning-contacts', customerId] });
        queryClient.invalidateQueries({ queryKey: ['spanning-licenses', customerId] });
      } else {
        toast.error(response.error || 'Sync failed');
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSyncingSpanning(false);
    }
  };

  const hasJumpCloud = !!jumpcloudMapping;
  const hasSpanning = !!spanningMapping;
  const hasRecurringServices = lineItems.length > 0;

  const hasHaloPSA = customer?.source === 'halopsa' && customer?.external_id;
  const hasDatto = !!dattoMapping;
  const hasDevices = devices.length > 0 || hasDatto;

  const formatLastSync = (dateStr) => {
    if (!dateStr) return 'Never';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'syncing': return <RefreshCw className="w-4 h-4 animate-spin text-blue-500" />;
      case 'success': return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'error': return <AlertCircle className="w-4 h-4 text-red-500" />;
      default: return <div className="w-4 h-4 rounded-full bg-slate-200" />;
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'syncing': return <Badge className="bg-blue-100 text-blue-700">Syncing...</Badge>;
      case 'success': return <Badge className="bg-green-100 text-green-700">Synced</Badge>;
      case 'error': return <Badge className="bg-red-100 text-red-700">Error</Badge>;
      default: return <Badge className="bg-slate-100 text-slate-500">Not synced</Badge>;
    }
  };

  const integrations = [
    { key: 'halopsa', name: 'HaloPSA', enabled: hasHaloPSA, icon: Users, color: 'purple', onSync: handleSyncHaloPSA, syncing: syncingHalo },
    { key: 'datto', name: 'Datto RMM', enabled: hasDatto, icon: HardDrive, color: 'blue', onSync: handleSyncDatto, syncing: syncingDatto },
    { key: 'jumpcloud', name: 'JumpCloud', enabled: hasJumpCloud, icon: Shield, color: 'indigo', onSync: handleSyncJumpCloud, syncing: syncingJumpCloud },
    { key: 'spanning', name: 'Spanning', enabled: hasSpanning, icon: Cloud, color: 'cyan', onSync: handleSyncSpanning, syncing: syncingSpanning }
  ].filter(i => i.enabled);

  return (
    <div className="space-y-6">
      <Tabs defaultValue="recurring" className="space-y-4">
        <div className="flex flex-col gap-4">
          {/* Service Tabs Grid */}
          <TabsList className="bg-slate-100/50 border border-slate-200 p-1.5 h-auto flex flex-wrap gap-1 justify-center rounded-xl">
            <TabsTrigger value="recurring" className="gap-2 py-2.5 px-4 text-sm font-medium rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <HardDrive className="w-4 h-4" />
              Recurring
            </TabsTrigger>
            <TabsTrigger value="devices" className="gap-2 py-2.5 px-4 text-sm font-medium rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <Monitor className="w-4 h-4" />
              Devices
            </TabsTrigger>
            <TabsTrigger value="jumpcloud" className="gap-2 py-2.5 px-4 text-sm font-medium rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <Shield className="w-4 h-4 text-indigo-500" />
              JumpCloud
            </TabsTrigger>
            <TabsTrigger value="spanning" className="gap-2 py-2.5 px-4 text-sm font-medium rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <Cloud className="w-4 h-4 text-cyan-500" />
              Spanning
            </TabsTrigger>
            <TabsTrigger value="darkweb" className="gap-2 py-2.5 px-4 text-sm font-medium rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              Dark Web
            </TabsTrigger>
            <TabsTrigger value="bullphish" className="gap-2 py-2.5 px-4 text-sm font-medium rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <Fish className="w-4 h-4 text-amber-500" />
              BullPhish
            </TabsTrigger>
            <TabsTrigger value="edr" className="gap-2 py-2.5 px-4 text-sm font-medium rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <Shield className="w-4 h-4 text-blue-500" />
              Datto EDR
            </TabsTrigger>
            <TabsTrigger value="rocketcyber" className="gap-2 py-2.5 px-4 text-sm font-medium rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <Shield className="w-4 h-4 text-orange-500" />
              RocketCyber
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Recurring Services Tab - Always show */}
        <TabsContent value="recurring">
          <div className="space-y-4">
            {/* Summary Card */}
            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-2xl border border-purple-100 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-600 uppercase tracking-wide">Monthly Recurring</p>
                  <p className="text-3xl font-bold text-slate-900 mt-1">
                    ${lineItems.reduce((sum, item) => sum + (item.net_amount || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-sm text-slate-500 mt-1">{lineItems.length} services</p>
                </div>
                {customer?.source === 'halopsa' && (
                  <Button
                    onClick={async () => {
                      try {
                        setIsSyncing(true);
                        const response = await client.functions.invoke('syncHaloPSARecurringBills', {
                          action: 'sync_customer',
                          customer_id: customer.external_id
                        });
                        if (response.success) {
                          toast.success(`Synced ${response.recordsSynced || 0} recurring bills!`);
                          queryClient.invalidateQueries({ queryKey: ['recurring_bills', customerId] });
                          queryClient.invalidateQueries({ queryKey: ['line_items', customerId] });
                        } else {
                          toast.error(response.error || 'Sync failed');
                        }
                      } catch (error) {
                        toast.error(error.message || 'An error occurred');
                      } finally {
                        setIsSyncing(false);
                      }
                    }}
                    disabled={isSyncing}
                    variant="outline"
                    size="sm"
                    className="gap-2"
                  >
                    <RefreshCw className={cn("w-4 h-4", isSyncing && "animate-spin")} />
                    Sync
                  </Button>
                )}
              </div>
            </div>

            {/* Services List */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100">
                <h3 className="font-semibold text-slate-900">Active Services</h3>
              </div>
              {lineItems.length === 0 ? (
                <div className="py-16 text-center">
                  <HardDrive className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">No recurring services found</p>
                  {customer?.source === 'halopsa' && (
                    <p className="text-sm text-slate-400 mt-1">Click "Sync" to pull from HaloPSA</p>
                  )}
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {lineItems.map((item, index) => (
                    <div 
                      key={item.id} 
                      className="px-6 py-4 flex items-center gap-4 hover:bg-slate-50 transition-colors"
                    >
                      <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0">
                        <HardDrive className="w-5 h-5 text-purple-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-900">{item.description?.replace(/\s*\$recurringbillingdate\s*/gi, '').trim()}</p>
                        <p className="text-sm text-slate-500 mt-0.5">Quantity: {item.quantity}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-slate-900">${(item.net_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                        <p className="text-xs text-slate-400">/month</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {lineItems.length > 0 && (
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-600">Total Monthly</p>
                  <p className="text-lg font-bold text-slate-900">
                    ${lineItems.reduce((sum, item) => sum + (item.net_amount || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Devices Tab */}
        <TabsContent value="devices">
          <DevicesTab 
            customerId={customerId} 
            customerExternalId={customer?.external_id}
          />
        </TabsContent>

        {/* JumpCloud Tab */}
        <TabsContent value="jumpcloud">
          {jumpcloudMapping ? (
            <div className="space-y-4">
              {/* Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-purple-100 rounded-lg">
                        <Users className="w-5 h-5 text-purple-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{jumpcloudCachedStats?.totalUsers || jumpcloudContacts.length}</p>
                        <p className="text-sm text-slate-500">Directory Users</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <Cloud className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{jumpcloudCachedStats?.ssoApps || jumpcloudLicenses.length}</p>
                        <p className="text-sm text-slate-500">SSO Applications</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-green-100 rounded-lg">
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{jumpcloudLicenses.reduce((sum, l) => sum + (l.assigned_users || 0), 0)}</p>
                        <p className="text-sm text-slate-500">App Assignments</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Users */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>JumpCloud Users</CardTitle>
                    <CardDescription>Users synced from JumpCloud directory ({jumpcloudContacts.length} total)</CardDescription>
                  </div>
                  {jumpcloudMapping?.last_synced && (
                    <span className="text-xs text-slate-400">
                      Last synced {new Date(jumpcloudMapping.last_synced).toLocaleDateString()}
                    </span>
                  )}
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleSyncJumpCloud}
                    disabled={syncingJumpCloud}
                    className="gap-2"
                  >
                    <RefreshCw className={cn("w-4 h-4", syncingJumpCloud && "animate-spin")} />
                    {jumpcloudMapping?.last_synced ? 'Refresh' : 'Sync'}
                  </Button>
                </CardHeader>
                <CardContent>
                  {jumpcloudContacts.length === 0 ? (
                    <p className="text-center text-slate-500 py-8">No JumpCloud users found. Click Sync to pull data.</p>
                  ) : (
                    <div className="space-y-2">
                      {jumpcloudContacts.slice(jcUsersPage * 10, (jcUsersPage + 1) * 10).map(contact => (
                        <div 
                          key={contact.id} 
                          className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg hover:bg-slate-100 cursor-pointer transition-colors"
                          onClick={() => setSelectedContact(contact)}
                        >
                          <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 font-medium text-sm">
                            {contact.full_name?.charAt(0) || '?'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-slate-900 truncate">{contact.full_name}</p>
                            <p className="text-sm text-slate-500 truncate">{contact.email}</p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-400" />
                        </div>
                      ))}
                      {jumpcloudContacts.length > 10 && (
                        <div className="flex items-center justify-between pt-3 border-t mt-3">
                          <p className="text-sm text-slate-500">
                            Showing {jcUsersPage * 10 + 1}-{Math.min((jcUsersPage + 1) * 10, jumpcloudContacts.length)} of {jumpcloudContacts.length}
                          </p>
                          <div className="flex gap-2">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => setJcUsersPage(p => p - 1)}
                              disabled={jcUsersPage === 0}
                            >
                              Previous
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => setJcUsersPage(p => p + 1)}
                              disabled={(jcUsersPage + 1) * 10 >= jumpcloudContacts.length}
                            >
                              Next
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>


            </div>
          ) : (
            <Card><CardContent className="py-12 text-center text-slate-500">Not configured for this customer</CardContent></Card>
          )}
        </TabsContent>

        {/* Spanning Backup Tab */}
        <TabsContent value="spanning">
          {spanningMapping ? (
            <SpanningUsersTab 
              customerId={customerId} 
              spanningMapping={spanningMapping}
              queryClient={queryClient}
            />
          ) : (
            <Card><CardContent className="py-12 text-center text-slate-500">Not configured for this customer</CardContent></Card>
          )}
        </TabsContent>

        {/* Dark Web ID Tab */}
        <TabsContent value="darkweb">
          {hasDarkWeb ? (
            <DarkWebTab customerId={customerId} />
          ) : (
            <Card><CardContent className="py-12 text-center text-slate-500">Not configured for this customer</CardContent></Card>
          )}
        </TabsContent>

        {/* BullPhish ID Tab */}
        <TabsContent value="bullphish">
          {hasBullPhish ? (
            <BullPhishTab customerId={customerId} />
          ) : (
            <Card><CardContent className="py-12 text-center text-slate-500">Not configured for this customer</CardContent></Card>
          )}
        </TabsContent>

        {/* Datto EDR Tab */}
        <TabsContent value="edr">
          {hasEDR ? (
            <DattoEDRTab customerId={customerId} edrMapping={edrMapping} customerName={customer?.name} />
          ) : (
            <Card><CardContent className="py-12 text-center text-slate-500">Not configured for this customer</CardContent></Card>
          )}
        </TabsContent>

        {/* RocketCyber Tab */}
        <TabsContent value="rocketcyber">
          {hasRocketCyber ? (
            <RocketCyberTab customer={customer} />
          ) : (
            <Card><CardContent className="py-12 text-center text-slate-500">Not configured for this customer</CardContent></Card>
          )}
        </TabsContent>
      </Tabs>



      {/* User Detail Modal */}
      <UserDetailModal 
        contact={selectedContact}
        open={!!selectedContact}
        onClose={() => setSelectedContact(null)}
        customerId={customerId}
      />
    </div>
  );
}