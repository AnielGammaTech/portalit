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
        toast.success(`Loaded ${res.accounts?.length || 0} accounts`);
      } else {
        toast.error(res.error);
      }
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoadingAccounts(false);
    }
  };

  const handleMapAccount = async (account, customerId) => {
    const customer = customers.find(c => c.id === customerId);
    if (!customer) return;

    setMappingInProgress(account.id);
    try {
      await client.entities.DmarcReportMapping.create({
        customer_id: customerId,
        customer_name: customer.name,
        dmarc_account_id: String(account.id),
        dmarc_account_name: account.title,
      });
      toast.success(`Mapped ${account.title} → ${customer.name}`);
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
      if (mappings.find(m => m.dmarc_account_id === String(account.id))) continue;

      const match = customers.find(c =>
        c.name.toLowerCase().includes(account.title.toLowerCase()) ||
        account.title.toLowerCase().includes(c.name.toLowerCase())
      );
      if (match && !mappings.find(m => m.customer_id === match.id)) {
        try {
          await client.entities.DmarcReportMapping.create({
            customer_id: match.id,
            customer_name: match.name,
            dmarc_account_id: String(account.id),
            dmarc_account_name: account.title,
          });
          mapped++;
        } catch { /* skip */ }
      }
    }
    if (mapped > 0) {
      toast.success(`Auto-mapped ${mapped} accounts`);
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

  const unmappedAccounts = accounts.filter(a => !mappings.find(m => m.dmarc_account_id === String(a.id)));
  const filteredAccounts = searchTerm
    ? unmappedAccounts.filter(a => a.title.toLowerCase().includes(searchTerm.toLowerCase()))
    : unmappedAccounts;

  const filteredCustomers = customerSearch
    ? customers.filter(c =>
        c.name.toLowerCase().includes(customerSearch.toLowerCase()) &&
        !mappings.find(m => m.customer_id === c.id)
      )
    : customers.filter(c => !mappings.find(m => m.customer_id === c.id));

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

      {/* Account Mapping */}
      <div className="bg-white rounded-xl border p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Account Mapping</h3>
            <p className="text-xs text-slate-500 mt-0.5">Map DMARC Report accounts to your customers</p>
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

        {/* Unmapped accounts */}
        {accounts.length > 0 && unmappedAccounts.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Unmapped Accounts ({unmappedAccounts.length})</h4>
              <div className="relative flex-1 max-w-xs">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Filter accounts..."
                  className="h-7 text-xs pl-8"
                />
              </div>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {filteredAccounts.map(account => (
                <div key={account.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Globe className="w-4 h-4 text-slate-400" />
                    <div>
                      <p className="text-sm font-medium text-slate-900">{account.title}</p>
                      <p className="text-xs text-slate-500">{account.domainCount || 0} domains</p>
                    </div>
                  </div>
                  <select
                    className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white max-w-[200px]"
                    onChange={e => {
                      if (e.target.value) handleMapAccount(account, e.target.value);
                      e.target.value = '';
                    }}
                    defaultValue=""
                    disabled={mappingInProgress === account.id}
                  >
                    <option value="">Map to customer…</option>
                    {filteredCustomers.slice(0, 50).map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Existing mappings */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Mapped Accounts ({mappings.length})
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
            <p className="text-sm text-slate-500 py-4 text-center">No accounts mapped yet. Load accounts above to get started.</p>
          ) : (
            <div className="space-y-2">
              {mappings.map(mapping => {
                const cached = mapping.cached_data;
                return (
                  <div key={mapping.id} className="flex items-center justify-between p-3 border rounded-lg hover:shadow-sm transition-shadow">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                        <Globe className="w-4 h-4 text-emerald-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">{mapping.customer_name}</p>
                        <div className="flex items-center gap-2">
                          <p className="text-xs text-slate-500">{mapping.dmarc_account_name}</p>
                          {cached && (
                            <Badge variant="flat-success" className="text-[10px]">
                              {cached.totalDomains || 0} domains · {cached.complianceRate || 0}% compliance
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
