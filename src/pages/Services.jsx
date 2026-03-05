import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { client } from '@/api/client';
import Breadcrumbs from '../components/ui/breadcrumbs';
import {
  Cloud,
  Users,
  Shield,
  HardDrive,
  Search,
  Building2,
  CheckCircle2,
  XCircle,
  ChevronDown,
  Monitor,
  Smartphone,
  ArrowLeft,
  ExternalLink,
  Wifi,
  WifiOff,
  Server,
  Layers,
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// ── Service Definitions ──────────────────────────────────────────────

const SERVICES = [
  {
    id: 'jumpcloud',
    name: 'JumpCloud',
    description: 'Identity & access management',
    icon: Shield,
    color: 'emerald',
    gradient: 'from-emerald-500 to-teal-600',
    lightBg: 'bg-emerald-50',
    lightText: 'text-emerald-700',
    lightBorder: 'border-emerald-200',
  },
  {
    id: 'spanning',
    name: 'Unitrends Backup',
    description: 'Cloud-to-cloud backup protection',
    icon: HardDrive,
    color: 'blue',
    gradient: 'from-blue-500 to-indigo-600',
    lightBg: 'bg-blue-50',
    lightText: 'text-blue-700',
    lightBorder: 'border-blue-200',
  },
  {
    id: 'datto',
    name: 'Datto RMM',
    description: 'Remote monitoring & management',
    icon: Monitor,
    color: 'violet',
    gradient: 'from-violet-500 to-purple-600',
    lightBg: 'bg-violet-50',
    lightText: 'text-violet-700',
    lightBorder: 'border-violet-200',
  },
];

// ── Stat Card ────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, color = 'slate' }) {
  const colorMap = {
    emerald: 'bg-emerald-50 text-emerald-600',
    blue: 'bg-blue-50 text-blue-600',
    violet: 'bg-violet-50 text-violet-600',
    amber: 'bg-amber-50 text-amber-600',
    red: 'bg-red-50 text-red-600',
    slate: 'bg-slate-100 text-slate-600',
  };
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center gap-3">
        <div className={cn('p-2 rounded-lg', colorMap[color])}>
          <Icon className="w-4 h-4" />
        </div>
        <div>
          <p className="text-2xl font-bold text-slate-900">{value}</p>
          <p className="text-xs text-slate-500">{label}</p>
        </div>
      </div>
    </div>
  );
}

// ── Data Table ───────────────────────────────────────────────────────

