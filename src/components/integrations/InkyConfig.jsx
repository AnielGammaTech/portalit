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
  ShieldCheck
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from "@/lib/utils";

export default function InkyConfig() {
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
    queryKey: ['inky-reports'],
    queryFn: () => client.entities.InkyReport.list('-report_date', 100),
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

      if (!reportDate) {
        setReportDate(new Date().toISOString().split('T')[0]);
      }

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
- Customer/organization name
- Report date or period (start and end dates)
- Total number of protected users/mailboxes
- Total emails processed/scanned
- Total threats blocked (phishing, spam, malware, impersonation/BEC)
- Breakdown by threat category (phishing, spam, malware, impersonation, etc.)
- Threat rate (percentage of emails that were threats)
- Top targeted users (name, email, threat count)

Convert all dates to YYYY-MM-DD format.
If a field is not found in the report, use 0 for numbers and null for strings.`,
        file_urls: [file_url],
        response_json_schema: {
          type: "object",
          properties: {
            customer_name: { type: "string", description: "Customer/organization name from the report" },
            report_date: { type: "string", description: "Report date in YYYY-MM-DD format" },
            report_period_start: { type: "string", description: "Report period start in YYYY-MM-DD format" },
            report_period_end: { type: "string", description: "Report period end in YYYY-MM-DD format" },
            total_users: { type: "number", description: "Total protected users or mailboxes" },
            total_emails_processed: { type: "number", description: "Total emails processed/scanned" },
            total_threats_blocked: { type: "number", description: "Total threats blocked across all categories" },
            total_phishing_blocked: { type: "number", description: "Phishing emails blocked" },
            total_spam_blocked: { type: "number", description: "Spam emails blocked" },
            total_malware_blocked: { type: "number", description: "Malware emails blocked" },
            total_impersonation_blocked: { type: "number", description: "Impersonation/BEC attempts blocked" },
            threat_rate: { type: "number", description: "Percentage of emails that were threats" },
            threat_categories: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  category: { type: "string" },
                  count: { type: "number" },
                  percentage: { type: "number" }
                }
              }
            },
            top_targeted_users: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  email: { type: "string" },
                  threat_count: { type: "number" }
                }
              }
            }
          }
        }
      });

      if (result) {
        const data = result;
        setExtractedData({ ...data, pdf_url: file_url });

        // Auto-fill customer from extracted name
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

        // Auto-fill dates
        if (data.report_period_start) setPeriodStart(data.report_period_start);
        if (data.report_period_end) setPeriodEnd(data.report_period_end);
        if (data.report_date) setReportDate(data.report_date);

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

      let pdfUrl = extractedData?.pdf_url;
      if (!pdfUrl && selectedFile) {
        const { file_url } = await client.integrations.Core.UploadFile({ file: selectedFile });
        pdfUrl = file_url;
      }

      await client.entities.InkyReport.create({
        customer_id: selectedCustomer,
        customer_name: customer?.name,
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

      toast.success('Report saved successfully');
      setErrorDetails(null);
      queryClient.invalidateQueries({ queryKey: ['inky-reports'] });
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
      await client.entities.InkyReport.delete(reportId);
      toast.success('Report deleted');
      queryClient.invalidateQueries({ queryKey: ['inky-reports'] });
    } catch (error) {
      toast.error(error.message || 'Failed to delete report');
    }
  };

  return (
    <div className="space-y-6">
      {/* Error Details */}
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
          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">Inky</h3>
            <p className="text-sm text-slate-500">Upload email protection reports for QBR tracking</p>
          </div>
        </div>
        <Button onClick={() => setShowUploadModal(true)}>
          <Upload className="w-4 h-4 mr-2" />
          Upload Report
        </Button>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-sm text-blue-800">
          <strong>Note:</strong> Inky doesn't have a public API. Export your reports as PDF from Inky and upload them here.
          The system will use AI to extract key metrics automatically for QBR reporting.
        </p>
      </div>

      {/* Reports Table */}
      <div className="bg-white rounded-xl border border-slate-200">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>Report Date</TableHead>
              <TableHead>Users</TableHead>
              <TableHead>Emails</TableHead>
              <TableHead>Threats Blocked</TableHead>
              <TableHead>Threat Rate</TableHead>
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
                  <ShieldCheck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-slate-500">No reports uploaded yet</p>
                  <p className="text-sm text-slate-400">Upload an Inky report to get started</p>
                </TableCell>
              </TableRow>
            ) : (
              reports.map(report => (
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
                    <Badge variant="outline">{report.total_users || 0}</Badge>
                  </TableCell>
                  <TableCell>{(report.total_emails_processed || 0).toLocaleString()}</TableCell>
                  <TableCell>
                    <span className="text-blue-600 font-medium">{(report.total_threats_blocked || 0).toLocaleString()}</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={report.threat_rate > 5 ? "destructive" : report.threat_rate > 2 ? "outline" : "default"}>
                      {report.threat_rate || 0}%
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {report.pdf_url && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(report.pdf_url, '_blank')}
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
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Upload Modal */}
      <Dialog open={showUploadModal} onOpenChange={setShowUploadModal}>
        <DialogContent className="max-w-lg" style={{ zIndex: 9999 }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-blue-600" />
              Upload Inky Report
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
                <Input
                  type="date"
                  value={reportDate}
                  onChange={(e) => setReportDate(e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label>Period Start</Label>
                <Input
                  type="date"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label>Period End</Label>
                <Input
                  type="date"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                  className="mt-1.5"
                />
              </div>
            </div>

            <div>
              <Label>PDF Report</Label>
              <div className="mt-1.5 border-2 border-dashed border-slate-200 rounded-lg p-4 text-center">
                {selectedFile ? (
                  <div className="flex items-center justify-center gap-2">
                    <FileText className="w-5 h-5 text-blue-600" />
                    <span className="text-sm font-medium">{selectedFile.name}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setSelectedFile(null);
                        setExtractedData(null);
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                ) : (
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
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
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 max-h-48 overflow-y-auto">
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
                {extractedData.top_targeted_users?.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-green-200">
                    <p className="text-xs text-green-700 font-medium">Top targeted users: {extractedData.top_targeted_users.length}</p>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={resetForm}>
                Cancel
              </Button>
              <Button onClick={handleSaveReport} disabled={isUploading || !selectedCustomer || !reportDate}>
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Save Report
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
