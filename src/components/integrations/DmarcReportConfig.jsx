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
  Building2,
  Check,
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

/**
 * Searchable customer picker popover — used per-domain row.
 */
function CustomerPicker({ customers, mappings, onSelect, disabled }) {
  const [open, setOpen] = useState(false);

  // Show all customers — multiple domains can map to the same customer
  const available = customers;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs font-normal text-slate-500 hover:text-slate-700 border-dashed"
          disabled={disabled}
        >
          <Building2 className="w-3.5 h-3.5" />
          Map to customer
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="end" side="bottom">
        <Command>
          <CommandInput placeholder="Search customers..." className="h-9" />
          <CommandList>
            <CommandEmpty>No customers found.</CommandEmpty>
            <CommandGroup className="max-h-56 overflow-y-auto">
              {available.map(c => (
                <CommandItem
                  key={c.id}
                  value={c.name}
                  onSelect={() => {
                    onSelect(c.id);
                    setOpen(false);
                  }}
                  className="text-sm"
                >
                  <Building2 className="w-3.5 h-3.5 mr-2 text-slate-400" />
                  <span className="truncate">{c.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

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
      if (res.success) toast.success(res.message);
      else toast.error(res.error);
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
        const firstWithDomains = (res.accounts || []).find(a => a.domainCount > 0);
        if (firstWithDomains) setExpandedAccountId(firstWithDomains.id);
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
        if (mappings.find(m => m.dmarc_domain_id === String(domain.id))) continue;
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

  const isDomainMapped = (domainId) => mappings.some(m => m.dmarc_domain_id === String(domainId));

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
            <p className="text-xs text-slate-500 mt-0.5">Expand accounts to see domains, then assign each to a customer</p>
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
            <div className="flex items-center gap-3 mb-3">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider shrink-0">
                Accounts ({accounts.length})
              </h4>
              <div className="relative flex-1 max-w-xs">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Filter accounts or domains..."
                  className="h-7 text-xs pl-8"
                />
              </div>
            </div>
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {filteredAccounts.map(account => {
                const isExpanded = expandedAccountId === account.id;
                const accountDomains = account.domains || [];
                const unmappedDomains = accountDomains.filter(d => !isDomainMapped(d.id));
                const mappedDomainsCount = accountDomains.length - unmappedDomains.length;

                return (
                  <div key={account.id} className="border rounded-xl overflow-hidden">
                    {/* Account header */}
                    <button
                      className={cn(
                        "w-full flex items-center justify-between p-3.5 transition-colors text-left",
                        isExpanded ? "bg-slate-100" : "bg-slate-50 hover:bg-slate-100"
                      )}
                      onClick={() => setExpandedAccountId(isExpanded ? null : account.id)}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-7 h-7 rounded-lg flex items-center justify-center transition-colors",
                          isExpanded ? "bg-slate-200" : "bg-white"
                        )}>
                          {isExpanded
                            ? <ChevronDown className="w-4 h-4 text-slate-500" />
                            : <ChevronRight className="w-4 h-4 text-slate-400" />
                          }
                        </div>
                        <Globe className="w-4 h-4 text-slate-500" />
                        <div>
                          <p className="text-sm font-medium text-slate-900">{account.title}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-slate-500">
                              {accountDomains.length} domain{accountDomains.length !== 1 ? 's' : ''}
                            </span>
                            {mappedDomainsCount > 0 && (
                              <Badge variant="flat-success" className="text-[9px] py-0 px-1.5">
                                {mappedDomainsCount} mapped
                              </Badge>
                            )}
                            {unmappedDomains.length > 0 && (
                              <Badge variant="outline" className="text-[9px] py-0 px-1.5 text-amber-600 border-amber-200">
                                {unmappedDomains.length} unmapped
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        {account.ownership}
                      </Badge>
                    </button>

                    {/* Expanded domains */}
                    {isExpanded && (
                      <div className="border-t bg-white">
                        {accountDomains.length === 0 ? (
                          <div className="p-6 text-center">
                            <Globe className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                            <p className="text-xs text-slate-400">No domains found under this account.</p>
                            <p className="text-[10px] text-slate-300 mt-1">Add domains in dmarcreport.com first.</p>
                          </div>
                        ) : (
                          <div className="divide-y divide-slate-100">
                            {accountDomains.map(domain => {
                              const mapped = isDomainMapped(domain.id);
                              const existingMapping = mappings.find(m => m.dmarc_domain_id === String(domain.id));
                              const isLoading = mappingInProgress === `${account.id}-${domain.id}`;

                              return (
                                <div
                                  key={domain.id}
                                  className={cn(
                                    'flex items-center justify-between px-4 py-3 pl-14 transition-colors',
                                    mapped ? 'bg-emerald-50/40' : 'hover:bg-slate-50/70'
                                  )}
                                >
                                  <div className="flex items-center gap-3 min-w-0 flex-1">
                                    <div className={cn(
                                      "w-7 h-7 rounded-lg flex items-center justify-center shrink-0",
                                      mapped ? "bg-emerald-100" : "bg-slate-100"
                                    )}>
                                      <AtSign className={cn(
                                        "w-3.5 h-3.5",
                                        mapped ? "text-emerald-600" : "text-slate-400"
                                      )} />
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-sm font-medium text-slate-900 truncate">{domain.address}</p>
                                      <div className="flex items-center gap-1.5 mt-0.5">
                                        {domain.dmarc_status === 'dmarc_record_published' ? (
                                          <Badge className="bg-emerald-100 text-emerald-700 border-0 text-[9px] py-0 px-1.5 font-medium">
                                            <CheckCircle2 className="w-2.5 h-2.5 mr-0.5" />
                                            DMARC Active
                                          </Badge>
                                        ) : (
                                          <Badge className="bg-amber-100 text-amber-700 border-0 text-[9px] py-0 px-1.5 font-medium">
                                            {(domain.dmarc_status || 'unknown').replace(/_/g, ' ')}
                                          </Badge>
                                        )}
                                        {mapped && existingMapping && (
                                          <span className="text-[10px] text-emerald-600 font-medium">
                                            → {existingMapping.customer_name}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2 shrink-0 ml-3">
                                    {isLoading ? (
                                      <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                                    ) : mapped ? (
                                      <Button
                                        onClick={() => handleUnmap(existingMapping?.id)}
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 px-2 gap-1.5 text-xs text-red-500 hover:text-red-600 hover:bg-red-50"
                                      >
                                        <Unlink className="w-3.5 h-3.5" />
                                        Unmap
                                      </Button>
                                    ) : (
                                      <CustomerPicker
                                        customers={customers}
                                        mappings={mappings}
                                        onSelect={(custId) => handleMapDomain(account, domain, custId)}
                                        disabled={!!mappingInProgress}
                                      />
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
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
            <div className="text-center py-8">
              <AtSign className="w-8 h-8 text-slate-200 mx-auto mb-2" />
              <p className="text-sm text-slate-500">No domains mapped yet</p>
              <p className="text-xs text-slate-400 mt-1">Load accounts above, expand them, and map domains to customers</p>
            </div>
          ) : (
            <div className="space-y-2">
              {mappings.map(mapping => {
                const cached = mapping.cached_data;
                return (
                  <div key={mapping.id} className="flex items-center justify-between p-3 border rounded-xl hover:shadow-sm transition-shadow bg-white">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                        <AtSign className="w-4 h-4 text-emerald-600" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-slate-900 truncate">{mapping.customer_name}</p>
                          {cached && (
                            <Badge className="bg-emerald-100 text-emerald-700 border-0 text-[9px] py-0 px-1.5">
                              {cached.complianceRate || 0}% compliant
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-xs text-slate-500 font-medium">{mapping.dmarc_domain_name || mapping.dmarc_account_name}</span>
                          <span className="text-[10px] text-slate-300">·</span>
                          <span className="text-[10px] text-slate-400">{mapping.dmarc_account_name}</span>
                          {cached?.totalDomains > 0 && (
                            <>
                              <span className="text-[10px] text-slate-300">·</span>
                              <span className="text-[10px] text-slate-400">{cached.totalDomains} domain{cached.totalDomains !== 1 ? 's' : ''}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0 ml-3">
                      {mapping.last_synced && (
                        <span className="text-[10px] text-slate-400 hidden sm:inline">
                          {new Date(mapping.last_synced).toLocaleDateString()}
                        </span>
                      )}
                      <Button onClick={() => handleSyncCustomer(mapping)} variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-slate-100">
                        <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
                      </Button>
                      <Button onClick={() => handleUnmap(mapping.id)} variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-400 hover:text-red-600 hover:bg-red-50">
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
