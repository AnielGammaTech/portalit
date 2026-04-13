import React, { useState, useCallback } from 'react';
import { client } from '@/api/client';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Trash2, Upload, Loader2, FileText, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// LLM extraction constants
// ---------------------------------------------------------------------------

const EXTRACT_PROMPT = `You are analyzing a Dark Web ID business report PDF. Extract ALL data carefully.
Read EVERY page. Look for: Cover/Header (customer name, date range), Summary (total/new compromises),
Monitoring Details (domains, IPs), Organizational Compromises (emails, sources, dates, passwords),
Breaches Table. Extract customer_name, report_date (YYYY-MM-DD), report_period_start/end,
total_compromises, new_compromises, severity counts (critical/high/medium/low based on password=critical,
personal data=high, email only=medium, other=low), domains_monitored, domains_count, compromised_emails,
breach_sources, and compromises_detail with email/password/source/breach_date/severity.
Use 0 for missing numbers and empty arrays for missing lists.`;

const EXTRACT_SCHEMA = {
  type: "object",
  properties: {
    customer_name: { type: "string" },
    report_date: { type: "string" },
    report_period_start: { type: "string" },
    report_period_end: { type: "string" },
    total_compromises: { type: "number" },
    new_compromises: { type: "number" },
    critical_count: { type: "number" },
    high_count: { type: "number" },
    medium_count: { type: "number" },
    low_count: { type: "number" },
    domains_monitored: { type: "array", items: { type: "string" } },
    domains_count: { type: "number" },
    compromised_emails: { type: "array", items: { type: "string" } },
    breach_sources: { type: "array", items: { type: "string" } },
    compromises_detail: {
      type: "array",
      items: {
        type: "object",
        properties: {
          email: { type: "string" },
          password: { type: "string" },
          source: { type: "string" },
          breach_date: { type: "string" },
          severity: { type: "string", enum: ["critical", "high", "medium", "low"] },
        },
      },
    },
  },
};

// ---------------------------------------------------------------------------
// Auto-match helper
// ---------------------------------------------------------------------------

function autoMatchCustomer(extractedName, customers) {
  const words = extractedName.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 1);
  let best = null;
  let bestScore = 0;
  for (const c of customers) {
    const cw = c.name.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 1);
    const matching = words.filter(ew => cw.some(cwi => cwi.includes(ew) || ew.includes(cwi)));
    const score = matching.length / Math.max(words.length, 1);
    if (score > bestScore && score >= 0.4) { bestScore = score; best = c; }
  }
  if (!best) {
    const norm = extractedName.toLowerCase().replace(/[^a-z0-9]/g, '');
    best = customers.find(c => {
      const cn = c.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      return cn.includes(norm) || norm.includes(cn);
    }) || null;
  }
  return best;
}

// ---------------------------------------------------------------------------
// Upload Report Dialog
// ---------------------------------------------------------------------------

