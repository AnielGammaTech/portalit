import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../../utils';
import { FileText, AlertTriangle, Calendar } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { format, differenceInDays, parseISO } from 'date-fns';
import { cn } from "@/lib/utils";

export default function ContractsOverview({ contracts, limit = 5 }) {
  // Sort by renewal date to show upcoming renewals first
  const sortedContracts = [...(contracts || [])]
    .filter(c => c.renewal_date || c.end_date)
    .sort((a, b) => {
      const dateA = a.renewal_date || a.end_date;
      const dateB = b.renewal_date || b.end_date;
      return new Date(dateA) - new Date(dateB);
    })
    .slice(0, limit);

  const getUrgencyLevel = (dateStr) => {
    if (!dateStr) return null;
    const days = differenceInDays(parseISO(dateStr), new Date());
    if (days < 0) return 'expired';
    if (days <= 30) return 'urgent';
    if (days <= 60) return 'warning';
    return 'normal';
  };

  if (sortedContracts.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/50 p-8 text-center">
        <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <p className="text-slate-500">No contracts to display</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200/50 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <h3 className="font-semibold text-slate-900">Upcoming Renewals</h3>
        <Link 
          to={createPageUrl('Contracts')}
          className="text-sm text-blue-500 hover:text-blue-600 font-medium"
        >
          View all
        </Link>
      </div>
      <div className="divide-y divide-slate-100">
        {sortedContracts.map((contract) => {
          const renewalDate = contract.renewal_date || contract.end_date;
          const urgency = getUrgencyLevel(renewalDate);
          const daysUntil = renewalDate ? differenceInDays(parseISO(renewalDate), new Date()) : null;
          
          return (
            <div
              key={contract.id}
              className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50 transition-colors"
            >
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center",
                urgency === 'expired' && "bg-red-100",
                urgency === 'urgent' && "bg-amber-100",
                urgency === 'warning' && "bg-yellow-100",
                urgency === 'normal' && "bg-slate-100"
              )}>
                {urgency === 'expired' || urgency === 'urgent' ? (
                  <AlertTriangle className={cn(
                    "w-5 h-5",
                    urgency === 'expired' ? "text-red-600" : "text-amber-600"
                  )} />
                ) : (
                  <Calendar className="w-5 h-5 text-slate-500" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-900 truncate">{contract.name}</p>
                <p className="text-sm text-slate-500">{contract.customer_name}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-slate-900">
                  {renewalDate ? format(parseISO(renewalDate), 'MMM d, yyyy') : 'No date'}
                </p>
                {daysUntil !== null && (
                  <p className={cn(
                    "text-xs mt-0.5",
                    urgency === 'expired' && "text-red-600",
                    urgency === 'urgent' && "text-amber-600",
                    urgency === 'warning' && "text-yellow-600",
                    urgency === 'normal' && "text-slate-500"
                  )}>
                    {daysUntil < 0 ? `${Math.abs(daysUntil)} days ago` : `${daysUntil} days`}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}