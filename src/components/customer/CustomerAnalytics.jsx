import React, { useState, useMemo } from 'react';
import {
  DollarSign,
  TrendingUp,
  HelpCircle,
  FileText,
  Cloud
} from 'lucide-react';
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
import { format, subMonths, parseISO, startOfMonth, endOfMonth, isWithinInterval, eachMonthOfInterval } from 'date-fns';

const COLORS = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

export default function CustomerAnalytics({ 
  contracts = [], 
  recurringBills = [], 
  tickets = [], 
  invoices = [], 
  licenses = [],
  licenseAssignments = []
}) {
  const [dateRange, setDateRange] = useState('6m');

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

  // Monthly Spend Trend
  const spendTrendData = useMemo(() => {
    const months = eachMonthOfInterval(dateRangeInterval);
    return months.map(month => {
      const monthStart = startOfMonth(month);
      const monthEnd = endOfMonth(month);
      
      const mrr = recurringBills
        .filter(bill => {
          const startDate = bill.start_date ? parseISO(bill.start_date) : new Date(0);
          const endDate = bill.end_date ? parseISO(bill.end_date) : new Date(2099, 11, 31);
          return startDate <= monthEnd && endDate >= monthStart && bill.status === 'active';
        })
        .reduce((sum, bill) => sum + (bill.amount || 0), 0);

      return {
        month: format(month, 'MMM'),
        spend: mrr
      };
    });
  }, [dateRangeInterval, recurringBills]);

  // Ticket Resolution Data
  const ticketResolutionData = useMemo(() => {
    const months = eachMonthOfInterval(dateRangeInterval);
    return months.map(month => {
      const monthStart = startOfMonth(month);
      const monthEnd = endOfMonth(month);
      
      const monthTickets = tickets.filter(t => {
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
  }, [dateRangeInterval, tickets]);

  // Tickets by Priority
  const ticketsByPriority = useMemo(() => {
    const priorities = { critical: 0, high: 0, medium: 0, low: 0 };
    tickets.forEach(t => {
      if (priorities[t.priority] !== undefined) priorities[t.priority]++;
    });
    return Object.entries(priorities).filter(([_, v]) => v > 0).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value
    }));
  }, [tickets]);

  // Invoice Status
  const invoicesByStatus = useMemo(() => {
    const statuses = { paid: 0, sent: 0, overdue: 0 };
    invoices.forEach(i => {
      if (statuses[i.status] !== undefined) statuses[i.status]++;
    });
    return Object.entries(statuses).filter(([_, v]) => v > 0).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value
    }));
  }, [invoices]);

  // SaaS Spend by Category
  const saasByCategory = useMemo(() => {
    const categories = {};
    licenses.forEach(l => {
      const cat = l.category || 'other';
      if (!categories[cat]) categories[cat] = 0;
      categories[cat] += l.total_cost || 0;
    });
    return Object.entries(categories).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value
    }));
  }, [licenses]);

  // License Utilization
  const licenseUtilization = useMemo(() => {
    return licenses.map(l => {
      const assigned = licenseAssignments.filter(a => a.license_id === l.id && a.status === 'active').length;
      const utilization = l.quantity > 0 ? (assigned / l.quantity) * 100 : 0;
      return {
        name: l.application_name?.substring(0, 15) || 'Unknown',
        utilization: Math.round(utilization),
        assigned,
        total: l.quantity || 0
      };
    }).slice(0, 8);
  }, [licenses, licenseAssignments]);

  // Summary Stats
  const stats = useMemo(() => {
    const totalMRR = recurringBills
      .filter(b => b.status === 'active')
      .reduce((sum, b) => sum + (b.amount || 0), 0);
    
    const totalSaaSSpend = licenses
      .filter(l => l.status === 'active')
      .reduce((sum, l) => sum + (l.total_cost || 0), 0);
    
    const openTickets = tickets.filter(t => ['open', 'in_progress', 'new'].includes(t.status)).length;
    const resolvedTickets = tickets.filter(t => ['resolved', 'closed'].includes(t.status)).length;
    const resolutionRate = tickets.length > 0 ? Math.round((resolvedTickets / tickets.length) * 100) : 0;

    return { totalMRR, totalSaaSSpend, openTickets, resolutionRate };
  }, [recurringBills, licenses, tickets]);

  return (
    <div className="space-y-6">
      {/* Date Range Filter */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900">Your Analytics</h3>
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

      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-purple-600" />
            <p className="text-sm text-slate-500">Monthly Spend</p>
          </div>
          <p className="text-2xl font-bold text-slate-900">
            ${stats.totalMRR.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Cloud className="w-4 h-4 text-blue-600" />
            <p className="text-sm text-slate-500">SaaS Spend</p>
          </div>
          <p className="text-2xl font-bold text-slate-900">
            ${stats.totalSaaSSpend.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <HelpCircle className="w-4 h-4 text-amber-600" />
            <p className="text-sm text-slate-500">Open Tickets</p>
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.openTickets}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-emerald-600" />
            <p className="text-sm text-slate-500">Resolution Rate</p>
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.resolutionRate}%</p>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Spend Trend */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h4 className="font-semibold text-slate-900 mb-4">Monthly Spend Trend</h4>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={spendTrendData}>
              <defs>
                <linearGradient id="spendGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#94a3b8" />
              <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" tickFormatter={v => `$${v}`} />
              <Tooltip 
                formatter={(value) => [`$${value.toLocaleString()}`, 'Spend']}
                contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
              />
              <Area type="monotone" dataKey="spend" stroke="#8b5cf6" fill="url(#spendGradient)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Ticket Volume */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h4 className="font-semibold text-slate-900 mb-4">Ticket Volume & Resolution</h4>
          <ResponsiveContainer width="100%" height={250}>
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

        {/* Tickets by Priority */}
        {ticketsByPriority.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h4 className="font-semibold text-slate-900 mb-4">Tickets by Priority</h4>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={ticketsByPriority}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  <Cell fill="#ef4444" />
                  <Cell fill="#f59e0b" />
                  <Cell fill="#eab308" />
                  <Cell fill="#06b6d4" />
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Invoice Status */}
        {invoicesByStatus.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h4 className="font-semibold text-slate-900 mb-4">Invoice Status</h4>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={invoicesByStatus}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  <Cell fill="#10b981" />
                  <Cell fill="#f59e0b" />
                  <Cell fill="#ef4444" />
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* SaaS Spend by Category */}
        {saasByCategory.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h4 className="font-semibold text-slate-900 mb-4">SaaS Spend by Category</h4>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={saasByCategory} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" tick={{ fontSize: 12 }} stroke="#94a3b8" tickFormatter={v => `$${v}`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} stroke="#94a3b8" width={100} />
                <Tooltip 
                  formatter={(value) => [`$${value.toLocaleString()}`, 'Spend']}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                />
                <Bar dataKey="value" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* License Utilization */}
        {licenseUtilization.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h4 className="font-semibold text-slate-900 mb-4">License Utilization</h4>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={licenseUtilization} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12 }} stroke="#94a3b8" tickFormatter={v => `${v}%`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} stroke="#94a3b8" width={100} />
                <Tooltip 
                  formatter={(value, name, props) => [`${value}% (${props.payload.assigned}/${props.payload.total})`, 'Utilization']}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                />
                <Bar dataKey="utilization" radius={[0, 4, 4, 0]}>
                  {licenseUtilization.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.utilization >= 80 ? '#10b981' : entry.utilization >= 50 ? '#f59e0b' : '#ef4444'} 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}