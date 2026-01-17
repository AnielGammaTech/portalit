import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { 
  Building2, 
  FileText, 
  Cloud, 
  DollarSign, 
  Users, 
  Monitor,
  Calendar,
  ChevronRight,
  RefreshCw,
  HelpCircle,
  Phone,
  Mail,
  Clock,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ExternalLink
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { format, parseISO, differenceInDays } from 'date-fns';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { toast } from 'sonner';

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [expandedInvoices, setExpandedInvoices] = useState({});
  const queryClient = useQueryClient();

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

  // Find customer linked to user
  const { data: customers = [], isLoading: loadingCustomers } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list('-created_date', 500),
  });

  // For now, get first customer or match by email domain
  useEffect(() => {
    if (customers.length > 0 && user) {
      // Try to match customer by user email domain or just use first customer for demo
      const emailDomain = user.email?.split('@')[1];
      const matched = customers.find(c => 
        c.email?.includes(emailDomain) || 
        c.name?.toLowerCase().includes(emailDomain?.split('.')[0])
      );
      setCustomer(matched || customers[0]);
    }
  }, [customers, user]);

  const customerId = customer?.id;

  // Fetch customer-specific data
  const { data: contracts = [], isLoading: loadingContracts } = useQuery({
    queryKey: ['contracts', customerId],
    queryFn: () => base44.entities.Contract.filter({ customer_id: customerId }),
    enabled: !!customerId
  });

  const { data: recurringBills = [], isLoading: loadingBills } = useQuery({
    queryKey: ['recurring_bills', customerId],
    queryFn: () => base44.entities.RecurringBill.filter({ customer_id: customerId }),
    enabled: !!customerId
  });

  const { data: lineItems = [] } = useQuery({
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

  const { data: invoiceLineItems = [] } = useQuery({
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

  const { data: tickets = [], isLoading: loadingTickets } = useQuery({
    queryKey: ['tickets', customerId],
    queryFn: () => base44.entities.Ticket.filter({ customer_id: customerId }),
    enabled: !!customerId
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ['contacts', customerId],
    queryFn: () => base44.entities.Contact.filter({ customer_id: customerId }),
    enabled: !!customerId
  });

  const isLoading = loadingCustomers || loadingContracts || loadingBills || loadingInvoices || loadingTickets;

  // Calculate stats
  const monthlyTotal = recurringBills.reduce((sum, b) => sum + (b.amount || 0), 0);
  const openTickets = tickets.filter(t => ['new', 'open', 'in_progress'].includes(t.status)).length;
  const activeContracts = contracts.filter(c => c.status === 'active').length;
  const pendingInvoices = invoices.filter(i => i.status === 'sent' || i.status === 'overdue');
  const overdueAmount = invoices.filter(i => i.status === 'overdue').reduce((sum, i) => sum + (i.total || 0), 0);

  // Get upcoming renewals
  const upcomingRenewals = contracts
    .filter(c => c.renewal_date || c.end_date)
    .map(c => ({
      ...c,
      renewalDate: c.renewal_date || c.end_date,
      daysUntil: differenceInDays(parseISO(c.renewal_date || c.end_date), new Date())
    }))
    .filter(c => c.daysUntil >= 0 && c.daysUntil <= 90)
    .sort((a, b) => a.daysUntil - b.daysUntil);

  const handleFullSync = async () => {
    if (!customer?.external_id) return;
    setIsSyncing(true);
    try {
      // Sync all data types
      await Promise.all([
        base44.functions.invoke('syncHaloPSAContracts', { action: 'sync_customer', customer_id: customer.external_id }),
        base44.functions.invoke('syncHaloPSARecurringBills', { action: 'sync_customer', customer_id: customer.external_id }),
        base44.functions.invoke('syncHaloPSAInvoices', { action: 'sync_customer', customer_id: customer.external_id }),
        base44.functions.invoke('syncHaloPSATickets', { action: 'sync_customer', customer_id: customer.external_id }),
        base44.functions.invoke('syncHaloPSAContacts', { action: 'sync_customer', customer_id: customer.external_id }),
      ]);
      toast.success('All data synced successfully!');
      queryClient.invalidateQueries();
    } catch (error) {
      toast.error('Sync failed: ' + error.message);
    } finally {
      setIsSyncing(false);
    }
  };

  if (isLoading || !customer) {
    return (
      <div className="max-w-6xl mx-auto space-y-8">
        <Skeleton className="h-32 rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Welcome Header */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-3xl p-8 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="relative">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-slate-400 text-sm mb-1">Welcome back,</p>
              <h1 className="text-3xl font-bold mb-2">{customer.name}</h1>
              <p className="text-slate-400">Your IT services dashboard</p>
            </div>
            {customer?.source === 'halopsa' && (
              <Button 
                onClick={handleFullSync}
                disabled={isSyncing}
                variant="outline"
                className="bg-white/10 border-white/20 text-white hover:bg-white/20"
              >
                <RefreshCw className={cn("w-4 h-4 mr-2", isSyncing && "animate-spin")} />
                Refresh Data
              </Button>
            )}
          </div>
          
          {/* Quick Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
            <div className="bg-white/10 backdrop-blur rounded-xl p-4">
              <DollarSign className="w-5 h-5 text-emerald-400 mb-2" />
              <p className="text-2xl font-bold">${monthlyTotal.toLocaleString()}</p>
              <p className="text-xs text-slate-400">Monthly Services</p>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-xl p-4">
              <FileText className="w-5 h-5 text-blue-400 mb-2" />
              <p className="text-2xl font-bold">{activeContracts}</p>
              <p className="text-xs text-slate-400">Active Contracts</p>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-xl p-4">
              <Monitor className="w-5 h-5 text-orange-400 mb-2" />
              <p className="text-2xl font-bold">{openTickets}</p>
              <p className="text-xs text-slate-400">Open Tickets</p>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-xl p-4">
              <Users className="w-5 h-5 text-purple-400 mb-2" />
              <p className="text-2xl font-bold">{contacts.length}</p>
              <p className="text-xs text-slate-400">Team Members</p>
            </div>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {(overdueAmount > 0 || upcomingRenewals.length > 0) && (
        <div className="space-y-3">
          {overdueAmount > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-4">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-red-900">Payment Required</p>
                <p className="text-sm text-red-700">You have ${overdueAmount.toLocaleString()} in overdue invoices</p>
              </div>
              <Button size="sm" className="bg-red-600 hover:bg-red-700">Pay Now</Button>
            </div>
          )}
          {upcomingRenewals.length > 0 && upcomingRenewals[0].daysUntil <= 30 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-4">
              <div className="p-2 bg-amber-100 rounded-lg">
                <Calendar className="w-5 h-5 text-amber-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-amber-900">Contract Renewal Coming Up</p>
                <p className="text-sm text-amber-700">{upcomingRenewals[0].name} renews in {upcomingRenewals[0].daysUntil} days</p>
              </div>
              <Button size="sm" variant="outline" className="border-amber-300 text-amber-700 hover:bg-amber-100">Review</Button>
            </div>
          )}
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Services & Billing */}
        <div className="lg:col-span-2 space-y-6">
          {/* What You're Paying For */}
          <div className="bg-white rounded-2xl border border-slate-200/50 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Your Services</h2>
                <p className="text-sm text-slate-500">What's included in your monthly plan</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-slate-900">${monthlyTotal.toLocaleString()}</p>
                <p className="text-xs text-slate-500">per month</p>
              </div>
            </div>

            {lineItems.length === 0 ? (
              <div className="py-8 text-center">
                <Cloud className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">No services found</p>
              </div>
            ) : (
              <div className="space-y-2">
                {lineItems.slice(0, 8).map(item => (
                  <div key={item.id} className="flex items-center justify-between py-3 px-4 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                        <CheckCircle2 className="w-4 h-4 text-purple-600" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-900 text-sm">
                          {item.description?.replace(/\s*\$recurringbillingdate\s*/gi, '').trim()}
                        </p>
                        {item.quantity > 1 && (
                          <p className="text-xs text-slate-500">{item.quantity} units</p>
                        )}
                      </div>
                    </div>
                    <p className="font-semibold text-slate-900">
                      ${(item.net_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                ))}
                {lineItems.length > 8 && (
                  <Link to={createPageUrl(`CustomerDetail?id=${customerId}`)} className="block">
                    <Button variant="ghost" className="w-full text-purple-600 hover:text-purple-700 hover:bg-purple-50">
                      View all {lineItems.length} services
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </Link>
                )}
              </div>
            )}
          </div>

          {/* Recent Invoices */}
          <div className="bg-white rounded-2xl border border-slate-200/50 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900">Recent Invoices</h2>
              <Link to={createPageUrl(`CustomerDetail?id=${customerId}`)}>
                <Button variant="ghost" size="sm" className="text-purple-600">View All</Button>
              </Link>
            </div>

            {invoices.length === 0 ? (
              <div className="py-8 text-center">
                <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">No invoices yet</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {invoices
                  .sort((a, b) => new Date(b.due_date || 0) - new Date(a.due_date || 0))
                  .slice(0, 5)
                  .map(invoice => {
                    const items = invoiceLineItems.filter(item => item.invoice_id === invoice.id);
                    const isExpanded = expandedInvoices[invoice.id];
                    return (
                      <div key={invoice.id}>
                        <button
                          onClick={() => setExpandedInvoices(prev => ({ ...prev, [invoice.id]: !prev[invoice.id] }))}
                          className="w-full flex items-center justify-between py-4 hover:bg-slate-50 -mx-2 px-2 rounded-lg transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <ChevronDown className={cn("w-4 h-4 text-slate-400 transition-transform", isExpanded && "rotate-180")} />
                            <div className="text-left">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-slate-900">{invoice.invoice_number}</p>
                                <Badge className={cn(
                                  'text-xs',
                                  invoice.status === 'paid' && 'bg-green-100 text-green-700',
                                  invoice.status === 'overdue' && 'bg-red-100 text-red-700',
                                  invoice.status === 'sent' && 'bg-yellow-100 text-yellow-700',
                                )}>
                                  {invoice.status === 'sent' ? 'Pending' : invoice.status}
                                </Badge>
                              </div>
                              <p className="text-xs text-slate-500">
                                {invoice.due_date && `Due: ${format(parseISO(invoice.due_date), 'MMM d, yyyy')}`}
                              </p>
                            </div>
                          </div>
                          <p className="text-lg font-semibold text-slate-900">
                            ${(invoice.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </p>
                        </button>
                        {isExpanded && items.length > 0 && (
                          <div className="bg-slate-50 rounded-lg px-4 py-3 mb-2 ml-7">
                            <div className="space-y-2">
                              {items.map(item => (
                                <div key={item.id} className="flex justify-between text-sm py-1">
                                  <span className="text-slate-700">{item.description}</span>
                                  <span className="font-medium">${(item.net_amount || 0).toFixed(2)}</span>
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

        {/* Right Column - Support & Quick Actions */}
        <div className="space-y-6">
          {/* Support Tickets */}
          <div className="bg-white rounded-2xl border border-slate-200/50 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900">Support</h2>
              <Badge className="bg-purple-100 text-purple-700">{openTickets} open</Badge>
            </div>

            {tickets.length === 0 ? (
              <div className="py-6 text-center">
                <HelpCircle className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 text-sm">No tickets</p>
              </div>
            ) : (
              <div className="space-y-3">
                {tickets
                  .filter(t => ['new', 'open', 'in_progress', 'waiting'].includes(t.status))
                  .slice(0, 3)
                  .map(ticket => (
                    <div key={ticket.id} className="p-3 bg-slate-50 rounded-lg">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-900 text-sm truncate">
                            #{ticket.ticket_number}
                          </p>
                          <p className="text-xs text-slate-500 truncate">{ticket.summary}</p>
                        </div>
                        <Badge className={cn(
                          'text-xs ml-2 flex-shrink-0',
                          ticket.status === 'open' && 'bg-emerald-100 text-emerald-700',
                          ticket.status === 'in_progress' && 'bg-blue-100 text-blue-700',
                          ticket.status === 'waiting' && 'bg-yellow-100 text-yellow-700',
                          ticket.status === 'new' && 'bg-purple-100 text-purple-700',
                        )}>
                          {ticket.status?.replace('_', ' ')}
                        </Badge>
                      </div>
                    </div>
                  ))}
              </div>
            )}

            <Link to={createPageUrl(`CustomerDetail?id=${customerId}`)}>
              <Button className="w-full mt-4 bg-purple-600 hover:bg-purple-700">
                <HelpCircle className="w-4 h-4 mr-2" />
                View All Tickets
              </Button>
            </Link>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-2xl border border-slate-200/50 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Quick Actions</h2>
            <div className="space-y-2">
              <Button variant="outline" className="w-full justify-start gap-3 h-12">
                <Phone className="w-4 h-4 text-purple-600" />
                <span>Call Support</span>
              </Button>
              <Button variant="outline" className="w-full justify-start gap-3 h-12">
                <Mail className="w-4 h-4 text-purple-600" />
                <span>Email Support</span>
              </Button>
              <Link to={createPageUrl(`CustomerDetail?id=${customerId}`)} className="block">
                <Button variant="outline" className="w-full justify-start gap-3 h-12">
                  <FileText className="w-4 h-4 text-purple-600" />
                  <span>View Full Account</span>
                </Button>
              </Link>
            </div>
          </div>

          {/* Contract Renewals */}
          {upcomingRenewals.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200/50 p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Upcoming Renewals</h2>
              <div className="space-y-3">
                {upcomingRenewals.slice(0, 3).map(contract => (
                  <div key={contract.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div>
                      <p className="font-medium text-slate-900 text-sm">{contract.name}</p>
                      <p className="text-xs text-slate-500">
                        {format(parseISO(contract.renewalDate), 'MMM d, yyyy')}
                      </p>
                    </div>
                    <Badge className={cn(
                      contract.daysUntil <= 30 ? 'bg-red-100 text-red-700' :
                      contract.daysUntil <= 60 ? 'bg-yellow-100 text-yellow-700' :
                      'bg-slate-100 text-slate-700'
                    )}>
                      {contract.daysUntil} days
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}