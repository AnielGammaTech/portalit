import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { client } from '@/api/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ShieldCheck,
  Mail,
  ShieldAlert,
  Bug,
  UserX,
  TrendingDown,
  TrendingUp,
  Eye,
  Calendar,
  Users,
  ChevronRight,
  X
} from 'lucide-react';
import { cn } from "@/lib/utils";
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function InkyTab({ customerId }) {
  const [selectedReport, setSelectedReport] = useState(null);
  const [userListModal, setUserListModal] = useState({ open: false, users: [] });

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['inky-reports', customerId],
    queryFn: () => client.entities.InkyReport.filter({ customer_id: customerId }),
    enabled: !!customerId
  });

  const sortedReports = [...reports].sort((a, b) =>
    new Date(b.report_date) - new Date(a.report_date)
  );

  const latestReport = sortedReports[0];
  const previousReport = sortedReports[1];

  const parseJsonField = (jsonString) => {
    if (!jsonString) return [];
    try {
      return typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
    } catch {
      return [];
    }
  };

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
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-8 text-center">
        <ShieldCheck className="w-12 h-12 text-blue-400 mx-auto mb-4" />
        <h3 className="font-semibold text-slate-900 mb-2">No Inky Reports</h3>
        <p className="text-sm text-slate-500 mb-4">
          Upload email protection reports from Inky in Settings → Integrations
        </p>
      </div>
    );
  }

  const threatTrend = getTrend(latestReport?.threat_rate, previousReport?.threat_rate, true);

  return (
    <div className="space-y-6">
      {latestReport && (
        <>
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border border-blue-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">Email Protection Summary</h3>
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
            {/* Protected Users */}
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Users</p>
                    <p className="text-3xl font-bold text-slate-900 mt-1">
                      {(latestReport.total_users || 0).toLocaleString()}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">protected mailboxes</p>
                  </div>
                  <Users className="w-5 h-5 text-blue-500" />
                </div>
              </CardContent>
            </Card>

            {/* Emails Processed */}
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Emails</p>
                    <p className="text-3xl font-bold text-slate-900 mt-1">
                      {(latestReport.total_emails_processed || 0).toLocaleString()}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">processed</p>
                  </div>
                  <Mail className="w-5 h-5 text-indigo-500" />
                </div>
              </CardContent>
            </Card>

            {/* Threats Blocked */}
            <Card className="border-2 border-blue-100">
              <CardContent className="pt-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Blocked</p>
                    <p className="text-3xl font-bold text-blue-600 mt-1">
                      {(latestReport.total_threats_blocked || 0).toLocaleString()}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">threats stopped</p>
                  </div>
                  <ShieldAlert className="w-5 h-5 text-blue-500" />
                </div>
              </CardContent>
            </Card>

            {/* Threat Rate */}
            <Card className={cn(
              "border-2",
              latestReport.threat_rate > 5
                ? "border-red-200 bg-red-50/50"
                : latestReport.threat_rate > 2
                  ? "border-amber-200 bg-amber-50/50"
                  : "border-green-200 bg-green-50/50"
            )}>
              <CardContent className="pt-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Threat Rate</p>
                    <p className={cn(
                      "text-3xl font-bold mt-1",
                      latestReport.threat_rate > 5 ? "text-red-600"
                        : latestReport.threat_rate > 2 ? "text-amber-600"
                        : "text-green-600"
                    )}>
                      {latestReport.threat_rate || 0}%
                    </p>
                    {threatTrend && (
                      <div className={cn(
                        "flex items-center gap-1 mt-1 text-xs",
                        threatTrend.direction === 'good' ? "text-green-600" : "text-red-600"
                      )}>
                        {threatTrend.direction === 'good' ? (
                          <TrendingDown className="w-3 h-3" />
                        ) : (
                          <TrendingUp className="w-3 h-3" />
                        )}
                        {threatTrend.value.toFixed(1)}% from last
                      </div>
                    )}
                  </div>
                  <ShieldCheck className={cn(
                    "w-5 h-5",
                    latestReport.threat_rate > 5 ? "text-red-500"
                      : latestReport.threat_rate > 2 ? "text-amber-500"
                      : "text-green-500"
                  )} />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Threat Breakdown & History */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-600">Threat Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { label: 'Phishing', value: latestReport.total_phishing_blocked || 0, color: 'text-red-600', bg: 'bg-red-100' },
                    { label: 'Spam', value: latestReport.total_spam_blocked || 0, color: 'text-amber-600', bg: 'bg-amber-100' },
                    { label: 'Malware', value: latestReport.total_malware_blocked || 0, color: 'text-purple-600', bg: 'bg-purple-100' },
                    { label: 'Impersonation', value: latestReport.total_impersonation_blocked || 0, color: 'text-orange-600', bg: 'bg-orange-100' },
                  ].map(item => (
                    <div key={item.label} className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50">
                      <div className="flex items-center gap-2">
                        <div className={cn("w-2 h-2 rounded-full", item.bg)} />
                        <span className="text-sm text-slate-500">{item.label}</span>
                      </div>
                      <span className={cn("font-semibold", item.color)}>{item.value.toLocaleString()}</span>
                    </div>
                  ))}
                  {(() => {
                    const targetedUsers = parseJsonField(latestReport.top_targeted_users);
                    if (targetedUsers.length > 0) {
                      return (
                        <button
                          className="flex items-center justify-between w-full pt-2 border-t hover:bg-slate-50 p-2 rounded-lg transition-colors"
                          onClick={() => setUserListModal({ open: true, users: targetedUsers })}
                        >
                          <span className="text-sm text-slate-500">Top Targeted Users</span>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{targetedUsers.length}</Badge>
                            <ChevronRight className="w-4 h-4 text-slate-400" />
                          </div>
                        </button>
                      );
                    }
                    return null;
                  })()}
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
                        idx === 0 ? "bg-blue-50 hover:bg-blue-100" : "bg-slate-50 hover:bg-slate-100"
                      )}
                      onClick={() => setSelectedReport(report)}
                    >
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-sm text-slate-700">
                          {format(new Date(report.report_date), 'MMM d, yyyy')}
                        </span>
                        {idx === 0 && (
                          <Badge variant="outline" className="text-[10px] bg-blue-100 text-blue-700 border-blue-200">
                            Latest
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">
                          {(report.total_threats_blocked || 0).toLocaleString()} blocked
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

      {/* Top Targeted Users Modal */}
      <Dialog open={userListModal.open} onOpenChange={(open) => !open && setUserListModal({ ...userListModal, open: false })}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserX className="w-5 h-5 text-red-500" />
              Top Targeted Users
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto">
            {userListModal.users.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <Users className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                <p>No targeted users data</p>
              </div>
            ) : (
              <div className="divide-y">
                {userListModal.users.map((user, idx) => (
                  <div key={idx} className="py-3 px-2 hover:bg-slate-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-slate-900">{user.name || 'Unknown'}</p>
                        <p className="text-sm text-slate-500">{user.email}</p>
                      </div>
                      {user.threat_count && (
                        <Badge variant="destructive" className="text-xs">
                          {user.threat_count} threat{user.threat_count > 1 ? 's' : ''}
                        </Badge>
                      )}
                    </div>
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
              <ShieldCheck className="w-5 h-5 text-blue-500" />
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
                  <p className="text-2xl font-bold text-slate-900">{(selectedReport.total_users || 0).toLocaleString()}</p>
                  <p className="text-xs text-slate-500">Users</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg text-center">
                  <p className="text-2xl font-bold text-slate-900">{(selectedReport.total_emails_processed || 0).toLocaleString()}</p>
                  <p className="text-xs text-slate-500">Emails</p>
                </div>
                <div className="bg-blue-50 p-3 rounded-lg text-center">
                  <p className="text-2xl font-bold text-blue-600">{(selectedReport.total_threats_blocked || 0).toLocaleString()}</p>
                  <p className="text-xs text-slate-500">Blocked</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg text-center">
                  <p className="text-2xl font-bold text-slate-900">{selectedReport.threat_rate || 0}%</p>
                  <p className="text-xs text-slate-500">Threat Rate</p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-red-50 p-3 rounded-lg text-center">
                  <p className="text-xl font-bold text-red-600">{selectedReport.total_phishing_blocked || 0}</p>
                  <p className="text-xs text-slate-500">Phishing</p>
                </div>
                <div className="bg-amber-50 p-3 rounded-lg text-center">
                  <p className="text-xl font-bold text-amber-600">{selectedReport.total_spam_blocked || 0}</p>
                  <p className="text-xs text-slate-500">Spam</p>
                </div>
                <div className="bg-purple-50 p-3 rounded-lg text-center">
                  <p className="text-xl font-bold text-purple-600">{selectedReport.total_malware_blocked || 0}</p>
                  <p className="text-xs text-slate-500">Malware</p>
                </div>
                <div className="bg-orange-50 p-3 rounded-lg text-center">
                  <p className="text-xl font-bold text-orange-600">{selectedReport.total_impersonation_blocked || 0}</p>
                  <p className="text-xs text-slate-500">Impersonation</p>
                </div>
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
