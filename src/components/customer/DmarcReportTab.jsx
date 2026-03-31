import React, { useState, useMemo } from 'react';
import { client } from '@/api/client';
import { toast } from 'sonner';
import {
  Globe,
  RefreshCw,
  Shield,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  BarChart3,
  Search,
  ChevronDown,
  ChevronUp,
  Mail,
  Lock,
  Server,
  FileCode,
  Eye,
  Clock,
} from 'lucide-react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function complianceColor(rate) {
  if (rate >= 90) return 'text-emerald-600';
  if (rate >= 70) return 'text-amber-600';
  return 'text-red-600';
}

function complianceBg(rate) {
  if (rate >= 90) return 'bg-emerald-100';
  if (rate >= 70) return 'bg-amber-100';
  return 'bg-red-100';
}

function StatusDot({ active, label }) {
  return (
    <span className="flex items-center gap-1.5 text-xs">
      <span className={cn(
        "w-1.5 h-1.5 rounded-full shrink-0",
        active ? "bg-emerald-500" : "bg-slate-300"
      )} />
      <span className={active ? "text-slate-700" : "text-slate-400"}>{label}</span>
    </span>
  );
}

function DnsRecordRow({ label, value, icon: Icon }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2 py-2 border-b border-slate-100 last:border-0">
      <div className="w-6 h-6 rounded bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
        <Icon className="w-3 h-3 text-slate-500" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{label}</p>
        <p className="text-xs text-slate-700 font-mono break-all mt-0.5 leading-relaxed">{value}</p>
      </div>
    </div>
  );
}

function SourceRow({ source, maxCount }) {
  const pct = maxCount > 0 ? (source.count / maxCount) * 100 : 0;
  return (
    <div className="py-2.5 border-b border-slate-50 last:border-0">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Server className="w-3 h-3 text-slate-400 shrink-0" />
          <span className="text-xs font-medium text-slate-900 truncate">
            {source.org || source.hostname || source.source_ip || 'Unknown'}
          </span>
          {source.source_ip && source.org && (
            <span className="text-[10px] text-slate-400 font-mono shrink-0">{source.source_ip}</span>
          )}
        </div>
        <span className="text-xs font-semibold text-slate-700 shrink-0 ml-2">
          {source.count.toLocaleString()}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-blue-400 to-blue-500"
            style={{ width: `${Math.max(pct, 2)}%` }}
          />
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className={cn("text-[10px] font-medium", source.spf_pass > 0 ? "text-emerald-600" : "text-slate-400")}>
            SPF {source.spf_pass > 0 ? source.spf_pass : '–'}
          </span>
          <span className={cn("text-[10px] font-medium", source.dkim_pass > 0 ? "text-emerald-600" : "text-slate-400")}>
            DKIM {source.dkim_pass > 0 ? source.dkim_pass : '–'}
          </span>
        </div>
      </div>
    </div>
  );
}

