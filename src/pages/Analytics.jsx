import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { client } from '@/api/client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import Breadcrumbs from '../components/ui/breadcrumbs';
import {
  TrendingUp,
  DollarSign,
  FileText,
  HelpCircle,
  Calendar,
  Filter,
  BarChart3,
  PieChart as PieChartIcon,
  Users
} from 'lucide-react';

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { format, subMonths, subDays, parseISO, startOfMonth, endOfMonth, isWithinInterval, eachMonthOfInterval } from 'date-fns';

const COLORS = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

export default function Analytics() {
  const [dateRange, setDateRange] = useState('6m'); // 1m, 3m, 6m, 1y, all
  const [selectedCustomer, setSelectedCustomer] = useState('');

  const { data: customers = [], isLoading: loadingCustomers } = useQuery({
    queryKey: ['customers'],
    queryFn: () => client.entities.Customer.list('-created_date', 500),
  });

  const { data: contracts = [], isLoading: loadingContracts } = useQuery({
    queryKey: ['contracts'],
    queryFn: () => client.entities.Contract.list('-created_date', 500),
  });

  const { data: recurringBills = [], isLoading: loadingBills } = useQuery({
    queryKey: ['recurring_bills'],
    queryFn: () => client.entities.RecurringBill.list('-created_date', 500),
  });

  const { data: tickets = [], isLoading: loadingTickets } = useQuery({
    queryKey: ['tickets'],
    queryFn: () => client.entities.Ticket.list('-created_date', 1000),
  });

  const { data: invoices = [], isLoading: loadingInvoices } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => client.entities.Invoice.list('-created_date', 500),
  });

  const isLoading = loadingCustomers || loadingContracts || loadingBills || loadingTickets || loadingInvoices;

  // Calculate date range
  const dateRangeInterval = useMemo(() => {
    const now = new Date();
    let start;
    switch (dateRange) {
      case '1m': start = subMonths(now, 1); break;
      case '3m': start = subMonths(now, 3); break;
      case '6m': start = subMonths(now, 6); break;
      case '1y': start = subMonths(now, 12); break;
      default: start = subMonths(now, 24);
    }
    return { start, end: now };
  }, [dateRange]);

  // Filter data by customer if selected
  const filteredContracts = selectedCustomer 
    ? contracts.filter(c => c.customer_id === selectedCustomer)
    : contracts;

  const filteredTickets = selectedCustomer
    ? tickets.filter(t => t.customer_id === selectedCustomer)
    : tickets;

  const filteredInvoices = selectedCustomer
    ? invoices.filter(i => i.customer_id === selectedCustomer)
    : invoices;

  // MRR Trend Data
  const mrrTrendData = useMemo(() => {
    const months = eachMonthOfInterval(dateRangeInterval);
    return months.map(month => {
      const monthStart = startOfMonth(month);
      const monthEnd = endOfMonth(month);
      
      // Calculate MRR from recurring bills
      const mrr = recurringBills
        .filter(bill => {
          if (selectedCustomer && bill.customer_id !== selectedCustomer) return false;
          const startDate = bill.start_date ? parseISO(bill.start_date) : new Date(0);
          const endDate = bill.end_date ? parseISO(bill.end_date) : new Date(2099, 11, 31);
          return startDate <= monthEnd && endDate >= monthStart && bill.status === 'active';
        })
        .reduce((sum, bill) => sum + (bill.amount || 0), 0);

      return {
        month: format(month, 'MMM yyyy'),
        mrr,
        customers: customers.filter(c => {
          if (selectedCustomer && c.id !== selectedCustomer) return false;
          const created = c.created_date ? parseISO(c.created_date) : new Date();
          return created <= monthEnd && c.status === 'active';
        }).length
      };
    });
  }, [dateRangeInterval, recurringBills, customers, selectedCustomer]);

  // Contract Value by Type
  const contractsByType = useMemo(() => {
    const types = {};
    filteredContracts.forEach(contract => {
      const type = contract.type || 'other';
      if (!types[type]) types[type] = { count: 0, value: 0 };
      types[type].count++;
      types[type].value += contract.value || 0;
    });
    return Object.entries(types).map(([name, data]) => ({
      name: name.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
      count: data.count,
      value: data.value
    }));
  }, [filteredContracts]);

  // Ticket Resolution Data
  const ticketResolutionData = useMemo(() => {
    const months = eachMonthOfInterval(dateRangeInterval);
    return months.map(month => {
      const monthStart = startOfMonth(month);
      const monthEnd = endOfMonth(month);
      
      const monthTickets = filteredTickets.filter(t => {
        const opened = t.date_opened ? parseISO(t.date_opened) : null;
        return opened && isWithinInterval(opened, { start: monthStart, end: monthEnd });
      });

      const resolved = monthTickets.filter(t => ['resolved', 'closed'].includes(t.status)).length;
      const total = monthTickets.length;

      return {
        month: format(month, 'MMM'),
        opened: total,
        resolved,
        resolutionRate: total > 0 ? Math.round((resolved / total) * 100) : 0
      };
    });
  }, [dateRangeInterval, filteredTickets]);

  // Ticket Priority Distribution
  const ticketsByPriority = useMemo(() => {
    const priorities = { critical: 0, high: 0, medium: 0, low: 0 };
    filteredTickets.forEach(t => {
      if (priorities[t.priority] !== undefined) priorities[t.priority]++;
    });
    return Object.entries(priorities).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value
    }));
  }, [filteredTickets]);

  // Invoice Payment Status
  const invoicesByStatus = useMemo(() => {
    const statuses = { paid: 0, sent: 0, overdue: 0, draft: 0 };
    filteredInvoices.forEach(i => {
      if (statuses[i.status] !== undefined) statuses[i.status]++;
    });
    return Object.entries(statuses).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value
    }));
  }, [filteredInvoices]);

  // Revenue by Month
  const revenueByMonth = useMemo(() => {
    const months = eachMonthOfInterval(dateRangeInterval);
    return months.map(month => {
      const monthStart = startOfMonth(month);
      const monthEnd = endOfMonth(month);
      
      const monthInvoices = filteredInvoices.filter(i => {
        const date = i.invoice_date ? parseISO(i.invoice_date) : null;
        return date && isWithinInterval(date, { start: monthStart, end: monthEnd });
      });

      const invoiced = monthInvoices.reduce((sum, i) => sum + (i.total || 0), 0);
      const collected = monthInvoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + (i.total || 0), 0);

      return {
        month: format(month, 'MMM'),
        invoiced,
        collected
      };
    });
  }, [dateRangeInterval, filteredInvoices]);

  // Summary Stats
  const stats = useMemo(() => {
    const totalMRR = recurringBills
      .filter(b => b.status === 'active' && (!selectedCustomer || b.customer_id === selectedCustomer))
      .reduce((sum, b) => sum + (b.amount || 0), 0);
    
    const activeContracts = filteredContracts.filter(c => c.status === 'active').length;
    const openTickets = filteredTickets.filter(t => ['open', 'in_progress', 'new'].includes(t.status)).length;
    const resolvedTickets = filteredTickets.filter(t => ['resolved', 'closed'].includes(t.status)).length;
    const resolutionRate = filteredTickets.length > 0 ? Math.round((resolvedTickets / filteredTickets.length) * 100) : 0;

    return { totalMRR, activeContracts, openTickets, resolutionRate };
  }, [recurringBills, filteredContracts, filteredTickets, selectedCustomer]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Analytics' }]} />
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Analytics & Reports</h1>
            <p className="text-sm text-slate-500">Track your business performance</p>
        </div>
        
        <div className="flex items-center gap-3">
          <select
            value={selectedCustomer}
            onChange={(e) => setSelectedCustomer(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white"
          >
            <option value="">All Customers</option>
            {customers.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
            {[
              { value: '1m', label: '1M' },
              { value: '3m', label: '3M' },
              { value: '6m', label: '6M' },
              { value: '1y', label: '1Y' },
              { value: 'all', label: 'All' }
            ].map(option => (
              <button
                key={option.value}
                onClick={() => setDateRange(option.value)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  dateRange === option.value
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-purple-600" />
            </div>
            <p className="text-sm text-slate-500">Monthly Revenue</p>
          </div>
          <p className="text-2xl font-bold text-slate-900">
            ${stats.totalMRR.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
        </div>
        
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-sm text-slate-500">Active Contracts</p>
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.activeContracts}</p>
        </div>
        
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
              <HelpCircle className="w-5 h-5 text-amber-600" />
            </div>
            <p className="text-sm text-slate-500">Open Tickets</p>
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.openTickets}</p>
        </div>
        
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
            </div>
            <p className="text-sm text-slate-500">Resolution Rate</p>
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.resolutionRate}%</p>
        </div>
      </div>

      {/* Charts */}
      <Tabs defaultValue="revenue" className="space-y-6">
        <TabsList className="bg-white border border-slate-200 p-1">
          <TabsTrigger value="revenue" className="gap-2">
            <DollarSign className="w-4 h-4" />
            Revenue
          </TabsTrigger>
          <TabsTrigger value="contracts" className="gap-2">
            <FileText className="w-4 h-4" />
            Contracts
          </TabsTrigger>
          <TabsTrigger value="tickets" className="gap-2">
            <HelpCircle className="w-4 h-4" />
            Tickets
          </TabsTrigger>
        </TabsList>

        <TabsContent value="revenue" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* MRR Trend */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900 mb-4">MRR Trend</h3>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={mrrTrendData}>
                  <defs>
                    <linearGradient id="mrrGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                  <Tooltip 
                    formatter={(value) => [`$${value.toLocaleString()}`, 'MRR']}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                  />
                  <Area type="monotone" dataKey="mrr" stroke="#8b5cf6" fill="url(#mrrGradient)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Revenue by Month */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900 mb-4">Invoiced vs Collected</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={revenueByMonth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                  <Tooltip 
                    formatter={(value) => [`$${value.toLocaleString()}`, '']}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                  />
                  <Legend />
                  <Bar dataKey="invoiced" name="Invoiced" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="collected" name="Collected" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Invoice Status Pie */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h3 className="font-semibold text-slate-900 mb-4">Invoice Status Distribution</h3>
            <div className="flex items-center justify-center">
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={invoicesByStatus}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {invoicesByStatus.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="contracts" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Contract Value by Type */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900 mb-4">Contract Value by Type</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={contractsByType} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" tick={{ fontSize: 12 }} stroke="#94a3b8" tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} stroke="#94a3b8" width={120} />
                  <Tooltip 
                    formatter={(value) => [`$${value.toLocaleString()}`, 'Value']}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                  />
                  <Bar dataKey="value" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Contract Count by Type */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900 mb-4">Contracts by Type</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={contractsByType}
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    dataKey="count"
                    label={({ name, count }) => `${name}: ${count}`}
                  >
                    {contractsByType.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="tickets" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Ticket Resolution Trend */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900 mb-4">Ticket Volume & Resolution</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={ticketResolutionData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                  <Legend />
                  <Bar dataKey="opened" name="Opened" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="resolved" name="Resolved" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Resolution Rate Trend */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900 mb-4">Resolution Rate Trend</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={ticketResolutionData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" domain={[0, 100]} tickFormatter={v => `${v}%`} />
                  <Tooltip 
                    formatter={(value) => [`${value}%`, 'Resolution Rate']}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                  />
                  <Line type="monotone" dataKey="resolutionRate" stroke="#8b5cf6" strokeWidth={2} dot={{ fill: '#8b5cf6' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Tickets by Priority */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 lg:col-span-2">
              <h3 className="font-semibold text-slate-900 mb-4">Tickets by Priority</h3>
              <div className="flex items-center justify-center">
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={ticketsByPriority}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      <Cell fill="#ef4444" />
                      <Cell fill="#f59e0b" />
                      <Cell fill="#eab308" />
                      <Cell fill="#06b6d4" />
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}