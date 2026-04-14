import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { client, resolveFileUrl } from '@/api/client';
import { toast } from 'sonner';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { useAutoRetry } from '@/hooks/useAutoRetry';
import { createPageUrl } from '../utils';
import { motion } from 'framer-motion';
import { fadeInUp, staggerContainer, staggerItem } from '@/lib/motion';
import Breadcrumbs from '../components/ui/breadcrumbs';
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
  ExternalLink,
  RefreshCw,
  Edit2,
  Trash2,
  Plus,
  Filter,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  HelpCircle,
  AlertCircle,
  BarChart3,
  Receipt,
  Shield,
  Clock,
  Loader2,
  Camera
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonStats, SkeletonTable } from "@/components/ui/shimmer-skeleton";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { EmptyState } from "@/components/ui/empty-state";
import { cn, safeFormatDate } from "@/lib/utils";
// date-fns calls replaced by safe wrappers from @/lib/utils
import LicenseAssignmentModal from '../components/saas/LicenseAssignmentModal';
import AddLicenseModal from '../components/saas/AddLicenseModal';
import AddSoftwareModal from '../components/saas/AddSoftwareModal';
import SpendAnomalyAlert from '../components/saas/SpendAnomalyAlert';
import SoftwareCard from '../components/saas/SoftwareCard';
import AddContactModal from '../components/saas/AddContactModal';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import CustomerAnalytics from '../components/customer/CustomerAnalytics';
import DevicesTab from '../components/customer/DevicesTab';
import CustomerServicesTab from '../components/customer/CustomerServicesTab';
import CustomerDashboardTab from '../components/customer/CustomerDashboardTab';
import CustomerMap from '../components/customer/CustomerMap';
import M365Tab from '../components/customer/M365Tab';
import { UserPlus, Eye } from 'lucide-react';
import { isCustomerPortal } from '@/lib/portal-mode';

