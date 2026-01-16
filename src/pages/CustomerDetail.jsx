import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { 
  Building2, 
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  Users,
  Monitor,
  FileText,
  Cloud,
  Calendar,
  DollarSign,
  ExternalLink
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { format, parseISO } from 'date-fns';

export default function CustomerDetail() {
  const params = new URLSearchParams(window.location.search);
  const customerId = params.get('id');

  const { data: customers = [], isLoading: loadingCustomer } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
  });

  const customer = customers.find(c => c.id === customerId);

  const { data: contracts = [], isLoading: loadingContracts } = useQuery({
    queryKey: ['contracts', customerId],
    queryFn: () => base44.entities.Contract.filter({ customer_id: customerId }),
    enabled: !!customerId
  });

  const { data: licenses = [], isLoading: loadingLicenses } = useQuery({
    queryKey: ['licenses', customerId],
    queryFn: () => base44.entities.SaaSLicense.filter({ customer_id: customerId }),
    enabled: !!customerId
  });

  const isLoading = loadingCustomer || loadingContracts || loadingLicenses;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="text-center py-12">
        <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-slate-900 mb-2">Customer Not Found</h2>
        <p className="text-slate-500 mb-6">The customer you're looking for doesn't exist.</p>
        <Link to={createPageUrl('Customers')}>
          <Button>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Customers
          </Button>
        </Link>
      </div>
    );
  }

  const totalContractValue = contracts
    .filter(c => c.status === 'active')
    .reduce((sum, c) => sum + (c.value || 0), 0);

  const totalLicenseCost = licenses
    .filter(l => l.status === 'active')
    .reduce((sum, l) => sum + (l.total_cost || 0), 0);

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Link to={createPageUrl('Customers')}>
        <Button variant="ghost" size="sm" className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back to Customers
        </Button>
      </Link>

      {/* Customer Header */}
      <div className="bg-white rounded-2xl border border-slate-200/50 p-6">
        <div className="flex flex-col md:flex-row md:items-start gap-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center flex-shrink-0">
            {customer.logo_url ? (
              <img src={customer.logo_url} alt={customer.name} className="w-10 h-10 rounded-xl" />
            ) : (
              <Building2 className="w-8 h-8 text-slate-500" />
            )}
          </div>
          <div className="flex-1">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
              <h1 className="text-2xl font-semibold text-slate-900">{customer.name}</h1>
              <Badge variant="outline" className={cn(
                "capitalize w-fit",
                customer.status === 'active' && "border-emerald-200 bg-emerald-50 text-emerald-700",
                customer.status === 'inactive' && "border-slate-200 bg-slate-50 text-slate-600",
                customer.status === 'suspended' && "border-red-200 bg-red-50 text-red-700"
              )}>
                {customer.status || 'active'}
              </Badge>
              {customer.source && (
                <Badge variant="outline" className="capitalize w-fit">
                  {customer.source}
                </Badge>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
              {customer.primary_contact && (
                <div className="flex items-center gap-2 text-slate-600">
                  <Users className="w-4 h-4 text-slate-400" />
                  {customer.primary_contact}
                </div>
              )}
              {customer.email && (
                <div className="flex items-center gap-2 text-slate-600">
                  <Mail className="w-4 h-4 text-slate-400" />
                  {customer.email}
                </div>
              )}
              {customer.phone && (
                <div className="flex items-center gap-2 text-slate-600">
                  <Phone className="w-4 h-4 text-slate-400" />
                  {customer.phone}
                </div>
              )}
              {customer.address && (
                <div className="flex items-center gap-2 text-slate-600">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  {customer.address}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-100">
          <div className="text-center p-4 bg-slate-50 rounded-xl">
            <p className="text-2xl font-semibold text-slate-900">{customer.total_users || 0}</p>
            <p className="text-sm text-slate-500">Users</p>
          </div>
          <div className="text-center p-4 bg-slate-50 rounded-xl">
            <p className="text-2xl font-semibold text-slate-900">{customer.total_devices || 0}</p>
            <p className="text-sm text-slate-500">Devices</p>
          </div>
          <div className="text-center p-4 bg-slate-50 rounded-xl">
            <p className="text-2xl font-semibold text-slate-900">{contracts.length}</p>
            <p className="text-sm text-slate-500">Contracts</p>
          </div>
          <div className="text-center p-4 bg-slate-50 rounded-xl">
            <p className="text-2xl font-semibold text-slate-900">{licenses.length}</p>
            <p className="text-sm text-slate-500">Licenses</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="contracts" className="space-y-6">
        <TabsList className="bg-white border border-slate-200/50">
          <TabsTrigger value="contracts" className="gap-2">
            <FileText className="w-4 h-4" />
            Contracts
          </TabsTrigger>
          <TabsTrigger value="licenses" className="gap-2">
            <Cloud className="w-4 h-4" />
            SaaS Licenses
          </TabsTrigger>
        </TabsList>

        <TabsContent value="contracts">
          <div className="bg-white rounded-2xl border border-slate-200/50 overflow-hidden">
            {contracts.length === 0 ? (
              <div className="p-12 text-center">
                <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">No contracts found</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {contracts.map((contract) => (
                  <div key={contract.id} className="p-6 hover:bg-slate-50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-medium text-slate-900">{contract.name}</h3>
                        <p className="text-sm text-slate-500 mt-1">{contract.description}</p>
                        <div className="flex items-center gap-4 mt-3">
                          <Badge variant="outline" className={cn(
                            "capitalize",
                            contract.status === 'active' && "border-emerald-200 bg-emerald-50 text-emerald-700",
                            contract.status === 'expired' && "border-red-200 bg-red-50 text-red-700"
                          )}>
                            {contract.status}
                          </Badge>
                          <span className="text-sm text-slate-500 capitalize">{contract.type?.replace('_', ' ')}</span>
                          {contract.renewal_date && (
                            <span className="flex items-center gap-1 text-sm text-slate-500">
                              <Calendar className="w-3 h-3" />
                              Renews {format(parseISO(contract.renewal_date), 'MMM d, yyyy')}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-semibold text-slate-900">
                          ${(contract.value || 0).toLocaleString()}
                        </p>
                        <p className="text-sm text-slate-500 capitalize">{contract.billing_cycle}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="licenses">
          <div className="bg-white rounded-2xl border border-slate-200/50 overflow-hidden">
            {licenses.length === 0 ? (
              <div className="p-12 text-center">
                <Cloud className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">No SaaS licenses found</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {licenses.map((license) => (
                  <div key={license.id} className="p-6 hover:bg-slate-50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-medium text-slate-900">{license.application_name}</h3>
                        <div className="flex items-center gap-4 mt-2">
                          <span className="text-sm text-slate-500">{license.vendor}</span>
                          <span className="text-sm text-slate-500">{license.license_type}</span>
                          <Badge variant="outline" className={cn(
                            "capitalize",
                            license.status === 'active' && "border-emerald-200 bg-emerald-50 text-emerald-700"
                          )}>
                            {license.status}
                          </Badge>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-semibold text-slate-900">
                          {license.assigned_users || 0} / {license.quantity || 0}
                        </p>
                        <p className="text-sm text-slate-500">
                          ${(license.total_cost || 0).toLocaleString()}/mo
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Notes */}
      {customer.notes && (
        <div className="bg-white rounded-2xl border border-slate-200/50 p-6">
          <h3 className="font-medium text-slate-900 mb-3">Notes</h3>
          <p className="text-slate-600 whitespace-pre-wrap">{customer.notes}</p>
        </div>
      )}
    </div>
  );
}