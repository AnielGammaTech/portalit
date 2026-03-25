import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { client } from '@/api/client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import {
  ArrowLeft,
  FileText,
  Calendar,
  DollarSign,
  Building2,
  Search,
  Filter,
  ChevronDown
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { format, parseISO, differenceInDays } from 'date-fns';

export default function Contracts() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedContract, setExpandedContract] = useState(null);

  const { data: contracts = [], isLoading: loadingContracts } = useQuery({
    queryKey: ['contracts'],
    queryFn: () => client.entities.Contract.list('-created_date', 500),
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => client.entities.Customer.list(),
  });

  const { data: contractItems = [] } = useQuery({
    queryKey: ['contract_items'],
    queryFn: () => client.entities.ContractItem.list(),
  });

  const filteredContracts = contracts.filter(contract => {
    const matchesSearch = 
      contract.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contract.customer_name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || contract.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalValue = contracts
    .filter(c => c.status === 'active')
    .reduce((sum, c) => sum + (c.value || 0), 0);

  const expiringCount = contracts.filter(c => {
    const date = c.renewal_date || c.end_date;
    if (!date) return false;
    const days = differenceInDays(parseISO(date), new Date());
    return days >= 0 && days <= 30;
  }).length;

  if (loadingContracts) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-3 gap-4">
          {[1,2,3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to={createPageUrl('Dashboard')}>
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Contracts</h1>
            <p className="text-sm text-slate-500">Manage all customer contracts</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
              <FileText className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{contracts.length}</p>
              <p className="text-sm text-slate-500">Total Contracts</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">${totalValue.toLocaleString()}</p>
              <p className="text-sm text-slate-500">Active Contract Value</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-600">{expiringCount}</p>
              <p className="text-sm text-slate-500">Expiring in 30 Days</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search contracts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="pending">Pending</option>
          <option value="expired">Expired</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* Contracts List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {filteredContracts.length === 0 ? (
          <div className="col-span-2 bg-white rounded-2xl border border-slate-200 p-12 text-center">
            <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">No contracts found</p>
          </div>
        ) : (
          filteredContracts.map(contract => {
            const customer = customers.find(c => c.id === contract.customer_id);
            const items = contractItems.filter(i => i.contract_id === contract.id);
            const renewalDate = contract.renewal_date || contract.end_date;
            const daysUntil = renewalDate ? differenceInDays(parseISO(renewalDate), new Date()) : null;
            const isExpanded = expandedContract === contract.id;

            return (
              <div key={contract.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <button
                  onClick={() => setExpandedContract(isExpanded ? null : contract.id)}
                  className="w-full p-3 flex items-center gap-3 hover:bg-slate-50 transition-colors text-left"
                >
                  <div className={cn(
                    "w-2 h-2 rounded-full flex-shrink-0",
                    contract.status === 'active' && "bg-emerald-500",
                    contract.status === 'pending' && "bg-amber-500",
                    contract.status === 'expired' && "bg-red-500",
                    contract.status === 'cancelled' && "bg-slate-400"
                  )} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-slate-900 truncate text-sm">{contract.name}</p>
                      <Badge className={cn(
                        "text-[10px] px-1.5 py-0 capitalize",
                        contract.status === 'active' && "bg-emerald-100 text-emerald-700",
                        contract.status === 'pending' && "bg-amber-100 text-amber-700",
                        contract.status === 'expired' && "bg-red-100 text-red-700",
                        contract.status === 'cancelled' && "bg-slate-100 text-slate-600"
                      )}>
                        {contract.status}
                      </Badge>
                    </div>
                    {contract.contract_type_raw && (
                      <p className="text-[11px] text-indigo-600 font-medium truncate mt-0.5">{contract.contract_type_raw}</p>
                    )}
                    {customer && (
                      <p className="text-xs text-slate-500 truncate mt-0.5">{customer.name}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {contract.value > 0 && (
                      <div className="text-right">
                        <p className="font-semibold text-slate-900 text-sm">${contract.value.toLocaleString()}</p>
                        <p className="text-[10px] text-slate-400">/{contract.billing_cycle === 'annually' ? 'yr' : 'mo'}</p>
                      </div>
                    )}
                    {renewalDate && (
                      <div className={cn(
                        "text-center px-2 py-1 rounded text-[10px] min-w-[60px]",
                        daysUntil !== null && daysUntil <= 30 ? 'bg-red-100 text-red-700' :
                        daysUntil !== null && daysUntil <= 90 ? 'bg-amber-100 text-amber-700' :
                        'bg-emerald-100 text-emerald-700'
                      )}>
                        <p className="font-medium">{format(parseISO(renewalDate), 'MMM d')}</p>
                      </div>
                    )}
                    <ChevronDown className={cn(
                      "w-4 h-4 text-slate-400 transition-transform",
                      isExpanded && "rotate-180"
                    )} />
                  </div>
                </button>
                
                {isExpanded && items.length > 0 && (
                  <div className="px-3 pb-3">
                    <div className="bg-slate-50 rounded-lg p-3">
                      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Items</p>
                      <div className="space-y-1">
                        {items.map(item => (
                          <div key={item.id} className="flex items-center justify-between text-xs">
                            <span className="text-slate-700 truncate">{item.description}</span>
                            <span className="font-medium text-slate-900 ml-2">${(item.net_amount || 0).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}