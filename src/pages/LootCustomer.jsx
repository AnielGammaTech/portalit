import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { 
  ArrowLeft,
  Building2,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  DollarSign,
  TrendingUp
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { toast } from 'sonner';

export default function LootCustomer() {
  const [user, setUser] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const queryClient = useQueryClient();

  // Get customer ID from URL
  const urlParams = new URLSearchParams(window.location.search);
  const customerId = urlParams.get('id');

  useEffect(() => {
    const loadUser = async () => {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    };
    loadUser();
  }, []);

  const { data: customer, isLoading: loadingCustomer } = useQuery({
    queryKey: ['customer', customerId],
    queryFn: async () => {
      const customers = await base44.entities.Customer.filter({ id: customerId });
      return customers[0];
    },
    enabled: !!customerId
  });

  const { data: recurringBills = [], isLoading: loadingBills, refetch: refetchBills } = useQuery({
    queryKey: ['customer_recurring_bills', customerId],
    queryFn: () => base44.entities.RecurringBill.filter({ customer_id: customerId }),
    enabled: !!customerId
  });

  const { data: billLineItems = [], isLoading: loadingLineItems, refetch: refetchLineItems } = useQuery({
    queryKey: ['customer_bill_line_items', customerId],
    queryFn: async () => {
      const allItems = await base44.entities.RecurringBillLineItem.list('-created_date', 5000);
      const billIds = recurringBills.map(b => b.id);
      return allItems.filter(item => billIds.includes(item.recurring_bill_id));
    },
    enabled: recurringBills.length > 0
  });

  const { data: lootSettings = [] } = useQuery({
    queryKey: ['loot_settings'],
    queryFn: () => base44.entities.LootSettings.list(),
  });

  const { data: vendorBilling = [] } = useQuery({
    queryKey: ['vendor_billing', customerId],
    queryFn: () => base44.entities.VendorBilling.filter({ customer_id: customerId }),
    enabled: !!customerId
  });

  const { data: devices = [] } = useQuery({
    queryKey: ['customer_devices', customerId],
    queryFn: () => base44.entities.Device.filter({ customer_id: customerId }),
    enabled: !!customerId
  });

  const isLoading = loadingCustomer || loadingBills;

  // Sync recurring bills from HaloPSA
  const handleSyncRecurringBills = async () => {
    setIsSyncing(true);
    try {
      const response = await base44.functions.invoke('syncHaloPSARecurringBills', {
        customer_id: customerId
      });
      
      if (response.data?.success) {
        toast.success(`Synced ${response.data.synced || 0} recurring bills`);
        refetchBills();
        refetchLineItems();
        queryClient.invalidateQueries({ queryKey: ['customer_bill_line_items', customerId] });
      } else {
        toast.error(response.data?.error || 'Sync failed');
      }
    } catch (error) {
      toast.error('Sync failed: ' + error.message);
    } finally {
      setIsSyncing(false);
    }
  };

  // Block non-admins
  if (user && user.role !== 'admin') {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">Access denied. Admin only.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">Customer not found</p>
        <Link to={createPageUrl('Loot')}>
          <Button variant="outline" className="mt-4">Back to Loot</Button>
        </Link>
      </div>
    );
  }

  // Get vendor count for a service type
  const getVendorCount = (serviceType) => {
    const billing = vendorBilling.find(v => v.vendor === serviceType);
    if (billing) return billing.vendor_count || 0;
    if (serviceType === 'datto_rmm') return devices.length;
    return 0;
  };

  // Build services data
  const services = lootSettings.filter(s => s.is_active).map(setting => {
    const matchTerm = setting.halopsa_item_match?.toLowerCase() || setting.service_name?.toLowerCase();
    const matchingItems = billLineItems.filter(item => 
      item.description?.toLowerCase().includes(matchTerm) ||
      item.item_code?.toLowerCase().includes(matchTerm)
    );
    
    const psaQty = matchingItems.reduce((sum, item) => sum + (item.quantity || 0), 0);
    const psaRevenue = matchingItems.reduce((sum, item) => sum + (item.net_amount || 0), 0);
    const vendorQty = getVendorCount(setting.service_type);
    const vendorCost = vendorQty * (setting.cost_per_unit || 0);
    const difference = vendorQty - psaQty;
    
    return {
      setting,
      psaQty,
      psaRevenue,
      vendorQty,
      vendorCost,
      difference,
      profit: psaRevenue - vendorCost,
      matchingItems
    };
  }).filter(s => s.psaQty > 0 || s.vendorQty > 0);

  const totalPsaRevenue = services.reduce((sum, s) => sum + s.psaRevenue, 0);
  const totalVendorCost = services.reduce((sum, s) => sum + s.vendorCost, 0);
  const totalProfit = totalPsaRevenue - totalVendorCost;
  const hasDiscrepancy = services.some(s => s.difference !== 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to={createPageUrl('Loot')}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div className="flex items-center gap-3 flex-1">
          <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
            <Building2 className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">{customer.name}</h1>
            <p className="text-slate-500">Billing Reconciliation</p>
          </div>
        </div>
        <Button 
          onClick={handleSyncRecurringBills} 
          disabled={isSyncing}
          className="bg-purple-600 hover:bg-purple-700"
        >
          <RefreshCw className={cn("w-4 h-4 mr-2", isSyncing && "animate-spin")} />
          {isSyncing ? 'Syncing...' : 'Sync from HaloPSA'}
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border p-5">
          <div className="flex items-center gap-3 mb-2">
            <DollarSign className="w-5 h-5 text-blue-500" />
            <span className="text-sm text-slate-500">PSA Revenue</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">${totalPsaRevenue.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl border p-5">
          <div className="flex items-center gap-3 mb-2">
            <DollarSign className="w-5 h-5 text-slate-500" />
            <span className="text-sm text-slate-500">Vendor Cost</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">${totalVendorCost.toLocaleString()}</p>
        </div>
        <div className={cn(
          "rounded-xl border p-5",
          totalProfit >= 0 ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"
        )}>
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className={cn("w-5 h-5", totalProfit >= 0 ? "text-emerald-500" : "text-red-500")} />
            <span className="text-sm text-slate-500">Profit</span>
          </div>
          <p className={cn(
            "text-2xl font-bold",
            totalProfit >= 0 ? "text-emerald-700" : "text-red-700"
          )}>${totalProfit.toLocaleString()}</p>
        </div>
        <div className={cn(
          "rounded-xl border p-5",
          hasDiscrepancy ? "bg-amber-50 border-amber-200" : "bg-emerald-50 border-emerald-200"
        )}>
          <div className="flex items-center gap-3 mb-2">
            {hasDiscrepancy ? (
              <AlertTriangle className="w-5 h-5 text-amber-500" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            )}
            <span className="text-sm text-slate-500">Status</span>
          </div>
          <p className={cn(
            "text-lg font-semibold",
            hasDiscrepancy ? "text-amber-700" : "text-emerald-700"
          )}>
            {hasDiscrepancy ? 'Has Discrepancies' : 'All Matched'}
          </p>
        </div>
      </div>

      {/* Services Breakdown */}
      <div className="bg-white rounded-xl border">
        <div className="p-5 border-b">
          <h2 className="text-lg font-semibold text-slate-900">Services Comparison</h2>
          <p className="text-sm text-slate-500">HaloPSA billing vs Vendor API counts</p>
        </div>
        <div className="divide-y">
          {services.map((svc, idx) => (
            <div key={idx} className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  {svc.difference === 0 ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-amber-500" />
                  )}
                  <div>
                    <h3 className="font-semibold text-slate-900">{svc.setting.service_name}</h3>
                    <p className="text-sm text-slate-500">
                      Match: "{svc.setting.halopsa_item_match || svc.setting.service_name}"
                    </p>
                  </div>
                </div>
                <Badge variant="outline">{svc.setting.service_type}</Badge>
              </div>

              <div className="grid grid-cols-3 gap-4">
                {/* PSA */}
                <div className="bg-blue-50 rounded-lg p-4">
                  <p className="text-xs text-blue-600 font-medium mb-2">HaloPSA (We Bill)</p>
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-3xl font-bold text-blue-900">{svc.psaQty}</p>
                      <p className="text-sm text-blue-600">units</p>
                    </div>
                    <p className="text-lg font-semibold text-blue-700">${svc.psaRevenue.toFixed(2)}</p>
                  </div>
                </div>

                {/* Vendor */}
                <div className={cn(
                  "rounded-lg p-4",
                  svc.difference === 0 ? "bg-emerald-50" :
                  svc.difference > 0 ? "bg-red-50" : "bg-amber-50"
                )}>
                  <p className={cn(
                    "text-xs font-medium mb-2",
                    svc.difference === 0 ? "text-emerald-600" :
                    svc.difference > 0 ? "text-red-600" : "text-amber-600"
                  )}>
                    Vendor API (We Pay)
                  </p>
                  <div className="flex items-end justify-between">
                    <div>
                      <p className={cn(
                        "text-3xl font-bold",
                        svc.difference === 0 ? "text-emerald-900" :
                        svc.difference > 0 ? "text-red-900" : "text-amber-900"
                      )}>{svc.vendorQty}</p>
                      <p className={cn(
                        "text-sm",
                        svc.difference === 0 ? "text-emerald-600" :
                        svc.difference > 0 ? "text-red-600" : "text-amber-600"
                      )}>units</p>
                    </div>
                    <p className={cn(
                      "text-lg font-semibold",
                      svc.difference === 0 ? "text-emerald-700" :
                      svc.difference > 0 ? "text-red-700" : "text-amber-700"
                    )}>${svc.vendorCost.toFixed(2)}</p>
                  </div>
                </div>

                {/* Profit */}
                <div className={cn(
                  "rounded-lg p-4",
                  svc.profit >= 0 ? "bg-emerald-50" : "bg-red-50"
                )}>
                  <p className="text-xs text-slate-600 font-medium mb-2">Profit</p>
                  <p className={cn(
                    "text-3xl font-bold",
                    svc.profit >= 0 ? "text-emerald-700" : "text-red-700"
                  )}>
                    ${svc.profit.toFixed(2)}
                  </p>
                  {svc.difference !== 0 && (
                    <p className={cn(
                      "text-sm mt-1",
                      svc.difference > 0 ? "text-red-600" : "text-amber-600"
                    )}>
                      {svc.difference > 0 ? `Under-billing ${svc.difference}` : `Over-billing ${Math.abs(svc.difference)}`}
                    </p>
                  )}
                </div>
              </div>

              {/* Matching Line Items */}
              {svc.matchingItems.length > 0 && (
                <div className="mt-4 bg-slate-50 rounded-lg p-3">
                  <p className="text-xs text-slate-500 mb-2">Matching HaloPSA Line Items:</p>
                  <div className="space-y-1">
                    {svc.matchingItems.map((item, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className="text-slate-700">{item.description}</span>
                        <span className="text-slate-500">Qty: {item.quantity} | ${item.net_amount?.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}

          {services.length === 0 && (
            <div className="p-12 text-center text-slate-500">
              <p>No configured services found.</p>
              <p className="text-sm mt-1">Configure services in Loot Settings to start tracking.</p>
              <Link to={createPageUrl('LootSettings')}>
                <Button variant="outline" className="mt-4">Go to Settings</Button>
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* All Recurring Bills */}
      <div className="bg-white rounded-xl border">
        <div className="p-5 border-b flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">All Recurring Bills</h2>
            <p className="text-sm text-slate-500">{recurringBills.length} bills, {billLineItems.length} line items</p>
          </div>
        </div>
        <div className="divide-y max-h-96 overflow-y-auto">
          {recurringBills.map(bill => {
            const items = billLineItems.filter(item => item.recurring_bill_id === bill.id);
            return (
              <div key={bill.id} className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-slate-900">{bill.name}</span>
                  <Badge variant="outline">{bill.status}</Badge>
                </div>
                {items.length > 0 && (
                  <div className="bg-slate-50 rounded p-2 space-y-1">
                    {items.map((item, i) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span className="text-slate-600 truncate flex-1">{item.description}</span>
                        <span className="text-slate-500 ml-4">x{item.quantity}</span>
                        <span className="text-slate-700 ml-4 font-medium">${item.net_amount?.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {recurringBills.length === 0 && (
            <div className="p-8 text-center text-slate-500">
              No recurring bills found. Click "Sync from HaloPSA" to fetch billing data.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}