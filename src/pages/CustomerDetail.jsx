import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { client, resolveFileUrl } from '@/api/client';
import { toast } from 'sonner';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { useAutoRetry } from '@/hooks/useAutoRetry';
import { createPageUrl } from '../utils';
import { motion } from 'framer-motion';
import { fadeInUp } from '@/lib/motion';
import Breadcrumbs from '../components/ui/breadcrumbs';
import {
  Building2,
  Mail,
  Phone,
  MapPin,
  Users,
  Monitor,
  FileText,
  Cloud,
  DollarSign,
  RefreshCw,
  Plus,
  ChevronDown,
  HelpCircle,
  AlertCircle,
  BarChart3,
  Shield,
  Loader2,
  Camera
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonStats, SkeletonTable } from "@/components/ui/shimmer-skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
// date-fns calls replaced by safe wrappers from @/lib/utils
import LicenseAssignmentModal from '../components/saas/LicenseAssignmentModal';
import AddLicenseModal from '../components/saas/AddLicenseModal';
import AddSoftwareModal from '../components/saas/AddSoftwareModal';
import SoftwareCard from '../components/saas/SoftwareCard';
import AddContactModal from '../components/saas/AddContactModal';
import CustomerBillingTab from '../components/customer/CustomerBillingTab';
import CustomerServicesTab from '../components/customer/CustomerServicesTab';
import CustomerDashboardTab from '../components/customer/CustomerDashboardTab';
import CustomerQuotesTab from '../components/customer/CustomerQuotesTab';
import CustomerTicketsTab from '../components/customer/CustomerTicketsTab';
import CustomerMap from '../components/customer/CustomerMap';
import M365Tab from '../components/customer/M365Tab';
import { Eye } from 'lucide-react';
import { isCustomerPortal } from '@/lib/portal-mode';

