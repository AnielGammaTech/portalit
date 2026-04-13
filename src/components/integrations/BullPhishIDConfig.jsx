import React, { useState, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { client } from '@/api/client';
import { Button } from "@/components/ui/button";
import {
  Upload,
  Eye,
  Trash2,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from "@/lib/utils";
import {
  CONNECTION_STATES,
  getConnectionStatusDisplay,
  IntegrationHeader,
  FilterBar,
  TablePagination,
  ITEMS_PER_PAGE,
} from './shared/IntegrationTableParts';
import BullPhishUploadModal from './shared/BullPhishUploadModal';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getReportStatusDot(report) {
  const d = report.report_data || {};
  if ((d.phish_prone_percentage || 0) > 20) return 'bg-red-500';
  if ((d.phish_prone_percentage || 0) > 10) return 'bg-amber-400';
  return 'bg-emerald-500';
}

function getCampaignLabel(report) {
  const d = report.report_data || {};
  if (d.campaigns?.length > 0) return d.campaigns[0].name;
  return report.customer_name || 'Uploaded report';
}

function buildReportData(extractedData, periodStart, periodEnd) {
  if (!extractedData) {
    return { report_period_start: periodStart || null, report_period_end: periodEnd || null };
  }
  return {
    report_period_start: periodStart || extractedData.report_period_start || null,
    report_period_end: periodEnd || extractedData.report_period_end || null,
    total_campaigns: extractedData.total_campaigns || 0,
    total_emails_sent: extractedData.total_emails_sent || 0,
    total_opened: extractedData.total_opened || 0,
    total_clicked: extractedData.total_clicked || 0,
    total_reported: extractedData.total_reported || 0,
    total_submitted_data: extractedData.total_submitted_data || 0,
    phish_prone_percentage: extractedData.phish_prone_percentage || 0,
    training_completion_rate: extractedData.training_completion_rate || 0,
    open_rate: extractedData.open_rate || 0,
    click_rate: extractedData.click_rate || 0,
    report_rate: extractedData.report_rate || 0,
    users_who_opened: extractedData.users_who_opened || [],
    users_who_clicked: extractedData.users_who_clicked || [],
    users_who_reported: extractedData.users_who_reported || [],
    campaigns: extractedData.campaigns || [],
  };
}

const LLM_SCHEMA = {
  type: "object",
  properties: {
    customer_name: { type: "string" },
    campaign_name: { type: "string" },
    report_period_start: { type: "string" },
    report_period_end: { type: "string" },
    report_date: { type: "string" },
    total_campaigns: { type: "number" },
    total_emails_sent: { type: "number" },
    total_opened: { type: "number" },
    total_clicked: { type: "number" },
    total_reported: { type: "number" },
    total_submitted_data: { type: "number" },
    phish_prone_percentage: { type: "number" },
    training_completion_rate: { type: "number" },
    open_rate: { type: "number" },
    click_rate: { type: "number" },
    report_rate: { type: "number" },
    users_who_opened: { type: "array", items: { type: "object", properties: { name: { type: "string" }, email: { type: "string" } } } },
    users_who_clicked: { type: "array", items: { type: "object", properties: { name: { type: "string" }, email: { type: "string" }, clicks: { type: "number" } } } },
    users_who_reported: { type: "array", items: { type: "object", properties: { name: { type: "string" }, email: { type: "string" } } } },
    campaigns: { type: "array", items: { type: "object", properties: { name: { type: "string" }, template: { type: "string" }, start_date: { type: "string" }, close_date: { type: "string" }, emails_sent: { type: "number" }, opened: { type: "number" }, clicked: { type: "number" }, reported: { type: "number" } } } },
  },
};

const LLM_PROMPT = `Analyze this BullPhish ID phishing simulation report PDF and extract the following data.
Look for Campaign Results: Campaign Name, Start Date, Close Date, Report Date, Number of Targets.
Also extract: phish-prone %, open/click/report rates, user lists who opened/clicked/reported.
Convert all dates to YYYY-MM-DD format.`;

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function BullPhishIDConfig() {
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [reportDate, setReportDate] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedData, setExtractedData] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);

  const queryClient = useQueryClient();

  const { data: reports = [], isLoading: loadingReports } = useQuery({
    queryKey: ['bullphishid-reports'],
    queryFn: () => client.entities.BullPhishIDReport.list('-report_date', 100),
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => client.entities.Customer.list('name', 500),
  });

  // -- Derived data --------------------------------------------------------

  const customerNames = useMemo(() => {
    const map = {};
    for (const c of customers) { map[c.id] = c.name; }
    return map;
  }, [customers]);

  const uniqueCustomerIds = useMemo(
    () => new Set(reports.map(r => r.customer_id)),
    [reports],
  );

  const configStatus = reports.length > 0 ? CONNECTION_STATES.CONNECTED : CONNECTION_STATES.NOT_CONFIGURED;
  const statusDisplay = getConnectionStatusDisplay(configStatus);
  const mappedCount = reports.filter(r => r.customer_id).length;
  const unmappedCount = reports.length - mappedCount;

  // -- Filtering + pagination ----------------------------------------------

  const filteredReports = useMemo(() => {
    let rows = reports;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      rows = rows.filter(r =>
        (r.customer_name || '').toLowerCase().includes(q) ||
        getCampaignLabel(r).toLowerCase().includes(q),
      );
    }
    switch (filterTab) {
      case 'mapped': return rows.filter(r => r.customer_id);
      case 'unmapped': return rows.filter(r => !r.customer_id);
      default: return rows;
    }
  }, [reports, searchQuery, filterTab]);

  const totalPages = Math.max(1, Math.ceil(filteredReports.length / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedReports = filteredReports.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE);

  // -- Upload / extract handlers -------------------------------------------

  const autoFillCustomer = useCallback((data) => {
    if (!data.customer_name || selectedCustomer) return;
    const words = data.customer_name.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 1);
    let bestMatch = null;
    let bestScore = 0;
    for (const c of customers) {
      const cWords = c.name.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 1);
      const matching = words.filter(ew => cWords.some(cw => cw.includes(ew) || ew.includes(cw)));
      const score = matching.length / Math.max(words.length, 1);
      if (score > bestScore && score >= 0.4) { bestScore = score; bestMatch = c; }
    }
    if (!bestMatch) {
      const norm = data.customer_name.toLowerCase().replace(/[^a-z0-9]/g, '');
      bestMatch = customers.find(c => {
        const n = c.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        return n.includes(norm) || norm.includes(n);
      });
    }
    if (bestMatch) setSelectedCustomer(bestMatch.id);
  }, [customers, selectedCustomer]);

  const handleFileSelect = useCallback(async (e) => {
    const file = e.target.files[0];
    if (!file || file.type !== 'application/pdf') { toast.error('Please select a PDF file'); return; }
    setSelectedFile(file);
    setExtractedData(null);
    if (!reportDate) setReportDate(new Date().toISOString().split('T')[0]);

    setIsExtracting(true);
    try {
      const { file_url } = await client.integrations.Core.UploadFile({ file });
      const result = await client.integrations.Core.InvokeLLM({
        prompt: LLM_PROMPT, file_urls: [file_url], response_json_schema: LLM_SCHEMA,
      });
      if (result) {
        setExtractedData({ ...result, pdf_url: file_url });
        autoFillCustomer(result);
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
  }, [reportDate, autoFillCustomer]);

  const handleSaveReport = useCallback(async () => {
    if (!selectedCustomer || !reportDate) { toast.error('Please select a customer and report date'); return; }
    setIsUploading(true);
    try {
      const customer = customers.find(c => c.id === selectedCustomer);
      let pdfUrl = extractedData?.pdf_url;
      if (!pdfUrl && selectedFile) {
        const { file_url } = await client.integrations.Core.UploadFile({ file: selectedFile });
        pdfUrl = file_url;
      }
      await client.entities.BullPhishIDReport.create({
        customer_id: selectedCustomer,
        customer_name: customer?.name,
        report_date: reportDate,
        report_data: buildReportData(extractedData, periodStart, periodEnd),
        file_url: pdfUrl || null,
      });
      toast.success('Report saved successfully');
      queryClient.invalidateQueries({ queryKey: ['bullphishid-reports'] });
      resetForm();
    } catch (error) {
      toast.error(error.message || 'Failed to save report');
    } finally {
      setIsUploading(false);
    }
  }, [selectedCustomer, reportDate, customers, extractedData, selectedFile, periodStart, periodEnd, queryClient]);

  const resetForm = () => {
    setShowUploadModal(false);
    setSelectedCustomer('');
    setReportDate('');
    setPeriodStart('');
    setPeriodEnd('');
    setSelectedFile(null);
    setExtractedData(null);
  };

  const handleDeleteReport = useCallback(async (reportId) => {
    if (!confirm('Are you sure you want to delete this report?')) return;
    try {
      await client.entities.BullPhishIDReport.delete(reportId);
      toast.success('Report deleted');
      queryClient.invalidateQueries({ queryKey: ['bullphishid-reports'] });
    } catch (error) {
      toast.error(error.message || 'Failed to delete report');
    }
  }, [queryClient]);

  // -- Render --------------------------------------------------------------

  return (
    <div className="space-y-3">
      <IntegrationHeader
        statusDisplay={statusDisplay}
        integrationName="BullPhish ID"
        hasData={reports.length > 0}
        mappedCount={uniqueCustomerIds.size}
        totalCount={reports.length}
      >
        <Button size="sm" variant="outline" onClick={() => setShowUploadModal(true)} className="h-7 text-xs px-2.5">
          <Upload className="w-3 h-3 mr-1" />
          Upload Report
        </Button>
      </IntegrationHeader>

      <FilterBar
        filterTab={filterTab}
        setFilterTab={setFilterTab}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        totalCount={reports.length}
        mappedCount={mappedCount}
        unmappedCount={unmappedCount}
        staleCount={0}
        onPageReset={() => setCurrentPage(1)}
        searchPlaceholder="Search campaigns or customers..."
      />

      {reports.length === 0 && !loadingReports ? (
        <div className="text-center py-10 text-sm text-slate-500 border border-slate-200 rounded-lg">
          No reports uploaded yet. Click <strong>Upload Report</strong> to get started.
        </div>
      ) : (
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-3 py-2 w-10" />
                  <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-3 py-2">Campaign / Customer</th>
                  <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-3 py-2 w-20">Emails Sent</th>
                  <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-3 py-2">Customer</th>
                  <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-3 py-2 w-24">Report Date</th>
                  <th className="text-right text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-3 py-2 w-20" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loadingReports ? (
                  <tr><td colSpan={6} className="text-center py-8"><RefreshCw className="w-4 h-4 animate-spin mx-auto text-slate-400" /></td></tr>
                ) : paginatedReports.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-6 text-xs text-slate-400">No reports match the current filter.</td></tr>
                ) : (
                  paginatedReports.map((report, idx) => (
                    <ReportRow
                      key={report.id}
                      report={report}
                      customerName={customerNames[report.customer_id] || report.customer_name}
                      onDelete={() => handleDeleteReport(report.id)}
                      isOdd={idx % 2 === 1}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
          {filteredReports.length > ITEMS_PER_PAGE && (
            <TablePagination page={safePage} totalPages={totalPages} totalItems={filteredReports.length} perPage={ITEMS_PER_PAGE} onPageChange={setCurrentPage} />
          )}
        </div>
      )}

      <BullPhishUploadModal
        open={showUploadModal}
        onOpenChange={setShowUploadModal}
        customers={customers}
        selectedCustomer={selectedCustomer}
        setSelectedCustomer={setSelectedCustomer}
        reportDate={reportDate}
        setReportDate={setReportDate}
        periodStart={periodStart}
        setPeriodStart={setPeriodStart}
        periodEnd={periodEnd}
        setPeriodEnd={setPeriodEnd}
        selectedFile={selectedFile}
        handleFileSelect={handleFileSelect}
        onClearFile={() => { setSelectedFile(null); setExtractedData(null); }}
        isExtracting={isExtracting}
        extractedData={extractedData}
        isUploading={isUploading}
        onSave={handleSaveReport}
        onCancel={resetForm}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Report Table Row
// ---------------------------------------------------------------------------

function ReportRow({ report, customerName, onDelete, isOdd }) {
  const d = report.report_data || {};
  const statusDot = getReportStatusDot(report);
  const campaignLabel = getCampaignLabel(report);
  const emailsSent = d.total_emails_sent || 0;

  return (
    <tr className={cn("transition-colors", isOdd ? "bg-slate-50/40" : "bg-white", "hover:bg-slate-100/60")}>
      <td className="px-3 py-2 text-center">
        <div className={cn("w-2 h-2 rounded-full mx-auto", statusDot)} />
      </td>
      <td className="px-3 py-2">
        <span className="text-sm font-medium text-slate-900">{campaignLabel}</span>
        {(d.phish_prone_percentage != null && d.phish_prone_percentage > 0) && (
          <span className={cn(
            "ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded-full",
            d.phish_prone_percentage > 20 ? "bg-red-100 text-red-700" : d.phish_prone_percentage > 10 ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700",
          )}>
            {d.phish_prone_percentage}% phish-prone
          </span>
        )}
      </td>
      <td className="px-3 py-2">
        <span className="text-xs text-slate-500">{emailsSent > 0 ? emailsSent : '--'}</span>
      </td>
      <td className="px-3 py-2">
        <span className="text-sm text-slate-800">{customerName}</span>
      </td>
      <td className="px-3 py-2">
        <span className="text-[11px] text-slate-500">
          {report.report_date ? format(new Date(report.report_date), 'MMM d, yyyy') : 'N/A'}
        </span>
      </td>
      <td className="px-3 py-2 text-right">
        <div className="flex items-center justify-end gap-1">
          {report.file_url && (
            <button type="button" onClick={() => window.open(report.file_url, '_blank')} className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded" title="View PDF">
              <Eye className="w-3.5 h-3.5" />
            </button>
          )}
          <button type="button" onClick={onDelete} className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded" title="Delete report">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}
