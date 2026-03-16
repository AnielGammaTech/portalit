import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { client } from '@/api/client';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Fish,
  Plus,
  Trash2,
  Upload,
  FileText,
  Building2,
  Calendar,
  Eye,
  Loader2,
  XCircle,
  ChevronDown
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from "@/lib/utils";

export default function BullPhishIDConfig() {
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
  const queryClient = useQueryClient();

  const { data: reports = [], isLoading: loadingReports } = useQuery({
    queryKey: ['bullphishid-reports'],
    queryFn: () => client.entities.BullPhishIDReport.list('-report_date', 100),
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => client.entities.Customer.list('name', 500),
  });

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file);
      setExtractedData(null);
      
      // Default to today if no date
      if (!reportDate) {
        setReportDate(new Date().toISOString().split('T')[0]);
      }
      
      // Automatically start extraction
      await extractDataFromFile(file);
    } else {
      toast.error('Please select a PDF file');
    }
  };

  const extractDataFromFile = async (file) => {
    setIsExtracting(true);
    try {
      // Upload the file first
      const { file_url } = await client.integrations.Core.UploadFile({ file });
      
      // Use AI to inspect and extract data from the PDF
      const result = await client.integrations.Core.InvokeLLM({
        prompt: `Analyze this BullPhish ID phishing simulation report PDF and extract the following data. 
        
Look carefully for these specific fields in the Campaign Results section:
- Campaign Name (e.g. "Campaign Gamma Tech 2025")
- Start Date (the campaign start date, e.g. "November 8th, 2025")
- Close Date (the campaign end/close date, e.g. "December 11th, 2025") 
- Report Date (when report was generated)
- Number of Targets (total emails sent)

Also look for statistics like:
- Phish-prone percentage
- Open rate, click rate, report rate
- Number of users who opened, clicked, reported
- Individual user names/emails who clicked or opened

Convert all dates to YYYY-MM-DD format.`,
        file_urls: [file_url],
        response_json_schema: {
          type: "object",
          properties: {
            customer_name: { type: "string", description: "Customer/organization name from the report or campaign name" },
            campaign_name: { type: "string", description: "Campaign Name field value" },
            report_period_start: { type: "string", description: "Start Date converted to YYYY-MM-DD format" },
            report_period_end: { type: "string", description: "Close Date converted to YYYY-MM-DD format" },
            report_date: { type: "string", description: "Report Date converted to YYYY-MM-DD format" },
            total_campaigns: { type: "number", description: "Total number of phishing campaigns (usually 1)" },
            total_emails_sent: { type: "number", description: "Number of Targets or total emails sent" },
            total_opened: { type: "number", description: "Total emails opened by recipients" },
            total_clicked: { type: "number", description: "Total links clicked (users who failed)" },
            total_reported: { type: "number", description: "Total phishing emails reported by users" },
            total_submitted_data: { type: "number", description: "Total users who submitted data/credentials" },
            phish_prone_percentage: { type: "number", description: "Overall phish-prone percentage" },
            training_completion_rate: { type: "number", description: "Training completion percentage" },
            open_rate: { type: "number", description: "Email open rate percentage" },
            click_rate: { type: "number", description: "Click rate percentage" },
            report_rate: { type: "number", description: "Report rate percentage" },
            users_who_opened: { 
              type: "array", 
              items: { 
                type: "object",
                properties: {
                  name: { type: "string" },
                  email: { type: "string" }
                }
              }
            },
            users_who_clicked: { 
              type: "array", 
              items: { 
                type: "object",
                properties: {
                  name: { type: "string" },
                  email: { type: "string" },
                  clicks: { type: "number" }
                }
              }
            },
            users_who_reported: { 
              type: "array", 
              items: { 
                type: "object",
                properties: {
                  name: { type: "string" },
                  email: { type: "string" }
                }
              }
            },
            campaigns: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  template: { type: "string" },
                  start_date: { type: "string" },
                  close_date: { type: "string" },
                  emails_sent: { type: "number" },
                  opened: { type: "number" },
                  clicked: { type: "number" },
                  reported: { type: "number" }
                }
              }
            }
          }
        }
      });

      if (result) {
        const data = result;
        setExtractedData({ ...data, pdf_url: file_url });
        
        // Auto-fill customer from extracted name if not already selected
        if (data.customer_name && !selectedCustomer) {
          const matchedCustomer = customers.find(c => {
            const normalizedCustomerName = c.name.toLowerCase().replace(/[^a-z0-9]/g, '');
            const normalizedExtracted = data.customer_name.toLowerCase().replace(/[^a-z0-9]/g, '');
            return normalizedCustomerName.includes(normalizedExtracted) || 
                   normalizedExtracted.includes(normalizedCustomerName);
          });
          if (matchedCustomer) {
            setSelectedCustomer(matchedCustomer.id);
          }
        }
        
        // Auto-fill dates from extracted data
        if (data.report_period_start) {
          setPeriodStart(data.report_period_start);
        }
        if (data.report_period_end) {
          setPeriodEnd(data.report_period_end);
        }
        if (data.report_date) {
          setReportDate(data.report_date);
        }
        
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
      
      // If no extracted data, just upload the PDF
      let pdfUrl = extractedData?.pdf_url;
      if (!pdfUrl && selectedFile) {
        const { file_url } = await client.integrations.Core.UploadFile({ file: selectedFile });
        pdfUrl = file_url;
      }

      // The table stores extracted metrics inside a single `report_data` JSONB column.
      const reportData = extractedData
        ? {
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
          }
        : {
            report_period_start: periodStart || null,
            report_period_end: periodEnd || null,
          };

      await client.entities.BullPhishIDReport.create({
        customer_id: selectedCustomer,
        customer_name: customer?.name,
        report_date: reportDate,
        report_data: reportData,
        file_url: pdfUrl || null,
      });

      toast.success('Report saved successfully');
      setErrorDetails(null);
      queryClient.invalidateQueries({ queryKey: ['bullphishid-reports'] });
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
  };

  const handleDeleteReport = async (reportId) => {
    if (!confirm('Are you sure you want to delete this report?')) return;
    try {
      await client.entities.BullPhishIDReport.delete(reportId);
      toast.success('Report deleted');
      queryClient.invalidateQueries({ queryKey: ['bullphishid-reports'] });
    } catch (error) {
      toast.error(error.message || 'Failed to delete report');
    }
  };

  // Group reports by customer for display
  const reportsByCustomer = reports.reduce((acc, report) => {
    if (!acc[report.customer_id]) {
      acc[report.customer_id] = {
        customer_name: report.customer_name,
        reports: []
      };
    }
    acc[report.customer_id].reports.push(report);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Error Details (collapsible) */}
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

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
            <Fish className="w-5 h-5 text-orange-600" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">BullPhish ID</h3>
            <p className="text-sm text-slate-500">Upload phishing simulation reports for QBR tracking</p>
          </div>
        </div>
        <Button onClick={() => setShowUploadModal(true)}>
          <Upload className="w-4 h-4 mr-2" />
          Upload Report
        </Button>
      </div>

      {/* Info Banner */}
      <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
        <p className="text-sm text-orange-800">
          <strong>Note:</strong> BullPhish ID doesn't support API access. Export your reports as PDF from BullPhish ID and upload them here. 
          The system will extract key metrics automatically for QBR reporting.
        </p>
      </div>

      {/* Reports Table */}
      <div className="bg-white rounded-xl border border-slate-200">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>Report Date</TableHead>
              <TableHead>Phish-Prone %</TableHead>
              <TableHead>Emails Sent</TableHead>
              <TableHead>Clicked</TableHead>
              <TableHead>Training %</TableHead>
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
                  <Fish className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-slate-500">No reports uploaded yet</p>
                  <p className="text-sm text-slate-400">Upload a BullPhish ID report to get started</p>
                </TableCell>
              </TableRow>
            ) : (
              reports.map(report => {
                const d = report.report_data || {};
                return (
                  <TableRow key={report.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-slate-400" />
                        <span className="font-medium">{report.customer_name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {format(new Date(report.report_date), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell>
                      <Badge variant={(d.phish_prone_percentage || 0) > 20 ? "destructive" : (d.phish_prone_percentage || 0) > 10 ? "outline" : "default"}>
                        {d.phish_prone_percentage || 0}%
                      </Badge>
                    </TableCell>
                    <TableCell>{(d.total_emails_sent || 0).toLocaleString()}</TableCell>
                    <TableCell>
                      <span className="text-red-600 font-medium">{d.total_clicked || 0}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={(d.training_completion_rate || 0) >= 90 ? "default" : "outline"}>
                        {d.training_completion_rate || 0}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {report.file_url && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => window.open(report.file_url, '_blank')}
                          >
                            <Eye className="w-3 h-3 mr-1" />
                            View
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => handleDeleteReport(report.id)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Upload Modal */}
      <Dialog open={showUploadModal} onOpenChange={setShowUploadModal}>
        <DialogContent className="max-w-2xl w-[92vw] p-0 overflow-hidden" style={{ zIndex: 9999 }}>
          {/* Header */}
          <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-5 text-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <Upload className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold">Upload BullPhish ID Report</h2>
                <p className="text-xs text-white/70">Upload a PDF and we'll extract the data automatically</p>
              </div>
            </div>
          </div>

          <div className="px-6 py-5 space-y-5">
            {/* Customer */}
            <div>
              <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Customer</Label>
              <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
                <SelectTrigger className="mt-1.5 h-10 rounded-lg">
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

            {/* Dates */}
            <div>
              <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Dates</Label>
              <div className="grid grid-cols-3 gap-3 mt-1.5">
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Report Date</p>
                  <Input
                    type="date"
                    value={reportDate}
                    onChange={(e) => setReportDate(e.target.value)}
                    className="h-9 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Period Start</p>
                  <Input
                    type="date"
                    value={periodStart}
                    onChange={(e) => setPeriodStart(e.target.value)}
                    className="h-9 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Period End</p>
                  <Input
                    type="date"
                    value={periodEnd}
                    onChange={(e) => setPeriodEnd(e.target.value)}
                    className="h-9 rounded-lg text-sm"
                  />
                </div>
              </div>
            </div>

            {/* PDF Upload */}
            <div>
              <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">PDF Report</Label>
              <div className="mt-1.5">
                {selectedFile ? (
                  <div className="flex items-center gap-3 rounded-xl border border-orange-200 bg-orange-50/50 px-4 py-3">
                    <div className="w-9 h-9 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0">
                      <FileText className="w-4.5 h-4.5 text-orange-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{selectedFile.name}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {(selectedFile.size / 1024).toFixed(0)} KB · PDF
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedFile(null);
                        setExtractedData(null);
                      }}
                      className="flex-shrink-0 rounded-lg p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="cursor-pointer block">
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 hover:border-orange-300 hover:bg-orange-50/30 py-8 transition-colors">
                      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                        <Upload className="w-5 h-5 text-slate-400" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-medium text-slate-600">Click to select PDF</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">or drag and drop your report</p>
                      </div>
                    </div>
                  </label>
                )}
              </div>
            </div>

            {/* Extracting spinner */}
            {isExtracting && (
              <div className="flex items-center gap-3 rounded-xl bg-blue-50 border border-blue-100 px-4 py-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-blue-800">Extracting data from PDF…</p>
                  <p className="text-[10px] text-blue-500 mt-0.5">This may take a few seconds</p>
                </div>
              </div>
            )}

            {/* Extracted Data */}
            {extractedData && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 overflow-hidden">
                <div className="px-4 py-2.5 bg-emerald-100/50 border-b border-emerald-200">
                  <p className="text-xs font-semibold text-emerald-800 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                    Data Extracted Successfully
                  </p>
                </div>
                <div className="p-4">
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'Campaigns', value: extractedData.total_campaigns || 0 },
                      { label: 'Emails Sent', value: extractedData.total_emails_sent || 0 },
                      { label: 'Opened', value: extractedData.total_opened || 0 },
                      { label: 'Clicked', value: extractedData.total_clicked || 0, danger: true },
                      { label: 'Reported', value: extractedData.total_reported || 0, success: true },
                      { label: 'Submitted Data', value: extractedData.total_submitted_data || 0, danger: true },
                      { label: 'Phish-Prone %', value: `${extractedData.phish_prone_percentage || 0}%` },
                      { label: 'Open Rate', value: `${extractedData.open_rate || 0}%` },
                      { label: 'Click Rate', value: `${extractedData.click_rate || 0}%` },
                    ].map((stat) => (
                      <div key={stat.label} className="bg-white rounded-lg px-3 py-2 border border-emerald-100">
                        <p className="text-[10px] text-slate-400 font-medium">{stat.label}</p>
                        <p className={cn(
                          'text-sm font-bold mt-0.5',
                          stat.danger ? 'text-red-600' : stat.success ? 'text-emerald-600' : 'text-slate-800'
                        )}>
                          {stat.value}
                        </p>
                      </div>
                    ))}
                  </div>
                  {(extractedData.users_who_clicked?.length > 0 || extractedData.users_who_opened?.length > 0) && (
                    <div className="flex gap-3 mt-3 pt-3 border-t border-emerald-100">
                      {extractedData.users_who_clicked?.length > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-[10px] font-semibold text-red-700">
                          {extractedData.users_who_clicked.length} clicked
                        </span>
                      )}
                      {extractedData.users_who_opened?.length > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-semibold text-amber-700">
                          {extractedData.users_who_opened.length} opened
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
            <Button variant="outline" onClick={resetForm} className="rounded-lg">
              Cancel
            </Button>
            <Button
              onClick={handleSaveReport}
              disabled={isUploading || !selectedCustomer || !reportDate}
              className="rounded-lg bg-orange-600 hover:bg-orange-700 text-white gap-2"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Save Report
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}