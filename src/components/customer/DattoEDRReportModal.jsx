import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Shield, 
  FileText,
  Download,
  Loader2,
  CheckCircle2,
  Clock,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import { client } from '@/api/client';

export default function DattoEDRReportModal({ open, onOpenChange, edrData, tenantName, customerName, customerId }) {
  const [generating, setGenerating] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [reportGenerated, setReportGenerated] = useState(null);
  const [checkingStatus, setCheckingStatus] = useState(false);
  
  // Default to last 3 months
  const defaultEndDate = new Date().toISOString().split('T')[0];
  const defaultStartDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  const [reportName, setReportName] = useState(`${customerName || tenantName || 'Customer'} - EDR Report`);
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(defaultEndDate);

  // Poll for report status when generated
  useEffect(() => {
    if (!reportGenerated || reportGenerated.status === 'complete') return;
    
    const interval = setInterval(async () => {
      try {
        const response = await client.functions.invoke('syncDattoEDR', {
          action: 'check_report_status',
          report_id: reportGenerated.id
        });
        
        if (response.success && response.report) {
          setReportGenerated(response.report);
          if (response.report.status === 'complete') {
            toast.success('Report is ready for download!');
          }
        }
      } catch (error) {
        console.error('Status check error:', error);
      }
    }, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
  }, [reportGenerated]);

  const handleGenerateReport = async () => {
    setGenerating(true);
    setReportGenerated(null);
    
    try {
      const response = await client.functions.invoke('syncDattoEDR', {
        action: 'generate_report',
        customer_id: customerId,
        report_name: reportName,
        report_type: 'executiveThreat',
        start_date: startDate,
        end_date: endDate
      });

      if (response.success) {
        setReportGenerated(response.report);
        toast.success('Report generation started!');
      } else {
        toast.error(response.error || 'Failed to generate report');
      }
    } catch (error) {
      console.error('Report generation error:', error);
      toast.error(error.message || 'Failed to generate report');
    } finally {
      setGenerating(false);
    }
  };

  const handleCheckStatus = async () => {
    if (!reportGenerated) return;
    setCheckingStatus(true);
    
    try {
      const response = await client.functions.invoke('syncDattoEDR', {
        action: 'check_report_status',
        report_id: reportGenerated.id
      });
      
      if (response.success && response.report) {
        setReportGenerated(response.report);
        if (response.report.status === 'complete') {
          toast.success('Report is ready!');
        } else {
          toast.info(`Report status: ${response.report.status}`);
        }
      }
    } catch (error) {
      toast.error('Failed to check status');
    } finally {
      setCheckingStatus(false);
    }
  };

  const handleDownload = async () => {
    if (!reportGenerated) return;
    setDownloading(true);
    
    try {
      const response = await client.functions.invoke('syncDattoEDR', {
        action: 'download_report',
        report_id: reportGenerated.id
      });

      // Check if response is a PDF (binary data)
      if (response.data instanceof ArrayBuffer || response.headers?.['content-type']?.includes('application/pdf')) {
        const blob = new Blob([response.data], { type: 'application/pdf' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${reportGenerated.name || 'EDR-Report'}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
        toast.success('Report downloaded!');
      } else if (response.data.s3Info) {
        // Report is in S3, direct download not available
        toast.info('Report generated! Download from Datto EDR console.');
      } else if (response.data.error) {
        toast.error(response.data.error);
      } else {
        toast.error('Unexpected response format');
      }
    } catch (error) {
      console.error('Download error:', error);
      toast.error(error.message || 'Failed to download report');
    } finally {
      setDownloading(false);
    }
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const isReportReady = reportGenerated?.status === 'complete';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-cyan-600" />
            Generate EDR Report
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Info Banner */}
          <div className="flex items-start gap-3 p-4 bg-cyan-50 rounded-lg border border-cyan-200">
            <Shield className="w-5 h-5 text-cyan-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-cyan-900">Executive Threat Report</p>
              <p className="text-sm text-cyan-700 mt-1">
                Generate and download an official PDF report from Datto EDR for {tenantName || 'this customer'}.
              </p>
            </div>
          </div>

          {/* Report Settings */}
          {!reportGenerated && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="reportName">Report Name</Label>
                <Input
                  id="reportName"
                  value={reportName}
                  onChange={(e) => setReportName(e.target.value)}
                  placeholder="Enter report name"
                  className="mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="endDate">End Date</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Report Status */}
          {reportGenerated && (
            <div className={`flex items-start gap-3 p-4 rounded-lg border ${
              isReportReady 
                ? 'bg-green-50 border-green-200' 
                : 'bg-amber-50 border-amber-200'
            }`}>
              {isReportReady ? (
                <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
              ) : (
                <Clock className="w-5 h-5 text-amber-600 mt-0.5" />
              )}
              <div className="flex-1">
                <p className={`text-sm font-medium ${isReportReady ? 'text-green-900' : 'text-amber-900'}`}>
                  {isReportReady ? 'Report Ready!' : 'Generating Report...'}
                </p>
                <p className={`text-sm mt-1 ${isReportReady ? 'text-green-700' : 'text-amber-700'}`}>
                  {isReportReady 
                    ? 'Your report is ready to download.' 
                    : 'This usually takes 1-2 minutes. The page will auto-refresh.'}
                </p>
                <div className="mt-2 text-xs text-slate-600 space-y-1">
                  <p><strong>Name:</strong> {reportGenerated.name}</p>
                  <p><strong>Status:</strong> {reportGenerated.status}</p>
                  {reportGenerated.startDate && (
                    <p><strong>Period:</strong> {formatDate(reportGenerated.startDate)} - {formatDate(reportGenerated.endDate)}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                setReportGenerated(null);
              }}
            >
              Close
            </Button>
            
            {reportGenerated && !isReportReady && (
              <Button
                variant="outline"
                onClick={handleCheckStatus}
                disabled={checkingStatus}
                className="gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${checkingStatus ? 'animate-spin' : ''}`} />
                Check Status
              </Button>
            )}
            
            {reportGenerated && isReportReady ? (
              <Button
                onClick={handleDownload}
                disabled={downloading}
                className="gap-2 bg-green-600 hover:bg-green-700"
              >
                {downloading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                {downloading ? 'Downloading...' : 'Download PDF'}
              </Button>
            ) : !reportGenerated && (
              <Button
                onClick={handleGenerateReport}
                disabled={generating || !reportName}
                className="gap-2 bg-cyan-600 hover:bg-cyan-700"
              >
                {generating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <FileText className="w-4 h-4" />
                )}
                {generating ? 'Generating...' : 'Generate Report'}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}