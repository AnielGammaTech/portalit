import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { client } from '@/api/client';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import Breadcrumbs from '../components/ui/breadcrumbs';
import { 
  ArrowLeft, Cloud, Calendar, Edit2, Trash2, Plus,
  Globe, Building2, RefreshCw, CreditCard, User,
  ChevronDown, ChevronUp, MoreVertical
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import AddManagedLicenseModal from '../components/saas/AddManagedLicenseModal';
import AddIndividualLicenseModal from '../components/saas/AddIndividualLicenseModal';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, safeFormatDate, safeDifferenceInDays } from "@/lib/utils";
// date-fns calls replaced by safe wrappers from @/lib/utils
import LicenseAssignmentModal from '../components/saas/LicenseAssignmentModal';
import EditLicenseModal from '../components/saas/EditLicenseModal';
import EditIndividualLicenseModal from '../components/saas/EditIndividualLicenseModal';
import UserDetailModal from '../components/customer/UserDetailModal';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DollarSign, BarChart3 } from 'lucide-react';

// Spend Analysis Card Component
function SpendAnalysisCard({
  managedAssignments,
  individualAssignments,
  managedLicenses,
  individualLicenses,
  managedUtilizationPercent
}) {
  const [showYearly, setShowYearly] = useState(false);
  
  // Calculate costs properly based on billing cycle
  // For annual licenses, divide by 12 to get monthly; for monthly, use as-is
  const managedMonthlyCost = managedLicenses.reduce((sum, l) => {
    const cost = l.total_cost || 0;
    return sum + (l.billing_cycle === 'annually' ? cost / 12 : cost);
  }, 0);
  const managedYearlyCost = managedLicenses.reduce((sum, l) => {
    const cost = l.total_cost || 0;
    return sum + (l.billing_cycle === 'annually' ? cost : cost * 12);
  }, 0);
  
  // Individual licenses - assume monthly unless specified
  const individualMonthlyCost = individualAssignments.reduce((sum, a) => {
    const parentLicense = individualLicenses.find(l => l.id === a.license_id);
    return sum + (a.cost_per_license || parentLicense?.cost_per_license || 0);
  }, 0);
  const individualYearlyCost = individualMonthlyCost * 12;
  
  const monthlyTotal = managedMonthlyCost + individualMonthlyCost;
  const yearlyTotal = managedYearlyCost + individualYearlyCost;
  
  // Calculate wasted cost based on unused seats
  const totalManagedSeats = managedLicenses.reduce((sum, l) => sum + (l.quantity || 0), 0);
  const unusedSeats = totalManagedSeats - managedAssignments.length;
  const monthlyWasted = totalManagedSeats > 0 ? (unusedSeats / totalManagedSeats) * managedMonthlyCost : 0;
  const yearlyWasted = totalManagedSeats > 0 ? (unusedSeats / totalManagedSeats) * managedYearlyCost : 0;
  
  return (
    <div 
      className="bg-gradient-to-br from-slate-700 to-slate-800 rounded-xl p-4 text-white cursor-pointer hover:from-slate-600 hover:to-slate-700 transition-all"
      onClick={() => setShowYearly(!showYearly)}
    >
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-slate-300" />
            <p className="text-xs text-slate-300 font-medium uppercase tracking-wide">Spend Analysis</p>
          </div>
          <p className="text-2xl font-bold mt-1">
            ${showYearly ? yearlyTotal.toLocaleString() : monthlyTotal.toLocaleString()}
            <span className="text-sm font-normal text-slate-400 ml-1">{showYearly ? '/year' : '/mo'}</span>
          </p>
        </div>
        <div className="text-right text-xs text-slate-300">
          <p className="font-medium text-white">{managedAssignments.length + individualAssignments.length} users</p>
          <Badge 
            className={cn(
              "text-[10px] mt-1 cursor-pointer",
              showYearly ? "bg-purple-600 text-white" : "bg-slate-600 text-slate-200"
            )}
          >
            {showYearly ? 'Yearly View' : 'Monthly View'}
          </Badge>
        </div>
      </div>

      {/* Cost breakdown */}
      <div className="pt-3 border-t border-slate-600 space-y-2">
        {managedLicenses.length > 0 && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Managed Licenses</span>
            <span className="font-medium">${showYearly ? managedYearlyCost.toLocaleString() : managedMonthlyCost.toLocaleString()}</span>
          </div>
        )}
        {individualLicenses.length > 0 && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Individual Licenses</span>
            <span className="font-medium">${showYearly ? individualYearlyCost.toLocaleString() : individualMonthlyCost.toLocaleString()}</span>
          </div>
        )}
      </div>

      {/* Stats row */}
      <div className="pt-3 mt-3 border-t border-slate-600 grid grid-cols-3 gap-3 text-center">
        <div>
          <p className="text-lg font-semibold">
            ${(managedAssignments.length + individualAssignments.length) > 0 
              ? ((showYearly ? yearlyTotal : monthlyTotal) / (managedAssignments.length + individualAssignments.length)).toFixed(0) 
              : '0'}
          </p>
          <p className="text-xs text-slate-400">Avg/User</p>
        </div>
        <div>
          <p className="text-lg font-semibold">
            {managedLicenses.length > 0 ? `${managedUtilizationPercent.toFixed(0)}%` : '—'}
          </p>
          <p className="text-xs text-slate-400">Utilization</p>
        </div>
        <div>
          <p className="text-lg font-semibold text-amber-400">
            {(showYearly ? yearlyWasted : monthlyWasted) > 0 ? `$${(showYearly ? yearlyWasted : monthlyWasted).toFixed(0)}` : '$0'}
          </p>
          <p className="text-xs text-slate-400">Unused</p>
        </div>
      </div>
      
      <p className="text-[10px] text-slate-500 text-center mt-3">Click to toggle monthly/yearly</p>
    </div>
  );
}

