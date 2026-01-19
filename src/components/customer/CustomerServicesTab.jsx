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
  const [jcUsersPage, setJcUsersPage] = useState(0);
  const [selectedContact, setSelectedContact] = useState(null);

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

  // Fetch Spanning contacts for this customer
  const { data: spanningContacts = [] } = useQuery({
    queryKey: ['spanning-contacts', customerId],
    queryFn: () => base44.entities.Contact.filter({ customer_id: customerId, source: 'spanning' }),
    enabled: !!customerId && !!spanningMapping
  });

  // Fetch Spanning licenses for this customer
  const { data: spanningLicenses = [] } = useQuery({
    queryKey: ['spanning-licenses', customerId],
    queryFn: () => base44.entities.SaaSLicense.filter({ customer_id: customerId, vendor: 'Unitrends' }),
    enabled: !!customerId && !!spanningMapping
  });

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

  return (
    <div className="space-y-6">
      <Tabs defaultValue={hasRecurringServices ? "recurring" : hasJumpCloud ? "jumpcloud" : "spanning"} className="space-y-4">
        <TabsList className="bg-white border border-slate-200">
          {hasRecurringServices && (
            <TabsTrigger value="recurring" className="gap-2">
              <HardDrive className="w-4 h-4" />
              Recurring Services
            </TabsTrigger>
          )}
          {hasJumpCloud && (
            <TabsTrigger value="jumpcloud" className="gap-2">
              <Shield className="w-4 h-4" />
              JumpCloud
            </TabsTrigger>
          )}
          {hasSpanning && (
            <TabsTrigger value="spanning" className="gap-2">
              <Cloud className="w-4 h-4" />
              Unitrends Backup
            </TabsTrigger>
          )}
        </TabsList>

        {/* Recurring Services Tab */}
        {hasRecurringServices && (
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
        )}

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
                        <div key={contact.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                          <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 font-medium text-sm">
                            {contact.full_name?.charAt(0) || '?'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-slate-900 truncate">{contact.full_name}</p>
                            <p className="text-sm text-slate-500 truncate">{contact.email}</p>
                          </div>
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

        {/* Spanning/Unitrends Tab */}
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
                        <p className="text-2xl font-bold">{spanningLicenses.reduce((sum, l) => sum + (l.assigned_users || 0), 0)}</p>
                        <p className="text-sm text-slate-500">Protected Users</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Domain Info */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Backup Domain</CardTitle>
                    <CardDescription>{spanningMapping?.spanning_tenant_name || 'Connected domain'}</CardDescription>
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
                  <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl">
                    <div className="p-3 bg-blue-100 rounded-lg">
                      <HardDrive className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">{spanningMapping?.spanning_tenant_name}</p>
                      <p className="text-sm text-slate-500">
                        Last synced: {spanningMapping?.last_synced ? new Date(spanningMapping.last_synced).toLocaleDateString() : 'Never'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Backup Users */}
              {spanningContacts.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Backup Users</CardTitle>
                    <CardDescription>Users with Spanning backup protection</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {spanningContacts.slice(0, 10).map(contact => (
                        <div key={contact.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-medium text-sm">
                            {contact.full_name?.charAt(0) || '?'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-slate-900 truncate">{contact.full_name}</p>
                            <p className="text-sm text-slate-500 truncate">{contact.email}</p>
                          </div>
                          <Badge className="bg-green-100 text-green-700">Protected</Badge>
                        </div>
                      ))}
                      {spanningContacts.length > 10 && (
                        <p className="text-center text-sm text-slate-500 py-2">
                          +{spanningContacts.length - 10} more users
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        )}
      </Tabs>

      {/* Empty state if no services connected */}
      {!hasJumpCloud && !hasSpanning && !hasRecurringServices && (
        <Card>
          <CardContent className="py-12 text-center">
            <Cloud className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">No services connected for this customer.</p>
            <p className="text-sm text-slate-400 mt-1">Configure integrations in Settings to sync service data.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}