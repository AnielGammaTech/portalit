import React, { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { client, supabase } from '@/api/client';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  RefreshCw,
  CheckCircle2,
  Building2,
  Trash2,
  Clock,
  Cloud,
  Users,
  Search,
  ChevronLeft,
  ChevronRight,
  Wand2,
  XCircle,
  ChevronDown,
  Mail,
  Shield,
} from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from 'sonner';
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from 'date-fns';

const ITEMS_PER_PAGE = 10;
const MAPPINGS_PER_PAGE = 10;

export default function CIPPConfig() {
  const [testing, setTesting] = useState(false);
  const [configStatus, setConfigStatus] = useState('not_configured');
  const [connectionMeta, setConnectionMeta] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncingCustomerId, setSyncingCustomerId] = useState(null);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [errorDetails, setErrorDetails] = useState(null);
  const [showErrorDetails, setShowErrorDetails] = useState(false);

  // Tenant mapping
  const [loadingTenants, setLoadingTenants] = useState(false);
  const [cippTenants, setCippTenants] = useState([]);
  const [showMappingView, setShowMappingView] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [tenantSelections, setTenantSelections] = useState({});
  const [autoMatching, setAutoMatching] = useState(false);
  const [mappingSearchQuery, setMappingSearchQuery] = useState('');
  const [mappingPage, setMappingPage] = useState(1);

  const queryClient = useQueryClient();

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => client.entities.Customer.list(),
  });

  const { data: mappings = [], refetch: refetchMappings } = useQuery({
    queryKey: ['cipp_mappings'],
    queryFn: () => client.entities.CIPPMapping.list(),
  });

  const fetchLastSync = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('sync_logs')
        .select('completed_at')
        .eq('integration_type', 'cipp')
        .eq('status', 'success')
        .order('completed_at', { ascending: false })
        .limit(1);
      if (data?.[0]) setLastSyncTime(data[0].completed_at);
    } catch (_err) { /* ignore */ }
  }, []);

  useEffect(() => { fetchLastSync(); }, [fetchLastSync]);

  useEffect(() => {
    if (mappings.length > 0 && configStatus === 'not_configured') {
      setConfigStatus('connected');
    }
  }, [mappings, configStatus]);

  // ── Handlers ────────────────────────────────────────────────────────

  const testConnection = async () => {
    setTesting(true);
    setErrorDetails(null);
    try {
      const response = await client.functions.invoke('syncCIPP', { action: 'test_connection' });
      if (response.success) {
        setConfigStatus('connected');
        setConnectionMeta({ totalTenants: response.totalTenants });
        toast.success(response.message);
      } else {
        setConfigStatus('configured');
        setErrorDetails(response.error || 'Connection failed');
        toast.error(response.error || 'Connection failed');
      }
    } catch (error) {
      setConfigStatus('configured');
      setErrorDetails(error.message);
      toast.error(error.message);
    } finally {
      setTesting(false);
    }
  };

  const loadTenants = async () => {
    setLoadingTenants(true);
    try {
      const response = await client.functions.invoke('syncCIPP', { action: 'list_tenants' });
      if (response.success) {
        setCippTenants(response.tenants);
        setShowMappingView(true);
        setCurrentPage(1);
      } else {
        toast.error(response.error || 'Failed to load tenants');
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoadingTenants(false);
    }
  };

  const applyMapping = async (tenant, customerId) => {
    if (!customerId) return;
    const customer = customers.find((c) => c.id === customerId);
    try {
      await client.entities.CIPPMapping.create({
        customer_id: customerId,
        customer_name: customer?.name || '',
        cipp_tenant_id: tenant.tenantId,
        cipp_tenant_name: tenant.name,
        cipp_default_domain: tenant.defaultDomain,
      });
      toast.success(`Mapped ${tenant.name} successfully!`);
      refetchMappings();
      setTenantSelections((prev) => ({ ...prev, [tenant.tenantId]: '' }));
    } catch (error) {
      toast.error(error.message);
    }
  };

  const deleteMapping = async (mappingId) => {
    try {
      await client.entities.CIPPMapping.delete(mappingId);
      toast.success('Mapping removed');
      refetchMappings();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const syncCustomer = async (mapping) => {
    setSyncingCustomerId(mapping.id);
    try {
      const response = await client.functions.invoke('syncCIPP', {
        action: 'sync_customer',
        customerId: mapping.customer_id,
        tenantId: mapping.cipp_tenant_id,
      });
      if (response.success) {
        toast.success(response.message);
        refetchMappings();
      } else {
        toast.error(response.message || 'Sync failed');
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSyncingCustomerId(null);
    }
  };

  const autoMatchTenants = () => {
    setAutoMatching(true);
    const mappedTenantIds = new Set(mappings.map((m) => m.cipp_tenant_id));
    const newSelections = {};
    let matchCount = 0;

    for (const tenant of cippTenants) {
      if (mappedTenantIds.has(tenant.tenantId)) continue;
      const tenantNameLower = (tenant.name || '').toLowerCase();
      const domainLower = (tenant.defaultDomain || '').toLowerCase().split('.')[0];

      const match = customers.find((c) => {
        const custLower = (c.name || '').toLowerCase();
        return custLower === tenantNameLower
          || custLower.includes(tenantNameLower)
          || tenantNameLower.includes(custLower)
          || custLower.includes(domainLower);
      });

      if (match) {
        newSelections[tenant.tenantId] = match.id;
        matchCount++;
      }
    }

    setTenantSelections((prev) => ({ ...prev, ...newSelections }));
    toast.success(`Auto-matched ${matchCount} tenant${matchCount !== 1 ? 's' : ''}`);
    setAutoMatching(false);
  };

  // ── Filters ─────────────────────────────────────────────────────────

  const mappedTenantIds = new Set(mappings.map((m) => m.cipp_tenant_id));

  const filteredTenants = cippTenants.filter((t) => {
    const matchesSearch = !searchQuery
      || (t.name || '').toLowerCase().includes(searchQuery.toLowerCase())
      || (t.defaultDomain || '').toLowerCase().includes(searchQuery.toLowerCase());
    if (filterTab === 'mapped') return matchesSearch && mappedTenantIds.has(t.tenantId);
    if (filterTab === 'unmapped') return matchesSearch && !mappedTenantIds.has(t.tenantId);
    return matchesSearch;
  });

  const totalPages = Math.max(1, Math.ceil(filteredTenants.length / ITEMS_PER_PAGE));
  const paginatedTenants = filteredTenants.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const filteredMappings = mappings.filter((m) =>
    !mappingSearchQuery
    || (m.customer_name || '').toLowerCase().includes(mappingSearchQuery.toLowerCase())
    || (m.cipp_tenant_name || '').toLowerCase().includes(mappingSearchQuery.toLowerCase())
  );

  const mappingTotalPages = Math.max(1, Math.ceil(filteredMappings.length / MAPPINGS_PER_PAGE));
  const paginatedMappings = filteredMappings.slice(
    (mappingPage - 1) * MAPPINGS_PER_PAGE,
    mappingPage * MAPPINGS_PER_PAGE
  );

  // ── Render ──────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Connection Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={cn(
            'w-3 h-3 rounded-full',
            configStatus === 'connected' ? 'bg-emerald-500' : 'bg-slate-300'
          )} />
          <span className="text-sm font-medium text-slate-600">
            {configStatus === 'connected'
              ? `Connected${connectionMeta ? ` · ${connectionMeta.totalTenants} tenants` : ''}`
              : 'Not connected'}
          </span>
          {lastSyncTime && (
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Last sync {formatDistanceToNow(new Date(lastSyncTime), { addSuffix: true })}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={testConnection}
            disabled={testing}
          >
            {testing ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Cloud className="w-4 h-4 mr-2" />}
            Test Connection
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={loadTenants}
            disabled={loadingTenants}
          >
            {loadingTenants ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Building2 className="w-4 h-4 mr-2" />}
            Load Tenants
          </Button>
        </div>
      </div>

      {/* Error Details */}
      {errorDetails && (
        <Collapsible open={showErrorDetails} onOpenChange={setShowErrorDetails}>
          <CollapsibleTrigger className="flex items-center gap-2 text-sm text-red-600 hover:text-red-700">
            <XCircle className="w-4 h-4" />
            <span>Connection error</span>
            <ChevronDown className={cn('w-3 h-3 transition-transform', showErrorDetails && 'rotate-180')} />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <pre className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 overflow-auto max-h-40 whitespace-pre-wrap">
              {errorDetails}
            </pre>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-700">
        <p className="font-medium mb-1">CIPP API Configuration</p>
        <p className="text-xs text-blue-600">
          Credentials are set via environment variables on the backend (CIPP_API_URL, CIPP_AUTH_TOKEN_URL, CIPP_AUTH_CLIENT_ID, CIPP_AUTH_CLIENT_SECRET, CIPP_AUTH_SCOPE).
          Map CIPP tenants to PortalIT customers below to sync M365 users, groups, and mailboxes.
        </p>
      </div>

      {/* Existing Mappings */}
      {mappings.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-slate-700">Mapped Customers ({mappings.length})</h4>
            {mappings.length > 5 && (
              <div className="relative w-48">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <Input
                  placeholder="Search mappings…"
                  value={mappingSearchQuery}
                  onChange={(e) => { setMappingSearchQuery(e.target.value); setMappingPage(1); }}
                  className="h-8 pl-8 text-xs"
                />
              </div>
            )}
          </div>

          <div className="space-y-2">
            {paginatedMappings.map((m) => (
              <div key={m.id} className="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{m.customer_name}</p>
                    <p className="text-xs text-slate-400 truncate">{m.cipp_tenant_name} · {m.cipp_default_domain}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {m.cached_data && (
                    <div className="flex gap-2 text-[11px] text-slate-400">
                      <span className="flex items-center gap-0.5"><Users className="w-3 h-3" /> {m.cached_data.users ?? '—'}</span>
                      <span className="flex items-center gap-0.5"><Shield className="w-3 h-3" /> {m.cached_data.groups ?? '—'}</span>
                      <span className="flex items-center gap-0.5"><Mail className="w-3 h-3" /> {m.cached_data.mailboxes ?? '—'}</span>
                    </div>
                  )}
                  {m.last_synced && (
                    <span className="text-[11px] text-slate-400 flex items-center gap-0.5">
                      <Clock className="w-3 h-3" />
                      {formatDistanceToNow(new Date(m.last_synced), { addSuffix: true })}
                    </span>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => syncCustomer(m)}
                    disabled={syncingCustomerId === m.id}
                    className="h-7 px-2"
                  >
                    <RefreshCw className={cn('w-3.5 h-3.5', syncingCustomerId === m.id && 'animate-spin')} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteMapping(m.id)}
                    className="h-7 px-2 text-red-500 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {mappingTotalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setMappingPage((p) => Math.max(1, p - 1))} disabled={mappingPage === 1}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-xs text-slate-500">{mappingPage} / {mappingTotalPages}</span>
              <Button variant="ghost" size="sm" onClick={() => setMappingPage((p) => Math.min(mappingTotalPages, p + 1))} disabled={mappingPage === mappingTotalPages}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Tenant Mapping Table */}
      {showMappingView && cippTenants.length > 0 && (
        <div className="space-y-3 border border-slate-200 rounded-xl p-4 bg-slate-50/50">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h4 className="text-sm font-semibold text-slate-700">
              CIPP Tenants ({cippTenants.length})
            </h4>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={autoMatchTenants}
                disabled={autoMatching}
                className="h-7 text-xs"
              >
                <Wand2 className="w-3 h-3 mr-1" />
                Auto-Match
              </Button>
            </div>
          </div>

          {/* Search & Filter */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <Input
                placeholder="Search tenants…"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                className="h-8 pl-8 text-xs"
              />
            </div>
            <div className="flex gap-1">
              {['all', 'unmapped', 'mapped'].map((tab) => (
                <Button
                  key={tab}
                  variant={filterTab === tab ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => { setFilterTab(tab); setCurrentPage(1); }}
                  className="h-7 text-xs capitalize"
                >
                  {tab}
                </Button>
              ))}
            </div>
          </div>

          {/* Tenant List */}
          <div className="space-y-1.5">
            {paginatedTenants.map((tenant) => {
              const isMapped = mappedTenantIds.has(tenant.tenantId);
              const selectedCustomerId = tenantSelections[tenant.tenantId] || '';

              return (
                <div
                  key={tenant.tenantId}
                  className={cn(
                    'flex items-center gap-3 bg-white rounded-lg px-3 py-2.5 border',
                    isMapped ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-200'
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{tenant.name}</p>
                    <p className="text-xs text-slate-400 truncate">{tenant.defaultDomain}</p>
                  </div>

                  {isMapped ? (
                    <Badge variant="outline" className="text-emerald-600 border-emerald-300 shrink-0">
                      <CheckCircle2 className="w-3 h-3 mr-1" /> Mapped
                    </Badge>
                  ) : (
                    <div className="flex items-center gap-2 shrink-0">
                      <Select
                        value={selectedCustomerId}
                        onValueChange={(val) => setTenantSelections((prev) => ({ ...prev, [tenant.tenantId]: val }))}
                      >
                        <SelectTrigger className="h-8 w-48 text-xs">
                          <SelectValue placeholder="Select customer…" />
                        </SelectTrigger>
                        <SelectContent>
                          {customers
                            .filter((c) => !mappings.some((m) => m.customer_id === c.id))
                            .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
                            .map((c) => (
                              <SelectItem key={c.id} value={c.id} className="text-xs">
                                {c.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        onClick={() => applyMapping(tenant, selectedCustomerId)}
                        disabled={!selectedCustomerId}
                        className="h-8 text-xs"
                      >
                        Map
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-xs text-slate-500">{currentPage} / {totalPages}</span>
              <Button variant="ghost" size="sm" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
