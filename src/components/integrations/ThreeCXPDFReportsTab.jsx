import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { client } from '@/api/client';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Phone, Plus, Trash2, Building2, CheckCircle2,
  XCircle, ChevronDown, Loader2, Upload, FileText, Eye,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn, safeJsonParse } from "@/lib/utils";
import { format } from 'date-fns';

function parseThreeCXExtensionsCsv(csvText) {
  const splitCsvRows = (text) => {
    const rows = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
        current += ch;
      } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        if (current.trim()) rows.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
    if (current.trim()) rows.push(current);
    return rows;
  };

  const parseRow = (line) => {
    const fields = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        fields.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    fields.push(current.trim());
    return fields;
  };

  const rows = splitCsvRows(csvText);
  if (rows.length < 2) return null;

  const headers = parseRow(rows[0]);
  const numIdx = headers.findIndex(h => h.toLowerCase() === 'number');
  const firstIdx = headers.findIndex(h => h.toLowerCase() === 'firstname');
  const lastIdx = headers.findIndex(h => h.toLowerCase() === 'lastname');
  const emailIdx = headers.findIndex(h => h.toLowerCase() === 'emailaddress');
  const roleIdx = headers.findIndex(h => h.toLowerCase() === 'role');
  const disabledIdx = headers.findIndex(h => h.toLowerCase() === 'disabled');
  const deptIdx = headers.findIndex(h => h.toLowerCase() === 'department');

  if (numIdx === -1) return null;

  const extensions = [];
  for (let i = 1; i < rows.length; i++) {
    const fields = parseRow(rows[i]);
    if (!fields[numIdx]) continue;

    const role = (roleIdx >= 0 ? fields[roleIdx] : '') || '';
    const disabled = (disabledIdx >= 0 ? fields[disabledIdx] : '0') || '0';
    const firstName = (firstIdx >= 0 ? fields[firstIdx] : '') || '';
    const lastName = (lastIdx >= 0 ? fields[lastIdx] : '') || '';
    const email = (emailIdx >= 0 ? fields[emailIdx] : '') || '';
    const dept = (deptIdx >= 0 ? fields[deptIdx] : '') || '';

    const isUser = role.includes('users') || role.includes('system_owners');
    const isDisabled = disabled === '1';

    extensions.push({
      number: fields[numIdx],
      name: [firstName, lastName].filter(Boolean).join(' ') || `Ext ${fields[numIdx]}`,
      type: isUser ? (isDisabled ? 'disabled' : 'user') : 'system',
      department: dept || 'DEFAULT',
      email: email || '',
      disabled: isDisabled,
    });
  }

  const activeUsers = extensions.filter(e => e.type === 'user');
  const disabledUsers = extensions.filter(e => e.type === 'disabled');

  return {
    total_extensions: extensions.length,
    user_extensions: activeUsers.length,
    disabled_extensions: disabledUsers.length,
    extensions_detail: extensions.map(e => ({
      number: e.number,
      name: e.name,
      type: e.type,
      department: e.department,
    })),
  };
}

