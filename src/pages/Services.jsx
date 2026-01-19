import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { 
  Cloud, 
  Users, 
  Shield, 
  HardDrive,
  RefreshCw,
  Search,
  Building2,
  CheckCircle2,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

function JumpCloudTab() {
  const [search, setSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState('all');

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list('-created_date', 500),
  });

  const { data: mappings = [] } = useQuery({
    queryKey: ['jumpcloud-mappings'],
    queryFn: () => base44.entities.JumpCloudMapping.list('-created_date', 500),
  });

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ['contacts-jumpcloud'],
    queryFn: () => base44.entities.Contact.filter({ source: 'jumpcloud' }, '-created_date', 1000),
  });

  const { data: licenses = [] } = useQuery({
    queryKey: ['licenses-jumpcloud'],
    queryFn: () => base44.entities.SaaSLicense.filter({ source: 'jumpcloud' }, '-created_date', 500),
  });

  const filteredContacts = contacts.filter(c => {
    const matchesSearch = !search || 
      c.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      c.email?.toLowerCase().includes(search.toLowerCase());
    const matchesCustomer = selectedCustomer === 'all' || c.customer_id === selectedCustomer;
    return matchesSearch && matchesCustomer;
  });

  const mappedCustomerIds = mappings.map(m => m.customer_id);
  const mappedCustomers = customers.filter(c => mappedCustomerIds.includes(c.id));

  if (isLoading) {
    return <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>;
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Building2 className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{mappings.length}</p>
                <p className="text-sm text-slate-500">Organizations</p>
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
                <p className="text-2xl font-bold">{contacts.length}</p>
                <p className="text-sm text-slate-500">Total Users</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Cloud className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{licenses.length}</p>
                <p className="text-sm text-slate-500">SSO Apps</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <Shield className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{licenses.reduce((sum, l) => sum + (l.assigned_users || 0), 0)}</p>
                <p className="text-sm text-slate-500">License Assignments</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input 
            placeholder="Search users..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All Customers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Customers</SelectItem>
            {mappedCustomers.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>JumpCloud Users</CardTitle>
          <CardDescription>Users synced from JumpCloud directory</CardDescription>
        </CardHeader>
        <CardContent>
          {filteredContacts.length === 0 ? (
            <p className="text-center text-slate-500 py-8">No JumpCloud users found. Configure JumpCloud in Settings to sync users.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium text-slate-600">Name</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-600">Email</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-600">Customer</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-600">Title</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredContacts.slice(0, 50).map(contact => {
                    const customer = customers.find(c => c.id === contact.customer_id);
                    return (
                      <tr key={contact.id} className="border-b hover:bg-slate-50">
                        <td className="py-3 px-4 font-medium">{contact.full_name}</td>
                        <td className="py-3 px-4 text-slate-600">{contact.email}</td>
                        <td className="py-3 px-4">
                          <Badge variant="outline">{customer?.name || 'Unknown'}</Badge>
                        </td>
                        <td className="py-3 px-4 text-slate-500">{contact.title || '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredContacts.length > 50 && (
                <p className="text-center text-sm text-slate-500 py-4">
                  Showing 50 of {filteredContacts.length} users
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SpanningTab() {
  const [search, setSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState('all');

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list('-created_date', 500),
  });

  const { data: mappings = [], isLoading } = useQuery({
    queryKey: ['spanning-mappings'],
    queryFn: () => base44.entities.SpanningMapping.list('-created_date', 500),
  });

  const { data: licenses = [] } = useQuery({
    queryKey: ['licenses-spanning'],
    queryFn: () => base44.entities.SaaSLicense.filter({ vendor: 'Unitrends' }, '-created_date', 500),
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ['contacts-spanning'],
    queryFn: () => base44.entities.Contact.filter({ source: 'spanning' }, '-created_date', 1000),
  });

  const filteredMappings = mappings.filter(m => {
    const customer = customers.find(c => c.id === m.customer_id);
    const matchesSearch = !search || 
      m.spanning_tenant_name?.toLowerCase().includes(search.toLowerCase()) ||
      customer?.name?.toLowerCase().includes(search.toLowerCase());
    const matchesCustomer = selectedCustomer === 'all' || m.customer_id === selectedCustomer;
    return matchesSearch && matchesCustomer;
  });

  const mappedCustomerIds = mappings.map(m => m.customer_id);
  const mappedCustomers = customers.filter(c => mappedCustomerIds.includes(c.id));

  if (isLoading) {
    return <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>;
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Building2 className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{mappings.length}</p>
                <p className="text-sm text-slate-500">Domains</p>
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
                <p className="text-2xl font-bold">{contacts.length}</p>
                <p className="text-sm text-slate-500">Backup Users</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <HardDrive className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{licenses.length}</p>
                <p className="text-sm text-slate-500">Backup Licenses</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <Shield className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{licenses.reduce((sum, l) => sum + (l.assigned_users || 0), 0)}</p>
                <p className="text-sm text-slate-500">Protected Users</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input 
            placeholder="Search domains..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All Customers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Customers</SelectItem>
            {mappedCustomers.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Domains Table */}
      <Card>
        <CardHeader>
          <CardTitle>Unitrends Backup Domains</CardTitle>
          <CardDescription>Spanning backup domains and their status</CardDescription>
        </CardHeader>
        <CardContent>
          {filteredMappings.length === 0 ? (
            <p className="text-center text-slate-500 py-8">No Unitrends domains found. Configure Unitrends in Settings to sync domains.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium text-slate-600">Domain</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-600">Customer</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-600">Last Synced</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-600">Users</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMappings.map(mapping => {
                    const customer = customers.find(c => c.id === mapping.customer_id);
                    const domainContacts = contacts.filter(c => c.customer_id === mapping.customer_id);
                    return (
                      <tr key={mapping.id} className="border-b hover:bg-slate-50">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <HardDrive className="w-4 h-4 text-slate-400" />
                            <span className="font-medium">{mapping.spanning_tenant_name}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant="outline">{customer?.name || 'Unknown'}</Badge>
                        </td>
                        <td className="py-3 px-4 text-slate-500">
                          {mapping.last_synced ? new Date(mapping.last_synced).toLocaleDateString() : 'Never'}
                        </td>
                        <td className="py-3 px-4">
                          <Badge className="bg-purple-100 text-purple-700">{domainContacts.length} users</Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Backup Users */}
      {contacts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Backup Users</CardTitle>
            <CardDescription>Users with Spanning backup protection</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium text-slate-600">Name</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-600">Email</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-600">Customer</th>
                  </tr>
                </thead>
                <tbody>
                  {contacts.filter(c => {
                    const matchesSearch = !search || 
                      c.full_name?.toLowerCase().includes(search.toLowerCase()) ||
                      c.email?.toLowerCase().includes(search.toLowerCase());
                    const matchesCustomer = selectedCustomer === 'all' || c.customer_id === selectedCustomer;
                    return matchesSearch && matchesCustomer;
                  }).slice(0, 50).map(contact => {
                    const customer = customers.find(c => c.id === contact.customer_id);
                    return (
                      <tr key={contact.id} className="border-b hover:bg-slate-50">
                        <td className="py-3 px-4 font-medium">{contact.full_name}</td>
                        <td className="py-3 px-4 text-slate-600">{contact.email}</td>
                        <td className="py-3 px-4">
                          <Badge variant="outline">{customer?.name || 'Unknown'}</Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function DattoTab() {
  const [search, setSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState('all');

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list('-created_date', 500),
  });

  const { data: mappings = [] } = useQuery({
    queryKey: ['datto-mappings'],
    queryFn: () => base44.entities.DattoSiteMapping.list('-created_date', 500),
  });

  const { data: devices = [], isLoading } = useQuery({
    queryKey: ['devices'],
    queryFn: () => base44.entities.Device.list('-created_date', 1000),
  });

  const filteredDevices = devices.filter(d => {
    const matchesSearch = !search || 
      d.hostname?.toLowerCase().includes(search.toLowerCase()) ||
      d.os?.toLowerCase().includes(search.toLowerCase());
    const matchesCustomer = selectedCustomer === 'all' || d.customer_id === selectedCustomer;
    return matchesSearch && matchesCustomer;
  });

  const mappedCustomerIds = mappings.map(m => m.customer_id);
  const mappedCustomers = customers.filter(c => mappedCustomerIds.includes(c.id));

  const onlineDevices = devices.filter(d => d.status === 'online').length;
  const offlineDevices = devices.filter(d => d.status === 'offline').length;

  if (isLoading) {
    return <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>;
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Building2 className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{mappings.length}</p>
                <p className="text-sm text-slate-500">Sites</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <HardDrive className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{devices.length}</p>
                <p className="text-sm text-slate-500">Total Devices</p>
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
                <p className="text-2xl font-bold">{onlineDevices}</p>
                <p className="text-sm text-slate-500">Online</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <XCircle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{offlineDevices}</p>
                <p className="text-sm text-slate-500">Offline</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input 
            placeholder="Search devices..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All Customers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Customers</SelectItem>
            {mappedCustomers.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Devices Table */}
      <Card>
        <CardHeader>
          <CardTitle>Datto RMM Devices</CardTitle>
          <CardDescription>Managed devices from Datto RMM</CardDescription>
        </CardHeader>
        <CardContent>
          {filteredDevices.length === 0 ? (
            <p className="text-center text-slate-500 py-8">No devices found. Configure Datto RMM in Settings to sync devices.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium text-slate-600">Hostname</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-600">Customer</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-600">OS</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-600">Type</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-600">Status</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-600">Last Seen</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDevices.slice(0, 50).map(device => {
                    const customer = customers.find(c => c.id === device.customer_id);
                    return (
                      <tr key={device.id} className="border-b hover:bg-slate-50">
                        <td className="py-3 px-4 font-medium">{device.hostname}</td>
                        <td className="py-3 px-4">
                          <Badge variant="outline">{customer?.name || 'Unknown'}</Badge>
                        </td>
                        <td className="py-3 px-4 text-slate-600 text-sm">{device.os || '-'}</td>
                        <td className="py-3 px-4">
                          <Badge className="bg-slate-100 text-slate-700 capitalize">{device.device_type}</Badge>
                        </td>
                        <td className="py-3 px-4">
                          {device.status === 'online' ? (
                            <Badge className="bg-green-100 text-green-700">Online</Badge>
                          ) : device.status === 'offline' ? (
                            <Badge className="bg-red-100 text-red-700">Offline</Badge>
                          ) : (
                            <Badge className="bg-slate-100 text-slate-700">Unknown</Badge>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-500 text-sm">
                          {device.last_seen ? new Date(device.last_seen).toLocaleDateString() : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredDevices.length > 50 && (
                <p className="text-center text-sm text-slate-500 py-4">
                  Showing 50 of {filteredDevices.length} devices
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function Services() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Services</h1>
        <p className="text-slate-500 mt-1">View all integrated service data across your customers</p>
      </div>

      <Tabs defaultValue="jumpcloud" className="space-y-6">
        <TabsList className="bg-white border border-slate-200/50">
          <TabsTrigger value="jumpcloud" className="gap-2">
            <Shield className="w-4 h-4" />
            JumpCloud
          </TabsTrigger>
          <TabsTrigger value="spanning" className="gap-2">
            <HardDrive className="w-4 h-4" />
            Unitrends Backup
          </TabsTrigger>
          <TabsTrigger value="datto" className="gap-2">
            <Cloud className="w-4 h-4" />
            Datto RMM
          </TabsTrigger>
        </TabsList>

        <TabsContent value="jumpcloud">
          <JumpCloudTab />
        </TabsContent>

        <TabsContent value="spanning">
          <SpanningTab />
        </TabsContent>

        <TabsContent value="datto">
          <DattoTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}