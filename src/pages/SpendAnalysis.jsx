import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { client } from '@/api/client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import Breadcrumbs from '../components/ui/breadcrumbs';
import { 
  ArrowLeft, 
  DollarSign, 
  Cloud, 
  Building2,
  Calendar,
  TrendingUp,
  AlertTriangle
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export default function SpendAnalysis() {
  const params = new URLSearchParams(window.location.search);
  const customerId = params.get('customerId');

  const { data: customers = [], isLoading: loadingCustomer } = useQuery({
    queryKey: ['customers'],
    queryFn: () => client.entities.Customer.list(),
  });

  const customer = customers.find(c => c.id === customerId);

  const { data: licenses = [], isLoading: loadingLicenses } = useQuery({
    queryKey: ['licenses', customerId],
    queryFn: () => client.entities.SaaSLicense.filter({ customer_id: customerId }),
    enabled: !!customerId
  });

  const { data: licenseAssignments = [], isLoading: loadingAssignments } = useQuery({
    queryKey: ['license_assignments', customerId],
    queryFn: () => client.entities.LicenseAssignment.filter({ customer_id: customerId }),
    enabled: !!customerId
  });

  const isLoading = loadingCustomer || loadingLicenses || loadingAssignments;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="text-center py-12">
        <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-slate-900 mb-2">Customer Not Found</h2>
        <Link to={createPageUrl('Customers')}>
          <Button><ArrowLeft className="w-4 h-4 mr-2" />Back to Customers</Button>
        </Link>
      </div>
    );
  }

  // Calculate totals - respect billing_cycle
  const monthlyTotal = licenses.reduce((sum, l) => {
    if (l.billing_cycle === 'annually') {
      return sum + ((l.total_cost || 0) / 12); // Convert annual to monthly
    }
    return sum + (l.total_cost || 0);
  }, 0);
  
  const yearlyTotal = licenses.reduce((sum, l) => {
    if (l.billing_cycle === 'annually') {
      return sum + (l.total_cost || 0); // Already annual
    }
    return sum + ((l.total_cost || 0) * 12); // Convert monthly to annual
  }, 0);

  // Calculate unused spend per license (respecting billing cycle)
  const managedLicenses = licenses.filter(l => l.management_type === 'managed');
  const totalSeats = managedLicenses.reduce((sum, l) => sum + (l.quantity || 0), 0);
  const managedLicenseIds = managedLicenses.map(l => l.id);
  const assignedSeats = licenseAssignments.filter(a => a.status === 'active' && managedLicenseIds.includes(a.license_id)).length;
  const unusedSeats = totalSeats - assignedSeats;
  
  // Calculate wasted spend more accurately per license
  const wastedMonthly = managedLicenses.reduce((sum, l) => {
    const assigned = licenseAssignments.filter(a => a.license_id === l.id && a.status === 'active').length;
    const unused = (l.quantity || 0) - assigned;
    if (unused <= 0 || (l.quantity || 0) === 0) return sum;
    const costPerSeat = (l.total_cost || 0) / (l.quantity || 1);
    const wastedCost = costPerSeat * unused;
    // Convert to monthly if annual
    return sum + (l.billing_cycle === 'annually' ? wastedCost / 12 : wastedCost);
  }, 0);
  
  const wastedYearly = managedLicenses.reduce((sum, l) => {
    const assigned = licenseAssignments.filter(a => a.license_id === l.id && a.status === 'active').length;
    const unused = (l.quantity || 0) - assigned;
    if (unused <= 0 || (l.quantity || 0) === 0) return sum;
    const costPerSeat = (l.total_cost || 0) / (l.quantity || 1);
    const wastedCost = costPerSeat * unused;
    // Convert to yearly if monthly
    return sum + (l.billing_cycle === 'annually' ? wastedCost : wastedCost * 12);
  }, 0);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Breadcrumbs items={[
        { label: 'Customers', href: createPageUrl('Customers') },
        { label: customer?.name || 'Customer', href: createPageUrl(`CustomerDetail?id=${customerId}`) },
        { label: 'Spend Analysis' }
      ]} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <DollarSign className="w-7 h-7 text-purple-600" />
            Spend Analysis
          </h1>
          <p className="text-slate-500 mt-1">{customer.name} - SaaS License Costs</p>
        </div>
        <Link to={createPageUrl(`CustomerDetail?id=${customerId}`)}>
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-purple-600 to-purple-700 rounded-2xl p-6 text-white">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-5 h-5 text-purple-200" />
            <span className="text-purple-200 text-sm font-medium">Monthly Total</span>
          </div>
          <p className="text-3xl font-bold">${monthlyTotal.toLocaleString()}</p>
          <p className="text-purple-200 text-sm mt-1">{licenses.length} licenses</p>
        </div>

        <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-6 text-white">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-blue-200" />
            <span className="text-blue-200 text-sm font-medium">Yearly Total</span>
          </div>
          <p className="text-3xl font-bold">${yearlyTotal.toLocaleString()}</p>
          <p className="text-blue-200 text-sm mt-1">Projected annual cost</p>
        </div>

        {wastedMonthly > 0 && (
          <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-2xl p-6 text-white">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-5 h-5 text-red-200" />
              <span className="text-red-200 text-sm font-medium">Potential Savings</span>
            </div>
            <p className="text-3xl font-bold">${wastedMonthly.toFixed(0)}/mo</p>
            <p className="text-red-200 text-sm mt-1">{unusedSeats} unused seats</p>
          </div>
        )}
      </div>

      {/* Monthly Breakdown */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
          <h2 className="font-semibold text-slate-900 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-purple-600" />
            Monthly Costs
          </h2>
        </div>
        <div className="divide-y divide-slate-100">
          {licenses.length === 0 ? (
            <div className="p-8 text-center">
              <Cloud className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">No licenses found</p>
            </div>
          ) : (
            licenses
              .sort((a, b) => (b.total_cost || 0) - (a.total_cost || 0))
              .map(license => {
                const assignedCount = licenseAssignments.filter(a => a.license_id === license.id && a.status === 'active').length;
                const isManaged = license.management_type === 'managed';
                const unusedCount = isManaged ? (license.quantity || 0) - assignedCount : 0;
                const isAnnual = license.billing_cycle === 'annually';
                const monthlyEquivalent = isAnnual ? (license.total_cost || 0) / 12 : (license.total_cost || 0);
                
                return (
                  <div key={license.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center overflow-hidden">
                        {license.logo_url ? (
                          <img src={license.logo_url} alt="" className="w-8 h-8 object-contain" />
                        ) : (
                          <Cloud className="w-5 h-5 text-purple-600" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">{license.application_name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="outline" className={cn(
                            "text-xs",
                            isManaged ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"
                          )}>
                            {isManaged ? 'Managed' : 'Individual'}
                          </Badge>
                          {isManaged && (
                            <span className="text-xs text-slate-500">
                              {assignedCount}/{license.quantity || 0} seats
                            </span>
                          )}
                          {unusedCount > 0 && (
                            <span className="text-xs text-red-500">
                              ({unusedCount} unused)
                            </span>
                          )}
                          {isAnnual && (
                            <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                              Annual
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-slate-900">${monthlyEquivalent.toFixed(2)}</p>
                      {isAnnual && (
                        <p className="text-xs text-slate-500">${(license.total_cost || 0).toLocaleString()}/yr</p>
                      )}
                    </div>
                  </div>
                );
              })
          )}
        </div>
        <div className="px-6 py-4 bg-purple-50 border-t border-purple-100 flex items-center justify-between">
          <span className="font-semibold text-purple-900">Monthly Total</span>
          <span className="text-2xl font-bold text-purple-700">${monthlyTotal.toLocaleString()}</span>
        </div>
      </div>

      {/* Yearly Breakdown */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-blue-50">
          <h2 className="font-semibold text-slate-900 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            Yearly Costs (Projected)
          </h2>
        </div>
        <div className="divide-y divide-slate-100">
          {licenses
            .sort((a, b) => (b.total_cost || 0) - (a.total_cost || 0))
            .map(license => {
              const isAnnual = license.billing_cycle === 'annually';
              const yearlyCost = isAnnual ? (license.total_cost || 0) : (license.total_cost || 0) * 12;
              
              return (
                <div key={license.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center overflow-hidden">
                      {license.logo_url ? (
                        <img src={license.logo_url} alt="" className="w-8 h-8 object-contain" />
                      ) : (
                        <Cloud className="w-5 h-5 text-blue-600" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">{license.application_name}</p>
                      <p className="text-xs text-slate-500">
                        {isAnnual 
                          ? `$${(license.total_cost || 0).toLocaleString()}/yr (billed annually)`
                          : `$${(license.total_cost || 0).toLocaleString()}/mo × 12`
                        }
                      </p>
                    </div>
                  </div>
                  <p className="text-lg font-bold text-slate-900">${yearlyCost.toLocaleString()}</p>
                </div>
              );
            })}
        </div>
        <div className="px-6 py-4 bg-blue-50 border-t border-blue-100 flex items-center justify-between">
          <span className="font-semibold text-blue-900">Yearly Total</span>
          <span className="text-2xl font-bold text-blue-700">${yearlyTotal.toLocaleString()}</span>
        </div>
      </div>

      {/* Savings Opportunities */}
      {wastedMonthly > 0 && (
        <div className="bg-gradient-to-r from-red-50 to-orange-50 rounded-2xl border border-red-200 p-6">
          <h2 className="font-semibold text-red-900 flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            Potential Savings Opportunities
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl p-4 border border-red-100">
              <p className="text-sm text-red-700 font-medium">Monthly Savings</p>
              <p className="text-2xl font-bold text-red-600">${wastedMonthly.toFixed(0)}</p>
              <p className="text-xs text-red-500 mt-1">{unusedSeats} unused managed seats</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-red-100">
              <p className="text-sm text-red-700 font-medium">Yearly Savings</p>
              <p className="text-2xl font-bold text-red-600">${wastedYearly.toFixed(0)}</p>
              <p className="text-xs text-red-500 mt-1">If unused seats were removed</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}