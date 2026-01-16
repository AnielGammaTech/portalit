import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Building2, FileText, Cloud, DollarSign, Users, Monitor, AlertTriangle } from 'lucide-react';
import StatsCard from '../components/dashboard/StatsCard';
import CustomersList from '../components/dashboard/CustomersList';
import ContractsOverview from '../components/dashboard/ContractsOverview';
import SaaSUsageChart from '../components/dashboard/SaaSUsageChart';
import { Skeleton } from "@/components/ui/skeleton";
import { differenceInDays, parseISO } from 'date-fns';

export default function Dashboard() {
  const { data: customers = [], isLoading: loadingCustomers } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list('-created_date', 100),
  });

  const { data: contracts = [], isLoading: loadingContracts } = useQuery({
    queryKey: ['contracts'],
    queryFn: () => base44.entities.Contract.list('-created_date', 100),
  });

  const { data: licenses = [], isLoading: loadingLicenses } = useQuery({
    queryKey: ['licenses'],
    queryFn: () => base44.entities.SaaSLicense.list('-created_date', 500),
  });

  const isLoading = loadingCustomers || loadingContracts || loadingLicenses;

  // Calculate stats
  const activeCustomers = customers.filter(c => c.status === 'active').length;
  const activeContracts = contracts.filter(c => c.status === 'active').length;
  const totalLicenses = licenses.reduce((sum, l) => sum + (l.quantity || 0), 0);
  const monthlyRevenue = contracts
    .filter(c => c.status === 'active')
    .reduce((sum, c) => sum + (c.value || 0), 0);
  const totalSaaSSpend = licenses
    .filter(l => l.status === 'active')
    .reduce((sum, l) => sum + (l.total_cost || 0), 0);

  // Contracts expiring in 30 days
  const expiringContracts = contracts.filter(c => {
    const date = c.renewal_date || c.end_date;
    if (!date) return false;
    const days = differenceInDays(parseISO(date), new Date());
    return days >= 0 && days <= 30;
  }).length;

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-96 rounded-2xl" />
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Active Customers"
          value={activeCustomers}
          subtitle={`${customers.length} total`}
          icon={Building2}
        />
        <StatsCard
          title="Active Contracts"
          value={activeContracts}
          subtitle={expiringContracts > 0 ? `${expiringContracts} expiring soon` : 'All on track'}
          icon={FileText}
        />
        <StatsCard
          title="Total Licenses"
          value={totalLicenses.toLocaleString()}
          subtitle={`${licenses.length} subscriptions`}
          icon={Cloud}
        />
        <StatsCard
          title="Monthly SaaS Spend"
          value={`$${totalSaaSSpend.toLocaleString()}`}
          subtitle="Across all vendors"
          icon={DollarSign}
        />
      </div>

      {/* Alerts Section */}
      {expiringContracts > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-4">
          <div className="p-3 bg-amber-100 rounded-xl">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <p className="font-medium text-amber-900">Contract Renewals Needed</p>
            <p className="text-sm text-amber-700">{expiringContracts} contract(s) expiring in the next 30 days</p>
          </div>
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CustomersList customers={customers} limit={5} />
        <ContractsOverview contracts={contracts} limit={5} />
      </div>

      {/* SaaS Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <SaaSUsageChart licenses={licenses} />
        </div>
        <div className="bg-white rounded-2xl border border-slate-200/50 p-6">
          <h3 className="font-semibold text-slate-900 mb-4">Quick Stats</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-slate-500" />
                <span className="text-sm text-slate-600">Total Users</span>
              </div>
              <span className="font-semibold text-slate-900">
                {customers.reduce((sum, c) => sum + (c.total_users || 0), 0).toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
              <div className="flex items-center gap-3">
                <Monitor className="w-5 h-5 text-slate-500" />
                <span className="text-sm text-slate-600">Total Devices</span>
              </div>
              <span className="font-semibold text-slate-900">
                {customers.reduce((sum, c) => sum + (c.total_devices || 0), 0).toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
              <div className="flex items-center gap-3">
                <DollarSign className="w-5 h-5 text-slate-500" />
                <span className="text-sm text-slate-600">Contract Revenue</span>
              </div>
              <span className="font-semibold text-slate-900">
                ${monthlyRevenue.toLocaleString()}/mo
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}