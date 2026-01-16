import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../../utils';
import { Building2, ChevronRight, Users, Monitor } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export default function CustomersList({ customers, limit = 5 }) {
  const displayCustomers = customers?.slice(0, limit) || [];

  if (displayCustomers.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/50 p-8 text-center">
        <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <p className="text-slate-500">No customers yet</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200/50 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <h3 className="font-semibold text-slate-900">Recent Customers</h3>
        <Link 
          to={createPageUrl('Customers')}
          className="text-sm text-blue-500 hover:text-blue-600 font-medium"
        >
          View all
        </Link>
      </div>
      <div className="divide-y divide-slate-100">
        {displayCustomers.map((customer) => (
          <Link
            key={customer.id}
            to={createPageUrl(`CustomerDetail?id=${customer.id}`)}
            className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50 transition-colors group"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
              {customer.logo_url ? (
                <img src={customer.logo_url} alt={customer.name} className="w-6 h-6 rounded" />
              ) : (
                <Building2 className="w-5 h-5 text-slate-500" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-slate-900 truncate">{customer.name}</p>
              <div className="flex items-center gap-4 mt-1">
                <span className="flex items-center gap-1 text-xs text-slate-500">
                  <Users className="w-3 h-3" />
                  {customer.total_users || 0} users
                </span>
                <span className="flex items-center gap-1 text-xs text-slate-500">
                  <Monitor className="w-3 h-3" />
                  {customer.total_devices || 0} devices
                </span>
              </div>
            </div>
            <Badge variant="outline" className={cn(
              "capitalize",
              customer.status === 'active' && "border-emerald-200 bg-emerald-50 text-emerald-700",
              customer.status === 'inactive' && "border-slate-200 bg-slate-50 text-slate-600",
              customer.status === 'suspended' && "border-red-200 bg-red-50 text-red-700"
            )}>
              {customer.status || 'active'}
            </Badge>
            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
          </Link>
        ))}
      </div>
    </div>
  );
}