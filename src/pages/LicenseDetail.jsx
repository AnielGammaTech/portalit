import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { 
  ArrowLeft, Cloud, Users, DollarSign, Calendar, 
  Edit2, Trash2, Plus, CheckCircle2, AlertCircle,
  Globe, Building2, RefreshCw, CreditCard, User,
  ChevronDown, ChevronUp
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import AddUserLicenseModal from '../components/saas/AddUserLicenseModal';
import AddManagedLicenseModal from '../components/saas/AddManagedLicenseModal';
import AddIndividualLicenseModal from '../components/saas/AddIndividualLicenseModal';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { format, parseISO, differenceInDays } from 'date-fns';
import LicenseAssignmentModal from '../components/saas/LicenseAssignmentModal';
import EditLicenseModal from '../components/saas/EditLicenseModal';
import EditIndividualLicenseModal from '../components/saas/EditIndividualLicenseModal';
import UserDetailModal from '../components/customer/UserDetailModal';

export default function LicenseDetail() {
  const params = new URLSearchParams(window.location.search);
  const licenseId = params.get('id');
  const queryClient = useQueryClient();
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [syncingUsers, setSyncingUsers] = useState(false);
  const [showModifySeatsModal, setShowModifySeatsModal] = useState(false);
  const [seatChange, setSeatChange] = useState(0);
  const [showAddUserLicense, setShowAddUserLicense] = useState(false);
  const [showAddManagedLicense, setShowAddManagedLicense] = useState(false);
  const [showAddIndividualLicense, setShowAddIndividualLicense] = useState(false);
  const [selectedContact, setSelectedContact] = useState(null);
  const [editingAssignment, setEditingAssignment] = useState(null);
  const [managedExpanded, setManagedExpanded] = useState(true);
  const [individualExpanded, setIndividualExpanded] = useState(true);
  const [managedSectionExpanded, setManagedSectionExpanded] = useState(true);
  const [individualSectionExpanded, setIndividualSectionExpanded] = useState(true);

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

  // Fetch ALL licenses for same application (both managed and individual)
  const { data: relatedLicenses = [] } = useQuery({
    queryKey: ['related_licenses', license?.application_name, license?.customer_id],
    queryFn: async () => {
      const allLicenses = await base44.entities.SaaSLicense.filter({ 
        customer_id: license.customer_id,
        application_name: license.application_name 
      });
      return allLicenses;
    },
    enabled: !!license?.customer_id && !!license?.application_name
  });

  // Separate managed and individual licenses - support multiple of each type
  const managedLicenses = relatedLicenses.filter(l => l.management_type === 'managed');
  const individualLicenses = relatedLicenses.filter(l => l.management_type === 'per_user');
  
  // For backwards compatibility
  const managedLicense = managedLicenses[0];
  const individualLicense = individualLicenses[0];

  const { data: contacts = [] } = useQuery({
    queryKey: ['contacts', license?.customer_id],
    queryFn: () => base44.entities.Contact.filter({ customer_id: license.customer_id }),
    enabled: !!license?.customer_id
  });

  // Fetch assignments for ALL related licenses (both managed and individual)
  const { data: allAssignments = [], refetch: refetchAssignments } = useQuery({
    queryKey: ['all_license_assignments', license?.application_name, license?.customer_id],
    queryFn: async () => {
      const licenseIds = relatedLicenses.map(l => l.id);
      const assignmentPromises = licenseIds.map(id => 
        base44.entities.LicenseAssignment.filter({ license_id: id })
      );
      const results = await Promise.all(assignmentPromises);
      return results.flat();
    },
    enabled: relatedLicenses.length > 0
  });

  // Real-time subscription for license assignments
  useEffect(() => {
    if (!license?.customer_id) return;

    const unsubscribe = base44.entities.LicenseAssignment.subscribe((event) => {
      if (event.data?.customer_id === license.customer_id) {
        // Immediately update local cache for faster UI
        queryClient.invalidateQueries({ queryKey: ['all_license_assignments'] });
        queryClient.invalidateQueries({ queryKey: ['related_licenses'] });
      }
    });

    return () => unsubscribe();
  }, [license?.customer_id, queryClient]);

  // Separate assignments by license type - support multiple licenses
  const managedAssignments = allAssignments.filter(a => 
    managedLicenses.some(l => l.id === a.license_id) && a.status === 'active'
  );
  const individualAssignments = allAssignments.filter(a => 
    individualLicenses.some(l => l.id === a.license_id) && a.status === 'active'
  );
  
  // Group assignments by license for display
  const getAssignmentsForLicense = (licenseId) => 
    allAssignments.filter(a => a.license_id === licenseId && a.status === 'active');

  // Keep backwards compatibility
  const assignments = allAssignments;

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
  
  // Check if we have both license types for this software
  const hasBothTypes = !!managedLicense && !!individualLicense;
  
  // Managed license stats - aggregate across all managed licenses
  const totalManagedSeats = managedLicenses.reduce((sum, l) => sum + (l.quantity || 0), 0);
  const totalManagedCost = managedLicenses.reduce((sum, l) => sum + (l.total_cost || 0), 0);
  const managedUtilizationPercent = totalManagedSeats > 0 
    ? (managedAssignments.length / totalManagedSeats) * 100 : 0;
  const managedUnusedSeats = totalManagedSeats - managedAssignments.length;
  const managedWastedCost = totalManagedSeats > 0 
    ? (managedUnusedSeats / totalManagedSeats) * totalManagedCost : 0;
  const managedDaysUntilRenewal = managedLicense?.renewal_date 
    ? differenceInDays(parseISO(managedLicense.renewal_date), new Date()) : null;
  
  // Individual license stats
  const individualTotalCost = individualAssignments.reduce(
    (sum, a) => sum + (a.cost_per_license || individualLicense?.cost_per_license || 0), 0
  );
  
  // Legacy calculations for single license view
  const utilizationPercent = license?.quantity > 0 ? (activeAssignments.filter(a => a.license_id === license.id).length / license.quantity) * 100 : 0;
  const unusedSeats = isPerUser ? Infinity : ((license?.quantity || 0) - activeAssignments.filter(a => a.license_id === license.id).length);
  const wastedCost = !isPerUser && license?.quantity > 0 ? (unusedSeats / license.quantity) * (license?.total_cost || 0) : 0;
  const daysUntilRenewal = license?.renewal_date ? differenceInDays(parseISO(license.renewal_date), new Date()) : null;
  
  // For per-user licenses, calculate total from individual assignments
  const perUserTotalCost = isPerUser ? activeAssignments.filter(a => a.license_id === license.id).reduce((sum, a) => sum + (a.cost_per_license || license?.cost_per_license || 0), 0) : 0;
  
  // Combined total cost
  const combinedTotalCost = totalManagedCost + individualTotalCost;
  
  // State for which managed license to assign to
  const [selectedManagedLicenseId, setSelectedManagedLicenseId] = useState(null);

  const handleAssign = async (contactId, targetLicenseId = null) => {
    const licenseToAssign = targetLicenseId || selectedManagedLicenseId || managedLicense?.id || licenseId;
    
    // Optimistic update - add to cache immediately
    const newAssignment = {
      id: `temp-${Date.now()}`,
      license_id: licenseToAssign,
      contact_id: contactId,
      customer_id: license.customer_id,
      assigned_date: new Date().toISOString().split('T')[0],
      status: 'active'
    };
    
    queryClient.setQueryData(['all_license_assignments', license?.application_name, license?.customer_id], (old) => 
      old ? [...old, newAssignment] : [newAssignment]
    );
    
    toast.success('License assigned!');
    setShowAssignModal(false);
    setSelectedManagedLicenseId(null);
    
    // Then persist to database
    await base44.entities.LicenseAssignment.create({
      license_id: licenseToAssign,
      contact_id: contactId,
      customer_id: license.customer_id,
      assigned_date: new Date().toISOString().split('T')[0],
      status: 'active'
    });
    
    // Refresh to get real IDs
    queryClient.invalidateQueries({ queryKey: ['all_license_assignments'] });
  };

  const handleAddIndividualLicense = async (data) => {
    // Optimistic update
    const contact = contacts.find(c => c.id === data.contact_id);
    const newAssignment = {
      id: `temp-${Date.now()}`,
      license_id: individualLicense?.id || `temp-license-${Date.now()}`,
      contact_id: data.contact_id,
      customer_id: license.customer_id,
      assigned_date: new Date().toISOString().split('T')[0],
      status: 'active',
      renewal_date: data.renewal_date,
      card_last_four: data.card_last_four,
      cost_per_license: data.cost_per_license,
      license_type: data.license_type
    };
    
    queryClient.setQueryData(['all_license_assignments', license?.application_name, license?.customer_id], (old) => 
      old ? [...old, newAssignment] : [newAssignment]
    );
    
    setShowAddIndividualLicense(false);
    toast.success(`License added for ${contact?.full_name || 'user'}!`);
    
    // First, find or create per_user license for this software
    let perUserLicense = individualLicense;
    
    if (!perUserLicense) {
      perUserLicense = await base44.entities.SaaSLicense.create({
        customer_id: license.customer_id,
        application_name: license.application_name,
        vendor: license.vendor,
        logo_url: license.logo_url,
        website_url: license.website_url,
        category: license.category,
        management_type: 'per_user',
        status: 'active',
        source: 'manual'
      });
      queryClient.invalidateQueries({ queryKey: ['related_licenses'] });
    }
    
    await base44.entities.LicenseAssignment.create({
      license_id: perUserLicense.id,
      contact_id: data.contact_id,
      customer_id: license.customer_id,
      assigned_date: new Date().toISOString().split('T')[0],
      status: 'active',
      renewal_date: data.renewal_date,
      card_last_four: data.card_last_four,
      cost_per_license: data.cost_per_license,
      license_type: data.license_type
    });
    
    queryClient.invalidateQueries({ queryKey: ['all_license_assignments'] });
  };

  const handleAddManagedLicense = async (data) => {
    // First, find or create managed license for this software
    let newManagedLicense = managedLicense;
    
    if (!newManagedLicense) {
      // Create a new managed license record for this software
      newManagedLicense = await base44.entities.SaaSLicense.create({
        customer_id: license.customer_id,
        application_name: license.application_name,
        vendor: license.vendor,
        logo_url: license.logo_url,
        website_url: license.website_url,
        category: license.category,
        management_type: 'managed',
        license_type: data.license_type,
        quantity: data.quantity,
        cost_per_license: data.cost_per_license,
        total_cost: data.total_cost,
        billing_cycle: data.billing_cycle,
        renewal_date: data.renewal_date,
        card_last_four: data.card_last_four,
        status: 'active',
        source: 'manual'
      });
    } else {
      // Update existing managed license
      await base44.entities.SaaSLicense.update(newManagedLicense.id, {
        license_type: data.license_type,
        quantity: data.quantity,
        cost_per_license: data.cost_per_license,
        total_cost: data.total_cost,
        billing_cycle: data.billing_cycle,
        renewal_date: data.renewal_date,
        card_last_four: data.card_last_four
      });
    }
    
    queryClient.invalidateQueries({ queryKey: ['related_licenses'] });
    queryClient.invalidateQueries({ queryKey: ['license', licenseId] });
    setShowAddManagedLicense(false);
    toast.success('Managed license added!');
  };

  const handleRevoke = async (contactId) => {
    const assignment = allAssignments.find(a => a.contact_id === contactId && a.status === 'active');
    if (assignment) {
      // Optimistic update - remove from cache immediately
      queryClient.setQueryData(['all_license_assignments', license?.application_name, license?.customer_id], (old) => 
        old ? old.filter(a => a.id !== assignment.id) : []
      );
      
      toast.success('License revoked!');
      
      // Then persist to database
      await base44.entities.LicenseAssignment.update(assignment.id, { status: 'revoked' });
      queryClient.invalidateQueries({ queryKey: ['all_license_assignments'] });
    }
  };

  const handleEditSave = async (updatedData) => {
    await base44.entities.SaaSLicense.update(licenseId, updatedData);
    queryClient.invalidateQueries({ queryKey: ['license', licenseId] });
    setShowEditModal(false);
    toast.success('License updated!');
  };

  const handleDelete = async () => {
    // Delete ALL related licenses and their assignments for this software
    const allLicenseIds = relatedLicenses.map(l => l.id);
    
    // Delete all assignments for all related licenses
    for (const assignment of allAssignments) {
      await base44.entities.LicenseAssignment.delete(assignment.id);
    }
    
    // Delete all related licenses (managed and individual)
    for (const licId of allLicenseIds) {
      await base44.entities.SaaSLicense.delete(licId);
    }
    
    toast.success('Software and all licenses deleted!');
    window.location.href = createPageUrl(`CustomerDetail?id=${license.customer_id}`);
  };

      const handleUpdateAssignment = async (assignmentId, data) => {
        await base44.entities.LicenseAssignment.update(assignmentId, data);
        queryClient.invalidateQueries({ queryKey: ['all_license_assignments'] });
        toast.success('License updated!');
      };

  const handleModifySeats = async () => {
        if (!managedLicense || seatChange === 0) return;
        const newQuantity = Math.max(managedAssignments.length, (managedLicense.quantity || 0) + seatChange);
        const newTotalCost = newQuantity * (managedLicense.cost_per_license || 0);
        await base44.entities.SaaSLicense.update(managedLicense.id, { 
          quantity: newQuantity,
          total_cost: newTotalCost
        });
        queryClient.invalidateQueries({ queryKey: ['related_licenses'] });
        queryClient.invalidateQueries({ queryKey: ['license', licenseId] });
        setShowModifySeatsModal(false);
        setSeatChange(0);
        toast.success(`Seats updated to ${newQuantity}!`);
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
        {/* LEFT COLUMN - App Info & License Summary */}
        <div className="lg:col-span-1 space-y-6">
          {/* App Header Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                {license.logo_url ? (
                  <img src={license.logo_url} alt={license.application_name} className="w-10 h-10 object-contain" />
                ) : (
                  <Cloud className="w-6 h-6 text-purple-600" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <h1 className="text-lg font-bold text-slate-900 truncate">{license.application_name}</h1>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="h-7 w-7 -mt-1"
                    onClick={() => setShowEditModal(true)}
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  <Badge className={cn(
                    "capitalize text-xs",
                    license.status === 'active' && "bg-emerald-100 text-emerald-700",
                    license.status === 'suspended' && "bg-amber-100 text-amber-700",
                    license.status === 'cancelled' && "bg-red-100 text-red-700"
                  )}>
                    {license.status}
                  </Badge>
                  {license.category && (
                    <Badge variant="outline" className="capitalize text-xs">{license.category}</Badge>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              {license.vendor && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 text-xs">Vendor</span>
                  <span className="font-medium text-slate-900 text-xs">{license.vendor}</span>
                </div>
              )}
              {license.website_url && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 text-xs">Website</span>
                  <a href={license.website_url.startsWith('http') ? license.website_url : `https://${license.website_url}`} 
                     target="_blank" rel="noopener noreferrer"
                     className="flex items-center gap-1 text-purple-600 hover:underline font-medium text-xs">
                    <Globe className="w-3 h-3" />
                    Visit
                  </a>
                </div>
              )}
            </div>

            {license.notes && (
              <div className="mt-3 pt-3 border-t border-slate-100">
                <p className="text-xs text-slate-600 line-clamp-2">{license.notes}</p>
              </div>
            )}
          </div>

          {/* Combined Cost Summary - Enhanced */}
          <div className="bg-gradient-to-br from-slate-700 to-slate-800 rounded-xl p-4 text-white">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs text-slate-300 font-medium uppercase tracking-wide">Monthly Cost</p>
                <p className="text-2xl font-bold">${combinedTotalCost.toLocaleString()}</p>
              </div>
              <div className="text-right text-xs text-slate-300">
                <p className="font-medium text-white">{managedAssignments.length + individualAssignments.length} users</p>
                {managedLicense && <p>Managed: ${(managedLicense.total_cost || 0).toLocaleString()}</p>}
                {individualLicense && <p>Individual: ${individualTotalCost.toLocaleString()}</p>}
              </div>
            </div>

            {/* Cost per user & utilization */}
            <div className="pt-3 border-t border-slate-600 grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-lg font-semibold">
                  ${(managedAssignments.length + individualAssignments.length) > 0 
                    ? (combinedTotalCost / (managedAssignments.length + individualAssignments.length)).toFixed(0) 
                    : '0'}
                </p>
                <p className="text-xs text-slate-400">Avg/User</p>
              </div>
              <div>
                <p className="text-lg font-semibold">
                  {managedLicense ? `${managedUtilizationPercent.toFixed(0)}%` : '—'}
                </p>
                <p className="text-xs text-slate-400">Utilization</p>
              </div>
              <div>
                <p className="text-lg font-semibold text-amber-400">
                  {managedWastedCost > 0 ? `$${managedWastedCost.toFixed(0)}` : '$0'}
                </p>
                <p className="text-xs text-slate-400">Unused</p>
              </div>
            </div>
          </div>

          {/* Managed License Card - Collapsible */}
          {managedLicense && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <button 
                onClick={() => setManagedExpanded(!managedExpanded)}
                className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Building2 className="w-4 h-4 text-blue-600" />
                  <div className="text-left">
                    <p className="font-medium text-slate-900 text-sm">Managed License</p>
                    <p className="text-xs text-slate-500">{managedAssignments.length}/{managedLicense.quantity || 0} seats • ${(managedLicense.total_cost || 0).toLocaleString()}/mo</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div 
                      className={cn(
                        "h-full rounded-full",
                        managedUtilizationPercent >= 90 ? "bg-emerald-500" :
                        managedUtilizationPercent >= 50 ? "bg-amber-500" : "bg-red-500"
                      )}
                      style={{ width: `${Math.min(100, managedUtilizationPercent)}%` }}
                    />
                  </div>
                  {managedExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </div>
              </button>
              
              {managedExpanded && (
                <div className="px-4 pb-4 pt-2 border-t border-slate-100 space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Available</span>
                      <span className={cn("font-medium", managedUnusedSeats > 0 ? "text-amber-600" : "text-slate-900")}>{managedUnusedSeats}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Billing</span>
                      <span className="font-medium text-slate-900 capitalize">{managedLicense.billing_cycle || 'Monthly'}</span>
                    </div>
                    {managedLicense.renewal_date && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Renewal</span>
                        <span className={cn("font-medium", managedDaysUntilRenewal !== null && managedDaysUntilRenewal <= 30 ? "text-amber-600" : "text-slate-900")}>
                          {format(parseISO(managedLicense.renewal_date), 'MMM d, yyyy')}
                        </span>
                      </div>
                    )}
                    {managedLicense.card_last_four && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Card</span>
                        <span className="font-medium text-slate-900">•••• {managedLicense.card_last_four}</span>
                      </div>
                    )}
                  </div>
                  {managedWastedCost > 0 && (
                    <p className="text-xs text-red-500">~${managedWastedCost.toFixed(0)}/mo unused</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Individual Licenses Card - Collapsible */}
          {individualLicense && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <button 
                onClick={() => setIndividualExpanded(!individualExpanded)}
                className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <User className="w-4 h-4 text-teal-600" />
                  <div className="text-left">
                    <p className="font-medium text-slate-900 text-sm">Individual Licenses</p>
                    <p className="text-xs text-slate-500">{individualAssignments.length} license{individualAssignments.length !== 1 ? 's' : ''} • ${individualTotalCost.toLocaleString()}/mo</p>
                  </div>
                </div>
                {individualExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </button>
              
              {individualExpanded && (
                <div className="px-4 pb-4 pt-2 border-t border-slate-100 space-y-3">
                  <div className="grid grid-cols-3 gap-3 text-xs">
                    <div className="bg-slate-50 rounded-lg p-2 text-center">
                      <p className="font-semibold text-slate-900">
                        ${individualAssignments.length > 0 
                          ? (individualTotalCost / individualAssignments.length).toFixed(0) 
                          : '0'}
                      </p>
                      <p className="text-slate-500">Avg Cost</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-2 text-center">
                      <p className="font-semibold text-slate-900">
                        {individualAssignments.filter(a => a.renewal_date).length}
                      </p>
                      <p className="text-slate-500">With Renewal</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-2 text-center">
                      <p className="font-semibold text-slate-900">
                        {individualAssignments.filter(a => a.card_last_four).length}
                      </p>
                      <p className="text-slate-500">With Payment</p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400">Each user has their own license with individual billing and renewal dates.</p>
                </div>
              )}
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

        {/* RIGHT COLUMN - Users/Assignments (Both Types) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Quick Add Buttons - Always visible at top */}
          {(!managedLicense || !individualLicense) && (
            <div className="flex gap-3">
              {!managedLicense && (
                <Button 
                  onClick={() => setShowAddManagedLicense(true)}
                  variant="outline"
                  className="flex-1 gap-2 border-blue-200 text-blue-700 hover:bg-blue-50 h-12"
                >
                  <Building2 className="w-4 h-4" />
                  Add Managed License
                </Button>
              )}
              {!individualLicense && (
                <Button 
                  onClick={() => setShowAddIndividualLicense(true)}
                  variant="outline"
                  className="flex-1 gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50 h-12"
                >
                  <User className="w-4 h-4" />
                  Add Individual License
                </Button>
              )}
            </div>
          )}

          {/* Managed Seats Section - Always show, Collapsible */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <button 
              onClick={() => setManagedSectionExpanded(!managedSectionExpanded)}
              className="w-full px-6 py-4 border-b border-slate-100 bg-blue-50 hover:bg-blue-100/50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Building2 className="w-5 h-5 text-blue-600" />
                  <div className="text-left">
                    <h2 className="font-semibold text-slate-900">Managed Seats</h2>
                    <p className="text-sm text-slate-500">
                      {managedAssignments.length} of {totalManagedSeats} seats assigned
                      {managedLicenses.length > 1 && <span className="ml-2 text-blue-600">• {managedLicenses.length} license types</span>}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-blue-700">${totalManagedCost.toLocaleString()}/mo</span>
                  {managedSectionExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                </div>
              </div>
            </button>
            
            {managedSectionExpanded && (
              <>
                {/* Action buttons */}
                <div className="px-6 py-3 bg-blue-50/50 border-b border-slate-100 flex items-center justify-between">
                  {managedLicenses.length > 0 && (
                    <div className="flex items-center gap-6 text-xs">
                      <span className={cn(managedUtilizationPercent >= 80 ? "text-emerald-600" : managedUtilizationPercent >= 50 ? "text-amber-600" : "text-red-600")}>
                        {managedUtilizationPercent.toFixed(0)}% utilized
                      </span>
                      {managedWastedCost > 0 && (
                        <span className="text-amber-600">${managedWastedCost.toFixed(0)} unused</span>
                      )}
                    </div>
                  )}
                  {managedLicenses.length === 0 && <div />}
                  <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                    <Button 
                      size="sm" 
                      variant="outline"
                      className="gap-2"
                      onClick={() => setShowAddManagedLicense(true)}
                    >
                      <Plus className="w-4 h-4" />
                      Add License
                    </Button>
                  </div>
                </div>
                
                {managedLicenses.length === 0 ? (
                  <div className="p-8 text-center">
                    <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500 mb-3">No managed license configured</p>
                    <Button 
                      size="sm"
                      onClick={() => setShowAddManagedLicense(true)} 
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Managed License
                    </Button>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-200">
                    {managedLicenses.map(ml => {
                      const mlAssignments = getAssignmentsForLicense(ml.id);
                      const mlUnusedSeats = (ml.quantity || 0) - mlAssignments.length;
                      const mlUtilization = ml.quantity > 0 ? (mlAssignments.length / ml.quantity) * 100 : 0;
                      
                      return (
                        <div key={ml.id} className="bg-white">
                          {/* License Type Header */}
                          <div className="px-6 py-3 bg-slate-50 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Badge className="bg-blue-100 text-blue-700">{ml.license_type || 'Standard'}</Badge>
                              <span className="text-xs text-slate-500">
                                {mlAssignments.length}/{ml.quantity || 0} seats • ${ml.cost_per_license || 0}/seat • ${(ml.total_cost || 0).toLocaleString()}/mo
                              </span>
                              <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                <div 
                                  className={cn(
                                    "h-full rounded-full",
                                    mlUtilization >= 90 ? "bg-emerald-500" :
                                    mlUtilization >= 50 ? "bg-amber-500" : "bg-red-500"
                                  )}
                                  style={{ width: `${Math.min(100, mlUtilization)}%` }}
                                />
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button 
                                size="sm" 
                                variant="outline"
                                className="h-7 text-xs"
                                onClick={() => { setSelectedManagedLicenseId(ml.id); setShowModifySeatsModal(true); }}
                              >
                                <Edit2 className="w-3 h-3 mr-1" />
                                Modify
                              </Button>
                              <Button 
                                size="sm" 
                                className="h-7 text-xs bg-blue-600 hover:bg-blue-700"
                                onClick={() => { setSelectedManagedLicenseId(ml.id); setShowAssignModal(true); }}
                                disabled={mlUnusedSeats <= 0}
                              >
                                <Plus className="w-3 h-3 mr-1" />
                                Assign
                              </Button>
                            </div>
                          </div>
                          
                          {/* Assignments for this license */}
                          {mlAssignments.length === 0 ? (
                            <div className="px-6 py-4 text-center text-sm text-slate-400">
                              No seats assigned to this license type
                            </div>
                          ) : (
                            <div className="divide-y divide-slate-100 max-h-[200px] overflow-y-auto">
                              {mlAssignments.map(assignment => {
                                const contact = contacts.find(c => c.id === assignment.contact_id);
                                return (
                                  <div key={assignment.id} className="px-6 py-2 hover:bg-slate-50 flex items-center justify-between">
                                    <div 
                                      className="flex items-center gap-3 cursor-pointer"
                                      onClick={() => setSelectedContact(contact)}
                                    >
                                      <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-medium text-xs">
                                        {contact?.full_name?.charAt(0) || '?'}
                                      </div>
                                      <div className="min-w-0">
                                        <p className="font-medium text-slate-900 text-sm hover:text-blue-600">{contact?.full_name || 'Unknown'}</p>
                                        <p className="text-xs text-slate-500">{contact?.email || 'No email'}</p>
                                      </div>
                                    </div>
                                    <Button 
                                      size="sm" 
                                      variant="ghost"
                                      className="text-red-600 hover:text-red-700 hover:bg-red-50 h-6 px-2 text-xs"
                                      onClick={() => handleRevoke(assignment.contact_id)}
                                    >
                                      Revoke
                                    </Button>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Individual Licenses Section - Always show, Collapsible */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <button 
              onClick={() => setIndividualSectionExpanded(!individualSectionExpanded)}
              className="w-full px-6 py-4 border-b border-slate-100 bg-emerald-50 hover:bg-emerald-100/50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <User className="w-5 h-5 text-emerald-600" />
                  <div className="text-left">
                    <h2 className="font-semibold text-slate-900">Individual Licenses</h2>
                    <p className="text-sm text-slate-500">
                      {individualAssignments.length} individual license{individualAssignments.length !== 1 ? 's' : ''}
                      {individualLicenses.length > 1 && <span className="ml-2 text-emerald-600">• {individualLicenses.length} types</span>}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-emerald-700">${individualTotalCost.toLocaleString()}/mo</span>
                  {individualSectionExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                </div>
              </div>
            </button>
            
            {individualSectionExpanded && (
              <>
                {/* Action button row */}
                <div className="px-6 py-3 bg-emerald-50/50 border-b border-slate-100 flex items-center justify-end" onClick={e => e.stopPropagation()}>
                  <Button 
                    size="sm" 
                    className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => setShowAddIndividualLicense(true)}
                  >
                    <Plus className="w-4 h-4" />
                    Add License
                  </Button>
                </div>
                
                {individualAssignments.length === 0 ? (
                  <div className="p-8 text-center">
                    <User className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500 mb-3">No individual licenses</p>
                    <Button 
                      size="sm"
                      onClick={() => setShowAddIndividualLicense(true)} 
                      className="bg-emerald-600 hover:bg-emerald-700"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add First License
                    </Button>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-200">
                    {/* Group by license type if multiple */}
                    {individualLicenses.length > 1 ? (
                      individualLicenses.map(il => {
                        const ilAssignments = getAssignmentsForLicense(il.id);
                        if (ilAssignments.length === 0) return null;
                        
                        return (
                          <div key={il.id}>
                            <div className="px-6 py-2 bg-slate-50 flex items-center gap-2">
                              <Badge className="bg-emerald-100 text-emerald-700">{il.license_type || 'Standard'}</Badge>
                              <span className="text-xs text-slate-500">{ilAssignments.length} license{ilAssignments.length !== 1 ? 's' : ''}</span>
                            </div>
                            <div className="divide-y divide-slate-100">
                              {ilAssignments.map(assignment => {
                                const contact = contacts.find(c => c.id === assignment.contact_id);
                                return (
                                  <div key={assignment.id} className="px-6 py-2 hover:bg-slate-50">
                                    <div className="flex items-center justify-between gap-4">
                                      <div 
                                        className="flex items-center gap-3 cursor-pointer flex-1"
                                        onClick={() => setSelectedContact(contact)}
                                      >
                                        <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-medium flex-shrink-0 text-xs">
                                          {contact?.full_name?.charAt(0) || '?'}
                                        </div>
                                        <div className="min-w-0">
                                          <p className="font-medium text-slate-900 text-sm hover:text-emerald-600">{contact?.full_name || 'Unknown User'}</p>
                                          <p className="text-xs text-slate-500">{contact?.email || 'No email'}</p>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-4 text-xs text-slate-500">
                                        <span>${assignment.cost_per_license || il.cost_per_license || 0}/mo</span>
                                        <span>{assignment.renewal_date ? format(parseISO(assignment.renewal_date), 'MMM d') : '—'}</span>
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => setEditingAssignment(assignment)}>Edit</Button>
                                        <Button size="sm" variant="ghost" className="text-red-600 h-6 px-2 text-xs" onClick={() => handleRevoke(assignment.contact_id)}>Remove</Button>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto">
                        {individualAssignments.map(assignment => {
                          const contact = contacts.find(c => c.id === assignment.contact_id);
                          return (
                            <div key={assignment.id} className="px-6 py-3 hover:bg-slate-50">
                              <div className="flex items-center justify-between gap-4">
                                <div 
                                  className="flex items-center gap-3 cursor-pointer flex-1"
                                  onClick={() => setSelectedContact(contact)}
                                >
                                  <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-medium flex-shrink-0 text-sm">
                                    {contact?.full_name?.charAt(0) || '?'}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="font-medium text-slate-900 text-sm hover:text-emerald-600">{contact?.full_name || 'Unknown User'}</p>
                                    <p className="text-xs text-slate-500">{contact?.email || 'No email'}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-4 text-xs text-slate-500">
                                  {assignment.license_type && <span className="text-emerald-600 font-medium">{assignment.license_type}</span>}
                                  <span>${assignment.cost_per_license || individualLicense?.cost_per_license || 0}/mo</span>
                                  <span>{assignment.renewal_date ? format(parseISO(assignment.renewal_date), 'MMM d, yyyy') : '—'}</span>
                                  {assignment.card_last_four && <span>•••• {assignment.card_last_four}</span>}
                                </div>
                                <div className="flex items-center gap-1">
                                  <Button size="sm" variant="ghost" className="text-slate-600 hover:text-slate-700 hover:bg-slate-100" onClick={() => setEditingAssignment(assignment)}>Edit</Button>
                                  <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleRevoke(assignment.contact_id)}>Remove</Button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Edit Individual License Modal */}
                          <EditIndividualLicenseModal
                            open={!!editingAssignment}
                            onClose={() => setEditingAssignment(null)}
                            assignment={editingAssignment}
                            contact={contacts.find(c => c.id === editingAssignment?.contact_id)}
                            onSave={handleUpdateAssignment}
                          />

                          {/* User Detail Modal */}
                          <UserDetailModal
            contact={selectedContact}
            open={!!selectedContact}
            onClose={() => setSelectedContact(null)}
            customerId={license?.customer_id}
          />

          {/* If only one type exists, show the original single view */}
          {!hasBothTypes && !managedLicense && !individualLicense && (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-slate-900">
                    {isPerUser ? 'License Holders' : 'Seat Assignments'}
                  </h2>
                  <p className="text-sm text-slate-500">
                    {isPerUser 
                      ? `${activeAssignments.filter(a => a.license_id === license.id).length} individual license${activeAssignments.filter(a => a.license_id === license.id).length !== 1 ? 's' : ''}`
                      : `${activeAssignments.filter(a => a.license_id === license.id).length} of ${license.quantity || 0} seats assigned`
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
            </div>
          )}
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

      {/* Add Managed License Modal */}
      <AddManagedLicenseModal
        open={showAddManagedLicense}
        onClose={() => setShowAddManagedLicense(false)}
        onSave={handleAddManagedLicense}
        softwareName={license?.application_name}
      />

      {/* Add Individual License Modal */}
      <AddIndividualLicenseModal
        open={showAddIndividualLicense}
        onClose={() => setShowAddIndividualLicense(false)}
        onSave={handleAddIndividualLicense}
        softwareName={license?.application_name}
        contacts={contacts}
      />

      {/* Modify Seats Modal */}
      <Dialog open={showModifySeatsModal} onOpenChange={setShowModifySeatsModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Modify Managed License Seats</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Current Seats</span>
              <span className="font-medium">{managedLicense?.quantity || 0}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Assigned</span>
              <span className="font-medium text-blue-600">{managedAssignments.length}</span>
            </div>
            <div>
              <label className="text-sm text-slate-500 block mb-2">Adjust Seats</label>
              <div className="flex items-center gap-3">
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => setSeatChange(prev => prev - 1)}
                  disabled={(managedLicense?.quantity || 0) + seatChange <= managedAssignments.length}
                >
                  -
                </Button>
                <Input
                  type="number"
                  value={seatChange}
                  onChange={(e) => setSeatChange(parseInt(e.target.value) || 0)}
                  className="text-center w-20"
                />
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => setSeatChange(prev => prev + 1)}
                >
                  +
                </Button>
              </div>
              {seatChange < 0 && (managedLicense?.quantity || 0) + seatChange < managedAssignments.length && (
                <p className="text-xs text-red-500 mt-2">Cannot reduce below assigned seats ({managedAssignments.length})</p>
              )}
            </div>
            <div className="flex items-center justify-between text-sm pt-2 border-t">
              <span className="text-slate-500">New Total</span>
              <span className="font-bold text-lg">{Math.max(managedAssignments.length, (managedLicense?.quantity || 0) + seatChange)}</span>
            </div>
            {managedLicense?.cost_per_license > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">New Monthly Cost</span>
                <span className={cn("font-medium", seatChange < 0 ? "text-green-600" : "text-blue-600")}>
                  ${(Math.max(managedAssignments.length, (managedLicense?.quantity || 0) + seatChange) * managedLicense.cost_per_license).toLocaleString()}/mo
                </span>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setShowModifySeatsModal(false); setSeatChange(0); }}>Cancel</Button>
            <Button 
              onClick={handleModifySeats} 
              disabled={seatChange === 0}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {seatChange > 0 ? `Add ${seatChange} Seat${seatChange > 1 ? 's' : ''}` : seatChange < 0 ? `Remove ${Math.abs(seatChange)} Seat${Math.abs(seatChange) > 1 ? 's' : ''}` : 'Update'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}