import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
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
  CheckCircle2,
  HelpCircle,
  AlertCircle,
  BarChart3,
  Receipt
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { format, parseISO } from 'date-fns';
import LicenseAssignmentModal from '../components/saas/LicenseAssignmentModal';
import AddLicenseModal from '../components/saas/AddLicenseModal';
import AddSoftwareModal from '../components/saas/AddSoftwareModal';
import SpendAnomalyAlert from '../components/saas/SpendAnomalyAlert';
import SoftwareCard from '../components/saas/SoftwareCard';
import AddContactModal from '../components/saas/AddContactModal';
import CustomerAnalytics from '../components/customer/CustomerAnalytics';
import DevicesTab from '../components/customer/DevicesTab';
import CustomerServicesTab from '../components/customer/CustomerServicesTab';
import OverviewTab from '../components/customer/OverviewTab';
import AISettingsPanel from '../components/customer/AISettingsPanel';
import { UserPlus, Settings } from 'lucide-react';

export default function CustomerDetail() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [user, setUser] = useState(null);
  const [selectedLicense, setSelectedLicense] = useState(null);
  const [showAddLicense, setShowAddLicense] = useState(false);
  const [showAddSoftware, setShowAddSoftware] = useState(false);
  const [showAddContact, setShowAddContact] = useState(false);
  const queryClient = useQueryClient();
  const params = new URLSearchParams(window.location.search);
  let customerId = params.get('id');

  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
      } catch (error) {
        console.error('Failed to load user', error);
      }
    };
    loadUser();
  }, []);

  const { data: customers = [], isLoading: loadingCustomer } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
  });

  // If no customerId, find customer by user email
  const customer = customerId 
    ? customers.find(c => c.id === customerId)
    : customers.length > 0 
      ? (() => {
          const emailDomain = user?.email?.split('@')[1];
          return customers.find(c => 
            c.email?.includes(emailDomain) || 
            c.name?.toLowerCase().includes(emailDomain?.split('.')[0])
          ) || customers[0];
        })()
      : null;
  
  // Update customerId if found through email matching
  if (!customerId && customer) {
    customerId = customer.id;
  }

  const { data: contracts = [], isLoading: loadingContracts } = useQuery({
    queryKey: ['contracts', customerId],
    queryFn: () => base44.entities.Contract.filter({ customer_id: customerId }),
    enabled: !!customerId
  });

  const { data: devices = [], isLoading: loadingDevices } = useQuery({
    queryKey: ['devices', customerId],
    queryFn: () => base44.entities.Device.filter({ customer_id: customerId }),
    enabled: !!customerId
  });

  const { data: licenses = [], isLoading: loadingLicenses } = useQuery({
    queryKey: ['licenses', customerId],
    queryFn: () => base44.entities.SaaSLicense.filter({ customer_id: customerId }),
    enabled: !!customerId
  });

  const { data: recurringBills = [], isLoading: loadingBills } = useQuery({
    queryKey: ['recurring_bills', customerId],
    queryFn: () => base44.entities.RecurringBill.filter({ customer_id: customerId }),
    enabled: !!customerId
  });

  const { data: lineItems = [], isLoading: loadingLineItems } = useQuery({
    queryKey: ['line_items', customerId],
    queryFn: async () => {
      const allItems = [];
      for (const bill of recurringBills) {
        const items = await base44.entities.RecurringBillLineItem.filter({ recurring_bill_id: bill.id });
        allItems.push(...items);
      }
      return allItems;
    },
    enabled: !!customerId && recurringBills.length > 0
  });

  const { data: invoices = [], isLoading: loadingInvoices } = useQuery({
    queryKey: ['invoices', customerId],
    queryFn: () => base44.entities.Invoice.filter({ customer_id: customerId }),
    enabled: !!customerId
  });

  const { data: quotes = [], isLoading: loadingQuotes } = useQuery({
    queryKey: ['quotes', customerId],
    queryFn: () => base44.entities.Quote.filter({ customer_id: customerId }),
    enabled: !!customerId
  });

  const { data: contacts = [], isLoading: loadingContacts } = useQuery({
        queryKey: ['contacts', customerId],
        queryFn: () => base44.entities.Contact.filter({ customer_id: customerId }),
        enabled: !!customerId
      });

      const { data: tickets = [], isLoading: loadingTickets } = useQuery({
        queryKey: ['tickets', customerId],
        queryFn: () => base44.entities.Ticket.filter({ customer_id: customerId }),
        enabled: !!customerId
      });

  const { data: quoteItems = [], isLoading: loadingQuoteItems } = useQuery({
        queryKey: ['quote_items', customerId],
        queryFn: async () => {
          const allItems = [];
          for (const quote of quotes) {
            const items = await base44.entities.QuoteItem.filter({ quote_id: quote.id });
            allItems.push(...items);
          }
          return allItems;
        },
        enabled: !!customerId && quotes.length > 0
      });

      const { data: invoiceLineItems = [], isLoading: loadingInvoiceLineItems } = useQuery({
        queryKey: ['invoice_line_items', customerId],
        queryFn: async () => {
          const allItems = [];
          for (const invoice of invoices) {
            const items = await base44.entities.InvoiceLineItem.filter({ invoice_id: invoice.id });
            allItems.push(...items);
          }
          return allItems;
        },
        enabled: !!customerId && invoices.length > 0
      });

  const { data: contractItems = [], isLoading: loadingContractItems } = useQuery({
    queryKey: ['contract_items', customerId],
    queryFn: async () => {
      const allItems = [];
      for (const contract of contracts) {
        const items = await base44.entities.ContractItem.filter({ contract_id: contract.id });
        allItems.push(...items);
      }
      return allItems;
    },
    enabled: !!customerId && contracts.length > 0
  });

  const { data: licenseAssignments = [], isLoading: loadingAssignments } = useQuery({
    queryKey: ['license_assignments', customerId],
    queryFn: () => base44.entities.LicenseAssignment.filter({ customer_id: customerId }),
    enabled: !!customerId
  });

  // Fetch JumpCloud mapping for this customer
  const { data: jumpcloudMapping } = useQuery({
    queryKey: ['jumpcloud-mapping', customerId],
    queryFn: async () => {
      const mappings = await base44.entities.JumpCloudMapping.filter({ customer_id: customerId });
      return mappings[0] || null;
    },
    enabled: !!customerId
  });

  // Fetch Spanning mapping for this customer
  const { data: spanningMapping } = useQuery({
    queryKey: ['spanning-mapping', customerId],
    queryFn: async () => {
      const mappings = await base44.entities.SpanningMapping.filter({ customer_id: customerId });
      return mappings[0] || null;
    },
    enabled: !!customerId
  });

  // Check if customer has any services mapped
  const hasServicesMapped = !!jumpcloudMapping || !!spanningMapping || lineItems.length > 0;

  const [expandedBills, setExpandedBills] = useState({});
              const [expandedQuotes, setExpandedQuotes] = useState({});
              const [expandedContracts, setExpandedContracts] = useState({});
              const [expandedInvoices, setExpandedInvoices] = useState({});
              const [invoiceFilter, setInvoiceFilter] = useState('all');
                  const [ticketFilter, setTicketFilter] = useState('all');
                  const [ticketPage, setTicketPage] = useState(1);
                  const [saasFilter, setSaasFilter] = useState('all'); // 'all', 'underutilized', 'full', 'unassigned'
                  const [saasUserFilter, setSaasUserFilter] = useState(''); // filter by contact id
                  const [saasView, setSaasView] = useState('licenses'); // 'licenses', 'users', 'spend'
                  const [saasCategoryFilter, setSaasCategoryFilter] = useState(''); // filter by category

  const isLoading = loadingCustomer || loadingContracts || loadingLicenses || loadingBills || loadingLineItems || loadingInvoices || loadingQuotes || loadingQuoteItems || loadingContractItems || loadingContacts || loadingTickets || loadingInvoiceLineItems || loadingAssignments || loadingDevices;

  const handleAssignLicense = async (contactId) => {
    await base44.entities.LicenseAssignment.create({
      license_id: selectedLicense.id,
      contact_id: contactId,
      customer_id: customerId,
      assigned_date: new Date().toISOString().split('T')[0],
      status: 'active'
    });
    // Update license assigned_users count
    const newCount = licenseAssignments.filter(a => a.license_id === selectedLicense.id && a.status === 'active').length + 1;
    await base44.entities.SaaSLicense.update(selectedLicense.id, { assigned_users: newCount });
    queryClient.invalidateQueries({ queryKey: ['license_assignments', customerId] });
    queryClient.invalidateQueries({ queryKey: ['licenses', customerId] });
    toast.success('License assigned!');
  };

  const handleRevokeLicense = async (contactId) => {
    const assignment = licenseAssignments.find(a => 
      a.license_id === selectedLicense.id && 
      a.contact_id === contactId && 
      a.status === 'active'
    );
    if (assignment) {
      await base44.entities.LicenseAssignment.update(assignment.id, { status: 'revoked' });
      const newCount = Math.max(0, licenseAssignments.filter(a => a.license_id === selectedLicense.id && a.status === 'active').length - 1);
      await base44.entities.SaaSLicense.update(selectedLicense.id, { assigned_users: newCount });
      queryClient.invalidateQueries({ queryKey: ['license_assignments', customerId] });
      queryClient.invalidateQueries({ queryKey: ['licenses', customerId] });
      toast.success('License revoked!');
    }
  };

  const handleAddLicense = async (licenseData) => {
    await base44.entities.SaaSLicense.create(licenseData);
    queryClient.invalidateQueries({ queryKey: ['licenses', customerId] });
    setShowAddLicense(false);
    toast.success('License added!');
  };

  const handleAddSoftware = async (softwareData) => {
    await base44.entities.SaaSLicense.create(softwareData);
    queryClient.invalidateQueries({ queryKey: ['licenses', customerId] });
    setShowAddSoftware(false);
    toast.success('Software added! Click on it to add licenses.');
  };

  // Group licenses by application name for the new UI
  const groupedSoftware = licenses.reduce((acc, license) => {
    const key = license.application_name;
    if (!acc[key]) {
      acc[key] = {
        software: license, // Use the first one as the base software info
        managedLicense: null,
        individualLicenses: []
      };
    }
    if (license.management_type === 'managed') {
      acc[key].managedLicense = license;
    } else {
      acc[key].individualLicenses.push(license);
    }
    return acc;
  }, {});

  const handleAddContact = async (contactData) => {
    await base44.entities.Contact.create(contactData);
    queryClient.invalidateQueries({ queryKey: ['contacts', customerId] });
    setShowAddContact(false);
    toast.success('Team member added!');
  };

  const handleSyncCustomer = async () => {
    if (!customer) return;
    setIsSyncing(true);
    const results = [];
    const errors = [];

    try {
      // Sync HaloPSA if customer is from HaloPSA
      if (customer?.source === 'halopsa' && customer?.external_id) {
        try {
          const res = await base44.functions.invoke('syncHaloPSACustomers', { 
            action: 'sync_customer',
            customer_id: customer.external_id 
          });
          if (res.data.success) results.push('HaloPSA');
          else errors.push('HaloPSA');
        } catch (e) { errors.push('HaloPSA'); }
      }

      // Sync JumpCloud if mapped
      const jcMappings = await base44.entities.JumpCloudMapping.filter({ customer_id: customerId });
      if (jcMappings.length > 0) {
        try {
          const res = await base44.functions.invoke('syncJumpCloudLicenses', {
            action: 'sync_licenses',
            customer_id: customerId
          });
          if (res.data.success) results.push('JumpCloud');
          else errors.push('JumpCloud');
        } catch (e) { errors.push('JumpCloud'); }
      }

      // Sync Spanning if mapped
      const spanningMappings = await base44.entities.SpanningMapping.filter({ customer_id: customerId });
      if (spanningMappings.length > 0) {
        try {
          const res = await base44.functions.invoke('syncSpanningBackup', {
            action: 'sync_licenses',
            customer_id: customerId
          });
          if (res.data.success) results.push('Spanning');
          else errors.push('Spanning');
        } catch (e) { errors.push('Spanning'); }
      }

      // Sync Datto if mapped
      const dattoMappings = await base44.entities.DattoSiteMapping.filter({ customer_id: customerId });
      if (dattoMappings.length > 0) {
        try {
          const res = await base44.functions.invoke('syncDattoRMMDevices', {
            action: 'sync_site',
            site_id: dattoMappings[0].datto_site_id
          });
          if (res.data.success) results.push('Datto');
          else errors.push('Datto');
        } catch (e) { errors.push('Datto'); }
      }

      if (results.length > 0) {
        toast.success(`Synced: ${results.join(', ')}`);
        queryClient.invalidateQueries();
      }
      if (errors.length > 0) {
        toast.error(`Failed: ${errors.join(', ')}`);
      }
      if (results.length === 0 && errors.length === 0) {
        toast.info('No integrations configured to sync');
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
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="text-center py-12">
        <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-slate-900 mb-2">Account Not Found</h2>
        <p className="text-slate-500 mb-6">We couldn't find your account. Please contact support.</p>
        <Link to={createPageUrl('Dashboard')}>
          <Button>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </Link>
      </div>
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
      {/* Header with Back Button and Sync */}
      <div className="flex items-center justify-between">
       <Link to={createPageUrl('Dashboard')}>
         <Button variant="ghost" size="sm" className="gap-2">
           <ArrowLeft className="w-4 h-4" />
           Back to Dashboard
         </Button>
       </Link>
       {customer?.source === 'halopsa' && (
         <Button 
           onClick={handleSyncCustomer}
           disabled={isSyncing}
           variant="outline"
           className="gap-2"
           size="sm"
         >
           <RefreshCw className={cn("w-4 h-4", isSyncing && "animate-spin")} />
           Refresh Data
         </Button>
       )}
      </div>

      {/* Account Header - Modern & Clean */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center gap-6">
          {/* Logo & Name */}
          <div className="flex items-center gap-4 flex-1">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center flex-shrink-0 shadow-lg shadow-purple-500/20">
              {customer.logo_url ? (
                <img src={customer.logo_url} alt={customer.name} className="w-10 h-10 rounded-xl object-cover" />
              ) : (
                <Building2 className="w-7 h-7 text-white" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-slate-900">{customer.name}</h1>
                <Badge className={cn(
                  "font-medium",
                  customer.status === 'active' && "bg-emerald-100 text-emerald-700 border-emerald-200",
                  customer.status === 'inactive' && "bg-slate-100 text-slate-600",
                  customer.status === 'suspended' && "bg-red-100 text-red-700"
                )}>
                  {customer.status || 'Active'}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-4 mt-1.5 text-sm text-slate-500">
                {customer.email && (
                  <a href={`mailto:${customer.email}`} className="flex items-center gap-1.5 hover:text-purple-600 transition-colors">
                    <Mail className="w-3.5 h-3.5" />
                    {customer.email}
                  </a>
                )}
                {customer.phone && (
                  <a href={`tel:${customer.phone}`} className="flex items-center gap-1.5 hover:text-purple-600 transition-colors">
                    <Phone className="w-3.5 h-3.5" />
                    {customer.phone}
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Quick Stats - Compact Pills */}
          <div className="flex flex-wrap gap-2">
            {[
              { icon: Users, value: contacts.length, label: 'Team', color: 'blue' },
              { icon: FileText, value: contracts.filter(c => c.status === 'active').length, label: 'Contracts', color: 'orange' },
              { icon: HelpCircle, value: tickets.length, label: 'Tickets', color: 'amber' },
              { icon: Cloud, value: licenses.length, label: 'Apps', color: 'purple' },
              { icon: Monitor, value: devices.length, label: 'Devices', color: 'cyan' },
            ].map(stat => (
              <div 
                key={stat.label}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-xl border transition-all cursor-default",
                  stat.color === 'blue' && "bg-blue-50 border-blue-100",
                  stat.color === 'orange' && "bg-orange-50 border-orange-100",
                  stat.color === 'amber' && "bg-amber-50 border-amber-100",
                  stat.color === 'purple' && "bg-purple-50 border-purple-100",
                  stat.color === 'cyan' && "bg-cyan-50 border-cyan-100"
                )}
              >
                <stat.icon className={cn(
                  "w-4 h-4",
                  stat.color === 'blue' && "text-blue-600",
                  stat.color === 'orange' && "text-orange-600",
                  stat.color === 'amber' && "text-amber-600",
                  stat.color === 'purple' && "text-purple-600",
                  stat.color === 'cyan' && "text-cyan-600"
                )} />
                <span className="font-bold text-slate-900">{stat.value}</span>
                <span className="text-xs text-slate-500">{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs - Clean minimal design */}
      <Tabs defaultValue="overview" className="space-y-6" id="customer-tabs">
        <TabsList className="bg-slate-100/80 border-0 rounded-xl p-1 flex gap-0.5 h-auto overflow-x-auto">
          {[
            { value: 'overview', icon: Building2, label: 'Overview' },
            { value: 'billing', icon: DollarSign, label: 'Billing' },
            ...(hasServicesMapped ? [{ value: 'services', icon: Cloud, label: 'Services' }] : []),
            { value: 'licenses', icon: Cloud, label: 'SaaS' },
            { value: 'quotes', icon: FileText, label: 'Quotes' },
            { value: 'tickets', icon: HelpCircle, label: 'Support' },
            { value: 'devices', icon: Monitor, label: 'Devices' },
            { value: 'settings', icon: Settings, label: 'Settings' },
          ].map(tab => (
            <TabsTrigger 
              key={tab.value}
              value={tab.value} 
              className="gap-2 py-2 px-4 rounded-lg text-slate-600 font-medium transition-all data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm hover:text-slate-900 whitespace-nowrap"
            >
              <tab.icon className="w-4 h-4" />
              <span className="text-sm">{tab.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab
            customer={customer}
            contacts={contacts}
            contracts={contracts}
            recurringBills={recurringBills}
            licenses={licenses}
            customerId={customerId}
            queryClient={queryClient}
            onAddContact={() => setShowAddContact(true)}
          />
        </TabsContent>

        <TabsContent value="billing">
                        <div className="space-y-6">
                          
                          {/* Compact Summary Row */}
                          <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 max-w-3xl mx-auto shadow-sm">
                            <div className="grid grid-cols-1 sm:grid-cols-3 items-center text-center gap-3">
                              {/* Monthly Cost */}
                              <div className="sm:pr-4 sm:border-r sm:border-gray-200">
                                <p className="text-[10px] text-gray-500 uppercase tracking-wide">Monthly Cost</p>
                                <p className="text-xl font-bold text-gray-900">
                                  ${recurringBills.reduce((sum, b) => sum + (b.amount || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </p>
                              </div>
                              
                              {/* Contract */}
                              <div className="sm:px-4 sm:border-r sm:border-gray-200">
                                <div className="flex items-center justify-center gap-1.5">
                                  <p className="text-[10px] text-gray-500 uppercase tracking-wide">Contract</p>
                                  {customer?.source === 'halopsa' && (
                                    <button
                                      onClick={async () => {
                                        try {
                                          setIsSyncing(true);
                                          const response = await base44.functions.invoke('syncHaloPSAContracts', { 
                                            action: 'sync_customer',
                                            customer_id: customer.external_id 
                                          });
                                          if (response.data.success) {
                                            toast.success(`Synced contracts!`);
                                            queryClient.invalidateQueries({ queryKey: ['contracts', customerId] });
                                          } else {
                                            toast.error(response.data.error || 'Sync failed');
                                          }
                                        } catch (error) {
                                          toast.error(error.message || 'An error occurred');
                                        } finally {
                                          setIsSyncing(false);
                                        }
                                      }}
                                      disabled={isSyncing}
                                      className="text-gray-400 hover:text-gray-600"
                                    >
                                      <RefreshCw className={cn("w-3 h-3", isSyncing && "animate-spin")} />
                                    </button>
                                  )}
                                </div>
                                {contracts.length > 0 ? (
                                  <p className="font-semibold text-gray-900">{contracts[0].name}</p>
                                ) : (
                                  <p className="text-gray-400 text-sm">None</p>
                                )}
                              </div>
                              
                              {/* Invoice Status */}
                              <div className="sm:pl-4">
                                <p className="text-[10px] text-gray-500 uppercase tracking-wide">Invoices</p>
                                <div className="flex items-center justify-center gap-3">
                                  <div className="flex items-center gap-1">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                    <span className="text-sm font-medium text-gray-700">{invoices.filter(i => i.status === 'paid').length} Paid</span>
                                  </div>
                                  {invoices.filter(i => i.status === 'overdue').length > 0 && (
                                    <div className="flex items-center gap-1">
                                      <div className="w-2 h-2 rounded-full bg-red-500" />
                                      <span className="text-sm font-medium text-red-600">{invoices.filter(i => i.status === 'overdue').length} Overdue</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Invoices Section - Collapsible */}
                          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                            <button
                              onClick={() => setExpandedInvoices(prev => ({ ...prev, _section: !prev._section }))}
                              className="w-full px-6 py-5 flex items-center justify-between hover:bg-gray-50 transition-colors"
                            >
                              <div className="text-left">
                                <h3 className="text-lg font-semibold text-gray-900">Invoice History</h3>
                                <p className="text-sm text-gray-500 mt-0.5">{invoices.length} invoices on record</p>
                              </div>
                              <div className="flex items-center gap-3">
                                <ChevronDown className={cn(
                                  "w-5 h-5 text-gray-400 transition-transform",
                                  expandedInvoices._section && "rotate-180"
                                )} />
                              </div>
                            </button>
                            
                            {expandedInvoices._section && (
                            <div className="border-t border-gray-100 px-6 py-5">
                              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                <div className="flex items-center gap-3">
                                  {customer?.source === 'halopsa' && (
                                    <Button 
                                      size="sm"
                                      variant="ghost"
                                      className="gap-2 text-gray-600 hover:text-gray-900"
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        try {
                                          setIsSyncing(true);
                                          const response = await base44.functions.invoke('syncHaloPSAInvoices', { 
                                            action: 'sync_customer',
                                            customer_id: customer.external_id 
                                          });
                                          if (response.data.success) {
                                            toast.success(`Synced ${response.data.recordsSynced} invoices!`);
                                            queryClient.invalidateQueries({ queryKey: ['invoices', customerId] });
                                            queryClient.invalidateQueries({ queryKey: ['invoice_line_items', customerId] });
                                          } else {
                                            toast.error(response.data.error || 'Sync failed');
                                          }
                                        } catch (error) {
                                          toast.error(error.message || 'An error occurred during sync');
                                        } finally {
                                          setIsSyncing(false);
                                        }
                                      }}
                                      disabled={isSyncing}
                                    >
                                      <RefreshCw className={cn("w-4 h-4", isSyncing && "animate-spin")} />
                                      Sync
                                    </Button>
                                  )}
                                  <select
                                    value={invoiceFilter}
                                    onChange={(e) => setInvoiceFilter(e.target.value)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
                                  >
                                    <option value="all">All Invoices</option>
                                    <option value="paid">Paid</option>
                                    <option value="overdue">Overdue</option>
                                    <option value="sent">Pending</option>
                                  </select>
                                </div>

                              {/* Invoice Summary Stats */}
                              {invoices.length > 0 && (
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-5">
                                  <div className="bg-gray-50 rounded-xl p-4">
                                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Total Invoiced</p>
                                    <p className="text-xl font-bold text-gray-900 mt-1">
                                      ${invoices.reduce((sum, inv) => sum + (inv.total || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                    </p>
                                  </div>
                                  <div className="bg-emerald-50 rounded-xl p-4 border-l-4 border-emerald-500">
                                    <p className="text-xs text-emerald-600 font-medium uppercase tracking-wide">Paid</p>
                                    <p className="text-xl font-bold text-emerald-700 mt-1">
                                      ${invoices.filter(i => i.status === 'paid').reduce((sum, inv) => sum + (inv.total || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                    </p>
                                  </div>
                                  <div className="bg-amber-50 rounded-xl p-4 border-l-4 border-amber-400">
                                    <p className="text-xs text-amber-600 font-medium uppercase tracking-wide">Pending</p>
                                    <p className="text-xl font-bold text-amber-700 mt-1">
                                      ${invoices.filter(i => i.status === 'sent').reduce((sum, inv) => sum + (inv.total || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                    </p>
                                  </div>
                                  <div className="bg-red-50 rounded-xl p-4 border-l-4 border-red-400">
                                    <p className="text-xs text-red-600 font-medium uppercase tracking-wide">Overdue ({invoices.filter(i => i.status === 'overdue').length})</p>
                                    <p className="text-xl font-bold text-red-700 mt-1">
                                      ${invoices.filter(i => i.status === 'overdue').reduce((sum, inv) => sum + (inv.total || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                    </p>
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Invoice List */}
                            {invoices.length === 0 ? (
                              <div className="py-16 text-center">
                                <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                                <p className="text-gray-500">No invoices found</p>
                                {customer?.source === 'halopsa' && (
                                  <p className="text-sm text-gray-400 mt-1">Click "Sync" to pull from HaloPSA</p>
                                )}
                              </div>
                            ) : (
                              <div className="divide-y divide-gray-100">
                                {invoices
                                  .filter(inv => invoiceFilter === 'all' || inv.status === invoiceFilter)
                                  .sort((a, b) => new Date(b.due_date || 0) - new Date(a.due_date || 0))
                                  .map(invoice => {
                                    const invoiceItems = invoiceLineItems.filter(item => item.invoice_id === invoice.id);
                                    const isExpanded = expandedInvoices[invoice.id];
                                    const isPaid = invoice.status === 'paid';
                                    const isOverdue = invoice.status === 'overdue';
                                    
                                    return (
                                      <div key={invoice.id} className={cn(
                                        "transition-colors",
                                        isOverdue && "bg-red-50/30"
                                      )}>
                                        <button
                                          onClick={() => setExpandedInvoices(prev => ({ ...prev, [invoice.id]: !prev[invoice.id] }))}
                                          className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
                                        >
                                          <div className="flex items-center gap-5">
                                            <div className={cn(
                                              "w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0",
                                              isPaid && "bg-emerald-100",
                                              isOverdue && "bg-red-100",
                                              !isPaid && !isOverdue && "bg-amber-50"
                                            )}>
                                              {isPaid ? (
                                                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                                              ) : (
                                                <FileText className={cn(
                                                  "w-5 h-5",
                                                  isOverdue ? "text-red-600" : "text-amber-600"
                                                )} />
                                              )}
                                            </div>
                                            <div className="text-left">
                                              <div className="flex items-center gap-3">
                                                <p className="font-semibold text-gray-900">{invoice.invoice_number}</p>
                                                <span className={cn(
                                                  "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                                                  isPaid && "bg-emerald-100 text-emerald-700",
                                                  isOverdue && "bg-red-100 text-red-700",
                                                  invoice.status === 'sent' && "bg-amber-100 text-amber-700"
                                                )}>
                                                  {isPaid ? '✓ Paid' : isOverdue ? 'Overdue' : 'Pending'}
                                                </span>
                                              </div>
                                              <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                                                {invoice.due_date && (
                                                  <span>Due {format(parseISO(invoice.due_date), 'MMM d, yyyy')}</span>
                                                )}
                                              </div>
                                            </div>
                                          </div>
                                          <div className="flex items-center gap-5">
                                            <p className={cn(
                                              "text-xl font-bold",
                                              isPaid ? "text-emerald-600" : "text-gray-900"
                                            )}>
                                              ${(invoice.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                            </p>
                                            <ChevronDown className={cn(
                                              "w-5 h-5 text-gray-400 transition-transform", 
                                              isExpanded && "rotate-180"
                                            )} />
                                          </div>
                                        </button>
                                        
                                        {isExpanded && (
                                          <div className="bg-gray-50 mx-6 mb-4 rounded-xl overflow-hidden">
                                            {invoiceItems.length > 0 ? (
                                              <div>
                                                <div className="px-4 py-3 bg-gray-100">
                                                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Line Items</p>
                                                </div>
                                                <div className="divide-y divide-gray-100">
                                                  {invoiceItems.map(item => (
                                                    <div key={item.id} className="flex justify-between items-center px-4 py-3">
                                                      <div className="flex-1">
                                                        <p className="font-medium text-gray-900 text-sm">{item.description}</p>
                                                        <p className="text-xs text-gray-500 mt-0.5">
                                                          {item.quantity} × ${(item.unit_price || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                        </p>
                                                      </div>
                                                      <p className="font-semibold text-gray-900 text-sm">
                                                        ${(item.net_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                      </p>
                                                    </div>
                                                  ))}
                                                </div>
                                                <div className="flex justify-between items-center px-4 py-3 bg-gray-200">
                                                  <p className="font-semibold text-gray-700 text-sm">Invoice Total</p>
                                                  <p className="font-bold text-gray-900">
                                                    ${(invoice.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                  </p>
                                                </div>
                                              </div>
                                            ) : (
                                              <p className="text-sm text-gray-500 text-center py-6">No line items available</p>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                              </div>
                            )}
                            </div>
                            )}
                          </div>
                        </div>
                      </TabsContent>

        {hasServicesMapped && (
          <TabsContent value="services">
            <CustomerServicesTab 
              customerId={customerId}
              customer={customer}
              lineItems={lineItems}
              expandedBills={expandedBills}
              setExpandedBills={setExpandedBills}
              isSyncing={isSyncing}
              setIsSyncing={setIsSyncing}
              queryClient={queryClient}
            />
          </TabsContent>
        )}

        <TabsContent value="licenses">
          <div className="space-y-6">
            {/* Stats Widgets Row */}
            {(() => {
              const totalSpend = licenses.reduce((sum, l) => sum + (l.total_cost || 0), 0);
              const totalSeats = licenses.reduce((sum, l) => sum + (l.quantity || 0), 0);
              const assignedSeats = licenseAssignments.filter(a => a.status === 'active').length;
              const unusedSeats = totalSeats - assignedSeats;
              const utilizationRate = totalSeats > 0 ? (assignedSeats / totalSeats) * 100 : 0;
              const wastedSpend = totalSeats > 0 ? (unusedSeats / totalSeats) * totalSpend : 0;
              const underutilizedLicenses = licenses.filter(l => {
                const assigned = licenseAssignments.filter(a => a.license_id === l.id && a.status === 'active').length;
                return l.quantity > 0 && (assigned / l.quantity) < 0.5;
              });
              
              return (
                <>
                  {/* Stat Cards Row */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    {/* Monthly Spend */}
                    <button
                      onClick={() => setSaasView('spend')}
                      className={cn(
                        "bg-white rounded-xl border-2 p-4 text-left transition-all hover:shadow-md group",
                        saasView === 'spend' ? "border-purple-500 shadow-md" : "border-slate-200 hover:border-purple-300"
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center", saasView === 'spend' ? "bg-purple-100" : "bg-slate-100 group-hover:bg-purple-50")}>
                          <DollarSign className={cn("w-4 h-4", saasView === 'spend' ? "text-purple-600" : "text-slate-500 group-hover:text-purple-500")} />
                        </div>
                        <span className="text-xs text-slate-500">Monthly</span>
                      </div>
                      <p className="text-xl font-bold text-slate-900">${totalSpend.toLocaleString()}</p>
                      {wastedSpend > 0 && <p className="text-[10px] text-red-500 mt-0.5">~${wastedSpend.toFixed(0)} unused</p>}
                    </button>
                    
                    {/* Utilization */}
                    <button
                      onClick={() => { setSaasFilter('all'); setSaasView('licenses'); }}
                      className={cn(
                        "bg-white rounded-xl border-2 p-4 text-left transition-all hover:shadow-md group",
                        saasFilter === 'all' && saasView === 'licenses' ? "border-purple-500 shadow-md" : "border-slate-200 hover:border-purple-300"
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

                    {/* Low Usage */}
                    <button
                      onClick={() => { setSaasFilter('underutilized'); setSaasView('licenses'); }}
                      className={cn(
                        "bg-white rounded-xl border-2 p-4 text-left transition-all hover:shadow-md group",
                        saasFilter === 'underutilized' ? "border-amber-500 shadow-md" : "border-slate-200 hover:border-amber-300"
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center", saasFilter === 'underutilized' ? "bg-amber-100" : "bg-slate-100 group-hover:bg-amber-50")}>
                          <AlertCircle className={cn("w-4 h-4", saasFilter === 'underutilized' ? "text-amber-600" : "text-slate-500 group-hover:text-amber-500")} />
                        </div>
                        <span className="text-xs text-slate-500">Low Usage</span>
                      </div>
                      <p className={cn("text-xl font-bold", underutilizedLicenses.length > 0 ? "text-amber-600" : "text-slate-900")}>{underutilizedLicenses.length}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">&lt;50% utilized</p>
                    </button>

                    {/* By User */}
                    <button
                      onClick={() => setSaasView('users')}
                      className={cn(
                        "bg-white rounded-xl border-2 p-4 text-left transition-all hover:shadow-md group",
                        saasView === 'users' ? "border-purple-500 shadow-md" : "border-slate-200 hover:border-purple-300"
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

                    {/* Applications */}
                    <div className="bg-white rounded-xl border-2 border-slate-200 p-4 text-left">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center">
                          <Cloud className="w-4 h-4 text-slate-500" />
                        </div>
                        <span className="text-xs text-slate-500">Apps</span>
                      </div>
                      <p className="text-xl font-bold text-slate-900">{Object.keys(groupedSoftware).length}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">applications</p>
                    </div>
                  </div>

                  {/* Filters & Add Button Row */}
                  <div className="flex items-center gap-3">
                    {saasView === 'licenses' && (
                      <select
                        value={saasFilter}
                        onChange={(e) => setSaasFilter(e.target.value)}
                        className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white"
                      >
                        <option value="all">All Licenses</option>
                        <option value="underutilized">&lt;50% utilized</option>
                        <option value="full">Fully Assigned</option>
                        <option value="unassigned">Has Unused</option>
                      </select>
                    )}
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
                      className="gap-2 bg-purple-600 hover:bg-purple-700"
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
                {/* Software Cards - Grouped View */}
                <div className="bg-white rounded-2xl border border-slate-200/50 overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-100">
                    <h3 className="font-semibold text-slate-900">Software & Licenses</h3>
                    <p className="text-sm text-slate-500">{Object.keys(groupedSoftware).length} applications</p>
                  </div>
                  {Object.keys(groupedSoftware).length === 0 ? (
                    <div className="p-12 text-center">
                      <Cloud className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                      <p className="text-slate-500 mb-3">No software added yet</p>
                      <Button 
                        onClick={() => setShowAddSoftware(true)}
                        className="bg-purple-600 hover:bg-purple-700"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Software
                      </Button>
                    </div>
                  ) : (
                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {Object.entries(groupedSoftware)
                        .filter(([_, data]) => {
                          // Apply category filter
                          if (saasCategoryFilter && data.software.category !== saasCategoryFilter) return false;
                          
                          // Apply utilization filters
                          if (saasFilter !== 'all' && data.managedLicense) {
                            const assignedCount = licenseAssignments.filter(a => a.license_id === data.managedLicense.id && a.status === 'active').length;
                            const utilization = data.managedLicense.quantity > 0 ? assignedCount / data.managedLicense.quantity : 0;
                            
                            if (saasFilter === 'underutilized') return utilization < 0.5 && data.managedLicense.quantity > 0;
                            if (saasFilter === 'full') return assignedCount >= (data.managedLicense.quantity || 0) && data.managedLicense.quantity > 0;
                            if (saasFilter === 'unassigned') return assignedCount < (data.managedLicense.quantity || 0);
                          }
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
                            />
                          );
                        })}
                    </div>
                  )}
                </div>
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
                      const userLicenses = userAssignments.map(a => licenses.find(l => l.id === a.license_id)).filter(Boolean);
                      const totalCost = userLicenses.reduce((sum, l) => {
                        const perSeatCost = l.quantity > 0 ? (l.total_cost || 0) / l.quantity : 0;
                        return sum + perSeatCost;
                      }, 0);
                      
                      return (
                        <div key={contact.id} className="p-5">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 font-medium">
                                {contact.full_name?.charAt(0) || '?'}
                              </div>
                              <div>
                                <p className="font-semibold text-slate-900">{contact.full_name}</p>
                                <p className="text-sm text-slate-500">{contact.email || contact.title || 'No email'}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-slate-900">{userAssignments.length} licenses</p>
                              <p className="text-sm text-slate-500">${totalCost.toFixed(2)}/mo</p>
                            </div>
                          </div>
                          {userLicenses.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {userLicenses.map(license => (
                                <button
                                  key={license.id}
                                  onClick={() => setSelectedLicense(license)}
                                  className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                                >
                                  {license.logo_url ? (
                                    <img src={license.logo_url} alt="" className="w-4 h-4 object-contain" />
                                  ) : (
                                    <Cloud className="w-4 h-4 text-purple-600" />
                                  )}
                                  <span className="text-sm text-slate-700">{license.application_name}</span>
                                </button>
                              ))}
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
                <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-2xl border border-purple-200 p-6">
                  <h3 className="font-semibold text-purple-900 mb-3 flex items-center gap-2">
                    <HelpCircle className="w-5 h-5" />
                    Cost Optimization Insights
                  </h3>
                  <div className="space-y-2 text-sm text-purple-800">
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
                <Button size="sm" className="gap-2 bg-slate-900 hover:bg-slate-800">
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
                                  {format(parseISO(quote.quote_date), 'MM/dd/yyyy')}
                                </span>
                              )}
                              {quote.expiry_date && (
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  Expires: {format(parseISO(quote.expiry_date), 'MM/dd/yyyy')}
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
                              {customer?.source === 'halopsa' && (
                                <Button 
                                  size="sm"
                                  variant="outline"
                                  className="gap-2"
                                  onClick={async () => {
                                    try {
                                      setIsSyncing(true);
                                      const response = await base44.functions.invoke('syncHaloPSATickets', { 
                                        action: 'sync_customer',
                                        customer_id: customer.external_id 
                                      });
                                      if (response.data.success) {
                                        toast.success(`Synced ${response.data.recordsSynced} tickets!`);
                                        queryClient.invalidateQueries({ queryKey: ['tickets', customerId] });
                                      } else {
                                        toast.error(response.data.error || 'Sync failed');
                                      }
                                    } catch (error) {
                                      toast.error(error.message || 'An error occurred during sync');
                                    } finally {
                                      setIsSyncing(false);
                                    }
                                  }}
                                  disabled={isSyncing}
                                >
                                  <RefreshCw className={cn("w-4 h-4", isSyncing && "animate-spin")} />
                                  Sync
                                </Button>
                              )}
                              <select
                                value={ticketFilter}
                                onChange={(e) => { setTicketFilter(e.target.value); setTicketPage(1); }}
                                className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-500"
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
                                  .sort((a, b) => new Date(b.date_opened || 0) - new Date(a.date_opened || 0))
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
                                          #{ticket.ticket_number} - {ticket.summary}
                                        </p>
                                        <div className="flex items-center gap-2 mt-1 text-sm text-slate-500">
                                          {ticket.requested_by && (
                                            <span>By: {ticket.requested_by}</span>
                                          )}
                                          {ticket.requested_by && ticket.assigned_to && <span>•</span>}
                                          {ticket.assigned_to && (
                                            <span className="text-purple-600 font-medium">
                                              Tech: {ticket.assigned_to}
                                            </span>
                                          )}
                                          {(ticket.requested_by || ticket.assigned_to) && ticket.date_opened && <span>•</span>}
                                          {ticket.date_opened && (
                                            <span>{format(parseISO(ticket.date_opened), 'MMM d, yyyy')}</span>
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

        <TabsContent value="devices">
          <DevicesTab 
            customerId={customerId} 
            customerExternalId={customer?.external_id}
          />
        </TabsContent>

        <TabsContent value="settings">
          <div className="space-y-6">
            <AISettingsPanel 
              customer={customer} 
              onUpdate={() => queryClient.invalidateQueries({ queryKey: ['customers'] })}
            />
          </div>
        </TabsContent>
                                  </Tabs>
                      </div>
                      );
                      }