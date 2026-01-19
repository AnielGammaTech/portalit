import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import {
  ArrowLeft, Cloud, DollarSign, TrendingUp, PieChart, BarChart3,
  Calendar, Filter, Download, AlertTriangle, CheckCircle2, Users
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { format, subMonths, parseISO } from 'date-fns';
import {
  PieChart as RechartsPie, Pie, Cell, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, LineChart, Line
} from 'recharts';
import SpendAnomalyAlert from '../components/saas/SpendAnomalyAlert';

const COLORS = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#6366f1', '#84cc16'];

const CATEGORIES = [
  { value: '', label: 'All Categories' },
  { value: 'productivity', label: '📊 Productivity' },
  { value: 'security', label: '🔒 Security' },
  { value: 'collaboration', label: '💬 Collaboration' },
  { value: 'crm', label: '🤝 CRM & Sales' },
  { value: 'finance', label: '💰 Finance' },
  { value: 'hr', label: '👥 HR & People' },
  { value: 'marketing', label: '📣 Marketing' },
  { value: 'development', label: '💻 Development' },
  { value: 'other', label: '📦 Other' },
];

export default function SaaSReports() {
  const [dateRange, setDateRange] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState('');

  const { data: licenses = [], isLoading: loadingLicenses } = useQuery({
    queryKey: ['all_licenses'],
    queryFn: () => base44.entities.SaaSLicense.list()
  });

  const { data: assignments = [], isLoading: loadingAssignments } = useQuery({
    queryKey: ['all_assignments'],
    queryFn: () => base44.entities.LicenseAssignment.list()
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list()
  });

  // Filter licenses
  const filteredLicenses = useMemo(() => {
    return licenses.filter(l => {
      if (categoryFilter && l.category !== categoryFilter) return false;
      if (selectedCustomer && l.customer_id !== selectedCustomer) return false;
      return true;
    });
  }, [licenses, categoryFilter, selectedCustomer]);

  // Calculate metrics
  const metrics = useMemo(() => {
    const totalSpend = filteredLicenses.reduce((sum, l) => sum + (l.total_cost || 0), 0);
    const totalSeats = filteredLicenses.reduce((sum, l) => sum + (l.quantity || 0), 0);
    const activeAssignments = assignments.filter(a => 
      a.status === 'active' && 
      filteredLicenses.some(l => l.id === a.license_id)
    );
    const assignedSeats = activeAssignments.length;
    const unusedSeats = totalSeats - assignedSeats;
    const wastedSpend = totalSeats > 0 ? (unusedSeats / totalSeats) * totalSpend : 0;
    const utilizationRate = totalSeats > 0 ? (assignedSeats / totalSeats) * 100 : 0;

    return { totalSpend, totalSeats, assignedSeats, unusedSeats, wastedSpend, utilizationRate };
  }, [filteredLicenses, assignments]);

  // Category breakdown data
  const categoryData = useMemo(() => {
    const byCategory = {};
    filteredLicenses.forEach(l => {
      const cat = l.category || 'other';
      if (!byCategory[cat]) {
        byCategory[cat] = { name: cat, spend: 0, count: 0, seats: 0, assigned: 0 };
      }
      byCategory[cat].spend += l.total_cost || 0;
      byCategory[cat].count += 1;
      byCategory[cat].seats += l.quantity || 0;
      byCategory[cat].assigned += assignments.filter(a => a.license_id === l.id && a.status === 'active').length;
    });
    return Object.values(byCategory).sort((a, b) => b.spend - a.spend);
  }, [filteredLicenses, assignments]);

  // Vendor breakdown
  const vendorData = useMemo(() => {
    const byVendor = {};
    filteredLicenses.forEach(l => {
      const vendor = l.vendor || 'Unknown';
      if (!byVendor[vendor]) {
        byVendor[vendor] = { name: vendor, spend: 0, count: 0 };
      }
      byVendor[vendor].spend += l.total_cost || 0;
      byVendor[vendor].count += 1;
    });
    return Object.values(byVendor).sort((a, b) => b.spend - a.spend).slice(0, 10);
  }, [filteredLicenses]);

  // Utilization by category
  const utilizationData = useMemo(() => {
    return categoryData.map(cat => ({
      name: cat.name,
      utilization: cat.seats > 0 ? Math.round((cat.assigned / cat.seats) * 100) : 0,
      wasted: cat.seats > 0 ? Math.round(((cat.seats - cat.assigned) / cat.seats) * cat.spend) : 0
    }));
  }, [categoryData]);

  // Cost savings opportunities
  const savingsOpportunities = useMemo(() => {
    return filteredLicenses
      .map(l => {
        const assigned = assignments.filter(a => a.license_id === l.id && a.status === 'active').length;
        const unused = (l.quantity || 0) - assigned;
        const wasted = l.quantity > 0 ? (unused / l.quantity) * (l.total_cost || 0) : 0;
        return { ...l, assigned, unused, wasted };
      })
      .filter(l => l.wasted > 0)
      .sort((a, b) => b.wasted - a.wasted);
  }, [filteredLicenses, assignments]);

  if (loadingLicenses || loadingAssignments) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-32 rounded-2xl" />)}
        </div>
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to={createPageUrl('Dashboard')}>
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">SaaS Reports & Analytics</h1>
            <p className="text-sm text-slate-500">Comprehensive view of your software spend and utilization</p>
          </div>
        </div>
        <Button variant="outline" className="gap-2">
          <Download className="w-4 h-4" />
          Export Report
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap gap-4 items-center">
        <Filter className="w-4 h-4 text-slate-400" />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white"
        >
          {CATEGORIES.map(cat => (
            <option key={cat.value} value={cat.value}>{cat.label}</option>
          ))}
        </select>
        <select
          value={selectedCustomer}
          onChange={(e) => setSelectedCustomer(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white min-w-[200px]"
        >
          <option value="">All Customers</option>
          {customers.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* AI Anomaly Alert */}
      <SpendAnomalyAlert licenses={filteredLicenses} licenseAssignments={assignments} />

      {/* Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-5 text-white">
          <div className="flex items-center gap-2 mb-2 opacity-80">
            <DollarSign className="w-4 h-4" />
            <span className="text-sm">Total Monthly Spend</span>
          </div>
          <p className="text-3xl font-bold">${metrics.totalSpend.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-2 text-slate-500">
            <Users className="w-4 h-4" />
            <span className="text-sm">Seat Utilization</span>
          </div>
          <p className="text-3xl font-bold text-slate-900">{metrics.utilizationRate.toFixed(0)}%</p>
          <p className="text-xs text-slate-500">{metrics.assignedSeats}/{metrics.totalSeats} seats</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-2 text-slate-500">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-sm">Unused Seats</span>
          </div>
          <p className="text-3xl font-bold text-amber-600">{metrics.unusedSeats}</p>
          <p className="text-xs text-red-500">${metrics.wastedSpend.toFixed(0)} wasted/mo</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-2 text-slate-500">
            <Cloud className="w-4 h-4" />
            <span className="text-sm">Applications</span>
          </div>
          <p className="text-3xl font-bold text-slate-900">{filteredLicenses.length}</p>
          <p className="text-xs text-slate-500">{filteredLicenses.filter(l => l.status === 'active').length} active</p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Spend by Category */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <PieChart className="w-5 h-5 text-purple-600" />
            Spend by Category
          </h3>
          {categoryData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <RechartsPie>
                <Pie
                  data={categoryData}
                  dataKey="spend"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
              </RechartsPie>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-slate-400">
              No data available
            </div>
          )}
        </div>

        {/* Vendor Breakdown */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-purple-600" />
            Top Vendors by Spend
          </h3>
          {vendorData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={vendorData} layout="vertical">
                <XAxis type="number" tickFormatter={(v) => `$${v}`} />
                <YAxis type="category" dataKey="name" width={100} />
                <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
                <Bar dataKey="spend" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-slate-400">
              No data available
            </div>
          )}
        </div>
      </div>

      {/* Utilization by Category */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-purple-600" />
          Utilization by Category
        </h3>
        {utilizationData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={utilizationData}>
              <XAxis dataKey="name" />
              <YAxis yAxisId="left" orientation="left" tickFormatter={(v) => `${v}%`} />
              <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `$${v}`} />
              <Tooltip />
              <Legend />
              <Bar yAxisId="left" dataKey="utilization" name="Utilization %" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar yAxisId="right" dataKey="wasted" name="Wasted $" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[300px] flex items-center justify-center text-slate-400">
            No data available
          </div>
        )}
      </div>

      {/* Cost Savings Opportunities */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Cost Savings Opportunities
            </h3>
            <p className="text-sm text-slate-500">Licenses with unused seats</p>
          </div>
          <Badge className="bg-amber-100 text-amber-700">
            ${savingsOpportunities.reduce((sum, l) => sum + l.wasted, 0).toFixed(0)} potential savings
          </Badge>
        </div>
        {savingsOpportunities.length === 0 ? (
          <div className="p-12 text-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
            <p className="text-slate-500">All licenses are well utilized!</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {savingsOpportunities.slice(0, 10).map(license => {
              const customer = customers.find(c => c.id === license.customer_id);
              return (
                <div key={license.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center overflow-hidden">
                      {license.logo_url ? (
                        <img src={license.logo_url} alt="" className="w-8 h-8 object-contain" />
                      ) : (
                        <Cloud className="w-5 h-5 text-purple-600" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">{license.application_name}</p>
                      <p className="text-sm text-slate-500">{customer?.name} • {license.assigned}/{license.quantity} seats used</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-red-600">${license.wasted.toFixed(0)}/mo wasted</p>
                    <p className="text-xs text-slate-500">{license.unused} unused seats</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}