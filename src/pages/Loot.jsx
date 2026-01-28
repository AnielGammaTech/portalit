import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { 
  ArrowUp, 
  ArrowDown, 
  Minus,
  Settings,
  ChevronRight,
  Building2,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";


export default function Loot() {
  const [user, setUser] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    const loadUser = async () => {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    };
    loadUser();
  }, []);

  const { data: customers = [], isLoading: loadingCustomers } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list('-created_date', 500),
  });

  const { data: recurringBills = [], isLoading: loadingBills } = useQuery({
    queryKey: ['all_recurring_bills'],
    queryFn: () => base44.entities.RecurringBill.list('-created_date', 2000),
  });

  const { data: billLineItems = [], isLoading: loadingLineItems } = useQuery({
    queryKey: ['all_bill_line_items'],
    queryFn: () => base44.entities.RecurringBillLineItem.list('-created_date', 5000),
  });

  const { data: lootSettings = [] } = useQuery({
    queryKey: ['loot_settings'],
    queryFn: () => base44.entities.LootSettings.list(),
  });

  const { data: vendorBilling = [] } = useQuery({
    queryKey: ['vendor_billing'],
    queryFn: () => base44.entities.VendorBilling.list(),
  });

  const { data: devices = [] } = useQuery({
    queryKey: ['all_devices'],
    queryFn: () => base44.entities.Device.list('-created_date', 2000),
  });

  const isLoading = loadingCustomers || loadingBills || loadingLineItems;

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
        <Skeleton className="h-24 rounded-2xl" />
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      </div>
    );
  }

  // Get line items per customer from recurring bills
  const getCustomerLineItems = (customerId) => {
    const customerBills = recurringBills.filter(b => b.customer_id === customerId);
    const customerLineItems = [];
    customerBills.forEach(bill => {
      const items = billLineItems.filter(item => item.recurring_bill_id === bill.id);
      customerLineItems.push(...items);
    });
    return customerLineItems;
  };

  // Get vendor count for a customer and service type
  const getVendorCount = (customerId, serviceType) => {
    // Check VendorBilling entity first
    const billing = vendorBilling.find(v => v.customer_id === customerId && v.vendor === serviceType);
    if (billing) return billing.vendor_count || 0;
    
    // For Datto RMM, count devices
    if (serviceType === 'datto_rmm') {
      return devices.filter(d => d.customer_id === customerId).length;
    }
    
    return 0;
  };

  // Build company data with all their services
  const companyData = customers
    .filter(c => c.status === 'active')
    .map(customer => {
      const lineItems = getCustomerLineItems(customer.id);
      
      // Group line items by service type based on LootSettings matches
      const services = [];
      let totalPsaRevenue = 0;
      let totalVendorCost = 0;
      let hasDiscrepancy = false;

      // For each active loot setting, find matching line items
      lootSettings.filter(s => s.is_active).forEach(setting => {
        const matchTerm = setting.halopsa_item_match?.toLowerCase() || setting.service_name?.toLowerCase();
        const matchingItems = lineItems.filter(item => 
          item.description?.toLowerCase().includes(matchTerm) ||
          item.item_code?.toLowerCase().includes(matchTerm)
        );
        
        const psaQty = matchingItems.reduce((sum, item) => sum + (item.quantity || 0), 0);
        const psaRevenue = matchingItems.reduce((sum, item) => sum + (item.net_amount || 0), 0);
        const vendorQty = getVendorCount(customer.id, setting.service_type);
        const vendorCost = vendorQty * (setting.cost_per_unit || 0);
        
        if (psaQty > 0 || vendorQty > 0) {
          const diff = vendorQty - psaQty;
          if (diff !== 0) hasDiscrepancy = true;
          
          services.push({
            setting,
            psaQty,
            psaRevenue,
            vendorQty,
            vendorCost,
            difference: diff,
            profit: psaRevenue - vendorCost
          });
          
          totalPsaRevenue += psaRevenue;
          totalVendorCost += vendorCost;
        }
      });

      // Also include unmatched line items as "Other" if there are items not matched
      const matchedDescriptions = new Set();
      lootSettings.filter(s => s.is_active).forEach(setting => {
        const matchTerm = setting.halopsa_item_match?.toLowerCase() || setting.service_name?.toLowerCase();
        lineItems.forEach(item => {
          if (item.description?.toLowerCase().includes(matchTerm) || 
              item.item_code?.toLowerCase().includes(matchTerm)) {
            matchedDescriptions.add(item.id);
          }
        });
      });

      const unmatchedItems = lineItems.filter(item => !matchedDescriptions.has(item.id));
      if (unmatchedItems.length > 0) {
        const otherRevenue = unmatchedItems.reduce((sum, item) => sum + (item.net_amount || 0), 0);
        totalPsaRevenue += otherRevenue;
      }

      return {
        ...customer,
        services,
        totalPsaRevenue,
        totalVendorCost,
        totalProfit: totalPsaRevenue - totalVendorCost,
        hasDiscrepancy,
        lineItemCount: lineItems.length
      };
    })
    .filter(c => c.lineItemCount > 0)
    .sort((a, b) => b.totalPsaRevenue - a.totalPsaRevenue);

  // Filter companies
  const filteredCompanies = companyData.filter(c => {
    if (filterStatus === 'issues') return c.hasDiscrepancy;
    if (filterStatus === 'matched') return !c.hasDiscrepancy;
    return true;
  });

  // Calculate totals
  const totalRevenue = companyData.reduce((sum, c) => sum + c.totalPsaRevenue, 0);
  const totalCost = companyData.reduce((sum, c) => sum + c.totalVendorCost, 0);
  const totalProfit = totalRevenue - totalCost;
  const companiesWithIssues = companyData.filter(c => c.hasDiscrepancy).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Loot - Billing Reconciliation</h1>
          <p className="text-slate-500">Compare HaloPSA billing vs vendor API counts</p>
        </div>
        
        <Link to={createPageUrl('LootSettings')}>
          <Button variant="outline" className="gap-2">
            <Settings className="w-4 h-4" />
            Settings
          </Button>
        </Link>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-slate-500 uppercase mb-1">Companies</p>
          <p className="text-2xl font-bold text-slate-900">{companyData.length}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-slate-500 uppercase mb-1">PSA Revenue</p>
          <p className="text-2xl font-bold text-slate-900">${totalRevenue.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-slate-500 uppercase mb-1">Vendor Cost</p>
          <p className="text-2xl font-bold text-slate-900">${totalCost.toLocaleString()}</p>
        </div>
        <div className={cn(
          "rounded-xl border p-4",
          totalProfit >= 0 ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"
        )}>
          <p className="text-xs text-slate-500 uppercase mb-1">Total Profit</p>
          <p className={cn(
            "text-2xl font-bold",
            totalProfit >= 0 ? "text-emerald-700" : "text-red-700"
          )}>
            ${totalProfit.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Companies ({companyData.length})</SelectItem>
            <SelectItem value="issues">With Discrepancies ({companiesWithIssues})</SelectItem>
            <SelectItem value="matched">Matched ({companyData.length - companiesWithIssues})</SelectItem>
          </SelectContent>
        </Select>
        
        {lootSettings.length === 0 && (
          <div className="flex items-center gap-2 text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-sm">No services configured. <Link to={createPageUrl('LootSettings')} className="underline">Add services</Link></span>
          </div>
        )}
      </div>

      {/* Company List */}
      <div className="space-y-3">
        {filteredCompanies.map(company => (
          <Link
            key={company.id}
            to={createPageUrl('LootCustomer') + `?id=${company.id}`}
            className={cn(
              "bg-white rounded-xl border p-5 hover:shadow-md transition-all cursor-pointer",
              company.hasDiscrepancy ? "border-amber-200" : "border-slate-200"
            )}
          >
            <div className="flex items-center justify-between">
              {/* Company Info */}
              <div className="flex items-center gap-4 flex-1">
                <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-slate-500" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-slate-900">{company.name}</h3>
                    {company.hasDiscrepancy ? (
                      <Badge className="bg-amber-100 text-amber-700">Discrepancy</Badge>
                    ) : (
                      <Badge className="bg-emerald-100 text-emerald-700">Matched</Badge>
                    )}
                  </div>
                  <p className="text-sm text-slate-500">{company.services.length} services configured</p>
                </div>
              </div>

              {/* Services Summary */}
              <div className="flex items-center gap-6">
                {company.services.slice(0, 3).map((svc, idx) => (
                  <div key={idx} className="text-center min-w-[80px]">
                    <p className="text-xs text-slate-500 truncate">{svc.setting.service_name}</p>
                    <div className="flex items-center justify-center gap-2 mt-1">
                      <span className="text-sm font-medium">{svc.psaQty}</span>
                      {svc.difference !== 0 ? (
                        svc.difference > 0 ? (
                          <ArrowUp className="w-3 h-3 text-red-500" />
                        ) : (
                          <ArrowDown className="w-3 h-3 text-emerald-500" />
                        )
                      ) : (
                        <Minus className="w-3 h-3 text-slate-300" />
                      )}
                      <span className={cn(
                        "text-sm font-medium",
                        svc.difference > 0 && "text-red-600",
                        svc.difference < 0 && "text-emerald-600"
                      )}>{svc.vendorQty}</span>
                    </div>
                  </div>
                ))}
                {company.services.length > 3 && (
                  <span className="text-xs text-slate-400">+{company.services.length - 3} more</span>
                )}
              </div>

              {/* Totals */}
              <div className="flex items-center gap-6 ml-6">
                <div className="text-right">
                  <p className="text-xs text-slate-500">Revenue</p>
                  <p className="font-semibold text-slate-900">${company.totalPsaRevenue.toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-500">Profit</p>
                  <p className={cn(
                    "font-semibold",
                    company.totalProfit >= 0 ? "text-emerald-600" : "text-red-600"
                  )}>
                    ${company.totalProfit.toLocaleString()}
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-300" />
              </div>
            </div>
          </Link>
        ))}

        {filteredCompanies.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            No companies found with billing data
          </div>
        )}
      </div>
    </div>
  );
}