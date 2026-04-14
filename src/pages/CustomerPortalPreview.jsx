import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { client, resolveFileUrl } from '@/api/client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { 
  ArrowLeft,
  Building2,
  Mail,
  Phone,
  FileText,
  Cloud,
  DollarSign,
  CheckCircle2,
  HelpCircle,
  AlertCircle,
  Monitor,
  ChevronDown,
  Clock,
  Users,
  RefreshCw,
  Plus
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, safeFormatDate } from "@/lib/utils";
// date-fns calls replaced by safe wrappers from @/lib/utils
import CustomerServicesTab from '../components/customer/CustomerServicesTab';
import CustomerMap from '../components/customer/CustomerMap';
import SoftwareCard from '../components/saas/SoftwareCard';
import AddSoftwareModal from '../components/saas/AddSoftwareModal';
import LicenseAssignmentModal from '../components/saas/LicenseAssignmentModal';
import { toast } from 'sonner';

export default function CustomerPortalPreview() {
  const params = new URLSearchParams(window.location.search);
  const customerId = params.get('id');
  const queryClient = useQueryClient();
  const [isSyncing, setIsSyncing] = useState(false);
  const [expandedBills, setExpandedBills] = useState({ _section: true });
  const [expandedInvoices, setExpandedInvoices] = useState({ _section: true });
  const [invoiceFilter, setInvoiceFilter] = useState('all');
  const [ticketFilter, setTicketFilter] = useState('all');
  const [showAddSoftware, setShowAddSoftware] = useState(false);
  const [selectedLicense, setSelectedLicense] = useState(null);

  const { data: customers = [], isLoading: loadingCustomer } = useQuery({
    queryKey: ['customers'],
    queryFn: () => client.entities.Customer.list(),
  });

  const customer = customers.find(c => c.id === customerId);

  const { data: contracts = [] } = useQuery({
    queryKey: ['contracts', customerId],
    queryFn: () => client.entities.Contract.filter({ customer_id: customerId }),
    enabled: !!customerId
  });

  const { data: recurringBills = [] } = useQuery({
    queryKey: ['recurring_bills', customerId],
    queryFn: () => client.entities.RecurringBill.filter({ customer_id: customerId }),
    enabled: !!customerId
  });

  const { data: lineItems = [] } = useQuery({
    queryKey: ['line_items', customerId],
    queryFn: async () => {
      const allItems = [];
      for (const bill of recurringBills) {
        const items = await client.entities.RecurringBillLineItem.filter({ recurring_bill_id: bill.id });
        allItems.push(...items);
      }
      return allItems;
    },
    enabled: !!customerId && recurringBills.length > 0
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ['invoices', customerId],
    queryFn: () => client.entities.Invoice.filter({ customer_id: customerId }),
    enabled: !!customerId
  });

  const { data: tickets = [] } = useQuery({
    queryKey: ['tickets', customerId],
    queryFn: () => client.entities.Ticket.filter({ customer_id: customerId }),
    enabled: !!customerId
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ['contacts', customerId],
    queryFn: () => client.entities.Contact.filter({ customer_id: customerId }),
    enabled: !!customerId
  });

  const { data: devices = [] } = useQuery({
    queryKey: ['devices', customerId],
    queryFn: () => client.entities.Device.filter({ customer_id: customerId }),
    enabled: !!customerId
  });

  const { data: licenses = [] } = useQuery({
    queryKey: ['licenses', customerId],
    queryFn: () => client.entities.SaaSLicense.filter({ customer_id: customerId }),
    enabled: !!customerId
  });

  const { data: licenseAssignments = [] } = useQuery({
    queryKey: ['license_assignments', customerId],
    queryFn: () => client.entities.LicenseAssignment.filter({ customer_id: customerId }),
    enabled: !!customerId
  });

  const { data: quotes = [] } = useQuery({
    queryKey: ['quotes', customerId],
    queryFn: () => client.entities.Quote.filter({ customer_id: customerId }),
    enabled: !!customerId
  });

  const { data: applications = [] } = useQuery({
    queryKey: ['applications', customerId],
    queryFn: () => client.entities.Application.filter({ customer_id: customerId }),
    enabled: !!customerId
  });

  const { data: invoiceLineItems = [] } = useQuery({
    queryKey: ['invoice_line_items', customerId],
    queryFn: async () => {
      const allItems = [];
      for (const invoice of invoices) {
        const items = await client.entities.InvoiceLineItem.filter({ invoice_id: invoice.id });
        allItems.push(...items);
      }
      return allItems;
    },
    enabled: !!customerId && invoices.length > 0
  });

  // Group licenses by application name
  const groupedSoftware = licenses.reduce((acc, license) => {
    const key = license.application_name;
    if (!acc[key]) {
      acc[key] = {
        software: license,
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

  const handleAddSoftware = async (softwareData) => {
    try {
      setShowAddSoftware(false);
      toast.success('Software added!');
      const newApp = await client.entities.Application.create(softwareData);
      queryClient.invalidateQueries({ queryKey: ['applications', customerId] });
      window.location.href = createPageUrl(`LicenseDetail?appId=${newApp.id}`);
    } catch (err) {
      toast.error(err.message || 'Operation failed');
    }
  };

  const handleAssignLicense = async (contactId) => {
    try {
      await client.entities.LicenseAssignment.create({
        license_id: selectedLicense.id,
        contact_id: contactId,
        customer_id: customerId,
        assigned_date: new Date().toISOString().split('T')[0],
        status: 'active'
      });
      const newCount = licenseAssignments.filter(a => a.license_id === selectedLicense.id && a.status === 'active').length + 1;
      await client.entities.SaaSLicense.update(selectedLicense.id, { assigned_users: newCount });
      queryClient.invalidateQueries({ queryKey: ['license_assignments', customerId] });
      queryClient.invalidateQueries({ queryKey: ['licenses', customerId] });
      toast.success('License assigned!');
    } catch (err) {
      toast.error(err.message || 'Operation failed');
    }
  };

  const handleRevokeLicense = async (contactId) => {
    try {
      const assignment = licenseAssignments.find(a =>
        a.license_id === selectedLicense.id &&
        a.contact_id === contactId &&
        a.status === 'active'
      );
      if (assignment) {
        await client.entities.LicenseAssignment.update(assignment.id, { status: 'revoked' });
        const newCount = Math.max(0, licenseAssignments.filter(a => a.license_id === selectedLicense.id && a.status === 'active').length - 1);
        await client.entities.SaaSLicense.update(selectedLicense.id, { assigned_users: newCount });
        queryClient.invalidateQueries({ queryKey: ['license_assignments', customerId] });
        queryClient.invalidateQueries({ queryKey: ['licenses', customerId] });
        toast.success('License revoked!');
      }
    } catch (err) {
      toast.error(err.message || 'Operation failed');
    }
  };

  if (loadingCustomer) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="text-center py-12">
        <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-slate-900 mb-2">Customer Not Found</h2>
        <Link to={createPageUrl('Customers')}>
          <Button>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Customers
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Admin Preview Banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
            <Monitor className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <p className="font-semibold text-amber-900">Customer Portal Preview</p>
            <p className="text-sm text-amber-700">You're viewing what <strong>{customer.name}</strong> sees in their portal</p>
          </div>
        </div>
        <Link to={createPageUrl(`CustomerDetail?id=${customerId}`)}>
          <Button variant="outline" className="gap-2 border-amber-300 text-amber-700 hover:bg-amber-100">
            <ArrowLeft className="w-4 h-4" />
            Back to Admin View
          </Button>
        </Link>
      </div>

      {/* Customer Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center gap-6">
          <div className="flex items-center gap-4 flex-1">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center flex-shrink-0 shadow-lg shadow-purple-500/20">
              {customer.logo_url ? (
                <img src={resolveFileUrl(customer.logo_url)} alt={customer.name} className="w-10 h-10 rounded-xl object-cover" />
              ) : (
                <Building2 className="w-7 h-7 text-white" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-slate-900">{customer.name}</h1>
                <Badge className={cn(
                  "font-medium",
                  customer.status === 'active' && "bg-emerald-100 text-emerald-700 border-emerald-200"
                )}>
                  {customer.status || 'Active'}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-4 mt-1.5 text-sm text-slate-500">
                {customer.email && (
                  <span className="flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5" />
                    {customer.email}
                  </span>
                )}
                {customer.phone && (
                  <span className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5" />
                    {customer.phone}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Map */}
      {customer.address && (
        <CustomerMap addresses={[customer.address]} />
      )}

      {/* Summary Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-3 items-center text-center gap-4">
          <div className="sm:pr-4 sm:border-r sm:border-gray-200">
            <p className="text-[10px] text-gray-500 uppercase tracking-wide">Monthly Cost</p>
            <p className="text-2xl font-bold text-gray-900">
              ${recurringBills.filter(b => !['yearly', 'annual', 'annually'].includes((b.frequency || '').toLowerCase())).reduce((sum, b) => sum + (b.amount || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="sm:px-4 sm:border-r sm:border-gray-200">
            <p className="text-[10px] text-gray-500 uppercase tracking-wide">Contract</p>
            {contracts.length > 0 ? (
              <p className="text-lg font-semibold text-gray-900">{contracts[0].name}</p>
            ) : (
              <p className="text-gray-400">None</p>
            )}
          </div>
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

      {/* Tabs - Same as customer view */}
      <Tabs defaultValue="services" className="space-y-6">
        <TabsList className="bg-slate-100/80 border-0 rounded-xl p-1 flex gap-0.5 h-auto overflow-x-auto">
          {[
            { value: 'services', icon: Cloud, label: 'Services' },
            { value: 'billing', icon: DollarSign, label: 'Billing' },
            { value: 'licenses', icon: Cloud, label: 'SaaS' },
            { value: 'tickets', icon: HelpCircle, label: 'Support' },
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

        <TabsContent value="billing">
          <div className="space-y-6">
            {/* Compact Summary Row */}
            <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 max-w-3xl mx-auto shadow-sm">
              <div className="grid grid-cols-1 sm:grid-cols-3 items-center text-center gap-3">
                <div className="sm:pr-4 sm:border-r sm:border-gray-200">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wide">Monthly Cost</p>
                  <p className="text-xl font-bold text-gray-900">
                    ${recurringBills.filter(b => !['yearly', 'annual', 'annually'].includes((b.frequency || '').toLowerCase())).reduce((sum, b) => sum + (b.amount || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="sm:px-4 sm:border-r sm:border-gray-200">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wide">Contract</p>
                  {contracts.length > 0 ? (
                    <p className="font-semibold text-gray-900">{contracts[0].name}</p>
                  ) : (
                    <p className="text-gray-400 text-sm">None</p>
                  )}
                </div>
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

            {/* Invoices Section */}
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
              <button
                onClick={() => setExpandedInvoices(prev => ({ ...prev, _section: !prev._section }))}
                className="w-full px-6 py-5 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <div className="text-left">
                  <h3 className="text-lg font-semibold text-gray-900">Invoice History</h3>
                  <p className="text-sm text-gray-500 mt-0.5">{invoices.length} invoices on record</p>
                </div>
                <ChevronDown className={cn(
                  "w-5 h-5 text-gray-400 transition-transform",
                  expandedInvoices._section && "rotate-180"
                )} />
              </button>
              
              {expandedInvoices._section && (
                <div className="border-t border-gray-100">
                  <div className="px-6 py-4 bg-gray-50/50 flex flex-wrap items-center gap-3">
                    <select
                      value={invoiceFilter}
                      onChange={(e) => setInvoiceFilter(e.target.value)}
                      className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white"
                    >
                      <option value="all">All Invoices</option>
                      <option value="paid">Paid</option>
                      <option value="overdue">Overdue</option>
                      <option value="sent">Pending</option>
                    </select>
                  </div>

                  {invoices.length === 0 ? (
                    <div className="py-16 text-center">
                      <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500">No invoices found</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {invoices
                        .filter(inv => invoiceFilter === 'all' || inv.status === invoiceFilter)
                        .sort((a, b) => new Date(b.due_date || 0) - new Date(a.due_date || 0))
                        .map(invoice => {
                          const isPaid = invoice.status === 'paid';
                          const isOverdue = invoice.status === 'overdue';
                          
                          return (
                            <div key={invoice.id} className={cn(
                              "flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors",
                              isOverdue && "bg-red-50/30"
                            )}>
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
                                      <span>Due {safeFormatDate(invoice.due_date, 'MMM d, yyyy')}</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <p className={cn(
                                "text-xl font-bold",
                                isPaid ? "text-emerald-600" : "text-gray-900"
                              )}>
                                ${(invoice.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                              </p>
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
            devices={devices}
          />
        </TabsContent>

        <TabsContent value="licenses">
          <div className="space-y-6">
            {/* Header with Add Button */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Software & Licenses</h3>
                <p className="text-sm text-slate-500">{Object.keys(groupedSoftware).length} applications</p>
              </div>
              <Button 
                size="sm" 
                className="gap-2 bg-purple-600 hover:bg-purple-700"
                onClick={() => setShowAddSoftware(true)}
              >
                <Plus className="w-4 h-4" />
                Add Software
              </Button>
            </div>

            {/* Software Cards Grid */}
            <div className="bg-white rounded-2xl border border-slate-200/50 overflow-hidden">
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
                  {Object.entries(groupedSoftware).map(([appName, data]) => {
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
              )}
            </div>
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
          <AddSoftwareModal
            open={showAddSoftware}
            onClose={() => setShowAddSoftware(false)}
            onSave={handleAddSoftware}
            customerId={customerId}
          />
        </TabsContent>

        <TabsContent value="tickets">
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Support Tickets</h3>
                <p className="text-sm text-slate-500">
                  {tickets.filter(t => ['open', 'in_progress', 'new'].includes(t.status)).length} open • {tickets.filter(t => ['closed', 'resolved'].includes(t.status)).length} resolved
                </p>
              </div>
              <select
                value={ticketFilter}
                onChange={(e) => setTicketFilter(e.target.value)}
                className="text-sm border border-slate-200 rounded-lg px-3 py-1.5"
              >
                <option value="all">All Tickets</option>
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
            </div>

            {tickets.length === 0 ? (
              <div className="py-12 text-center">
                <Monitor className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">No tickets found</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {tickets
                  .filter(t => ticketFilter === 'all' || t.status === ticketFilter)
                  .sort((a, b) => new Date(b.date_opened || 0) - new Date(a.date_opened || 0))
                  .map(ticket => (
                    <div key={ticket.id} className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50 transition-colors">
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
                          {ticket.date_opened && (
                            <span>{safeFormatDate(ticket.date_opened, 'MMM d, yyyy')}</span>
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
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}