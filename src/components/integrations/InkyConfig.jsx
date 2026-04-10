import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { client } from '@/api/client';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Mail,
  Plus,
  Trash2,
  Upload,
  FileText,
  Building2,
  Calendar,
  Eye,
  Loader2,
  XCircle,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  Search,
  BarChart3,
  MousePointerClick,
  AlertTriangle,
  Users,
  RefreshCw,
  KeyRound
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from "@/lib/utils";

const REPORT_TYPES = [
  { key: 'threat_level_overview', label: 'Threat Level Overview', description: 'High level overview of threat metrics', icon: AlertTriangle, color: 'text-red-600 bg-red-50' },
  { key: 'graymail', label: 'Graymail', description: 'Productivity savings from graymail filtering', icon: Mail, color: 'text-blue-600 bg-blue-50' },
  { key: 'link_clicks', label: 'Link Clicks', description: 'Metrics for user link clicks and follow-throughs', icon: MousePointerClick, color: 'text-amber-600 bg-amber-50' },
  { key: 'user_reporting', label: 'User Reporting', description: 'User reporting metrics', icon: Users, color: 'text-purple-600 bg-purple-50' },
];

// Quick user count editor — inline editable per customer
function UserCountEditor({ customers, reports, queryClient }) {
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  // Get latest user count per customer from reports
  const userCounts = useMemo(() => {
    const map = {};
    for (const r of reports) {
      if (!r.customer_id) continue;
      const existing = map[r.customer_id];
      if (!existing || new Date(r.report_date || r.created_date) > new Date(existing.report_date || existing.created_date)) {
        map[r.customer_id] = r;
      }
    }
    return map;
  }, [reports]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return customers
      .filter(c => !q || c.name.toLowerCase().includes(q))
      .sort((a, b) => {
        const aHas = userCounts[a.id] ? 1 : 0;
        const bHas = userCounts[b.id] ? 1 : 0;
        if (aHas !== bHas) return bHas - aHas;
        return a.name.localeCompare(b.name);
      });
  }, [customers, search, userCounts]);

  const handleSave = async (customerId, customerName) => {
    const count = parseInt(editValue, 10);
    if (isNaN(count) || count < 0) { toast.error('Enter a valid number'); return; }
    setSaving(true);
    try {
      const existing = userCounts[customerId];
      const reportData = { total_users: count };
      if (existing) {
        await client.entities.InkyReport.update(existing.id, {
          total_users: count,
          report_data: reportData,
          report_date: new Date().toISOString().split('T')[0],
        });
      } else {
        await client.entities.InkyReport.create({
          customer_id: customerId,
          customer_name: customerName,
          total_users: count,
          report_data: reportData,
          report_type: 'user_count',
          report_date: new Date().toISOString().split('T')[0],
        });
      }
      toast.success(`${customerName}: ${count} users saved`);
      queryClient.invalidateQueries({ queryKey: ['inky-reports'] });
      setEditingId(null);
    } catch (err) {
      toast.error(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-3">
        <Users className="w-4 h-4 text-blue-600" />
        <h4 className="text-sm font-semibold text-slate-900 flex-1">Protected Users per Customer</h4>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search..."
            className="pl-8 h-7 text-xs border border-slate-200 rounded-md px-2 w-48 focus:outline-none focus:ring-1 focus:ring-slate-400"
          />
        </div>
      </div>
      <div className="max-h-96 overflow-y-auto">
        <table className="w-full">
          <thead>
            <tr className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider bg-slate-50/50">
              <th className="text-left px-4 py-2">Customer</th>
              <th className="text-right px-4 py-2 w-28">Users</th>
              <th className="text-right px-4 py-2 w-20" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filtered.map(c => {
              const report = userCounts[c.id];
              const count = report?.total_users;
              const isEditing = editingId === c.id;

              return (
                <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-2 text-sm text-slate-800">{c.name}</td>
                  <td className="px-4 py-2 text-right">
                    {isEditing ? (
                      <input
                        type="number"
                        min="0"
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleSave(c.id, c.name); if (e.key === 'Escape') setEditingId(null); }}
                        className="w-20 h-7 text-xs text-right border border-blue-300 rounded px-2 focus:outline-none focus:ring-1 focus:ring-blue-400"
                        autoFocus
                      />
                    ) : (
                      <button
                        onClick={() => { setEditingId(c.id); setEditValue(count != null ? String(count) : ''); }}
                        className={cn(
                          "text-sm tabular-nums font-medium px-2 py-0.5 rounded hover:bg-slate-100 transition-colors",
                          count != null ? "text-slate-900" : "text-slate-300"
                        )}
                      >
                        {count != null ? count : '—'}
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {isEditing && (
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleSave(c.id, c.name)}
                          disabled={saving}
                          className="px-2 py-1 text-[10px] font-semibold rounded bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50"
                        >
                          {saving ? '...' : 'Save'}
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="px-2 py-1 text-[10px] font-semibold rounded bg-slate-100 text-slate-500 hover:bg-slate-200"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// INKY auto-sync panel — paste Bearer token, hit sync immediately
function InkySyncPanel({ queryClient }) {
  const [tokenValue, setTokenValue] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);

  const handleSync = async () => {
    const token = tokenValue.trim().replace(/^Bearer\s+/i, '');
    if (!token) { toast.error('Paste the Bearer token from INKY first'); return; }
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await client.functions.invoke('syncInky', { action: 'sync_users', bearer_token: token });
      if (res.success) {
        setSyncResult(res);
        toast.success(`Synced ${res.synced} customers. ${res.unmatched} unmatched.`);
        queryClient.invalidateQueries({ queryKey: ['inky-reports'] });
      } else {
        toast.error(res.error);
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
        <div className="flex items-center gap-3 mb-2">
          <RefreshCw className="w-4 h-4 text-blue-600" />
          <h4 className="text-sm font-semibold text-slate-900 flex-1">Sync from INKY</h4>
        </div>
        <p className="text-[10px] text-slate-400 mb-3">
          INKY portal &rarr; F12 &rarr; Network &rarr; click any <code className="bg-slate-100 px-1 rounded">api/dashboard</code> request &rarr; copy the <strong>Authorization</strong> header value. Token expires in ~5 min so paste and sync right away.
        </p>
        <div className="flex gap-2">
          <Input
            value={tokenValue}
            onChange={e => setTokenValue(e.target.value)}
            placeholder="Paste Bearer eyJ... token here"
            className="h-8 text-xs font-mono flex-1"
          />
          <Button size="sm" onClick={handleSync} disabled={syncing} className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white px-4">
            <RefreshCw className={cn("w-3 h-3 mr-1.5", syncing && "animate-spin")} />
            {syncing ? 'Syncing...' : 'Sync Now'}
          </Button>
        </div>
      </div>
      )}

      {syncResult && (
        <div className="px-4 py-3 text-xs">
          <div className="flex gap-4 text-slate-600 mb-2">
            <span>Total users: <strong>{syncResult.totalUsers}</strong></span>
            <span>Synced: <strong className="text-emerald-600">{syncResult.synced}</strong></span>
            <span>Unmatched: <strong className={syncResult.unmatched > 0 ? "text-amber-600" : "text-slate-400"}>{syncResult.unmatched}</strong></span>
          </div>
          {syncResult.results?.filter(r => !r.customer).length > 0 && (
            <div className="bg-amber-50 rounded p-2 mt-1">
              <p className="text-[10px] font-semibold text-amber-700 mb-1">Unmatched INKY teams:</p>
              {syncResult.results.filter(r => !r.customer).map(r => (
                <p key={r.teamSlug} className="text-[10px] text-amber-600">{r.teamName} ({r.userCount ?? '?'} users)</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function InkyConfig() {
  const [customerSearch, setCustomerSearch] = useState('');
  const [expandedCustomer, setExpandedCustomer] = useState(null);
  const [uploadingType, setUploadingType] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [extractedData, setExtractedData] = useState(null);
  const [reportDate, setReportDate] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const queryClient = useQueryClient();

  const { data: reports = [] } = useQuery({
    queryKey: ['inky-reports'],
    queryFn: () => client.entities.InkyReport.list('-report_date', 1000),
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => client.entities.Customer.list('name', 500),
  });

  // Group reports by customer_id -> report_type
  const reportsByCustomer = useMemo(() => {
    const map = {};
    for (const r of reports) {
      if (!r.customer_id) continue;
      if (!map[r.customer_id]) map[r.customer_id] = {};
      const type = r.report_type || 'threat_level_overview';
      if (!map[r.customer_id][type]) map[r.customer_id][type] = [];
      map[r.customer_id][type].push(r);
    }
    return map;
  }, [reports]);

  // Customers with report counts
  const customersWithCounts = useMemo(() => {
    return customers.map(c => ({
      ...c,
      reportCount: reports.filter(r => r.customer_id === c.id).length,
    }));
  }, [customers, reports]);

  // Filter customers by search
  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return customersWithCounts.filter(c => c.reportCount > 0);
    const q = customerSearch.toLowerCase();
    return customersWithCounts.filter(c => c.name.toLowerCase().includes(q));
  }, [customersWithCounts, customerSearch]);

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file);
      setExtractedData(null);
      if (!reportDate) setReportDate(new Date().toISOString().split('T')[0]);
      await extractDataFromFile(file);
    } else {
      toast.error('Please select a PDF file');
    }
  };

  const extractDataFromFile = async (file) => {
    setIsExtracting(true);
    try {
      const { file_url } = await client.integrations.Core.UploadFile({ file });
      const result = await client.integrations.Core.InvokeLLM({
        prompt: `Analyze this Inky email protection report PDF and extract the following data.

Look carefully for:
- Report date or period (start and end dates)
- Total number of protected users/mailboxes
- Total emails processed/scanned
- Total threats blocked (phishing, spam, malware, impersonation/BEC)
- Breakdown by threat category
- Threat rate (percentage of emails that were threats)
- Top targeted users (name, email, threat count)
- Any graymail filtering stats
- Any link click metrics

Convert all dates to YYYY-MM-DD format.
If a field is not found in the report, use 0 for numbers and null for strings.`,
        file_urls: [file_url],
        response_json_schema: {
          type: "object",
          properties: {
            report_date: { type: "string", description: "Report date in YYYY-MM-DD format" },
            report_period_start: { type: "string", description: "Report period start in YYYY-MM-DD format" },
            report_period_end: { type: "string", description: "Report period end in YYYY-MM-DD format" },
            total_users: { type: "number" },
            total_emails_processed: { type: "number" },
            total_threats_blocked: { type: "number" },
            total_phishing_blocked: { type: "number" },
            total_spam_blocked: { type: "number" },
            total_malware_blocked: { type: "number" },
            total_impersonation_blocked: { type: "number" },
            threat_rate: { type: "number" },
            threat_categories: { type: "array", items: { type: "object", properties: { category: { type: "string" }, count: { type: "number" }, percentage: { type: "number" } } } },
            top_targeted_users: { type: "array", items: { type: "object", properties: { name: { type: "string" }, email: { type: "string" }, threat_count: { type: "number" } } } }
          }
        }
      });

      if (result) {
        setExtractedData({ ...result, pdf_url: file_url });
        if (result.report_period_start) setPeriodStart(result.report_period_start);
        if (result.report_period_end) setPeriodEnd(result.report_period_end);
        if (result.report_date) setReportDate(result.report_date);
        toast.success('Data extracted from PDF');
      }
    } catch (error) {
      toast.error(error.message || 'Failed to extract data from PDF');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSaveReport = async () => {
    if (!uploadingType || !reportDate) {
      toast.error('Please select a report date');
      return;
    }
    setIsUploading(true);
    try {
      let pdfUrl = extractedData?.pdf_url;
      if (!pdfUrl && selectedFile) {
        const { file_url } = await client.integrations.Core.UploadFile({ file: selectedFile });
        pdfUrl = file_url;
      }

      await client.entities.InkyReport.create({
        customer_id: uploadingType.customerId,
        customer_name: uploadingType.customerName,
        report_type: uploadingType.reportType,
        report_date: reportDate,
        report_period_start: periodStart || null,
        report_period_end: periodEnd || null,
        pdf_url: pdfUrl,
        total_users: extractedData?.total_users || 0,
        total_emails_processed: extractedData?.total_emails_processed || 0,
        total_threats_blocked: extractedData?.total_threats_blocked || 0,
        total_phishing_blocked: extractedData?.total_phishing_blocked || 0,
        total_spam_blocked: extractedData?.total_spam_blocked || 0,
        total_malware_blocked: extractedData?.total_malware_blocked || 0,
        total_impersonation_blocked: extractedData?.total_impersonation_blocked || 0,
        threat_rate: extractedData?.threat_rate || 0,
        threat_categories: extractedData?.threat_categories ? JSON.stringify(extractedData.threat_categories) : null,
        top_targeted_users: extractedData?.top_targeted_users ? JSON.stringify(extractedData.top_targeted_users) : null,
      });

      toast.success('Report saved');
      queryClient.invalidateQueries({ queryKey: ['inky-reports'] });
      resetUpload();
    } catch (error) {
      toast.error(error.message || 'Failed to save report');
    } finally {
      setIsUploading(false);
    }
  };

  const resetUpload = () => {
    setUploadingType(null);
    setSelectedFile(null);
    setExtractedData(null);
    setReportDate('');
    setPeriodStart('');
    setPeriodEnd('');
  };

  const handleDeleteReport = async (reportId) => {
    if (!confirm('Delete this report?')) return;
    try {
      await client.entities.InkyReport.delete(reportId);
      toast.success('Report deleted');
      queryClient.invalidateQueries({ queryKey: ['inky-reports'] });
    } catch (error) {
      toast.error(error.message || 'Failed to delete');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
          <ShieldCheck className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h3 className="font-semibold text-slate-900">Inky</h3>
          <p className="text-sm text-slate-500">Upload email protection reports per customer for QBR tracking</p>
        </div>
      </div>

      {/* Auto Sync */}
      <InkySyncPanel queryClient={queryClient} />

      {/* Manual User Count Editor */}
      <UserCountEditor customers={customers} reports={reports} queryClient={queryClient} />

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          value={customerSearch}
          onChange={e => setCustomerSearch(e.target.value)}
          placeholder="Search customers..."
          className="pl-10"
        />
      </div>

      {/* Customer List */}
      <div className="space-y-2">
        {filteredCustomers.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <Building2 className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            <p className="text-sm">{customerSearch ? 'No customers match your search' : 'No customers with reports yet — search to find a customer'}</p>
          </div>
        ) : (
          filteredCustomers.map(customer => {
            const isExpanded = expandedCustomer === customer.id;
            const customerReports = reportsByCustomer[customer.id] || {};

            return (
              <div key={customer.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                {/* Customer Row */}
                <button
                  onClick={() => setExpandedCustomer(isExpanded ? null : customer.id)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Building2 className="w-4 h-4 text-slate-400" />
                    <span className="font-medium text-slate-800">{customer.name}</span>
                    {customer.reportCount > 0 && (
                      <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
                        {customer.reportCount} report{customer.reportCount !== 1 ? 's' : ''}
                      </Badge>
                    )}
                  </div>
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  )}
                </button>

                {/* Expanded: 4 Report Type Slots */}
                {isExpanded && (
                  <div className="border-t border-slate-100 p-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {REPORT_TYPES.map(type => {
                        const Icon = type.icon;
                        const typeReports = customerReports[type.key] || [];
                        const latest = typeReports.sort((a, b) => (b.report_date || '').localeCompare(a.report_date || ''))[0];

                        return (
                          <div
                            key={type.key}
                            className={cn(
                              'rounded-lg border p-3',
                              latest ? 'border-slate-200 bg-white' : 'border-dashed border-slate-200 bg-slate-50/50'
                            )}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <div className={cn('w-7 h-7 rounded-md flex items-center justify-center', type.color)}>
                                  <Icon className="w-3.5 h-3.5" />
                                </div>
                                <div>
                                  <p className="text-xs font-semibold text-slate-800">{type.label}</p>
                                  <p className="text-[10px] text-slate-400">{type.description}</p>
                                </div>
                              </div>
                            </div>

                            {latest ? (
                              <div className="space-y-1.5">
                                <div className="flex items-center gap-2 text-[10px] text-slate-500">
                                  <Calendar className="w-3 h-3" />
                                  {format(new Date(latest.report_date), 'MMM d, yyyy')}
                                  {latest.total_threats_blocked > 0 && (
                                    <span className="text-blue-600 font-medium">{latest.total_threats_blocked.toLocaleString()} threats</span>
                                  )}
                                  {latest.total_emails_processed > 0 && (
                                    <span>{latest.total_emails_processed.toLocaleString()} emails</span>
                                  )}
                                </div>
                                <div className="flex gap-1.5">
                                  {latest.pdf_url && (
                                    <button
                                      onClick={() => window.open(latest.pdf_url, '_blank')}
                                      className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                                    >
                                      View PDF
                                    </button>
                                  )}
                                  <button
                                    onClick={() => setUploadingType({ customerId: customer.id, customerName: customer.name, reportType: type.key })}
                                    className="text-[10px] px-2 py-0.5 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                                  >
                                    Update
                                  </button>
                                  <button
                                    onClick={() => handleDeleteReport(latest.id)}
                                    className="text-[10px] px-2 py-0.5 rounded bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => setUploadingType({ customerId: customer.id, customerName: customer.name, reportType: type.key })}
                                className="w-full mt-1 flex items-center justify-center gap-1.5 py-2 rounded-md border border-dashed border-slate-300 text-xs text-slate-400 hover:text-blue-600 hover:border-blue-300 transition-colors"
                              >
                                <Upload className="w-3 h-3" />
                                Upload
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Upload Modal */}
      <Dialog open={!!uploadingType} onOpenChange={(open) => { if (!open) resetUpload(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-blue-600" />
              Upload {REPORT_TYPES.find(t => t.key === uploadingType?.reportType)?.label || 'Report'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg">
              <Building2 className="w-4 h-4 text-slate-400" />
              <span className="text-sm font-medium text-slate-700">{uploadingType?.customerName}</span>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Report Date</Label>
                <Input type="date" value={reportDate} onChange={e => setReportDate(e.target.value)} className="mt-1.5" />
              </div>
              <div>
                <Label>Period Start</Label>
                <Input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} className="mt-1.5" />
              </div>
              <div>
                <Label>Period End</Label>
                <Input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} className="mt-1.5" />
              </div>
            </div>

            <div>
              <Label>PDF Report</Label>
              <div className="mt-1.5 border-2 border-dashed border-slate-200 rounded-lg p-4 text-center">
                {selectedFile ? (
                  <div className="flex items-center justify-center gap-2">
                    <FileText className="w-5 h-5 text-blue-600" />
                    <span className="text-sm font-medium">{selectedFile.name}</span>
                    <Button size="sm" variant="ghost" onClick={() => { setSelectedFile(null); setExtractedData(null); }}>Remove</Button>
                  </div>
                ) : (
                  <label className="cursor-pointer">
                    <input type="file" accept=".pdf" onChange={handleFileSelect} className="hidden" />
                    <div className="text-slate-500">
                      <Upload className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                      <p className="text-sm">Click to select PDF</p>
                    </div>
                  </label>
                )}
              </div>
            </div>

            {isExtracting && (
              <div className="flex items-center justify-center gap-2 py-3 text-slate-600">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Extracting data from PDF...</span>
              </div>
            )}

            {extractedData && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-sm font-medium text-green-800 mb-2">Extracted Data:</p>
                <div className="grid grid-cols-3 gap-x-4 gap-y-1 text-xs">
                  <div>Users: <strong>{extractedData.total_users || 0}</strong></div>
                  <div>Emails: <strong>{(extractedData.total_emails_processed || 0).toLocaleString()}</strong></div>
                  <div>Threats: <strong className="text-blue-600">{(extractedData.total_threats_blocked || 0).toLocaleString()}</strong></div>
                  <div>Phishing: <strong className="text-red-600">{extractedData.total_phishing_blocked || 0}</strong></div>
                  <div>Spam: <strong className="text-amber-600">{extractedData.total_spam_blocked || 0}</strong></div>
                  <div>Malware: <strong className="text-red-600">{extractedData.total_malware_blocked || 0}</strong></div>
                  <div>Impersonation: <strong className="text-purple-600">{extractedData.total_impersonation_blocked || 0}</strong></div>
                  <div>Threat Rate: <strong>{extractedData.threat_rate || 0}%</strong></div>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={resetUpload}>Cancel</Button>
              <Button onClick={handleSaveReport} disabled={isUploading || !reportDate}>
                {isUploading ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</>
                ) : (
                  <><Plus className="w-4 h-4 mr-2" />Save Report</>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
