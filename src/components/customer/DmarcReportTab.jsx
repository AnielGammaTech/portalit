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
  AlertTriangle,
  BarChart3,
  Search,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { AnimatedCounter } from "@/components/ui/animated-counter";

function DomainRow({ domain }) {
  const [expanded, setExpanded] = useState(false);
  const stats = domain.stats || {};
  const isPublished = domain.dmarc_status === 'dmarc_record_published';
  const complianceRate = stats.total > 0 ? Math.round((stats.compliant / stats.total) * 100) : null;

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 transition-colors text-left"
      >
        <div className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
          isPublished ? "bg-emerald-100" : "bg-amber-100"
        )}>
          {isPublished ? (
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          ) : (
            <ShieldAlert className="w-4 h-4 text-amber-600" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-900 truncate">{domain.address}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <Badge variant={isPublished ? 'flat-success' : 'flat-warning'} className="text-[10px]">
              {isPublished ? 'DMARC Active' : 'DMARC Inactive'}
            </Badge>
            {domain.parked_domain && (
              <Badge variant="secondary" className="text-[10px]">Parked</Badge>
            )}
            {domain.tags?.map(tag => (
              <Badge key={tag.id} variant="secondary" className="text-[10px]" style={{ borderColor: tag.color }}>
                {tag.name}
              </Badge>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-4 flex-shrink-0">
          {complianceRate !== null && (
            <div className="text-right">
              <p className={cn(
                "text-lg font-bold",
                complianceRate >= 90 ? "text-emerald-600" : complianceRate >= 70 ? "text-amber-600" : "text-red-600"
              )}>
                {complianceRate}%
              </p>
              <p className="text-[10px] text-slate-500">compliance</p>
            </div>
          )}
          <div className="text-right">
            <p className="text-sm font-semibold text-slate-700">{(stats.total || 0).toLocaleString()}</p>
            <p className="text-[10px] text-slate-500">messages</p>
          </div>
          {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t bg-slate-50 p-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white rounded-lg p-3 border text-center">
              <p className="text-lg font-bold text-emerald-600">{(stats.compliant || 0).toLocaleString()}</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">Compliant</p>
            </div>
            <div className="bg-white rounded-lg p-3 border text-center">
              <p className={cn("text-lg font-bold", (stats.non_compliant || 0) > 0 ? "text-red-600" : "text-slate-400")}>
                {(stats.non_compliant || 0).toLocaleString()}
              </p>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">Non-Compliant</p>
            </div>
            <div className="bg-white rounded-lg p-3 border text-center">
              <p className={cn("text-lg font-bold", (stats.quarantine || 0) > 0 ? "text-amber-600" : "text-slate-400")}>
                {(stats.quarantine || 0).toLocaleString()}
              </p>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">Quarantined</p>
            </div>
            <div className="bg-white rounded-lg p-3 border text-center">
              <p className={cn("text-lg font-bold", (stats.reject || 0) > 0 ? "text-red-600" : "text-slate-400")}>
                {(stats.reject || 0).toLocaleString()}
              </p>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">Rejected</p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
            {domain.rua_report && <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-emerald-500" /> RUA Reports</span>}
            {domain.ruf_report && <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-emerald-500" /> RUF Reports</span>}
            {domain.mta_sts_status === 'mta_sts_active' && <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-emerald-500" /> MTA-STS Active</span>}
          </div>
        </div>
      )}
    </div>
  );
}

export default function DmarcReportTab({ customerId, dmarcMapping, queryClient }) {
  const [syncing, setSyncing] = useState(false);
  const [liveData, setLiveData] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Parse cached data
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
      <div className="text-center py-12">
        <Globe className="w-10 h-10 text-slate-300 mx-auto mb-3" />
        <p className="text-sm font-medium text-slate-600">DMARC Report not configured</p>
        <p className="text-xs text-slate-400 mt-1">Go to Adminland → Integrations to map this customer's DMARC Report account.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">DMARC Report</h3>
          <p className="text-sm text-slate-500">Account: {dmarcMapping.dmarc_account_name}</p>
        </div>
        <div className="flex items-center gap-2">
          {fromCache && dmarcMapping?.last_synced && (
            <span className="text-xs text-slate-400">
              Cached {new Date(dmarcMapping.last_synced).toLocaleDateString()}
            </span>
          )}
          <Button onClick={handleSync} disabled={syncing} variant="outline" size="sm" className="gap-2">
            <RefreshCw className={cn("w-4 h-4", syncing && "animate-spin")} />
            {syncing ? 'Syncing...' : fromCache ? 'Refresh' : 'Sync'}
          </Button>
        </div>
      </div>

      {/* Stats */}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl border p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                <Globe className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <AnimatedCounter value={data.totalDomains || 0} className="text-2xl font-bold text-slate-900" />
                <p className="text-xs text-slate-500">Domains</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{(data.totalMessages || 0).toLocaleString()}</p>
                <p className="text-xs text-slate-500">Messages (30d)</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-10 h-10 rounded-lg flex items-center justify-center",
                (data.complianceRate || 0) >= 90 ? "bg-emerald-100" : (data.complianceRate || 0) >= 70 ? "bg-amber-100" : "bg-red-100"
              )}>
                <Shield className={cn(
                  "w-5 h-5",
                  (data.complianceRate || 0) >= 90 ? "text-emerald-600" : (data.complianceRate || 0) >= 70 ? "text-amber-600" : "text-red-600"
                )} />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{data.complianceRate || 0}%</p>
                <p className="text-xs text-slate-500">Compliance</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-10 h-10 rounded-lg flex items-center justify-center",
                (data.totalRejected || 0) > 0 ? "bg-red-100" : "bg-emerald-100"
              )}>
                <ShieldX className={cn(
                  "w-5 h-5",
                  (data.totalRejected || 0) > 0 ? "text-red-600" : "text-emerald-600"
                )} />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{(data.totalRejected || 0).toLocaleString()}</p>
                <p className="text-xs text-slate-500">Rejected</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Domain List */}
      {data?.domains?.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-slate-700">
              Domains ({data.domains.length})
            </h4>
            {data.domains.length > 5 && (
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
          <div className="space-y-2">
            {filteredDomains.map(domain => (
              <DomainRow key={domain.id} domain={domain} />
            ))}
          </div>
          {data.period && (
            <p className="text-xs text-slate-400 text-center mt-3">
              Stats from {data.period.start} to {data.period.end}
            </p>
          )}
        </div>
      )}

      {/* No data state */}
      {!data && !syncing && (
        <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed">
          <Globe className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-600 font-medium">No DMARC data cached</p>
          <p className="text-xs text-slate-400 mt-1">Click Sync to pull the latest data</p>
          <Button onClick={handleSync} variant="outline" size="sm" className="mt-3 gap-2">
            <RefreshCw className="w-4 h-4" />
            Sync Now
          </Button>
        </div>
      )}
    </div>
  );
}
