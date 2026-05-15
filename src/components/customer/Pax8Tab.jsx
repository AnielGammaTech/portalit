import React, { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { client } from '@/api/client';
import { toast } from 'sonner';
import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  DollarSign,
  Hash,
  Loader2,
  Package,
  RefreshCw,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
import {
  PortalMetricCard,
  PortalSection,
  PortalStatusPill,
} from '@/components/ui/portal-primitives';

const STATUS_TONES = {
  active: 'emerald',
  suspended: 'amber',
  cancelled: 'rose',
  canceled: 'rose',
};

function parseCachedData(raw) {
  if (!raw) return null;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  return raw;
}

function safeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function safeDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value) {
  const date = safeDate(value);
  if (!date) return 'Not shown';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(value) {
  const date = safeDate(value);
  if (!date) return 'Not synced';
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatCurrency(value) {
  const amount = safeNumber(value);
  if (amount === null || amount <= 0) return 'Not shown';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: amount >= 100 ? 0 : 2,
  }).format(amount);
}

function formatBillingTerm(term) {
  const value = String(term || '').trim();
  if (!value) return 'Term not shown';
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());
}

function billingCode(term) {
  const value = String(term || '').toLowerCase();
  if (value.includes('annual') || value.includes('year')) return 'A';
  if (value.includes('monthly') || value.includes('month')) return 'M';
  return 'T';
}

function statusTone(status) {
  return STATUS_TONES[String(status || '').toLowerCase()] || 'slate';
}

function subscriptionTotal(sub) {
  const price = safeNumber(sub?.price);
  if (price === null || price <= 0) return 0;
  return price * (safeNumber(sub?.quantity) || 1);
}

function normalizeProduct(product) {
  const subscriptions = Array.isArray(product?.subscriptions) ? product.subscriptions : [];
  const subscriptionQuantity = subscriptions.reduce((sum, sub) => sum + (safeNumber(sub?.quantity) || 1), 0);
  const quantity = safeNumber(product?.quantity) ?? subscriptionQuantity;
  const estimatedTotal = subscriptions.reduce((sum, sub) => sum + subscriptionTotal(sub), 0);

  return {
    ...product,
    name: product?.name || 'Unnamed product',
    quantity,
    subscriptions,
    estimatedTotal,
  };
}

