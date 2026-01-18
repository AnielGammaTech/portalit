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
  HelpCircle
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { format, parseISO } from 'date-fns';

export default function CustomerDetail() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [user, setUser] = useState(null);
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

  const [expandedBills, setExpandedBills] = useState({});
              const [expandedQuotes, setExpandedQuotes] = useState({});
              const [expandedContracts, setExpandedContracts] = useState({});
              const [expandedInvoices, setExpandedInvoices] = useState({});
              const [invoiceFilter, setInvoiceFilter] = useState('all');
                  const [teamPage, setTeamPage] = useState(1);
                  const [ticketFilter, setTicketFilter] = useState('all');
                  const [ticketPage, setTicketPage] = useState(1);

  const isLoading = loadingCustomer || loadingContracts || loadingLicenses || loadingBills || loadingLineItems || loadingInvoices || loadingQuotes || loadingQuoteItems || loadingContractItems || loadingContacts || loadingTickets || loadingInvoiceLineItems;

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
            <span className="text-sm">Software</span>
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

                          {/* Contract Renewal Widget */}
                          {contracts.filter(c => c.renewal_date || c.end_date).length > 0 && (
                            <div className="bg-white rounded-2xl border border-slate-200/50 p-6">
                              <div className="flex items-center justify-between mb-4">
                                <h3 className="font-semibold text-slate-900">Upcoming Renewals</h3>
                                <Calendar className="w-5 h-5 text-slate-400" />
                              </div>
                              <div className="space-y-3">
                                {contracts
                                  .filter(c => c.renewal_date || c.end_date)
                                  .sort((a, b) => new Date(a.renewal_date || a.end_date) - new Date(b.renewal_date || b.end_date))
                                  .slice(0, 3)
                                  .map(contract => {
                                    const renewalDate = contract.renewal_date || contract.end_date;
                                    const daysUntil = Math.ceil((new Date(renewalDate) - new Date()) / (1000 * 60 * 60 * 24));
                                    return (
                                      <div key={contract.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                                        <div>
                                          <p className="font-medium text-slate-900">{contract.name}</p>
                                          <p className="text-sm text-slate-500">
                                            {renewalDate ? format(parseISO(renewalDate), 'MMMM d, yyyy') : 'No date'}
                                          </p>
                                        </div>
                                        <Badge className={cn(
                                          daysUntil <= 30 ? 'bg-red-100 text-red-700' :
                                          daysUntil <= 90 ? 'bg-yellow-100 text-yellow-700' :
                                          'bg-emerald-100 text-emerald-700'
                                        )}>
                                          {daysUntil > 0 ? `${daysUntil} days` : 'Expired'}
                                        </Badge>
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
                        <div className="space-y-8">
                          
                          {/* Monthly Summary - Clean Gray Header */}
                          <div className="bg-gradient-to-r from-gray-800 to-gray-900 rounded-2xl p-8 text-white shadow-xl">
                            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
                              <div>
                                <p className="text-gray-400 text-sm font-medium uppercase tracking-wider mb-2">Monthly Recurring</p>
                                <p className="text-5xl font-bold tracking-tight">
                                  ${recurringBills.reduce((sum, b) => sum + (b.amount || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </p>
                              </div>
                              <div className="flex gap-8">
                                <div className="text-center">
                                  <p className="text-3xl font-bold">{contracts.filter(c => c.status === 'active').length}</p>
                                  <p className="text-gray-400 text-xs uppercase tracking-wide mt-1">Active Contracts</p>
                                </div>
                                <div className="text-center">
                                  <p className="text-3xl font-bold">{invoices.filter(i => i.status === 'paid').length}</p>
                                  <p className="text-gray-400 text-xs uppercase tracking-wide mt-1">Invoices Paid</p>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Contracts Section - Card Grid */}
                          <div>
                            <div className="flex items-center justify-between mb-5">
                              <div>
                                <h3 className="text-xl font-semibold text-gray-900">Service Agreements</h3>
                                <p className="text-sm text-gray-500 mt-0.5">{contracts.length} contract{contracts.length !== 1 ? 's' : ''} on file</p>
                              </div>
                              {customer?.source === 'halopsa' && (
                                <Button 
                                  size="sm"
                                  variant="outline"
                                  className="gap-2 border-gray-300 text-gray-700 hover:bg-gray-100"
                                  onClick={async () => {
                                    try {
                                      setIsSyncing(true);
                                      const response = await base44.functions.invoke('syncHaloPSAContracts', { 
                                        action: 'sync_customer',
                                        customer_id: customer.external_id 
                                      });
                                      if (response.data.success) {
                                        toast.success(`Synced ${response.data.recordsSynced} contracts!`);
                                        queryClient.invalidateQueries({ queryKey: ['contracts', customerId] });
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
                            </div>

                            {contracts.length === 0 ? (
                              <div className="bg-gray-50 rounded-2xl py-16 text-center border-2 border-dashed border-gray-200">
                                <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                                <p className="text-gray-500 font-medium">No contracts on file</p>
                                <p className="text-gray-400 text-sm mt-1">Contracts will appear here once added</p>
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {contracts.map(contract => {
                                  const isExpanded = expandedContracts[contract.id];
                                  const isActive = contract.status === 'active';
                                  return (
                                    <div 
                                      key={contract.id} 
                                      className={cn(
                                        "bg-white border-2 rounded-xl transition-all duration-200 overflow-hidden",
                                        isActive ? "border-gray-200 hover:border-gray-400 hover:shadow-md" : "border-gray-100 bg-gray-50",
                                        isExpanded && "sm:col-span-2 lg:col-span-3"
                                      )}
                                    >
                                      <button
                                        onClick={() => setExpandedContracts(prev => ({ ...prev, [contract.id]: !prev[contract.id] }))}
                                        className="w-full p-5 text-left"
                                      >
                                        <div className="flex items-start justify-between gap-3">
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-2">
                                              <span className={cn(
                                                "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium",
                                                isActive ? "bg-gray-900 text-white" : "bg-gray-200 text-gray-600"
                                              )}>
                                                {isActive ? '● Active' : contract.status}
                                              </span>
                                            </div>
                                            <p className="font-semibold text-gray-900 truncate text-base">{contract.name}</p>
                                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-gray-500">
                                              {contract.start_date && (
                                                <span className="flex items-center gap-1">
                                                  <Calendar className="w-3 h-3" />
                                                  Since {format(parseISO(contract.start_date), 'MMM yyyy')}
                                                </span>
                                              )}
                                              {contract.renewal_date && (
                                                <span className="flex items-center gap-1 text-gray-700 font-medium">
                                                  <RefreshCw className="w-3 h-3" />
                                                  Renews {format(parseISO(contract.renewal_date), 'MMM d, yyyy')}
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                          <ChevronDown className={cn(
                                            "w-5 h-5 text-gray-400 transition-transform flex-shrink-0", 
                                            isExpanded && "rotate-180"
                                          )} />
                                        </div>
                                      </button>

                                      {isExpanded && (
                                        <div className="px-5 pb-5 pt-0 border-t border-gray-100">
                                          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-4">
                                            <div>
                                              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Start Date</p>
                                              <p className="text-sm font-semibold text-gray-900">
                                                {contract.start_date ? format(parseISO(contract.start_date), 'MMM d, yyyy') : '—'}
                                              </p>
                                            </div>
                                            <div>
                                              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">End Date</p>
                                              <p className="text-sm font-semibold text-gray-900">
                                                {contract.end_date ? format(parseISO(contract.end_date), 'MMM d, yyyy') : 'Ongoing'}
                                              </p>
                                            </div>
                                            <div>
                                              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Next Renewal</p>
                                              <p className="text-sm font-semibold text-gray-900">
                                                {contract.renewal_date ? format(parseISO(contract.renewal_date), 'MMM d, yyyy') : '—'}
                                              </p>
                                            </div>
                                            <div>
                                              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Value</p>
                                              <p className="text-sm font-semibold text-gray-900">
                                                {contract.value > 0 
                                                  ? `$${contract.value.toLocaleString('en-US', { minimumFractionDigits: 2 })}/${contract.billing_cycle === 'annually' ? 'yr' : 'mo'}`
                                                  : '—'
                                                }
                                              </p>
                                            </div>
                                          </div>
                                          {contract.description && (
                                            <div className="mt-4 pt-4 border-t border-gray-100">
                                              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Description</p>
                                              <p className="text-sm text-gray-700">{contract.description}</p>
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          {/* Services Breakdown - Clean Table */}
                          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
                              <div>
                                <h3 className="text-lg font-semibold text-gray-900">Current Services</h3>
                                <p className="text-sm text-gray-500 mt-0.5">Itemized breakdown of your recurring charges</p>
                              </div>
                              {customer?.source === 'halopsa' && (
                                <Button 
                                  size="sm"
                                  variant="ghost"
                                  className="gap-2 text-gray-600 hover:text-gray-900"
                                  onClick={async () => {
                                    try {
                                      setIsSyncing(true);
                                      const response = await base44.functions.invoke('syncHaloPSARecurringBills', { 
                                        action: 'sync_customer',
                                        customer_id: customer.external_id 
                                      });
                                      if (response.data.success) {
                                        toast.success(`Synced successfully!`);
                                        queryClient.invalidateQueries({ queryKey: ['recurring_bills', customerId] });
                                        queryClient.invalidateQueries({ queryKey: ['line_items', customerId] });
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
                                  Refresh
                                </Button>
                              )}
                            </div>

                            {lineItems.length === 0 ? (
                              <div className="py-16 text-center">
                                <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                                <p className="text-gray-500">No service items found</p>
                              </div>
                            ) : (
                              <div className="overflow-x-auto">
                                <table className="w-full">
                                  <thead>
                                    <tr className="bg-gray-50">
                                      <th className="text-left py-3 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Service</th>
                                      <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Qty</th>
                                      <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Unit Price</th>
                                      <th className="text-right py-3 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-100">
                                    {lineItems.map(item => (
                                      <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="py-4 px-6">
                                          <p className="font-medium text-gray-900">{item.description?.replace(/\s*\$recurringbillingdate\s*/gi, '').trim()}</p>
                                          {item.item_code && <p className="text-xs text-gray-400 mt-0.5">Code: {item.item_code}</p>}
                                        </td>
                                        <td className="py-4 px-4 text-center text-gray-600 font-medium">{item.quantity}</td>
                                        <td className="py-4 px-4 text-right text-gray-600">
                                          ${(item.price || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="py-4 px-6 text-right font-semibold text-gray-900">
                                          ${(item.net_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                                <div className="bg-gray-900 px-6 py-4 flex items-center justify-between">
                                  <span className="text-gray-300 font-medium">Monthly Total</span>
                                  <span className="text-2xl font-bold text-white">
                                    ${lineItems.reduce((sum, item) => sum + (item.net_amount || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Invoices Section - Refined Design */}
                          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                            <div className="px-6 py-5 border-b border-gray-100">
                              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                <div>
                                  <h3 className="text-lg font-semibold text-gray-900">Invoice History</h3>
                                  <p className="text-sm text-gray-500 mt-0.5">{invoices.length} invoices on record</p>
                                </div>
                                <div className="flex items-center gap-3">
                                  {customer?.source === 'halopsa' && (
                                    <Button 
                                      size="sm"
                                      variant="ghost"
                                      className="gap-2 text-gray-600 hover:text-gray-900"
                                      onClick={async () => {
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
                                    className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
                                  >
                                    <option value="all">All Invoices</option>
                                    <option value="paid">Paid</option>
                                    <option value="overdue">Overdue</option>
                                    <option value="sent">Pending</option>
                                  </select>
                                </div>
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
                                  <div className="bg-gray-50 rounded-xl p-4 border-l-4 border-gray-400">
                                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Paid</p>
                                    <p className="text-xl font-bold text-gray-900 mt-1">
                                      ${invoices.filter(i => i.status === 'paid').reduce((sum, inv) => sum + (inv.total || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                    </p>
                                  </div>
                                  <div className="bg-gray-50 rounded-xl p-4 border-l-4 border-gray-300">
                                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Pending</p>
                                    <p className="text-xl font-bold text-gray-900 mt-1">
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
                                              isPaid && "bg-gray-100",
                                              isOverdue && "bg-red-100",
                                              !isPaid && !isOverdue && "bg-gray-100"
                                            )}>
                                              {isPaid ? (
                                                <CheckCircle2 className="w-5 h-5 text-gray-600" />
                                              ) : (
                                                <FileText className={cn(
                                                  "w-5 h-5",
                                                  isOverdue ? "text-red-600" : "text-gray-500"
                                                )} />
                                              )}
                                            </div>
                                            <div className="text-left">
                                              <div className="flex items-center gap-3">
                                                <p className="font-semibold text-gray-900">{invoice.invoice_number}</p>
                                                <span className={cn(
                                                  "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                                                  isPaid && "bg-gray-200 text-gray-700",
                                                  isOverdue && "bg-red-100 text-red-700",
                                                  invoice.status === 'sent' && "bg-gray-100 text-gray-600"
                                                )}>
                                                  {isPaid ? 'Paid' : isOverdue ? 'Overdue' : 'Pending'}
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
                                              isPaid ? "text-gray-600" : "text-gray-900"
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
                        </div>
                      </TabsContent>

        <TabsContent value="licenses">
          <div className="bg-white rounded-2xl border border-slate-200/50 overflow-hidden">
            {licenses.length === 0 ? (
              <div className="p-12 text-center">
                <Cloud className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">No SaaS licenses found</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {licenses.map((license) => (
                  <div key={license.id} className="p-6 hover:bg-slate-50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-medium text-slate-900">{license.application_name}</h3>
                        <div className="flex items-center gap-4 mt-2">
                          <span className="text-sm text-slate-500">{license.vendor}</span>
                          <span className="text-sm text-slate-500">{license.license_type}</span>
                          <Badge variant="outline" className={cn(
                            "capitalize",
                            license.status === 'active' && "border-emerald-200 bg-emerald-50 text-emerald-700"
                          )}>
                            {license.status}
                          </Badge>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-semibold text-slate-900">
                          {license.assigned_users || 0} / {license.quantity || 0}
                        </p>
                        <p className="text-sm text-slate-500">
                          ${(license.total_cost || 0).toLocaleString()}/mo
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
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