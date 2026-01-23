import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../../utils';
import { Cloud, Building2, User, CreditCard } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export default function SoftwareCard({ 
  software, 
  managedLicense, 
  individualLicenses = [],
  managedAssignments = [],
  individualAssignments = [],
  isCatalogOnly = false
}) {
  const hasManagedLicense = !!managedLicense;
  const hasIndividualLicenses = individualLicenses.length > 0;
  const hasAnyLicense = hasManagedLicense || hasIndividualLicenses;
  
  // Managed stats
  const managedSeats = managedLicense?.quantity || 0;
  const managedUsed = managedAssignments.length;
  const managedUnused = managedSeats - managedUsed;
  const managedUtilization = managedSeats > 0 ? (managedUsed / managedSeats) * 100 : 0;
  const managedCost = managedLicense?.total_cost || 0;
  
  // Individual stats
  const individualCount = individualAssignments.length;
  const individualTotalCost = individualAssignments.reduce(
    (sum, a) => sum + (a.cost_per_license || 0), 0
  );
  
  // Combined
  const totalCost = managedCost + individualTotalCost;
  const totalUsers = managedUsed + individualCount;

  // Link to first license for detail view, or to app if catalog-only
  const detailLicenseId = managedLicense?.id || individualLicenses[0]?.id;
  const detailUrl = software?._isApplication && !detailLicenseId
    ? createPageUrl(`LicenseDetail?appId=${software.id}`)
    : createPageUrl(`LicenseDetail?id=${detailLicenseId}`);

  return (
    <Link 
      to={detailUrl}
      className="group bg-white hover:bg-slate-50 rounded-xl border border-slate-200 p-4 transition-all hover:shadow-md cursor-pointer block"
    >
      <div className="flex items-start gap-3">
        {/* Logo */}
        <div className={cn(
          "w-12 h-12 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0",
          !software.logo_url && "bg-purple-100 border border-purple-200"
        )}>
          {software.logo_url ? (
            <img src={software.logo_url} alt={software.application_name} className="w-10 h-10 object-contain" />
          ) : (
            <Cloud className="w-6 h-6 text-purple-600" />
          )}
        </div>
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-900 truncate">{software.application_name}</h3>
            {totalCost > 0 && (
              <span className="text-sm font-bold text-slate-900">${totalCost.toFixed(0)}/mo</span>
            )}
          </div>
          
          {software.vendor && (
            <p className="text-xs text-slate-500 truncate">{software.vendor}</p>
          )}
          
          {/* License Type Pills */}
          <div className="flex flex-wrap gap-2 mt-2">
            {/* Catalog Only - No licenses yet */}
            {!hasAnyLicense && (
              <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-50 rounded-lg border border-slate-200">
                <Cloud className="w-3 h-3 text-slate-400" />
                <span className="text-xs font-medium text-slate-500">No licenses</span>
              </div>
            )}
            
            {/* Managed License Pill */}
            {hasManagedLicense && (
              <div className="flex items-center gap-1.5 px-2 py-1 bg-blue-50 rounded-lg border border-blue-100">
                <Building2 className="w-3 h-3 text-blue-600" />
                <span className="text-xs font-medium text-blue-700">{managedUsed}/{managedSeats}</span>
                
                {/* Utilization indicator */}
                <div className="w-12 h-1.5 bg-blue-200 rounded-full overflow-hidden ml-1">
                  <div 
                    className={cn(
                      "h-full rounded-full",
                      managedUtilization >= 90 ? "bg-emerald-500" :
                      managedUtilization >= 50 ? "bg-amber-500" : "bg-red-500"
                    )}
                    style={{ width: `${Math.min(100, managedUtilization)}%` }}
                  />
                </div>
                <span className={cn(
                  "text-xs font-medium ml-1",
                  managedUtilization >= 90 ? "text-emerald-600" :
                  managedUtilization >= 50 ? "text-amber-600" : "text-red-600"
                )}>
                  {managedUtilization.toFixed(0)}%
                </span>
              </div>
            )}
            
            {/* Individual Licenses Pill */}
            {hasIndividualLicenses && (
              <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-50 rounded-lg border border-emerald-100">
                <User className="w-3 h-3 text-emerald-600" />
                <span className="text-xs font-medium text-emerald-700">{individualCount} user{individualCount !== 1 ? 's' : ''}</span>
              </div>
            )}
          </div>
          
          {/* Unused seats warning */}
          {hasManagedLicense && managedUnused > 0 && managedUtilization < 50 && (
            <p className="text-xs text-red-500 mt-1.5">
              {managedUnused} unused seat{managedUnused !== 1 ? 's' : ''} (~${((managedUnused / managedSeats) * managedCost).toFixed(0)}/mo wasted)
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}