function DomainCard({ domain }) {
  const [expanded, setExpanded] = useState(false);
  const stats = domain.stats || {};
  const dns = domain.dns || {};
  const sources = domain.top_sources || [];
  const isPublished = domain.dmarc_status === 'dmarc_record_published' || (stats.total || 0) > 0;
  const complianceRate = stats.total > 0 ? Math.round(((stats.compliant || 0) / stats.total) * 100) : null;
  const maxSourceCount = sources.length > 0 ? Math.max(...sources.map(s => s.count)) : 0;

  // Compliance ring visual
  const ringPct = (complianceRate !== null && !isNaN(complianceRate)) ? complianceRate : 0;

  return (
    <Card className={cn(
      "overflow-hidden transition-shadow",
      expanded && "shadow-md"
    )}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-4 p-4 hover:bg-slate-50/50 transition-colors text-left"
      >
        {/* Compliance ring */}
        <div className="relative w-14 h-14 shrink-0">
          <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
            <circle cx="28" cy="28" r="24" fill="none" stroke="currentColor" strokeWidth="4" className="text-slate-100" />
            <circle
              cx="28" cy="28" r="24" fill="none"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={`${ringPct * 1.508} 150.8`}
              className={cn(
                complianceRate === null ? "text-slate-200" :
                complianceRate >= 90 ? "text-emerald-500" :
                complianceRate >= 70 ? "text-amber-500" : "text-red-500"
              )}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={cn(
              "text-sm font-bold",
              complianceRate === null || isNaN(complianceRate) ? "text-slate-400" : complianceColor(complianceRate)
            )}>
              {complianceRate !== null && !isNaN(complianceRate) ? `${complianceRate}%` : '–'}
            </span>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-sm font-semibold text-slate-900 truncate">{domain.address}</p>
            {isPublished ? (
              <Badge className="bg-emerald-100 text-emerald-700 border-0 text-[9px] py-0 px-1.5 gap-0.5">
                <ShieldCheck className="w-2.5 h-2.5" /> Active
              </Badge>
            ) : (
              <Badge className="bg-amber-100 text-amber-700 border-0 text-[9px] py-0 px-1.5 gap-0.5">
                <ShieldAlert className="w-2.5 h-2.5" /> Inactive
              </Badge>
            )}
            {domain.parked_domain && (
              <Badge variant="secondary" className="text-[9px] py-0">Parked</Badge>
            )}
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <StatusDot active={!!domain.rua_report} label="RUA" />
            <StatusDot active={!!domain.ruf_report} label="RUF" />
            <StatusDot active={domain.mta_sts_status === 'mta_sts_active'} label="MTA-STS" />
            {dns.dmarc_policy && (
              <span className="text-[10px] font-medium text-slate-500">
                Policy: <span className="text-slate-700">{dns.dmarc_policy}</span>
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-6 shrink-0">
          <div className="hidden sm:grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-sm font-bold text-slate-900">{(stats.total || 0).toLocaleString()}</p>
              <p className="text-[9px] text-slate-400 uppercase">Messages</p>
            </div>
            <div>
              <p className={cn("text-sm font-bold", (stats.non_compliant || 0) > 0 ? "text-red-600" : "text-slate-400")}>
                {(stats.non_compliant || 0).toLocaleString()}
              </p>
              <p className="text-[9px] text-slate-400 uppercase">Failed</p>
            </div>
            <div>
              <p className={cn("text-sm font-bold", (stats.quarantine || 0) > 0 ? "text-amber-600" : "text-slate-400")}>
                {(stats.quarantine || 0).toLocaleString()}
              </p>
              <p className="text-[9px] text-slate-400 uppercase">Quarantine</p>
            </div>
          </div>
          {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t">
          {/* Stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-px bg-slate-100">
            {[
              { label: 'Compliant', value: stats.compliant || 0, color: 'text-emerald-600' },
              { label: 'Non-Compliant', value: stats.non_compliant || 0, color: (stats.non_compliant || 0) > 0 ? 'text-red-600' : 'text-slate-400' },
              { label: 'Forwarded', value: stats.forwarded || 0, color: 'text-blue-600' },
              { label: 'Quarantined', value: stats.quarantine || 0, color: (stats.quarantine || 0) > 0 ? 'text-amber-600' : 'text-slate-400' },
              { label: 'Rejected', value: stats.reject || 0, color: (stats.reject || 0) > 0 ? 'text-red-600' : 'text-slate-400' },
            ].map(s => (
              <div key={s.label} className="bg-white p-3 text-center">
                <p className={cn("text-lg font-bold", s.color)}>{s.value.toLocaleString()}</p>
                <p className="text-[9px] text-slate-400 uppercase tracking-wider font-medium">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 lg:divide-x divide-y lg:divide-y-0 divide-slate-100">
            {/* Top Sources */}
            <div className="p-4">
              <h5 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5" /> Top Sending Sources
              </h5>
              {sources.length > 0 ? (
                <div>
                  {sources.map((src, i) => (
                    <SourceRow key={i} source={src} maxCount={maxSourceCount} />
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic py-2">No source data available</p>
              )}
            </div>

            {/* DNS Records */}
            <div className="p-4">
              <h5 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <FileCode className="w-3.5 h-3.5" /> DNS Records
              </h5>
              {(dns.dmarc_record || dns.spf_record || dns.dkim_record || dns.mx_records) ? (
                <div>
                  <DnsRecordRow label="DMARC" value={dns.dmarc_record} icon={Shield} />
                  <DnsRecordRow label="SPF" value={dns.spf_record} icon={Lock} />
                  <DnsRecordRow label="DKIM" value={dns.dkim_record} icon={Lock} />
                  <DnsRecordRow label="MX" value={dns.mx_records} icon={Mail} />
                  <DnsRecordRow label="BIMI" value={dns.bimi_record} icon={Eye} />
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic py-2">No DNS record data available. Click Sync to fetch.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

export default function DmarcReportTab({ customerId, dmarcMapping, queryClient }) {
  const [syncing, setSyncing] = useState(false);
  const [liveData, setLiveData] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const cachedData = useMemo(() => {
    if (!dmarcMapping?.cached_data) return null;
    return typeof dmarcMapping.cached_data === 'string'
      ? (() => { try { return JSON.parse(dmarcMapping.cached_data); } catch { return null; } })()
      : dmarcMapping.cached_data;
  }, [dmarcMapping?.cached_data]);

  const data = liveData || cachedData;
  const fromCache = !liveData && !!cachedData;

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await client.functions.invoke('syncDmarcReport', {
        action: 'sync_customer',
        customer_id: customerId,
      });
      if (res.success) {
        setLiveData(res.data);
        toast.success('DMARC data refreshed');
        queryClient?.invalidateQueries({ queryKey: ['dmarc-mapping', customerId] });
      } else {
        toast.error(res.error || 'Sync failed');
      }
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSyncing(false);
    }
  };

  const filteredDomains = useMemo(() => {
    if (!data?.domains) return [];
    if (!searchTerm) return data.domains;
    const term = searchTerm.toLowerCase();
    return data.domains.filter(d => d.address.toLowerCase().includes(term));
  }, [data?.domains, searchTerm]);

  if (!dmarcMapping) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
          <Shield className="w-8 h-8 text-slate-300" />
        </div>
        <p className="text-sm font-semibold text-slate-700">DMARC Not Configured</p>
        <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">Go to Adminland → Integrations → DMARC Report to map a domain for this customer.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-50 to-emerald-50/50 rounded-2xl border p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
              <Shield className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">DMARC Report</h3>
              <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                <span>{dmarcMapping.dmarc_domain_name || dmarcMapping.dmarc_account_name}</span>
                {fromCache && dmarcMapping?.last_synced && (
                  <span className="flex items-center gap-1 text-slate-400">
                    <Clock className="w-3 h-3" />
                    {new Date(dmarcMapping.last_synced).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
          </div>
          <Button onClick={handleSync} disabled={syncing} variant="outline" size="sm" className="gap-2">
            <RefreshCw className={cn("w-4 h-4", syncing && "animate-spin")} />
            Sync
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                  <Globe className="w-4.5 h-4.5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-xl font-bold text-slate-900">{data.totalDomains || 0}</p>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider">Domains</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                  <Mail className="w-4.5 h-4.5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xl font-bold text-slate-900">{(data.totalMessages || 0).toLocaleString()}</p>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider">Messages</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", complianceBg(data.complianceRate || 0))}>
                  <ShieldCheck className={cn("w-4.5 h-4.5", complianceColor(data.complianceRate || 0))} />
                </div>
                <div>
                  <p className={cn("text-xl font-bold", complianceColor(data.complianceRate || 0))}>{data.complianceRate || 0}%</p>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider">Compliance</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", (data.totalQuarantined || 0) > 0 ? "bg-amber-100" : "bg-slate-100")}>
                  <AlertTriangle className={cn("w-4.5 h-4.5", (data.totalQuarantined || 0) > 0 ? "text-amber-600" : "text-slate-400")} />
                </div>
                <div>
                  <p className="text-xl font-bold text-slate-900">{(data.totalQuarantined || 0).toLocaleString()}</p>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider">Quarantined</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", (data.totalRejected || 0) > 0 ? "bg-red-100" : "bg-slate-100")}>
                  <ShieldX className={cn("w-4.5 h-4.5", (data.totalRejected || 0) > 0 ? "text-red-600" : "text-slate-400")} />
                </div>
                <div>
                  <p className="text-xl font-bold text-slate-900">{(data.totalRejected || 0).toLocaleString()}</p>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider">Rejected</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Domain List */}
      {data?.domains?.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-slate-700">
              Domains ({data.domains.length})
            </h4>
            {data.domains.length > 3 && (
              <div className="relative w-48">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Filter domains..."
                  className="h-8 text-xs pl-8"
                />
              </div>
            )}
          </div>
          <div className="space-y-3">
            {filteredDomains.map(domain => (
              <DomainCard key={domain.id} domain={domain} />
            ))}
          </div>
          {data.period && (
            <p className="text-[10px] text-slate-400 text-center mt-4">
              Stats from {data.period.start} to {data.period.end}
            </p>
          )}
        </div>
      )}

      {/* No data */}
      {!data && !syncing && (
        <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed">
          <Shield className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-600 font-medium">No DMARC data cached</p>
          <p className="text-xs text-slate-400 mt-1">Click Sync to pull the latest report data</p>
          <Button onClick={handleSync} variant="outline" size="sm" className="mt-4 gap-2">
            <RefreshCw className="w-4 h-4" />
            Sync Now
          </Button>
        </div>
      )}
    </div>
  );
}
