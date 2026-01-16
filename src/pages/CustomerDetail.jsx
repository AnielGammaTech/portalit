import React, { useState } from 'react';
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
  ChevronDown
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { format, parseISO } from 'date-fns';

export default function CustomerDetail() {
  const [isSyncing, setIsSyncing] = useState(false);
  const queryClient = useQueryClient();
  const params = new URLSearchParams(window.location.search);
  const customerId = params.get('id');

  const { data: customers = [], isLoading: loadingCustomer } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
  });

  const customer = customers.find(c => c.id === customerId);

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
    queryFn: () => base44.entities.RecurringBillLineItem.filter({ customer_id: customerId }),
    enabled: !!customerId
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
  const [invoiceFilter, setInvoiceFilter] = useState('all');
  const contractImportRef = React.useRef(null);
  const billImportRef = React.useRef(null);

  const isLoading = loadingCustomer || loadingContracts || loadingLicenses || loadingBills || loadingLineItems || loadingInvoices || loadingQuotes || loadingQuoteItems || loadingContractItems;

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

  const handleContractImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      const contractsToCreate = [];
      
      for (let i = 1; i < lines.length; i++) {
        const [name, description, value, frequency, status] = lines[i].split(',').map(v => v.trim());
        if (name) {
          contractsToCreate.push({
            customer_id: customerId,
            name,
            description: description || '',
            value: parseFloat(value) || 0,
            frequency: frequency || 'monthly',
            status: status || 'active'
          });
        }
      }
      
      if (contractsToCreate.length > 0) {
        await base44.entities.Contract.bulkCreate(contractsToCreate);
        toast.success(`Imported ${contractsToCreate.length} contracts`);
        queryClient.invalidateQueries({ queryKey: ['contracts', customerId] });
      }
    } catch (error) {
      toast.error('Error importing contracts: ' + error.message);
    }
    if (contractImportRef.current) contractImportRef.current.value = '';
  };

  const handleBillImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      const billsToCreate = [];
      
      for (let i = 1; i < lines.length; i++) {
        const [name, description, amount, frequency, status] = lines[i].split(',').map(v => v.trim());
        if (name) {
          billsToCreate.push({
            customer_id: customerId,
            halopsa_id: `imported_${Date.now()}_${i}`,
            name,
            description: description || '',
            amount: parseFloat(amount) || 0,
            frequency: frequency || 'monthly',
            status: status || 'active'
          });
        }
      }
      
      if (billsToCreate.length > 0) {
        await base44.entities.RecurringBill.bulkCreate(billsToCreate);
        toast.success(`Imported ${billsToCreate.length} recurring bills`);
        queryClient.invalidateQueries({ queryKey: ['recurring_bills', customerId] });
      }
    } catch (error) {
      toast.error('Error importing bills: ' + error.message);
    }
    if (billImportRef.current) billImportRef.current.value = '';
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
        <h2 className="text-xl font-semibold text-slate-900 mb-2">Customer Not Found</h2>
        <p className="text-slate-500 mb-6">The customer you're looking for doesn't exist.</p>
        <Link to={createPageUrl('Customers')}>
          <Button>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Customers
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
       <Link to={createPageUrl('Customers')}>
         <Button variant="ghost" size="sm" className="gap-2">
           <ArrowLeft className="w-4 h-4" />
           Back to Customers
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
           Sync Customer
         </Button>
       )}
      </div>

      {/* Customer Header */}
      <div className="bg-white rounded-2xl border border-slate-200/50 p-6">
        <div className="flex flex-col md:flex-row md:items-start gap-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center flex-shrink-0">
            {customer.logo_url ? (
              <img src={customer.logo_url} alt={customer.name} className="w-10 h-10 rounded-xl" />
            ) : (
              <Building2 className="w-8 h-8 text-slate-500" />
            )}
          </div>
          <div className="flex-1">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
              <h1 className="text-2xl font-semibold text-slate-900">{customer.name}</h1>
              <Badge variant="outline" className={cn(
                "capitalize w-fit",
                customer.status === 'active' && "border-emerald-200 bg-emerald-50 text-emerald-700",
                customer.status === 'inactive' && "border-slate-200 bg-slate-50 text-slate-600",
                customer.status === 'suspended' && "border-red-200 bg-red-50 text-red-700"
              )}>
                {customer.status || 'active'}
              </Badge>
              {customer.source && (
                <Badge variant="outline" className="capitalize w-fit">
                  {customer.source}
                </Badge>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
              {customer.primary_contact && (
                <div className="flex items-center gap-2 text-slate-600">
                  <Users className="w-4 h-4 text-slate-400" />
                  {customer.primary_contact}
                </div>
              )}
              {customer.email && (
                <div className="flex items-center gap-2 text-slate-600">
                  <Mail className="w-4 h-4 text-slate-400" />
                  {customer.email}
                </div>
              )}
              {customer.phone && (
                <div className="flex items-center gap-2 text-slate-600">
                  <Phone className="w-4 h-4 text-slate-400" />
                  {customer.phone}
                </div>
              )}
              {customer.address && (
                <div className="flex items-center gap-2 text-slate-600">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  {customer.address}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-100">
          <div className="text-center p-4 bg-slate-50 rounded-xl">
            <p className="text-2xl font-semibold text-slate-900">{customer.total_users || 0}</p>
            <p className="text-sm text-slate-500">Users</p>
          </div>
          <div className="text-center p-4 bg-slate-50 rounded-xl">
            <p className="text-2xl font-semibold text-slate-900">{customer.total_devices || 0}</p>
            <p className="text-sm text-slate-500">Devices</p>
          </div>
          <div className="text-center p-4 bg-slate-50 rounded-xl">
            <p className="text-2xl font-semibold text-slate-900">{contracts.length}</p>
            <p className="text-sm text-slate-500">Contracts</p>
          </div>
          <div className="text-center p-4 bg-slate-50 rounded-xl">
            <p className="text-2xl font-semibold text-slate-900">{licenses.length}</p>
            <p className="text-sm text-slate-500">Licenses</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="bg-white border border-slate-200/50">
          <TabsTrigger value="overview" className="gap-2">
            <Building2 className="w-4 h-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="contracts" className="gap-2">
            <FileText className="w-4 h-4" />
            Contracts
          </TabsTrigger>
          <TabsTrigger value="licenses" className="gap-2">
              <Cloud className="w-4 h-4" />
              SaaS Licenses
            </TabsTrigger>
            <TabsTrigger value="quotes" className="gap-2">
              <FileText className="w-4 h-4" />
              Quotes
            </TabsTrigger>
          </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Contracts Summary */}
            <div className="bg-white rounded-2xl border border-slate-200/50 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-900">Contracts Summary</h3>
                <FileText className="w-5 h-5 text-slate-400" />
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Total Contracts</span>
                  <span className="font-semibold text-slate-900">{contracts.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Active Contracts</span>
                  <span className="font-semibold text-emerald-600">
                    {contracts.filter(c => c.status === 'active').length}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Monthly Value</span>
                  <span className="font-semibold text-slate-900">
                    ${totalContractValue.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* SaaS Summary */}
            <div className="bg-white rounded-2xl border border-slate-200/50 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-900">SaaS Licenses Summary</h3>
                <Cloud className="w-5 h-5 text-slate-400" />
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Total Licenses</span>
                  <span className="font-semibold text-slate-900">{licenses.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Active Licenses</span>
                  <span className="font-semibold text-emerald-600">
                    {licenses.filter(l => l.status === 'active').length}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Monthly Cost</span>
                  <span className="font-semibold text-slate-900">
                    ${totalLicenseCost.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Notes */}
          {customer.notes && (
            <div className="bg-white rounded-2xl border border-slate-200/50 p-6">
              <h3 className="font-medium text-slate-900 mb-3">Notes</h3>
              <p className="text-slate-600 whitespace-pre-wrap">{customer.notes}</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="contracts">
          <div className="space-y-6">
            {/* Total Summary */}
            {contracts.length > 0 && (
              <div className="flex items-center gap-4 p-4 bg-blue-50 border border-blue-100 rounded-lg">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <DollarSign className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-600">Total Monthly Recurring</p>
                  <p className="text-xl font-semibold text-slate-900">
                    ${contracts.reduce((sum, c) => sum + (c.value || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">({contracts.filter(c => c.status === 'active').length} active contract{contracts.filter(c => c.status === 'active').length !== 1 ? 's' : ''})</p>
                </div>
              </div>
            )}

            {/* Contracts List */}
            <div className="bg-white rounded-2xl border border-slate-200/50 p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-semibold text-slate-900">Contracts</h3>
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => contractImportRef.current?.click()}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Import
                  </Button>
                  <input
                    ref={contractImportRef}
                    type="file"
                    accept=".csv"
                    onChange={handleContractImport}
                    className="hidden"
                  />
                  <Button size="sm" className="gap-2 bg-slate-900 hover:bg-slate-800">
                    <Plus className="w-4 h-4" />
                    New Contract
                  </Button>
                </div>
              </div>
              {contracts.length === 0 ? (
                <div className="p-12 text-center">
                  <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">No contracts found</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {contracts.map((contract) => {
                    const contractLineItems = contractItems.filter(item => item.contract_id === contract.id);
                    const isExpanded = expandedContracts[contract.id];
                    return (
                      <div key={contract.id} className="border border-slate-100 rounded-lg overflow-hidden">
                        <button
                          onClick={() => setExpandedContracts(prev => ({ ...prev, [contract.id]: !prev[contract.id] }))}
                          className="w-full px-4 py-4 flex items-start justify-between hover:bg-slate-50 transition-colors"
                        >
                          <div className="flex-1 text-left">
                            <div className="flex items-center gap-3 mb-2">
                              <span className="font-semibold text-slate-900">{contract.name}</span>
                              <Badge className={cn(
                                "capitalize text-xs",
                                contract.status === 'active' && "bg-emerald-100 text-emerald-700",
                                contract.status === 'expired' && "bg-red-100 text-red-700",
                                contract.status === 'pending' && "bg-yellow-100 text-yellow-700",
                                contract.status === 'cancelled' && "bg-slate-100 text-slate-700"
                              )}>
                                {contract.status}
                              </Badge>
                            </div>
                            {contract.start_date && contract.end_date && (
                              <div className="flex items-center gap-4 text-sm text-slate-600">
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  Start: {format(parseISO(contract.start_date), 'MMM dd, yyyy')}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  Renewal: {format(parseISO(contract.end_date), 'MMM dd, yyyy')}
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-4">
                            <p className="font-semibold text-slate-900">
                              ${(contract.value || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </p>
                            <ChevronDown className={cn("w-4 h-4 text-slate-400 transition-transform", isExpanded && "rotate-180")} />
                          </div>
                        </button>
                        {isExpanded && contractLineItems.length > 0 && (
                          <div className="bg-slate-50 border-t border-slate-100 px-4 py-4 overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-slate-200">
                                  <th className="text-left py-2 px-2 text-slate-600 font-medium">Description</th>
                                  <th className="text-center py-2 px-2 text-slate-600 font-medium">Qty</th>
                                  <th className="text-right py-2 px-2 text-slate-600 font-medium">Price</th>
                                  <th className="text-right py-2 px-2 text-slate-600 font-medium">Net</th>
                                </tr>
                              </thead>
                              <tbody>
                                {contractLineItems.map(item => (
                                  <tr key={item.id} className="border-b border-slate-100 hover:bg-white transition-colors">
                                    <td className="py-2 px-2">
                                      <div>
                                        <p className="text-slate-900">{item.description}</p>
                                        {item.item_code && <p className="text-xs text-slate-500">#{item.item_code}</p>}
                                      </div>
                                    </td>
                                    <td className="py-2 px-2 text-center text-slate-600">{item.quantity}</td>
                                    <td className="py-2 px-2 text-right text-slate-900">
                                      ${(item.unit_price || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="py-2 px-2 text-right font-semibold text-slate-900">
                                      ${(item.net_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

             {/* Recurring Bills */}
             <div className="bg-white rounded-2xl border border-slate-200/50 p-6">
               <div className="flex items-center justify-between mb-6">
                 <h3 className="font-semibold text-slate-900">Recurring Bills</h3>
                 <div className="flex gap-2">
                   <Button 
                     size="sm" 
                     variant="outline"
                     onClick={() => billImportRef.current?.click()}
                   >
                     <Plus className="w-4 h-4 mr-1" />
                     Import
                   </Button>
                   <input
                     ref={billImportRef}
                     type="file"
                     accept=".csv"
                     onChange={handleBillImport}
                     className="hidden"
                   />
                   {customer?.source === 'halopsa' && (
                     <Button 
                       size="sm"
                       variant="outline"
                       className="gap-2"
                       onClick={async () => {
                         try {
                           setIsSyncing(true);
                           const response = await base44.functions.invoke('syncHaloPSARecurringBills', { 
                             action: 'sync_customer',
                             customer_id: customer.external_id 
                           });
                           if (response.data.success) {
                             toast.success(`Synced ${response.data.recordsSynced} recurring bills!`);
                             queryClient.invalidateQueries({ queryKey: ['recurring_bills', customerId] });
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
                       Sync from Halo
                     </Button>
                   )}
                 </div>
               </div>

               {recurringBills.length === 0 ? (
                 <div className="p-12 text-center">
                   <DollarSign className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                   <p className="text-slate-500">No recurring bills found</p>
                 </div>
               ) : (
                 <div className="space-y-6">
                   {/* Total Summary */}
                   <div className="flex items-center gap-4 p-4 bg-blue-50 border border-blue-100 rounded-lg">
                     <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                       <DollarSign className="w-5 h-5 text-blue-600" />
                     </div>
                     <div>
                       <p className="text-sm text-slate-600">Total Monthly Recurring</p>
                       <p className="text-xl font-semibold text-slate-900">
                         ${recurringBills.reduce((sum, b) => sum + (b.amount || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                       </p>
                       <p className="text-xs text-slate-500 mt-1">({recurringBills.length} bill{recurringBills.length !== 1 ? 's' : ''})</p>
                     </div>
                   </div>

                   {/* Bills List with Line Items */}
                   <div className="space-y-4">
                     {recurringBills.map((bill) => {
                       const billLineItems = lineItems.filter(item => item.recurring_bill_id === bill.id);
                       const isExpanded = expandedBills[bill.id];
                       return (
                         <div key={bill.id} className="border border-slate-100 rounded-lg overflow-hidden">
                           <button
                             onClick={() => setExpandedBills(prev => ({ ...prev, [bill.id]: !prev[bill.id] }))}
                             className="w-full px-4 py-4 flex items-start justify-between hover:bg-slate-50 transition-colors"
                           >
                             <div className="flex-1 text-left">
                               <p className="font-semibold text-slate-900">{bill.name}</p>
                               <p className="text-sm text-slate-500 capitalize">{bill.frequency}</p>
                             </div>
                             <div className="flex items-center gap-4">
                               <p className="font-semibold text-slate-900">
                                 ${(bill.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                               </p>
                               <ChevronDown className={cn("w-4 h-4 text-slate-400 transition-transform", isExpanded && "rotate-180")} />
                             </div>
                           </button>
                           {isExpanded && billLineItems.length > 0 && (
                             <div className="bg-slate-50 border-t border-slate-100 px-4 py-3">
                               <div className="space-y-2 text-xs">
                                 {billLineItems.map(item => (
                                   <div key={item.id} className="flex justify-between">
                                     <span className="text-slate-600">{item.description}</span>
                                     <span className="font-medium text-slate-900">
                                       ${(item.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                     </span>
                                   </div>
                                 ))}
                               </div>
                             </div>
                           )}
                         </div>
                       );
                     })}
                   </div>

                   {/* Last Invoices */}
                   <div className="mt-8 pt-6 border-t border-slate-100">
                     <div className="flex items-center justify-between mb-4">
                       <h4 className="font-semibold text-slate-900">Recent Invoices</h4>
                       <div className="flex items-center gap-2">
                         <Filter className="w-4 h-4 text-slate-400" />
                         <select
                           value={invoiceFilter}
                           onChange={(e) => setInvoiceFilter(e.target.value)}
                           className="text-sm border border-slate-200 rounded-lg px-2 py-1 focus:outline-none"
                         >
                           <option value="all">All Statuses</option>
                           <option value="paid">Paid</option>
                           <option value="overdue">Overdue</option>
                           <option value="sent">Sent</option>
                         </select>
                       </div>
                     </div>
                     {invoices.length === 0 ? (
                       <p className="text-sm text-slate-500">No invoices</p>
                     ) : (
                       <div className="space-y-2">
                         {invoices
                           .filter(inv => invoiceFilter === 'all' || inv.status === invoiceFilter)
                           .slice(0, 10)
                           .map(invoice => (
                             <div key={invoice.id} className="flex items-center justify-between text-sm p-3 bg-slate-50 rounded-lg">
                               <div>
                                 <p className="font-medium text-slate-900">{invoice.invoice_number}</p>
                                 <p className="text-xs text-slate-500">{invoice.invoice_date ? format(parseISO(invoice.invoice_date), 'MMM dd') : '-'}</p>
                               </div>
                               <div className="text-right">
                                 <p className="font-semibold text-slate-900">
                                   ${(invoice.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                 </p>
                                 <Badge className={cn('text-xs capitalize', 
                                   invoice.status === 'paid' && 'bg-emerald-100 text-emerald-700',
                                   invoice.status === 'overdue' && 'bg-red-100 text-red-700',
                                   invoice.status === 'sent' && 'bg-blue-100 text-blue-700'
                                 )}>
                                   {invoice.status}
                                 </Badge>
                               </div>
                             </div>
                           ))}
                       </div>
                     )}
                   </div>
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
        </Tabs>
        </div>
        );
        }