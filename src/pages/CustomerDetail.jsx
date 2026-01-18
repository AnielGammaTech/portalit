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
  AlertCircle
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { format, parseISO } from 'date-fns';
import LicenseAssignmentModal from '../components/saas/LicenseAssignmentModal';
import AddLicenseModal from '../components/saas/AddLicenseModal';

export default function CustomerDetail() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [user, setUser] = useState(null);
  const [selectedLicense, setSelectedLicense] = useState(null);
  const [showAddLicense, setShowAddLicense] = useState(false);
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

  const [expandedBills, setExpandedBills] = useState({});
              const [expandedQuotes, setExpandedQuotes] = useState({});
              const [expandedContracts, setExpandedContracts] = useState({});
              const [expandedInvoices, setExpandedInvoices] = useState({});
              const [invoiceFilter, setInvoiceFilter] = useState('all');
                  const [teamPage, setTeamPage] = useState(1);
                  const [ticketFilter, setTicketFilter] = useState('all');
                  const [ticketPage, setTicketPage] = useState(1);
                  const [saasFilter, setSaasFilter] = useState('all'); // 'all', 'underutilized', 'full', 'unassigned'
                  const [saasUserFilter, setSaasUserFilter] = useState(''); // filter by contact id
                  const [saasView, setSaasView] = useState('licenses'); // 'licenses', 'users', 'spend'

  const isLoading = loadingCustomer || loadingContracts || loadingLicenses || loadingBills || loadingLineItems || loadingInvoices || loadingQuotes || loadingQuoteItems || loadingContractItems || loadingContacts || loadingTickets || loadingInvoiceLineItems || loadingAssignments;

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

  const handleSyncCustomer = async () => {
    if (!customer) return;
    try {
      setIsSyncing(true);
      const response = await base44.functions.invoke('syncHaloPSACustomers', { 
        action: 'sync_customer',
        customer_id: customer.external_id 
      });
      if (response.data.success) {
        toast.success(`Customer synced successfully!`);
        queryClient.invalidateQueries({ queryKey: ['customers'] });
        queryClient.invalidateQueries({ queryKey: ['contracts', customerId] });
        queryClient.invalidateQueries({ queryKey: ['licenses', customerId] });
      } else {
        toast.error(response.data.error || 'Sync failed');
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

      {/* Account Header */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-6 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="relative flex flex-col md:flex-row md:items-center gap-6">
          <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur flex items-center justify-center flex-shrink-0">
            {customer.logo_url ? (
              <img src={customer.logo_url} alt={customer.name} className="w-10 h-10 rounded-xl" />
            ) : (
              <Building2 className="w-8 h-8 text-white" />
            )}
          </div>
          <div className="flex-1">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-3">
              <h1 className="text-2xl font-bold">{customer.name}</h1>
              <Badge className={cn(
                "w-fit",
                customer.status === 'active' && "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
                customer.status === 'inactive' && "bg-slate-500/20 text-slate-300",
                customer.status === 'suspended' && "bg-red-500/20 text-red-300"
              )}>
                {customer.status || 'Active'}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-slate-300">
              {customer.email && (
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  {customer.email}
                </div>
              )}
              {customer.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  {customer.phone}
                </div>
              )}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="flex gap-6">
            <div className="text-center">
              <p className="text-2xl font-bold">{contacts.length}</p>
              <p className="text-xs text-slate-400">Team</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">{contracts.filter(c => c.status === 'active').length}</p>
              <p className="text-xs text-slate-400">Contracts</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">{tickets.filter(t => ['open', 'in_progress', 'new'].includes(t.status)).length}</p>
              <p className="text-xs text-slate-400">Open Tickets</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="bg-white border border-gray-200 rounded-2xl p-2 flex flex-wrap gap-2 h-auto shadow-sm">
          <TabsTrigger 
            value="overview" 
            className="flex-1 min-w-[140px] gap-3 py-4 px-6 rounded-xl text-gray-600 font-medium transition-all data-[state=active]:bg-gray-900 data-[state=active]:text-white data-[state=active]:shadow-lg hover:bg-gray-100 data-[state=active]:hover:bg-gray-800"
          >
            <Building2 className="w-5 h-5" />
            <span className="text-sm">Overview</span>
          </TabsTrigger>
          <TabsTrigger 
            value="contracts" 
            className="flex-1 min-w-[140px] gap-3 py-4 px-6 rounded-xl text-gray-600 font-medium transition-all data-[state=active]:bg-gray-900 data-[state=active]:text-white data-[state=active]:shadow-lg hover:bg-gray-100 data-[state=active]:hover:bg-gray-800"
          >
            <DollarSign className="w-5 h-5" />
            <span className="text-sm">Billing & Services</span>
          </TabsTrigger>
          <TabsTrigger 
            value="licenses" 
            className="flex-1 min-w-[140px] gap-3 py-4 px-6 rounded-xl text-gray-600 font-medium transition-all data-[state=active]:bg-gray-900 data-[state=active]:text-white data-[state=active]:shadow-lg hover:bg-gray-100 data-[state=active]:hover:bg-gray-800"
          >
            <Cloud className="w-5 h-5" />
            <span className="text-sm">SaaS</span>
          </TabsTrigger>
          <TabsTrigger 
            value="quotes" 
            className="flex-1 min-w-[140px] gap-3 py-4 px-6 rounded-xl text-gray-600 font-medium transition-all data-[state=active]:bg-gray-900 data-[state=active]:text-white data-[state=active]:shadow-lg hover:bg-gray-100 data-[state=active]:hover:bg-gray-800"
          >
            <FileText className="w-5 h-5" />
            <span className="text-sm">Quotes</span>
          </TabsTrigger>
          <TabsTrigger 
            value="tickets" 
            className="flex-1 min-w-[140px] gap-3 py-4 px-6 rounded-xl text-gray-600 font-medium transition-all data-[state=active]:bg-gray-900 data-[state=active]:text-white data-[state=active]:shadow-lg hover:bg-gray-100 data-[state=active]:hover:bg-gray-800"
          >
            <HelpCircle className="w-5 h-5" />
            <span className="text-sm">Support</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
                        <div className="space-y-6">


                          {/* Quick Stats Widgets */}
                          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="bg-white rounded-xl border border-slate-200/50 p-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                                  <Users className="w-5 h-5 text-blue-600" />
                                </div>
                                <div>
                                  <p className="text-2xl font-bold text-slate-900">{contacts.length}</p>
                                  <p className="text-xs text-slate-500">Team Members</p>
                                </div>
                              </div>
                            </div>
                            <div className="bg-white rounded-xl border border-slate-200/50 p-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                                  <DollarSign className="w-5 h-5 text-emerald-600" />
                                </div>
                                <div>
                                  <p className="text-2xl font-bold text-slate-900">
                                    ${recurringBills.reduce((sum, b) => sum + (b.amount || 0), 0).toLocaleString()}
                                  </p>
                                  <p className="text-xs text-slate-500">Monthly Spend</p>
                                </div>
                              </div>
                            </div>
                            <div className="bg-white rounded-xl border border-slate-200/50 p-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                                  <FileText className="w-5 h-5 text-orange-600" />
                                </div>
                                <div>
                                  <p className="text-2xl font-bold text-slate-900">{contracts.length}</p>
                                  <p className="text-xs text-slate-500">Active Contracts</p>
                                </div>
                              </div>
                            </div>
                            <div className="bg-white rounded-xl border border-slate-200/50 p-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                                  <Cloud className="w-5 h-5 text-purple-600" />
                                </div>
                                <div>
                                  <p className="text-2xl font-bold text-slate-900">{licenses.length}</p>
                                  <p className="text-xs text-slate-500">SaaS Licenses</p>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Active Contracts Widget */}
                          {contracts.length > 0 && (
                            <div className="bg-white rounded-2xl border border-slate-200/50 p-5">
                              <div className="flex items-center justify-between mb-4">
                                <h3 className="font-semibold text-slate-900">Active Contracts</h3>
                                <FileText className="w-5 h-5 text-slate-400" />
                              </div>
                              <div className="space-y-3">
                                {contracts
                                  .sort((a, b) => (b.status === 'active' ? 1 : 0) - (a.status === 'active' ? 1 : 0))
                                  .slice(0, 10)
                                  .map(contract => {
                                    const isActive = contract.status === 'active';
                                    const renewalDate = contract.renewal_date || contract.end_date;
                                    const daysUntil = renewalDate ? Math.ceil((new Date(renewalDate) - new Date()) / (1000 * 60 * 60 * 24)) : null;
                                    return (
                                      <div key={contract.id} className={cn(
                                        "flex items-center justify-between p-4 rounded-xl border",
                                        isActive ? 'bg-slate-50 border-slate-200' : 'bg-gray-50 border-gray-200'
                                      )}>
                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                          <div className={cn(
                                            "w-2 h-2 rounded-full flex-shrink-0",
                                            isActive ? "bg-emerald-500" : "bg-gray-400"
                                          )} />
                                          <div className="min-w-0">
                                            <p className="font-semibold text-slate-900 truncate">{contract.name}</p>
                                            <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                                              <span className="capitalize">{contract.type?.replace('_', ' ') || 'Contract'}</span>
                                              {contract.billing_cycle && (
                                                <span className="capitalize">{contract.billing_cycle}</span>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-4 flex-shrink-0">
                                          {contract.value > 0 && (
                                            <div className="text-right">
                                              <p className="font-bold text-slate-900">${contract.value.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                                              <p className="text-xs text-slate-500">/{contract.billing_cycle === 'annually' ? 'yr' : 'mo'}</p>
                                            </div>
                                          )}
                                          {renewalDate && (
                                            <div className={cn(
                                              "text-center px-3 py-1.5 rounded-lg text-xs",
                                              daysUntil && daysUntil <= 30 ? 'bg-red-100 text-red-700' :
                                              daysUntil && daysUntil <= 90 ? 'bg-amber-100 text-amber-700' :
                                              'bg-emerald-100 text-emerald-700'
                                            )}>
                                              <p className="font-medium">Renews</p>
                                              <p className="font-bold">{format(parseISO(renewalDate), 'MMM d')}</p>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                              </div>
                            </div>
                          )}

                          {/* Team Members / Users */}
                                            <div className="bg-white rounded-2xl border border-slate-200/50 p-6">
                                              <div className="flex items-center justify-between mb-4">
                                                <div>
                                                  <h3 className="font-semibold text-slate-900">Your Team</h3>
                                                  <p className="text-sm text-slate-500">{contacts.length} members</p>
                                                </div>
                                                {customer?.source === 'halopsa' && (
                                                  <Button 
                                                    size="sm"
                                                    variant="outline"
                                                    className="gap-2"
                                                    onClick={async () => {
                                                      try {
                                                        setIsSyncing(true);
                                                        const response = await base44.functions.invoke('syncHaloPSAContacts', { 
                                                          action: 'sync_customer',
                                                          customer_id: customer.external_id 
                                                        });
                                                        if (response.data.success) {
                                                          toast.success(`Synced ${response.data.recordsSynced} users!`);
                                                          queryClient.invalidateQueries({ queryKey: ['contacts', customerId] });
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
                                                    Sync Users
                                                  </Button>
                                                )}
                                              </div>
                                              {contacts.length === 0 ? (
                                                <div className="py-8 text-center">
                                                  <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                                                  <p className="text-slate-500">No team members found</p>
                                                  {customer?.source === 'halopsa' && (
                                                    <p className="text-sm text-slate-400 mt-1">Click "Sync Users" to pull from HaloPSA</p>
                                                  )}
                                                </div>
                                              ) : (
                                                <>
                                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                    {contacts.slice((teamPage - 1) * 10, teamPage * 10).map(contact => (
                                                      <div key={contact.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                                                        <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 font-medium">
                                                          {contact.full_name?.charAt(0) || '?'}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                          <p className="font-medium text-slate-900 truncate">{contact.full_name}</p>
                                                          <p className="text-sm text-slate-500 truncate">{contact.email || contact.title || 'No email'}</p>
                                                        </div>
                                                        {contact.is_primary && (
                                                          <Badge className="bg-purple-100 text-purple-700 text-xs">Primary</Badge>
                                                        )}
                                                      </div>
                                                    ))}
                                                  </div>
                                                  {contacts.length > 10 && (
                                                    <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t border-slate-100">
                                                      <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => setTeamPage(p => Math.max(1, p - 1))}
                                                        disabled={teamPage === 1}
                                                      >
                                                        Previous
                                                      </Button>
                                                      <span className="text-sm text-slate-600 px-3">
                                                        Page {teamPage} of {Math.ceil(contacts.length / 10)}
                                                      </span>
                                                      <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => setTeamPage(p => Math.min(Math.ceil(contacts.length / 25), p + 1))}
                                                        disabled={teamPage >= Math.ceil(contacts.length / 10)}
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

        <TabsContent value="contracts">
                        <div className="space-y-6">
                          
                          {/* Clean Summary Cards */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Monthly Cost Card */}
                            <div className="bg-white rounded-2xl border border-gray-200 p-6">
                              <p className="text-sm text-gray-500 mb-1">Monthly Cost</p>
                              <p className="text-3xl font-bold text-gray-900">
                                ${recurringBills.reduce((sum, b) => sum + (b.amount || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                              </p>
                              <p className="text-xs text-gray-400 mt-2">{lineItems.length} services included</p>
                            </div>
                            
                            {/* Contract Card */}
                            <div className="bg-white rounded-2xl border border-gray-200 p-6">
                              <div className="flex items-center justify-between mb-3">
                                <p className="text-sm text-gray-500">Your Contract</p>
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
                                    <RefreshCw className={cn("w-4 h-4", isSyncing && "animate-spin")} />
                                  </button>
                                )}
                              </div>
                              {contracts.length > 0 ? (
                                <div>
                                  {contracts.slice(0, 1).map(contract => (
                                    <div key={contract.id}>
                                      <p className="text-lg font-semibold text-gray-900">{contract.name}</p>
                                      {contract.renewal_date && (
                                        <p className="text-sm text-gray-500 mt-1">
                                          Renews {format(parseISO(contract.renewal_date), 'MMM d, yyyy')}
                                        </p>
                                      )}
                                    </div>
                                  ))}
                                  {contracts.length > 1 && (
                                    <p className="text-xs text-gray-400 mt-2">+{contracts.length - 1} more contract{contracts.length > 2 ? 's' : ''}</p>
                                  )}
                                </div>
                              ) : (
                                <p className="text-gray-400">No active contract</p>
                              )}
                            </div>
                            
                            {/* Invoice Status Card */}
                            <div className="bg-white rounded-2xl border border-gray-200 p-6">
                              <p className="text-sm text-gray-500 mb-3">Invoice Status</p>
                              <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                  <div className="w-3 h-3 rounded-full bg-emerald-500" />
                                  <span className="text-sm text-gray-600">{invoices.filter(i => i.status === 'paid').length} Paid</span>
                                </div>
                                {invoices.filter(i => i.status === 'sent').length > 0 && (
                                  <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-amber-400" />
                                    <span className="text-sm text-gray-600">{invoices.filter(i => i.status === 'sent').length} Pending</span>
                                  </div>
                                )}
                                {invoices.filter(i => i.status === 'overdue').length > 0 && (
                                  <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-red-500" />
                                    <span className="text-sm text-gray-600">{invoices.filter(i => i.status === 'overdue').length} Overdue</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Services Section */}
                          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                            <button
                              onClick={() => setExpandedBills(prev => ({ ...prev, _section: !prev._section }))}
                              className="w-full px-6 py-5 flex items-center justify-between hover:bg-gray-50 transition-colors"
                            >
                              <div>
                                <h3 className="font-semibold text-gray-900 text-left">Your Services</h3>
                                <p className="text-sm text-gray-500 mt-0.5">{lineItems.length} items • ${lineItems.reduce((sum, item) => sum + (item.net_amount || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}/month</p>
                              </div>
                              <div className="flex items-center gap-3">
                                {customer?.source === 'halopsa' && (
                                  <button
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      try {
                                        setIsSyncing(true);
                                        const response = await base44.functions.invoke('syncHaloPSARecurringBills', { 
                                          action: 'sync_customer',
                                          customer_id: customer.external_id 
                                        });
                                        if (response.data.success) {
                                          toast.success(`Synced!`);
                                          queryClient.invalidateQueries({ queryKey: ['recurring_bills', customerId] });
                                          queryClient.invalidateQueries({ queryKey: ['line_items', customerId] });
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
                                    className="text-gray-400 hover:text-gray-600 p-2"
                                  >
                                    <RefreshCw className={cn("w-4 h-4", isSyncing && "animate-spin")} />
                                  </button>
                                )}
                                <ChevronDown className={cn(
                                  "w-5 h-5 text-gray-400 transition-transform",
                                  expandedBills._section && "rotate-180"
                                )} />
                              </div>
                            </button>
                            
                            {expandedBills._section && (
                              <div className="border-t border-gray-100">
                                {lineItems.length === 0 ? (
                                  <div className="py-12 text-center">
                                    <p className="text-gray-500">No services found</p>
                                  </div>
                                ) : (
                                  <div className="divide-y divide-gray-100">
                                    {lineItems.map(item => (
                                      <div key={item.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50">
                                        <div className="flex-1 min-w-0">
                                          <p className="font-medium text-gray-900">{item.description?.replace(/\s*\$recurringbillingdate\s*/gi, '').trim()}</p>
                                          <p className="text-sm text-gray-500 mt-0.5">Qty: {item.quantity}</p>
                                        </div>
                                        <p className="font-semibold text-gray-900 text-lg">${(item.net_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
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

        <TabsContent value="licenses">
          <div className="space-y-6">
            {/* SaaS Summary Cards - All Clickable */}
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
              const fullyUtilizedLicenses = licenses.filter(l => {
                const assigned = licenseAssignments.filter(a => a.license_id === l.id && a.status === 'active').length;
                return l.quantity > 0 && assigned >= l.quantity;
              });
              
              return (
                <>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Total Spend - Click to view spend breakdown */}
                    <button
                      onClick={() => setSaasView('spend')}
                      className={cn(
                        "bg-white rounded-2xl border-2 p-5 text-left transition-all hover:shadow-md",
                        saasView === 'spend' ? "border-purple-500 shadow-md" : "border-gray-200"
                      )}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <DollarSign className="w-4 h-4 text-purple-600" />
                        <p className="text-sm text-gray-500">Monthly Spend</p>
                      </div>
                      <p className="text-2xl font-bold text-gray-900">
                        ${totalSpend.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </p>
                      {wastedSpend > 0 && (
                        <p className="text-xs text-red-500 mt-1">~${wastedSpend.toFixed(0)} unused</p>
                      )}
                    </button>
                    
                    {/* Utilization Rate - Click to see all */}
                    <button
                      onClick={() => { setSaasFilter('all'); setSaasView('licenses'); }}
                      className={cn(
                        "bg-white rounded-2xl border-2 p-5 text-left transition-all hover:shadow-md",
                        saasFilter === 'all' && saasView === 'licenses' ? "border-purple-500 shadow-md" : "border-gray-200"
                      )}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Monitor className="w-4 h-4 text-blue-600" />
                        <p className="text-sm text-gray-500">Utilization</p>
                      </div>
                      <p className="text-2xl font-bold text-gray-900">
                        {utilizationRate.toFixed(0)}%
                      </p>
                      <p className="text-xs text-gray-400">{assignedSeats}/{totalSeats} seats</p>
                    </button>
                    
                    {/* Underutilized - Click to filter */}
                    <button
                      onClick={() => { setSaasFilter('underutilized'); setSaasView('licenses'); }}
                      className={cn(
                        "bg-white rounded-2xl border-2 p-5 text-left transition-all hover:shadow-md",
                        saasFilter === 'underutilized' ? "border-amber-500 shadow-md" : "border-gray-200"
                      )}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <AlertCircle className="w-4 h-4 text-amber-500" />
                        <p className="text-sm text-gray-500">Underutilized</p>
                      </div>
                      <p className="text-2xl font-bold text-amber-600">{underutilizedLicenses.length}</p>
                      <p className="text-xs text-gray-400">&lt;50% usage</p>
                    </button>
                    
                    {/* User View - Click to see by user */}
                    <button
                      onClick={() => setSaasView('users')}
                      className={cn(
                        "bg-white rounded-2xl border-2 p-5 text-left transition-all hover:shadow-md",
                        saasView === 'users' ? "border-purple-500 shadow-md" : "border-gray-200"
                      )}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Users className="w-4 h-4 text-emerald-600" />
                        <p className="text-sm text-gray-500">By User</p>
                      </div>
                      <p className="text-2xl font-bold text-gray-900">{contacts.length}</p>
                      <p className="text-xs text-gray-400">team members</p>
                    </button>
                  </div>

                  {/* Secondary Stats Row */}
                  <div className="grid grid-cols-3 gap-4">
                    <button
                      onClick={() => { setSaasFilter('full'); setSaasView('licenses'); }}
                      className={cn(
                        "bg-white rounded-xl border p-4 text-left transition-all hover:bg-gray-50",
                        saasFilter === 'full' ? "border-emerald-500 bg-emerald-50" : "border-gray-200"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-gray-500">Fully Assigned</p>
                          <p className="text-lg font-bold text-emerald-600">{fullyUtilizedLicenses.length}</p>
                        </div>
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                      </div>
                    </button>
                    <button
                      onClick={() => { setSaasFilter('unassigned'); setSaasView('licenses'); }}
                      className={cn(
                        "bg-white rounded-xl border p-4 text-left transition-all hover:bg-gray-50",
                        saasFilter === 'unassigned' ? "border-red-500 bg-red-50" : "border-gray-200"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-gray-500">Unused Seats</p>
                          <p className="text-lg font-bold text-red-600">{unusedSeats}</p>
                        </div>
                        <AlertCircle className="w-5 h-5 text-red-500" />
                      </div>
                    </button>
                    <div className="bg-white rounded-xl border border-gray-200 p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-gray-500">Applications</p>
                          <p className="text-lg font-bold text-gray-900">{licenses.length}</p>
                        </div>
                        <Cloud className="w-5 h-5 text-purple-500" />
                      </div>
                    </div>
                  </div>
                </>
              );
            })()}

            {/* View Switcher & Filters */}
            <div className="flex flex-wrap items-center gap-3">
              {saasView === 'licenses' && (
                <select
                  value={saasFilter}
                  onChange={(e) => setSaasFilter(e.target.value)}
                  className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white"
                >
                  <option value="all">All Licenses</option>
                  <option value="underutilized">Underutilized (&lt;50%)</option>
                  <option value="full">Fully Assigned</option>
                  <option value="unassigned">Has Unused Seats</option>
                </select>
              )}
              {saasView === 'users' && (
                <select
                  value={saasUserFilter}
                  onChange={(e) => setSaasUserFilter(e.target.value)}
                  className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white min-w-[200px]"
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
                onClick={() => setShowAddLicense(true)}
              >
                <Plus className="w-4 h-4" />
                Add License
              </Button>
            </div>

            {/* Conditional Views */}
            {saasView === 'licenses' && (
              <div className="bg-white rounded-2xl border border-slate-200/50 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100">
                  <h3 className="font-semibold text-slate-900">
                    {saasFilter === 'all' && 'All SaaS Licenses'}
                    {saasFilter === 'underutilized' && 'Underutilized Licenses'}
                    {saasFilter === 'full' && 'Fully Assigned Licenses'}
                    {saasFilter === 'unassigned' && 'Licenses with Unused Seats'}
                  </h3>
                </div>
                {(() => {
                  const filteredLicenses = licenses.filter(license => {
                    const assignedCount = licenseAssignments.filter(a => a.license_id === license.id && a.status === 'active').length;
                    const utilization = license.quantity > 0 ? assignedCount / license.quantity : 0;
                    if (saasFilter === 'underutilized') return utilization < 0.5 && license.quantity > 0;
                    if (saasFilter === 'full') return assignedCount >= (license.quantity || 0) && license.quantity > 0;
                    if (saasFilter === 'unassigned') return assignedCount < (license.quantity || 0);
                    return true;
                  });
                  
                  if (filteredLicenses.length === 0) {
                    return (
                      <div className="p-12 text-center">
                        <Cloud className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                        <p className="text-slate-500">No licenses match this filter</p>
                      </div>
                    );
                  }
                  
                  return (
                    <div className="divide-y divide-slate-100">
                      {filteredLicenses.map((license) => {
                        const assignedCount = licenseAssignments.filter(a => a.license_id === license.id && a.status === 'active').length;
                        const utilizationPercent = license.quantity > 0 ? (assignedCount / license.quantity) * 100 : 0;
                        const unusedSeats = (license.quantity || 0) - assignedCount;
                        const wastedCost = license.quantity > 0 ? (unusedSeats / license.quantity) * (license.total_cost || 0) : 0;
                        
                        return (
                          <div key={license.id} className="p-5 hover:bg-slate-50 transition-colors">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                <div className={cn(
                                  "w-12 h-12 rounded-xl flex items-center justify-center",
                                  utilizationPercent >= 90 ? "bg-emerald-100" :
                                  utilizationPercent >= 50 ? "bg-amber-100" : "bg-red-100"
                                )}>
                                  <Cloud className={cn(
                                    "w-6 h-6",
                                    utilizationPercent >= 90 ? "text-emerald-600" :
                                    utilizationPercent >= 50 ? "text-amber-600" : "text-red-600"
                                  )} />
                                </div>
                                <div>
                                  <h3 className="font-semibold text-slate-900">{license.application_name}</h3>
                                  <div className="flex items-center gap-3 mt-1">
                                    {license.vendor && <span className="text-sm text-slate-500">{license.vendor}</span>}
                                    {license.license_type && <span className="text-sm text-slate-400">• {license.license_type}</span>}
                                    {unusedSeats > 0 && wastedCost > 0 && (
                                      <Badge className="bg-red-100 text-red-700 text-xs">
                                        ${wastedCost.toFixed(0)} wasted
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-6">
                                <div className="text-right">
                                  <p className="text-sm text-slate-500">Usage</p>
                                  <p className="font-semibold text-slate-900">
                                    {assignedCount} / {license.quantity || 0}
                                  </p>
                                </div>
                                <div className="w-24">
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
                                  <p className="text-xs text-slate-500 text-center mt-1">{utilizationPercent.toFixed(0)}%</p>
                                </div>
                                <div className="text-right min-w-[80px]">
                                  <p className="text-sm text-slate-500">Cost</p>
                                  <p className="font-semibold text-slate-900">${(license.total_cost || 0).toLocaleString()}</p>
                                </div>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => setSelectedLicense(license)}
                                >
                                  Manage
                                </Button>
                              </div>
                            </div>
                            
                            {/* Assigned Users Preview */}
                            {assignedCount > 0 && (
                              <div className="mt-4 pt-4 border-t border-slate-100">
                                <p className="text-xs text-slate-500 mb-2">Assigned to:</p>
                                <div className="flex flex-wrap gap-2">
                                  {licenseAssignments
                                    .filter(a => a.license_id === license.id && a.status === 'active')
                                    .slice(0, 5)
                                    .map(assignment => {
                                      const contact = contacts.find(c => c.id === assignment.contact_id);
                                      return contact ? (
                                        <button
                                          key={assignment.id}
                                          onClick={() => { setSaasUserFilter(contact.id); setSaasView('users'); }}
                                          className="flex items-center gap-2 px-2 py-1 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                                        >
                                          <div className="w-6 h-6 rounded-full bg-purple-200 flex items-center justify-center text-xs font-medium text-purple-700">
                                            {contact.full_name?.charAt(0)}
                                          </div>
                                          <span className="text-sm text-slate-700">{contact.full_name}</span>
                                        </button>
                                      ) : null;
                                    })}
                                  {assignedCount > 5 && (
                                    <span className="text-sm text-slate-500 px-2 py-1">+{assignedCount - 5} more</span>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
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
                                  <Cloud className="w-4 h-4 text-purple-600" />
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
                            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
                              <Cloud className="w-5 h-5 text-purple-600" />
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
                                        {/* Ticket Stats Widgets */}
                                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                          <div className="bg-white rounded-xl border border-slate-200/50 p-4">
                                            <div className="flex items-center gap-3">
                                              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                                                <Monitor className="w-5 h-5 text-blue-600" />
                                              </div>
                                              <div>
                                                <p className="text-2xl font-bold text-slate-900">{tickets.length}</p>
                                                <p className="text-xs text-slate-500">Total Tickets</p>
                                              </div>
                                            </div>
                                          </div>
                                          <div className="bg-white rounded-xl border border-slate-200/50 p-4">
                                            <div className="flex items-center gap-3">
                                              <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                                                <Monitor className="w-5 h-5 text-emerald-600" />
                                              </div>
                                              <div>
                                                <p className="text-2xl font-bold text-slate-900">
                                                  {tickets.filter(t => ['open', 'in_progress', 'new'].includes(t.status)).length}
                                                </p>
                                                <p className="text-xs text-slate-500">Open Tickets</p>
                                              </div>
                                            </div>
                                          </div>
                                          <div className="bg-white rounded-xl border border-slate-200/50 p-4">
                                            <div className="flex items-center gap-3">
                                              <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                                                <Monitor className="w-5 h-5 text-red-600" />
                                              </div>
                                              <div>
                                                <p className="text-2xl font-bold text-slate-900">
                                                  {tickets.filter(t => ['critical', 'high'].includes(t.priority)).length}
                                                </p>
                                                <p className="text-xs text-slate-500">High Priority</p>
                                              </div>
                                            </div>
                                          </div>
                                          <div className="bg-white rounded-xl border border-slate-200/50 p-4">
                                            <div className="flex items-center gap-3">
                                              <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                                                <Monitor className="w-5 h-5 text-purple-600" />
                                              </div>
                                              <div>
                                                <p className="text-2xl font-bold text-slate-900">
                                                                            {tickets.filter(t => ['closed', 'resolved'].includes(t.status)).length}
                                                                          </p>
                                                                          <p className="text-xs text-slate-500">Resolved</p>
                                              </div>
                                            </div>
                                          </div>
                                        </div>

                                      <div className="bg-white rounded-2xl border border-slate-200/50 p-6">
                          <div className="flex items-center justify-between mb-6">
                            <div>
                              <h3 className="text-lg font-semibold text-slate-900">Support Tickets</h3>
                              <p className="text-sm text-slate-500">{tickets.length} tickets</p>
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
                                  Sync Tickets
                                </Button>
                              )}
                              <div className="flex items-center gap-2">
                                <Filter className="w-4 h-4 text-slate-400" />
                                <select
                                  value={ticketFilter}
                                  onChange={(e) => { setTicketFilter(e.target.value); setTicketPage(1); }}
                                  className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                >
                                  <option value="all">All</option>
                                  <option value="open">Open</option>
                                  <option value="in_progress">In Progress</option>
                                  <option value="waiting">Waiting</option>
                                  <option value="resolved">Resolved</option>
                                  <option value="closed">Closed</option>
                                </select>
                              </div>
                            </div>
                          </div>

                          {tickets.length === 0 ? (
                            <div className="py-12 text-center">
                              <Monitor className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                              <p className="text-slate-500">No tickets found</p>
                              {customer?.source === 'halopsa' && (
                                <p className="text-sm text-slate-400 mt-1">Click "Sync Tickets" to pull from HaloPSA</p>
                              )}
                            </div>
                          ) : (
                            <>
                              <div className="space-y-3">
                                {tickets
                                                          .filter(t => ticketFilter === 'all' || t.status === ticketFilter)
                                                          .sort((a, b) => new Date(b.date_opened || 0) - new Date(a.date_opened || 0))
                                                          .slice((ticketPage - 1) * 10, ticketPage * 10)
                                  .map(ticket => (
                                    <div key={ticket.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors">
                                      <div className="flex items-center gap-4 flex-1 min-w-0">
                                        <div className={cn(
                                          "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
                                          ticket.priority === 'critical' && "bg-red-100",
                                          ticket.priority === 'high' && "bg-orange-100",
                                          ticket.priority === 'medium' && "bg-yellow-100",
                                          ticket.priority === 'low' && "bg-blue-100"
                                        )}>
                                          <Monitor className={cn(
                                            "w-5 h-5",
                                            ticket.priority === 'critical' && "text-red-600",
                                            ticket.priority === 'high' && "text-orange-600",
                                            ticket.priority === 'medium' && "text-yellow-600",
                                            ticket.priority === 'low' && "text-blue-600"
                                          )} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <p className="font-semibold text-slate-900 truncate">#{ticket.ticket_number} - {ticket.summary}</p>
                                          <div className="flex items-center gap-3 text-sm text-slate-500">
                                            {ticket.requested_by && <span>By: {ticket.requested_by}</span>}
                                            {ticket.date_opened && (
                                              <span>Opened: {format(parseISO(ticket.date_opened), 'MMM d, yyyy')}</span>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2 flex-shrink-0">
                                        <Badge className={cn(
                                          'text-xs capitalize',
                                          ticket.priority === 'critical' && 'bg-red-100 text-red-700',
                                          ticket.priority === 'high' && 'bg-orange-100 text-orange-700',
                                          ticket.priority === 'medium' && 'bg-yellow-100 text-yellow-700',
                                          ticket.priority === 'low' && 'bg-blue-100 text-blue-700'
                                        )}>
                                          {ticket.priority}
                                        </Badge>
                                        <Badge className={cn(
                                          'text-xs capitalize',
                                          ticket.status === 'open' && 'bg-emerald-100 text-emerald-700',
                                          ticket.status === 'in_progress' && 'bg-blue-100 text-blue-700',
                                          ticket.status === 'waiting' && 'bg-yellow-100 text-yellow-700',
                                          ticket.status === 'resolved' && 'bg-purple-100 text-purple-700',
                                          ticket.status === 'closed' && 'bg-slate-100 text-slate-700'
                                        )}>
                                          {ticket.status?.replace('_', ' ')}
                                        </Badge>
                                      </div>
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