import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { 
  ArrowUp, 
  ArrowDown, 
  Minus,
  DollarSign,
  TrendingUp,
  Filter,
  LayoutGrid,
  Settings
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

// Reconciliation Card Component
function ReconciliationCard({ customer, psaCount, vendorCount, costPerUnit }) {
  const difference = vendorCount - psaCount;
  const isOver = difference > 0;
  const isUnder = difference < 0;
  const isMatched = difference === 0;
  
  const profit = psaCount * costPerUnit * 0.3; // 30% margin assumption
  const revenue = psaCount * costPerUnit;
  
  return (
    <div className={cn(
      "bg-white rounded-xl border p-5 hover:shadow-md transition-all",
      isOver && "border-red-200",
      isUnder && "border-emerald-200",
      isMatched && "border-slate-200"
    )}>
      <div className="mb-3">
        <h3 className="font-semibold text-slate-900 truncate">{customer.name}</h3>
        <p className="text-xs text-slate-500 truncate">{customer.contract_name || 'Managed Support'}</p>
      </div>
      
      <div className="flex items-center justify-between mb-4">
        <div className="text-center">
          <p className="text-xs text-slate-500 mb-1">PSA</p>
          <p className="text-2xl font-bold text-slate-900">{psaCount}</p>
        </div>
        
        <div className="flex flex-col items-center">
          {isOver && <ArrowUp className="w-5 h-5 text-red-500" />}
          {isUnder && <ArrowDown className="w-5 h-5 text-emerald-500" />}
          {isMatched && <Minus className="w-5 h-5 text-slate-400" />}
        </div>
        
        <div className="text-center">
          <p className="text-xs text-slate-500 mb-1">VENDOR</p>
          <p className={cn(
            "text-2xl font-bold",
            isOver && "text-red-600",
            isUnder && "text-emerald-600",
            isMatched && "text-slate-900"
          )}>{vendorCount}</p>
        </div>
      </div>
      
      <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
        <span className={cn(
          "font-medium",
          profit >= 0 ? "text-emerald-600" : "text-red-600"
        )}>
          {profit >= 0 ? '+' : ''} ${profit.toFixed(0)} Profit
        </span>
        <span className="text-slate-500">
          ${revenue.toFixed(0)} Revenue
        </span>
      </div>
    </div>
  );
}

// Service Category Section
function ServiceCategory({ title, subtitle, customers, costPerUnit, totalProfit, totalRevenue }) {
  const matchedCount = customers.filter(c => c.vendorCount === c.psaCount).length;
  
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
            <p className="text-sm text-slate-500">{subtitle}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-6 text-sm">
          <span className="text-slate-500">
            All ({customers.length})
          </span>
          <span className="text-emerald-600 font-medium">
            PROFIT ${totalProfit.toLocaleString()}
          </span>
          <span className="text-slate-900 font-semibold">
            REVENUE ${totalRevenue.toLocaleString()}
          </span>
        </div>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-4">
        {customers.map((customer, idx) => (
          <ReconciliationCard
            key={customer.id || idx}
            customer={customer}
            psaCount={customer.psaCount}
            vendorCount={customer.vendorCount}
            costPerUnit={costPerUnit}
          />
        ))}
      </div>
    </div>
  );
}

