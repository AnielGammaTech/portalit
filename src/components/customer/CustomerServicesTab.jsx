import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
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
  ChevronRight
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import UserDetailModal from './UserDetailModal';

export default function CustomerServicesTab({ 
  customerId, 
  customer, 
  lineItems = [],
  expandedBills,
  setExpandedBills,
  isSyncing,
  setIsSyncing,
  queryClient
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

  // Fetch JumpCloud mapping for this customer
  const { data: jumpcloudMapping } = useQuery({
    queryKey: ['jumpcloud-mapping', customerId],
    queryFn: async () => {
      const mappings = await base44.entities.JumpCloudMapping.filter({ customer_id: customerId });
      return mappings[0] || null;
    },
    enabled: !!customerId
  });

  // Fetch Spanning mapping for this customer
  const { data: spanningMapping } = useQuery({
    queryKey: ['spanning-mapping', customerId],
    queryFn: async () => {
      const mappings = await base44.entities.SpanningMapping.filter({ customer_id: customerId });
      return mappings[0] || null;
    },
    enabled: !!customerId
  });

  // Fetch JumpCloud contacts for this customer
  const { data: jumpcloudContacts = [] } = useQuery({
    queryKey: ['jumpcloud-contacts', customerId],
    queryFn: () => base44.entities.Contact.filter({ customer_id: customerId, source: 'jumpcloud' }),
    enabled: !!customerId && !!jumpcloudMapping
  });

  // Fetch JumpCloud licenses for this customer
  const { data: jumpcloudLicenses = [] } = useQuery({
    queryKey: ['jumpcloud-licenses', customerId],
    queryFn: () => base44.entities.SaaSLicense.filter({ customer_id: customerId, source: 'jumpcloud' }),
    enabled: !!customerId && !!jumpcloudMapping
  });

  // Fetch Spanning contacts for this customer (any contact with spanning_status set)
  const { data: spanningContacts = [] } = useQuery({
    queryKey: ['spanning-contacts', customerId],
    queryFn: async () => {
      const contacts = await base44.entities.Contact.filter({ customer_id: customerId });
      return contacts.filter(c => c.spanning_status);
    },
    enabled: !!customerId && !!spanningMapping
  });

  // Fetch Spanning licenses for this customer
  const { data: spanningLicenses = [] } = useQuery({
    queryKey: ['spanning-licenses', customerId],
    queryFn: () => base44.entities.SaaSLicense.filter({ customer_id: customerId, vendor: 'Unitrends' }),
    enabled: !!customerId && !!spanningMapping
  });

  // Fetch Datto site mapping for this customer
  const { data: dattoMapping } = useQuery({
    queryKey: ['datto-mapping', customerId],
    queryFn: async () => {
      const mappings = await base44.entities.DattoSiteMapping.filter({ customer_id: customerId });
      return mappings[0] || null;
    },
    enabled: !!customerId
  });

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
      const response = await base44.functions.invoke('syncHaloPSAContacts', {
        action: 'sync_customer',
        customer_id: customer.external_id
      });
      if (response.data.success) {
        updateSyncStatus('halopsa', 'success');
        toast.success(`HaloPSA: Synced ${response.data.recordsSynced || 0} contacts`);
        queryClient.invalidateQueries();
      } else {
        updateSyncStatus('halopsa', 'error', response.data.error);
        toast.error(response.data.error || 'HaloPSA sync failed');
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
      const response = await base44.functions.invoke('syncDattoRMMDevices', {
        action: 'sync_site',
        site_id: dattoMapping.datto_site_id
      });
      if (response.data.success) {
        updateSyncStatus('datto', 'success');
        toast.success(`Datto: Synced ${response.data.synced || 0} devices`);
        queryClient.invalidateQueries();
      } else {
        updateSyncStatus('datto', 'error', response.data.error);
        toast.error(response.data.error || 'Datto sync failed');
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
          const res = await base44.functions.invoke('syncHaloPSAContacts', {
            action: 'sync_customer',
            customer_id: customer.external_id
          });
          if (res.data.success) {
            updateSyncStatus('halopsa', 'success');
            results.push(`HaloPSA (${res.data.recordsSynced || 0} contacts)`);
          } else {
            updateSyncStatus('halopsa', 'error', res.data.error);
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
          const res = await base44.functions.invoke('syncDattoRMMDevices', {
            action: 'sync_site',
            site_id: dattoMapping.datto_site_id
          });
          if (res.data.success) {
            updateSyncStatus('datto', 'success');
            results.push(`Datto (${res.data.synced || 0} devices)`);
          } else {
            updateSyncStatus('datto', 'error', res.data.error);
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
          const res = await base44.functions.invoke('syncJumpCloudLicenses', {
            action: 'sync_licenses',
            customer_id: customerId
          });
          if (res.data.success) {
            updateSyncStatus('jumpcloud', 'success');
            results.push(`JumpCloud (${res.data.contactsCreated + res.data.contactsUpdated || 0} users)`);
          } else {
            updateSyncStatus('jumpcloud', 'error', res.data.error);
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
          const res = await base44.functions.invoke('syncSpanningBackup', {
            action: 'sync_licenses',
            customer_id: customerId
          });
          if (res.data.success) {
            updateSyncStatus('spanning', 'success');
            results.push(`Spanning (${res.data.contactsUpdated || 0} users)`);
          } else {
            updateSyncStatus('spanning', 'error', res.data.error);
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
      const response = await base44.functions.invoke('syncJumpCloudLicenses', {
        action: 'sync_licenses',
        customer_id: customerId
      });
      if (response.data.success) {
        toast.success('JumpCloud data synced!');
        queryClient.invalidateQueries({ queryKey: ['jumpcloud-contacts', customerId] });
        queryClient.invalidateQueries({ queryKey: ['jumpcloud-licenses', customerId] });
      } else {
        toast.error(response.data.error || 'Sync failed');
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSyncingJumpCloud(false);
    }
  };

  const handleSyncSpanning = async () => {
    if (!spanningMapping) return;
    setSyncingSpanning(true);
    try {
      const response = await base44.functions.invoke('syncSpanningBackup', {
        action: 'sync_licenses',
        customer_id: customerId
      });
      if (response.data.success) {
        toast.success('Unitrends data synced!');
        queryClient.invalidateQueries({ queryKey: ['spanning-contacts', customerId] });
        queryClient.invalidateQueries({ queryKey: ['spanning-licenses', customerId] });
      } else {
        toast.error(response.data.error || 'Sync failed');
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
        <div className="flex items-center justify-between">
          <TabsList className="bg-white border border-slate-200 p-1 h-auto mx-auto">
            <TabsTrigger value="recurring" className="gap-2 py-2 px-4 text-sm font-medium">
              <HardDrive className="w-4 h-4" />
              Recurring Services
            </TabsTrigger>
            {hasJumpCloud && (
              <TabsTrigger value="jumpcloud" className="gap-2 py-2 px-4 text-sm font-medium">
                <Shield className="w-4 h-4" />
                JumpCloud
              </TabsTrigger>
            )}
            {hasSpanning && (
              <TabsTrigger value="spanning" className="gap-2 py-2 px-4 text-sm font-medium">
                <Cloud className="w-4 h-4" />
                Spanning Backup
              </TabsTrigger>
            )}
          </TabsList>
          
          {/* Sync All Button - Smaller & Sleeker */}
          {integrations.length > 0 && (
            <Button
              onClick={handleSyncAll}
              disabled={syncingAll}
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs h-8"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", syncingAll && "animate-spin")} />
              {syncingAll ? 'Syncing...' : 'Sync All'}
            </Button>
          )}
        </div>

        {/* Recurring Services Tab - Always show */}
        <TabsContent value="recurring">
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <button
                onClick={() => setExpandedBills(prev => ({ ...prev, _section: !prev._section }))}
                className="w-full px-6 py-5 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <div>
                  <h3 className="font-semibold text-gray-900 text-left">Your Services</h3>
                  <p className="text-sm text-gray-500 mt-0.5">{lineItems.length} items • ${lineItems.reduce((sum, item) => sum + (item.net_amount || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}/month</p>
                </div>
                <div className="flex items-center gap-3">
                  {customer?.source === 'halopsa' && (
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        try {
                          setIsSyncing(true);
                          const response = await base44.functions.invoke('syncHaloPSARecurringBills', { 
                            action: 'sync_customer',
                            customer_id: customer.external_id 
                          });
                          if (response.data.success) {
                            toast.success(`Synced!`);
                            queryClient.invalidateQueries({ queryKey: ['recurring_bills', customerId] });
                            queryClient.invalidateQueries({ queryKey: ['line_items', customerId] });
                          } else {
                            toast.error(response.data.error || 'Sync failed');
                          }
                        } catch (error) {
                          toast.error(error.message || 'An error occurred');
                        } finally {
                          setIsSyncing(false);
                        }
                      }}
                      disabled={isSyncing}
                      className="text-gray-400 hover:text-gray-600 p-2"
                    >
                      <RefreshCw className={cn("w-4 h-4", isSyncing && "animate-spin")} />
                    </button>
                  )}
                  <ChevronDown className={cn(
                    "w-5 h-5 text-gray-400 transition-transform",
                    expandedBills._section && "rotate-180"
                  )} />
                </div>
              </button>
              
              {expandedBills._section && (
                <div className="border-t border-gray-100">
                  {lineItems.length === 0 ? (
                    <div className="py-12 text-center">
                      <p className="text-gray-500">No services found</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {lineItems.map(item => (
                        <div key={item.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900">{item.description?.replace(/\s*\$recurringbillingdate\s*/gi, '').trim()}</p>
                            <p className="text-sm text-gray-500 mt-0.5">Qty: {item.quantity}</p>
                          </div>
                          <p className="font-semibold text-gray-900 text-lg">${(item.net_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </TabsContent>

        {/* JumpCloud Tab */}
        {hasJumpCloud && (
          <TabsContent value="jumpcloud">
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
                        <p className="text-2xl font-bold">{jumpcloudContacts.length}</p>
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
                        <p className="text-2xl font-bold">{jumpcloudLicenses.length}</p>
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
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleSyncJumpCloud}
                    disabled={syncingJumpCloud}
                    className="gap-2"
                  >
                    <RefreshCw className={cn("w-4 h-4", syncingJumpCloud && "animate-spin")} />
                    Sync
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

              {/* SSO Apps */}
              {jumpcloudLicenses.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>SSO Applications</CardTitle>
                    <CardDescription>Applications connected via JumpCloud SSO</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {jumpcloudLicenses.map(license => (
                        <div key={license.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                          <div className="flex items-center gap-3">
                            {license.logo_url ? (
                              <img src={license.logo_url} alt="" className="w-8 h-8 rounded object-contain" />
                            ) : (
                              <div className="w-8 h-8 rounded bg-blue-100 flex items-center justify-center">
                                <Cloud className="w-4 h-4 text-blue-600" />
                              </div>
                            )}
                            <div>
                              <p className="font-medium text-slate-900">{license.application_name}</p>
                              <p className="text-sm text-slate-500">{license.license_type || 'SSO'}</p>
                            </div>
                          </div>
                          <Badge className="bg-purple-100 text-purple-700">
                            {license.assigned_users || 0} users
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        )}

        {/* Spanning Backup Tab */}
        {hasSpanning && (
          <TabsContent value="spanning">
            <div className="space-y-4">
              {/* Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <HardDrive className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">1</p>
                        <p className="text-sm text-slate-500">Backup Domain</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-purple-100 rounded-lg">
                        <Users className="w-5 h-5 text-purple-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{spanningContacts.length}</p>
                        <p className="text-sm text-slate-500">Backup Users</p>
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
                        <p className="text-2xl font-bold">{spanningContacts.filter(c => c.spanning_status?.includes('PROTECTED')).length}</p>
                        <p className="text-sm text-slate-500">Protected Users</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Backup Users */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Spanning Backup Users</CardTitle>
                    <CardDescription>Users with Microsoft 365 backup protection ({spanningContacts.length} total)</CardDescription>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleSyncSpanning}
                    disabled={syncingSpanning}
                    className="gap-2"
                  >
                    <RefreshCw className={cn("w-4 h-4", syncingSpanning && "animate-spin")} />
                    Sync
                  </Button>
                </CardHeader>
                <CardContent>
                  {spanningContacts.length === 0 ? (
                      <p className="text-center text-slate-500 py-8">No Spanning users found. Click Sync to pull data.</p>
                    ) : (
                      <div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                          {spanningContacts.slice(spanningUsersPage * 24, (spanningUsersPage + 1) * 24).map(contact => {
                            const statusField = contact.spanning_status || '';
                            const parts = statusField.split(' | ');
                            const isProtected = parts.includes('PROTECTED');
                            const hasStorage = parts.length >= 2 && !parts[0].includes('success') && !parts[0].includes('protected');
                            const storageInfo = hasStorage ? parts[0] : null;

                            return (
                              <div key={contact.id} className="bg-slate-50 hover:bg-slate-100 rounded-xl p-3 transition-all text-center">
                                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-medium text-sm mx-auto mb-2">
                                  {contact.full_name?.charAt(0) || '?'}
                                </div>
                                <p className="font-medium text-slate-900 text-sm truncate">{contact.full_name}</p>
                                {storageInfo && (
                                  <p className="text-xs text-slate-500 mt-0.5">{storageInfo}</p>
                                )}
                                <div className="mt-1">
                                  {isProtected ? (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Protected</span>
                                  ) : (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-200 text-slate-500">Not Protected</span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        {spanningContacts.length > 24 && (
                          <div className="flex items-center justify-between pt-4 mt-4 border-t">
                            <p className="text-sm text-slate-500">
                              Showing {spanningUsersPage * 24 + 1}-{Math.min((spanningUsersPage + 1) * 24, spanningContacts.length)} of {spanningContacts.length}
                            </p>
                            <div className="flex gap-2">
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => setSpanningUsersPage(p => p - 1)}
                                disabled={spanningUsersPage === 0}
                              >
                                Previous
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => setSpanningUsersPage(p => p + 1)}
                                disabled={(spanningUsersPage + 1) * 24 >= spanningContacts.length}
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
          </TabsContent>
        )}
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