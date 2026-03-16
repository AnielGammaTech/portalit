import React, { useState, useCallback } from 'react';
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
  Wand2,
  Search,
  XCircle,
  Clock,
  Key,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from 'date-fns';

export default function Pax8Config() {
  const queryClient = useQueryClient();
  const [testing, setTesting] = useState(false);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [pax8Companies, setPax8Companies] = useState([]);
  const [showMapping, setShowMapping] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selections, setSelections] = useState({});

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => client.entities.Customer.list('name', 500),
    staleTime: 1000 * 60 * 5,
  });

  const { data: mappings = [], refetch: refetchMappings } = useQuery({
    queryKey: ['pax8_mappings'],
    queryFn: () => client.entities.Pax8Mapping.list(),
  });

  // Test connection
  const handleTestConnection = async () => {
    setTesting(true);
    try {
      const result = await client.functions.invoke('syncPax8Subscriptions', { action: 'test_connection' });
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.error || 'Connection failed');
      }
    } catch (e) {
      toast.error(e.message);
    } finally {
      setTesting(false);
    }
  };

  // Load Pax8 companies
  const handleLoadCompanies = async () => {
    setLoadingCompanies(true);
    try {
      const result = await client.functions.invoke('syncPax8Subscriptions', { action: 'list_companies' });
      if (result.success) {
        setPax8Companies(result.companies || []);
        setShowMapping(true);
        toast.success(`Found ${result.companies.length} Pax8 companies`);
      } else {
        toast.error(result.error);
      }
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoadingCompanies(false);
    }
  };

  // Auto-map by name matching
  const handleAutoMap = useCallback(() => {
    const newSelections = { ...selections };
    const mapped = new Set(mappings.map((m) => m.pax8_company_id));

    for (const company of pax8Companies) {
      if (mapped.has(company.id)) continue;
      const pName = (company.name || '').toLowerCase().trim();
      const match = customers.find(
        (c) => (c.name || '').toLowerCase().trim() === pName
      );
      if (match) {
        newSelections[company.id] = match.id;
      }
    }

    setSelections(newSelections);
    const count = Object.keys(newSelections).length - Object.keys(selections).length;
    toast.success(`Auto-mapped ${count} companies`);
  }, [pax8Companies, customers, mappings, selections]);

  // Save a single mapping
  const handleSaveMapping = async (pax8Company) => {
    const customerId = selections[pax8Company.id];
    if (!customerId) return;

    const customer = customers.find((c) => c.id === customerId);

    try {
      const { error } = await supabase.from('pax8_mappings').insert({
        customer_id: customerId,
        customer_name: customer?.name || '',
        pax8_company_id: pax8Company.id,
        pax8_company_name: pax8Company.name,
      });

      if (error) throw error;

      toast.success(`Mapped ${pax8Company.name}`);
      refetchMappings();
      setSelections((prev) => {
        const next = { ...prev };
        delete next[pax8Company.id];
        return next;
      });
    } catch (e) {
      toast.error(e.message);
    }
  };

  // Delete a mapping
  const handleDeleteMapping = async (mappingId) => {
    try {
      const { error } = await supabase.from('pax8_mappings').delete().eq('id', mappingId);
      if (error) throw error;
      toast.success('Mapping removed');
      refetchMappings();
    } catch (e) {
      toast.error(e.message);
    }
  };

  // Sync all
  const handleSyncAll = async () => {
    setSyncing(true);
    try {
      const result = await client.functions.invoke('syncPax8Subscriptions', { action: 'sync_all' });
      if (result.success) {
        toast.success(`Synced ${result.synced} companies (${result.errors} errors)`);
        refetchMappings();
        queryClient.invalidateQueries({ queryKey: ['pax8_mappings'] });
      } else {
        toast.error(result.error);
      }
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSyncing(false);
    }
  };

  const mappedIds = new Set(mappings.map((m) => m.pax8_company_id));

  const unmappedCompanies = pax8Companies.filter((c) => !mappedIds.has(c.id));
  const filteredUnmapped = searchQuery
    ? unmappedCompanies.filter((c) => c.name?.toLowerCase().includes(searchQuery.toLowerCase()))
    : unmappedCompanies;

  return (
    <div className="space-y-6">
      {/* Connection */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-900 mb-1">Connection</h3>
        <p className="text-xs text-slate-500 mb-4">
          Set <code className="bg-slate-100 px-1 rounded">PAX8_CLIENT_ID</code> and{' '}
          <code className="bg-slate-100 px-1 rounded">PAX8_CLIENT_SECRET</code> as environment variables on the server.
        </p>
        <div className="flex gap-2">
          <Button size="sm" onClick={handleTestConnection} disabled={testing}>
            {testing ? <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1" /> : <Key className="w-3.5 h-3.5 mr-1" />}
            Test Connection
          </Button>
          <Button size="sm" variant="outline" onClick={handleLoadCompanies} disabled={loadingCompanies}>
            {loadingCompanies ? <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1" /> : <Building2 className="w-3.5 h-3.5 mr-1" />}
            Load Companies
          </Button>
          {mappings.length > 0 && (
            <Button size="sm" variant="outline" onClick={handleSyncAll} disabled={syncing}>
              {syncing ? <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1" /> : <RefreshCw className="w-3.5 h-3.5 mr-1" />}
              Sync All ({mappings.length})
            </Button>
          )}
        </div>
      </div>

      {/* Existing Mappings */}
      {mappings.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">
            Mapped Companies ({mappings.length})
          </h3>
          <div className="space-y-2">
            {mappings.map((m) => (
              <div key={m.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-2.5">
                <div className="flex items-center gap-3 min-w-0">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{m.pax8_company_name}</p>
                    <p className="text-xs text-slate-500">→ {m.customer_name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {m.last_synced && (
                    <span className="text-xs text-slate-400">
                      <Clock className="w-3 h-3 inline mr-0.5" />
                      {formatDistanceToNow(new Date(m.last_synced), { addSuffix: true })}
                    </span>
                  )}
                  {m.cached_data?.totalSubscriptions != null && (
                    <Badge variant="secondary" className="text-xs">
                      {m.cached_data.totalSubscriptions} subs
                    </Badge>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => handleDeleteMapping(m.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Unmapped Companies */}
      {showMapping && unmappedCompanies.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-900">
              Unmapped Pax8 Companies ({unmappedCompanies.length})
            </h3>
            <Button size="sm" variant="outline" onClick={handleAutoMap}>
              <Wand2 className="w-3.5 h-3.5 mr-1" />
              Auto-Map
            </Button>
          </div>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search unmapped companies..."
              className="pl-9"
            />
          </div>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {filteredUnmapped.map((company) => (
              <div key={company.id} className="flex items-center gap-2 bg-slate-50 rounded-lg px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900 truncate">{company.name}</p>
                  {company.city && <p className="text-xs text-slate-400">{company.city}</p>}
                </div>
                <Select
                  value={selections[company.id] || ''}
                  onValueChange={(val) => setSelections((prev) => ({ ...prev, [company.id]: val }))}
                >
                  <SelectTrigger className="w-48 h-8 text-xs">
                    <SelectValue placeholder="Select customer..." />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  className="h-8"
                  disabled={!selections[company.id]}
                  onClick={() => handleSaveMapping(company)}
                >
                  Map
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