export default function LicenseDetail() {
  const params = new URLSearchParams(window.location.search);
  const licenseId = params.get('id');
  const appId = params.get('appId'); // For catalog-only entries
  const queryClient = useQueryClient();
  // UI State
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showModifySeatsModal, setShowModifySeatsModal] = useState(false);
  const [showAddManagedLicense, setShowAddManagedLicense] = useState(false);
  const [showAddIndividualLicense, setShowAddIndividualLicense] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showRenewalModal, setShowRenewalModal] = useState(false);
  
  // Section expansion
  const [managedSectionExpanded, setManagedSectionExpanded] = useState(true);
  const [individualSectionExpanded, setIndividualSectionExpanded] = useState(true);
  
  // Selected items for modals
  const [selectedManagedLicenseId, setSelectedManagedLicenseId] = useState(null);
  const [selectedContact, setSelectedContact] = useState(null);
  const [editingAssignment, setEditingAssignment] = useState(null);
  const [renewalLicense, setRenewalLicense] = useState(null);
  const [renewalAssignment, setRenewalAssignment] = useState(null);
  
  // Form state
  const [seatChange, setSeatChange] = useState(0);
  const [renewalBillingCycle, setRenewalBillingCycle] = useState('annually');
  const [renewalDate, setRenewalDate] = useState('');
  
  // Modify license form state
  const [modifyFormData, setModifyFormData] = useState({
    quantity: 0,
    total_cost: 0,
    card_last_four: '',
    renewal_date: '',
    notes: ''
  });
  
  // Loading state
  const [syncingUsers, setSyncingUsers] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch Application catalog entry (for catalog-only software)
  const { data: application, isLoading: loadingApplication } = useQuery({
    queryKey: ['application', appId],
    queryFn: async () => {
      // Fetch all applications and find by ID since filter by id may not work
      const allApps = await client.entities.Application.list();
      const foundApp = allApps.find(a => a.id === appId);
      return foundApp;
    },
    enabled: !!appId && !licenseId,
    staleTime: 1000 * 60
  });

  const { data: license, isLoading: loadingLicense } = useQuery({
    queryKey: ['license', licenseId],
    queryFn: async () => {
      const licenses = await client.entities.SaaSLicense.filter({ id: licenseId });
      return licenses[0];
    },
    enabled: !!licenseId,
    staleTime: 1000 * 60 // Cache for 1 minute
  });

  // Create a unified "software" object from either license or application
  // Important: Don't wait for `license` to exist - we need customer_id and app name to fetch all related
  const software = license || (application ? {
    id: application.id,
    application_name: application.name,
    vendor: application.vendor,
    logo_url: application.logo_url,
    website_url: application.website_url,
    category: application.category,
    notes: application.notes,
    customer_id: application.customer_id,
    status: application.status || 'active',
    _isApplication: true // Flag to identify this is a catalog entry
  } : null);
  
  const { data: customer } = useQuery({
    queryKey: ['customer', software?.customer_id],
    queryFn: async () => {
      const customers = await client.entities.Customer.filter({ id: software.customer_id });
      return customers[0];
    },
    enabled: !!software?.customer_id,
    staleTime: 1000 * 60 * 5 // Cache customer for 5 minutes
  });

  // Fetch ALL licenses for same application (both managed and individual)
  // CRITICAL: This is the source of truth for all license data on this page
  const { data: relatedLicenses = [], isLoading: loadingRelated, refetch: refetchLicenses } = useQuery({
    queryKey: ['related_licenses', software?.application_name, software?.customer_id],
    queryFn: async () => {
      // Fetch ALL licenses for this customer first, then filter by app name
      // This avoids any potential issues with the filter query
      const allCustomerLicenses = await client.entities.SaaSLicense.filter({ 
        customer_id: software.customer_id
      });
      
      // Filter by exact application name match
      const appLicenses = allCustomerLicenses.filter(l => 
        l.application_name === software.application_name
      );
      
      return appLicenses;
    },
    enabled: !!software?.customer_id && !!software?.application_name,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true
  });

  // Separate managed and individual licenses - MUST be consistent
  const managedLicenses = React.useMemo(() => 
    relatedLicenses.filter(l => l.management_type === 'managed'),
    [relatedLicenses]
  );
  
  const individualLicenses = React.useMemo(() => 
    relatedLicenses.filter(l => l.management_type === 'per_user'),
    [relatedLicenses]
  );
  
  const { data: contacts = [] } = useQuery({
    queryKey: ['contacts', software?.customer_id],
    queryFn: () => client.entities.Contact.filter({ customer_id: software.customer_id }),
    enabled: !!software?.customer_id,
    staleTime: 1000 * 60 * 5 // Cache contacts for 5 minutes
  });

  // Fetch assignments for ALL related licenses (both managed and individual)
  // CRITICAL: Must update when licenses change
  const relatedLicenseIds = React.useMemo(() => 
    relatedLicenses.map(l => l.id).sort().join(','),
    [relatedLicenses]
  );
  
  const { data: allAssignments = [], refetch: refetchAssignments } = useQuery({
    queryKey: ['all_license_assignments', software?.application_name, software?.customer_id, relatedLicenseIds],
    queryFn: async () => {
      const licenseIds = relatedLicenses.map(l => l.id);
      if (licenseIds.length === 0) return [];
      
      const assignmentPromises = licenseIds.map(id => 
        client.entities.LicenseAssignment.filter({ license_id: id })
      );
      const results = await Promise.all(assignmentPromises);
      const allResults = results.flat();
      return allResults;
    },
    enabled: relatedLicenses.length > 0,
    staleTime: 0,
    gcTime: 0
  });

  // Real-time subscription for license assignments AND licenses
  useEffect(() => {
    if (!software?.customer_id) return;

    const unsubAssignments = client.entities.LicenseAssignment.subscribe((event) => {
      if (event.data?.customer_id === software.customer_id) {
        queryClient.invalidateQueries({ queryKey: ['all_license_assignments'] });
      }
    });
    
    const unsubLicenses = client.entities.SaaSLicense.subscribe((event) => {
      if (event.data?.customer_id === software.customer_id && 
          event.data?.application_name === software.application_name) {
        queryClient.invalidateQueries({ queryKey: ['related_licenses'] });
      }
    });

    return () => {
      unsubAssignments();
      unsubLicenses();
    };
  }, [software?.customer_id, software?.application_name, queryClient]);

  // Separate assignments by license type - support multiple licenses
  const managedAssignments = allAssignments.filter(a => 
    managedLicenses.some(l => l.id === a.license_id) && a.status === 'active'
  );
  const individualAssignments = allAssignments.filter(a => 
    individualLicenses.some(l => l.id === a.license_id) && a.status === 'active'
  );
  
  // Get assignments for a specific license
  const getAssignmentsForLicense = (licenseId) => 
    allAssignments.filter(a => a.license_id === licenseId && a.status === 'active');

  // Redirect to Customer detail if no license/app id or not found
  useEffect(() => {
    if (!licenseId && !appId) {
      window.location.href = createPageUrl('CustomerDetail');
      return;
    }
    const isLoading = licenseId ? loadingLicense : loadingApplication;
    if (!isLoading && !software) {
      window.location.href = createPageUrl('CustomerDetail');
    }
  }, [licenseId, appId, loadingLicense, loadingApplication, software]);

  const isCatalogOnly = software?._isApplication && relatedLicenses.length === 0;
  
  // Managed license stats - aggregate across all managed licenses
  const totalManagedSeats = managedLicenses.reduce((sum, l) => sum + (l.quantity || 0), 0);
  const totalManagedCost = managedLicenses.reduce((sum, l) => sum + (l.total_cost || 0), 0);
  const managedUtilizationPercent = totalManagedSeats > 0 
    ? (managedAssignments.length / totalManagedSeats) * 100 : 0;
  const managedUnusedSeats = totalManagedSeats - managedAssignments.length;
  const managedWastedCost = totalManagedSeats > 0 
    ? (managedUnusedSeats / totalManagedSeats) * totalManagedCost : 0;
  
  // Individual license stats - sum costs from each assignment
  const individualTotalCost = individualAssignments.reduce((sum, a) => {
    const parentLicense = individualLicenses.find(l => l.id === a.license_id);
    return sum + (a.cost_per_license || parentLicense?.cost_per_license || 0);
  }, 0);
  
  // Combined total cost
  const combinedTotalCost = totalManagedCost + individualTotalCost;
  
  // Get selected license for modals
  const getSelectedManagedLicense = () => 
    selectedManagedLicenseId ? relatedLicenses.find(l => l.id === selectedManagedLicenseId) : null;

  const handleAssign = async (contactId, targetLicenseId = null) => {
    const licenseToAssign = targetLicenseId || selectedManagedLicenseId;
    if (!licenseToAssign) {
      toast.error('No license selected');
      return;
    }

    // Get current assignments from cache to check for duplicates (handles optimistic updates)
    const currentAssignments = queryClient.getQueryData(['all_license_assignments', software?.application_name, software?.customer_id]) || allAssignments;

    // Check if user is already assigned to this license
    const existingAssignment = currentAssignments.find(a =>
      a.license_id === licenseToAssign &&
      a.contact_id === contactId &&
      a.status === 'active'
    );
    if (existingAssignment) {
      toast.error('This user is already assigned to this license');
      return;
    }

    // Check if seats are available (for managed licenses)
    const targetLicense = relatedLicenses.find(l => l.id === licenseToAssign);
    if (targetLicense?.management_type === 'managed') {
      const assignedCount = currentAssignments.filter(a => a.license_id === licenseToAssign && a.status === 'active').length;
      if (assignedCount >= (targetLicense.quantity || 0)) {
        toast.error('No seats available. Please add more seats or revoke an existing assignment.');
        return;
      }
    }

    try {
      // Optimistic update - add to cache immediately
      const newAssignment = {
        id: `temp-${Date.now()}-${contactId}`,
        license_id: licenseToAssign,
        contact_id: contactId,
        customer_id: software.customer_id,
        assigned_date: new Date().toISOString().split('T')[0],
        status: 'active'
      };

      queryClient.setQueryData(['all_license_assignments', software?.application_name, software?.customer_id], (old) =>
        old ? [...old, newAssignment] : [newAssignment]
      );

      toast.success('License assigned!');

      // Then persist to database
      await client.entities.LicenseAssignment.create({
        license_id: licenseToAssign,
        contact_id: contactId,
        customer_id: software.customer_id,
        assigned_date: new Date().toISOString().split('T')[0],
        status: 'active'
      });

      // Refresh to get real IDs
      queryClient.invalidateQueries({ queryKey: ['all_license_assignments'] });
    } catch (err) {
      toast.error(err.message || 'Operation failed');
    }
  };

  const handleAddIndividualLicense = async (data) => {
    try {
      const contact = contacts.find(c => c.id === data.contact_id);

      // Find existing per_user license or create one
      let perUserLicense = individualLicenses[0];

      if (!perUserLicense) {
        perUserLicense = await client.entities.SaaSLicense.create({
          customer_id: software.customer_id,
          application_name: software.application_name,
          vendor: software.vendor,
          logo_url: software.logo_url,
          website_url: software.website_url,
          category: software.category,
          management_type: 'per_user',
          status: 'active',
          source: 'manual'
        });
        queryClient.invalidateQueries({ queryKey: ['related_licenses'] });
      }

      await client.entities.LicenseAssignment.create({
        license_id: perUserLicense.id,
        contact_id: data.contact_id,
        customer_id: software.customer_id,
        assigned_date: new Date().toISOString().split('T')[0],
        status: 'active',
        renewal_date: data.renewal_date,
        card_last_four: data.card_last_four,
        cost_per_license: data.cost_per_license,
        license_type: data.license_type
      });

      queryClient.invalidateQueries({ queryKey: ['all_license_assignments'] });

      // Close modal and show success AFTER save completes
      setShowAddIndividualLicense(false);
      toast.success(`License added for ${contact?.full_name || 'user'}!`);
    } catch (err) {
      toast.error(err.message || 'Operation failed');
    }
  };

  const handleAddManagedLicense = async (data) => {
    try {
      // Always create a NEW managed license record (supports multiple license types per software)
      await client.entities.SaaSLicense.create({
        customer_id: software.customer_id,
        application_name: software.application_name,
        vendor: software.vendor,
        logo_url: software.logo_url,
        website_url: software.website_url,
        category: software.category,
        management_type: 'managed',
        license_type: data.license_type || null, // Don't default to anything
        quantity: data.quantity,
        cost_per_license: data.cost_per_license,
        total_cost: data.total_cost,
        billing_cycle: data.billing_cycle,
        renewal_date: data.renewal_date || null,
        card_last_four: data.card_last_four || null,
        status: 'active',
        source: 'manual'
      });

      queryClient.invalidateQueries({ queryKey: ['related_licenses'] });
      queryClient.invalidateQueries({ queryKey: ['license', licenseId] });
      setShowAddManagedLicense(false);
      toast.success('Managed license added!');
    } catch (err) {
      toast.error(err.message || 'Operation failed');
    }
  };

  const handleRevoke = async (contactId) => {
    try {
      const assignment = allAssignments.find(a => a.contact_id === contactId && a.status === 'active');
      if (assignment) {
        // Optimistic update - remove from cache immediately
        queryClient.setQueryData(['all_license_assignments', software?.application_name, software?.customer_id], (old) =>
          old ? old.filter(a => a.id !== assignment.id) : []
        );

        toast.success('License revoked!');

        // Then persist to database
        await client.entities.LicenseAssignment.update(assignment.id, { status: 'revoked' });
        queryClient.invalidateQueries({ queryKey: ['all_license_assignments'] });
      }
    } catch (err) {
      toast.error(err.message || 'Operation failed');
    }
  };

  const handleEditSave = async (updatedData) => {
    try {
      await client.entities.SaaSLicense.update(licenseId, updatedData);
      queryClient.invalidateQueries({ queryKey: ['license', licenseId] });
      setShowEditModal(false);
      toast.success('License updated!');
    } catch (err) {
      toast.error(err.message || 'Operation failed');
    }
  };

  const handleDeleteApp = async () => {
    setIsDeleting(true);
    try {
      // Delete ALL related licenses and their assignments for this software
      const allLicenseIds = relatedLicenses.map(l => l.id);
      
      // Fetch ALL assignments (including revoked/inactive) for all related licenses
      for (const licId of allLicenseIds) {
        const allLicenseAssignments = await client.entities.LicenseAssignment.filter({ license_id: licId });
        for (const assignment of allLicenseAssignments) {
          await client.entities.LicenseAssignment.delete(assignment.id);
        }
      }
      
      // Delete all related licenses (managed and individual)
      for (const licId of allLicenseIds) {
        await client.entities.SaaSLicense.delete(licId);
      }
      
      // Also delete any Application catalog entry with the same name for this customer
      if (software?.application_name && software?.customer_id) {
        const appRecords = await client.entities.Application.filter({ 
          name: software.application_name, 
          customer_id: software.customer_id 
        });
        for (const app of appRecords) {
          await client.entities.Application.delete(app.id);
        }
      }
      
      // If this is a catalog-only entry accessed via appId, delete that too
      if (appId) {
        try {
          await client.entities.Application.delete(appId);
        } catch (e) {
          // Already deleted above, ignore
        }
      }
      
      toast.success('Application and all licenses deleted!');
                  window.location.href = createPageUrl(`CustomerDetail?id=${software.customer_id}&tab=services`);
    } catch (error) {
      toast.error('Failed to delete application');
      setIsDeleting(false);
    }
  };

      const handleUpdateAssignment = async (assignmentId, data) => {
        try {
          await client.entities.LicenseAssignment.update(assignmentId, data);
          queryClient.invalidateQueries({ queryKey: ['all_license_assignments'] });
          toast.success('License updated!');
        } catch (error) {
          toast.error('Failed to update license assignment');
        }
      };

  const handleModifySeats = async () => {
    const targetLicense = getSelectedManagedLicense();
    if (!targetLicense || seatChange === 0) return;

    try {
      const currentAssignments = getAssignmentsForLicense(targetLicense.id);
      const newQuantity = Math.max(currentAssignments.length, (targetLicense.quantity || 0) + seatChange);
      const newTotalCost = newQuantity * (targetLicense.cost_per_license || 0);

      await client.entities.SaaSLicense.update(targetLicense.id, {
        quantity: newQuantity,
        total_cost: newTotalCost
      });

      queryClient.invalidateQueries({ queryKey: ['related_licenses'] });
      setShowModifySeatsModal(false);
      setSelectedManagedLicenseId(null);
      setSeatChange(0);
      toast.success(`Seats updated to ${newQuantity}!`);
    } catch (error) {
      toast.error('Failed to modify seats');
    }
  };

  // Check if any license is from JumpCloud or Spanning for sync options
  const isJumpCloudLicense = relatedLicenses.some(l => l.source === 'jumpcloud') || 
    software?.vendor?.toLowerCase() === 'jumpcloud';
  const isSpanningLicense = relatedLicenses.some(l => l.source === 'spanning') || 
    software?.vendor?.toLowerCase()?.includes('spanning');

  const syncJumpCloudUsers = async () => {
    setSyncingUsers(true);
    try {
      const response = await client.functions.invoke('syncJumpCloudLicenses', { 
        action: 'sync_users', 
        customer_id: software.customer_id 
      });
      if (response.success) {
        toast.success(`Synced ${response.totalJumpCloudUsers} users: ${response.created} new, ${response.matched} matched!`);
        queryClient.invalidateQueries({ queryKey: ['contacts', software.customer_id] });
      } else {
        toast.error(response.error || 'User sync failed');
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
          const response = await client.functions.invoke('syncSpanningBackup', { 
            action: 'sync_users', 
            customer_id: software.customer_id 
          });
          if (response.success) {
            toast.success(`Synced ${response.totalSpanningUsers} users: ${response.updated} updated, ${response.matched} matched!`);
            queryClient.invalidateQueries({ queryKey: ['contacts', software.customer_id] });
          } else {
            toast.error(response.error || 'User sync failed');
          }
        } catch (error) {
          toast.error(error.message);
        } finally {
          setSyncingUsers(false);
        }
      };

  // Show loading while initial data loads
  const isInitialLoading = (licenseId && loadingLicense) || (appId && loadingApplication);
  
  if (isInitialLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    );
  }

  if (!software) {
    return (
      <div className="text-center py-12">
        <Cloud className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-slate-900 mb-2">Software Not Found</h2>
        <Link to={createPageUrl('Dashboard')}>
          <Button><ArrowLeft className="w-4 h-4 mr-2" />Back</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <Breadcrumbs items={[
        { label: 'Customers', href: createPageUrl('Customers') },
        { label: customer?.name || 'Customer', href: createPageUrl(`CustomerDetail?id=${software.customer_id}`) },
        { label: 'SaaS', href: createPageUrl(`CustomerDetail?id=${software.customer_id}&tab=services`) },
        { label: software.application_name }
      ]} />

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT COLUMN - App Info & License Summary */}
        <div className="lg:col-span-1 space-y-6">
          {/* App Header Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                {software.logo_url ? (
                  <img src={software.logo_url} alt={software.application_name} className="w-10 h-10 object-contain" />
                ) : (
                  <Cloud className="w-6 h-6 text-purple-600" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <h1 className="text-lg font-bold text-slate-900 truncate">{software.application_name}</h1>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="h-7 w-7 -mt-1"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setShowEditModal(true)}>
                        <Edit2 className="w-4 h-4 mr-2" />
                        Edit Details
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        onClick={() => setShowDeleteConfirm(true)}
                        className="text-red-600 focus:text-red-600"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete Application
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  <Badge className={cn(
                    "capitalize text-xs",
                    software.status === 'active' && "bg-emerald-100 text-emerald-700",
                    software.status === 'suspended' && "bg-amber-100 text-amber-700",
                    software.status === 'cancelled' && "bg-red-100 text-red-700",
                    software.status === 'inactive' && "bg-slate-100 text-slate-700"
                  )}>
                    {software.status}
                  </Badge>
                  {isCatalogOnly && (
                    <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">Catalog Only</Badge>
                  )}
                  {software.category && (
                    <Badge variant="outline" className="capitalize text-xs">{software.category}</Badge>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              {software.vendor && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 text-xs">Vendor</span>
                  <span className="font-medium text-slate-900 text-xs">{software.vendor}</span>
                </div>
              )}
              {software.website_url && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 text-xs">Website</span>
                  <a href={software.website_url.startsWith('http') ? software.website_url : `https://${software.website_url}`} 
                     target="_blank" rel="noopener noreferrer"
                     className="flex items-center gap-1 text-purple-600 hover:underline font-medium text-xs">
                    <Globe className="w-3 h-3" />
                    Visit
                  </a>
                </div>
              )}
            </div>

            {software.notes && (
              <div className="mt-3 pt-3 border-t border-slate-100">
                <p className="text-xs text-slate-600 line-clamp-2">{software.notes}</p>
              </div>
            )}
          </div>

          {/* Combined Cost Summary - Spend Analysis */}
          <SpendAnalysisCard
            managedAssignments={managedAssignments}
            individualAssignments={individualAssignments}
            managedLicenses={managedLicenses}
            individualLicenses={individualLicenses}
            managedUtilizationPercent={managedUtilizationPercent}
          />

          {/* License Summary Cards */}
          {managedLicenses.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center gap-3 mb-3">
                <Building2 className="w-4 h-4 text-blue-600" />
                <div>
                  <p className="font-medium text-slate-900 text-sm">Managed Licenses</p>
                  <p className="text-xs text-slate-500">{managedLicenses.length} type{managedLicenses.length !== 1 ? 's' : ''} • {managedAssignments.length}/{totalManagedSeats} seats</p>
                </div>
              </div>
              {/* Show each license type with details */}
              <div className="space-y-2 mb-3">
                {managedLicenses.map(ml => {
                  const mlAssignments = allAssignments.filter(a => a.license_id === ml.id && a.status === 'active');
                  const mlUtilization = ml.quantity > 0 ? (mlAssignments.length / ml.quantity) * 100 : 0;
                  const isAnnual = ml.billing_cycle === 'annually';
                  const displayCostVal = ml.total_cost || 0;
                  return (
                    <div key={ml.id} className="flex items-center justify-between text-xs py-1 border-b border-slate-50 last:border-0">
                      <div className="flex flex-col">
                        <span className="text-slate-700 font-medium">{ml.license_type || 'Standard'}</span>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                          <span>${displayCostVal.toLocaleString(undefined, {maximumFractionDigits: 0})}{isAnnual ? '/yr' : '/mo'}</span>
                          {ml.card_last_four && (
                            <span className="flex items-center gap-0.5">
                              <CreditCard className="w-2.5 h-2.5" />
                              {ml.card_last_four}
                            </span>
                          )}
                          {ml.renewal_date && (
                            <span className="flex items-center gap-0.5">
                              <Calendar className="w-2.5 h-2.5" />
                              {safeFormatDate(ml.renewal_date, 'MMM d')}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className={cn(
                        "font-medium",
                        mlUtilization >= 80 ? "text-emerald-600" : mlUtilization >= 50 ? "text-amber-600" : "text-red-600"
                      )}>
                        {mlAssignments.length}/{ml.quantity || 0}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div 
                  className={cn(
                    "h-full rounded-full",
                    managedUtilizationPercent >= 90 ? "bg-emerald-500" :
                    managedUtilizationPercent >= 50 ? "bg-amber-500" : "bg-red-500"
                  )}
                  style={{ width: `${Math.min(100, managedUtilizationPercent)}%` }}
                />
              </div>
            </div>
          )}

          {individualLicenses.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center gap-3 mb-3">
                <User className="w-4 h-4 text-emerald-600" />
                <div>
                  <p className="font-medium text-slate-900 text-sm">Individual Licenses</p>
                  <p className="text-xs text-slate-500">{individualAssignments.length} license{individualAssignments.length !== 1 ? 's' : ''} • ${individualTotalCost.toLocaleString()}/mo</p>
                </div>
              </div>
              {/* Show each individual assignment with details */}
              <div className="space-y-2">
                {individualAssignments.map(a => {
                  const contact = contacts.find(c => c.id === a.contact_id);
                  return (
                    <div key={a.id} className="flex items-center justify-between text-xs py-1 border-b border-slate-50 last:border-0">
                      <div className="flex flex-col">
                        <span className="text-slate-700 font-medium">{contact?.full_name || 'Unknown'}</span>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                          {a.license_type && <span>{a.license_type}</span>}
                          <span>${a.cost_per_license || 0}/mo</span>
                          {a.card_last_four && (
                            <span className="flex items-center gap-0.5">
                              <CreditCard className="w-2.5 h-2.5" />
                              {a.card_last_four}
                            </span>
                          )}
                          {a.renewal_date && (
                            <span className="flex items-center gap-0.5">
                              <Calendar className="w-2.5 h-2.5" />
                              {safeFormatDate(a.renewal_date, 'MMM d')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
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

        {/* RIGHT COLUMN - Users/Assignments (Both Types) */}
        <div className="lg:col-span-2 space-y-6">


          {/* Managed Seats Section - Always show, Collapsible */}
          {/* Debug info: {relatedLicenses.length} related, {managedLicenses.length} managed, {individualLicenses.length} individual */}
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
                <div className="flex items-center gap-3" onClick={e => e.stopPropagation()}>
                  <Button 
                    size="sm" 
                    variant="outline"
                    className="gap-1.5 h-7 text-xs"
                    onClick={(e) => { e.stopPropagation(); setShowAddManagedLicense(true); }}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add License
                  </Button>
                  {managedSectionExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                </div>
              </div>
            </button>
            
            {managedSectionExpanded && (
              <>
                {managedLicenses.length === 0 ? (
                  <div className="p-8 text-center">
                    <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500 mb-3">No managed licenses</p>
                    <Button 
                      size="sm"
                      onClick={() => setShowAddManagedLicense(true)} 
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add First License
                    </Button>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-200">
                    {/* Debug: Show count */}
                    {/* <div className="p-2 bg-yellow-100 text-xs">Debug: {managedLicenses.length} managed licenses found</div> */}
                    {managedLicenses.map(ml => {
                      const mlAssignments = getAssignmentsForLicense(ml.id);
                      const mlUnusedSeats = (ml.quantity || 0) - mlAssignments.length;
                      const mlUtilization = ml.quantity > 0 ? (mlAssignments.length / ml.quantity) * 100 : 0;
                      const mlDaysUntilRenewal = ml.renewal_date
                        ? safeDifferenceInDays(ml.renewal_date, new Date()) : null;
                      const renewalPassed = mlDaysUntilRenewal !== null && mlDaysUntilRenewal < 0;
                      
                      // Calculate cost display based on billing cycle
                      const isAnnual = ml.billing_cycle === 'annually';
                      const displayCost = ml.total_cost || 0;
                      const costPerSeat = ml.cost_per_license || 0;
                      const monthlyCost = isAnnual ? displayCost / 12 : displayCost;
                      
                      return (
                        <div key={ml.id} className="bg-white">
                          {/* Compact License Header */}
                          <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100">
                            {/* Single row: Name + Stats + Actions */}
                            <div className="flex items-center gap-3">
                              <span className="font-bold text-slate-900 text-base min-w-[80px]">{ml.license_type || 'Standard'}</span>

                              {/* Inline stats - simplified */}
                              <div className="flex items-center gap-3 text-xs text-slate-600 flex-1">
                                <span><span className="font-semibold text-slate-900">{mlAssignments.length}</span>/{ml.quantity || 0} seats</span>
                                <span><span className="font-semibold text-slate-900">${(ml.total_cost || 0).toLocaleString(undefined, {maximumFractionDigits: 0})}</span>{isAnnual ? '/yr' : '/mo'}</span>
                                {ml.renewal_date && (
                                  <div className={cn(
                                    "flex items-center gap-1",
                                    renewalPassed ? "text-red-600" :
                                    mlDaysUntilRenewal !== null && mlDaysUntilRenewal <= 30 ? "text-amber-600" : "text-slate-400"
                                  )}>
                                    <Calendar className="w-3 h-3" />
                                    <span>{safeFormatDate(ml.renewal_date, 'MMM d')}</span>
                                  </div>
                                )}
                                {ml.card_last_four && (
                                  <div className="flex items-center gap-1 text-slate-400">
                                    <CreditCard className="w-3 h-3" />
                                    <span>{ml.card_last_four}</span>
                                  </div>
                                )}
                              </div>
                              
                              {/* Progress bar mini */}
                              <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                <div 
                                  className={cn(
                                    "h-full rounded-full",
                                    mlUtilization >= 80 ? "bg-emerald-500" : mlUtilization >= 50 ? "bg-amber-500" : "bg-red-500"
                                  )}
                                  style={{ width: `${Math.min(100, mlUtilization)}%` }}
                                />
                              </div>
                              
                              {/* Actions */}
                              <div className="flex gap-1">
                                <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => { setSelectedManagedLicenseId(ml.id); setShowModifySeatsModal(true); }}>
                                  <Edit2 className="w-3 h-3" />
                                </Button>
                                <Button size="sm" className="h-6 px-2 text-xs bg-blue-600 hover:bg-blue-700" onClick={() => { setSelectedManagedLicenseId(ml.id); setShowAssignModal(true); }} disabled={mlUnusedSeats <= 0}>
                                  <Plus className="w-3 h-3" />
                                </Button>
                                <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={async () => {
                                  if (confirm(`Delete this ${ml.license_type || ''} license?`)) {
                                    for (const a of mlAssignments) await client.entities.LicenseAssignment.delete(a.id);
                                    await client.entities.SaaSLicense.delete(ml.id);
                                    queryClient.invalidateQueries({ queryKey: ['related_licenses'] });
                                    queryClient.invalidateQueries({ queryKey: ['all_license_assignments'] });
                                    toast.success('License deleted!');
                                  }
                                }}>
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
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
                <div className="flex items-center gap-3" onClick={e => e.stopPropagation()}>
                  <Button 
                    size="sm" 
                    className="gap-1.5 h-7 text-xs bg-emerald-600 hover:bg-emerald-700"
                    onClick={(e) => { e.stopPropagation(); setShowAddIndividualLicense(true); }}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add License
                  </Button>
                  {individualSectionExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                </div>
              </div>
            </button>
            
            {individualSectionExpanded && (
              <>
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
                                const ilDaysUntilRenewal = assignment.renewal_date
                                  ? safeDifferenceInDays(assignment.renewal_date, new Date()) : null;
                                const ilRenewalPassed = ilDaysUntilRenewal !== null && ilDaysUntilRenewal < 0;
                                
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
                                      <div className="flex items-center gap-3 text-xs">
                                        <span className="text-slate-500">${assignment.cost_per_license || il.cost_per_license || 0}/mo</span>
                                        {assignment.renewal_date && (
                                          <div className={cn(
                                            "flex items-center gap-1.5 px-2 py-1 rounded-md",
                                            ilRenewalPassed ? "bg-red-100 text-red-700" :
                                            ilDaysUntilRenewal !== null && ilDaysUntilRenewal <= 30 ? "bg-amber-100 text-amber-700" :
                                            ilDaysUntilRenewal !== null && ilDaysUntilRenewal <= 60 ? "bg-yellow-100 text-yellow-700" :
                                            "bg-slate-100 text-slate-600"
                                          )}>
                                            <Calendar className="w-3 h-3" />
                                            <span>
                                              {ilRenewalPassed
                                                ? `Passed ${safeFormatDate(assignment.renewal_date, 'MMM d')}`
                                                : safeFormatDate(assignment.renewal_date, 'MMM d')}
                                            </span>
                                            {ilDaysUntilRenewal !== null && ilDaysUntilRenewal > 0 && ilDaysUntilRenewal <= 30 && (
                                              <span className="font-medium">({ilDaysUntilRenewal}d)</span>
                                            )}
                                          </div>
                                        )}
                                        {ilRenewalPassed && (
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-6 text-xs bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setRenewalAssignment(assignment);
                                              setRenewalLicense(null);
                                              setShowRenewalModal(true);
                                            }}
                                          >
                                            <RefreshCw className="w-3 h-3 mr-1" />
                                            Renew
                                          </Button>
                                        )}
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
                          const assignmentDaysUntilRenewal = assignment.renewal_date
                            ? safeDifferenceInDays(assignment.renewal_date, new Date()) : null;
                          const assignmentRenewalPassed = assignmentDaysUntilRenewal !== null && assignmentDaysUntilRenewal < 0;
                          
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
                                <div className="flex items-center gap-3 text-xs">
                                  {assignment.license_type && <span className="text-emerald-600 font-medium">{assignment.license_type}</span>}
                                  <span className="text-slate-500">${assignment.cost_per_license || 0}/mo</span>
                                  {assignment.renewal_date && (
                                    <div className={cn(
                                      "flex items-center gap-1.5 px-2 py-1 rounded-md",
                                      assignmentRenewalPassed ? "bg-red-100 text-red-700" :
                                      assignmentDaysUntilRenewal !== null && assignmentDaysUntilRenewal <= 30 ? "bg-amber-100 text-amber-700" :
                                      assignmentDaysUntilRenewal !== null && assignmentDaysUntilRenewal <= 60 ? "bg-yellow-100 text-yellow-700" :
                                      "bg-slate-100 text-slate-600"
                                    )}>
                                      <Calendar className="w-3 h-3" />
                                      <span>
                                        {assignmentRenewalPassed
                                          ? `Passed ${safeFormatDate(assignment.renewal_date, 'MMM d')}`
                                          : safeFormatDate(assignment.renewal_date, 'MMM d, yyyy')}
                                      </span>
                                      {assignmentDaysUntilRenewal !== null && assignmentDaysUntilRenewal > 0 && assignmentDaysUntilRenewal <= 30 && (
                                        <span className="font-medium">({assignmentDaysUntilRenewal}d)</span>
                                      )}
                                    </div>
                                  )}
                                  {assignment.card_last_four && (
                                    <div className="flex items-center gap-1 text-slate-500">
                                      <CreditCard className="w-3 h-3" />
                                      <span>•••• {assignment.card_last_four}</span>
                                    </div>
                                  )}
                                  {assignmentRenewalPassed && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-6 text-xs bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setRenewalAssignment(assignment);
                                        setRenewalLicense(null);
                                        setShowRenewalModal(true);
                                      }}
                                    >
                                      <RefreshCw className="w-3 h-3 mr-1" />
                                      Renew
                                    </Button>
                                  )}
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


        </div>
      </div>

      {/* Assignment Modal - Only for managed licenses */}
      <LicenseAssignmentModal
        open={showAssignModal}
        onClose={() => { setShowAssignModal(false); setSelectedManagedLicenseId(null); }}
        license={getSelectedManagedLicense()}
        contacts={contacts}
        assignments={allAssignments}
        onAssign={handleAssign}
        onRevoke={handleRevoke}
      />

      {/* Edit Modal */}
      <EditLicenseModal
        open={showEditModal}
        onClose={() => setShowEditModal(false)}
        license={software}
        onSave={handleEditSave}
        onDelete={() => setShowDeleteConfirm(true)}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={(open) => !isDeleting && setShowDeleteConfirm(open)}>
        <AlertDialogContent onEscapeKeyDown={(e) => isDeleting && e.preventDefault()}>
          {isDeleting ? (
            <div className="py-12 text-center">
              <RefreshCw className="w-10 h-10 text-red-500 mx-auto animate-spin mb-4" />
              <p className="text-lg font-semibold text-slate-900">Deleting Application...</p>
              <p className="text-sm text-slate-500 mt-1">Please wait while we remove all licenses and assignments</p>
            </div>
          ) : (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {software?.application_name}?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete this application and all associated data:
                  <ul className="list-disc ml-5 mt-2 space-y-1">
                    {managedLicenses.length > 0 && (
                      <li>{managedLicenses.length} managed license{managedLicenses.length !== 1 ? 's' : ''} ({managedAssignments.length} seat assignment{managedAssignments.length !== 1 ? 's' : ''})</li>
                    )}
                    {individualLicenses.length > 0 && (
                      <li>{individualLicenses.length} individual license{individualLicenses.length !== 1 ? 's' : ''} ({individualAssignments.length} assignment{individualAssignments.length !== 1 ? 's' : ''})</li>
                    )}
                  </ul>
                  <p className="mt-2 font-medium">This action cannot be undone.</p>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <Button
                  onClick={(e) => {
                    e.preventDefault();
                    handleDeleteApp();
                  }}
                  className="bg-red-600 hover:bg-red-700"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Application
                </Button>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>



      {/* Add Managed License Modal */}
      <AddManagedLicenseModal
        open={showAddManagedLicense}
        onClose={() => setShowAddManagedLicense(false)}
        onSave={handleAddManagedLicense}
        softwareName={software?.application_name}
      />

      {/* Add Individual License Modal */}
      <AddIndividualLicenseModal
        open={showAddIndividualLicense}
        onClose={() => setShowAddIndividualLicense(false)}
        onSave={handleAddIndividualLicense}
        softwareName={software?.application_name}
        contacts={contacts}
        existingAssignments={allAssignments}
      />

      {/* Renewal Confirmation Modal */}
      <Dialog open={showRenewalModal} onOpenChange={(open) => {
        setShowRenewalModal(open);
        if (!open) {
          setRenewalLicense(null);
          setRenewalAssignment(null);
          setRenewalDate('');
          setRenewalBillingCycle('annually');
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-emerald-600" />
              Confirm Renewal
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-slate-600">
              {renewalLicense 
                ? `Renewing ${renewalLicense.license_type || ''} license for ${software?.application_name}`
                : renewalAssignment 
                  ? `Renewing individual license for ${contacts.find(c => c.id === renewalAssignment.contact_id)?.full_name || 'user'}`
                  : 'Confirm renewal details'}
            </p>
            
            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">Billing Cycle</label>
              <Select
                value={renewalBillingCycle}
                onValueChange={(value) => {
                  setRenewalBillingCycle(value);
                  // Auto-update renewal date based on selection
                  const newDate = new Date();
                  if (value === 'annually') {
                    newDate.setFullYear(newDate.getFullYear() + 1);
                  } else if (value === 'monthly') {
                    newDate.setMonth(newDate.getMonth() + 1);
                  }
                  setRenewalDate(newDate.toISOString().split('T')[0]);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="annually">Annual (1 year)</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">New Renewal Date</label>
              <Input
                type="date"
                value={renewalDate || (() => {
                  const d = new Date();
                  d.setFullYear(d.getFullYear() + 1);
                  return d.toISOString().split('T')[0];
                })()}
                onChange={(e) => setRenewalDate(e.target.value)}
              />
              <p className="text-xs text-slate-500 mt-1">
                {renewalBillingCycle === 'annually' ? 'Typically 1 year from today' : 'Typically 1 month from today'}
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowRenewalModal(false)}>Cancel</Button>
            <Button 
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={async () => {
                const finalDate = renewalDate || (() => {
                  const d = new Date();
                  if (renewalBillingCycle === 'annually') {
                    d.setFullYear(d.getFullYear() + 1);
                  } else {
                    d.setMonth(d.getMonth() + 1);
                  }
                  return d.toISOString().split('T')[0];
                })();
                
                if (renewalLicense) {
                  await client.entities.SaaSLicense.update(renewalLicense.id, {
                    renewal_date: finalDate,
                    billing_cycle: renewalBillingCycle
                  });
                  queryClient.invalidateQueries({ queryKey: ['related_licenses'] });
                } else if (renewalAssignment) {
                  await client.entities.LicenseAssignment.update(renewalAssignment.id, {
                    renewal_date: finalDate
                  });
                  queryClient.invalidateQueries({ queryKey: ['all_license_assignments'] });
                }
                
                toast.success('Renewal confirmed!');
                setShowRenewalModal(false);
                setRenewalLicense(null);
                setRenewalAssignment(null);
                setRenewalDate('');
              }}
            >
              Confirm Renewal
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modify License Modal - Full Edit */}
      <Dialog open={showModifySeatsModal} onOpenChange={(open) => {
        setShowModifySeatsModal(open);
        if (!open) {
          setSelectedManagedLicenseId(null);
          setSeatChange(0);
          setModifyFormData({ quantity: 0, total_cost: 0, card_last_four: '', renewal_date: '', notes: '' });
        } else if (selectedManagedLicenseId) {
          const targetLicense = relatedLicenses.find(l => l.id === selectedManagedLicenseId);
          if (targetLicense) {
            setModifyFormData({
              quantity: targetLicense.quantity || 0,
              total_cost: targetLicense.total_cost || 0,
              card_last_four: targetLicense.card_last_four || '',
              renewal_date: targetLicense.renewal_date || '',
              notes: targetLicense.notes || ''
            });
          }
        }
      }}>
        <DialogContent className="max-w-md" onOpenAutoFocus={(e) => {
          // Initialize form data when modal opens
          const targetLicense = relatedLicenses.find(l => l.id === selectedManagedLicenseId);
          if (targetLicense && modifyFormData.quantity === 0) {
            setModifyFormData({
              quantity: targetLicense.quantity || 0,
              total_cost: targetLicense.total_cost || 0,
              card_last_four: targetLicense.card_last_four || '',
              renewal_date: targetLicense.renewal_date || '',
              notes: targetLicense.notes || ''
            });
          }
        }}>
          <DialogHeader>
            <DialogTitle>Modify License</DialogTitle>
          </DialogHeader>
          {(() => {
            const targetLicense = getSelectedManagedLicense();
            const currentAssignments = targetLicense ? getAssignmentsForLicense(targetLicense.id) : [];
            const assignedCount = currentAssignments.length;
            
            return (
              <div className="space-y-4 py-4">
                {targetLicense?.license_type && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">License Type</span>
                    <Badge className="bg-blue-100 text-blue-700">{targetLicense.license_type}</Badge>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Currently Assigned</span>
                  <span className="font-medium text-blue-600">{assignedCount} users</span>
                </div>
                
                <div className="border-t pt-4 space-y-4">
                  <div>
                    <label className="text-sm font-medium text-slate-700 block mb-1.5">Total Seats</label>
                    <Input
                      type="number"
                      value={modifyFormData.quantity}
                      onChange={(e) => setModifyFormData(prev => ({ ...prev, quantity: parseInt(e.target.value) || 0 }))}
                      min={assignedCount}
                    />
                    {modifyFormData.quantity < assignedCount && (
                      <p className="text-xs text-red-500 mt-1">Cannot be less than assigned seats ({assignedCount})</p>
                    )}
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-slate-700 block mb-1.5">Yearly Cost ($)</label>
                    <Input
                      type="number"
                      value={modifyFormData.total_cost}
                      onChange={(e) => setModifyFormData(prev => ({ ...prev, total_cost: parseFloat(e.target.value) || 0 }))}
                      step="0.01"
                      min="0"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      {modifyFormData.quantity > 0 
                        ? `$${(modifyFormData.total_cost / modifyFormData.quantity).toFixed(2)}/seat/year • $${(modifyFormData.total_cost / 12).toFixed(2)}/month`
                        : 'Enter total annual cost'}
                    </p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-slate-700 block mb-1.5">Card Last 4 Digits</label>
                    <Input
                      type="text"
                      placeholder="1234"
                      maxLength={4}
                      value={modifyFormData.card_last_four}
                      onChange={(e) => setModifyFormData(prev => ({ ...prev, card_last_four: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                    />
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-slate-700 block mb-1.5">Renewal Date</label>
                    <Input
                      type="date"
                      value={modifyFormData.renewal_date}
                      onChange={(e) => setModifyFormData(prev => ({ ...prev, renewal_date: e.target.value }))}
                    />
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-slate-700 block mb-1.5">Notes</label>
                    <Input
                      type="text"
                      placeholder="Optional notes..."
                      value={modifyFormData.notes}
                      onChange={(e) => setModifyFormData(prev => ({ ...prev, notes: e.target.value }))}
                    />
                  </div>
                </div>
              </div>
            );
          })()}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setShowModifySeatsModal(false); setSelectedManagedLicenseId(null); }}>Cancel</Button>
            <Button 
              onClick={async () => {
                const targetLicense = getSelectedManagedLicense();
                if (!targetLicense) return;
                
                const currentAssignments = getAssignmentsForLicense(targetLicense.id);
                if (modifyFormData.quantity < currentAssignments.length) {
                  toast.error(`Cannot set seats below assigned count (${currentAssignments.length})`);
                  return;
                }
                
                await client.entities.SaaSLicense.update(targetLicense.id, {
                  quantity: modifyFormData.quantity,
                  total_cost: modifyFormData.total_cost,
                  cost_per_license: modifyFormData.quantity > 0 ? modifyFormData.total_cost / modifyFormData.quantity : 0,
                  card_last_four: modifyFormData.card_last_four || null,
                  renewal_date: modifyFormData.renewal_date || null,
                  notes: modifyFormData.notes || null
                });
                
                queryClient.invalidateQueries({ queryKey: ['related_licenses'] });
                queryClient.invalidateQueries({ queryKey: ['license', licenseId] });
                setShowModifySeatsModal(false);
                setSelectedManagedLicenseId(null);
                toast.success('License updated!');
              }}
              disabled={modifyFormData.quantity < (getSelectedManagedLicense() ? getAssignmentsForLicense(getSelectedManagedLicense().id).length : 0)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}