import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Fish, 
  AlertTriangle, 
  CheckCircle2, 
  Mail, 
  MousePointer, 
  GraduationCap,
  TrendingDown,
  TrendingUp,
  Eye,
  Calendar,
  Users,
  X,
  ChevronRight,
  Flag
} from 'lucide-react';
import { cn } from "@/lib/utils";
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function BullPhishTab({ customerId }) {
  const [selectedReport, setSelectedReport] = useState(null);
  const [userListModal, setUserListModal] = useState({ open: false, type: null, users: [] });

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['bullphishid-reports', customerId],
    queryFn: () => base44.entities.BullPhishIDReport.filter({ customer_id: customerId }),
    enabled: !!customerId
  });

  // Sort by report date descending
  const sortedReports = [...reports].sort((a, b) => 
    new Date(b.report_date) - new Date(a.report_date)
  );

  const latestReport = sortedReports[0];
  const previousReport = sortedReports[1];

  // Parse JSON user arrays
  const parseUserList = (jsonString) => {
    if (!jsonString) return [];
    try {
      return JSON.parse(jsonString);
    } catch {
      return [];
    }
  };

  const openUserList = (type, report) => {
    let users = [];
    let title = '';
    
    if (type === 'opened') {
      users = parseUserList(report.users_who_opened);
      title = 'Users Who Opened';
    } else if (type === 'clicked') {
      users = parseUserList(report.users_who_clicked);
      title = 'Users Who Clicked';
    } else if (type === 'reported') {
      users = parseUserList(report.users_who_reported);
      title = 'Users Who Reported';
    }
    
    setUserListModal({ open: true, type, title, users, report });
  };

  // Calculate trend
  const getTrend = (current, previous, lowerIsBetter = false) => {
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
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <div className="bg-orange-50 border border-orange-200 rounded-2xl p-8 text-center">
        <Fish className="w-12 h-12 text-orange-400 mx-auto mb-4" />
        <h3 className="font-semibold text-slate-900 mb-2">No BullPhish ID Reports</h3>
        <p className="text-sm text-slate-500 mb-4">
          Upload phishing simulation reports from BullPhish ID in Settings → Integrations
        </p>
      </div>
    );
  }

  const phishTrend = getTrend(previousReport?.phish_prone_percentage, latestReport?.phish_prone_percentage, false);
  const trainingTrend = getTrend(latestReport?.training_completion_rate, previousReport?.training_completion_rate);

  return (
    <div className="space-y-6">
      {/* Latest Report Summary */}
      {latestReport && (
        <>
          <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-2xl border border-orange-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
                  <Fish className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">Phishing Security Assessment</h3>
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
            {/* Phish-Prone Percentage */}
            <Card className={cn(
              "border-2",
              latestReport.phish_prone_percentage > 20 
                ? "border-red-200 bg-red-50/50" 
                : latestReport.phish_prone_percentage > 10 
                  ? "border-amber-200 bg-amber-50/50" 
                  : "border-green-200 bg-green-50/50"
            )}>
              <CardContent className="pt-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Phish-Prone</p>
                    <p className={cn(
                      "text-3xl font-bold mt-1",
                      latestReport.phish_prone_percentage > 20 
                        ? "text-red-600" 
                        : latestReport.phish_prone_percentage > 10 
                          ? "text-amber-600" 
                          : "text-green-600"
                    )}>
                      {latestReport.phish_prone_percentage}%
                    </p>
                    {phishTrend && (
                      <div className={cn(
                        "flex items-center gap-1 mt-1 text-xs",
                        phishTrend.direction === 'good' ? "text-green-600" : "text-red-600"
                      )}>
                        {phishTrend.direction === 'good' ? (
                          <TrendingDown className="w-3 h-3" />
                        ) : (
                          <TrendingUp className="w-3 h-3" />
                        )}
                        {phishTrend.value.toFixed(1)}% from last
                      </div>
                    )}
                  </div>
                  <AlertTriangle className={cn(
                    "w-5 h-5",
                    latestReport.phish_prone_percentage > 20 
                      ? "text-red-500" 
                      : latestReport.phish_prone_percentage > 10 
                        ? "text-amber-500" 
                        : "text-green-500"
                  )} />
                </div>
              </CardContent>
            </Card>

            {/* Emails Sent */}
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Emails Sent</p>
                    <p className="text-3xl font-bold text-slate-900 mt-1">
                      {latestReport.total_emails_sent?.toLocaleString() || 0}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      {latestReport.total_campaigns || 0} campaigns
                    </p>
                  </div>
                  <Mail className="w-5 h-5 text-blue-500" />
                </div>
              </CardContent>
            </Card>

            {/* Clicked (Failed) */}
            <Card className="border-2 border-red-100">
              <CardContent className="pt-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Clicked</p>
                    <p className="text-3xl font-bold text-red-600 mt-1">
                      {latestReport.total_clicked || 0}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      {latestReport.total_emails_sent > 0 
                        ? ((latestReport.total_clicked / latestReport.total_emails_sent) * 100).toFixed(1) 
                        : 0}% click rate
                    </p>
                  </div>
                  <MousePointer className="w-5 h-5 text-red-500" />
                </div>
              </CardContent>
            </Card>

            {/* Training Completion */}
            <Card className={cn(
              "border-2",
              latestReport.training_completion_rate >= 90 
                ? "border-green-200 bg-green-50/50" 
                : latestReport.training_completion_rate >= 70 
                  ? "border-amber-200 bg-amber-50/50" 
                  : "border-red-200 bg-red-50/50"
            )}>
              <CardContent className="pt-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Training</p>
                    <p className={cn(
                      "text-3xl font-bold mt-1",
                      latestReport.training_completion_rate >= 90 
                        ? "text-green-600" 
                        : latestReport.training_completion_rate >= 70 
                          ? "text-amber-600" 
                          : "text-red-600"
                    )}>
                      {latestReport.training_completion_rate}%
                    </p>
                    {trainingTrend && (
                      <div className={cn(
                        "flex items-center gap-1 mt-1 text-xs",
                        trainingTrend.direction === 'good' ? "text-green-600" : "text-red-600"
                      )}>
                        {trainingTrend.direction === 'good' ? (
                          <TrendingUp className="w-3 h-3" />
                        ) : (
                          <TrendingDown className="w-3 h-3" />
                        )}
                        {trainingTrend.value.toFixed(1)}% from last
                      </div>
                    )}
                  </div>
                  <GraduationCap className={cn(
                    "w-5 h-5",
                    latestReport.training_completion_rate >= 90 
                      ? "text-green-500" 
                      : latestReport.training_completion_rate >= 70 
                        ? "text-amber-500" 
                        : "text-red-500"
                  )} />
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
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500">Emails Opened</span>
                    <span className="font-semibold text-slate-900">{latestReport.total_opened || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500">Users Who Reported</span>
                    <span className="font-semibold text-green-600">{latestReport.total_reported || 0}</span>
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
                    <div 
                      key={report.id} 
                      className={cn(
                        "flex items-center justify-between p-2 rounded-lg",
                        idx === 0 ? "bg-orange-50" : "bg-slate-50"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-sm text-slate-700">
                          {format(new Date(report.report_date), 'MMM d, yyyy')}
                        </span>
                        {idx === 0 && (
                          <Badge variant="outline" className="text-[10px] bg-orange-100 text-orange-700 border-orange-200">
                            Latest
                          </Badge>
                        )}
                      </div>
                      <Badge variant={report.phish_prone_percentage > 20 ? "destructive" : "outline"}>
                        {report.phish_prone_percentage}%
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}