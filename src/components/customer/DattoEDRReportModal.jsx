import React, { useState } from 'react';
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
  Calendar
} from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';

export default function DattoEDRReportModal({ open, onOpenChange, edrData, tenantName, customerName, customerId }) {
  const [generating, setGenerating] = useState(false);
  const [reportGenerated, setReportGenerated] = useState(null);
  
  // Default to last 3 months
  const defaultEndDate = new Date().toISOString().split('T')[0];
  const defaultStartDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  const [reportName, setReportName] = useState(`${customerName || tenantName || 'Customer'} - EDR Report`);
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(defaultEndDate);

  const handleGenerateReport = async () => {
    setGenerating(true);
    setReportGenerated(null);
    
    try {
      const response = await base44.functions.invoke('syncDattoEDR', {
        action: 'generate_report',
        customer_id: customerId,
        report_name: reportName,
        report_type: 'executiveThreat',
        start_date: startDate,
        end_date: endDate
      });

      if (response.data.success) {
        setReportGenerated(response.data.report);
        toast.success('Report generation started! It will be available in the Datto EDR console shortly.');
      } else {
        toast.error(response.data.error || 'Failed to generate report');
      }
    } catch (error) {
      console.error('Report generation error:', error);
      toast.error(error.message || 'Failed to generate report');
    } finally {
      setGenerating(false);
    }
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

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
                Generate an official PDF report from Datto EDR for {tenantName || 'this customer'}.
              </p>
            </div>
          </div>

          {/* Report Settings */}
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

          {/* Success State */}
          {reportGenerated && (
            <div className="flex items-start gap-3 p-4 bg-green-50 rounded-lg border border-green-200">
              <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-green-900">Report Queued Successfully!</p>
                <p className="text-sm text-green-700 mt-1">
                  Your report "{reportGenerated.name}" is being generated. It will be available in the Datto EDR console within a few minutes.
                </p>
                <div className="mt-2 text-xs text-green-600 space-y-1">
                  <p><strong>Report ID:</strong> {reportGenerated.id}</p>
                  <p><strong>Period:</strong> {formatDate(reportGenerated.startDate)} - {formatDate(reportGenerated.endDate)}</p>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
            <Button
              onClick={handleGenerateReport}
              disabled={generating || !reportName}
              className="gap-2 bg-cyan-600 hover:bg-cyan-700"
            >
              {generating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              {generating ? 'Generating...' : 'Generate Report'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}