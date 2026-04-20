import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { client } from '@/api/client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Upload, FileText, Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';

const REPORT_TYPE_LABELS = {
  threat_level_overview: 'Threat Overview',
  graymail: 'Graymail',
  link_clicks: 'Link Clicks',
  user_reporting: 'User Reporting',
};

export default function InkyUploadModal({ open, onClose, customerId, customerName, reportType }) {
  const queryClient = useQueryClient();
  const [reportDate, setReportDate] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [extractedData, setExtractedData] = useState(null);

  useEffect(() => {
    if (open) {
      setReportDate('');
      setSelectedFile(null);
      setIsExtracting(false);
      setIsUploading(false);
      setExtractedData(null);
    }
  }, [open]);

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file || file.type !== 'application/pdf') { toast.error('Select a PDF'); return; }
    setSelectedFile(file);
    setExtractedData(null);
    if (!reportDate) setReportDate(new Date().toISOString().split('T')[0]);
    setIsExtracting(true);
    try {
      const { file_url } = await client.integrations.Core.UploadFile({ file });
      const result = await client.integrations.Core.InvokeLLM({
        prompt: 'Extract from this INKY report: total_users, total_emails_processed, total_threats_blocked, total_phishing_blocked, total_spam_blocked, total_malware_blocked, threat_rate. Use 0 for missing numbers.',
        file_urls: [file_url],
        response_json_schema: {
          type: "object",
          properties: {
            total_users: { type: "number" },
            total_emails_processed: { type: "number" },
            total_threats_blocked: { type: "number" },
            total_phishing_blocked: { type: "number" },
            total_spam_blocked: { type: "number" },
            total_malware_blocked: { type: "number" },
            threat_rate: { type: "number" },
            report_date: { type: "string" },
          },
        },
      });
      setExtractedData({ ...result, pdf_url: file_url });
      if (result?.report_date) setReportDate(result.report_date);
      toast.success('Data extracted');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSave = async () => {
    if (!reportDate) { toast.error('Select a date'); return; }
    setIsUploading(true);
    try {
      await client.entities.InkyReport.create({
        customer_id: customerId,
        customer_name: customerName,
        report_type: reportType,
        report_date: reportDate,
        pdf_url: extractedData?.pdf_url,
        total_users: extractedData?.total_users || 0,
        total_emails_processed: extractedData?.total_emails_processed || 0,
        total_threats_blocked: extractedData?.total_threats_blocked || 0,
        total_phishing_blocked: extractedData?.total_phishing_blocked || 0,
        total_spam_blocked: extractedData?.total_spam_blocked || 0,
        total_malware_blocked: extractedData?.total_malware_blocked || 0,
        threat_rate: extractedData?.threat_rate || 0,
      });
      toast.success('Report saved');
      queryClient.invalidateQueries({ queryKey: ['inky-reports'] });
      onClose();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Upload className="w-4 h-4 text-blue-600" />
            Upload {REPORT_TYPE_LABELS[reportType] || 'Report'} — {customerName}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <div>
            <Label className="text-xs">Report Date</Label>
            <Input type="date" value={reportDate} onChange={e => setReportDate(e.target.value)} className="mt-1 h-8 text-xs" />
          </div>
          <div className="border-2 border-dashed border-slate-200 rounded-lg p-4 text-center">
            {selectedFile ? (
              <div className="flex items-center justify-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-medium">{selectedFile.name}</span>
                <button onClick={() => { setSelectedFile(null); setExtractedData(null); }} className="text-xs text-slate-400 hover:text-red-500">Remove</button>
              </div>
            ) : (
              <label className="cursor-pointer">
                <input type="file" accept=".pdf" onChange={handleFileSelect} className="hidden" />
                <Upload className="w-6 h-6 mx-auto mb-1 text-slate-400" />
                <p className="text-xs text-slate-500">Click to select PDF</p>
              </label>
            )}
          </div>
          {isExtracting && (
            <div className="flex items-center justify-center gap-2 py-2">
              <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
              <span className="text-xs text-slate-500">Extracting...</span>
            </div>
          )}
          {extractedData && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-2.5 grid grid-cols-3 gap-1 text-[10px]">
              <div>Users: <strong>{extractedData.total_users || 0}</strong></div>
              <div>Emails: <strong>{(extractedData.total_emails_processed || 0).toLocaleString()}</strong></div>
              <div>Threats: <strong className="text-blue-600">{(extractedData.total_threats_blocked || 0).toLocaleString()}</strong></div>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={isUploading || !reportDate}>
              {isUploading ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" />Saving...</> : <><Plus className="w-3 h-3 mr-1" />Save</>}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
