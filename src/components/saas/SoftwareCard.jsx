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
  // Check if there are actual individual assignments
  const hasIndividualLicenses = individualAssignments.length > 0;
  const hasAnyLicense = hasManagedLicense || hasIndividualLicenses;
  
  // Managed stats
  const managedSeats = managedLicense?.quantity || 0;
  // For auto-synced licenses (spanning, jumpcloud), use assigned_users from the license itself
  // since not all users may have matching contacts in HaloPSA
  const isAutoSynced = ['spanning', 'jumpcloud'].includes(managedLicense?.source);
  const managedUsed = isAutoSynced ? (managedLicense?.assigned_users || managedAssignments.length) : managedAssignments.length;
  const managedUnused = managedSeats - managedUsed;
  const managedUtilization = managedSeats > 0 ? (managedUsed / managedSeats) * 100 : 0;
  const managedCost = managedLicense?.total_cost || 0;
  const isManagedAnnual = managedLicense?.billing_cycle === 'annually';
  
  // Individual stats (assume monthly)
  const individualCount = individualAssignments.length;
  const individualTotalCost = individualAssignments.reduce(
    (sum, a) => sum + (a.cost_per_license || 0), 0
  );
  
  // Normalize everything to monthly for combined display
  const managedMonthlyCost = isManagedAnnual ? managedCost / 12 : managedCost;
  const totalMonthlyCost = managedMonthlyCost + individualTotalCost;
  const totalUsers = managedUsed + individualCount;

  // Link to first license for detail view, or to app if catalog-only
  const detailLicenseId = managedLicense?.id || individualLicenses[0]?.id;
  const detailUrl = software?._isApplication && !detailLicenseId
    ? createPageUrl(`LicenseDetail?appId=${software.id}`)
    : createPageUrl(`LicenseDetail?id=${detailLicenseId}`);

  return (
    <Link 
      to={detailUrl}
      className="group bg-white hover:bg-slate-50 rounded-lg border border-slate-200 p-3 transition-all hover:shadow-md cursor-pointer block"
    >
      <div className="flex items-start gap-2.5">
        {/* Logo */}
        <div className={cn(
          "w-9 h-9 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0",
          !software.logo_url && "bg-purple-100 border border-purple-200"
        )}>
          {software.logo_url ? (
            <img src={software.logo_url} alt={software.application_name} className="w-7 h-7 object-contain" />
          ) : (
            <Cloud className="w-4 h-4 text-purple-600" />
          )}
        </div>
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-slate-900 truncate text-sm">{software.application_name}</h3>
          </div>
          
          {software.vendor && (
            <p className="text-[10px] text-slate-500 truncate">{software.vendor}</p>
          )}
          
          {/* License Type Pills */}
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {/* Catalog Only - No licenses yet */}
            {!hasAnyLicense && (
              <div className="flex items-center gap-1 px-1.5 py-0.5 bg-slate-50 rounded border border-slate-200">
                <Cloud className="w-2.5 h-2.5 text-slate-400" />
                <span className="text-[10px] font-medium text-slate-500">No licenses</span>
              </div>
            )}
            
            {/* Managed License Pill */}
            {hasManagedLicense && (
              <div className="flex items-center gap-1 px-1.5 py-0.5 bg-blue-50 rounded border border-blue-100">
                <Building2 className="w-2.5 h-2.5 text-blue-600" />
                <span className="text-[10px] font-medium text-blue-700">{managedUsed}/{managedSeats}</span>
                
                {/* Utilization indicator */}
                <div className="w-8 h-1 bg-blue-200 rounded-full overflow-hidden">
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
                  "text-[10px] font-medium",
                  managedUtilization >= 90 ? "text-emerald-600" :
                  managedUtilization >= 50 ? "text-amber-600" : "text-red-600"
                )}>
                  {managedUtilization.toFixed(0)}%
                </span>
              </div>
            )}
            
            {/* Individual Licenses Pill */}
            {hasIndividualLicenses && (
              <div className="flex items-center gap-1 px-1.5 py-0.5 bg-emerald-50 rounded border border-emerald-100">
                <User className="w-2.5 h-2.5 text-emerald-600" />
                <span className="text-[10px] font-medium text-emerald-700">{individualCount} user{individualCount !== 1 ? 's' : ''}</span>
              </div>
            )}
          </div>
          
          {/* Unused seats warning - only show for non-auto-synced licenses with actual unused seats */}
          {hasManagedLicense && !isAutoSynced && managedUnused > 0 && managedUtilization < 50 && (
            <p className="text-[10px] text-red-500 mt-1">
              {managedUnused} unused seat{managedUnused !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}