function DataTable({ columns, data, emptyMessage }) {
  if (data.length === 0) {
    return (
      <div className="text-center py-12">
        <Layers className="w-8 h-8 mx-auto mb-3 text-slate-300" />
        <p className="text-sm text-slate-500">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-100">
            {columns.map((col) => (
              <th key={col.key} className="text-left py-3 px-4 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {data.map((row, i) => (
            <tr key={row.id || i} className="hover:bg-slate-50/50 transition-colors">
              {columns.map((col) => (
                <td key={col.key} className="py-3 px-4">
                  {col.render ? col.render(row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {data.length >= 50 && (
        <div className="text-center py-3 border-t border-slate-100">
          <p className="text-xs text-slate-400">Showing first 50 results</p>
        </div>
      )}
    </div>
  );
}

// ── JumpCloud Detail ─────────────────────────────────────────────────

function JumpCloudDetail({ customers }) {
  const [search, setSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState('all');
  const svc = SERVICES[0];

  const { data: mappings = [] } = useQuery({
    queryKey: ['jumpcloud-mappings'],
    queryFn: () => client.entities.JumpCloudMapping.list('-created_date', 500),
  });

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ['contacts-jumpcloud'],
    queryFn: () => client.entities.Contact.filter({ source: 'jumpcloud' }, '-created_date', 1000),
  });

  const { data: licenses = [] } = useQuery({
    queryKey: ['licenses-jumpcloud'],
    queryFn: () => client.entities.SaaSLicense.filter({ source: 'jumpcloud' }, '-created_date', 500),
  });

  const mappedCustomerIds = mappings.map(m => m.customer_id);
  const mappedCustomers = customers.filter(c => mappedCustomerIds.includes(c.id));

  const filteredContacts = contacts.filter(c => {
    const matchesSearch = !search ||
      c.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      c.email?.toLowerCase().includes(search.toLowerCase());
    const matchesCustomer = selectedCustomer === 'all' || c.customer_id === selectedCustomer;
    return matchesSearch && matchesCustomer;
  });

  if (isLoading) {
    return <div className="space-y-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}</div>;
  }

  const columns = [
    {
      key: 'full_name', label: 'User',
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white bg-gradient-to-br', svc.gradient)}>
            {(row.full_name?.charAt(0) || '?').toUpperCase()}
          </div>
          <div>
            <p className="font-medium text-sm text-slate-900">{row.full_name || 'Unknown'}</p>
            <p className="text-xs text-slate-400">{row.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'customer_id', label: 'Customer',
      render: (row) => {
        const customer = customers.find(c => c.id === row.customer_id);
        return <span className="text-sm text-slate-600">{customer?.name || 'Unassigned'}</span>;
      },
    },
    {
      key: 'title', label: 'Title',
      render: (row) => <span className="text-sm text-slate-500">{row.title || '-'}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon={Building2} label="Organizations" value={mappings.length} color="emerald" />
        <StatCard icon={Users} label="Total Users" value={contacts.length} color="blue" />
        <StatCard icon={Cloud} label="SSO Apps" value={licenses.length} color="violet" />
        <StatCard icon={Shield} label="License Assignments" value={licenses.reduce((sum, l) => sum + (l.assigned_users || 0), 0)} color="amber" />
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input placeholder="Search users..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
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

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-700">JumpCloud Users</p>
          <Badge variant="secondary" className="text-xs">{filteredContacts.length}</Badge>
        </div>
        <DataTable
          columns={columns}
          data={filteredContacts.slice(0, 50)}
          emptyMessage="No JumpCloud users found. Configure JumpCloud in Settings."
        />
      </div>
    </div>
  );
}

// ── Spanning/Unitrends Detail ────────────────────────────────────────

function SpanningDetail({ customers }) {
  const [search, setSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState('all');
  const svc = SERVICES[1];

  const { data: mappings = [], isLoading } = useQuery({
    queryKey: ['spanning-mappings'],
    queryFn: () => client.entities.SpanningMapping.list('-created_date', 500),
  });

  const { data: licenses = [] } = useQuery({
    queryKey: ['licenses-spanning'],
    queryFn: () => client.entities.SaaSLicense.filter({ vendor: 'Unitrends' }, '-created_date', 500),
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ['contacts-spanning'],
    queryFn: () => client.entities.Contact.filter({ source: 'spanning' }, '-created_date', 1000),
  });

  const mappedCustomerIds = mappings.map(m => m.customer_id);
  const mappedCustomers = customers.filter(c => mappedCustomerIds.includes(c.id));

  const filteredMappings = mappings.filter(m => {
    const customer = customers.find(c => c.id === m.customer_id);
    const matchesSearch = !search ||
      m.spanning_tenant_name?.toLowerCase().includes(search.toLowerCase()) ||
      customer?.name?.toLowerCase().includes(search.toLowerCase());
    const matchesCustomer = selectedCustomer === 'all' || m.customer_id === selectedCustomer;
    return matchesSearch && matchesCustomer;
  });

  if (isLoading) {
    return <div className="space-y-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}</div>;
  }

  const domainColumns = [
    {
      key: 'spanning_tenant_name', label: 'Domain',
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br', svc.gradient)}>
            <HardDrive className="w-4 h-4 text-white" />
          </div>
          <span className="font-medium text-sm text-slate-900">{row.spanning_tenant_name}</span>
        </div>
      ),
    },
    {
      key: 'customer_id', label: 'Customer',
      render: (row) => {
        const customer = customers.find(c => c.id === row.customer_id);
        return <span className="text-sm text-slate-600">{customer?.name || 'Unknown'}</span>;
      },
    },
    {
      key: 'last_synced', label: 'Last Synced',
      render: (row) => <span className="text-sm text-slate-500">{row.last_synced ? new Date(row.last_synced).toLocaleDateString() : 'Never'}</span>,
    },
    {
      key: 'users', label: 'Users',
      render: (row) => {
        const count = contacts.filter(c => c.customer_id === row.customer_id).length;
        return <Badge className={cn(svc.lightBg, svc.lightText, 'border', svc.lightBorder)}>{count}</Badge>;
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon={Building2} label="Domains" value={mappings.length} color="blue" />
        <StatCard icon={Users} label="Backup Users" value={contacts.length} color="violet" />
        <StatCard icon={HardDrive} label="Backup Licenses" value={licenses.length} color="emerald" />
        <StatCard icon={Shield} label="Protected Users" value={licenses.reduce((sum, l) => sum + (l.assigned_users || 0), 0)} color="amber" />
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input placeholder="Search domains..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
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

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-700">Backup Domains</p>
          <Badge variant="secondary" className="text-xs">{filteredMappings.length}</Badge>
        </div>
        <DataTable
          columns={domainColumns}
          data={filteredMappings}
          emptyMessage="No Unitrends domains found. Configure Unitrends in Settings."
        />
      </div>
    </div>
  );
}

// ── Datto RMM Detail ─────────────────────────────────────────────────

function DattoDetail({ customers }) {
  const [search, setSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const svc = SERVICES[2];

  const { data: mappings = [] } = useQuery({
    queryKey: ['datto-mappings'],
    queryFn: () => client.entities.DattoSiteMapping.list('-created_date', 500),
  });

  const { data: devices = [], isLoading } = useQuery({
    queryKey: ['devices'],
    queryFn: () => client.entities.Device.list('-created_date', 1000),
  });

  const mappedCustomerIds = mappings.map(m => m.customer_id);
  const mappedCustomers = customers.filter(c => mappedCustomerIds.includes(c.id));

  const onlineDevices = devices.filter(d => d.status === 'online').length;
  const offlineDevices = devices.filter(d => d.status === 'offline').length;

  const filteredDevices = devices.filter(d => {
    const matchesSearch = !search ||
      d.hostname?.toLowerCase().includes(search.toLowerCase()) ||
      d.os?.toLowerCase().includes(search.toLowerCase());
    const matchesCustomer = selectedCustomer === 'all' || d.customer_id === selectedCustomer;
    const matchesStatus = statusFilter === 'all' || d.status === statusFilter;
    return matchesSearch && matchesCustomer && matchesStatus;
  });

  if (isLoading) {
    return <div className="space-y-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}</div>;
  }

  const columns = [
    {
      key: 'hostname', label: 'Device',
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className={cn(
            'w-8 h-8 rounded-lg flex items-center justify-center',
            row.status === 'online' ? 'bg-emerald-50' : 'bg-red-50'
          )}>
            {row.device_type === 'server' ? (
              <Server className={cn('w-4 h-4', row.status === 'online' ? 'text-emerald-600' : 'text-red-500')} />
            ) : (
              <Monitor className={cn('w-4 h-4', row.status === 'online' ? 'text-emerald-600' : 'text-red-500')} />
            )}
          </div>
          <div>
            <p className="font-medium text-sm text-slate-900">{row.hostname}</p>
            <p className="text-xs text-slate-400">{row.os || 'Unknown OS'}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'customer_id', label: 'Customer',
      render: (row) => {
        const customer = customers.find(c => c.id === row.customer_id);
        return <span className="text-sm text-slate-600">{customer?.name || 'Unknown'}</span>;
      },
    },
    {
      key: 'device_type', label: 'Type',
      render: (row) => (
        <Badge className="bg-slate-100 text-slate-600 border border-slate-200 capitalize text-xs">
          {row.device_type || 'device'}
        </Badge>
      ),
    },
    {
      key: 'status', label: 'Status',
      render: (row) => (
        row.status === 'online' ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Online
          </span>
        ) : row.status === 'offline' ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500" /> Offline
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" /> Unknown
          </span>
        )
      ),
    },
    {
      key: 'last_seen', label: 'Last Seen',
      render: (row) => <span className="text-sm text-slate-500">{row.last_seen ? new Date(row.last_seen).toLocaleDateString() : '-'}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon={Building2} label="Sites" value={mappings.length} color="violet" />
        <StatCard icon={Monitor} label="Total Devices" value={devices.length} color="blue" />
        <StatCard icon={Wifi} label="Online" value={onlineDevices} color="emerald" />
        <StatCard icon={WifiOff} label="Offline" value={offlineDevices} color="red" />
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input placeholder="Search devices..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="online">Online</SelectItem>
            <SelectItem value="offline">Offline</SelectItem>
          </SelectContent>
        </Select>
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

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-700">Devices</p>
          <Badge variant="secondary" className="text-xs">{filteredDevices.length}</Badge>
        </div>
        <DataTable
          columns={columns}
          data={filteredDevices.slice(0, 50)}
          emptyMessage="No devices found. Configure Datto RMM in Settings."
        />
      </div>
    </div>
  );
}

// ── Main Services Page ───────────────────────────────────────────────

export default function Services() {
  const [activeService, setActiveService] = useState(null);

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => client.entities.Customer.list('-created_date', 500),
  });

  // Fetch counts for service cards
  const { data: jcMappings = [] } = useQuery({
    queryKey: ['jumpcloud-mappings'],
    queryFn: () => client.entities.JumpCloudMapping.list('-created_date', 500),
  });
  const { data: spanMappings = [] } = useQuery({
    queryKey: ['spanning-mappings'],
    queryFn: () => client.entities.SpanningMapping.list('-created_date', 500),
  });
  const { data: dattoMappings = [] } = useQuery({
    queryKey: ['datto-mappings'],
    queryFn: () => client.entities.DattoSiteMapping.list('-created_date', 500),
  });

  const serviceCounts = {
    jumpcloud: jcMappings.length,
    spanning: spanMappings.length,
    datto: dattoMappings.length,
  };

  const activeSvc = SERVICES.find(s => s.id === activeService);

  return (
    <div className="space-y-6">
      <Breadcrumbs items={activeService
        ? [{ label: 'Services', onClick: () => setActiveService(null) }, { label: activeSvc?.name }]
        : [{ label: 'Services' }]
      } />

      {!activeService ? (
        <>
          {/* Header */}
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Services</h1>
            <p className="text-slate-500 mt-1">Manage and monitor your integrated service platforms</p>
          </div>

          {/* Service Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {SERVICES.map((svc) => {
              const Icon = svc.icon;
              const count = serviceCounts[svc.id];
              const isConnected = count > 0;

              return (
                <button
                  key={svc.id}
                  onClick={() => setActiveService(svc.id)}
                  className={cn(
                    'group relative bg-white rounded-2xl border p-6 text-left transition-all duration-200',
                    'hover:shadow-lg hover:border-slate-300 hover:-translate-y-0.5',
                    'focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2',
                    'border-slate-200'
                  )}
                >
                  {/* Status dot */}
                  <div className="absolute top-4 right-4">
                    {isConnected ? (
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Connected
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-500 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                        Not configured
                      </span>
                    )}
                  </div>

                  {/* Icon */}
                  <div className={cn(
                    'w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br mb-4',
                    svc.gradient,
                    'group-hover:scale-110 transition-transform duration-200'
                  )}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>

                  {/* Info */}
                  <h3 className="font-semibold text-slate-900 text-lg">{svc.name}</h3>
                  <p className="text-sm text-slate-500 mt-1">{svc.description}</p>

                  {/* Bottom stats */}
                  <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-sm text-slate-400">
                      {isConnected
                        ? `${count} ${svc.id === 'jumpcloud' ? 'org' : svc.id === 'spanning' ? 'domain' : 'site'}${count !== 1 ? 's' : ''} mapped`
                        : 'Configure in Settings'}
                    </span>
                    <ChevronDown className="w-4 h-4 text-slate-400 -rotate-90 group-hover:translate-x-1 transition-transform" />
                  </div>
                </button>
              );
            })}
          </div>

          {/* Overview stats */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h2 className="text-sm font-semibold text-slate-700 mb-4">Platform Overview</h2>
            <div className="grid grid-cols-3 gap-6 text-center">
              <div>
                <p className="text-3xl font-bold text-slate-900">{Object.values(serviceCounts).reduce((a, b) => a + b, 0)}</p>
                <p className="text-xs text-slate-500 mt-1">Total Connections</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-slate-900">{Object.values(serviceCounts).filter(c => c > 0).length}</p>
                <p className="text-xs text-slate-500 mt-1">Active Services</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-slate-900">{customers.length}</p>
                <p className="text-xs text-slate-500 mt-1">Customers</p>
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Back button + Service header */}
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setActiveService(null)} className="shrink-0">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="flex items-center gap-3">
              <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br', activeSvc.gradient)}>
                <activeSvc.icon className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-slate-900">{activeSvc.name}</h1>
                <p className="text-sm text-slate-500">{activeSvc.description}</p>
              </div>
            </div>
          </div>

          {/* Service Detail */}
          {activeService === 'jumpcloud' && <JumpCloudDetail customers={customers} />}
          {activeService === 'spanning' && <SpanningDetail customers={customers} />}
          {activeService === 'datto' && <DattoDetail customers={customers} />}
        </>
      )}
    </div>
  );
}