export default function Pax8Tab({ customerId, pax8Mapping, queryClient: externalQC }) {
  const internalQC = useQueryClient();
  const queryClient = externalQC || internalQC;

  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState('');
  const [expandedProduct, setExpandedProduct] = useState(null);

  const cachedData = useMemo(() => parseCachedData(pax8Mapping?.cached_data), [pax8Mapping?.cached_data]);

  const products = useMemo(() => {
    return (Array.isArray(cachedData?.products) ? cachedData.products : [])
      .map(normalizeProduct)
      .sort((a, b) => (b.quantity || 0) - (a.quantity || 0) || a.name.localeCompare(b.name));
  }, [cachedData]);

  const searchLower = search.trim().toLowerCase();
  const filteredProducts = useMemo(() => {
    if (!searchLower) return products;
    return products.filter(product => {
      const subscriptionText = product.subscriptions
        .map(sub => [sub.id, sub.status, sub.billingTerm].filter(Boolean).join(' '))
        .join(' ');
      return `${product.name} ${subscriptionText}`.toLowerCase().includes(searchLower);
    });
  }, [products, searchLower]);

  const totalQuantity = safeNumber(cachedData?.totalQuantity) ?? products.reduce((sum, product) => sum + product.quantity, 0);
  const totalSubscriptions = safeNumber(cachedData?.totalSubscriptions)
    ?? products.reduce((sum, product) => sum + product.subscriptions.length, 0);
  const estimatedTotal = products.reduce((sum, product) => sum + product.estimatedTotal, 0);
  const hasCostData = estimatedTotal > 0;
  const accountName = pax8Mapping?.pax8_company_name || 'Pax8 account';
  const lastSynced = formatDateTime(pax8Mapping?.last_synced);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const response = await client.functions.invoke('syncPax8Subscriptions', {
        action: 'sync_customer',
        customer_id: customerId,
      });
      if (response.success) {
        toast.success(`Synced ${response.totalSubscriptions || 0} Pax8 subscriptions`);
        queryClient.invalidateQueries({ queryKey: ['pax8-mapping', customerId] });
      } else {
        toast.error(response.error || 'Pax8 sync failed');
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-lg font-semibold text-slate-950">Pax8 Cloud Subscriptions</h2>
            {pax8Mapping?.last_synced && <PortalStatusPill label="Cached" tone="slate" />}
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {accountName} · Last synced {lastSynced}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleSync}
          disabled={syncing}
          className="w-full gap-2 sm:w-auto"
        >
          {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh Pax8
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <PortalMetricCard
          icon={Package}
          label="Subscriptions"
          value={totalSubscriptions}
          detail="Active Pax8 subscriptions"
          tone="blue"
          className="p-3"
        />
        <PortalMetricCard
          icon={Hash}
          label="Licenses"
          value={totalQuantity}
          detail="Seats and quantities"
          tone="emerald"
          className="p-3"
        />
        <PortalMetricCard
          icon={CheckCircle2}
          label="Products"
          value={products.length}
          detail="Grouped by product"
          tone="violet"
          className="p-3"
        />
        <PortalMetricCard
          icon={DollarSign}
          label="Listed Cost"
          value={hasCostData ? formatCurrency(estimatedTotal) : '-'}
          detail={hasCostData ? 'From Pax8 subscription prices' : 'Price not returned'}
          tone={hasCostData ? 'amber' : 'slate'}
          className="p-3"
        />
      </div>

      <PortalSection
        title="Product Inventory"
        description={`Showing ${filteredProducts.length} of ${products.length} Pax8 products.`}
        badge={<PortalStatusPill label={`${totalQuantity} licenses`} tone="blue" />}
        actions={(
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search products or subscriptions"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-9 pl-9"
            />
          </div>
        )}
        bodyClassName="overflow-x-auto"
      >
        {products.length === 0 && !cachedData ? (
          <EmptyState
            icon={Package}
            title="No Pax8 data yet"
            description="Refresh Pax8 to pull subscription data for this account."
            action={{ label: 'Refresh Pax8', onClick: handleSync }}
          />
        ) : filteredProducts.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-slate-500">
            No products match the current search.
          </div>
        ) : (
          <div className="min-w-[780px]">
            <div className="grid grid-cols-[minmax(0,1fr)_110px_110px_140px_40px] gap-3 border-b border-slate-200 bg-slate-50 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <span>Product</span>
              <span className="text-right">Licenses</span>
              <span className="text-right">Subscriptions</span>
              <span className="text-right">Listed cost</span>
              <span />
            </div>

            <div className="divide-y divide-slate-100">
              {filteredProducts.map(product => {
                const isExpanded = expandedProduct === product.name;
                return (
                  <div key={product.name}>
                    <button
                      type="button"
                      onClick={() => setExpandedProduct(isExpanded ? null : product.name)}
                      className="grid w-full grid-cols-[minmax(0,1fr)_110px_110px_140px_40px] items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-slate-50"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-blue-100 bg-blue-50 text-blue-700">
                          <Package className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-950">{product.name}</p>
                          <p className="truncate text-xs text-slate-500">
                            {product.subscriptions.length || 0} subscription{product.subscriptions.length === 1 ? '' : 's'}
                          </p>
                        </div>
                      </div>
                      <span className="text-right text-sm font-semibold tabular-nums text-slate-950">{product.quantity}</span>
                      <span className="text-right text-sm tabular-nums text-slate-700">{product.subscriptions.length || 0}</span>
                      <span className="text-right text-sm font-semibold tabular-nums text-slate-950">
                        {product.estimatedTotal > 0 ? formatCurrency(product.estimatedTotal) : '-'}
                      </span>
                      <span className="flex justify-end text-slate-400">
                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </span>
                    </button>

                    {isExpanded && (
                      <div className="border-t border-slate-100 bg-slate-50/70 px-5 py-3">
                        {product.subscriptions.length > 0 ? (
                          <div className="divide-y divide-slate-200">
                            <div className="grid grid-cols-[minmax(0,1fr)_100px_90px_120px_130px] gap-3 pb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                              <span>Subscription</span>
                              <span>Status</span>
                              <span className="text-right">Qty</span>
                              <span className="text-right">Unit price</span>
                              <span className="text-right">Start date</span>
                            </div>
                            {product.subscriptions.map((sub, index) => {
                              const key = sub.id || `${product.name}-${index}`;
                              const term = formatBillingTerm(sub.billingTerm);
                              const code = billingCode(sub.billingTerm);
                              return (
                                <div key={key} className="grid grid-cols-[minmax(0,1fr)_100px_90px_120px_130px] items-center gap-3 py-2 text-sm">
                                  <div className="min-w-0">
                                    <div className="flex min-w-0 items-center gap-2">
                                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-[11px] font-bold text-slate-600">
                                        {code}
                                      </span>
                                      <p className="truncate font-medium text-slate-800">{term}</p>
                                    </div>
                                    {sub.id && <p className="mt-0.5 truncate text-xs text-slate-500">{sub.id}</p>}
                                  </div>
                                  <PortalStatusPill label={sub.status || 'Unknown'} tone={statusTone(sub.status)} className="w-fit px-2 py-0.5" />
                                  <span className="text-right font-semibold tabular-nums text-slate-950">{safeNumber(sub.quantity) || 1}</span>
                                  <span className="text-right tabular-nums text-slate-700">{formatCurrency(sub.price)}</span>
                                  <span className="flex items-center justify-end gap-1.5 text-right text-slate-600">
                                    <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
                                    {formatDate(sub.startDate)}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="py-2 text-sm text-slate-500">Pax8 did not return subscription-level detail for this product.</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </PortalSection>
    </div>
  );
}
