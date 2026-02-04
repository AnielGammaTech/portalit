import React, { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { 
  Shield, 
  Monitor, 
  AlertTriangle, 
  CheckCircle2,
  Activity,
  Wifi,
  WifiOff,
  Download,
  Loader2,
  FileText
} from 'lucide-react';
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export default function DattoEDRReportModal({ open, onOpenChange, edrData, tenantName, customerName }) {
  const [generating, setGenerating] = useState(false);
  const reportRef = useRef(null);

  const coveragePercent = edrData?.hostCount > 0 
    ? Math.round((edrData?.activeHostCount / edrData?.hostCount) * 100) 
    : 0;

  const inactiveAgents = (edrData?.hostCount || 0) - (edrData?.activeHostCount || 0);

  // Calculate date range (last 3 months)
  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - 3);

  const formatDate = (date) => date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  const generatePDF = async () => {
    if (!reportRef.current) return;
    
    setGenerating(true);
    try {
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`${customerName || 'Customer'}_EDR_Report_${endDate.toISOString().slice(0,10)}.pdf`);
    } catch (error) {
      console.error('PDF generation error:', error);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-cyan-600" />
            Generate 3-Month EDR Report
          </DialogTitle>
        </DialogHeader>

        <div className="flex justify-end mb-4">
          <Button 
            onClick={generatePDF} 
            disabled={generating}
            className="gap-2 bg-cyan-600 hover:bg-cyan-700"
          >
            {generating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            {generating ? 'Generating...' : 'Download PDF'}
          </Button>
        </div>

        {/* Report Content - This gets converted to PDF */}
        <div ref={reportRef} className="bg-white p-8 space-y-6">
          {/* Header */}
          <div className="border-b pb-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Endpoint Detection & Response Report</h1>
                <p className="text-lg text-slate-600 mt-1">{customerName || 'Customer'}</p>
              </div>
              <Shield className="w-12 h-12 text-cyan-600" />
            </div>
            <div className="mt-4 flex gap-6 text-sm text-slate-600">
              <span><strong>Report Period:</strong> {formatDate(startDate)} - {formatDate(endDate)}</span>
              <span><strong>Tenant:</strong> {tenantName || 'N/A'}</span>
            </div>
          </div>

          {/* Executive Summary */}
          <div>
            <h2 className="text-lg font-semibold text-slate-900 mb-3">Executive Summary</h2>
            <div className={cn(
              "p-4 rounded-lg border",
              edrData?.alertCount > 0 ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"
            )}>
              <div className="flex items-center gap-3">
                {edrData?.alertCount > 0 ? (
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                ) : (
                  <CheckCircle2 className="w-6 h-6 text-green-600" />
                )}
                <div>
                  <p className={cn(
                    "font-semibold",
                    edrData?.alertCount > 0 ? "text-red-900" : "text-green-900"
                  )}>
                    {edrData?.alertCount > 0 
                      ? `${edrData.alertCount} Security Alert${edrData.alertCount !== 1 ? 's' : ''} Detected`
                      : "Security Status: All Clear"}
                  </p>
                  <p className={cn(
                    "text-sm",
                    edrData?.alertCount > 0 ? "text-red-700" : "text-green-700"
                  )}>
                    {edrData?.alertCount > 0 
                      ? "Immediate review and remediation recommended."
                      : "No active security threats detected during this reporting period."}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Key Metrics */}
          <div>
            <h2 className="text-lg font-semibold text-slate-900 mb-3">Key Metrics</h2>
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center p-4 bg-cyan-50 rounded-lg border border-cyan-200">
                <Monitor className="w-8 h-8 text-cyan-600 mx-auto mb-2" />
                <p className="text-3xl font-bold text-cyan-700">{edrData?.hostCount || 0}</p>
                <p className="text-xs text-slate-600 mt-1">Total Agents</p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
                <Wifi className="w-8 h-8 text-green-600 mx-auto mb-2" />
                <p className="text-3xl font-bold text-green-700">{edrData?.activeHostCount || 0}</p>
                <p className="text-xs text-slate-600 mt-1">Online</p>
              </div>
              <div className="text-center p-4 bg-slate-50 rounded-lg border border-slate-200">
                <WifiOff className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-3xl font-bold text-slate-600">{inactiveAgents}</p>
                <p className="text-xs text-slate-600 mt-1">Offline</p>
              </div>
              <div className={cn(
                "text-center p-4 rounded-lg border",
                edrData?.alertCount > 0 ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"
              )}>
                <AlertTriangle className={cn(
                  "w-8 h-8 mx-auto mb-2",
                  edrData?.alertCount > 0 ? "text-red-600" : "text-green-600"
                )} />
                <p className={cn(
                  "text-3xl font-bold",
                  edrData?.alertCount > 0 ? "text-red-700" : "text-green-700"
                )}>{edrData?.alertCount || 0}</p>
                <p className="text-xs text-slate-600 mt-1">Alerts</p>
              </div>
            </div>
          </div>

          {/* Coverage Analysis */}
          <div>
            <h2 className="text-lg font-semibold text-slate-900 mb-3">Agent Coverage Analysis</h2>
            <div className="p-4 bg-slate-50 rounded-lg border">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-slate-600">Coverage Rate (Online / Total)</span>
                <span className={cn(
                  "font-semibold",
                  coveragePercent >= 90 ? "text-green-600" :
                  coveragePercent >= 70 ? "text-yellow-600" : "text-red-600"
                )}>{coveragePercent}%</span>
              </div>
              <div className="h-4 bg-slate-200 rounded-full overflow-hidden">
                <div 
                  className={cn(
                    "h-full rounded-full",
                    coveragePercent >= 90 ? "bg-green-500" :
                    coveragePercent >= 70 ? "bg-yellow-500" : "bg-red-500"
                  )}
                  style={{ width: `${coveragePercent}%` }}
                />
              </div>
              <p className="text-sm text-slate-600 mt-3">
                {coveragePercent >= 90 
                  ? "✓ Excellent - The majority of agents are actively reporting."
                  : coveragePercent >= 70 
                    ? "⚠ Good - Some agents may need attention."
                    : "⚠ Needs Attention - Significant number of offline agents."}
              </p>
            </div>
          </div>

          {/* Protected Endpoints Summary */}
          <div>
            <h2 className="text-lg font-semibold text-slate-900 mb-3">Protected Endpoints Summary</h2>
            {edrData?.hosts && edrData.hosts.length > 0 ? (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="text-left p-3 font-medium">Hostname</th>
                      <th className="text-left p-3 font-medium">IP Address</th>
                      <th className="text-left p-3 font-medium">Operating System</th>
                      <th className="text-center p-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {edrData.hosts.slice(0, 20).map((host, idx) => (
                      <tr key={host.id || idx} className="border-t">
                        <td className="p-3">{host.hostname || 'Unknown'}</td>
                        <td className="p-3">{host.ip || 'N/A'}</td>
                        <td className="p-3 text-xs">{host.os || 'Unknown'}</td>
                        <td className="p-3 text-center">
                          <span className={cn(
                            "px-2 py-1 rounded text-xs font-medium",
                            host.online ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"
                          )}>
                            {host.online ? 'Online' : 'Offline'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {edrData.hosts.length > 20 && (
                  <p className="text-xs text-slate-500 p-3 bg-slate-50 border-t">
                    Showing 20 of {edrData.hosts.length} endpoints
                  </p>
                )}
              </div>
            ) : (
              <div className="text-center py-6 bg-slate-50 rounded-lg border">
                <p className="text-slate-600">{edrData?.hostCount || 0} endpoints protected</p>
                <p className="text-xs text-slate-500 mt-1">Detailed host list available in Datto EDR console</p>
              </div>
            )}
          </div>

          {/* Recommendations */}
          {(inactiveAgents > 0 || edrData?.alertCount > 0 || coveragePercent < 90) && (
            <div>
              <h2 className="text-lg font-semibold text-slate-900 mb-3">Recommendations</h2>
              <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                <ul className="space-y-2 text-sm text-amber-900">
                  {edrData?.alertCount > 0 && (
                    <li>• Review and remediate {edrData.alertCount} active security alert{edrData.alertCount !== 1 ? 's' : ''} immediately.</li>
                  )}
                  {inactiveAgents > 0 && (
                    <li>• Investigate {inactiveAgents} offline agent{inactiveAgents !== 1 ? 's' : ''} - may require reinstallation or represent decommissioned devices.</li>
                  )}
                  {coveragePercent < 90 && (
                    <li>• Consider deploying EDR agents to any unprotected endpoints to improve overall coverage.</li>
                  )}
                </ul>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="border-t pt-4 mt-6 text-xs text-slate-500 text-center">
            Report generated on {formatDate(new Date())} • Datto EDR Quarterly Business Review
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}