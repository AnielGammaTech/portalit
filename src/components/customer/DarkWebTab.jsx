import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Shield, 
  AlertTriangle, 
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Calendar,
  Mail,
  TrendingDown,
  TrendingUp,
  ChevronRight,
  ChevronDown,
  Database,
  Key,
  Search,
  Filter,
  User,
  Lock,
  Globe,
  Clock,
  BarChart3,
  PieChart as PieChartIcon,
  List,
  Grid3X3
} from 'lucide-react';
import { cn } from "@/lib/utils";
import { format, parseISO } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  LineChart,
  Line
} from 'recharts';

const SEVERITY_COLORS = {
  critical: '#dc2626',
  high: '#ea580c',
  medium: '#ca8a04',
  low: '#2563eb'
};

export default function DarkWebTab({ customerId }) {
  const [selectedReportId, setSelectedReportId] = useState(null);
  const [selectedCompromise, setSelectedCompromise] = useState(null);
  const [viewMode, setViewMode] = useState('cards'); // 'cards', 'table', 'timeline'
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [showPasswords, setShowPasswords] = useState({});
  const [expandedSources, setExpandedSources] = useState({});
  const [credentialsExpanded, setCredentialsExpanded] = useState(true);

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['darkwebid-reports', customerId],
    queryFn: () => base44.entities.DarkWebIDReport.filter({ customer_id: customerId }),
    enabled: !!customerId
  });

  const sortedReports = useMemo(() => 
    [...reports].sort((a, b) => new Date(b.report_date) - new Date(a.report_date)),
    [reports]
  );

  const latestReport = sortedReports[0];
  const previousReport = sortedReports[1];
  
  // Active report is either selected or latest
  const activeReport = selectedReportId 
    ? sortedReports.find(r => r.id === selectedReportId) || latestReport 
    : latestReport;
  const activeReportIndex = sortedReports.findIndex(r => r.id === activeReport?.id);
  const comparisonReport = sortedReports[activeReportIndex + 1];

  const parseJsonArray = (jsonString) => {
    if (!jsonString) return [];
    try {
      return JSON.parse(jsonString);
    } catch {
      return [];
    }
  };

  // Get all compromises from active report
  const compromises = useMemo(() => {
    if (!activeReport) return [];
    return parseJsonArray(activeReport.compromises_detail);
  }, [activeReport]);

  // Filter compromises
  const filteredCompromises = useMemo(() => {
    return compromises.filter(c => {
      const matchesSearch = !searchQuery || 
        c.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.source?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesSeverity = severityFilter === 'all' || c.severity === severityFilter;
      return matchesSearch && matchesSeverity;
    });
  }, [compromises, searchQuery, severityFilter]);

  // Group compromises by source
  const compromisesBySource = useMemo(() => {
    const grouped = {};
    compromises.forEach(c => {
      const source = c.source || 'Unknown';
      if (!grouped[source]) grouped[source] = [];
      grouped[source].push(c);
    });
    return grouped;
  }, [compromises]);

  // Group compromises by email
  const compromisesByEmail = useMemo(() => {
    const grouped = {};
    compromises.forEach(c => {
      const email = c.email || 'Unknown';
      if (!grouped[email]) grouped[email] = [];
      grouped[email].push(c);
    });
    return grouped;
  }, [compromises]);

  // Chart data
  const severityChartData = useMemo(() => {
    if (!activeReport) return [];
    return [
      { name: 'Critical', value: activeReport.critical_count || 0, color: SEVERITY_COLORS.critical },
      { name: 'High', value: activeReport.high_count || 0, color: SEVERITY_COLORS.high },
      { name: 'Medium', value: activeReport.medium_count || 0, color: SEVERITY_COLORS.medium },
      { name: 'Low', value: activeReport.low_count || 0, color: SEVERITY_COLORS.low },
    ].filter(d => d.value > 0);
  }, [activeReport]);

  const sourceChartData = useMemo(() => {
    return Object.entries(compromisesBySource)
      .filter(([name]) => name.toLowerCase() !== 'none' && name.toLowerCase() !== 'unknown')
      .map(([name, items]) => ({ name: name.length > 15 ? name.slice(0, 15) + '...' : name, count: items.length, fullName: name }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [compromisesBySource]);

  const trendChartData = useMemo(() => {
    return sortedReports.slice(0, 6).reverse().map(r => ({
      date: format(new Date(r.report_date), 'MMM d'),
      total: r.total_compromises || 0,
      critical: r.critical_count || 0,
      new: r.new_compromises || 0
    }));
  }, [sortedReports]);

  const getTrend = (current, previous, lowerIsBetter = true) => {
    if (!previous || current === undefined || previous === undefined) return null;
    const diff = current - previous;
    if (diff === 0) return { direction: 'same', value: 0 };
    if (lowerIsBetter) {
      return { direction: diff < 0 ? 'good' : 'bad', value: Math.abs(diff) };
    }
    return { direction: diff > 0 ? 'good' : 'bad', value: Math.abs(diff) };
  };

  const maskPassword = (password) => {
    if (!password || password === 'N/A' || password.toLowerCase() === 'n/a') return null;
    return '•'.repeat(Math.min(password.length, 12));
  };

  const hasRealPassword = (password) => {
    if (!password) return false;
    const lower = password.toLowerCase().trim();
    return lower !== 'n/a' && lower !== 'no password data' && lower !== 'no password' && lower !== '' && lower !== '-';
  };

  // Determine effective severity - only critical/high if password is exposed
  const getEffectiveSeverity = (item) => {
    const hasPassword = hasRealPassword(item.password);
    if (!hasPassword) {
      // Without password exposure, downgrade critical/high to medium/low
      if (item.severity === 'critical') return 'medium';
      if (item.severity === 'high') return 'medium';
    }
    return item.severity || 'low';
  };

  const togglePasswordVisibility = (id) => {
    setShowPasswords(prev => ({ ...prev, [id]: !prev[id] }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center">
        <Shield className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h3 className="font-semibold text-slate-900 mb-2">No Dark Web ID Reports</h3>
        <p className="text-sm text-slate-500 mb-4">
          Upload dark web monitoring reports in Settings → Integrations
        </p>
      </div>
    );
  }

  const totalTrend = getTrend(activeReport?.total_compromises, comparisonReport?.total_compromises);
  const criticalTrend = getTrend(activeReport?.critical_count, comparisonReport?.critical_count);

  return (
    <div className="space-y-6">
      {/* Header with Report Info */}
      <div className="bg-gradient-to-r from-red-50 via-orange-50 to-amber-50 rounded-2xl border border-red-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center shadow-lg shadow-red-500/20">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Dark Web Monitoring Report</h3>
              <p className="text-sm text-slate-500">
                {format(new Date(activeReport.report_date), 'MMMM d, yyyy')}
                {activeReport.report_period_start && activeReport.report_period_end && (
                  <span className="ml-2 text-slate-400">
                    (Period: {format(new Date(activeReport.report_period_start), 'MMM d')} - {format(new Date(activeReport.report_period_end), 'MMM d')})
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {sortedReports.length > 1 && (
              <Select value={activeReport?.id} onValueChange={(id) => setSelectedReportId(id)}>
                <SelectTrigger className="w-44 bg-white">
                  <SelectValue placeholder="Select report" />
                </SelectTrigger>
                <SelectContent>
                  {sortedReports.map((r, idx) => (
                    <SelectItem key={r.id} value={r.id}>
                      {format(new Date(r.report_date), 'MMM d, yyyy')} {idx === 0 && '(Latest)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {activeReport.pdf_url && (
              <Button 
                variant="outline" 
                size="sm"
                className="bg-white"
                onClick={() => window.open(activeReport.pdf_url, '_blank')}
              >
                <Eye className="w-4 h-4 mr-2" />
                View PDF
              </Button>
            )}
          </div>
        </div>

        {/* Alert Banner if critical */}
        {(activeReport.critical_count > 0 || activeReport.new_compromises > 0) && (
          <div className="mt-4 p-3 bg-red-100 border border-red-200 rounded-xl flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-900">
                {activeReport.critical_count > 0 && `${activeReport.critical_count} critical compromises detected. `}
                {activeReport.new_compromises > 0 && `${activeReport.new_compromises} new since last report.`}
              </p>
              <p className="text-xs text-red-700">Immediate password changes recommended for affected accounts.</p>
            </div>
          </div>
        )}
      </div>

      {/* Key Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className={cn(
          "border-2 cursor-pointer hover:shadow-md transition-all",
          activeReport.total_compromises > 10 ? "border-red-200 bg-red-50/50" : 
          activeReport.total_compromises > 0 ? "border-amber-200 bg-amber-50/50" : "border-green-200 bg-green-50/50"
        )} onClick={() => setSeverityFilter('all')}>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Total</p>
                <p className={cn("text-2xl font-bold mt-0.5",
                  activeReport.total_compromises > 10 ? "text-red-600" : 
                  activeReport.total_compromises > 0 ? "text-amber-600" : "text-green-600"
                )}>
                  {activeReport.total_compromises || 0}
                </p>
                {totalTrend && totalTrend.value > 0 && (
                  <div className={cn("flex items-center gap-0.5 text-[10px] mt-1",
                    totalTrend.direction === 'good' ? "text-green-600" : "text-red-600"
                  )}>
                    {totalTrend.direction === 'good' ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                    {totalTrend.value}
                  </div>
                )}
              </div>
              <Shield className="w-5 h-5 text-slate-400" />
            </div>
          </CardContent>
        </Card>

        {['critical', 'high', 'medium', 'low'].map(severity => {
          const count = activeReport[`${severity}_count`] || 0;
          const isActive = severityFilter === severity;
          return (
            <Card 
              key={severity}
              className={cn(
                "border-2 cursor-pointer hover:shadow-md transition-all",
                isActive && "ring-2 ring-offset-2",
                severity === 'critical' && (count > 0 ? "border-red-300 bg-red-50" : "border-slate-200"),
                severity === 'high' && (count > 0 ? "border-orange-200 bg-orange-50" : "border-slate-200"),
                severity === 'medium' && (count > 0 ? "border-yellow-200 bg-yellow-50" : "border-slate-200"),
                severity === 'low' && (count > 0 ? "border-blue-200 bg-blue-50" : "border-slate-200"),
                isActive && severity === 'critical' && "ring-red-500",
                isActive && severity === 'high' && "ring-orange-500",
                isActive && severity === 'medium' && "ring-yellow-500",
                isActive && severity === 'low' && "ring-blue-500"
              )}
              onClick={() => setSeverityFilter(isActive ? 'all' : severity)}
            >
              <CardContent className="pt-4 pb-3">
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider capitalize">{severity}</p>
                <p className={cn("text-2xl font-bold mt-0.5",
                  severity === 'critical' && (count > 0 ? "text-red-600" : "text-slate-300"),
                  severity === 'high' && (count > 0 ? "text-orange-600" : "text-slate-300"),
                  severity === 'medium' && (count > 0 ? "text-yellow-600" : "text-slate-300"),
                  severity === 'low' && (count > 0 ? "text-blue-600" : "text-slate-300")
                )}>
                  {count}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Severity Distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
              <PieChartIcon className="w-4 h-4" />
              Severity Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            {severityChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={severityChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {severityChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} className="cursor-pointer hover:opacity-80" />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value, name) => [value, name]} />
                  <Legend iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[180px] flex items-center justify-center text-slate-400">
                <CheckCircle2 className="w-8 h-8 mr-2" />
                No compromises found
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Breach Sources */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
              <Database className="w-4 h-4" />
              Top Breach Sources
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sourceChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={sourceChartData} layout="vertical" margin={{ left: 0, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 9 }} />
                  <Tooltip content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-white p-2 shadow-lg rounded border text-xs">
                          <p className="font-medium">{payload[0].payload.fullName}</p>
                          <p className="text-red-600">{payload[0].value} compromises</p>
                        </div>
                      );
                    }
                    return null;
                  }} />
                  <Bar dataKey="count" fill="#ef4444" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[180px] flex items-center justify-center text-slate-400 text-sm">
                No breach source data
              </div>
            )}
          </CardContent>
        </Card>

        {/* Trend Over Time */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Trend Over Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            {trendChartData.length > 1 ? (
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={trendChartData} margin={{ left: 0, right: 10, top: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} width={30} />
                  <Tooltip />
                  <Line type="monotone" dataKey="total" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} name="Total" />
                  <Line type="monotone" dataKey="critical" stroke="#dc2626" strokeWidth={2} dot={{ r: 3 }} name="Critical" strokeDasharray="5 5" />
                  <Legend iconSize={8} wrapperStyle={{ fontSize: '10px' }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[180px] flex items-center justify-center text-slate-400 text-sm">
                Need more reports for trend
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Compromises Detail Section */}
      <Card>
        <CardHeader 
          className="pb-3 border-b cursor-pointer hover:bg-slate-50 transition-colors"
          onClick={() => setCredentialsExpanded(!credentialsExpanded)}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <CardTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <Lock className="w-5 h-5 text-red-500" />
              Compromised Credentials ({filteredCompromises.length})
              <ChevronDown className={cn("w-5 h-5 text-slate-400 transition-transform", credentialsExpanded && "rotate-180")} />
            </CardTitle>
            {credentialsExpanded && (
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input 
                    placeholder="Search email or source..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 h-8 w-48 text-sm"
                  />
                </div>
                <div className="flex items-center border rounded-lg overflow-hidden">
                  <button 
                    onClick={() => setViewMode('cards')}
                    className={cn("p-1.5", viewMode === 'cards' ? "bg-slate-100" : "hover:bg-slate-50")}
                  >
                    <Grid3X3 className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => setViewMode('table')}
                    className={cn("p-1.5", viewMode === 'table' ? "bg-slate-100" : "hover:bg-slate-50")}
                  >
                    <List className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </CardHeader>
        {credentialsExpanded && (
        <CardContent className="pt-4">
          {filteredCompromises.length === 0 ? (
            <div className="text-center py-12">
              <Shield className="w-12 h-12 text-green-300 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">
                {compromises.length === 0 ? 'No compromised credentials found' : 'No matches for your search'}
              </p>
            </div>
          ) : viewMode === 'cards' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[500px] overflow-y-auto pr-2">
              {filteredCompromises.map((item, idx) => {
                const effectiveSeverity = getEffectiveSeverity(item);
                return (
                  <div 
                    key={idx} 
                    className={cn(
                      "p-4 rounded-xl border-2 hover:shadow-md transition-all cursor-pointer",
                      effectiveSeverity === 'critical' && "border-red-200 bg-red-50/50",
                      effectiveSeverity === 'high' && "border-orange-200 bg-orange-50/50",
                      effectiveSeverity === 'medium' && "border-yellow-200 bg-yellow-50/50",
                      effectiveSeverity === 'low' && "border-blue-200 bg-blue-50/50",
                      !effectiveSeverity && "border-slate-200 bg-slate-50/50"
                    )}
                    onClick={() => setSelectedCompromise(item)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                          effectiveSeverity === 'critical' && "bg-red-100",
                          effectiveSeverity === 'high' && "bg-orange-100",
                          effectiveSeverity === 'medium' && "bg-yellow-100",
                          effectiveSeverity === 'low' && "bg-blue-100",
                          !effectiveSeverity && "bg-slate-100"
                        )}>
                          <User className={cn("w-4 h-4",
                            effectiveSeverity === 'critical' && "text-red-600",
                            effectiveSeverity === 'high' && "text-orange-600",
                            effectiveSeverity === 'medium' && "text-yellow-600",
                            effectiveSeverity === 'low' && "text-blue-600",
                            !effectiveSeverity && "text-slate-600"
                          )} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 truncate text-sm">{item.email || 'Unknown'}</p>
                          <p className="text-xs text-slate-500 truncate">{item.source || 'Unknown source'}</p>
                        </div>
                      </div>
                      <Badge className={cn('text-[10px] flex-shrink-0',
                        effectiveSeverity === 'critical' && 'bg-red-100 text-red-700',
                        effectiveSeverity === 'high' && 'bg-orange-100 text-orange-700',
                        effectiveSeverity === 'medium' && 'bg-yellow-100 text-yellow-700',
                        effectiveSeverity === 'low' && 'bg-blue-100 text-blue-700',
                        !effectiveSeverity && 'bg-slate-100 text-slate-700'
                      )}>
                        {effectiveSeverity || 'unknown'}
                      </Badge>
                    </div>
                    
                    {/* Password Display */}
                    <div className="flex items-center gap-2 p-2 bg-white/80 rounded-lg border border-slate-200 mt-2">
                      <Key className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      {hasRealPassword(item.password) ? (
                        <>
                          <code className="text-xs font-mono text-slate-700 flex-1 truncate">
                            {showPasswords[idx] ? item.password : maskPassword(item.password)}
                          </code>
                          <button 
                            onClick={(e) => { e.stopPropagation(); togglePasswordVisibility(idx); }}
                            className="p-1 hover:bg-slate-100 rounded"
                          >
                            {showPasswords[idx] ? <EyeOff className="w-3.5 h-3.5 text-slate-400" /> : <Eye className="w-3.5 h-3.5 text-slate-400" />}
                          </button>
                        </>
                      ) : (
                        <span className="text-xs text-slate-400 italic">No password data</span>
                      )}
                    </div>
                    
                    {item.breach_date && (
                      <div className="flex items-center gap-1 mt-2 text-[10px] text-slate-400">
                        <Clock className="w-3 h-3" />
                        Breach: {item.breach_date}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[500px]">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    <th className="text-left p-3 font-medium text-slate-600">Email</th>
                    <th className="text-left p-3 font-medium text-slate-600">Password</th>
                    <th className="text-left p-3 font-medium text-slate-600">Source</th>
                    <th className="text-left p-3 font-medium text-slate-600">Breach Date</th>
                    <th className="text-left p-3 font-medium text-slate-600">Severity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCompromises.map((item, idx) => {
                    const effectiveSeverity = getEffectiveSeverity(item);
                    return (
                      <tr 
                        key={idx} 
                        className="hover:bg-slate-50 cursor-pointer"
                        onClick={() => setSelectedCompromise(item)}
                      >
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <Mail className="w-4 h-4 text-slate-400" />
                            <span className="font-medium">{item.email || 'Unknown'}</span>
                          </div>
                        </td>
                        <td className="p-3">
                          {hasRealPassword(item.password) ? (
                            <div className="flex items-center gap-2">
                              <code className="text-xs font-mono bg-slate-100 px-2 py-1 rounded">
                                {showPasswords[`table-${idx}`] ? item.password : maskPassword(item.password)}
                              </code>
                              <button 
                                onClick={(e) => { e.stopPropagation(); togglePasswordVisibility(`table-${idx}`); }}
                                className="p-1 hover:bg-slate-200 rounded"
                              >
                                {showPasswords[`table-${idx}`] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 italic">—</span>
                          )}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <Database className="w-4 h-4 text-slate-400" />
                            <span className="text-slate-600">{item.source || 'Unknown'}</span>
                          </div>
                        </td>
                        <td className="p-3 text-slate-500">{item.breach_date || '-'}</td>
                        <td className="p-3">
                          <Badge className={cn('text-xs',
                            effectiveSeverity === 'critical' && 'bg-red-100 text-red-700',
                            effectiveSeverity === 'high' && 'bg-orange-100 text-orange-700',
                            effectiveSeverity === 'medium' && 'bg-yellow-100 text-yellow-700',
                            effectiveSeverity === 'low' && 'bg-blue-100 text-blue-700'
                          )}>
                            {effectiveSeverity || 'unknown'}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
        )}
      </Card>

      {/* Compromises by Email - Grouped View */}
      {Object.keys(compromisesByEmail).length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <User className="w-5 h-5 text-purple-500" />
              Compromises by User ({Object.keys(compromisesByEmail).length} affected)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {Object.entries(compromisesByEmail)
                .sort((a, b) => b[1].length - a[1].length)
                .map(([email, items]) => {
                  // Use effective severity (only critical if password exposed)
                  const hasCritical = items.some(i => getEffectiveSeverity(i) === 'critical');
                  const hasHigh = items.some(i => getEffectiveSeverity(i) === 'high');
                  return (
                    <div 
                      key={email}
                      className={cn(
                        "p-3 rounded-lg border cursor-pointer hover:shadow-sm transition-all",
                        hasCritical ? "border-red-200 bg-red-50/30" : 
                        hasHigh ? "border-orange-200 bg-orange-50/30" : "border-slate-200 bg-slate-50/30"
                      )}
                      onClick={() => setExpandedSources(prev => ({ ...prev, [email]: !prev[email] }))}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center",
                            hasCritical ? "bg-red-100" : hasHigh ? "bg-orange-100" : "bg-slate-100"
                          )}>
                            <Mail className={cn("w-4 h-4",
                              hasCritical ? "text-red-600" : hasHigh ? "text-orange-600" : "text-slate-600"
                            )} />
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">{email}</p>
                            <p className="text-xs text-slate-500">Found in {items.length} breach{items.length > 1 ? 'es' : ''}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {hasCritical && <Badge className="bg-red-100 text-red-700 text-[10px]">Critical</Badge>}
                          <ChevronDown className={cn("w-4 h-4 text-slate-400 transition-transform", expandedSources[email] && "rotate-180")} />
                        </div>
                      </div>
                      {expandedSources[email] && (
                        <div className="mt-3 pt-3 border-t border-slate-200 space-y-2">
                          {items.map((item, idx) => {
                            const effSev = getEffectiveSeverity(item);
                            return (
                              <div key={idx} className="flex items-center justify-between text-sm p-2 bg-white rounded-lg">
                                <div className="flex items-center gap-2">
                                  <Database className="w-3.5 h-3.5 text-slate-400" />
                                  <span>{item.source || 'Unknown'}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  {hasRealPassword(item.password) ? (
                                    <>
                                      <code className="text-xs font-mono bg-slate-100 px-2 py-0.5 rounded">
                                        {showPasswords[`user-${email}-${idx}`] ? item.password : maskPassword(item.password)}
                                      </code>
                                      <button onClick={(e) => { e.stopPropagation(); togglePasswordVisibility(`user-${email}-${idx}`); }}>
                                        {showPasswords[`user-${email}-${idx}`] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                      </button>
                                    </>
                                  ) : (
                                    <span className="text-xs text-slate-400 italic">—</span>
                                  )}
                                  <Badge className={cn('text-[10px]',
                                    effSev === 'critical' && 'bg-red-100 text-red-700',
                                    effSev === 'high' && 'bg-orange-100 text-orange-700',
                                    effSev === 'medium' && 'bg-yellow-100 text-yellow-700',
                                    effSev === 'low' && 'bg-blue-100 text-blue-700'
                                  )}>
                                    {effSev}
                                  </Badge>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Compromise Detail Modal */}
      <Dialog open={!!selectedCompromise} onOpenChange={(open) => !open && setSelectedCompromise(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {(() => {
                const modalSeverity = selectedCompromise ? getEffectiveSeverity(selectedCompromise) : null;
                return (
                  <AlertTriangle className={cn("w-5 h-5",
                    modalSeverity === 'critical' && "text-red-500",
                    modalSeverity === 'high' && "text-orange-500",
                    modalSeverity === 'medium' && "text-yellow-500",
                    modalSeverity === 'low' && "text-blue-500"
                  )} />
                );
              })()}
              Compromise Details
            </DialogTitle>
          </DialogHeader>
          {selectedCompromise && (() => {
            const modalSeverity = getEffectiveSeverity(selectedCompromise);
            return (
              <div className="space-y-4">
                <div className={cn(
                  "p-4 rounded-xl",
                  modalSeverity === 'critical' && "bg-red-50 border border-red-200",
                  modalSeverity === 'high' && "bg-orange-50 border border-orange-200",
                  modalSeverity === 'medium' && "bg-yellow-50 border border-yellow-200",
                  modalSeverity === 'low' && "bg-blue-50 border border-blue-200"
                )}>
                  <Badge className={cn('mb-2',
                    modalSeverity === 'critical' && 'bg-red-100 text-red-700',
                    modalSeverity === 'high' && 'bg-orange-100 text-orange-700',
                    modalSeverity === 'medium' && 'bg-yellow-100 text-yellow-700',
                    modalSeverity === 'low' && 'bg-blue-100 text-blue-700'
                  )}>
                    {modalSeverity?.toUpperCase()} SEVERITY
                  </Badge>
                  <p className="text-sm text-slate-600">
                    {hasRealPassword(selectedCompromise.password) 
                      ? "This credential was found exposed on the dark web and requires immediate attention."
                      : "This email was found in a data breach. No password was exposed, but monitoring is recommended."}
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                    <Mail className="w-5 h-5 text-slate-400" />
                    <div>
                      <p className="text-xs text-slate-500">Email Address</p>
                      <p className="font-medium text-slate-900">{selectedCompromise.email}</p>
                    </div>
                  </div>

                  {hasRealPassword(selectedCompromise.password) ? (
                    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                      <Key className="w-5 h-5 text-slate-400" />
                      <div className="flex-1">
                        <p className="text-xs text-slate-500">Password Hit</p>
                        <div className="flex items-center gap-2">
                          <code className="font-mono text-sm text-slate-900 bg-white px-2 py-1 rounded border">
                            {showPasswords['modal'] ? selectedCompromise.password : maskPassword(selectedCompromise.password)}
                          </code>
                          <button onClick={() => togglePasswordVisibility('modal')} className="p-1 hover:bg-slate-200 rounded">
                            {showPasswords['modal'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                      <Key className="w-5 h-5 text-slate-400" />
                      <div>
                        <p className="text-xs text-slate-500">Password Hit</p>
                        <p className="text-sm text-slate-400 italic">No password data available</p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                    <Database className="w-5 h-5 text-slate-400" />
                    <div>
                      <p className="text-xs text-slate-500">Breach Source</p>
                      <p className="font-medium text-slate-900">{selectedCompromise.source || 'Unknown'}</p>
                    </div>
                  </div>

                  {selectedCompromise.breach_date && (
                    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                      <Calendar className="w-5 h-5 text-slate-400" />
                      <div>
                        <p className="text-xs text-slate-500">Breach Date</p>
                        <p className="font-medium text-slate-900">{selectedCompromise.breach_date}</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t">
                  <p className="text-sm font-medium text-slate-900 mb-2">Recommended Actions:</p>
                  <ul className="text-sm text-slate-600 space-y-1">
                    {hasRealPassword(selectedCompromise.password) && (
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                        Change password immediately
                      </li>
                    )}
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      Enable multi-factor authentication
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      Check for unauthorized account access
                    </li>
                  </ul>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}