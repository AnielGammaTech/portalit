import React, { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { client } from '@/api/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Phone,
  Users,
  PhoneForwarded,
  Voicemail,
  Headphones,
  RefreshCw,
  Clock,
  Search,
  Globe,
  CheckCircle2,
  XCircle,
  FileText,
  Calendar,
  UserX,
  ChevronLeft,
  ChevronRight,
  Building2
} from 'lucide-react';
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

const ITEMS_PER_PAGE = 15;

/** Safely parse extensions_detail — handles double-encoded JSON strings and arrays */
function parseExtensionsDetail(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return []; }
  }
  return [];
}

function ReportView({ report, searchQuery, setSearchQuery }) {
  const [page, setPage] = useState(0);

  const extensionsDetail = useMemo(
    () => parseExtensionsDetail(report?.extensions_detail),
    [report?.extensions_detail]
  );

  const activeExtensions = extensionsDetail.filter(ext => ext.type === 'user');
  const disabledExtensions = extensionsDetail.filter(ext => ext.type === 'disabled');
  const systemExtensions = extensionsDetail.filter(ext => ext.type === 'system');

  const filteredExtensions = useMemo(() => {
    if (!searchQuery) return extensionsDetail;
    const q = searchQuery.toLowerCase();
    return extensionsDetail.filter(ext =>
      (ext.name || '').toLowerCase().includes(q) ||
      String(ext.number || '').includes(q) ||
      (ext.department || '').toLowerCase().includes(q) ||
      (ext.type || '').toLowerCase().includes(q)
    );
  }, [extensionsDetail, searchQuery]);

  // Reset to page 0 when search changes
  const currentPage = searchQuery ? 0 : page;
  const totalPages = Math.ceil(filteredExtensions.length / ITEMS_PER_PAGE);
  const pagedExtensions = filteredExtensions.slice(
    currentPage * ITEMS_PER_PAGE,
    (currentPage + 1) * ITEMS_PER_PAGE
  );

  const getTypeBadge = (type) => {
    switch (type) {
      case 'disabled':
        return (
          <Badge variant="secondary" className="text-[10px] gap-0.5">
            <XCircle className="w-2.5 h-2.5" />
            Disabled
          </Badge>
        );
      case 'system':
        return (
          <Badge className="bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-[10px] gap-0.5">
            <Building2 className="w-2.5 h-2.5" />
            System
          </Badge>
        );
      default:
        return (
          <Badge className="bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-[10px] gap-0.5">
            <CheckCircle2 className="w-2.5 h-2.5" />
            Active
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Report Header */}
      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 rounded-2xl border border-emerald-100 dark:border-emerald-800/50 p-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
            <Phone className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">3CX VoIP System</h3>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="w-3.5 h-3.5" />
              <span>Report from {report.report_date || 'Unknown date'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total</p>
                <p className="text-3xl font-bold text-foreground mt-1">{report.total_extensions || extensionsDetail.length}</p>
                <p className="text-xs text-muted-foreground/70 mt-1">extensions</p>
              </div>
              <Phone className="w-5 h-5 text-emerald-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Active</p>
                <p className="text-3xl font-bold text-foreground mt-1">{report.user_extensions || activeExtensions.length}</p>
                <p className="text-xs text-muted-foreground/70 mt-1">user extensions</p>
              </div>
              <Users className="w-5 h-5 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Disabled</p>
                <p className="text-3xl font-bold text-foreground mt-1">{disabledExtensions.length}</p>
                <p className="text-xs text-muted-foreground/70 mt-1">extensions</p>
              </div>
              <UserX className="w-5 h-5 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Ring Groups</p>
                <p className="text-3xl font-bold text-foreground mt-1">{report.ring_groups || 0}</p>
                <p className="text-xs text-muted-foreground/70 mt-1">configured</p>
              </div>
              <PhoneForwarded className="w-5 h-5 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Extension List — paginated */}
      {extensionsDetail.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Extensions ({filteredExtensions.length}{searchQuery ? ` of ${extensionsDetail.length}` : ''})
              </CardTitle>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
                <Input
                  placeholder="Search by name, ext, dept..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setPage(0); }}
                  className="pl-8 h-7 text-xs w-56"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-0">
            {/* Table header */}
            <div className="grid grid-cols-[60px_1fr_120px_100px] gap-2 px-5 py-2 border-b border-border/50 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              <span>DID</span>
              <span>Name</span>
              <span>Department</span>
              <span className="text-right">Status</span>
            </div>

            {/* Rows */}
            <div className="divide-y divide-border/30">
              {pagedExtensions.map((ext, idx) => (
                <div
                  key={ext.number || idx}
                  className="grid grid-cols-[60px_1fr_120px_100px] gap-2 px-5 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors items-center"
                >
                  <span className={cn(
                    "font-mono text-sm font-semibold",
                    ext.type === 'disabled' ? "text-muted-foreground/50" : "text-emerald-600 dark:text-emerald-400"
                  )}>
                    {ext.number}
                  </span>
                  <p className={cn(
                    "text-sm truncate",
                    ext.type === 'disabled' ? "text-muted-foreground line-through" : "text-foreground font-medium"
                  )}>
                    {ext.name || `Ext ${ext.number}`}
                  </p>
                  <span className="text-xs text-muted-foreground truncate">
                    {ext.department || '—'}
                  </span>
                  <div className="flex justify-end">
                    {getTypeBadge(ext.type)}
                  </div>
                </div>
              ))}
            </div>

            {filteredExtensions.length === 0 && searchQuery && (
              <p className="text-sm text-muted-foreground text-center py-6">No extensions match "{searchQuery}"</p>
            )}

            {/* Pagination */}
            {totalPages > 1 && !searchQuery && (
              <div className="flex items-center justify-between px-5 pt-3 mt-2 border-t border-border/50">
                <p className="text-xs text-muted-foreground">
                  {currentPage * ITEMS_PER_PAGE + 1}–{Math.min((currentPage + 1) * ITEMS_PER_PAGE, filteredExtensions.length)} of {filteredExtensions.length}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => p - 1)}
                    disabled={currentPage === 0}
                    className="h-7 px-2"
                  >
                    <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => p + 1)}
                    disabled={currentPage >= totalPages - 1}
                    className="h-7 px-2"
                  >
                    Next
                    <ChevronRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ApiSyncView({ threecxMapping, customerId, queryClient }) {
  const [syncing, setSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const cached = threecxMapping?.cached_data;
  const extensions = cached?.extensions || [];

  const handleSync = async () => {
    setSyncing(true);
    try {
      const response = await client.functions.invoke('sync3CX', {
        action: 'sync_extensions',
        customer_id: customerId
      });
      if (response.success) {
        toast.success(`Synced ${response.totalExtensions} extensions`);
        queryClient.invalidateQueries({ queryKey: ['threecx-mapping', customerId] });
      } else {
        toast.error(response.error || 'Sync failed');
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSyncing(false);
    }
  };

  const userExtensions = extensions.filter(ext => {
    const type = (ext.type || '').toLowerCase();
    return type === 'user' || type === '' || type === 'extension';
  });

  const filteredExtensions = userExtensions.filter(ext => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (ext.name || '').toLowerCase().includes(q) ||
           (ext.email || '').toLowerCase().includes(q) ||
           String(ext.number || '').includes(q);
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 rounded-2xl border border-emerald-100 dark:border-emerald-800/50 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
              <Phone className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">3CX VoIP System</h3>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Globe className="w-3.5 h-3.5" />
                {threecxMapping.instance_name || threecxMapping.instance_url}
                {threecxMapping.last_synced && (
                  <span className="text-xs text-muted-foreground/60 flex items-center gap-1 ml-2">
                    <Clock className="w-3 h-3" />
                    {formatDistanceToNow(new Date(threecxMapping.last_synced), { addSuffix: true })}
                  </span>
                )}
              </div>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSync}
            disabled={syncing}
          >
            <RefreshCw className={cn("w-4 h-4 mr-2", syncing && "animate-spin")} />
            Sync
          </Button>
        </div>
      </div>

      {/* Metrics */}
      {cached && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Extensions</p>
                  <p className="text-3xl font-bold text-foreground mt-1">{cached.user_extensions || 0}</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">user extensions</p>
                </div>
                <Phone className="w-5 h-5 text-emerald-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Ring Groups</p>
                  <p className="text-3xl font-bold text-foreground mt-1">{cached.ring_groups || 0}</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">configured</p>
                </div>
                <PhoneForwarded className="w-5 h-5 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">IVR Menus</p>
                  <p className="text-3xl font-bold text-foreground mt-1">{cached.ivr_menus || 0}</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">auto attendants</p>
                </div>
                <Voicemail className="w-5 h-5 text-purple-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Queues</p>
                  <p className="text-3xl font-bold text-foreground mt-1">{cached.queues || 0}</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">call queues</p>
                </div>
                <Headphones className="w-5 h-5 text-orange-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Extension List */}
      {userExtensions.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                User Extensions ({userExtensions.length})
              </CardTitle>
              {userExtensions.length > 5 && (
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
                  <Input
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 h-7 text-xs w-40"
                  />
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5 max-h-80 overflow-y-auto">
              {filteredExtensions.map((ext, idx) => (
                <div
                  key={ext.number || idx}
                  className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-emerald-700 dark:text-emerald-300 font-medium text-xs flex-shrink-0">
                    {ext.number || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground text-sm truncate">
                      {ext.name || `${ext.firstName || ''} ${ext.lastName || ''}`.trim() || `Ext ${ext.number}`}
                    </p>
                    {ext.email && (
                      <p className="text-xs text-muted-foreground truncate">{ext.email}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {ext.registered === true ? (
                      <Badge className="bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-[10px]">
                        <CheckCircle2 className="w-2.5 h-2.5 mr-0.5" />
                        Online
                      </Badge>
                    ) : ext.registered === false ? (
                      <Badge variant="secondary" className="text-[10px]">
                        <XCircle className="w-2.5 h-2.5 mr-0.5" />
                        Offline
                      </Badge>
                    ) : null}
                  </div>
                </div>
              ))}
              {filteredExtensions.length === 0 && searchQuery && (
                <p className="text-sm text-muted-foreground text-center py-4">No extensions match "{searchQuery}"</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {!cached && (
        <div className="text-center py-8 bg-card rounded-xl border">
          <Phone className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">No data synced yet</p>
          <p className="text-sm text-muted-foreground/70 mt-1">Click "Sync" to pull extensions from 3CX</p>
        </div>
      )}
    </div>
  );
}

export default function ThreeCXTab({ customerId, threecxMapping, threecxReports = [], queryClient: qc }) {
  const [searchQuery, setSearchQuery] = useState('');
  const internalQC = useQueryClient();
  const queryClient = qc || internalQC;

  // Sort reports by date descending, use the latest one
  const sortedReports = useMemo(() =>
    [...threecxReports].sort((a, b) => (b.report_date || '').localeCompare(a.report_date || '')),
    [threecxReports]
  );
  const latestReport = sortedReports[0] || null;

  // If there's an API mapping, show the API sync view
  if (threecxMapping) {
    return (
      <ApiSyncView
        threecxMapping={threecxMapping}
        customerId={customerId}
        queryClient={queryClient}
      />
    );
  }

  // If there are uploaded reports, show the report view
  if (latestReport) {
    return (
      <ReportView
        report={latestReport}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
      />
    );
  }

  // No data at all
  return (
    <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 rounded-2xl p-8 text-center">
      <Phone className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
      <h3 className="font-semibold text-foreground mb-2">3CX Not Configured</h3>
      <p className="text-sm text-muted-foreground">
        Go to Adminland &rarr; Integrations to add this customer's 3CX instance or upload a report
      </p>
    </div>
  );
}