export default function CustomerDetail({ mirrorMode = false, previewCustomerId = null }) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedLicense, setSelectedLicense] = useState(null);
  const [showAddLicense, setShowAddLicense] = useState(false);
  const [showAddSoftware, setShowAddSoftware] = useState(false);
  const [showAddContact, setShowAddContact] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [failedCustomerLogoUrl, setFailedCustomerLogoUrl] = useState(null);
  const logoInputRef = useRef(null);
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const customerIdParam = searchParams.get('id');
  const rawTab = searchParams.get('tab') || 'dashboard';
  const currentTab = rawTab === 'requests' ? 'tickets' : rawTab;
  const { user, isLoadingAuth: userLoading } = useAuth();

  // Security: customer portal users can ONLY access their own customer; staff (admin + sales) can browse any
  const isAdminUser = user?.role === 'admin';
  const isStaffUser = user?.role === 'admin' || user?.role === 'sales';
  const isCustomerView = mirrorMode || isCustomerPortal || !isStaffUser;
  const canUseAdminActions = isAdminUser && !isCustomerView;
  const resolvedCustomerId = mirrorMode && isStaffUser
    ? previewCustomerId
    : (!isStaffUser || isCustomerPortal)
    ? user?.customer_id   // customers always scoped to their own data
    : (customerIdParam || user?.customer_id || null);  // staff can browse any customer

  const handleTabChange = (tab) => {
    const page = mirrorMode ? 'CustomerPortalPreview' : 'CustomerDetail';
    const id = resolvedCustomerId || customerIdParam || '';
    navigate(createPageUrl(`${page}?id=${id}&tab=${tab}`), { replace: true });
  };

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
      return (results ?? [])[0] || null;
    },
    enabled: !!resolvedCustomerId,
  });

  useEffect(() => {
    setFailedCustomerLogoUrl(null);
  }, [customer?.logo_url]);

  const customerId = resolvedCustomerId;

  // Service tag integration mappings
  const SERVICE_TAG_MAPPINGS = [
    { key: 'spanning', label: 'Spanning', entity: 'SpanningMapping', dot: 'bg-purple-500', text: 'text-purple-700 dark:text-purple-300', mark: 'SP', badge: 'bg-purple-600' },
    { key: 'jumpcloud', label: 'JumpCloud', entity: 'JumpCloudMapping', dot: 'bg-green-500', text: 'text-green-700 dark:text-green-300', mark: 'JC', badge: 'bg-green-600' },
    { key: 'datto', label: 'RMM', entity: 'DattoSiteMapping', dot: 'bg-blue-500', text: 'text-blue-700 dark:text-blue-300', mark: 'D', badge: 'bg-blue-600' },
    { key: 'edr', label: 'EDR', entity: 'DattoEDRMapping', dot: 'bg-cyan-500', text: 'text-cyan-700 dark:text-cyan-300', mark: 'E', badge: 'bg-cyan-600' },
    { key: 'rocketcyber', label: 'SOC', entity: 'RocketCyberMapping', dot: 'bg-orange-500', text: 'text-orange-700 dark:text-orange-300', mark: 'RC', badge: 'bg-orange-600' },
    { key: 'unifi', label: 'Firewall', entity: 'UniFiMapping', dot: 'bg-sky-500', text: 'text-sky-700 dark:text-sky-300', mark: 'UF', badge: 'bg-sky-600' },
    { key: 'threecx', label: 'VoIP', entity: 'ThreeCXReport', dot: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-300', mark: '3C', badge: 'bg-emerald-600' },
    { key: 'dmarc', label: 'DMARC', entity: 'DmarcReportMapping', dot: 'bg-teal-500', text: 'text-teal-700 dark:text-teal-300', mark: 'DM', badge: 'bg-teal-600' },
    { key: 'saas_alerts', label: 'SaaS Alerts', entity: 'SaaSAlertsMapping', dot: 'bg-violet-500', text: 'text-violet-700 dark:text-violet-300', mark: 'SA', badge: 'bg-violet-600' },
    { key: 'pax8', label: 'M365', entity: 'Pax8Mapping', dot: 'bg-pink-500', text: 'text-pink-700 dark:text-pink-300', mark: 'M', badge: 'bg-pink-600' },
    { key: 'cove', label: 'Backup', entity: 'CoveDataMapping', dot: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-300', mark: 'CV', badge: 'bg-amber-600' },
    { key: 'cipp', label: 'CIPP', entity: 'CIPPMapping', dot: 'bg-sky-600', text: 'text-sky-700 dark:text-sky-300', mark: 'CP', badge: 'bg-sky-700' },
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
        tags.push({ key: svc.key, label: svc.label, dot: svc.dot, text: svc.text, mark: svc.mark, badge: svc.badge });
      }
    }
    return tags;
  }, [serviceMappingsData]);

  // Shared query options: cache 5 min, retry twice, fail fast
  const qOpts = { staleTime: 1000 * 60 * 5, retry: 2 };

  const { data: contracts = [], isLoading: loadingContracts } = useQuery({
    queryKey: ['contracts', customerId],
    queryFn: () => client.entities.Contract.filter({ customer_id: customerId }),
    enabled: !!customerId, ...qOpts
  });

  const { data: devices = [], isLoading: loadingDevices } = useQuery({
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

  const { data: recurringBills = [], isLoading: loadingRecurringBills } = useQuery({
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

  const { data: contacts = [], isLoading: loadingContacts } = useQuery({
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

  const autoRetryData = useMemo(
    () => [contacts, recurringBills, contracts, devices],
    [contacts, recurringBills, contracts, devices]
  );
  const autoRetryKeys = useMemo(
    () => [['contacts', customerId], ['recurring_bills', customerId], ['contracts', customerId], ['devices', customerId]],
    [customerId]
  );
  const isCoreDataLoading = loadingCustomer || loadingContacts || loadingRecurringBills || loadingContracts || loadingDevices;

  // Auto-retry only after the core customer datasets finish their first load.
  useAutoRetry(autoRetryData, isCoreDataLoading, autoRetryKeys);

  const { data: haloLocations = [] } = useQuery({
    queryKey: ['halopsa-sites', customerId],
    queryFn: async () => {
      const result = await client.integrations.halo.listCustomerSites(customerId);
      return result.locations || [];
    },
    enabled: !!customerId && customer?.source === 'halopsa',
    staleTime: 1000 * 60 * 30,
    retry: 1,
  });

  const mapAddresses = useMemo(() => {
    const siteAddresses = [...new Set(
      (haloLocations || [])
        .map(location => location?.address)
        .filter(Boolean)
    )];
    return siteAddresses.length > 0 ? siteAddresses : (customer?.address ? [customer.address] : []);
  }, [haloLocations, customer?.address]);

  // Fetch JumpCloud mapping for this customer
  const { data: jumpcloudMapping } = useQuery({
    queryKey: ['jumpcloud-mapping', customerId],
    queryFn: async () => {
      const mappings = await client.entities.JumpCloudMapping.filter({ customer_id: customerId });
      return (mappings ?? [])[0] || null;
    },
    enabled: !!customerId, ...qOpts
  });

  // Fetch Spanning mapping for this customer
  const { data: spanningMapping } = useQuery({
    queryKey: ['spanning-mapping', customerId],
    queryFn: async () => {
      const mappings = await client.entities.SpanningMapping.filter({ customer_id: customerId });
      return (mappings ?? [])[0] || null;
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
        { entity: 'DattoEDRMapping',    fn: 'syncDattoEDR',           action: 'sync_customer',  label: 'Datto EDR' },
        { entity: 'CoveDataMapping',    fn: 'syncCoveData',           action: 'sync_devices',   label: 'Cove' },
        { entity: 'RocketCyberMapping', fn: 'syncRocketCyber',        action: 'sync_agents',    label: 'RocketCyber' },
        { entity: 'SaaSAlertsMapping',  fn: 'syncSaaSAlerts',         action: 'sync_alerts',    label: 'SaaS Alerts' },
        { entity: 'UniFiMapping',       fn: 'syncUniFiDevices',       action: 'sync_devices',   label: 'UniFi' },
        { entity: 'Pax8Mapping',        fn: 'syncPax8Subscriptions',  action: 'sync_subscriptions', label: 'Pax8' },
        { entity: 'DmarcReportMapping', fn: 'syncDmarcReport',        action: 'sync_customer',  label: 'DMARC' },
        { entity: 'CIPPMapping',        fn: 'syncCIPP',               action: 'sync_customer',      label: 'CIPP',  extraParams: true },
      ];

      const mappingResults = await Promise.all(
        integrationChecks.map(({ entity }) =>
          client.entities[entity].filter({ customer_id: customerId }).catch(() => [])
        )
      );

      integrationChecks.forEach(({ fn, action, label, extraParams }, idx) => {
        const mappingResult = mappingResults[idx] ?? [];
        if (mappingResult.length > 0) {
          const params = { action, customer_id: customerId };
          // CIPP needs customerId + tenantId from the mapping
          if (extraParams && fn === 'syncCIPP') {
            const mapping = mappingResult[0];
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
        'line_items', 'spanning-mapping', 'rocketcyber-mapping',
        'rocketcyber_incidents', 'dmarc-mapping', 'dmarc-cached',
        'cove-mapping', 'cove-cached', 'saas-alerts-mapping',
        'saas-alerts-cached',
        'customer-contacts',
      ];
      for (const key of keys) {
        queryClient.invalidateQueries({ queryKey: [key, customerId] });
      }
      queryClient.invalidateQueries({ queryKey: ['rocketcyber_mappings'] });
      queryClient.invalidateQueries({ queryKey: ['dmarc_report_mappings'] });
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

  const customerLogoUrl = customer.logo_url ? resolveFileUrl(customer.logo_url) : null;
  const showCustomerLogo = customerLogoUrl && failedCustomerLogoUrl !== customerLogoUrl;
  const hideCustomerHeroOnMobile = isCustomerView && currentTab !== 'dashboard';
  const monthlyBillIds = new Set(
    recurringBills
      .filter(b => activeBillIdSet.has(b.id) && !['yearly', 'annual', 'annually'].includes((b.frequency || '').toLowerCase()))
      .map(b => b.id)
  );
  const monthlyBilling = activeLineItems
    .filter(item => monthlyBillIds.has(item.recurring_bill_id))
    .reduce((sum, item) => sum + (Number(item.net_amount ?? item.total ?? item.amount) || 0), 0);
  const pastDueInvoices = invoices.filter(i => (i.status || '').toLowerCase() === 'overdue');
  const pastDueBalance = pastDueInvoices
    .reduce((sum, inv) => sum + (Number(inv.amount_due ?? inv.total ?? inv.amount) || 0), 0);
  const openBalance = invoices
    .filter(i => ['overdue', 'pending', 'sent', 'open', 'unpaid'].includes((i.status || '').toLowerCase()))
    .reduce((sum, inv) => sum + (Number(inv.amount_due ?? inv.total ?? inv.amount) || 0), 0);
  const activeQuoteCount = quotes.filter(q => !['rejected', 'expired', 'void', 'cancelled', 'canceled'].includes((q.status || '').toLowerCase())).length;

  return (
    <div className="space-y-5">
      {canUseAdminActions && (
        <Breadcrumbs items={[
          { label: 'Customers', href: createPageUrl('Customers') },
          { label: customer?.name || 'Customer' }
        ]} />
      )}

      {/* Header with Sync - Admin only */}
      {canUseAdminActions && (
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

      {/* Customer Home Header */}
      <motion.div
        {...fadeInUp}
        className={cn(
          "overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm",
          hideCustomerHeroOnMobile && "hidden sm:block"
        )}
      >
        <div className="border-b border-slate-100 bg-slate-50/70 px-3 py-3 sm:px-5 sm:py-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 items-start gap-3 sm:gap-4">
              <div
                className={cn(
                  "relative flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white group sm:h-14 sm:w-14",
                  canUseAdminActions && "cursor-pointer"
                )}
                onClick={() => canUseAdminActions && logoInputRef.current?.click()}
              >
                {showCustomerLogo ? (
                  <img
                    src={customerLogoUrl}
                    alt={customer.name}
                    className="h-9 w-9 rounded-xl object-cover sm:h-14 sm:w-14"
                    onError={() => setFailedCustomerLogoUrl(customerLogoUrl)}
                  />
                ) : (
                  <span className="text-base font-bold text-primary sm:text-2xl">
                    {customer.name?.charAt(0)?.toUpperCase() || 'C'}
                  </span>
                )}
                {canUseAdminActions && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/50 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
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
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="truncate text-base font-semibold leading-5 text-slate-950 sm:text-2xl">{customer.name}</h1>
                  <Badge
                    variant={customer.status === 'active' ? 'flat-success' : customer.status === 'suspended' ? 'flat-destructive' : 'secondary'}
                    className="h-5 px-2 text-[10px] capitalize sm:h-6 sm:text-xs"
                  >
                    {customer.status || 'Active'}
                  </Badge>
                </div>
                <div className="mt-1.5 hidden flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-slate-500 sm:flex">
                  {customer.email && (
                    <a href={`mailto:${customer.email}`} className="flex items-center gap-1.5 hover:text-slate-900">
                      <Mail className="w-3.5 h-3.5" />
                      {customer.email}
                    </a>
                  )}
                  {customer.phone && (
                    <a href={`tel:${customer.phone}`} className="flex items-center gap-1.5 hover:text-slate-900">
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
            <div className="grid w-full grid-cols-4 gap-x-1 border-t border-slate-100 pt-3 xl:w-auto xl:min-w-[430px] xl:border-t-0 xl:pt-0 xl:justify-end">
              {[
                { label: 'Monthly billing', value: `$${monthlyBilling.toLocaleString('en-US', { maximumFractionDigits: 0 })}`, tone: 'text-emerald-700' },
                { label: 'Open balance', value: `$${openBalance.toLocaleString('en-US', { maximumFractionDigits: 0 })}`, tone: openBalance > 0 ? 'text-amber-700' : 'text-slate-950' },
                { label: 'Past due', value: `$${pastDueBalance.toLocaleString('en-US', { maximumFractionDigits: 0 })}`, tone: pastDueBalance > 0 ? 'text-rose-700' : 'text-slate-950' },
                { label: 'Quotes', value: activeQuoteCount, tone: 'text-amber-700' },
              ].map(item => (
                <div key={item.label} className="min-w-0 border-l border-slate-200 pl-2 sm:pl-3">
                  <p className={cn('truncate text-sm font-bold leading-4 tabular-nums sm:text-base sm:leading-5', item.tone)}>{item.value}</p>
                  <p className="mt-0.5 truncate text-[8px] font-semibold uppercase tracking-wide text-slate-500 sm:text-[9px]">{item.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {serviceTags.length > 0 && (
          <div className="hidden flex-wrap items-center gap-2 border-b border-slate-100 px-5 py-3 sm:flex">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Connected services</span>
            {serviceTags.map((tag) => (
              <span
                key={tag.key}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 py-1 pl-1 pr-2.5 text-[11px] font-medium text-slate-700"
              >
                <span className={cn('flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[9px] font-bold leading-none text-white', tag.badge)}>
                  {tag.mark || tag.label?.slice(0, 2)}
                </span>
                {tag.label}
              </span>
            ))}
          </div>
        )}

        {mapAddresses.length > 0 && (
          <div className="px-3 py-3 sm:px-5 sm:py-4">
            <CustomerMap addresses={mapAddresses} />
          </div>
        )}
      </motion.div>

      <Tabs value={currentTab} onValueChange={handleTabChange} className="space-y-3 sm:space-y-6" id="customer-tabs">
        <TabsList className={cn(
          "h-auto w-full justify-start gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 shadow-sm scrollbar-hide md:justify-center",
          isCustomerView ? "hidden sm:flex" : "flex"
        )}>
          {[
            { value: 'dashboard', icon: BarChart3, label: 'Dashboard' },
            { value: 'tickets', icon: HelpCircle, label: 'Helpdesk' },
            { value: 'billing', icon: DollarSign, label: 'Billing' },
            { value: 'services', icon: Cloud, label: 'Services' },
            { value: 'm365', icon: Monitor, label: 'M365' },
            { value: 'licenses', icon: Cloud, label: 'SaaS' },
            { value: 'quotes', icon: FileText, label: 'Quotes' },
          ].map(tab => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="gap-2 rounded-lg px-4 py-2 text-slate-500 transition-all data-[state=active]:bg-slate-950 data-[state=active]:text-white data-[state=active]:shadow-none hover:text-slate-900 whitespace-nowrap"
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
            invoices={invoices}
            lineItems={activeLineItems}
            recurringBills={recurringBills}
            licenses={licenses}
            quotes={quotes}
            quoteItems={quoteItems}
            serviceTags={serviceTags}
          />
        </TabsContent>

        <TabsContent value="billing">
          <CustomerBillingTab
            customer={customer}
            invoices={invoices}
            invoiceLineItems={invoiceLineItems}
            recurringBills={recurringBills}
            lineItems={activeLineItems}
            activeBillIdSet={activeBillIdSet}
            invoiceFilter={invoiceFilter}
            setInvoiceFilter={setInvoiceFilter}
            expandedInvoices={expandedInvoices}
            setExpandedInvoices={setExpandedInvoices}
          />
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
            canSync={canUseAdminActions}
          />
        </TabsContent>

        <TabsContent value="m365">
          <M365Tab customerId={customerId} queryClient={queryClient} canSync={canUseAdminActions} />
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
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <button
                      type="button"
                      onClick={() => setSaasView('spend')}
                      className={cn(
                        "block rounded-xl border p-4 text-left shadow-sm transition-colors",
                        saasView === 'spend'
                          ? "border-emerald-300 bg-emerald-50"
                          : "border-slate-200 bg-white hover:bg-slate-50"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">SaaS spend</p>
                          <p className="mt-2 text-2xl font-bold tabular-nums text-slate-950">${totalSpend.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                          <p className="mt-1 text-xs text-slate-500">View monthly and yearly detail</p>
                        </div>
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-emerald-200 bg-white text-emerald-700">
                          <DollarSign className="h-4 w-4" />
                        </div>
                      </div>
                    </button>

                    <button
                      onClick={() => { setSaasFilter('all'); setSaasView('licenses'); }}
                      className={cn(
                        "rounded-xl border p-4 text-left shadow-sm transition-colors",
                        saasFilter === 'all' && saasView === 'licenses'
                          ? "border-blue-200 bg-blue-50/70"
                          : "border-slate-200 bg-white hover:bg-slate-50"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Seat utilization</p>
                          <p className="mt-2 text-2xl font-bold tabular-nums text-slate-950">{utilizationRate.toFixed(0)}%</p>
                          <p className="mt-1 text-xs text-slate-500">{assignedSeats}/{totalSeats} assigned seats</p>
                        </div>
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-blue-200 bg-white text-blue-700">
                          <Monitor className="h-4 w-4" />
                        </div>
                      </div>
                    </button>

                    <button
                      onClick={() => setSaasView('users')}
                      className={cn(
                        "rounded-xl border p-4 text-left shadow-sm transition-colors",
                        saasView === 'users'
                          ? "border-violet-200 bg-violet-50/70"
                          : "border-slate-200 bg-white hover:bg-slate-50"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Team access</p>
                          <p className="mt-2 text-2xl font-bold tabular-nums text-slate-950">{contacts.length}</p>
                          <p className="mt-1 text-xs text-slate-500">team members</p>
                        </div>
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-violet-200 bg-white text-violet-700">
                          <Users className="h-4 w-4" />
                        </div>
                      </div>
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
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
                    {canUseAdminActions && (
                      <Button
                        size="sm"
                        className="gap-2"
                        onClick={() => setShowAddSoftware(true)}
                      >
                        <Plus className="w-4 h-4" />
                        Add Software
                      </Button>
                    )}
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
                          {canUseAdminActions && (
                            <Button
                              onClick={() => setShowAddSoftware(true)}
                            >
                              <Plus className="w-4 h-4 mr-2" />
                              Add Software
                            </Button>
                          )}
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
                                    <img src={resolveFileUrl(data.software.logo_url)} alt={appName} className="w-8 h-8 object-contain" />
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
                                        <img src={resolveFileUrl(license.logo_url)} alt="" className="w-6 h-6 object-contain" />
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
                                <img src={resolveFileUrl(license.logo_url)} alt={license.application_name} className="w-8 h-8 object-contain" />
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
          <CustomerQuotesTab
            quotes={quotes}
            quoteItems={quoteItems}
            expandedQuotes={expandedQuotes}
            setExpandedQuotes={setExpandedQuotes}
            canUseAdminActions={canUseAdminActions}
          />
        </TabsContent>

        <TabsContent value="tickets">
          <CustomerTicketsTab
            tickets={tickets}
            ticketFilter={ticketFilter}
            setTicketFilter={setTicketFilter}
            ticketPage={ticketPage}
            setTicketPage={setTicketPage}
            customer={customer}
            contacts={contacts}
            devices={devices}
          />
        </TabsContent>






                                  </Tabs>
                      </div>
                      );
                      }