export default function CustomerDetail() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedLicense, setSelectedLicense] = useState(null);
  const [showAddLicense, setShowAddLicense] = useState(false);
  const [showAddSoftware, setShowAddSoftware] = useState(false);
  const [showAddContact, setShowAddContact] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoInputRef = useRef(null);
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const customerIdParam = searchParams.get('id');
  const currentTab = searchParams.get('tab') || 'dashboard';

  const handleTabChange = (tab) => {
    navigate(`/CustomerDetail?id=${customerIdParam}&tab=${tab}`, { replace: true });
  };
  const { user, isLoadingAuth: userLoading } = useAuth();

  // Security: customer portal users can ONLY access their own customer; staff (admin + sales) can browse any
  const isAdmin = user?.role === 'admin';
  const isStaff = user?.role === 'admin' || user?.role === 'sales';
  const resolvedCustomerId = (!isStaff || isCustomerPortal)
    ? user?.customer_id   // customers always scoped to their own data
    : (customerIdParam || user?.customer_id || null);  // staff can browse any customer

  // Logo upload handler
  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !resolvedCustomerId) return;

    // Validate file type and size
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5MB');
      return;
    }

    setUploadingLogo(true);
    try {
      const { file_url } = await client.integrations.Core.UploadFile({ file });
      await client.entities.Customer.update(resolvedCustomerId, { logo_url: file_url });
      queryClient.invalidateQueries({ queryKey: ['customer-detail', resolvedCustomerId] });
      toast.success('Logo updated');
    } catch (err) {
      toast.error(err.message || 'Failed to upload logo');
    } finally {
      setUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  };

  // Fetch only the single customer record (not all customers)
  const { data: customer = null, isLoading: loadingCustomer } = useQuery({
    queryKey: ['customer-detail', resolvedCustomerId],
    queryFn: async () => {
      if (!resolvedCustomerId) return null;
      const results = await client.entities.Customer.filter({ id: resolvedCustomerId });
      return results[0] || null;
    },
    enabled: !!resolvedCustomerId,
  });

  const customerId = resolvedCustomerId;

  // Service tag integration mappings
  const SERVICE_TAG_MAPPINGS = [
    { key: 'spanning', label: 'Spanning', entity: 'SpanningMapping', dot: 'bg-purple-500', text: 'text-purple-700 dark:text-purple-300' },
    { key: 'jumpcloud', label: 'JumpCloud', entity: 'JumpCloudMapping', dot: 'bg-green-500', text: 'text-green-700 dark:text-green-300' },
    { key: 'datto', label: 'RMM', entity: 'DattoSiteMapping', dot: 'bg-blue-500', text: 'text-blue-700 dark:text-blue-300' },
    { key: 'edr', label: 'EDR', entity: 'DattoEDRMapping', dot: 'bg-cyan-500', text: 'text-cyan-700 dark:text-cyan-300' },
    { key: 'rocketcyber', label: 'SOC', entity: 'RocketCyberMapping', dot: 'bg-orange-500', text: 'text-orange-700 dark:text-orange-300' },
    { key: 'unifi', label: 'Firewall', entity: 'UniFiMapping', dot: 'bg-sky-500', text: 'text-sky-700 dark:text-sky-300' },
    { key: 'threecx', label: 'VoIP', entity: 'ThreeCXReport', dot: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-300' },
    { key: 'dmarc', label: 'DMARC', entity: 'DmarcReportMapping', dot: 'bg-teal-500', text: 'text-teal-700 dark:text-teal-300' },
    { key: 'saas_alerts', label: 'SaaS Alerts', entity: 'SaaSAlertsMapping', dot: 'bg-violet-500', text: 'text-violet-700 dark:text-violet-300' },
    { key: 'pax8', label: 'M365', entity: 'Pax8Mapping', dot: 'bg-pink-500', text: 'text-pink-700 dark:text-pink-300' },
    { key: 'cove', label: 'Backup', entity: 'CoveDataMapping', dot: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-300' },
    { key: 'cipp', label: 'CIPP', entity: 'CIPPMapping', dot: 'bg-sky-600', text: 'text-sky-700 dark:text-sky-300' },
  ];

  const { data: serviceMappingsData } = useQuery({
    queryKey: ['customer-service-tags', customerId],
    queryFn: async () => {
      const results = {};
      await Promise.allSettled(
        SERVICE_TAG_MAPPINGS.map(async (svc) => {
          try {
            const data = await client.entities[svc.entity].filter({ customer_id: customerId });
            results[svc.key] = data || [];
          } catch {
            results[svc.key] = [];
          }
        })
      );
      return results;
    },
    enabled: !!customerId,
    staleTime: 1000 * 60 * 5,
  });

  const serviceTags = useMemo(() => {
    if (!serviceMappingsData) return [];
    const tags = [];
    for (const svc of SERVICE_TAG_MAPPINGS) {
      const mappings = serviceMappingsData[svc.key] || [];
      if (mappings.length > 0) {
        tags.push({ key: svc.key, label: svc.label, dot: svc.dot, text: svc.text });
      }
    }
    return tags;
  }, [serviceMappingsData]);

  // Shared query options: cache 5 min, retry twice, fail fast
  const qOpts = { staleTime: 1000 * 60 * 5, retry: 2 };

  const { data: contracts = [] } = useQuery({
    queryKey: ['contracts', customerId],
    queryFn: () => client.entities.Contract.filter({ customer_id: customerId }),
    enabled: !!customerId, ...qOpts
  });

  const { data: devices = [] } = useQuery({
    queryKey: ['devices', customerId],
    queryFn: () => client.entities.Device.filter({ customer_id: customerId }),
    enabled: !!customerId, ...qOpts
  });

  const { data: licenses = [] } = useQuery({
    queryKey: ['licenses', customerId],
    queryFn: () => client.entities.SaaSLicense.filter({ customer_id: customerId }),
    enabled: !!customerId, ...qOpts
  });

  const { data: applications = [] } = useQuery({
    queryKey: ['applications', customerId],
    queryFn: () => client.entities.Application.filter({ customer_id: customerId }),
    enabled: !!customerId, ...qOpts
  });

  const { data: recurringBills = [] } = useQuery({
    queryKey: ['recurring_bills', customerId],
    queryFn: () => client.entities.RecurringBill.filter({ customer_id: customerId }),
    enabled: !!customerId, ...qOpts
  });

  const recurringBillIds = useMemo(() => recurringBills.map(b => b.id).sort(), [recurringBills]);
  const { data: lineItems = [] } = useQuery({
    queryKey: ['line_items', customerId, recurringBillIds],
    queryFn: () => client.entities.RecurringBillLineItem.filterIn(
      'recurring_bill_id', recurringBillIds
    ),
    enabled: !!customerId && recurringBills.length > 0, ...qOpts
  });

  // Filter to only active recurring bills (exclude inactive/expired)
  const activeBillIdSet = useMemo(() => {
    const now = new Date();
    return new Set(
      recurringBills
        .filter(b => {
          if ((b.status || '').toLowerCase() === 'inactive') return false;
          if (b.end_date) {
            const end = new Date(b.end_date);
            if (end.getFullYear() < 2090 && end < now) return false;
          }
          return true;
        })
        .map(b => b.id)
    );
  }, [recurringBills]);

  // Line items from active bills only
  const activeLineItems = useMemo(
    () => lineItems.filter(item => activeBillIdSet.has(item.recurring_bill_id)),
    [lineItems, activeBillIdSet]
  );

  const { data: invoices = [] } = useQuery({
    queryKey: ['invoices', customerId],
    queryFn: () => client.entities.Invoice.filter({ customer_id: customerId }),
    enabled: !!customerId, ...qOpts
  });

  const { data: quotes = [] } = useQuery({
    queryKey: ['quotes', customerId],
    queryFn: () => client.entities.Quote.filter({ customer_id: customerId }),
    enabled: !!customerId, ...qOpts
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ['contacts', customerId],
    queryFn: () => client.entities.Contact.filter({ customer_id: customerId }),
    enabled: !!customerId, ...qOpts
  });

  const { data: tickets = [] } = useQuery({
    queryKey: ['tickets', customerId],
    queryFn: () => client.entities.Ticket.filter({ customer_id: customerId }),
    enabled: !!customerId, ...qOpts
  });

  const quoteIds = useMemo(() => quotes.map(q => q.id).sort(), [quotes]);
  const { data: quoteItems = [] } = useQuery({
    queryKey: ['quote_items', customerId, quoteIds],
    queryFn: () => client.entities.QuoteItem.filterIn(
      'quote_id', quoteIds
    ),
    enabled: !!customerId && quotes.length > 0, ...qOpts
  });

  const invoiceIds = useMemo(() => invoices.map(i => i.id).sort(), [invoices]);
  const { data: invoiceLineItems = [] } = useQuery({
    queryKey: ['invoice_line_items', customerId, invoiceIds],
    queryFn: () => client.entities.InvoiceLineItem.filterIn(
      'invoice_id', invoiceIds
    ),
    enabled: !!customerId && invoices.length > 0, ...qOpts
  });

  const contractIds = useMemo(() => contracts.map(c => c.id).sort(), [contracts]);
  const { data: contractItems = [] } = useQuery({
    queryKey: ['contract_items', customerId, contractIds],
    queryFn: () => client.entities.ContractItem.filterIn(
      'contract_id', contractIds
    ),
    enabled: !!customerId && contracts.length > 0, ...qOpts
  });

  const { data: licenseAssignments = [] } = useQuery({
    queryKey: ['license_assignments', customerId],
    queryFn: () => client.entities.LicenseAssignment.filter({ customer_id: customerId }),
    enabled: !!customerId, ...qOpts
  });

  // Auto-retry if page loads with all empty data
  useAutoRetry(
    [contacts, recurringBills, contracts, devices],
    loadingCustomer,
    [['contacts', customerId], ['recurring_bills', customerId], ['contracts', customerId], ['devices', customerId]]
  );

  // Fetch JumpCloud mapping for this customer
  const { data: jumpcloudMapping } = useQuery({
    queryKey: ['jumpcloud-mapping', customerId],
    queryFn: async () => {
      const mappings = await client.entities.JumpCloudMapping.filter({ customer_id: customerId });
      return mappings[0] || null;
    },
    enabled: !!customerId, ...qOpts
  });

  // Fetch Spanning mapping for this customer
  const { data: spanningMapping } = useQuery({
    queryKey: ['spanning-mapping', customerId],
    queryFn: async () => {
      const mappings = await client.entities.SpanningMapping.filter({ customer_id: customerId });
      return mappings[0] || null;
    },
    enabled: !!customerId
  });

  const hasJumpcloudMapping = jumpcloudMapping !== null && jumpcloudMapping !== undefined;
  const hasSpanningMapping = spanningMapping !== null && spanningMapping !== undefined;
  const hasServicesMapped = lineItems.length > 0 || hasJumpcloudMapping || hasSpanningMapping;

  const [expandedBills, setExpandedBills] = useState({ _section: true });
              const [expandedQuotes, setExpandedQuotes] = useState({});
              const [expandedContracts, setExpandedContracts] = useState({});
              const [expandedInvoices, setExpandedInvoices] = useState({ _section: true });
              const [invoiceFilter, setInvoiceFilter] = useState('all');
                  const [ticketFilter, setTicketFilter] = useState('all');
                  const [ticketPage, setTicketPage] = useState(1);
                  const [saasFilter, setSaasFilter] = useState('all'); // 'all', 'underutilized', 'full', 'unassigned'
                  const [saasUserFilter, setSaasUserFilter] = useState(''); // filter by contact id
                  const [saasView, setSaasView] = useState('licenses'); // 'licenses', 'users', 'spend'
                  const [saasCategoryFilter, setSaasCategoryFilter] = useState(''); // filter by category
                  const [jumpcloudSsoExpanded, setJumpcloudSsoExpanded] = useState(false); // collapsible JumpCloud SSO section
  

  // Only block the full page on user auth + customer record.
  // Everything else loads progressively — tabs show their own loading states.
  const isLoading = userLoading || loadingCustomer;

  const handleAssignLicense = async (contactId) => {
    try {
      await client.entities.LicenseAssignment.create({
        license_id: selectedLicense.id,
        contact_id: contactId,
        customer_id: customerId,
        assigned_date: new Date().toISOString().split('T')[0],
        status: 'active'
      });
      // Update license assigned_users count
      const newCount = licenseAssignments.filter(a => a.license_id === selectedLicense.id && a.status === 'active').length + 1;
      await client.entities.SaaSLicense.update(selectedLicense.id, { assigned_users: newCount });
      queryClient.invalidateQueries({ queryKey: ['license_assignments', customerId] });
      queryClient.invalidateQueries({ queryKey: ['licenses', customerId] });
      toast.success('License assigned!');
    } catch (error) {
      toast.error(error.message || 'Failed to assign license');
    }
  };

  const handleRevokeLicense = async (contactId) => {
    const assignment = licenseAssignments.find(a =>
      a.license_id === selectedLicense.id &&
      a.contact_id === contactId &&
      a.status === 'active'
    );
    if (assignment) {
      try {
        await client.entities.LicenseAssignment.update(assignment.id, { status: 'revoked' });
        const newCount = Math.max(0, licenseAssignments.filter(a => a.license_id === selectedLicense.id && a.status === 'active').length - 1);
        await client.entities.SaaSLicense.update(selectedLicense.id, { assigned_users: newCount });
        queryClient.invalidateQueries({ queryKey: ['license_assignments', customerId] });
        queryClient.invalidateQueries({ queryKey: ['licenses', customerId] });
        toast.success('License revoked!');
      } catch (error) {
        toast.error(error.message || 'Failed to revoke license');
      }
    }
  };

  const handleAddLicense = async (licenseData) => {
    try {
      await client.entities.SaaSLicense.create(licenseData);
      queryClient.invalidateQueries({ queryKey: ['licenses', customerId] });
      setShowAddLicense(false);
      toast.success('License added!');
    } catch (error) {
      toast.error(error.message || 'Failed to add license');
    }
  };

  const handleAddSoftware = async (softwareData) => {
    try {
      setShowAddSoftware(false);

      // Create the software in the Application catalog
      const newApp = await client.entities.Application.create(softwareData);
      toast.success('Software added!');

      // Pre-populate the query cache for instant load
      queryClient.setQueryData(['application', newApp.id], newApp);
      queryClient.setQueryData(['related_licenses', softwareData.name, customerId], []);
      queryClient.setQueryData(['all_license_assignments', softwareData.name, customerId], []);

      // Navigate to the software detail page
      navigate(createPageUrl(`LicenseDetail?appId=${newApp.id}`));
    } catch (error) {
      toast.error(error.message || 'Failed to add software');
    }
  };

  // Group licenses by application name for the new UI
  const groupedSoftware = licenses.reduce((acc, license) => {
    const key = license.application_name;
    if (!acc[key]) {
      acc[key] = {
        software: license, // Use the first one as the base software info
        managedLicense: null,
        individualLicenses: [],
        isCatalogOnly: false
      };
    }
    if (license.management_type === 'managed') {
      acc[key].managedLicense = license;
    } else {
      acc[key].individualLicenses.push(license);
    }
    return acc;
  }, {});

  // Add Application catalog entries that don't have licenses yet
  applications.forEach(app => {
    if (!groupedSoftware[app.name]) {
      groupedSoftware[app.name] = {
        software: {
          id: app.id,
          application_name: app.name,
          vendor: app.vendor,
          logo_url: app.logo_url,
          website_url: app.website_url,
          category: app.category,
          notes: app.notes,
          customer_id: app.customer_id,
          status: app.status || 'active',
          _isApplication: true
        },
        managedLicense: null,
        individualLicenses: [],
        isCatalogOnly: true
      };
    }
  });

  const handleAddContact = async (contactData) => {
    try {
      await client.entities.Contact.create(contactData);
      queryClient.invalidateQueries({ queryKey: ['contacts', customerId] });
      setShowAddContact(false);
      toast.success('Team member added!');
    } catch (error) {
      toast.error(error.message || 'Failed to add team member');
    }
  };

  const handleSyncCustomer = async () => {
    if (!customer) return;
    setIsSyncing(true);
    const results = [];
    const errors = [];

    try {
      const syncTasks = [];

      // ── HaloPSA: customer, contacts, tickets, contracts, invoices, recurring bills ──
      if (customer?.source === 'halopsa' && customer?.external_id) {
        const haloId = customer.external_id;

        const haloSyncs = [
          { fn: 'syncHaloPSACustomers',       label: 'Customer' },
          { fn: 'syncHaloPSAContacts',         label: 'Contacts' },
          { fn: 'syncHaloPSATickets',          label: 'Tickets' },
          { fn: 'syncHaloPSAContracts',        label: 'Contracts' },
          { fn: 'syncHaloPSAInvoices',         label: 'Invoices' },
          { fn: 'syncHaloPSARecurringBills',   label: 'Billing' },
        ];

        for (const { fn, label } of haloSyncs) {
          syncTasks.push(
            client.functions.invoke(fn, { action: 'sync_customer', customer_id: haloId })
              .then(res => res.success ? results.push(label) : errors.push(label))
              .catch(() => errors.push(label))
          );
        }
      }

      // ── Integrations: check all mappings in parallel, sync those that exist ──
      const integrationChecks = [
        { entity: 'JumpCloudMapping',   fn: 'syncJumpCloudLicenses',  action: 'sync_licenses',  label: 'JumpCloud' },
        { entity: 'SpanningMapping',    fn: 'syncSpanningBackup',     action: 'sync_licenses',  label: 'Spanning' },
        { entity: 'DattoSiteMapping',   fn: 'syncDattoRMMDevices',    action: 'sync_devices',   label: 'Datto RMM' },
        { entity: 'DattoEDRMapping',    fn: 'syncDattoEDR',           action: 'sync_alerts',    label: 'Datto EDR' },
        { entity: 'CoveDataMapping',    fn: 'syncCoveData',           action: 'sync_devices',   label: 'Cove' },
        { entity: 'RocketCyberMapping', fn: 'syncRocketCyber',        action: 'sync_agents',    label: 'RocketCyber' },
        { entity: 'SaaSAlertsMapping',  fn: 'syncSaaSAlerts',         action: 'sync_alerts',    label: 'SaaS Alerts' },
        { entity: 'UniFiMapping',       fn: 'syncUniFiDevices',       action: 'sync_devices',   label: 'UniFi' },
        { entity: 'Pax8Mapping',        fn: 'syncPax8Subscriptions',  action: 'sync_subscriptions', label: 'Pax8' },
        { entity: 'CIPPMapping',        fn: 'syncCIPP',               action: 'sync_customer',      label: 'CIPP',  extraParams: true },
      ];

      const mappingResults = await Promise.all(
        integrationChecks.map(({ entity }) =>
          client.entities[entity].filter({ customer_id: customerId }).catch(() => [])
        )
      );

      integrationChecks.forEach(({ fn, action, label, extraParams }, idx) => {
        if (mappingResults[idx].length > 0) {
          const params = { action, customer_id: customerId };
          // CIPP needs customerId + tenantId from the mapping
          if (extraParams && fn === 'syncCIPP') {
            const mapping = mappingResults[idx][0];
            params.customerId = customerId;
            params.tenantId = mapping.cipp_tenant_id;
          }
          syncTasks.push(
            client.functions.invoke(fn, params)
              .then(res => res.success ? results.push(label) : errors.push(label))
              .catch(() => errors.push(label))
          );
        }
      });

      // Execute all sync tasks in parallel
      await Promise.allSettled(syncTasks);

      if (results.length > 0) {
        toast.success(`Synced: ${results.join(', ')}`);
      }
      if (errors.length > 0) {
        toast.error(`Failed: ${errors.join(', ')}`);
      }
      if (results.length === 0 && errors.length === 0) {
        toast.info('No integrations configured to sync');
      }

      // Invalidate all queries to refresh UI
      const keys = [
        'contracts', 'recurring_bills', 'invoices', 'invoice_line_items',
        'tickets', 'contacts', 'devices', 'license_assignments',
        'line_items', 'spanning-mapping', 'customer-contacts',
      ];
      for (const key of keys) {
        queryClient.invalidateQueries({ queryKey: [key, customerId] });
      }
    } catch (error) {
      toast.error(error.message || 'An error occurred during sync');
    } finally {
      setIsSyncing(false);
    }
  };



  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-6 w-40" />
        {/* Header skeleton */}
        <div className="rounded-[14px] bg-card border shadow-hero-sm p-6 space-y-4">
          <div className="flex items-center gap-4">
            <Skeleton className="w-14 h-14 rounded-hero-lg" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-7 w-56" />
              <Skeleton className="h-4 w-80" />
            </div>
          </div>
          <SkeletonStats count={5} className="grid-cols-2 sm:grid-cols-5" />
        </div>
        {/* Tabs skeleton */}
        <Skeleton className="h-10 w-full rounded-hero-lg" />
        <SkeletonTable rows={6} cols={4} />
      </div>
    );
  }

  if (!customer) {
    return (
      <EmptyState
        icon={Building2}
        title="Account Not Found"
        description="We couldn't find your account. Please contact support."
        action={{
          label: 'Back to Dashboard',
          onClick: () => navigate(createPageUrl('Dashboard')),
        }}
      />
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
      {isAdmin && (
        <Breadcrumbs items={[
          { label: 'Customers', href: createPageUrl('Customers') },
          { label: customer?.name || 'Customer' }
        ]} />
      )}
      
      {/* Header with Sync - Admin only */}
      {isAdmin && (
        <motion.div {...fadeInUp} className="flex items-center justify-end gap-2">
          <Link to={createPageUrl(`CustomerPortalPreview?id=${customerId}`)}>
            <Button variant="outline" size="sm" className="gap-2">
              <Eye className="w-4 h-4" />
              View as Customer
            </Button>
          </Link>
          <Button
            onClick={handleSyncCustomer}
            disabled={isSyncing}
            variant="outline"
            className="gap-2"
            size="sm"
          >
            {isSyncing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            {isSyncing ? 'Syncing...' : 'Sync All'}
          </Button>
        </motion.div>
      )}

      {/* Account Header — HeroUI-inspired */}
      <motion.div
        {...fadeInUp}
        className="relative bg-card rounded-[14px] border shadow-hero-md overflow-hidden"
      >
        {/* Gradient accent line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-primary/60 to-primary/20" />

        <div className="p-6">
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
            {/* Logo & Name */}
            <div className="flex items-center gap-4">
              <div
                className={cn(
                  "relative w-14 h-14 rounded-hero-lg bg-primary/10 flex items-center justify-center flex-shrink-0 group",
                  isAdmin && "cursor-pointer"
                )}
                onClick={() => isAdmin && logoInputRef.current?.click()}
              >
                {customer.logo_url ? (
                  <img src={resolveFileUrl(customer.logo_url)} alt={customer.name} className="w-14 h-14 rounded-hero-lg object-cover" />
                ) : (
                  <span className="text-2xl font-bold text-primary">
                    {customer.name?.charAt(0)?.toUpperCase() || 'C'}
                  </span>
                )}
                {isAdmin && (
                  <div className="absolute inset-0 bg-black/50 rounded-hero-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    {uploadingLogo ? (
                      <Loader2 className="w-5 h-5 text-white animate-spin" />
                    ) : (
                      <Camera className="w-5 h-5 text-white" />
                    )}
                  </div>
                )}
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleLogoUpload}
                />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-foreground">{customer.name}</h1>
                  <Badge
                    variant={customer.status === 'active' ? 'flat-success' : customer.status === 'suspended' ? 'flat-destructive' : 'secondary'}
                    className="capitalize"
                  >
                    {customer.status || 'Active'}
                  </Badge>
                </div>
                {serviceTags.length > 0 && (
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    {serviceTags.map((tag) => (
                      <span
                        key={tag.key}
                        className={cn(
                          'inline-flex items-center gap-1.5 pl-1.5 pr-2.5 py-0.5 rounded-full text-[11px] font-medium',
                          'bg-muted/60 border border-border/50',
                          'transition-colors hover:bg-muted',
                          tag.text
                        )}
                      >
                        <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', tag.dot)} />
                        {tag.label}
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-4 mt-1.5 text-sm text-muted-foreground">
                  {customer.email && (
                    <a href={`mailto:${customer.email}`} className="flex items-center gap-1.5 hover:text-foreground transition-colors duration-[250ms]">
                      <Mail className="w-3.5 h-3.5" />
                      {customer.email}
                    </a>
                  )}
                  {customer.phone && (
                    <a href={`tel:${customer.phone}`} className="flex items-center gap-1.5 hover:text-foreground transition-colors duration-[250ms]">
                      <Phone className="w-3.5 h-3.5" />
                      {customer.phone}
                    </a>
                  )}
                  {customer.address && (
                    <span className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5" />
                      {customer.address}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Map */}
          {customer.address && (
            <CustomerMap addresses={[customer.address]} />
          )}

          {/* Quick Stats — Animated counters */}
          <motion.div
            variants={staggerContainer}
            initial="initial"
            animate="animate"
            className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-6"
          >
            {[
              { icon: Users, value: contacts.length, label: 'Team', color: 'text-primary', bg: 'bg-primary/10' },
              { icon: FileText, value: contracts.filter(c => c.status === 'active').length, label: 'Contracts', color: 'text-warning', bg: 'bg-warning/10' },
              { icon: HelpCircle, value: customer?.total_tickets || tickets.length, label: 'Tickets', color: 'text-destructive', bg: 'bg-destructive/10' },
              { icon: Cloud, value: licenses.length, label: 'Apps', color: 'text-[#7828C8]', bg: 'bg-[#7828C8]/10' },
              { icon: Monitor, value: devices.length, label: 'Devices', color: 'text-success', bg: 'bg-success/10' },
            ].map(stat => (
              <motion.div
                key={stat.label}
                variants={staggerItem}
                className="flex items-center gap-3 px-3 py-2.5 rounded-hero-md border border-border/50 bg-card hover:shadow-hero-sm transition-all duration-[250ms] cursor-default"
              >
                <div className={cn('w-8 h-8 rounded-hero-sm flex items-center justify-center', stat.bg)}>
                  <stat.icon className={cn('w-4 h-4', stat.color)} />
                </div>
                <div>
                  <AnimatedCounter value={stat.value} className="text-lg font-bold text-foreground" />
                  <p className="text-[11px] text-muted-foreground leading-none mt-0.5">{stat.label}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </motion.div>



      {/* Tabs — HeroUI-inspired with animated styling */}
      <Tabs value={currentTab} onValueChange={handleTabChange} className="space-y-6" id="customer-tabs">
        <TabsList className="bg-zinc-100 dark:bg-zinc-800/80 border-0 rounded-hero-lg p-1 flex gap-1 h-auto overflow-x-auto scrollbar-hide">
          {[
            { value: 'dashboard', icon: BarChart3, label: 'Dashboard' },
            { value: 'billing', icon: DollarSign, label: 'Billing' },
            { value: 'services', icon: Cloud, label: 'Services' },
            { value: 'm365', icon: Monitor, label: 'M365' },
            { value: 'licenses', icon: Cloud, label: 'SaaS' },
            { value: 'quotes', icon: FileText, label: 'Quotes' },
            { value: 'tickets', icon: HelpCircle, label: 'Tickets' },
          ].map(tab => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="gap-2 py-2 px-4 rounded-hero-sm text-zinc-500 dark:text-zinc-400 font-medium transition-all duration-[250ms] data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-700 data-[state=active]:text-foreground data-[state=active]:shadow-sm hover:text-foreground whitespace-nowrap"
            >
              <tab.icon className="w-4 h-4" />
              <span className="text-sm">{tab.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="dashboard">
          <CustomerDashboardTab
            customer={customer}
            contacts={contacts}
            devices={devices}
            contracts={contracts}
            tickets={tickets}
            invoices={invoices}
            lineItems={activeLineItems}
            recurringBills={recurringBills}
            licenses={licenses}
            serviceTags={serviceTags}
          />
        </TabsContent>

        <TabsContent value="billing">
                        <div className="space-y-6">

                          {/* Billing Dashboard Widgets */}
                          {(() => {
                            const activeBills = recurringBills.filter(b => activeBillIdSet.has(b.id));
                            const yearlyBills = activeBills.filter(b => ['yearly', 'annual', 'annually'].includes((b.frequency || '').toLowerCase()));
                            const monthlyBills = activeBills.filter(b => !['yearly', 'annual', 'annually'].includes((b.frequency || '').toLowerCase()));
                            const monthlyCost = monthlyBills.reduce((sum, b) => sum + (b.amount || 0), 0);
                            const yearlyCost = yearlyBills.reduce((sum, b) => sum + (b.amount || 0), 0);
                            const overdueInvoices = invoices.filter(i => i.status === 'overdue');
                            const pendingInvoices = invoices.filter(i => i.status === 'sent');
                            const totalOverdue = overdueInvoices.reduce((sum, inv) => sum + (parseFloat(inv.amount_due) || 0), 0);
                            const totalPending = pendingInvoices.reduce((sum, inv) => sum + (parseFloat(inv.amount_due) || inv.total || 0), 0);
                            const activeContract = contracts.find(c => c.status === 'active') || contracts[0];
                            const contractValue = contractItems.reduce((sum, ci) => sum + (ci.net_amount || ci.price || 0), 0);
                            const totalLineItems = activeLineItems.length;
                            const workstations = devices.filter(d => d.device_type === 'workstation' || d.device_type === 'laptop' || d.device_type === 'desktop').length;
                            const servers = devices.filter(d => d.device_type === 'server').length;

                            return (
                              <>
                                {/* Top Stats Row */}
                                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                                  {/* Monthly Cost */}
                                  <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                                    <div className="flex items-center gap-2 mb-2">
                                      <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
                                        <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                                      </div>
                                      <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Monthly</span>
                                    </div>
                                    <p className="text-xl font-bold text-gray-900">
                                      ${monthlyCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                    </p>
                                    <p className="text-[10px] text-gray-400 mt-1">{monthlyBills.length} bill{monthlyBills.length !== 1 ? 's' : ''}</p>
                                  </div>

                                  {/* Yearly Cost */}
                                  <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                                    <div className="flex items-center gap-2 mb-2">
                                      <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
                                        <Calendar className="w-3.5 h-3.5 text-blue-600" />
                                      </div>
                                      <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Yearly</span>
                                    </div>
                                    <p className="text-xl font-bold text-gray-900">
                                      {yearlyCost > 0 ? `$${yearlyCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'}
                                    </p>
                                    <p className="text-[10px] text-gray-400 mt-1">{yearlyBills.length > 0 ? `${yearlyBills.length} bill${yearlyBills.length !== 1 ? 's' : ''}` : 'None'}</p>
                                  </div>

                                  {/* Contract */}
                                  <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                                    <div className="flex items-center gap-2 mb-2">
                                      <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center">
                                        <FileText className="w-3.5 h-3.5 text-indigo-600" />
                                      </div>
                                      <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Contract</span>
                                    </div>
                                    {activeContract ? (
                                      <>
                                        <p className="text-lg font-bold text-gray-900 truncate">{activeContract.name}</p>
                                        <p className="text-[10px] text-gray-400 mt-1">{contractItems.length} item{contractItems.length !== 1 ? 's' : ''}</p>
                                      </>
                                    ) : (
                                      <>
                                        <p className="text-xl font-bold text-gray-300">—</p>
                                        <p className="text-[10px] text-gray-400 mt-1">No contract</p>
                                      </>
                                    )}
                                  </div>

                                  {/* Devices */}
                                  <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                                    <div className="flex items-center gap-2 mb-2">
                                      <div className="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center">
                                        <Monitor className="w-3.5 h-3.5 text-violet-600" />
                                      </div>
                                      <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Devices</span>
                                    </div>
                                    <p className="text-xl font-bold text-gray-900">{devices.length}</p>
                                    <p className="text-[10px] text-gray-400 mt-1">
                                      {workstations > 0 && `${workstations} workstation${workstations !== 1 ? 's' : ''}`}
                                      {workstations > 0 && servers > 0 && ' · '}
                                      {servers > 0 && `${servers} server${servers !== 1 ? 's' : ''}`}
                                      {workstations === 0 && servers === 0 && 'No devices'}
                                    </p>
                                  </div>

                                  {/* Users / Contacts */}
                                  <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                                    <div className="flex items-center gap-2 mb-2">
                                      <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center">
                                        <Users className="w-3.5 h-3.5 text-amber-600" />
                                      </div>
                                      <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Users</span>
                                    </div>
                                    <p className="text-xl font-bold text-gray-900">{contacts.length}</p>
                                    <p className="text-[10px] text-gray-400 mt-1">
                                      {totalLineItems} line item{totalLineItems !== 1 ? 's' : ''} billed
                                    </p>
                                  </div>
                                </div>

                                {/* Invoice Summary Bar */}
                                <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                                  <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-sm font-semibold text-gray-900">Invoice Summary</h3>
                                    <span className="text-xs text-gray-400">{invoices.length} total invoice{invoices.length !== 1 ? 's' : ''}</span>
                                  </div>
                                  <div className="grid grid-cols-2 gap-4">
                                    <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-50/60">
                                      <div className="w-2 h-10 rounded-full bg-amber-500" />
                                      <div>
                                        <p className="text-xs text-amber-600 font-medium">Pending</p>
                                        <p className="text-lg font-bold text-amber-700">
                                          ${totalPending.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                        </p>
                                        <p className="text-xs text-amber-500">{pendingInvoices.length} invoice{pendingInvoices.length !== 1 ? 's' : ''}</p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-3 p-3 rounded-lg bg-red-50/60">
                                      <div className="w-2 h-10 rounded-full bg-red-500" />
                                      <div>
                                        <p className="text-xs text-red-600 font-medium">Overdue</p>
                                        <p className="text-lg font-bold text-red-700">
                                          ${totalOverdue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                        </p>
                                        <p className="text-xs text-red-500">{overdueInvoices.length} invoice{overdueInvoices.length !== 1 ? 's' : ''}</p>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* Services Integration Tags */}
                                {serviceTags.length > 0 && (
                                  <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                                    <h3 className="text-sm font-semibold text-gray-900 mb-3">Active Integrations</h3>
                                    <div className="flex flex-wrap gap-2">
                                      {serviceTags.map(tag => (
                                        <span key={tag.key} className={cn("inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-gray-50 border border-gray-200", tag.text)}>
                                          <span className={cn("w-2 h-2 rounded-full", tag.dot)} />
                                          {tag.label}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </>
                            );
                          })()}

                          {/* Invoices Section */}
                          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                            {/* Header */}
                            <div className="px-6 py-4 flex flex-wrap items-center justify-between gap-3">
                              <div className="flex items-center gap-4">
                                <h3 className="text-lg font-semibold text-gray-900">Invoices</h3>
                                {invoices.filter(i => i.status === 'overdue').length > 0 && (
                                  <span className="text-sm text-red-600 font-medium">
                                    ${invoices.filter(i => i.status === 'overdue').reduce((sum, inv) => sum + (parseFloat(inv.amount_due) || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} overdue ({invoices.filter(i => i.status === 'overdue').length})
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <select
                                  value={invoiceFilter}
                                  onChange={(e) => setInvoiceFilter(e.target.value)}
                                  className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white"
                                >
                                  <option value="all">All</option>
                                  <option value="paid">Paid</option>
                                  <option value="overdue">Overdue</option>
                                  <option value="sent">Pending</option>
                                </select>
                              </div>
                            </div>

                            {/* Invoice Table */}
                            {invoices.length === 0 ? (
                              <div className="py-16 text-center border-t">
                                <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                                <p className="text-gray-500">No invoices found</p>
                                {customer?.source === 'halopsa' && (
                                  <p className="text-sm text-gray-400 mt-1">Click Sync to pull from HaloPSA</p>
                                )}
                              </div>
                            ) : (
                              <div>
                                {/* Table Header */}
                                <div className="grid grid-cols-[auto_1fr_100px_120px_120px_110px_110px_40px] gap-2 px-6 py-2.5 bg-gray-50 border-y text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                  <div className="w-6" />
                                  <div>Invoice</div>
                                  <div>Status</div>
                                  <div>Issued</div>
                                  <div>Due</div>
                                  <div className="text-right">Amount</div>
                                  <div className="text-right">Balance</div>
                                  <div />
                                </div>

                                {/* Invoice Rows */}
                                <div className="divide-y divide-gray-100">
                                  {invoices
                                    .filter(inv => invoiceFilter === 'all' || inv.status === invoiceFilter)
                                    .sort((a, b) => new Date(b.due_date || 0) - new Date(a.due_date || 0))
                                    .map(invoice => {
                                      const invoiceItems = invoiceLineItems.filter(item => item.invoice_id === invoice.id);
                                      const isExpanded = expandedInvoices[invoice.id];
                                      const isPaid = invoice.status === 'paid';
                                      const isOverdue = invoice.status === 'overdue';
                                      const balance = isPaid ? 0 : (invoice.amount_due || invoice.total || 0);

                                      // Smart invoice label based on line item content
                                      const invoiceLabel = (() => {
                                        if (invoiceItems.length === 0) return invoice.invoice_number;
                                        const descs = invoiceItems.map(i => (i.description || '').toLowerCase());
                                        const hasTicket = descs.some(d => d.includes('ticket id:') || d.includes('ticket opened'));
                                        if (hasTicket) return 'Ticket Charge';
                                        const hasRecurring = descs.some(d => d.includes('business location') || d.includes('managed it - remote only') || d.includes('managed it –'));
                                        if (hasRecurring) return 'Monthly Recurring';
                                        return invoice.invoice_number;
                                      })();

                                      return (
                                        <div key={invoice.id}>
                                          {/* Invoice Row */}
                                          <button
                                            onClick={() => setExpandedInvoices(prev => ({ ...prev, [invoice.id]: !prev[invoice.id] }))}
                                            className={cn(
                                              "w-full grid grid-cols-[auto_1fr_100px_120px_120px_110px_110px_40px] gap-2 px-6 py-3.5 items-center hover:bg-gray-50 transition-colors text-left",
                                              isOverdue && "bg-red-50/40"
                                            )}
                                          >
                                            <ChevronRight className={cn(
                                              "w-4 h-4 text-gray-400 transition-transform",
                                              isExpanded && "rotate-90"
                                            )} />
                                            <div className="font-medium text-gray-900 truncate">
                                              {invoiceLabel}
                                              {invoiceLabel !== invoice.invoice_number && (
                                                <span className="ml-2 text-xs text-gray-400 font-normal">#{invoice.invoice_number}</span>
                                              )}
                                            </div>
                                            <div>
                                              <span className={cn(
                                                "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
                                                isPaid && "bg-emerald-100 text-emerald-700",
                                                isOverdue && "bg-red-100 text-red-700",
                                                invoice.status === 'sent' && "bg-amber-100 text-amber-700",
                                                invoice.status === 'draft' && "bg-gray-100 text-gray-600"
                                              )}>
                                                {isPaid && <CheckCircle2 className="w-3 h-3" />}
                                                {isOverdue && <AlertCircle className="w-3 h-3" />}
                                                {isPaid ? 'Paid' : isOverdue ? 'Overdue' : invoice.status === 'sent' ? 'Pending' : 'Draft'}
                                              </span>
                                            </div>
                                            <div className="text-sm text-gray-600">
                                              {invoice.invoice_date ? safeFormatDate(invoice.invoice_date, 'MMM d, yyyy') : '—'}
                                            </div>
                                            <div className={cn("text-sm", isOverdue ? "text-red-600 font-medium" : "text-gray-600")}>
                                              {invoice.due_date ? safeFormatDate(invoice.due_date, 'MMM d, yyyy') : '—'}
                                            </div>
                                            <div className="text-sm font-semibold text-gray-900 text-right">
                                              ${(invoice.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                            </div>
                                            <div className={cn(
                                              "text-sm font-semibold text-right",
                                              isOverdue ? "text-red-600" : isPaid ? "text-gray-400" : "text-gray-900"
                                            )}>
                                              {isPaid ? '—' : `$${balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                                            </div>
                                            <div />
                                          </button>

                                          {/* Expanded Line Items */}
                                          {isExpanded && (
                                            <div className="bg-gray-50/80 border-t border-gray-100">
                                              {invoiceItems.length > 0 ? (
                                                <div className="divide-y divide-gray-100/80">
                                                  {invoiceItems.map(item => (
                                                    <div key={item.id} className="grid grid-cols-[auto_1fr_auto] gap-4 pl-16 pr-6 py-2 text-sm">
                                                      <div />
                                                      <p className="text-gray-700 truncate">{item.description}</p>
                                                      <p className="text-gray-600 text-right whitespace-nowrap">
                                                        {item.quantity}× ${(item.unit_price || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} = ${(item.total || (item.quantity * (item.unit_price || 0)) || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                      </p>
                                                    </div>
                                                  ))}
                                                </div>
                                              ) : (
                                                <p className="text-sm text-gray-400 text-center py-4">No line items available</p>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </TabsContent>

        <TabsContent value="services">
          <CustomerServicesTab
            customerId={customerId}
            customer={customer}
            contacts={contacts}
            lineItems={activeLineItems}
            expandedBills={expandedBills}
            setExpandedBills={setExpandedBills}
            isSyncing={isSyncing}
            setIsSyncing={setIsSyncing}
            queryClient={queryClient}
            devices={devices}
          />
        </TabsContent>

        <TabsContent value="m365">
          <M365Tab customerId={customerId} queryClient={queryClient} />
        </TabsContent>

        <TabsContent value="licenses">
          <div className="space-y-6">
            {/* Stats Widgets Row */}
            {(() => {
              const totalSpend = licenses.reduce((sum, l) => sum + (l.total_cost || 0), 0);
              // Only count seats from managed licenses (not per_user)
              const managedLicenses = licenses.filter(l => l.management_type === 'managed');
              const totalSeats = managedLicenses.reduce((sum, l) => sum + (l.quantity || 0), 0);
              // Only count assignments for managed licenses
              const managedLicenseIds = managedLicenses.map(l => l.id);
              const assignedSeats = licenseAssignments.filter(a => a.status === 'active' && managedLicenseIds.includes(a.license_id)).length;
              const unusedSeats = totalSeats - assignedSeats;
              const utilizationRate = totalSeats > 0 ? Math.min(100, (assignedSeats / totalSeats) * 100) : 0;
              const wastedSpend = totalSeats > 0 ? (unusedSeats / totalSeats) * totalSpend : 0;
              return (
                <>
                  {/* Stat Cards Row */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {/* Spend Analysis */}
                    <Link
                      to={createPageUrl(`SpendAnalysis?customerId=${customerId}`)}
                      className="bg-gradient-to-br from-slate-700 to-slate-900 rounded-xl border-2 border-slate-600 p-4 text-left transition-all hover:shadow-lg hover:from-slate-600 hover:to-slate-800 group block"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-white/20">
                          <DollarSign className="w-4 h-4 text-white" />
                        </div>
                        <span className="text-xs text-slate-300 font-medium">Spend Analysis</span>
                      </div>
                      <p className="text-sm font-semibold text-white mt-1">View Monthly & Yearly</p>
                      <p className="text-[10px] text-slate-300 mt-0.5">Click to see breakdown →</p>
                    </Link>
                    
                    {/* Utilization */}
                    <button
                      onClick={() => { setSaasFilter('all'); setSaasView('licenses'); }}
                      className={cn(
                        "bg-white rounded-xl border-2 p-4 text-left transition-all hover:shadow-md group",
                        saasFilter === 'all' && saasView === 'licenses' ? "border-slate-400 shadow-md" : "border-slate-200 hover:border-slate-300"
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center", saasFilter === 'all' && saasView === 'licenses' ? "bg-blue-100" : "bg-slate-100 group-hover:bg-blue-50")}>
                          <Monitor className={cn("w-4 h-4", saasFilter === 'all' && saasView === 'licenses' ? "text-blue-600" : "text-slate-500 group-hover:text-blue-500")} />
                        </div>
                        <span className="text-xs text-slate-500">Utilization</span>
                      </div>
                      <p className="text-xl font-bold text-slate-900">{utilizationRate.toFixed(0)}%</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{assignedSeats}/{totalSeats} seats</p>
                    </button>

                    {/* By User */}
                    <button
                      onClick={() => setSaasView('users')}
                      className={cn(
                        "bg-white rounded-xl border-2 p-4 text-left transition-all hover:shadow-md group",
                        saasView === 'users' ? "border-slate-400 shadow-md" : "border-slate-200 hover:border-slate-300"
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center", saasView === 'users' ? "bg-emerald-100" : "bg-slate-100 group-hover:bg-emerald-50")}>
                          <Users className={cn("w-4 h-4", saasView === 'users' ? "text-emerald-600" : "text-slate-500 group-hover:text-emerald-500")} />
                        </div>
                        <span className="text-xs text-slate-500">By User</span>
                      </div>
                      <p className="text-xl font-bold text-slate-900">{contacts.length}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">team members</p>
                    </button>
                  </div>

                  {/* Filters & Add Button Row */}
                  <div className="flex items-center gap-3">
                    {saasView === 'users' && (
                      <select
                        value={saasUserFilter}
                        onChange={(e) => setSaasUserFilter(e.target.value)}
                        className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white min-w-[180px]"
                      >
                        <option value="">All Team Members</option>
                        {contacts.map(c => (
                          <option key={c.id} value={c.id}>{c.full_name}</option>
                        ))}
                      </select>
                    )}
                    <div className="flex-1" />
                    <Button 
                      size="sm" 
                      className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => setShowAddSoftware(true)}
                    >
                      <Plus className="w-4 h-4" />
                      Add Software
                    </Button>
                  </div>
                </>
              );
            })()}

            {/* Conditional Views */}
            {saasView === 'licenses' && (
              <div className="space-y-6">
                {/* Software Cards - Grouped View (excluding JumpCloud apps if they have their own section) */}
                <div className="bg-white rounded-2xl border border-slate-200/50 overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-100">
                    <h3 className="font-semibold text-slate-900">Software & Licenses</h3>
                    <p className="text-sm text-slate-500">
                      {Object.entries(groupedSoftware).filter(([_, data]) => 
                        !jumpcloudMapping || (data.software.source !== 'jumpcloud' && data.software.vendor?.toLowerCase() !== 'jumpcloud')
                      ).length} applications
                    </p>
                  </div>
                  {(() => {
                    const nonJumpcloudApps = Object.entries(groupedSoftware).filter(([_, data]) => 
                      !jumpcloudMapping || (data.software.source !== 'jumpcloud' && data.software.vendor?.toLowerCase() !== 'jumpcloud')
                    );
                    
                    if (nonJumpcloudApps.length === 0) {
                      return (
                        <div className="p-12 text-center">
                          <Cloud className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                          <p className="text-slate-500 mb-3">No software added yet</p>
                          <Button 
                            onClick={() => setShowAddSoftware(true)}
                            className="bg-emerald-600 hover:bg-emerald-700"
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            Add Software
                          </Button>
                        </div>
                      );
                    }
                    
                    return (
                      <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                        {nonJumpcloudApps
                          .filter(([_, data]) => {
                            // Apply category filter
                            if (saasCategoryFilter && data.software.category !== saasCategoryFilter) return false;
                            return true;
                          })
                          .map(([appName, data]) => {
                            const managedAssignments = data.managedLicense 
                              ? licenseAssignments.filter(a => a.license_id === data.managedLicense.id && a.status === 'active')
                              : [];
                            const individualAssignments = data.individualLicenses.flatMap(l => 
                              licenseAssignments.filter(a => a.license_id === l.id && a.status === 'active')
                            );
                            
                            return (
                              <SoftwareCard 
                                key={appName}
                                software={data.software}
                                managedLicense={data.managedLicense}
                                individualLicenses={data.individualLicenses}
                                managedAssignments={managedAssignments}
                                individualAssignments={individualAssignments}
                                isCatalogOnly={data.isCatalogOnly}
                              />
                            );
                          })}
                      </div>
                    );
                  })()}
                </div>

                {/* JumpCloud SSO Applications - Collapsible */}
                {jumpcloudMapping && (() => {
                  const jumpcloudApps = Object.entries(groupedSoftware).filter(([_, data]) => 
                    data.software.source === 'jumpcloud' || data.software.vendor?.toLowerCase() === 'jumpcloud'
                  );
                  if (jumpcloudApps.length === 0) return null;
                  
                  const totalUsers = jumpcloudApps.reduce((sum, [_, data]) => {
                    const managedAssignments = data.managedLicense 
                      ? licenseAssignments.filter(a => a.license_id === data.managedLicense.id && a.status === 'active').length
                      : 0;
                    const individualAssignments = data.individualLicenses.reduce((s, l) => 
                      s + licenseAssignments.filter(a => a.license_id === l.id && a.status === 'active').length, 0);
                    return sum + managedAssignments + individualAssignments;
                  }, 0);
                  
                  return (
                    <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl border border-emerald-200 overflow-hidden">
                      <button 
                        onClick={() => setJumpcloudSsoExpanded(!jumpcloudSsoExpanded)}
                        className="w-full px-4 py-3 flex items-center justify-between hover:bg-emerald-100/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                            <Shield className="w-4 h-4 text-emerald-600" />
                          </div>
                          <div className="text-left">
                            <p className="font-medium text-slate-900">JumpCloud SSO Applications</p>
                            <p className="text-xs text-emerald-700">{jumpcloudApps.length} apps • {totalUsers} total assignments</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs">Auto-synced</Badge>
                          <ChevronDown className={cn("w-4 h-4 text-emerald-600 transition-transform", jumpcloudSsoExpanded && "rotate-180")} />
                        </div>
                      </button>
                      {jumpcloudSsoExpanded && (
                        <div className="p-4 pt-0 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                          {jumpcloudApps.map(([appName, data]) => {
                            const managedAssignments = data.managedLicense 
                              ? licenseAssignments.filter(a => a.license_id === data.managedLicense.id && a.status === 'active')
                              : [];
                            const individualAssignments = data.individualLicenses.flatMap(l => 
                              licenseAssignments.filter(a => a.license_id === l.id && a.status === 'active')
                            );
                            const appTotalUsers = managedAssignments.length + individualAssignments.length;
                            
                            return (
                              <Link 
                                key={appName}
                                to={createPageUrl(`LicenseDetail?id=${data.software.id}`)}
                                className="flex items-center gap-3 p-3 bg-white rounded-xl border border-emerald-100 hover:border-emerald-300 hover:shadow-md transition-all group"
                              >
                                <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center overflow-hidden flex-shrink-0">
                                  {data.software.logo_url ? (
                                    <img src={data.software.logo_url} alt={appName} className="w-8 h-8 object-contain" />
                                  ) : (
                                    <Cloud className="w-5 h-5 text-emerald-600" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-slate-900 truncate group-hover:text-emerald-700 transition-colors">{appName}</p>
                                  <p className="text-xs text-slate-500">JumpCloud SSO</p>
                                </div>
                                <Badge variant="outline" className="text-[10px] border-emerald-200 text-emerald-700 flex-shrink-0">
                                  <Users className="w-3 h-3 mr-1" />
                                  {appTotalUsers}
                                </Badge>
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* User-centric View */}
            {saasView === 'users' && (
              <div className="bg-white rounded-2xl border border-slate-200/50 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100">
                  <h3 className="font-semibold text-slate-900">Licenses by User</h3>
                  <p className="text-sm text-slate-500">See what software each team member has access to</p>
                </div>
                <div className="divide-y divide-slate-100">
                  {contacts
                    .filter(c => !saasUserFilter || c.id === saasUserFilter)
                    .map(contact => {
                      const userAssignments = licenseAssignments.filter(a => a.contact_id === contact.id && a.status === 'active');
                      const userLicenses = userAssignments.map(a => {
                        const license = licenses.find(l => l.id === a.license_id);
                        if (license) {
                          return { ...license, assignment: a };
                        }
                        return null;
                      }).filter(Boolean);
                      
                      // Check for duplicate apps (both managed and individual license for same software)
                      const appCounts = {};
                      userLicenses.forEach(l => {
                        appCounts[l.application_name] = (appCounts[l.application_name] || 0) + 1;
                      });
                      const duplicateApps = Object.keys(appCounts).filter(app => appCounts[app] > 1);
                      
                      // Calculate total cost per user
                      const totalCost = userLicenses.reduce((sum, l) => {
                        // For per_user licenses, use the assignment's cost_per_license or license cost
                        if (l.management_type === 'per_user') {
                          return sum + (l.assignment?.cost_per_license || l.cost_per_license || 0);
                        }
                        // For managed licenses, calculate per-seat cost
                        const perSeatCost = l.quantity > 0 ? (l.total_cost || 0) / l.quantity : (l.cost_per_license || 0);
                        return sum + perSeatCost;
                      }, 0);
                      
                      return (
                        <div key={contact.id} className="p-5">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 font-medium">
                                {contact.full_name?.charAt(0) || '?'}
                              </div>
                              <div>
                                <p className="font-semibold text-slate-900">{contact.full_name}</p>
                                <p className="text-sm text-slate-500">{contact.email || contact.title || 'No email'}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-slate-900">{userLicenses.length} licenses</p>
                              <p className="text-sm text-slate-500">${totalCost.toFixed(2)}/mo</p>
                            </div>
                          </div>
                          
                          {/* Duplicate License Warning */}
                          {duplicateApps.length > 0 && (
                            <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                              <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                              <div>
                                <p className="text-sm font-medium text-amber-800">Potential duplicate licenses</p>
                                <p className="text-xs text-amber-700">
                                  {duplicateApps.join(', ')} - User has both managed and individual licenses. Consider consolidating to save costs.
                                </p>
                              </div>
                            </div>
                          )}
                          
                          {userLicenses.length > 0 ? (
                            <div className="space-y-2">
                              {userLicenses.map(license => {
                                const isDuplicate = duplicateApps.includes(license.application_name);
                                const userCost = license.management_type === 'per_user' 
                                  ? (license.assignment?.cost_per_license || license.cost_per_license || 0)
                                  : (license.quantity > 0 ? (license.total_cost || 0) / license.quantity : (license.cost_per_license || 0));
                                
                                return (
                                  <Link
                                    key={`${license.id}-${license.assignment?.id}`}
                                    to={createPageUrl(`LicenseDetail?id=${license.id}`)}
                                    className={cn(
                                      "flex items-center gap-3 p-3 rounded-lg transition-colors",
                                      isDuplicate 
                                        ? "bg-amber-50 border border-amber-200 hover:bg-amber-100" 
                                        : "bg-slate-50 hover:bg-slate-100"
                                    )}
                                  >
                                    <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center overflow-hidden flex-shrink-0 border border-slate-200">
                                      {license.logo_url ? (
                                        <img src={license.logo_url} alt="" className="w-6 h-6 object-contain" />
                                      ) : (
                                        <Cloud className="w-4 h-4 text-slate-600" />
                                      )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <p className="font-medium text-slate-900 truncate">{license.application_name}</p>
                                        {isDuplicate && (
                                          <AlertCircle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                                        )}
                                      </div>
                                      <div className="flex items-center gap-2 text-xs text-slate-500">
                                        <span>{license.license_type || 'Standard'}</span>
                                        <span>•</span>
                                        <Badge variant="outline" className={cn(
                                          "text-[10px] py-0",
                                          license.management_type === 'managed' 
                                            ? "border-blue-200 text-blue-700 bg-blue-50" 
                                            : "border-purple-200 text-purple-700 bg-purple-50"
                                        )}>
                                          {license.management_type === 'managed' ? 'Managed' : 'Individual'}
                                        </Badge>
                                      </div>
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                      <p className="font-semibold text-slate-900">${userCost.toFixed(2)}</p>
                                      <p className="text-[10px] text-slate-500">/month</p>
                                    </div>
                                  </Link>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="text-sm text-slate-400">No licenses assigned</p>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Spend Analysis View */}
            {saasView === 'spend' && (
              <div className="space-y-4">
                <div className="bg-white rounded-2xl border border-slate-200/50 p-6">
                  <h3 className="font-semibold text-slate-900 mb-4">Spend Analysis</h3>
                  <div className="space-y-3">
                    {licenses
                      .sort((a, b) => (b.total_cost || 0) - (a.total_cost || 0))
                      .map(license => {
                        const totalSpend = licenses.reduce((sum, l) => sum + (l.total_cost || 0), 0);
                        const percentage = totalSpend > 0 ? ((license.total_cost || 0) / totalSpend) * 100 : 0;
                        const assignedCount = licenseAssignments.filter(a => a.license_id === license.id && a.status === 'active').length;
                        const unusedSeats = (license.quantity || 0) - assignedCount;
                        const wastedCost = license.quantity > 0 ? (unusedSeats / license.quantity) * (license.total_cost || 0) : 0;
                        
                        return (
                          <button
                            key={license.id}
                            onClick={() => setSelectedLicense(license)}
                            className="w-full flex items-center gap-4 p-3 rounded-xl hover:bg-slate-50 transition-colors text-left"
                          >
                            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                              {license.logo_url ? (
                                <img src={license.logo_url} alt={license.application_name} className="w-8 h-8 object-contain" />
                              ) : (
                                <Cloud className="w-5 h-5 text-purple-600" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1">
                                <p className="font-medium text-slate-900 truncate">{license.application_name}</p>
                                <p className="font-semibold text-slate-900">${(license.total_cost || 0).toLocaleString()}/mo</p>
                              </div>
                              <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-purple-500 rounded-full"
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                              <div className="flex items-center justify-between mt-1">
                                <span className="text-xs text-slate-500">{percentage.toFixed(1)}% of total spend</span>
                                {wastedCost > 0 && (
                                  <span className="text-xs text-red-500">${wastedCost.toFixed(0)} unused</span>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                  </div>
                </div>
                
                {/* Cost Optimization Tips */}
                <div className="bg-gradient-to-r from-slate-50 to-blue-50 rounded-2xl border border-slate-200 p-6">
                  <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                    <HelpCircle className="w-5 h-5" />
                    Cost Optimization Insights
                  </h3>
                  <div className="space-y-2 text-sm text-slate-700">
                    {(() => {
                      const totalUnused = licenses.reduce((sum, l) => {
                        const assigned = licenseAssignments.filter(a => a.license_id === l.id && a.status === 'active').length;
                        const unused = (l.quantity || 0) - assigned;
                        return sum + (l.quantity > 0 ? (unused / l.quantity) * (l.total_cost || 0) : 0);
                      }, 0);
                      const underutilized = licenses.filter(l => {
                        const assigned = licenseAssignments.filter(a => a.license_id === l.id && a.status === 'active').length;
                        return l.quantity > 0 && (assigned / l.quantity) < 0.5;
                      });
                      
                      return (
                        <>
                          {totalUnused > 0 && (
                            <p>• You could save up to <strong>${totalUnused.toFixed(0)}/mo</strong> by rightsizing unused seats</p>
                          )}
                          {underutilized.length > 0 && (
                            <p>• {underutilized.length} application{underutilized.length > 1 ? 's have' : ' has'} less than 50% utilization</p>
                          )}
                          <p>• Review licenses before renewal to avoid auto-renewals on unused subscriptions</p>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Modals */}
          <LicenseAssignmentModal
            open={!!selectedLicense}
            onClose={() => setSelectedLicense(null)}
            license={selectedLicense}
            contacts={contacts}
            assignments={licenseAssignments}
            onAssign={handleAssignLicense}
            onRevoke={handleRevokeLicense}
          />
          <AddLicenseModal
            open={showAddLicense}
            onClose={() => setShowAddLicense(false)}
            onSave={handleAddLicense}
            customerId={customerId}
          />
          <AddSoftwareModal
            open={showAddSoftware}
            onClose={() => setShowAddSoftware(false)}
            onSave={handleAddSoftware}
            customerId={customerId}
          />
          <AddContactModal
            open={showAddContact}
            onClose={() => setShowAddContact(false)}
            onSave={handleAddContact}
            customerId={customerId}
          />
        </TabsContent>

        <TabsContent value="quotes">
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200/50 p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-semibold text-slate-900">Quotes</h3>
                <Button size="sm" className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                  <Plus className="w-4 h-4" />
                  New Quote
                </Button>
              </div>
              {quotes.length === 0 ? (
                <div className="p-12 text-center">
                  <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">No quotes found</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {quotes.map((quote) => {
                    const quoteLineItems = quoteItems.filter(item => item.quote_id === quote.id);
                    const isExpanded = expandedQuotes[quote.id];
                    return (
                      <div key={quote.id} className="border border-slate-100 rounded-lg overflow-hidden">
                        <button
                          onClick={() => setExpandedQuotes(prev => ({ ...prev, [quote.id]: !prev[quote.id] }))}
                          className="w-full px-4 py-4 flex items-start justify-between hover:bg-slate-50 transition-colors"
                        >
                          <div className="flex-1 text-left">
                            <div className="flex items-center gap-3 mb-2">
                              <span className="font-semibold text-slate-900">{quote.title || quote.quote_number}</span>
                              <Badge className={cn(
                                "capitalize text-xs",
                                quote.status === 'accepted' && "bg-emerald-100 text-emerald-700",
                                quote.status === 'sent' && "bg-blue-100 text-blue-700",
                                quote.status === 'draft' && "bg-slate-100 text-slate-700",
                                quote.status === 'rejected' && "bg-red-100 text-red-700",
                                quote.status === 'expired' && "bg-yellow-100 text-yellow-700"
                              )}>
                                {quote.status}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-slate-600">
                              <span>Quote #{quote.quote_number}</span>
                              {quote.quote_date && (
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  {safeFormatDate(quote.quote_date, 'MM/dd/yyyy')}
                                </span>
                              )}
                              {quote.expiry_date && (
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  Expires: {safeFormatDate(quote.expiry_date, 'MM/dd/yyyy')}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <p className="font-semibold text-slate-900">
                              ${(quote.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </p>
                            <ChevronDown className={cn("w-4 h-4 text-slate-400 transition-transform", isExpanded && "rotate-180")} />
                          </div>
                        </button>
                        {isExpanded && quoteLineItems.length > 0 && (
                          <div className="bg-slate-50 border-t border-slate-100 px-4 py-3">
                            <div className="space-y-3">
                              {quoteLineItems.map(item => (
                                <div key={item.id} className="flex justify-between items-start text-sm">
                                  <div className="flex-1">
                                    <p className="text-slate-900 font-medium">{item.description}</p>
                                    <p className="text-xs text-slate-500 mt-1">
                                      {item.quantity} × ${(item.unit_price || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                    </p>
                                  </div>
                                  <p className="font-semibold text-slate-900">
                                    ${(item.total_price || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

                      <TabsContent value="tickets">
                                      <div className="space-y-6">
                                      <div className="bg-white rounded-2xl border border-slate-200/50 p-6">
                          <div className="flex items-center justify-between mb-6">
                            <div>
                              <h3 className="text-lg font-semibold text-slate-900">Support Tickets</h3>
                              <p className="text-sm text-slate-500">
                                {tickets.filter(t => ['open', 'in_progress', 'new'].includes(t.status)).length} open • {tickets.filter(t => ['closed', 'resolved'].includes(t.status)).length} resolved
                              </p>
                            </div>
                            <div className="flex items-center gap-3">
                              <select
                                value={ticketFilter}
                                onChange={(e) => { setTicketFilter(e.target.value); setTicketPage(1); }}
                                className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-slate-400"
                              >
                                <option value="all">All Tickets</option>
                                <option value="open">Open</option>
                                <option value="in_progress">In Progress</option>
                                <option value="waiting">Waiting</option>
                                <option value="resolved">Resolved</option>
                                <option value="closed">Closed</option>
                              </select>
                            </div>
                          </div>

                          {tickets.length === 0 ? (
                            <div className="py-12 text-center">
                              <Monitor className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                              <p className="text-slate-500">No tickets found</p>
                              {customer?.source === 'halopsa' && (
                                <p className="text-sm text-slate-400 mt-1">Click "Sync" to pull from HaloPSA</p>
                              )}
                            </div>
                          ) : (
                            <>
                              <div className="space-y-2">
                                {tickets
                                  .filter(t => ticketFilter === 'all' || t.status === ticketFilter)
                                  .sort((a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0))
                                  .slice((ticketPage - 1) * 10, ticketPage * 10)
                                  .map(ticket => (
                                    <div key={ticket.id} className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors">
                                      <div className={cn(
                                        "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
                                        ticket.priority === 'critical' && "bg-red-100",
                                        ticket.priority === 'high' && "bg-orange-100",
                                        ticket.priority === 'medium' && "bg-yellow-100",
                                        ticket.priority === 'low' && "bg-blue-100",
                                        !ticket.priority && "bg-slate-100"
                                      )}>
                                        <Monitor className={cn(
                                          "w-5 h-5",
                                          ticket.priority === 'critical' && "text-red-600",
                                          ticket.priority === 'high' && "text-orange-600",
                                          ticket.priority === 'medium' && "text-yellow-600",
                                          ticket.priority === 'low' && "text-blue-600",
                                          !ticket.priority && "text-slate-500"
                                        )} />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-slate-900 truncate">
                                          #{ticket.external_id} - {ticket.subject}
                                        </p>
                                        <div className="flex items-center gap-2 mt-1 text-sm text-slate-500">
                                          {ticket.contact_name && (
                                            <span>By: {ticket.contact_name}</span>
                                          )}
                                          {ticket.contact_name && ticket.assigned_to && <span>•</span>}
                                          {ticket.assigned_to && (
                                            <span className="text-purple-600 font-medium">
                                              Tech: {ticket.assigned_to}
                                            </span>
                                          )}
                                          {(ticket.contact_name || ticket.assigned_to) && ticket.created_date && <span>•</span>}
                                          {ticket.created_date && (
                                            <span>{safeFormatDate(ticket.created_date, 'MMM d, yyyy')}</span>
                                          )}
                                        </div>
                                      </div>
                                      <Badge className={cn(
                                        'text-xs capitalize flex-shrink-0',
                                        ticket.status === 'new' && 'bg-purple-100 text-purple-700',
                                        ticket.status === 'open' && 'bg-yellow-100 text-yellow-700',
                                        ticket.status === 'in_progress' && 'bg-blue-100 text-blue-700',
                                        ticket.status === 'waiting' && 'bg-orange-100 text-orange-700',
                                        ticket.status === 'resolved' && 'bg-emerald-100 text-emerald-700',
                                        ticket.status === 'closed' && 'bg-slate-100 text-slate-700'
                                      )}>
                                        {ticket.status?.replace('_', ' ')}
                                      </Badge>
                                    </div>
                                  ))}
                              </div>
                              {tickets.filter(t => ticketFilter === 'all' || t.status === ticketFilter).length > 10 && (
                                <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t border-slate-100">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setTicketPage(p => Math.max(1, p - 1))}
                                    disabled={ticketPage === 1}
                                  >
                                    Previous
                                  </Button>
                                  <span className="text-sm text-slate-600 px-3">
                                    Page {ticketPage} of {Math.ceil(tickets.filter(t => ticketFilter === 'all' || t.status === ticketFilter).length / 10)}
                                  </span>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setTicketPage(p => Math.min(Math.ceil(tickets.filter(t => ticketFilter === 'all' || t.status === ticketFilter).length / 10), p + 1))}
                                    disabled={ticketPage >= Math.ceil(tickets.filter(t => ticketFilter === 'all' || t.status === ticketFilter).length / 10)}
                                  >
                                    Next
                                  </Button>
                                  </div>
                                  )}
                                  </>
                                  )}
                                  </div>
                                  </div>
                                  </TabsContent>




                                  </Tabs>
                      </div>
                      );
                      }