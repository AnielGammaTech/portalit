import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
import { 
  Shield, 
  Plus, 
  Trash2, 
  Upload,
  FileText,
  Building2,
  Calendar,
  Eye,
  Loader2,
  AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function DarkWebIDConfig() {
  const [showUploadModal, setShowUploadModal] = useState(false);
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
    queryKey: ['darkwebid-reports'],
    queryFn: () => client.entities.DarkWebIDReport.list('-report_date', 100),
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
        prompt: `Analyze this Dark Web ID / Dark Web monitoring report PDF and extract the following data.
        
Look carefully for:
- Organization/Customer name
- Report date and reporting period
- Total number of compromises/breaches found
- Number of new compromises since last report
- Severity breakdown (critical, high, medium, low)
- List of compromised email addresses
- Breach sources/databases where credentials were found
- Individual compromise details (email, password if shown, breach source, date)

Convert all dates to YYYY-MM-DD format.`,
        file_urls: [file_url],
        response_json_schema: {
          type: "object",
          properties: {
            customer_name: { type: "string", description: "Customer/organization name from the report" },
            report_date: { type: "string", description: "Report date converted to YYYY-MM-DD format" },
            report_period_start: { type: "string", description: "Report period start date YYYY-MM-DD" },
            report_period_end: { type: "string", description: "Report period end date YYYY-MM-DD" },
            total_compromises: { type: "number", description: "Total compromises found" },
            new_compromises: { type: "number", description: "New compromises since last report" },
            critical_count: { type: "number", description: "Number of critical severity" },
            high_count: { type: "number", description: "Number of high severity" },
            medium_count: { type: "number", description: "Number of medium severity" },
            low_count: { type: "number", description: "Number of low severity" },
            compromised_emails: { 
              type: "array", 
              items: { type: "string" },
              description: "List of compromised email addresses"
            },
            breach_sources: { 
              type: "array", 
              items: { type: "string" },
              description: "List of breach sources/databases"
            },
            compromises_detail: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  email: { type: "string" },
                  password: { type: "string", description: "Password if visible (may be partial/masked)" },
                  source: { type: "string", description: "Breach source" },
                  breach_date: { type: "string" },
                  severity: { type: "string", enum: ["critical", "high", "medium", "low"] }
                }
              }
            }
          }
        }
      });

      if (result) {
        setExtractedData({ ...result, pdf_url: file_url });
        
        if (result.customer_name && !selectedCustomer) {
          const matchedCustomer = customers.find(c => {
            const normalizedCustomerName = c.name.toLowerCase().replace(/[^a-z0-9]/g, '');
            const normalizedExtracted = result.customer_name.toLowerCase().replace(/[^a-z0-9]/g, '');
            return normalizedCustomerName.includes(normalizedExtracted) || 
                   normalizedExtracted.includes(normalizedCustomerName);
          });
          if (matchedCustomer) {
            setSelectedCustomer(matchedCustomer.id);
          }
        }
        
        if (result.report_period_start) setPeriodStart(result.report_period_start);
        if (result.report_period_end) setPeriodEnd(result.report_period_end);
        if (result.report_date) setReportDate(result.report_date);
        
        toast.success('Data extracted from PDF');
      }
    } catch (error) {
      toast.error(error.message);
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

      await client.entities.DarkWebIDReport.create({
        customer_id: selectedCustomer,
        customer_name: customer?.name,
        report_date: reportDate,
        report_period_start: periodStart || null,
        report_period_end: periodEnd || null,
        pdf_url: pdfUrl,
        total_compromises: extractedData?.total_compromises || 0,
        new_compromises: extractedData?.new_compromises || 0,
        critical_count: extractedData?.critical_count || 0,
        high_count: extractedData?.high_count || 0,
        medium_count: extractedData?.medium_count || 0,
        low_count: extractedData?.low_count || 0,
        compromised_emails: extractedData?.compromised_emails ? JSON.stringify(extractedData.compromised_emails) : null,
        breach_sources: extractedData?.breach_sources ? JSON.stringify(extractedData.breach_sources) : null,
        compromises_detail: extractedData?.compromises_detail ? JSON.stringify(extractedData.compromises_detail) : null
      });

      toast.success('Report saved successfully');
      queryClient.invalidateQueries({ queryKey: ['darkwebid-reports'] });
      resetForm();
    } catch (error) {
      toast.error(error.message);
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
      await client.entities.DarkWebIDReport.delete(reportId);
      toast.success('Report deleted');
      queryClient.invalidateQueries({ queryKey: ['darkwebid-reports'] });
    } catch (error) {
      toast.error(error.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
            <Shield className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">Dark Web ID</h3>
            <p className="text-sm text-slate-500">Upload dark web monitoring reports for QBR tracking</p>
          </div>
        </div>
        <Button onClick={() => setShowUploadModal(true)}>
          <Upload className="w-4 h-4 mr-2" />
          Upload Report
        </Button>
      </div>

      {/* Info Banner */}
      <div className="bg-red-50 border border-red-200 rounded-xl p-4">
        <p className="text-sm text-red-800">
          <strong>Note:</strong> Export your Dark Web ID reports as PDF and upload them here. 
          The system will extract key metrics automatically for QBR reporting and customer visibility.
        </p>
      </div>

      {/* Reports Table */}
      <div className="bg-white rounded-xl border border-slate-200">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>Report Date</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Critical</TableHead>
              <TableHead>High</TableHead>
              <TableHead>New</TableHead>
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
                  <Shield className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-slate-500">No reports uploaded yet</p>
                  <p className="text-sm text-slate-400">Upload a Dark Web ID report to get started</p>
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
                    <Badge variant="outline">
                      {report.total_compromises || 0}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {report.critical_count > 0 ? (
                      <Badge variant="destructive">{report.critical_count}</Badge>
                    ) : (
                      <span className="text-slate-400">0</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {report.high_count > 0 ? (
                      <Badge className="bg-orange-100 text-orange-700">{report.high_count}</Badge>
                    ) : (
                      <span className="text-slate-400">0</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {report.new_compromises > 0 ? (
                      <span className="text-red-600 font-medium">+{report.new_compromises}</span>
                    ) : (
                      <span className="text-emerald-600">0</span>
                    )}
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
              <Upload className="w-5 h-5 text-red-600" />
              Upload Dark Web ID Report
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
                    <FileText className="w-5 h-5 text-red-600" />
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
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 max-h-48 overflow-y-auto">
                <p className="text-sm font-medium text-red-800 mb-2">Extracted Data:</p>
                <div className="grid grid-cols-3 gap-x-4 gap-y-1 text-xs">
                  <div>Total: <strong>{extractedData.total_compromises || 0}</strong></div>
                  <div>New: <strong className="text-red-600">+{extractedData.new_compromises || 0}</strong></div>
                  <div>Critical: <strong className="text-red-600">{extractedData.critical_count || 0}</strong></div>
                  <div>High: <strong className="text-orange-600">{extractedData.high_count || 0}</strong></div>
                  <div>Medium: <strong className="text-yellow-600">{extractedData.medium_count || 0}</strong></div>
                  <div>Low: <strong>{extractedData.low_count || 0}</strong></div>
                </div>
                {extractedData.compromised_emails?.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-red-200">
                    <p className="text-xs text-red-700 font-medium">Compromised emails: {extractedData.compromised_emails.length}</p>
                  </div>
                )}
                {extractedData.breach_sources?.length > 0 && (
                  <p className="text-xs text-red-700">Breach sources: {extractedData.breach_sources.length}</p>
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