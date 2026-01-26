import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
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
  Fish, 
  Plus, 
  Trash2, 
  Upload,
  FileText,
  Building2,
  Calendar,
  Eye,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

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
  const queryClient = useQueryClient();

  const { data: reports = [], isLoading: loadingReports } = useQuery({
    queryKey: ['bullphishid-reports'],
    queryFn: () => base44.entities.BullPhishIDReport.list('-report_date', 100),
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list('name', 500),
  });

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file);
      setExtractedData(null);
      
      // Try to auto-fill from filename
      // Example: CURRAN_YOUNG_CONSTRUCTION,_LLC_Campaign_Gamma_Tech-2025_2026-01-26T10_15_37-05_00.pdf
      const filename = file.name.replace('.pdf', '');
      
      // Try to extract customer name (before _Campaign or before date pattern)
      const campaignMatch = filename.match(/^(.+?)_Campaign/i);
      const dateMatch = filename.match(/(\d{4}[-_]\d{2}[-_]\d{2})/);
      
      if (campaignMatch) {
        const customerNameFromFile = campaignMatch[1]
          .replace(/_/g, ' ')
          .replace(/,\s*/g, ', ')
          .trim();
        
        // Try to find matching customer
        const matchedCustomer = customers.find(c => {
          const normalizedCustomerName = c.name.toLowerCase().replace(/[^a-z0-9]/g, '');
          const normalizedFileName = customerNameFromFile.toLowerCase().replace(/[^a-z0-9]/g, '');
          return normalizedCustomerName.includes(normalizedFileName) || 
                 normalizedFileName.includes(normalizedCustomerName);
        });
        
        if (matchedCustomer) {
          setSelectedCustomer(matchedCustomer.id);
        }
      }
      
      // Try to extract date from filename
      if (dateMatch) {
        const dateStr = dateMatch[1].replace(/_/g, '-');
        setReportDate(dateStr);
      } else {
        // Default to today
        setReportDate(new Date().toISOString().split('T')[0]);
      }
    } else {
      toast.error('Please select a PDF file');
    }
  };

  const handleExtractData = async () => {
    if (!selectedFile) return;
    
    setIsExtracting(true);
    try {
      // Upload the file first
      const { file_url } = await base44.integrations.Core.UploadFile({ file: selectedFile });
      
      // Extract data from the PDF
      const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url,
        json_schema: {
          type: "object",
          properties: {
            customer_name: { type: "string", description: "Customer/organization name from the report" },
            report_period_start: { type: "string", description: "Report period start date in YYYY-MM-DD format" },
            report_period_end: { type: "string", description: "Report period end date in YYYY-MM-DD format" },
            total_campaigns: { type: "number", description: "Total number of phishing campaigns" },
            total_emails_sent: { type: "number", description: "Total phishing emails sent" },
            total_opened: { type: "number", description: "Total emails opened by recipients" },
            total_clicked: { type: "number", description: "Total links clicked (users who failed the test)" },
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
              },
              description: "List of users who opened the phishing emails" 
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
              },
              description: "Users who clicked on phishing links" 
            },
            users_who_reported: { 
              type: "array", 
              items: { 
                type: "object",
                properties: {
                  name: { type: "string" },
                  email: { type: "string" }
                }
              },
              description: "Users who correctly reported the phishing email" 
            },
            campaigns: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  template: { type: "string" },
                  date: { type: "string" },
                  emails_sent: { type: "number" },
                  opened: { type: "number" },
                  clicked: { type: "number" },
                  reported: { type: "number" },
                  submitted_data: { type: "number" }
                }
              },
              description: "Individual campaign results"
            }
          }
        }
      });

      if (result.status === 'success') {
        const data = result.output;
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
        if (data.report_period_start && !periodStart) {
          setPeriodStart(data.report_period_start);
        }
        if (data.report_period_end && !periodEnd) {
          setPeriodEnd(data.report_period_end);
        }
        
        toast.success('Data extracted from PDF');
      } else {
        toast.error(result.details || 'Failed to extract data');
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
      
      // If no extracted data, just upload the PDF
      let pdfUrl = extractedData?.pdf_url;
      if (!pdfUrl && selectedFile) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file: selectedFile });
        pdfUrl = file_url;
      }

      await base44.entities.BullPhishIDReport.create({
        customer_id: selectedCustomer,
        customer_name: customer?.name,
        report_date: reportDate,
        report_period_start: periodStart || null,
        report_period_end: periodEnd || null,
        pdf_url: pdfUrl,
        total_campaigns: extractedData?.total_campaigns || 0,
        total_emails_sent: extractedData?.total_emails_sent || 0,
        total_opened: extractedData?.total_opened || 0,
        total_clicked: extractedData?.total_clicked || 0,
        total_reported: extractedData?.total_reported || 0,
        total_submitted_data: extractedData?.total_submitted_data || 0,
        phish_prone_percentage: extractedData?.phish_prone_percentage || 0,
        training_completion_rate: extractedData?.training_completion_rate || 0,
        open_rate: extractedData?.open_rate || 0,
        click_rate: extractedData?.click_rate || 0,
        report_rate: extractedData?.report_rate || 0,
        users_who_opened: extractedData?.users_who_opened ? JSON.stringify(extractedData.users_who_opened) : null,
        users_who_clicked: extractedData?.users_who_clicked ? JSON.stringify(extractedData.users_who_clicked) : null,
        users_who_reported: extractedData?.users_who_reported ? JSON.stringify(extractedData.users_who_reported) : null,
        campaign_details: extractedData?.campaigns ? JSON.stringify(extractedData.campaigns) : null
      });

      toast.success('Report saved successfully');
      queryClient.invalidateQueries({ queryKey: ['bullphishid-reports'] });
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
      await base44.entities.BullPhishIDReport.delete(reportId);
      toast.success('Report deleted');
      queryClient.invalidateQueries({ queryKey: ['bullphishid-reports'] });
    } catch (error) {
      toast.error(error.message);
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
                    <Badge variant={report.phish_prone_percentage > 20 ? "destructive" : report.phish_prone_percentage > 10 ? "outline" : "default"}>
                      {report.phish_prone_percentage}%
                    </Badge>
                  </TableCell>
                  <TableCell>{report.total_emails_sent?.toLocaleString() || 0}</TableCell>
                  <TableCell>
                    <span className="text-red-600 font-medium">{report.total_clicked || 0}</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={report.training_completion_rate >= 90 ? "default" : "outline"}>
                      {report.training_completion_rate}%
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-orange-600" />
              Upload BullPhish ID Report
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <Label>Customer</Label>
              <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Select customer..." />
                </SelectTrigger>
                <SelectContent>
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
                    <FileText className="w-5 h-5 text-orange-600" />
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

            {selectedFile && !extractedData && (
              <Button 
                variant="outline" 
                className="w-full"
                onClick={handleExtractData}
                disabled={isExtracting}
              >
                {isExtracting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Extracting data...
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4 mr-2" />
                    Extract Data from PDF
                  </>
                )}
              </Button>
            )}

            {extractedData && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 max-h-48 overflow-y-auto">
                <p className="text-sm font-medium text-green-800 mb-2">Extracted Data:</p>
                <div className="grid grid-cols-3 gap-x-4 gap-y-1 text-xs">
                  <div>Campaigns: <strong>{extractedData.total_campaigns || 0}</strong></div>
                  <div>Emails Sent: <strong>{extractedData.total_emails_sent || 0}</strong></div>
                  <div>Opened: <strong>{extractedData.total_opened || 0}</strong></div>
                  <div>Clicked: <strong className="text-red-600">{extractedData.total_clicked || 0}</strong></div>
                  <div>Reported: <strong className="text-green-600">{extractedData.total_reported || 0}</strong></div>
                  <div>Submitted Data: <strong className="text-red-600">{extractedData.total_submitted_data || 0}</strong></div>
                  <div>Phish-Prone: <strong>{extractedData.phish_prone_percentage || 0}%</strong></div>
                  <div>Open Rate: <strong>{extractedData.open_rate || 0}%</strong></div>
                  <div>Click Rate: <strong>{extractedData.click_rate || 0}%</strong></div>
                </div>
                {extractedData.users_who_clicked?.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-green-200">
                    <p className="text-xs text-green-700 font-medium">Users who clicked: {extractedData.users_who_clicked.length}</p>
                  </div>
                )}
                {extractedData.users_who_opened?.length > 0 && (
                  <p className="text-xs text-green-700">Users who opened: {extractedData.users_who_opened.length}</p>
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