export default function PDFReportsTab() {
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [errorDetails, setErrorDetails] = useState(null);
  const [showErrorDetails, setShowErrorDetails] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [reportDate, setReportDate] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedData, setExtractedData] = useState(null);
  const [excludedExtensions, setExcludedExtensions] = useState(new Set());
  const queryClient = useQueryClient();

  const { data: reports = [], isLoading: loadingReports } = useQuery({
    queryKey: ['threecx-reports'],
    queryFn: () => client.entities.ThreeCXReport.list('-report_date', 100),
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => client.entities.Customer.list('name', 500),
  });

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['pdf', 'csv'].includes(ext)) {
      toast.error('Please select a PDF or CSV file');
      return;
    }
    setSelectedFile(file);
    setExtractedData(null);
    if (!reportDate) setReportDate(new Date().toISOString().split('T')[0]);
    if (ext === 'csv') {
      await extractDataFromCsv(file);
    } else {
      await extractDataFromPdf(file);
    }
  };

  const extractDataFromCsv = async (file) => {
    setIsExtracting(true);
    try {
      const text = await file.text();
      const result = parseThreeCXExtensionsCsv(text);
      if (!result) {
        toast.error("Could not parse CSV — ensure it's a 3CX extensions export");
        return;
      }
      setExtractedData(result);
      toast.success(`Parsed ${result.total_extensions} extensions (${result.user_extensions} active users)`);
    } catch (error) {
      const errMsg = error.message || 'Failed to parse CSV';
      setErrorDetails(errMsg);
      toast.error(errMsg);
    } finally {
      setIsExtracting(false);
    }
  };

  const extractDataFromPdf = async (file) => {
    setIsExtracting(true);
    try {
      const { file_url } = await client.integrations.Core.UploadFile({ file });
      const result = await client.integrations.Core.InvokeLLM({
        prompt: `You are analyzing a 3CX VoIP system report PDF. Extract ALL data carefully.

Look for:
- Customer/company name
- Report date or reporting period
- Total number of extensions configured
- Number of user (non-system) extensions
- Ring groups count
- Call queues count
- SIP trunks count
- Call statistics: total calls, inbound, outbound, missed
- Average call duration
- Individual extension details if listed (extension number, name, type, department)`,
        file_urls: [file_url],
        response_json_schema: {
          type: "object",
          properties: {
            customer_name: { type: "string", description: "Customer/company name" },
            report_date: { type: "string", description: "Report date YYYY-MM-DD" },
            report_period_start: { type: "string", description: "Period start YYYY-MM-DD" },
            report_period_end: { type: "string", description: "Period end YYYY-MM-DD" },
            total_extensions: { type: "number", description: "Total extensions" },
            user_extensions: { type: "number", description: "User extensions only" },
            ring_groups: { type: "number", description: "Number of ring groups" },
            queues: { type: "number", description: "Number of call queues" },
            trunks: { type: "number", description: "Number of SIP trunks" },
            total_calls: { type: "number", description: "Total calls in period" },
            inbound_calls: { type: "number", description: "Inbound calls" },
            outbound_calls: { type: "number", description: "Outbound calls" },
            missed_calls: { type: "number", description: "Missed calls" },
            avg_call_duration: { type: "string", description: "Average call duration" },
            extensions_detail: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  number: { type: "string" },
                  name: { type: "string" },
                  type: { type: "string" },
                  department: { type: "string" },
                },
              },
            },
            call_stats: { type: "object", description: "Additional call statistics as key-value pairs" },
          },
        },
      });
      if (result) {
        setExtractedData({ ...result, pdf_url: file_url });
        if (result.customer_name && !selectedCustomer) {
          const matchedCustomer = customers.find(c => {
            const norm1 = c.name.toLowerCase().replace(/[^a-z0-9]/g, '');
            const norm2 = result.customer_name.toLowerCase().replace(/[^a-z0-9]/g, '');
            return norm1.includes(norm2) || norm2.includes(norm1);
          });
          if (matchedCustomer) setSelectedCustomer(matchedCustomer.id);
        }
        if (result.report_period_start) setPeriodStart(result.report_period_start);
        if (result.report_period_end) setPeriodEnd(result.report_period_end);
        if (result.report_date) setReportDate(result.report_date);
        toast.success('Data extracted from PDF');
      }
    } catch (error) {
      const errMsg = error.message || 'Failed to extract data from PDF';
      setErrorDetails(errMsg);
      toast.error(errMsg);
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSaveReport = async () => {
    if (!selectedCustomer || !reportDate) {
      toast.error('Please select a customer and report date');
      return;
    }
    setIsUploading(true);
    try {
      const customer = customers.find(c => c.id === selectedCustomer);
      let pdfUrl = extractedData?.pdf_url || null;
      if (!pdfUrl && selectedFile && selectedFile.type === 'application/pdf') {
        const { file_url } = await client.integrations.Core.UploadFile({ file: selectedFile });
        pdfUrl = file_url;
      }
      const filteredExtensions = (extractedData?.extensions_detail || [])
        .filter(ext => !excludedExtensions.has(ext.number || ext.name));
      const filteredUserCount = filteredExtensions.filter(e => e.type === 'user' || (!e.type && !e.disabled)).length;
      const filteredTotal = filteredExtensions.length;

      await client.entities.ThreeCXReport.create({
        customer_id: selectedCustomer,
        customer_name: customer?.name,
        report_date: reportDate,
        report_period_start: periodStart || null,
        report_period_end: periodEnd || null,
        pdf_url: pdfUrl,
        total_extensions: excludedExtensions.size > 0 ? filteredTotal : (extractedData?.total_extensions || 0),
        user_extensions: excludedExtensions.size > 0 ? filteredUserCount : (extractedData?.user_extensions || 0),
        ring_groups: extractedData?.ring_groups || 0,
        queues: extractedData?.queues || 0,
        trunks: extractedData?.trunks || 0,
        total_calls: extractedData?.total_calls || 0,
        inbound_calls: extractedData?.inbound_calls || 0,
        outbound_calls: extractedData?.outbound_calls || 0,
        missed_calls: extractedData?.missed_calls || 0,
        avg_call_duration: extractedData?.avg_call_duration || null,
        extensions_detail: filteredExtensions.length > 0 ? JSON.stringify(filteredExtensions) : null,
        call_stats: extractedData?.call_stats ? JSON.stringify(extractedData.call_stats) : null,
      });
      toast.success('Report saved successfully');
      setErrorDetails(null);
      queryClient.invalidateQueries({ queryKey: ['threecx-reports'] });
      resetForm();
    } catch (error) {
      const errMsg = error.message || 'Failed to save report';
      setErrorDetails(errMsg);
      toast.error(errMsg);
    } finally {
      setIsUploading(false);
    }
  };

  const resetForm = () => {
    setShowUploadModal(false);
    setSelectedCustomer('');
    setReportDate('');
    setPeriodStart('');
    setPeriodEnd('');
    setSelectedFile(null);
    setExtractedData(null);
    setExcludedExtensions(new Set());
  };

  const [expandedReport, setExpandedReport] = useState(null);
  const [reportExclusions, setReportExclusions] = useState(new Set());

  const handleExpandReport = (report) => {
    if (expandedReport?.id === report.id) {
      setExpandedReport(null);
      return;
    }
    const detail = typeof report.extensions_detail === 'string'
      ? safeJsonParse(report.extensions_detail, [])
      : (report.extensions_detail || []);
    const existing = report.report_data?.excluded_extensions || [];
    setReportExclusions(new Set(existing));
    setExpandedReport({ ...report, parsedExtensions: detail });
  };

  const handleSaveExclusions = async (reportId) => {
    const report = expandedReport;
    if (!report) return;
    const excluded = Array.from(reportExclusions);
    const allExts = report.parsedExtensions || [];
    const included = allExts.filter(e => !reportExclusions.has(e.number || e.name));
    try {
      await client.entities.ThreeCXReport.update(reportId, {
        user_extensions: included.length,
        total_extensions: allExts.length,
        report_data: { ...(report.report_data || {}), excluded_extensions: excluded, synced_from: report.report_data?.synced_from },
      });
      toast.success(`Saved — ${included.length} billable extensions (${excluded.length} excluded)`);
      queryClient.invalidateQueries({ queryKey: ['threecx-reports'] });
      setExpandedReport(null);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleDeleteReport = async (reportId) => {
    if (!confirm('Delete this report?')) return;
    try {
      await client.entities.ThreeCXReport.delete(reportId);
      toast.success('Report deleted');
      queryClient.invalidateQueries({ queryKey: ['threecx-reports'] });
    } catch (error) {
      toast.error(error.message || 'Failed to delete report');
    }
  };

  return (
    <div className="space-y-5">
      {errorDetails && (
        <Collapsible open={showErrorDetails} onOpenChange={setShowErrorDetails}>
          <div className="border border-red-200 bg-red-50 rounded-lg overflow-hidden">
            <CollapsibleTrigger asChild>
              <button className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-red-700 hover:bg-red-100 transition-colors">
                <div className="flex items-center gap-2">
                  <XCircle className="w-4 h-4" />
                  Error details
                </div>
                <ChevronDown className={cn("w-4 h-4 transition-transform", showErrorDetails && "rotate-180")} />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-4 pb-3 pt-1 border-t border-red-200">
                <pre className="text-xs text-red-600 whitespace-pre-wrap font-mono bg-red-100/50 rounded p-2">{errorDetails}</pre>
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>
      )}

      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
        <p className="text-sm text-emerald-800">
          <strong>Report Upload:</strong> Upload a 3CX extensions CSV export or a PDF report.
          CSV files are parsed instantly for extension counts. PDF reports use AI extraction for call stats and metrics.
        </p>
      </div>

      <div className="flex justify-end">
        <Button onClick={() => setShowUploadModal(true)}>
          <Upload className="w-4 h-4 mr-2" />
          Upload Report
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>Report Date</TableHead>
              <TableHead>Period</TableHead>
              <TableHead>Extensions</TableHead>
              <TableHead>Total Calls</TableHead>
              <TableHead>Missed</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loadingReports ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto text-slate-400" />
                </TableCell>
              </TableRow>
            ) : reports.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <Phone className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-slate-500">No reports uploaded yet</p>
                  <p className="text-sm text-slate-400">Upload a 3CX extensions CSV or PDF report</p>
                </TableCell>
              </TableRow>
            ) : (
              reports.map(report => {
                const isExpanded = expandedReport?.id === report.id;
                const hasDetail = report.extensions_detail && report.extensions_detail !== '[]';
                return (
                  <React.Fragment key={report.id}>
                    <TableRow className={cn("cursor-pointer transition-colors", isExpanded && "bg-slate-50")} onClick={() => hasDetail && handleExpandReport(report)}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {hasDetail && <ChevronDown className={cn("w-3 h-3 text-slate-400 transition-transform", isExpanded && "rotate-180")} />}
                          {!hasDetail && <Building2 className="w-4 h-4 text-slate-400" />}
                          <span className="font-medium">{report.customer_name}</span>
                        </div>
                      </TableCell>
                      <TableCell>{format(new Date(report.report_date), 'MMM d, yyyy')}</TableCell>
                      <TableCell className="text-xs text-slate-500">
                        {report.report_period_start && report.report_period_end
                          ? `${format(new Date(report.report_period_start), 'MM/dd/yy')} - ${format(new Date(report.report_period_end), 'MM/dd/yy')}`
                          : '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          <Phone className="w-3 h-3 mr-1" />
                          {report.user_extensions || report.total_extensions || 0}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {report.total_calls > 0
                          ? <span className="font-medium">{report.total_calls.toLocaleString()}</span>
                          : <span className="text-slate-400">—</span>}
                      </TableCell>
                      <TableCell>
                        {report.missed_calls > 0
                          ? <Badge className="bg-orange-100 text-orange-700">{report.missed_calls}</Badge>
                          : <span className="text-slate-400">—</span>}
                      </TableCell>
                      <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          {report.pdf_url && (
                            <Button size="sm" variant="outline" onClick={() => window.open(report.pdf_url, '_blank')}>
                              <Eye className="w-3 h-3 mr-1" />
                              View
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleDeleteReport(report.id)}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {isExpanded && expandedReport.parsedExtensions?.length > 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="p-0">
                          <div className="bg-slate-50 border-t border-slate-200 px-4 py-3">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-xs font-semibold text-slate-600">
                                Extensions ({expandedReport.parsedExtensions.length}) — uncheck to exclude from billing
                              </p>
                              <div className="flex items-center gap-2">
                                {reportExclusions.size > 0 && (
                                  <span className="text-[10px] text-amber-600 font-medium">{reportExclusions.size} excluded</span>
                                )}
                                <Button size="sm" onClick={() => handleSaveExclusions(report.id)} className="h-7 text-xs px-3 bg-emerald-600 hover:bg-emerald-700">
                                  <CheckCircle2 className="w-3 h-3 mr-1" />
                                  Save ({expandedReport.parsedExtensions.length - reportExclusions.size} billable)
                                </Button>
                              </div>
                            </div>
                            <div className="max-h-64 overflow-y-auto border border-slate-200 rounded-lg bg-white divide-y divide-slate-50">
                              {expandedReport.parsedExtensions.map((ext) => {
                                const key = ext.number || ext.name;
                                const isExcluded = reportExclusions.has(key);
                                return (
                                  <label key={key} className={cn("flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-slate-50 transition-colors", isExcluded && "opacity-50 bg-red-50/50")}>
                                    <input
                                      type="checkbox"
                                      checked={!isExcluded}
                                      onChange={() => {
                                        const next = new Set(reportExclusions);
                                        isExcluded ? next.delete(key) : next.add(key);
                                        setReportExclusions(next);
                                      }}
                                      className="rounded border-slate-300"
                                    />
                                    <span className="text-xs font-mono text-slate-500 w-10">{ext.number || '—'}</span>
                                    <span className={cn("text-sm flex-1", isExcluded ? "line-through text-slate-400" : "text-slate-800")}>{ext.name || 'Unknown'}</span>
                                    {ext.email && <span className="text-[10px] text-slate-400">{ext.email}</span>}
                                    {ext.department && ext.department !== 'DEFAULT' && (
                                      <Badge variant="outline" className="text-[9px]">{ext.department}</Badge>
                                    )}
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={showUploadModal} onOpenChange={setShowUploadModal}>
        <DialogContent className="max-w-lg" style={{ zIndex: 9999 }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-emerald-600" />
              Upload 3CX Report
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <Label>Customer</Label>
              <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Select customer..." />
                </SelectTrigger>
                <SelectContent style={{ zIndex: 10000 }}>
                  {customers.map(customer => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Report Date</Label>
                <Input type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} className="mt-1.5" />
              </div>
              <div>
                <Label>Period Start</Label>
                <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} className="mt-1.5" />
              </div>
              <div>
                <Label>Period End</Label>
                <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className="mt-1.5" />
              </div>
            </div>

            <div>
              <Label>Report File</Label>
              <div className="mt-1.5 border-2 border-dashed border-slate-200 rounded-lg p-4 text-center">
                {selectedFile ? (
                  <div className="flex items-center justify-center gap-2">
                    <FileText className="w-5 h-5 text-emerald-600" />
                    <span className="text-sm font-medium">{selectedFile.name}</span>
                    <Button size="sm" variant="ghost" onClick={() => { setSelectedFile(null); setExtractedData(null); }}>
                      Remove
                    </Button>
                  </div>
                ) : (
                  <label className="cursor-pointer">
                    <input type="file" accept=".pdf,.csv" onChange={handleFileSelect} className="hidden" />
                    <div className="text-slate-500">
                      <Upload className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                      <p className="text-sm">Click to select CSV or PDF</p>
                      <p className="text-xs text-slate-400 mt-1">3CX extensions CSV export or PDF report</p>
                    </div>
                  </label>
                )}
              </div>
            </div>

            {isExtracting && (
              <div className="flex items-center justify-center gap-2 py-3 text-slate-600">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">
                  {selectedFile?.name?.endsWith('.csv') ? 'Parsing CSV...' : 'Extracting data from PDF with AI...'}
                </span>
              </div>
            )}

            {extractedData && (
              <div className="space-y-3">
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                  <p className="text-sm font-medium text-emerald-800 mb-2">Extracted Data:</p>
                  {extractedData.customer_name && (
                    <p className="text-xs text-emerald-700 mb-1">Customer: <strong>{extractedData.customer_name}</strong></p>
                  )}
                  <div className="grid grid-cols-3 gap-x-4 gap-y-1 text-xs">
                    <div>Total Ext: <strong>{extractedData.total_extensions || 0}</strong></div>
                    <div>Active Users: <strong>{(extractedData.user_extensions || 0) - excludedExtensions.size}</strong></div>
                    {excludedExtensions.size > 0 && (
                      <div>Excluded: <strong className="text-orange-600">{excludedExtensions.size}</strong></div>
                    )}
                    {extractedData.disabled_extensions > 0 && (
                      <div>Disabled: <strong className="text-slate-400">{extractedData.disabled_extensions}</strong></div>
                    )}
                    {extractedData.queues > 0 && <div>Queues: <strong>{extractedData.queues}</strong></div>}
                    {extractedData.trunks > 0 && <div>Trunks: <strong>{extractedData.trunks}</strong></div>}
                    {extractedData.total_calls > 0 && <div>Total Calls: <strong>{extractedData.total_calls}</strong></div>}
                    {extractedData.missed_calls > 0 && <div>Missed: <strong className="text-orange-600">{extractedData.missed_calls}</strong></div>}
                  </div>
                </div>

                {extractedData.extensions_detail?.length > 0 && (
                  <div className="border rounded-lg overflow-hidden">
                    <div className="px-3 py-2 bg-slate-50 border-b flex items-center justify-between">
                      <p className="text-xs font-semibold text-slate-600">
                        Extensions ({extractedData.extensions_detail.length}) — uncheck to exclude system/shared extensions
                      </p>
                      {excludedExtensions.size > 0 && (
                        <button className="text-xs text-blue-600 hover:underline" onClick={() => setExcludedExtensions(new Set())}>
                          Include all
                        </button>
                      )}
                    </div>
                    <div className="max-h-48 overflow-y-auto divide-y divide-slate-100">
                      {extractedData.extensions_detail.map((ext) => {
                        const key = ext.number || ext.name;
                        const isExcluded = excludedExtensions.has(key);
                        return (
                          <label
                            key={key}
                            className={cn("flex items-center gap-3 px-3 py-1.5 cursor-pointer hover:bg-slate-50 transition-colors", isExcluded && "bg-red-50/50")}
                          >
                            <input
                              type="checkbox"
                              checked={!isExcluded}
                              onChange={() => {
                                const next = new Set(excludedExtensions);
                                if (isExcluded) { next.delete(key); } else { next.add(key); }
                                setExcludedExtensions(next);
                              }}
                              className="rounded border-slate-300"
                            />
                            <span className={cn("font-mono text-xs w-10 flex-shrink-0", isExcluded ? "text-slate-400 line-through" : "text-emerald-600 font-semibold")}>
                              {ext.number}
                            </span>
                            <span className={cn("text-xs flex-1 truncate", isExcluded ? "text-slate-400 line-through" : "text-slate-700")}>
                              {ext.name || `Ext ${ext.number}`}
                            </span>
                            <span className="text-[10px] text-slate-400">{ext.type || 'user'}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={resetForm}>Cancel</Button>
              <Button onClick={handleSaveReport} disabled={isUploading || !selectedCustomer || !reportDate}>
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