export default function UploadReportDialog({ open, onOpenChange, customers, queryClient }) {
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [reportDate, setReportDate] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedData, setExtractedData] = useState(null);

  const resetForm = useCallback(() => {
    onOpenChange(false);
    setSelectedCustomer('');
    setReportDate('');
    setPeriodStart('');
    setPeriodEnd('');
    setSelectedFile(null);
    setExtractedData(null);
  }, [onOpenChange]);

  const handleFileSelect = useCallback(async (e) => {
    const file = e.target.files[0];
    if (!file || file.type !== 'application/pdf') {
      toast.error('Please select a PDF file');
      return;
    }
    setSelectedFile(file);
    setExtractedData(null);
    if (!reportDate) setReportDate(new Date().toISOString().split('T')[0]);
    setIsExtracting(true);
    try {
      const { file_url } = await client.integrations.Core.UploadFile({ file });
      const result = await client.integrations.Core.InvokeLLM({
        prompt: EXTRACT_PROMPT,
        file_urls: [file_url],
        response_json_schema: EXTRACT_SCHEMA,
      });
      if (result) {
        setExtractedData({ ...result, pdf_url: file_url });
        if (result.customer_name && !selectedCustomer) {
          const match = autoMatchCustomer(result.customer_name, customers);
          if (match) setSelectedCustomer(match.id);
        }
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
  }, [reportDate, selectedCustomer, customers]);

  const handleSave = useCallback(async () => {
    if (!selectedCustomer || !reportDate) {
      toast.error('Please select a customer and report date');
      return;
    }
    setIsUploading(true);
    try {
      const customer = customers.find(c => c.id === selectedCustomer);
      let pdfUrl = extractedData?.pdf_url;
      if (!pdfUrl && selectedFile) {
        const { file_url } = await client.integrations.Core.UploadFile({ file: selectedFile });
        pdfUrl = file_url;
      }
      const rd = extractedData || {};
      await client.entities.DarkWebIDReport.create({
        customer_id: selectedCustomer,
        customer_name: customer?.name,
        report_date: reportDate,
        report_period_start: periodStart || null,
        report_period_end: periodEnd || null,
        pdf_url: pdfUrl,
        report_data: extractedData ? {
          total_compromises: rd.total_compromises || 0,
          new_compromises: rd.new_compromises || 0,
          critical_count: rd.critical_count || 0,
          high_count: rd.high_count || 0,
          medium_count: rd.medium_count || 0,
          low_count: rd.low_count || 0,
          domains_monitored: rd.domains_monitored || [],
          domains_count: rd.domains_count || rd.domains_monitored?.length || 0,
          compromised_emails: rd.compromised_emails || [],
          breach_sources: rd.breach_sources || [],
          compromises_detail: rd.compromises_detail || [],
          customer_name_extracted: rd.customer_name || null,
        } : null,
        total_compromises: rd.total_compromises || 0,
        new_compromises: rd.new_compromises || 0,
        critical_count: rd.critical_count || 0,
        high_count: rd.high_count || 0,
        medium_count: rd.medium_count || 0,
        low_count: rd.low_count || 0,
        compromised_emails: rd.compromised_emails ? JSON.stringify(rd.compromised_emails) : null,
        breach_sources: rd.breach_sources ? JSON.stringify(rd.breach_sources) : null,
        compromises_detail: rd.compromises_detail ? JSON.stringify(rd.compromises_detail) : null,
      });
      toast.success('Report saved successfully');
      queryClient.invalidateQueries({ queryKey: ['darkwebid-reports'] });
      resetForm();
    } catch (error) {
      toast.error(error.message || 'Failed to save report');
    } finally {
      setIsUploading(false);
    }
  }, [selectedCustomer, reportDate, periodStart, periodEnd, extractedData, selectedFile, customers, queryClient, resetForm]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-[92vw] max-h-[90vh] flex flex-col overflow-hidden" style={{ zIndex: 9999 }}>
        <DialogHeader>
          <DialogTitle>Upload Dark Web ID Report</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-3 overflow-y-auto flex-1 min-h-0">
          <div>
            <Label className="text-sm">Customer</Label>
            <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Select customer..." /></SelectTrigger>
              <SelectContent style={{ zIndex: 10000 }}>
                {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-sm">Report Date</Label>
              <Input type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-sm">Period Start</Label>
              <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-sm">Period End</Label>
              <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className="mt-1" />
            </div>
          </div>
          <div>
            <Label className="text-sm">PDF Report</Label>
            <div className={cn(
              "mt-1 border-2 border-dashed rounded-lg p-4 text-center transition-colors",
              selectedFile ? "border-slate-300 bg-slate-50" : "border-slate-200 hover:border-slate-400",
            )}>
              {selectedFile ? (
                <div className="flex items-center justify-center gap-2">
                  <FileText className="w-4 h-4 text-slate-500" />
                  <span className="text-sm text-slate-700 truncate">{selectedFile.name}</span>
                  <button
                    type="button"
                    onClick={() => { setSelectedFile(null); setExtractedData(null); }}
                    className="p-1 text-slate-400 hover:text-red-600"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <label className="cursor-pointer block">
                  <input type="file" accept=".pdf" onChange={handleFileSelect} className="hidden" />
                  <Upload className="w-6 h-6 mx-auto mb-1 text-slate-400" />
                  <p className="text-xs text-slate-500">Click to select PDF</p>
                </label>
              )}
            </div>
          </div>
          {isExtracting && (
            <div className="flex items-center justify-center gap-2 py-3 bg-slate-50 rounded-lg border border-slate-200">
              <Loader2 className="w-4 h-4 animate-spin text-slate-600" />
              <span className="text-xs text-slate-600">Extracting data from PDF...</span>
            </div>
          )}
          {extractedData && !isExtracting && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-xs font-medium text-slate-700">Extracted Data</span>
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-slate-600">
                <span>Total: <strong>{extractedData.total_compromises || 0}</strong></span>
                <span>New: <strong className="text-red-600">+{extractedData.new_compromises || 0}</strong></span>
                <span>Critical: <strong>{extractedData.critical_count || 0}</strong></span>
                <span>High: <strong>{extractedData.high_count || 0}</strong></span>
                <span>Domains: <strong>{extractedData.domains_count || extractedData.domains_monitored?.length || 0}</strong></span>
              </div>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
          <Button variant="outline" size="sm" onClick={resetForm}>Cancel</Button>
          <Button size="sm" onClick={handleSave} disabled={isUploading || !selectedCustomer || !reportDate}>
            {isUploading ? <><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />Saving...</> : 'Save Report'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
