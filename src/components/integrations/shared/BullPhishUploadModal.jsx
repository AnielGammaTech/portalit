import React from 'react';
import { Button } from "@/components/ui/button";
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
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import {
  Upload,
  FileText,
  Loader2,
  XCircle,
  Plus,
} from 'lucide-react';
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Extracted Data Summary
// ---------------------------------------------------------------------------

function ExtractedSummary({ data }) {
  const stats = [
    { label: 'Campaigns', value: data.total_campaigns || 0 },
    { label: 'Emails Sent', value: data.total_emails_sent || 0 },
    { label: 'Opened', value: data.total_opened || 0 },
    { label: 'Clicked', value: data.total_clicked || 0, danger: true },
    { label: 'Reported', value: data.total_reported || 0, success: true },
    { label: 'Submitted Data', value: data.total_submitted_data || 0, danger: true },
    { label: 'Phish-Prone %', value: `${data.phish_prone_percentage || 0}%` },
    { label: 'Open Rate', value: `${data.open_rate || 0}%` },
    { label: 'Click Rate', value: `${data.click_rate || 0}%` },
  ];

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 overflow-hidden">
      <div className="px-4 py-2.5 bg-emerald-100/50 border-b border-emerald-200">
        <p className="text-xs font-semibold text-emerald-800 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
          Data Extracted Successfully
        </p>
      </div>
      <div className="p-4">
        <div className="grid grid-cols-3 gap-3">
          {stats.map((s) => (
            <div key={s.label} className="bg-white rounded-lg px-3 py-2 border border-emerald-100">
              <p className="text-[10px] text-slate-400 font-medium">{s.label}</p>
              <p className={cn('text-sm font-bold mt-0.5', s.danger ? 'text-red-600' : s.success ? 'text-emerald-600' : 'text-slate-800')}>
                {s.value}
              </p>
            </div>
          ))}
        </div>
        {(data.users_who_clicked?.length > 0 || data.users_who_opened?.length > 0) && (
          <div className="flex gap-3 mt-3 pt-3 border-t border-emerald-100">
            {data.users_who_clicked?.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-[10px] font-semibold text-red-700">
                {data.users_who_clicked.length} clicked
              </span>
            )}
            {data.users_who_opened?.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-semibold text-amber-700">
                {data.users_who_opened.length} opened
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Upload Modal
// ---------------------------------------------------------------------------

export default function BullPhishUploadModal({
  open, onOpenChange, customers, selectedCustomer, setSelectedCustomer,
  reportDate, setReportDate, periodStart, setPeriodStart, periodEnd, setPeriodEnd,
  selectedFile, handleFileSelect, onClearFile,
  isExtracting, extractedData, isUploading, onSave, onCancel,
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-[92vw] p-0 overflow-hidden" style={{ zIndex: 9999 }}>
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-5 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Upload BullPhish ID Report</h2>
              <p className="text-xs text-white/70">Upload a PDF and we will extract the data automatically</p>
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
                {customers.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
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
                <Input type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} className="h-9 rounded-lg text-sm" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground mb-1">Period Start</p>
                <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} className="h-9 rounded-lg text-sm" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground mb-1">Period End</p>
                <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className="h-9 rounded-lg text-sm" />
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
                    <FileText className="w-4 h-4 text-orange-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{selectedFile.name}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{(selectedFile.size / 1024).toFixed(0)} KB</p>
                  </div>
                  <button onClick={onClearFile} className="flex-shrink-0 rounded-lg p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                    <XCircle className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <label className="cursor-pointer block">
                  <input type="file" accept=".pdf" onChange={handleFileSelect} className="hidden" />
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
              <Loader2 className="w-4 h-4 animate-spin text-blue-600 flex-shrink-0" />
              <p className="text-sm font-medium text-blue-800">Extracting data from PDF...</p>
            </div>
          )}

          {/* Extracted Data Summary */}
          {extractedData && (
            <ExtractedSummary data={extractedData} />
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
          <Button variant="outline" onClick={onCancel} className="rounded-lg">Cancel</Button>
          <Button
            onClick={onSave}
            disabled={isUploading || !selectedCustomer || !reportDate}
            className="rounded-lg bg-orange-600 hover:bg-orange-700 text-white gap-2"
          >
            {isUploading ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : <><Plus className="w-4 h-4" /> Save Report</>}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
