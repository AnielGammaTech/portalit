import React, { useState } from 'react';
import { client } from '@/api/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  CheckCircle2,
  Loader2,
  RefreshCw,
  Link2,
  Unlink,
  Globe,
  Shield,
  Search,
  ChevronDown,
  ChevronRight,
  AtSign,
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export default function DmarcReportConfig() {
  const queryClient = useQueryClient();
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [expandedAccountId, setExpandedAccountId] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [mappingInProgress, setMappingInProgress] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');

  // Fetch existing mappings
  const { data: mappings = [], isLoading: loadingMappings } = useQuery({
    queryKey: ['dmarc_report_mappings'],
    queryFn: () => client.entities.DmarcReportMapping.list(),
    staleTime: 1000 * 60 * 5,
  });

  // Fetch customers for mapping
  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => client.entities.Customer.list('name', 500),
    staleTime: 1000 * 60 * 5,
  });

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await client.functions.invoke('syncDmarcReport', { action: 'test_connection' });
      setTestResult(res);
      if (res.success) {
        toast.success(res.message);
      } else {
        toast.error(res.error);
      }
    } catch (e) {
      toast.error(e.message);
      setTestResult({ success: false, error: e.message });
    } finally {
      setTesting(false);
    }
  };

  const handleLoadAccounts = async () => {
    setLoadingAccounts(true);
    try {
      const res = await client.functions.invoke('syncDmarcReport', { action: 'list_accounts' });
      if (res.success) {
        setAccounts(res.accounts || []);
        const totalDomains = (res.accounts || []).reduce((s, a) => s + (a.domainCount || 0), 0);
        toast.success(`Loaded ${res.accounts?.length || 0} accounts with ${totalDomains} domains`);
        // Auto-expand the first account if it has domains
        const firstWithDomains = (res.accounts || []).find(a => a.domainCount > 0);
        if (firstWithDomains) {
          setExpandedAccountId(firstWithDomains.id);
        }
      } else {
        toast.error(res.error);
      }
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoadingAccounts(false);
    }
  };

  const handleMapDomain = async (account, domain, customerId) => {
    const customer = customers.find(c => c.id === customerId);
    if (!customer) return;

    setMappingInProgress(`${account.id}-${domain.id}`);
    try {
      await client.entities.DmarcReportMapping.create({
        customer_id: customerId,
        customer_name: customer.name,
        dmarc_account_id: String(account.id),
        dmarc_account_name: account.title,
        dmarc_domain_id: String(domain.id),
        dmarc_domain_name: domain.address,
      });
      toast.success(`Mapped ${domain.address} → ${customer.name}`);
      queryClient.invalidateQueries({ queryKey: ['dmarc_report_mappings'] });
    } catch (e) {
      toast.error(e.message);
    } finally {
      setMappingInProgress(null);
    }
  };

  const handleAutoMap = async () => {
    let mapped = 0;
    for (const account of accounts) {
      for (const domain of (account.domains || [])) {
        // Skip already-mapped domains
        if (mappings.find(m => m.dmarc_domain_id === String(domain.id))) continue;

        // Try to match domain address to a customer name
        const domainName = (domain.address || '').toLowerCase().replace(/\.\w+$/, '');
        const match = customers.find(c => {
          const custName = c.name.toLowerCase();
          return custName.includes(domainName) || domainName.includes(custName);
        });

        if (match && !mappings.find(m => m.customer_id === match.id && m.dmarc_domain_id === String(domain.id))) {
          try {
            await client.entities.DmarcReportMapping.create({
              customer_id: match.id,
              customer_name: match.name,
              dmarc_account_id: String(account.id),
              dmarc_account_name: account.title,
              dmarc_domain_id: String(domain.id),
              dmarc_domain_name: domain.address,
            });
            mapped++;
          } catch { /* skip */ }
        }
      }
    }
    if (mapped > 0) {
      toast.success(`Auto-mapped ${mapped} domains`);
      queryClient.invalidateQueries({ queryKey: ['dmarc_report_mappings'] });
    } else {
      toast.info('No new matches found');
    }
  };

  const handleUnmap = async (mappingId) => {
    try {
      await client.entities.DmarcReportMapping.delete(mappingId);
      toast.success('Mapping removed');
      queryClient.invalidateQueries({ queryKey: ['dmarc_report_mappings'] });
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleSyncAll = async () => {
    setSyncing(true);
    try {
      const res = await client.functions.invoke('syncDmarcReport', { action: 'sync_all' });
      if (res.success) {
        toast.success(`Synced ${res.synced}/${res.total} customers`);
        queryClient.invalidateQueries({ queryKey: ['dmarc_report_mappings'] });
      } else {
        toast.error(res.error);
      }
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSyncing(false);
    }
  };

  const handleSyncCustomer = async (mapping) => {
    try {
      const res = await client.functions.invoke('syncDmarcReport', {
        action: 'sync_customer',
        customer_id: mapping.customer_id,
      });
      if (res.success) {
        toast.success(`Synced ${mapping.customer_name} — ${res.data?.totalDomains || 0} domains`);
        queryClient.invalidateQueries({ queryKey: ['dmarc_report_mappings'] });
      } else {
        toast.error(res.error);
      }
    } catch (e) {
      toast.error(e.message);
    }
  };

  // Check if a domain is already mapped
  const isDomainMapped = (domainId) => mappings.some(m => m.dmarc_domain_id === String(domainId));

  // Filter customers for dropdowns
  const filteredCustomers = customerSearch
    ? customers.filter(c =>
        c.name.toLowerCase().includes(customerSearch.toLowerCase())
      )
    : customers;

  // Filter accounts by search
  const filteredAccounts = searchTerm
    ? accounts.filter(a =>
        a.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (a.domains || []).some(d => (d.address || '').toLowerCase().includes(searchTerm.toLowerCase()))
      )
    : accounts;

  return (
    <div className="space-y-6">
      {/* Connection Test */}
      <div className="bg-white rounded-xl border p-5">
        <h3 className="text-sm font-semibold text-slate-900 mb-3">API Connection</h3>
        <p className="text-xs text-slate-500 mb-4">
          Token is set via <code className="bg-slate-100 px-1 py-0.5 rounded text-[11px]">DMARC_REPORT_API_TOKEN</code> environment variable.
          Generate at dmarcreport.com → Profile → API Tokens.
        </p>
        <div className="flex items-center gap-3">
          <Button onClick={handleTestConnection} disabled={testing} variant="outline" size="sm" className="gap-2">
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
            Test Connection
          </Button>
          {testResult && (
            <Badge variant={testResult.success ? 'flat-success' : 'flat-destructive'}>
              {testResult.success ? `✓ ${testResult.message}` : `✗ ${testResult.error}`}
            </Badge>
          )}
        </div>
      </div>

      {/* Domain Mapping */}
      <div className="bg-white rounded-xl border p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Domain Mapping</h3>
            <p className="text-xs text-slate-500 mt-0.5">Map DMARC domains to your customers (expand accounts to see domains)</p>
          </div>
          <div className="flex gap-2">
            {accounts.length > 0 && (
              <Button onClick={handleAutoMap} variant="outline" size="sm" className="gap-2">
                <Link2 className="w-4 h-4" />
                Auto-Map
              </Button>
            )}
            <Button onClick={handleLoadAccounts} disabled={loadingAccounts} variant="outline" size="sm" className="gap-2">
              {loadingAccounts ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Load Accounts
            </Button>
          </div>
        </div>

        {/* Accounts with expandable domains */}
        {accounts.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Accounts ({accounts.length})
              </h4>
              {accounts.length > 3 && (
                <div className="relative flex-1 max-w-xs">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder="Filter accounts or domains..."
                    className="h-7 text-xs pl-8"
                  />
                </div>
              )}
            </div>
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {filteredAccounts.map(account => {
                const isExpanded = expandedAccountId === account.id;
                const unmappedDomains = (account.domains || []).filter(d => !isDomainMapped(d.id));
                const mappedDomainsCount = (account.domains || []).length - unmappedDomains.length;

                return (
                  <div key={account.id} className="border rounded-lg overflow-hidden">
                    {/* Account header — click to expand */}
                    <button
                      className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
                      onClick={() => setExpandedAccountId(isExpanded ? null : account.id)}
                    >
                      <div className="flex items-center gap-3">
                        {isExpanded
                          ? <ChevronDown className="w-4 h-4 text-slate-400" />
                          : <ChevronRight className="w-4 h-4 text-slate-400" />
                        }
                        <Globe className="w-4 h-4 text-slate-500" />
                        <div>
                          <p className="text-sm font-medium text-slate-900">{account.title}</p>
                          <p className="text-xs text-slate-500">
                            {account.domainCount || 0} domain{(account.domainCount || 0) !== 1 ? 's' : ''}
                            {mappedDomainsCount > 0 && (
                              <span className="text-emerald-600 ml-1">
                                · {mappedDomainsCount} mapped
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[10px]">
                        {account.ownership}
                      </Badge>
                    </button>

                    {/* Expanded domains list */}
                    {isExpanded && (
                      <div className="border-t divide-y divide-slate-50">
                        {(account.domains || []).length === 0 ? (
                          <div className="p-4 text-center text-xs text-slate-400">
                            No domains found under this account. Domains may need to be added in dmarcreport.com first.
                          </div>
                        ) : (
                          (account.domains || []).map(domain => {
                            const mapped = isDomainMapped(domain.id);
                            const existingMapping = mappings.find(m => m.dmarc_domain_id === String(domain.id));

                            return (
                              <div
                                key={domain.id}
                                className={cn(
                                  'flex items-center justify-between px-4 py-2.5 pl-12',
                                  mapped ? 'bg-emerald-50/50' : 'hover:bg-slate-50'
                                )}
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <AtSign className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium text-slate-900 truncate">{domain.address}</p>
                                    <div className="flex items-center gap-2">
                                      {domain.dmarc_status === 'dmarc_record_published' ? (
                                        <Badge variant="flat-success" className="text-[9px] py-0">DMARC Active</Badge>
                                      ) : (
                                        <Badge variant="flat-warning" className="text-[9px] py-0">
                                          {(domain.dmarc_status || 'unknown').replace(/_/g, ' ')}
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {mapped ? (
                                  <div className="flex items-center gap-2 shrink-0">
                                    <Badge variant="flat-success" className="text-[10px]">
                                      → {existingMapping?.customer_name}
                                    </Badge>
                                    <Button
                                      onClick={() => handleUnmap(existingMapping?.id)}
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 w-7 p-0 text-red-500 hover:text-red-600"
                                    >
                                      <Unlink className="w-3.5 h-3.5" />
                                    </Button>
                                  </div>
                                ) : (
                                  <select
                                    className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white max-w-[200px] shrink-0"
                                    onChange={e => {
                                      if (e.target.value) handleMapDomain(account, domain, e.target.value);
                                      e.target.value = '';
                                    }}
                                    defaultValue=""
                                    disabled={mappingInProgress === `${account.id}-${domain.id}`}
                                  >
                                    <option value="">Map to customer…</option>
                                    {filteredCustomers.slice(0, 50).map(c => (
                                      <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                  </select>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Existing mappings */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Mapped Domains ({mappings.length})
            </h4>
            {mappings.length > 0 && (
              <Button onClick={handleSyncAll} disabled={syncing} variant="outline" size="sm" className="gap-2">
                {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Sync All
              </Button>
            )}
          </div>
          {loadingMappings ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            </div>
          ) : mappings.length === 0 ? (
            <p className="text-sm text-slate-500 py-4 text-center">No domains mapped yet. Load accounts above, expand them, and map individual domains.</p>
          ) : (
            <div className="space-y-2">
              {mappings.map(mapping => {
                const cached = mapping.cached_data;
                return (
                  <div key={mapping.id} className="flex items-center justify-between p-3 border rounded-lg hover:shadow-sm transition-shadow">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                        <AtSign className="w-4 h-4 text-emerald-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">{mapping.customer_name}</p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-xs text-slate-500">{mapping.dmarc_domain_name || mapping.dmarc_account_name}</p>
                          <span className="text-[10px] text-slate-400">({mapping.dmarc_account_name})</span>
                          {cached && (
                            <Badge variant="flat-success" className="text-[10px]">
                              {cached.totalDomains || 0} domain{(cached.totalDomains || 0) !== 1 ? 's' : ''} · {cached.complianceRate || 0}% compliance
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {mapping.last_synced && (
                        <span className="text-[10px] text-slate-400">
                          {new Date(mapping.last_synced).toLocaleDateString()}
                        </span>
                      )}
                      <Button onClick={() => handleSyncCustomer(mapping)} variant="ghost" size="sm" className="h-7 w-7 p-0">
                        <RefreshCw className="w-3.5 h-3.5" />
                      </Button>
                      <Button onClick={() => handleUnmap(mapping.id)} variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500 hover:text-red-600">
                        <Unlink className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
