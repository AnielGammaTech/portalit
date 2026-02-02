import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Shield, 
  AlertTriangle, 
  AlertCircle,
  CheckCircle2,
  Eye,
  Calendar,
  Mail,
  TrendingDown,
  TrendingUp,
  ChevronRight,
  Database
} from 'lucide-react';
import { cn } from "@/lib/utils";
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function DarkWebTab({ customerId }) {
  const [selectedReport, setSelectedReport] = useState(null);
  const [detailModal, setDetailModal] = useState({ open: false, type: null, data: [] });

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['darkwebid-reports', customerId],
    queryFn: () => base44.entities.DarkWebIDReport.filter({ customer_id: customerId }),
    enabled: !!customerId
  });

  const sortedReports = [...reports].sort((a, b) => 
    new Date(b.report_date) - new Date(a.report_date)
  );

  const latestReport = sortedReports[0];
  const previousReport = sortedReports[1];

  const parseJsonArray = (jsonString) => {
    if (!jsonString) return [];
    try {
      return JSON.parse(jsonString);
    } catch {
      return [];
    }
  };

  const openDetailModal = (type, report) => {
    let data = [];
    let title = '';
    
    if (type === 'emails') {
      data = parseJsonArray(report.compromised_emails);
      title = 'Compromised Emails';
    } else if (type === 'sources') {
      data = parseJsonArray(report.breach_sources);
      title = 'Breach Sources';
    } else if (type === 'details') {
      data = parseJsonArray(report.compromises_detail);
      title = 'Compromise Details';
    }
    
    setDetailModal({ open: true, type, title, data, report });
  };

  const getTrend = (current, previous, lowerIsBetter = true) => {
    if (!previous || current === undefined || previous === undefined) return null;
    const diff = current - previous;
    if (diff === 0) return { direction: 'same', value: 0 };
    if (lowerIsBetter) {
      return { direction: diff < 0 ? 'good' : 'bad', value: Math.abs(diff) };
    }
    return { direction: diff > 0 ? 'good' : 'bad', value: Math.abs(diff) };
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center">
        <Shield className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h3 className="font-semibold text-slate-900 mb-2">No Dark Web ID Reports</h3>
        <p className="text-sm text-slate-500 mb-4">
          Upload dark web monitoring reports in Settings → Integrations
        </p>
      </div>
    );
  }

  const totalTrend = getTrend(latestReport?.total_compromises, previousReport?.total_compromises);
  const criticalTrend = getTrend(latestReport?.critical_count, previousReport?.critical_count);

  return (
    <div className="space-y-6">
      {/* Latest Report Summary */}
      {latestReport && (
        <>
          <div className="bg-gradient-to-r from-red-50 to-orange-50 rounded-2xl border border-red-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">Dark Web Monitoring</h3>
                  <p className="text-sm text-slate-500">
                    Latest report: {format(new Date(latestReport.report_date), 'MMMM d, yyyy')}
                  </p>
                </div>
              </div>
              {latestReport.pdf_url && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => window.open(latestReport.pdf_url, '_blank')}
                >
                  <Eye className="w-4 h-4 mr-2" />
                  View Report
                </Button>
              )}
            </div>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Total Compromises */}
            <Card className={cn(
              "border-2",
              latestReport.total_compromises > 10 
                ? "border-red-200 bg-red-50/50" 
                : latestReport.total_compromises > 0 
                  ? "border-amber-200 bg-amber-50/50" 
                  : "border-green-200 bg-green-50/50"
            )}>
              <CardContent className="pt-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Total Found</p>
                    <p className={cn(
                      "text-3xl font-bold mt-1",
                      latestReport.total_compromises > 10 
                        ? "text-red-600" 
                        : latestReport.total_compromises > 0 
                          ? "text-amber-600" 
                          : "text-green-600"
                    )}>
                      {latestReport.total_compromises || 0}
                    </p>
                    {totalTrend && totalTrend.value > 0 && (
                      <div className={cn(
                        "flex items-center gap-1 mt-1 text-xs",
                        totalTrend.direction === 'good' ? "text-green-600" : "text-red-600"
                      )}>
                        {totalTrend.direction === 'good' ? (
                          <TrendingDown className="w-3 h-3" />
                        ) : (
                          <TrendingUp className="w-3 h-3" />
                        )}
                        {totalTrend.value} from last
                      </div>
                    )}
                  </div>
                  <Shield className={cn(
                    "w-5 h-5",
                    latestReport.total_compromises > 10 
                      ? "text-red-500" 
                      : latestReport.total_compromises > 0 
                        ? "text-amber-500" 
                        : "text-green-500"
                  )} />
                </div>
              </CardContent>
            </Card>

            {/* Critical */}
            <Card className={cn(
              "border-2",
              latestReport.critical_count > 0 
                ? "border-red-300 bg-red-100/50" 
                : "border-slate-200"
            )}>
              <CardContent className="pt-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Critical</p>
                    <p className={cn(
                      "text-3xl font-bold mt-1",
                      latestReport.critical_count > 0 ? "text-red-700" : "text-slate-400"
                    )}>
                      {latestReport.critical_count || 0}
                    </p>
                    {criticalTrend && criticalTrend.value > 0 && (
                      <div className={cn(
                        "flex items-center gap-1 mt-1 text-xs",
                        criticalTrend.direction === 'good' ? "text-green-600" : "text-red-600"
                      )}>
                        {criticalTrend.direction === 'good' ? (
                          <TrendingDown className="w-3 h-3" />
                        ) : (
                          <TrendingUp className="w-3 h-3" />
                        )}
                        {criticalTrend.value} from last
                      </div>
                    )}
                  </div>
                  <AlertCircle className={cn(
                    "w-5 h-5",
                    latestReport.critical_count > 0 ? "text-red-600" : "text-slate-300"
                  )} />
                </div>
              </CardContent>
            </Card>

            {/* High */}
            <Card className={cn(
              "border-2",
              latestReport.high_count > 0 
                ? "border-orange-200 bg-orange-50/50" 
                : "border-slate-200"
            )}>
              <CardContent className="pt-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">High</p>
                    <p className={cn(
                      "text-3xl font-bold mt-1",
                      latestReport.high_count > 0 ? "text-orange-600" : "text-slate-400"
                    )}>
                      {latestReport.high_count || 0}
                    </p>
                  </div>
                  <AlertTriangle className={cn(
                    "w-5 h-5",
                    latestReport.high_count > 0 ? "text-orange-500" : "text-slate-300"
                  )} />
                </div>
              </CardContent>
            </Card>

            {/* New This Period */}
            <Card className={cn(
              "border-2",
              latestReport.new_compromises > 0 
                ? "border-red-200 bg-red-50/50" 
                : "border-green-200 bg-green-50/50"
            )}>
              <CardContent className="pt-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">New</p>
                    <p className={cn(
                      "text-3xl font-bold mt-1",
                      latestReport.new_compromises > 0 ? "text-red-600" : "text-green-600"
                    )}>
                      {latestReport.new_compromises > 0 ? `+${latestReport.new_compromises}` : '0'}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">since last report</p>
                  </div>
                  {latestReport.new_compromises > 0 ? (
                    <TrendingUp className="w-5 h-5 text-red-500" />
                  ) : (
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Additional Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-600">Quick Stats</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <button 
                    className="flex items-center justify-between w-full hover:bg-slate-50 p-2 -m-2 rounded-lg transition-colors"
                    onClick={() => openDetailModal('emails', latestReport)}
                  >
                    <span className="text-sm text-slate-500 flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      Compromised Emails
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-red-600">
                        {parseJsonArray(latestReport.compromised_emails).length || 0}
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    </div>
                  </button>
                  <button 
                    className="flex items-center justify-between w-full hover:bg-slate-50 p-2 -m-2 rounded-lg transition-colors"
                    onClick={() => openDetailModal('sources', latestReport)}
                  >
                    <span className="text-sm text-slate-500 flex items-center gap-2">
                      <Database className="w-4 h-4" />
                      Breach Sources
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900">
                        {parseJsonArray(latestReport.breach_sources).length || 0}
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    </div>
                  </button>
                  <div className="flex items-center justify-between pt-2 border-t">
                    <span className="text-sm text-slate-500">Medium Severity</span>
                    <span className="font-semibold text-yellow-600">{latestReport.medium_count || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500">Low Severity</span>
                    <span className="font-semibold text-slate-600">{latestReport.low_count || 0}</span>
                  </div>
                  {latestReport.report_period_start && latestReport.report_period_end && (
                    <div className="flex items-center justify-between pt-2 border-t">
                      <span className="text-sm text-slate-500">Report Period</span>
                      <span className="text-sm text-slate-700">
                        {format(new Date(latestReport.report_period_start), 'MMM d')} - {format(new Date(latestReport.report_period_end), 'MMM d, yyyy')}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Report History */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-600">Report History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {sortedReports.slice(0, 4).map((report, idx) => (
                    <button 
                      key={report.id} 
                      className={cn(
                        "flex items-center justify-between p-2 rounded-lg w-full text-left hover:shadow-sm transition-all",
                        idx === 0 ? "bg-red-50 hover:bg-red-100" : "bg-slate-50 hover:bg-slate-100"
                      )}
                      onClick={() => setSelectedReport(report)}
                    >
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-sm text-slate-700">
                          {format(new Date(report.report_date), 'MMM d, yyyy')}
                        </span>
                        {idx === 0 && (
                          <Badge variant="outline" className="text-[10px] bg-red-100 text-red-700 border-red-200">
                            Latest
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={report.total_compromises > 5 ? "destructive" : "outline"}>
                          {report.total_compromises || 0}
                        </Badge>
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      </div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* Detail List Modal */}
      <Dialog open={detailModal.open} onOpenChange={(open) => !open && setDetailModal({ ...detailModal, open: false })}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {detailModal.type === 'emails' && <Mail className="w-5 h-5 text-red-500" />}
              {detailModal.type === 'sources' && <Database className="w-5 h-5 text-purple-500" />}
              {detailModal.type === 'details' && <Shield className="w-5 h-5 text-red-500" />}
              {detailModal.title}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto">
            {detailModal.data.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <Shield className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                <p>No data available</p>
              </div>
            ) : detailModal.type === 'details' ? (
              <div className="divide-y">
                {detailModal.data.map((item, idx) => (
                  <div key={idx} className="py-3 px-2">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-medium text-slate-900">{item.email}</p>
                      {item.severity && (
                        <Badge className={cn(
                          'text-xs',
                          item.severity === 'critical' && 'bg-red-100 text-red-700',
                          item.severity === 'high' && 'bg-orange-100 text-orange-700',
                          item.severity === 'medium' && 'bg-yellow-100 text-yellow-700',
                          item.severity === 'low' && 'bg-blue-100 text-blue-700'
                        )}>
                          {item.severity}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-slate-500">Source: {item.source || 'Unknown'}</p>
                    {item.breach_date && (
                      <p className="text-xs text-slate-400">Breach date: {item.breach_date}</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="divide-y">
                {detailModal.data.map((item, idx) => (
                  <div key={idx} className="py-2 px-2">
                    <p className="text-sm text-slate-700">{item}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Report Detail Modal */}
      <Dialog open={!!selectedReport} onOpenChange={(open) => !open && setSelectedReport(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-red-500" />
              Report Details - {selectedReport && format(new Date(selectedReport.report_date), 'MMMM d, yyyy')}
            </DialogTitle>
          </DialogHeader>
          {selectedReport && (
            <div className="space-y-6">
              {selectedReport.report_period_start && selectedReport.report_period_end && (
                <div className="text-sm text-slate-500 bg-slate-50 p-3 rounded-lg">
                  Report Period: {format(new Date(selectedReport.report_period_start), 'MMM d, yyyy')} - {format(new Date(selectedReport.report_period_end), 'MMM d, yyyy')}
                </div>
              )}

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-slate-50 p-3 rounded-lg text-center">
                  <p className="text-2xl font-bold text-slate-900">{selectedReport.total_compromises || 0}</p>
                  <p className="text-xs text-slate-500">Total</p>
                </div>
                <div className="bg-red-50 p-3 rounded-lg text-center">
                  <p className="text-2xl font-bold text-red-600">{selectedReport.critical_count || 0}</p>
                  <p className="text-xs text-slate-500">Critical</p>
                </div>
                <div className="bg-orange-50 p-3 rounded-lg text-center">
                  <p className="text-2xl font-bold text-orange-600">{selectedReport.high_count || 0}</p>
                  <p className="text-xs text-slate-500">High</p>
                </div>
                <div className={cn(
                  "p-3 rounded-lg text-center",
                  selectedReport.new_compromises > 0 ? "bg-red-50" : "bg-green-50"
                )}>
                  <p className={cn(
                    "text-2xl font-bold",
                    selectedReport.new_compromises > 0 ? "text-red-600" : "text-green-600"
                  )}>
                    {selectedReport.new_compromises > 0 ? `+${selectedReport.new_compromises}` : '0'}
                  </p>
                  <p className="text-xs text-slate-500">New</p>
                </div>
              </div>

              <div className="space-y-2">
                <button 
                  className="w-full flex items-center justify-between p-3 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                  onClick={() => { setSelectedReport(null); openDetailModal('emails', selectedReport); }}
                >
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-red-500" />
                    <span className="text-sm font-medium text-slate-700">Compromised Emails</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="destructive">{parseJsonArray(selectedReport.compromised_emails).length || 0}</Badge>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </div>
                </button>
                <button 
                  className="w-full flex items-center justify-between p-3 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors"
                  onClick={() => { setSelectedReport(null); openDetailModal('sources', selectedReport); }}
                >
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-purple-500" />
                    <span className="text-sm font-medium text-slate-700">Breach Sources</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-purple-100 text-purple-700">{parseJsonArray(selectedReport.breach_sources).length || 0}</Badge>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </div>
                </button>
              </div>

              {selectedReport.pdf_url && (
                <Button 
                  className="w-full"
                  onClick={() => window.open(selectedReport.pdf_url, '_blank')}
                >
                  <Eye className="w-4 h-4 mr-2" />
                  View Full PDF Report
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}