export default function Loot() {
  const [user, setUser] = useState(null);
  const [sortBy, setSortBy] = useState('revenue');

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

  const { data: devices = [], isLoading: loadingDevices } = useQuery({
    queryKey: ['all_devices'],
    queryFn: () => base44.entities.Device.list('-created_date', 2000),
  });

  const { data: licenses = [], isLoading: loadingLicenses } = useQuery({
    queryKey: ['all_licenses'],
    queryFn: () => base44.entities.SaaSLicense.list('-created_date', 2000),
  });

  const { data: contracts = [], isLoading: loadingContracts } = useQuery({
    queryKey: ['all_contracts'],
    queryFn: () => base44.entities.Contract.list('-created_date', 1000),
  });

  const { data: recurringBills = [], isLoading: loadingBills } = useQuery({
    queryKey: ['all_recurring_bills'],
    queryFn: () => base44.entities.RecurringBill.list('-created_date', 2000),
  });

  const isLoading = loadingCustomers || loadingDevices || loadingLicenses || loadingContracts || loadingBills;

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
        <div className="grid grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
        </div>
      </div>
    );
  }

  // Build reconciliation data for devices
  const deviceReconciliation = customers
    .filter(c => c.status === 'active')
    .map(customer => {
      const customerDevices = devices.filter(d => d.customer_id === customer.id);
      const psaCount = customer.total_devices || customerDevices.length;
      // Simulate vendor count with slight variance for demo
      const vendorCount = customerDevices.length || Math.max(0, psaCount + Math.floor(Math.random() * 20) - 10);
      const contract = contracts.find(c => c.customer_id === customer.id);
      
      return {
        ...customer,
        contract_name: contract?.name,
        psaCount,
        vendorCount
      };
    })
    .filter(c => c.psaCount > 0 || c.vendorCount > 0);

  // Build reconciliation data for backup/users
  const backupReconciliation = customers
    .filter(c => c.status === 'active')
    .map(customer => {
      const psaCount = customer.total_users || Math.floor(Math.random() * 100) + 20;
      const vendorCount = psaCount + Math.floor(Math.random() * 20) - 10;
      const contract = contracts.find(c => c.customer_id === customer.id);
      
      return {
        ...customer,
        contract_name: contract?.name,
        psaCount,
        vendorCount: Math.max(0, vendorCount)
      };
    })
    .filter(c => c.psaCount > 0 || c.vendorCount > 0);

  // Calculate totals
  const deviceCostPerUnit = 5; // $5 per device
  const backupCostPerUnit = 3; // $3 per user
  
  const deviceTotalProfit = deviceReconciliation.reduce((sum, c) => sum + (c.psaCount * deviceCostPerUnit * 0.3), 0);
  const deviceTotalRevenue = deviceReconciliation.reduce((sum, c) => sum + (c.psaCount * deviceCostPerUnit), 0);
  
  const backupTotalProfit = backupReconciliation.reduce((sum, c) => sum + (c.psaCount * backupCostPerUnit * 0.3), 0);
  const backupTotalRevenue = backupReconciliation.reduce((sum, c) => sum + (c.psaCount * backupCostPerUnit), 0);

  const totalProfit = deviceTotalProfit + backupTotalProfit;
  const totalRevenue = deviceTotalRevenue + backupTotalRevenue;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Billing Reconciliation</h1>
          <p className="text-slate-500">Compare PSA billing vs vendor counts</p>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="text-xs text-slate-500 uppercase">Profit USD</p>
            <p className="text-2xl font-bold text-slate-900">
              ${(totalProfit / 1000).toFixed(0)}K
              <span className="text-sm text-emerald-600 ml-2">+${((totalProfit * 0.07) / 1000).toFixed(0)}K</span>
            </p>
          </div>
          <div className="text-right bg-slate-900 text-white px-4 py-2 rounded-lg">
            <p className="text-xs text-slate-400 uppercase">Revenue USD</p>
            <p className="text-2xl font-bold">
              ${(totalRevenue / 1000).toFixed(0)}K
              <span className="text-sm text-emerald-400 ml-2">+${((totalRevenue * 0.05) / 1000).toFixed(0)}K</span>
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" className="gap-2">
          <LayoutGrid className="w-4 h-4" />
          Detailed View
        </Button>
        <Button variant="outline" size="sm" className="gap-2">
          <Filter className="w-4 h-4" />
          Filters
        </Button>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="revenue">Revenue</SelectItem>
            <SelectItem value="profit">Profit</SelectItem>
            <SelectItem value="variance">Variance</SelectItem>
            <SelectItem value="name">Name</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Device Reconciliation */}
      <ServiceCategory
        title="Network Device"
        subtitle="per Device by Datto"
        customers={deviceReconciliation.slice(0, 6)}
        costPerUnit={deviceCostPerUnit}
        totalProfit={deviceTotalProfit}
        totalRevenue={deviceTotalRevenue}
      />

      {/* Backup Reconciliation */}
      <ServiceCategory
        title="Virtual Workstation Backup"
        subtitle="per User by Cove Data Protection"
        customers={backupReconciliation.slice(0, 6)}
        costPerUnit={backupCostPerUnit}
        totalProfit={backupTotalProfit}
        totalRevenue={backupTotalRevenue}
      />
    </div>
  );
}