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
      className="group bg-white hover:bg-slate-50 rounded-lg border border-slate-200 px-3.5 py-2.5 transition-all hover:shadow-sm cursor-pointer block"
    >
      <div className="flex items-center gap-2.5">
        {/* Logo */}
        <div className={cn(
          "w-8 h-8 rounded-md flex items-center justify-center overflow-hidden flex-shrink-0",
          !software.logo_url && "bg-purple-100 border border-purple-200"
        )}>
        {software.logo_url ? (
            <img src={software.logo_url} alt={software.application_name} className="w-6 h-6 object-contain" />
          ) : (
            <Cloud className="w-3.5 h-3.5 text-purple-600" />
          )}
        </div>
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-slate-900 truncate text-sm leading-tight">{software.application_name}</h3>
          
          <div className="flex items-center gap-1.5 mt-0.5">
            {software.vendor && (
              <span className="text-xs text-slate-400 truncate max-w-[100px]">{software.vendor}</span>
            )}
            
            {/* License info inline */}
            {!hasAnyLicense && (
              <span className="text-xs text-slate-400">No licenses</span>
            )}
            
            {hasManagedLicense && (
              <div className="flex items-center gap-0.5">
                <Building2 className="w-3 h-3 text-blue-500" />
                <span className="text-xs font-medium text-slate-500">{managedUsed}/{managedSeats}</span>
              </div>
            )}
            
            {hasIndividualLicenses && (
              <div className="flex items-center gap-0.5">
                <User className="w-3 h-3 text-emerald-500" />
                <span className="text-xs font-medium text-slate-500">{individualCount}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}