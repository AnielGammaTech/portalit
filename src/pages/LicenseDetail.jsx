import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { 
  ArrowLeft, Cloud, Users, DollarSign, Calendar, 
  Edit2, Trash2, Plus, CheckCircle2, AlertCircle,
  Globe, Building2, RefreshCw, CreditCard, User
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import AddUserLicenseModal from '../components/saas/AddUserLicenseModal';
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
  const [showAddSeatsModal, setShowAddSeatsModal] = useState(false);
  const [additionalSeats, setAdditionalSeats] = useState(1);
  const [showAddUserLicense, setShowAddUserLicense] = useState(false);

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

  // Redirect to Customer detail if no license id or license not found
  useEffect(() => {
    if (!licenseId) {
      window.location.href = createPageUrl('CustomerDetail');
      return;
    }
    if (!loadingLicense && !license) {
      window.location.href = createPageUrl('CustomerDetail');
    }
  }, [licenseId, loadingLicense, license]);

  const activeAssignments = assignments.filter(a => a.status === 'active');
  const isPerUser = license?.management_type === 'per_user';
  const utilizationPercent = license?.quantity > 0 ? (activeAssignments.length / license.quantity) * 100 : 0;
  const unusedSeats = isPerUser ? Infinity : ((license?.quantity || 0) - activeAssignments.length);
  const wastedCost = !isPerUser && license?.quantity > 0 ? (unusedSeats / license.quantity) * (license?.total_cost || 0) : 0;
  const daysUntilRenewal = license?.renewal_date ? differenceInDays(parseISO(license.renewal_date), new Date()) : null;
  
  // For per-user licenses, calculate total from individual assignments
  const perUserTotalCost = isPerUser ? activeAssignments.reduce((sum, a) => sum + (a.cost_per_license || license?.cost_per_license || 0), 0) : 0;

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

  const handleAddIndividualLicense = async (data) => {
    await base44.entities.LicenseAssignment.create({
      license_id: licenseId,
      contact_id: data.contact_id,
      customer_id: license.customer_id,
      assigned_date: new Date().toISOString().split('T')[0],
      status: 'active',
      renewal_date: data.renewal_date,
      card_last_four: data.card_last_four,
      cost_per_license: data.cost_per_license
    });
    await base44.entities.SaaSLicense.update(licenseId, { assigned_users: activeAssignments.length + 1 });
    queryClient.invalidateQueries({ queryKey: ['license_assignments', licenseId] });
    queryClient.invalidateQueries({ queryKey: ['license', licenseId] });
    toast.success(`License added for ${data.contact_name}!`);
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

  const handleAddSeats = async () => {
    const newQuantity = (license.quantity || 0) + additionalSeats;
    const newTotalCost = newQuantity * (license.cost_per_license || 0);
    await base44.entities.SaaSLicense.update(licenseId, { 
      quantity: newQuantity,
      total_cost: newTotalCost
    });
    queryClient.invalidateQueries({ queryKey: ['license', licenseId] });
    setShowAddSeatsModal(false);
    setAdditionalSeats(1);
    toast.success(`Added ${additionalSeats} seat${additionalSeats > 1 ? 's' : ''}!`);
  };

  const isJumpCloudLicense = license?.source === 'jumpcloud' || license?.vendor?.toLowerCase() === 'jumpcloud';
  const isSpanningLicense = license?.source === 'spanning' || license?.vendor?.toLowerCase().includes('spanning');

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

  const syncSpanningUsers = async () => {
    setSyncingUsers(true);
    try {
      const response = await base44.functions.invoke('syncSpanningBackup', { 
        action: 'sync_users', 
        customer_id: license.customer_id 
      });
      if (response.data.success) {
        toast.success(`Synced ${response.data.totalSpanningUsers} users: ${response.data.created} new, ${response.data.matched} matched!`);
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
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Back Button */}
      <Link to={createPageUrl(`CustomerDetail?id=${license.customer_id}`)}>
        <Button variant="ghost" size="sm" className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back to {customer?.name || 'Customer'}
        </Button>
      </Link>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT COLUMN - App Info & License Details */}
        <div className="lg:col-span-1 space-y-6">
          {/* App Header Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-16 h-16 rounded-2xl bg-purple-100 flex items-center justify-center overflow-hidden">
                {license.logo_url ? (
                  <img src={license.logo_url} alt={license.application_name} className="w-14 h-14 object-contain" />
                ) : (
                  <Cloud className="w-8 h-8 text-purple-600" />
                )}
              </div>
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => setShowEditModal(true)}
              >
                <Edit2 className="w-4 h-4" />
              </Button>
            </div>
            <h1 className="text-xl font-bold text-slate-900 mb-2">{license.application_name}</h1>
            <div className="flex flex-wrap gap-2 mb-4">
              <Badge className={cn(
                "capitalize",
                license.status === 'active' && "bg-emerald-100 text-emerald-700",
                license.status === 'suspended' && "bg-amber-100 text-amber-700",
                license.status === 'cancelled' && "bg-red-100 text-red-700"
              )}>
                {license.status}
              </Badge>
              <Badge variant="outline" className="capitalize">
                {isPerUser ? 'Individual' : 'Managed'}
              </Badge>
              {license.category && (
                <Badge variant="outline" className="capitalize">{license.category}</Badge>
              )}
            </div>
            
            <div className="space-y-3 text-sm">
              {license.vendor && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Vendor</span>
                  <span className="font-medium text-slate-900">{license.vendor}</span>
                </div>
              )}
              {license.license_type && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">License Type</span>
                  <span className="font-medium text-slate-900">{license.license_type}</span>
                </div>
              )}
              {license.website_url && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Website</span>
                  <a href={license.website_url.startsWith('http') ? license.website_url : `https://${license.website_url}`} 
                     target="_blank" rel="noopener noreferrer"
                     className="flex items-center gap-1 text-purple-600 hover:underline font-medium">
                    <Globe className="w-3 h-3" />
                    Visit
                  </a>
                </div>
              )}
            </div>
            
            {license.notes && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-xs text-slate-500 mb-1">Notes</p>
                <p className="text-sm text-slate-600">{license.notes}</p>
              </div>
            )}
          </div>

          {/* Managed License - Company Billing Info */}
          {!isPerUser && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <Building2 className="w-5 h-5 text-purple-600" />
                <h2 className="font-semibold text-slate-900">Company License</h2>
              </div>
              
              <div className="space-y-4">
                <div className="bg-purple-50 rounded-xl p-4">
                  <p className="text-xs text-purple-600 font-medium uppercase tracking-wide mb-1">Monthly Cost</p>
                  <p className="text-2xl font-bold text-purple-900">${(license.total_cost || 0).toLocaleString()}</p>
                  <p className="text-xs text-purple-600 mt-1">${license.cost_per_license || 0}/seat × {license.quantity || 0} seats</p>
                </div>

                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Total Seats</span>
                    <span className="font-bold text-slate-900">{license.quantity || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Assigned</span>
                    <span className="font-medium text-emerald-600">{activeAssignments.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Available</span>
                    <span className={cn("font-medium", unusedSeats > 0 ? "text-amber-600" : "text-slate-900")}>{unusedSeats}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Billing Cycle</span>
                    <span className="font-medium text-slate-900 capitalize">{license.billing_cycle || 'Monthly'}</span>
                  </div>
                  {license.renewal_date && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Renewal Date</span>
                      <span className={cn(
                        "font-medium",
                        daysUntilRenewal !== null && daysUntilRenewal <= 30 ? "text-amber-600" : "text-slate-900"
                      )}>
                        {format(parseISO(license.renewal_date), 'MMM d, yyyy')}
                      </span>
                    </div>
                  )}
                  {license.card_last_four && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Payment Card</span>
                      <span className="font-medium text-slate-900 flex items-center gap-1">
                        <CreditCard className="w-3 h-3" />
                        •••• {license.card_last_four}
                      </span>
                    </div>
                  )}
                </div>

                {/* Utilization Bar */}
                <div className="pt-3 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-slate-500">Utilization</span>
                    <span className={cn(
                      "text-xs font-medium",
                      utilizationPercent >= 90 ? "text-emerald-600" :
                      utilizationPercent >= 50 ? "text-amber-600" : "text-red-600"
                    )}>
                      {utilizationPercent.toFixed(0)}%
                    </span>
                  </div>
                  <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div 
                      className={cn(
                        "h-full rounded-full transition-all",
                        utilizationPercent >= 90 ? "bg-emerald-500" :
                        utilizationPercent >= 50 ? "bg-amber-500" : "bg-red-500"
                      )}
                      style={{ width: `${Math.min(100, utilizationPercent)}%` }}
                    />
                  </div>
                  {wastedCost > 0 && (
                    <p className="text-xs text-red-500 mt-2">~${wastedCost.toFixed(0)}/mo unused</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Individual License - Summary */}
          {isPerUser && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-5 h-5 text-purple-600" />
                <h2 className="font-semibold text-slate-900">Individual Licenses</h2>
              </div>
              
              <div className="space-y-4">
                <div className="bg-purple-50 rounded-xl p-4">
                  <p className="text-xs text-purple-600 font-medium uppercase tracking-wide mb-1">Total Monthly Cost</p>
                  <p className="text-2xl font-bold text-purple-900">${perUserTotalCost.toLocaleString()}</p>
                  <p className="text-xs text-purple-600 mt-1">{activeAssignments.length} individual license{activeAssignments.length !== 1 ? 's' : ''}</p>
                </div>

                <p className="text-sm text-slate-500">
                  Each user has their own license with individual billing, renewal dates, and payment methods.
                </p>
              </div>
            </div>
          )}

          {/* Sync Options */}
          {(isJumpCloudLicense || isSpanningLicense) && (
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-xs text-slate-500 font-medium mb-3">SYNC OPTIONS</p>
              <div className="space-y-2">
                {isJumpCloudLicense && (
                  <Button 
                    size="sm" 
                    variant="outline"
                    className="w-full gap-2"
                    onClick={syncJumpCloudUsers}
                    disabled={syncingUsers}
                  >
                    <RefreshCw className={cn("w-4 h-4", syncingUsers && "animate-spin")} />
                    Sync from JumpCloud
                  </Button>
                )}
                {isSpanningLicense && (
                  <Button 
                    size="sm" 
                    variant="outline"
                    className="w-full gap-2"
                    onClick={syncSpanningUsers}
                    disabled={syncingUsers}
                  >
                    <RefreshCw className={cn("w-4 h-4", syncingUsers && "animate-spin")} />
                    Sync from Spanning
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN - Users/Assignments */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden h-full">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-slate-900">
                  {isPerUser ? 'License Holders' : 'Seat Assignments'}
                </h2>
                <p className="text-sm text-slate-500">
                  {isPerUser 
                    ? `${activeAssignments.length} individual license${activeAssignments.length !== 1 ? 's' : ''}`
                    : `${activeAssignments.length} of ${license.quantity || 0} seats assigned`
                  }
                </p>
              </div>
              <Button 
                size="sm" 
                className="gap-2 bg-purple-600 hover:bg-purple-700"
                onClick={() => (isPerUser ? setShowAddUserLicense(true) : setShowAssignModal(true))}
                disabled={!isPerUser && unusedSeats <= 0}
              >
                <Plus className="w-4 h-4" />
                {isPerUser ? 'Add License' : 'Assign Seat'}
              </Button>
            </div>
            
            {activeAssignments.length === 0 ? (
              <div className="p-12 text-center">
                <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500 mb-4">No users assigned yet</p>
                <Button 
                  onClick={() => (isPerUser ? setShowAddUserLicense(true) : setShowAssignModal(true))} 
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {isPerUser ? 'Add First License' : 'Assign First User'}
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
                {activeAssignments.map(assignment => {
                  const contact = contacts.find(c => c.id === assignment.contact_id);
                  return (
                    <div key={assignment.id} className="px-6 py-4 hover:bg-slate-50">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 font-medium flex-shrink-0">
                            {contact?.full_name?.charAt(0) || '?'}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium text-slate-900">{contact?.full_name || 'Unknown User'}</p>
                              {contact?.source && contact.source !== 'manual' && (
                                <Badge className={cn(
                                  "text-xs",
                                  contact.source === 'jumpcloud' && "bg-blue-100 text-blue-700",
                                  contact.source === 'halopsa' && "bg-amber-100 text-amber-700",
                                  contact.source === 'spanning' && "bg-green-100 text-green-700"
                                )}>
                                  {contact.source}
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-slate-500">{contact?.email || 'No email'}</p>
                            
                            {/* Individual License Details */}
                            {isPerUser && (
                              <div className="mt-3 bg-slate-50 rounded-lg p-3 space-y-2">
                                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                                  <div>
                                    <span className="text-slate-500">Cost</span>
                                    <p className="font-medium text-slate-900">
                                      ${assignment.cost_per_license || license.cost_per_license || 0}/mo
                                    </p>
                                  </div>
                                  <div>
                                    <span className="text-slate-500">Renewal</span>
                                    <p className="font-medium text-slate-900">
                                      {assignment.renewal_date 
                                        ? format(parseISO(assignment.renewal_date), 'MMM d, yyyy')
                                        : 'Not set'
                                      }
                                    </p>
                                  </div>
                                  <div>
                                    <span className="text-slate-500">Payment</span>
                                    <p className="font-medium text-slate-900 flex items-center gap-1">
                                      {assignment.card_last_four ? (
                                        <>
                                          <CreditCard className="w-3 h-3" />
                                          •••• {assignment.card_last_four}
                                        </>
                                      ) : (
                                        'Not set'
                                      )}
                                    </p>
                                  </div>
                                  <div>
                                    <span className="text-slate-500">Since</span>
                                    <p className="font-medium text-slate-900">
                                      {assignment.assigned_date 
                                        ? format(parseISO(assignment.assigned_date), 'MMM d, yyyy')
                                        : 'Unknown'
                                      }
                                    </p>
                                  </div>
                                </div>
                                {assignment.notes && (
                                  <p className="text-xs text-slate-500 pt-2 border-t border-slate-200">{assignment.notes}</p>
                                )}
                              </div>
                            )}
                            
                            {/* Managed License - Simple assigned date */}
                            {!isPerUser && assignment.assigned_date && (
                              <p className="text-xs text-slate-400 mt-1">
                                Assigned {format(parseISO(assignment.assigned_date), 'MMM d, yyyy')}
                              </p>
                            )}
                          </div>
                        </div>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => handleRevoke(assignment.contact_id)}
                        >
                          {isPerUser ? 'Remove' : 'Revoke'}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
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
        onAddIndividualLicense={handleAddIndividualLicense}
      />

      {/* Edit Modal */}
      <EditLicenseModal
        open={showEditModal}
        onClose={() => setShowEditModal(false)}
        license={license}
        onSave={handleEditSave}
        onDelete={handleDelete}
      />

      {/* Add User License Wizard */}
      <AddUserLicenseModal
        open={showAddUserLicense}
        onClose={() => setShowAddUserLicense(false)}
        license={license}
        contacts={contacts}
        onComplete={() => {
          queryClient.invalidateQueries({ queryKey: ['license_assignments', licenseId] });
          queryClient.invalidateQueries({ queryKey: ['license', licenseId] });
        }}
      />
    </div>
  );
}