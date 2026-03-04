import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { client } from '@/api/client';
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
  CheckCircle2,
  AlertCircle,
  ChevronDown
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { format, parseISO, differenceInDays } from 'date-fns';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { toast } from 'sonner';

// Admin Dashboard Component
function AdminDashboard() {
  const navigate = useNavigate();
  
  const { data: customers = [], isLoading: loadingCustomers } = useQuery({
    queryKey: ['customers'],
    queryFn: () => client.entities.Customer.list('-updated_date', 100),
  });

  const { data: contracts = [], isLoading: loadingContracts } = useQuery({
    queryKey: ['contracts'],
    queryFn: () => client.entities.Contract.list('-created_date', 500),
  });

  const { data: tickets = [], isLoading: loadingTickets } = useQuery({
    queryKey: ['tickets'],
    queryFn: () => client.entities.Ticket.list('-created_date', 500),
  });

  const isLoading = loadingCustomers || loadingContracts || loadingTickets;

  // Calculate stats
  const activeCustomers = customers.filter(c => c.status === 'active').length;
  const openTickets = tickets.filter(t => ['new', 'open', 'in_progress'].includes(t.status)).length;
  const totalMRR = contracts.filter(c => c.status === 'active').reduce((sum, c) => sum + (c.value || 0), 0);

  // Recent tickets
  const recentTickets = tickets
    .filter(t => ['new', 'open', 'in_progress'].includes(t.status))
    .slice(0, 5);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
        <p className="text-slate-500">Overview of your managed services</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link to={createPageUrl('Customers')} className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md hover:border-purple-200 transition-all cursor-pointer group">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center group-hover:bg-purple-200 transition-colors">
              <Building2 className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{activeCustomers}</p>
              <p className="text-sm text-slate-500">Active Customers</p>
            </div>
          </div>
        </Link>
        <Link to={createPageUrl('Billing')} className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md hover:border-emerald-200 transition-all cursor-pointer group">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center group-hover:bg-emerald-200 transition-colors">
              <DollarSign className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">${totalMRR.toLocaleString()}</p>
              <p className="text-sm text-slate-500">Monthly Revenue</p>
            </div>
          </div>
        </Link>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
              <Monitor className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{openTickets}</p>
              <p className="text-sm text-slate-500">Open Tickets</p>
            </div>
          </div>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Customers */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Recent Customers</h2>
            <Link to={createPageUrl('Customers')}>
              <Button variant="ghost" size="sm" className="text-purple-600">View All</Button>
            </Link>
          </div>
          <div className="space-y-2">
            {customers.slice(0, 6).map(customer => (
              <div 
                key={customer.id}
                onClick={() => navigate(createPageUrl(`CustomerDetail?id=${customer.id}`))}
                className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg hover:bg-slate-100 cursor-pointer transition-colors"
              >
                <div className="w-9 h-9 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-4 h-4 text-purple-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900 text-sm truncate">{customer.name}</p>
                  <p className="text-xs text-slate-500 truncate">{customer.email || 'No email'}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
              </div>
            ))}
          </div>
        </div>

        {/* Open Tickets */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Open Tickets</h2>
          </div>
          {recentTickets.length === 0 ? (
            <div className="py-8 text-center">
              <Monitor className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">No open tickets</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentTickets.slice(0, 6).map(ticket => (
                <div key={ticket.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                  <div className={cn(
                    "w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0",
                    ticket.priority === 'critical' && "bg-red-100",
                    ticket.priority === 'high' && "bg-orange-100",
                    ticket.priority === 'medium' && "bg-yellow-100",
                    (!ticket.priority || ticket.priority === 'low') && "bg-blue-100"
                  )}>
                    <Monitor className={cn(
                      "w-4 h-4",
                      ticket.priority === 'critical' && "text-red-600",
                      ticket.priority === 'high' && "text-orange-600",
                      ticket.priority === 'medium' && "text-yellow-600",
                      (!ticket.priority || ticket.priority === 'low') && "text-blue-600"
                    )} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 text-sm truncate">#{ticket.ticket_number}</p>
                    <p className="text-xs text-slate-500 truncate">{ticket.summary}</p>
                  </div>
                  <Badge className={cn(
                    'text-xs flex-shrink-0',
                    ticket.priority === 'critical' && 'bg-red-100 text-red-700',
                    ticket.priority === 'high' && 'bg-orange-100 text-orange-700',
                    ticket.priority === 'medium' && 'bg-yellow-100 text-yellow-700',
                    (!ticket.priority || ticket.priority === 'low') && 'bg-blue-100 text-blue-700',
                  )}>
                    {ticket.priority || 'low'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Customer Dashboard Component
function CustomerDashboard({ customer }) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [expandedInvoices, setExpandedInvoices] = useState({});
  const [dismissedAlerts, setDismissedAlerts] = useState([]);
  const queryClient = useQueryClient();
  const customerId = customer?.id;

  // Fetch activities for orphaned users (removed from HaloPSA but have licenses)
  const { data: orphanedUserAlerts = [] } = useQuery({
    queryKey: ['orphaned_user_alerts', customerId],
    queryFn: async () => {
      const activities = await client.entities.Activity.filter({ 
        entity_id: customerId,
        type: 'license_revoked'
      });
      // Filter to only recent ones (last 30 days) that mention HaloPSA removal
      const recentAlerts = activities.filter(a => 
        a.description?.includes('removed from HaloPSA') || 
        a.title?.includes('Removed from HaloPSA')
      );
      
      // For each alert, get the contact's license assignments
      const alertsWithLicenses = await Promise.all(recentAlerts.map(async (alert) => {
        const metadata = alert.metadata ? JSON.parse(alert.metadata) : {};
        if (metadata.contact_id) {
          const assignments = await client.entities.LicenseAssignment.filter({
            contact_id: metadata.contact_id,
            status: 'active'
          });
          // Get license details
          const licenseDetails = await Promise.all(assignments.map(async (a) => {
            const licenses = await client.entities.SaaSLicense.filter({ id: a.license_id });
            return licenses[0]?.application_name || 'Unknown License';
          }));
          return { ...alert, metadata, licenseNames: licenseDetails };
        }
        return { ...alert, metadata, licenseNames: [] };
      }));
      
      return alertsWithLicenses;
    },
    enabled: !!customerId,
    staleTime: 1000 * 60 * 5
  });

  // Parallel fetch all primary data at once
  const { data: contracts = [], isLoading: loadingContracts } = useQuery({
    queryKey: ['contracts', customerId],
    queryFn: () => client.entities.Contract.filter({ customer_id: customerId }),
    enabled: !!customerId,
    staleTime: 1000 * 60 * 5
  });

  const { data: recurringBills = [], isLoading: loadingBills } = useQuery({
    queryKey: ['recurring_bills', customerId],
    queryFn: () => client.entities.RecurringBill.filter({ customer_id: customerId }),
    enabled: !!customerId,
    staleTime: 1000 * 60 * 5
  });

  const { data: lineItems = [] } = useQuery({
    queryKey: ['line_items', customerId],
    queryFn: async () => {
      if (recurringBills.length === 0) return [];
      // Fetch all line items in parallel
      const results = await Promise.all(
        recurringBills.map(bill => 
          client.entities.RecurringBillLineItem.filter({ recurring_bill_id: bill.id })
        )
      );
      return results.flat();
    },
    enabled: !!customerId && recurringBills.length > 0,
    staleTime: 1000 * 60 * 5
  });

  const { data: invoices = [], isLoading: loadingInvoices } = useQuery({
    queryKey: ['invoices', customerId],
    queryFn: () => client.entities.Invoice.filter({ customer_id: customerId }),
    enabled: !!customerId,
    staleTime: 1000 * 60 * 5
  });

  const { data: invoiceLineItems = [] } = useQuery({
    queryKey: ['invoice_line_items', customerId],
    queryFn: async () => {
      if (invoices.length === 0) return [];
      // Fetch all invoice items in parallel
      const results = await Promise.all(
        invoices.slice(0, 10).map(invoice => 
          client.entities.InvoiceLineItem.filter({ invoice_id: invoice.id })
        )
      );
      return results.flat();
    },
    enabled: !!customerId && invoices.length > 0,
    staleTime: 1000 * 60 * 5
  });

  const { data: tickets = [], isLoading: loadingTickets } = useQuery({
    queryKey: ['tickets', customerId],
    queryFn: () => client.entities.Ticket.filter({ customer_id: customerId }),
    enabled: !!customerId,
    staleTime: 1000 * 60 * 5
  });

  const { data: contacts = [], isLoading: loadingContacts } = useQuery({
    queryKey: ['contacts', customerId],
    queryFn: () => client.entities.Contact.filter({ customer_id: customerId }),
    enabled: !!customerId,
    staleTime: 1000 * 60 * 5
  });

  const isLoadingPrimary = loadingContracts || loadingBills || loadingInvoices || loadingTickets || loadingContacts;

  const monthlyTotal = recurringBills.reduce((sum, b) => sum + (b.amount || 0), 0);
  const openTickets = tickets.filter(t => ['new', 'open', 'in_progress'].includes(t.status)).length;
  const activeContracts = contracts.filter(c => c.status === 'active').length;
  const overdueAmount = invoices.filter(i => i.status === 'overdue').reduce((sum, i) => sum + (i.total || 0), 0);

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
      await Promise.all([
        client.functions.invoke('syncHaloPSAContracts', { action: 'sync_customer', customer_id: customer.external_id }),
        client.functions.invoke('syncHaloPSARecurringBills', { action: 'sync_customer', customer_id: customer.external_id }),
        client.functions.invoke('syncHaloPSAInvoices', { action: 'sync_customer', customer_id: customer.external_id }),
        client.functions.invoke('syncHaloPSATickets', { action: 'sync_customer', customer_id: customer.external_id }),
        client.functions.invoke('syncHaloPSAContacts', { action: 'sync_customer', customer_id: customer.external_id }),
      ]);
      toast.success('All data synced successfully!');
      queryClient.invalidateQueries();
    } catch (error) {
      toast.error('Sync failed: ' + error.message);
    } finally {
      setIsSyncing(false);
    }
  };

  // Show skeleton while primary data loads
  if (isLoadingPrimary) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <Skeleton className="h-64 rounded-3xl" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-64 rounded-2xl" />
            <Skeleton className="h-48 rounded-2xl" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-48 rounded-2xl" />
            <Skeleton className="h-40 rounded-2xl" />
          </div>
        </div>
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

      {/* Orphaned User Alerts - Users removed from HaloPSA but still have licenses */}
      {orphanedUserAlerts.filter(a => !dismissedAlerts.includes(a.id)).length > 0 && (
        <div className="space-y-3">
          {orphanedUserAlerts.filter(a => !dismissedAlerts.includes(a.id)).map(alert => (
            <div key={alert.id} className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="flex items-start gap-4">
                <div className="p-2 bg-amber-100 rounded-lg flex-shrink-0">
                  <AlertCircle className="w-5 h-5 text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-amber-900">User Removed from HaloPSA</p>
                  <p className="text-sm text-amber-700 mt-1">
                    <strong>{alert.metadata?.contact_name || 'Unknown User'}</strong>
                    {alert.metadata?.contact_email && (
                      <span className="text-amber-600"> ({alert.metadata.contact_email})</span>
                    )}
                    {' '}was removed from HaloPSA but still has active licenses assigned.
                  </p>
                  {alert.licenseNames && alert.licenseNames.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs font-medium text-amber-800 mb-1">Assigned Licenses:</p>
                      <div className="flex flex-wrap gap-1">
                        {alert.licenseNames.map((name, idx) => (
                          <Badge key={idx} className="bg-amber-200 text-amber-800 text-xs">
                            {name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  <p className="text-xs text-amber-600 mt-2">
                    Action needed: Review and revoke licenses if this user should no longer have access.
                  </p>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="text-amber-600 hover:text-amber-800 hover:bg-amber-100 flex-shrink-0"
                  onClick={() => setDismissedAlerts(prev => [...prev, alert.id])}
                >
                  Dismiss
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

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
            </div>
          )}
        </div>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Services */}
          <div className="bg-white rounded-2xl border border-slate-200/50 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Your Services</h2>
                <p className="text-sm text-slate-500">What's included in your plan</p>
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
                {lineItems.slice(0, 6).map(item => (
                  <div key={item.id} className="flex items-center justify-between py-3 px-4 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <p className="font-medium text-slate-900 text-sm">
                        {item.description?.replace(/\s*\$recurringbillingdate\s*/gi, '').trim()}
                      </p>
                    </div>
                    <p className="font-semibold text-slate-900">
                      ${(item.net_amount || 0).toFixed(2)}
                    </p>
                  </div>
                ))}
                {lineItems.length > 6 && (
                  <Link to={createPageUrl(`CustomerDetail?id=${customerId}`)}>
                    <Button variant="ghost" className="w-full text-slate-600 hover:text-slate-900">
                      View all {lineItems.length} services <ChevronRight className="w-4 h-4 ml-1" />
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
                <Button variant="ghost" size="sm" className="text-slate-600 hover:text-slate-900">View All</Button>
              </Link>
            </div>

            {invoices.length === 0 ? (
              <div className="py-8 text-center">
                <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">No invoices yet</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {invoices.slice(0, 5).map(invoice => {
                  const items = invoiceLineItems.filter(item => item.invoice_id === invoice.id);
                  const isExpanded = expandedInvoices[invoice.id];
                  return (
                    <div key={invoice.id}>
                      <button
                        onClick={() => setExpandedInvoices(prev => ({ ...prev, [invoice.id]: !prev[invoice.id] }))}
                        className="w-full flex items-center justify-between py-4 hover:bg-slate-50 -mx-2 px-2 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <ChevronDown className={cn("w-4 h-4 text-slate-400", isExpanded && "rotate-180")} />
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
                        <p className="text-lg font-semibold">${(invoice.total || 0).toFixed(2)}</p>
                      </button>
                      {isExpanded && items.length > 0 && (
                        <div className="bg-slate-50 rounded-lg px-4 py-3 mb-2 ml-7">
                          {items.map(item => (
                            <div key={item.id} className="flex justify-between text-sm py-1">
                              <span className="text-slate-700">{item.description}</span>
                              <span className="font-medium">${(item.net_amount || 0).toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Support */}
          <div className="bg-white rounded-2xl border border-slate-200/50 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900">Support</h2>
              <Badge className="bg-slate-100 text-slate-700">{openTickets} open</Badge>
            </div>
            {tickets.filter(t => ['new', 'open', 'in_progress'].includes(t.status)).length === 0 ? (
              <div className="py-6 text-center">
                <HelpCircle className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 text-sm">No open tickets</p>
              </div>
            ) : (
              <div className="space-y-3">
                {tickets.filter(t => ['new', 'open', 'in_progress'].includes(t.status)).slice(0, 3).map(ticket => (
                  <div key={ticket.id} className="p-3 bg-slate-50 rounded-lg">
                    <p className="font-medium text-slate-900 text-sm">#{ticket.ticket_number}</p>
                    <p className="text-xs text-slate-500 truncate">{ticket.summary}</p>
                  </div>
                ))}
              </div>
            )}
            <Link to={createPageUrl(`CustomerDetail?id=${customerId}`)}>
              <Button className="w-full mt-4 bg-slate-800 hover:bg-slate-900">
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
                <Phone className="w-4 h-4 text-slate-600" />
                Call Support
              </Button>
              <Button variant="outline" className="w-full justify-start gap-3 h-12">
                <Mail className="w-4 h-4 text-slate-600" />
                Email Support
              </Button>
              <Link to={createPageUrl(`CustomerDetail?id=${customerId}`)} className="block">
                <Button variant="outline" className="w-full justify-start gap-3 h-12">
                  <FileText className="w-4 h-4 text-slate-600" />
                  View Full Account
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Main Dashboard - Routes based on user role
export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => client.entities.Customer.list('-created_date', 500),
  });

  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await client.auth.me();
        setUser(currentUser);
        
        // For non-admin users, use their assigned customer_id ONLY
        if (currentUser?.role !== 'admin') {
          if (currentUser?.customer_id && customers.length > 0) {
            const matched = customers.find(c => c.id === currentUser.customer_id);
            setCustomer(matched || null);
          } else if (!currentUser?.customer_id) {
            setCustomer(null); // No customer_id = no customer
          }
        }
        setIsLoading(false);
      } catch (error) {
        console.error('Failed to load user', error);
        setIsLoading(false);
      }
    };
    loadUser();
  }, [customers]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 rounded-2xl" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      </div>
    );
  }

  // Admin users see the MSP dashboard
  if (user?.role === 'admin') {
    return <AdminDashboard />;
  }

  // Regular users see the customer dashboard
  if (customer) {
    return <CustomerDashboard customer={customer} />;
  }

  // Fallback if no customer found
  return (
    <div className="text-center py-12">
      <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-4" />
      <h2 className="text-xl font-semibold text-slate-900 mb-2">Account Not Found</h2>
      <p className="text-slate-500">Please contact support to link your account.</p>
    </div>
  );
}