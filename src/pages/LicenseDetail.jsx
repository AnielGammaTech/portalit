import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { 
  ArrowLeft, Cloud, Users, DollarSign, Calendar, 
  Edit2, Trash2, Plus, CheckCircle2, AlertCircle,
  Globe, Building2, RefreshCw
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { format, parseISO, differenceInDays } from 'date-fns';
import LicenseAssignmentModal from '../components/saas/LicenseAssignmentModal';
import EditLicenseModal from '../components/saas/EditLicenseModal';

export default function LicenseDetail() {
  const params = new URLSearchParams(window.location.search);
  const licenseId = params.get('id');
  const queryClient = useQueryClient();
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [syncingUsers, setSyncingUsers] = useState(false);

  const { data: license, isLoading: loadingLicense } = useQuery({
    queryKey: ['license', licenseId],
    queryFn: async () => {
      const licenses = await base44.entities.SaaSLicense.filter({ id: licenseId });
      return licenses[0];
    },
    enabled: !!licenseId
  });

  const { data: customer } = useQuery({
    queryKey: ['customer', license?.customer_id],
    queryFn: async () => {
      const customers = await base44.entities.Customer.filter({ id: license.customer_id });
      return customers[0];
    },
    enabled: !!license?.customer_id
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ['contacts', license?.customer_id],
    queryFn: () => base44.entities.Contact.filter({ customer_id: license.customer_id }),
    enabled: !!license?.customer_id
  });

  const { data: assignments = [] } = useQuery({
    queryKey: ['license_assignments', licenseId],
    queryFn: () => base44.entities.LicenseAssignment.filter({ license_id: licenseId }),
    enabled: !!licenseId
  });

  const activeAssignments = assignments.filter(a => a.status === 'active');
  const utilizationPercent = license?.quantity > 0 ? (activeAssignments.length / license.quantity) * 100 : 0;
  const unusedSeats = (license?.quantity || 0) - activeAssignments.length;
  const wastedCost = license?.quantity > 0 ? (unusedSeats / license.quantity) * (license?.total_cost || 0) : 0;
  const daysUntilRenewal = license?.renewal_date ? differenceInDays(parseISO(license.renewal_date), new Date()) : null;

  const handleAssign = async (contactId) => {
    await base44.entities.LicenseAssignment.create({
      license_id: licenseId,
      contact_id: contactId,
      customer_id: license.customer_id,
      assigned_date: new Date().toISOString().split('T')[0],
      status: 'active'
    });
    await base44.entities.SaaSLicense.update(licenseId, { assigned_users: activeAssignments.length + 1 });
    queryClient.invalidateQueries({ queryKey: ['license_assignments', licenseId] });
    queryClient.invalidateQueries({ queryKey: ['license', licenseId] });
    toast.success('License assigned!');
  };

  const handleRevoke = async (contactId) => {
    const assignment = assignments.find(a => a.contact_id === contactId && a.status === 'active');
    if (assignment) {
      await base44.entities.LicenseAssignment.update(assignment.id, { status: 'revoked' });
      await base44.entities.SaaSLicense.update(licenseId, { assigned_users: Math.max(0, activeAssignments.length - 1) });
      queryClient.invalidateQueries({ queryKey: ['license_assignments', licenseId] });
      queryClient.invalidateQueries({ queryKey: ['license', licenseId] });
      toast.success('License revoked!');
    }
  };

  const handleEditSave = async (updatedData) => {
    await base44.entities.SaaSLicense.update(licenseId, updatedData);
    queryClient.invalidateQueries({ queryKey: ['license', licenseId] });
    setShowEditModal(false);
    toast.success('License updated!');
  };

  const handleDelete = async () => {
    await base44.entities.SaaSLicense.delete(licenseId);
    toast.success('License deleted!');
    window.location.href = createPageUrl(`CustomerDetail?id=${license.customer_id}`);
  };

  const isJumpCloudLicense = license?.source === 'jumpcloud' || license?.vendor?.toLowerCase() === 'jumpcloud';

  const syncJumpCloudUsers = async () => {
    setSyncingUsers(true);
    try {
      const response = await base44.functions.invoke('syncJumpCloudLicenses', { 
        action: 'sync_users', 
        customer_id: license.customer_id 
      });
      if (response.data.success) {
        toast.success(`Synced ${response.data.totalJumpCloudUsers} users: ${response.data.created} new, ${response.data.matched} matched!`);
        queryClient.invalidateQueries({ queryKey: ['contacts', license.customer_id] });
      } else {
        toast.error(response.data.error || 'User sync failed');
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSyncingUsers(false);
    }
  };

  if (loadingLicense) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    );
  }

  if (!license) {
    return (
      <div className="text-center py-12">
        <Cloud className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-slate-900 mb-2">License Not Found</h2>
        <Link to={createPageUrl('Dashboard')}>
          <Button><ArrowLeft className="w-4 h-4 mr-2" />Back</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Back Button */}
      <Link to={createPageUrl(`CustomerDetail?id=${license.customer_id}`)}>
        <Button variant="ghost" size="sm" className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back to {customer?.name || 'Customer'}
        </Button>
      </Link>

      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex items-start gap-6">
          <div className="w-20 h-20 rounded-2xl bg-purple-100 flex items-center justify-center overflow-hidden flex-shrink-0">
            {license.logo_url ? (
              <img src={license.logo_url} alt={license.application_name} className="w-16 h-16 object-contain" />
            ) : (
              <Cloud className="w-10 h-10 text-purple-600" />
            )}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-slate-900">{license.application_name}</h1>
              <Badge className={cn(
                "capitalize",
                license.status === 'active' && "bg-emerald-100 text-emerald-700",
                license.status === 'suspended' && "bg-amber-100 text-amber-700",
                license.status === 'cancelled' && "bg-red-100 text-red-700"
              )}>
                {license.status}
              </Badge>
              {license.category && (
                <Badge variant="outline" className="capitalize">{license.category}</Badge>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
              {license.vendor && <span>{license.vendor}</span>}
              {license.license_type && <span>• {license.license_type}</span>}
              {license.website_url && (
                <a href={license.website_url.startsWith('http') ? license.website_url : `https://${license.website_url}`} 
                   target="_blank" rel="noopener noreferrer"
                   className="flex items-center gap-1 text-purple-600 hover:underline">
                  <Globe className="w-3 h-3" />
                  Website
                </a>
              )}
            </div>
            {license.notes && (
              <p className="text-sm text-slate-600 mt-3 bg-slate-50 rounded-lg p-3">{license.notes}</p>
            )}
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            className="gap-2 flex-shrink-0"
            onClick={() => setShowEditModal(true)}
          >
            <Edit2 className="w-4 h-4" />
            Edit
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">${(license.total_cost || 0).toLocaleString()}</p>
              <p className="text-xs text-slate-500">Monthly Cost</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center",
              utilizationPercent >= 70 ? "bg-emerald-100" : "bg-amber-100"
            )}>
              <Users className={cn("w-5 h-5", utilizationPercent >= 70 ? "text-emerald-600" : "text-amber-600")} />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{activeAssignments.length}/{license.quantity || 0}</p>
              <p className="text-xs text-slate-500">Seats Used ({utilizationPercent.toFixed(0)}%)</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center",
              unusedSeats > 0 ? "bg-red-100" : "bg-emerald-100"
            )}>
              <AlertCircle className={cn("w-5 h-5", unusedSeats > 0 ? "text-red-600" : "text-emerald-600")} />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{unusedSeats}</p>
              <p className="text-xs text-slate-500">Unused Seats</p>
              {wastedCost > 0 && <p className="text-xs text-red-500">${wastedCost.toFixed(0)} wasted</p>}
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center",
              daysUntilRenewal !== null && daysUntilRenewal <= 30 ? "bg-amber-100" : "bg-blue-100"
            )}>
              <Calendar className={cn(
                "w-5 h-5",
                daysUntilRenewal !== null && daysUntilRenewal <= 30 ? "text-amber-600" : "text-blue-600"
              )} />
            </div>
            <div>
              {license.renewal_date ? (
                <>
                  <p className="text-lg font-bold text-slate-900">{format(parseISO(license.renewal_date), 'MMM d, yyyy')}</p>
                  <p className="text-xs text-slate-500">
                    {daysUntilRenewal > 0 ? `${daysUntilRenewal} days` : 'Overdue'}
                  </p>
                </>
              ) : (
                <p className="text-sm text-slate-500">No renewal date</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Utilization Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-900">License Utilization</h2>
          <span className={cn(
            "text-sm font-medium px-3 py-1 rounded-full",
            utilizationPercent >= 90 ? "bg-emerald-100 text-emerald-700" :
            utilizationPercent >= 50 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
          )}>
            {utilizationPercent.toFixed(0)}% utilized
          </span>
        </div>
        <div className="h-4 bg-slate-200 rounded-full overflow-hidden">
          <div 
            className={cn(
              "h-full rounded-full transition-all",
              utilizationPercent >= 90 ? "bg-emerald-500" :
              utilizationPercent >= 50 ? "bg-amber-500" : "bg-red-500"
            )}
            style={{ width: `${Math.min(100, utilizationPercent)}%` }}
          />
        </div>
        <div className="flex justify-between text-sm text-slate-500 mt-2">
          <span>{activeAssignments.length} assigned</span>
          <span>{unusedSeats} available</span>
        </div>
      </div>

      {/* Assigned Users */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-slate-900">Assigned Users</h2>
            <p className="text-sm text-slate-500">{activeAssignments.length} of {license.quantity} seats used</p>
          </div>
          <div className="flex items-center gap-2">
            {isJumpCloudLicense && (
              <Button 
                size="sm" 
                variant="outline"
                className="gap-2"
                onClick={syncJumpCloudUsers}
                disabled={syncingUsers}
              >
                <RefreshCw className={cn("w-4 h-4", syncingUsers && "animate-spin")} />
                Sync Users from JumpCloud
              </Button>
            )}
            <Button 
              size="sm" 
              className="gap-2 bg-purple-600 hover:bg-purple-700"
              onClick={() => setShowAssignModal(true)}
              disabled={unusedSeats <= 0}
            >
              <Plus className="w-4 h-4" />
              Assign User
            </Button>
          </div>
        </div>
        {activeAssignments.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 mb-4">No users assigned to this license</p>
            <div className="flex items-center justify-center gap-3">
              {isJumpCloudLicense && (
                <Button 
                  variant="outline"
                  onClick={syncJumpCloudUsers}
                  disabled={syncingUsers}
                >
                  <RefreshCw className={cn("w-4 h-4 mr-2", syncingUsers && "animate-spin")} />
                  Sync Users from JumpCloud
                </Button>
              )}
              <Button onClick={() => setShowAssignModal(true)} className="bg-purple-600 hover:bg-purple-700">
                <Plus className="w-4 h-4 mr-2" />
                Assign First User
              </Button>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {activeAssignments.map(assignment => {
              const contact = contacts.find(c => c.id === assignment.contact_id);
              return (
                <div key={assignment.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 font-medium">
                      {contact?.full_name?.charAt(0) || '?'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-slate-900">{contact?.full_name || 'Unknown User'}</p>
                        {contact?.source === 'jumpcloud' && (
                          <Badge className="bg-blue-100 text-blue-700 text-xs">JumpCloud</Badge>
                        )}
                        {contact?.source === 'halopsa' && (
                          <Badge className="bg-amber-100 text-amber-700 text-xs">Halo</Badge>
                        )}
                        {contact?.source === 'manual' && (
                          <Badge variant="outline" className="text-xs">Manual</Badge>
                        )}
                      </div>
                      <p className="text-sm text-slate-500">{contact?.email || 'No email'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-slate-500">
                      Assigned {assignment.assigned_date ? format(parseISO(assignment.assigned_date), 'MMM d, yyyy') : ''}
                    </span>
                    <Button 
                      size="sm" 
                      variant="outline"
                      className="text-red-600 border-red-200 hover:bg-red-50"
                      onClick={() => handleRevoke(assignment.contact_id)}
                    >
                      Revoke
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Assignment Modal */}
      <LicenseAssignmentModal
        open={showAssignModal}
        onClose={() => setShowAssignModal(false)}
        license={license}
        contacts={contacts}
        assignments={assignments}
        onAssign={handleAssign}
        onRevoke={handleRevoke}
      />

      {/* Edit Modal */}
      <EditLicenseModal
        open={showEditModal}
        onClose={() => setShowEditModal(false)}
        license={license}
        onSave={handleEditSave}
        onDelete={handleDelete}
      />
    </div>
  );
}