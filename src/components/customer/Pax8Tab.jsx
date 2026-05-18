import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { client } from '@/api/client';
import { toast } from 'sonner';
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Hash,
  Loader2,
  Package,
  RefreshCw,
  Search,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
import {
  PortalMetricCard,
  PortalSection,
  PortalStatusPill,
} from '@/components/ui/portal-primitives';
import MetricHelp from './MetricHelp';

const STATUS_TONES = {
  active: 'emerald',
  suspended: 'amber',
  cancelled: 'rose',
  canceled: 'rose',
};

const LICENSE_ALIASES = {
  O365_BUSINESS_PREMIUM: 'Microsoft 365 Business Premium',
  SPB: 'Microsoft 365 Business Premium',
  O365_BUSINESS_ESSENTIALS: 'Microsoft 365 Business Basic',
  O365_BUSINESS: 'Microsoft 365 Apps for Business',
  O365_BUSINESS_STANDARD: 'Microsoft 365 Business Standard',
  EXCHANGESTANDARD: 'Exchange Online Plan 1',
  EXCHANGEENTERPRISE: 'Exchange Online Plan 2',
  SPE_E3: 'Microsoft 365 E3',
  SPE_E5: 'Microsoft 365 E5',
  ENTERPRISEPACK: 'Office 365 E3',
  ENTERPRISEPREMIUM: 'Office 365 E5',
  VISIOCLIENT: 'Visio Plan 2',
  PROJECTPROFESSIONAL: 'Project Plan 3',
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

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  if (typeof value === 'string') {
    return value.split(',').map(item => item.trim()).filter(Boolean);
  }
  return [value].filter(Boolean);
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

function normalizeProduct(product) {
  const subscriptions = Array.isArray(product?.subscriptions) ? product.subscriptions : [];
  const subscriptionQuantity = subscriptions.reduce((sum, sub) => sum + (safeNumber(sub?.quantity) || 1), 0);
  const quantity = safeNumber(product?.quantity) ?? subscriptionQuantity;
  const rawName = product?.name || product?.productName || product?.description || '';

  return {
    ...product,
    rawName,
    name: formatLicenseName(rawName) || 'Unnamed product',
    quantity,
    subscriptions,
  };
}

function formatLicenseName(raw) {
  const value = String(raw || '').trim();
  if (!value) return '';
  const sku = value.includes(':') ? value.split(':').pop() : value;
  if (LICENSE_ALIASES[sku]) return LICENSE_ALIASES[sku];
  return sku
    .replace(/\[[^\]]*(new\s+commerce|nce)[^\]]*\]/gi, ' ')
    .replace(/\([^)]*(new\s+commerce|nce)[^)]*\)/gi, ' ')
    .replace(/\bnew\s+commerce\s+experience\b/gi, ' ')
    .replace(/\bnce\b/gi, ' ')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function licenseMatchKey(raw) {
  const value = formatLicenseName(raw).toLowerCase();
  if (!value) return '';

  const compact = value.replace(/[^a-z0-9]/g, '');
  const isMicrosoft365 = value.includes('microsoft 365');
  const isOffice365 = value.includes('office 365');

  if (isMicrosoft365 && /\be5\b/.test(value)) return 'microsoft-365-e5';
  if (isMicrosoft365 && /\be3\b/.test(value)) return 'microsoft-365-e3';
  if (isOffice365 && /\be5\b/.test(value)) return 'office-365-e5';
  if (isOffice365 && /\be3\b/.test(value)) return 'office-365-e3';
  if (value.includes('business premium') || compact.includes('businesspremium')) return 'm365-business-premium';
  if (value.includes('business standard') || compact.includes('businessstandard')) return 'm365-business-standard';
  if (value.includes('business basic') || compact.includes('businessbasic')) return 'm365-business-basic';
  if (value.includes('apps for business') || compact.includes('appsforbusiness')) return 'm365-apps-for-business';
  if (value.includes('apps for enterprise') || compact.includes('appsforenterprise')) return 'm365-apps-for-enterprise';
  if (value.includes('exchange online') && (value.includes('plan 1') || compact.includes('plan1'))) return 'exchange-online-plan-1';
  if (value.includes('exchange online') && (value.includes('plan 2') || compact.includes('plan2'))) return 'exchange-online-plan-2';
  if (value.includes('power bi pro') || compact.includes('powerbipro')) return 'power-bi-pro';
  if (value.includes('visio') && (value.includes('plan 2') || compact.includes('plan2'))) return 'visio-plan-2';
  if (value.includes('planner') && value.includes('project') && (value.includes('plan 3') || compact.includes('plan3'))) return 'project-plan-3';
  if (value.includes('project') && (value.includes('plan 3') || compact.includes('plan3'))) return 'project-plan-3';
  if (value.includes('audio conferencing')) return 'audio-conferencing';
  if (value.includes('teams rooms basic')) return 'teams-rooms-basic';
  if (value.includes('teams rooms pro')) return 'teams-rooms-pro';
  if (value.includes('defender for office') && (value.includes('plan 2') || compact.includes('plan2'))) return 'defender-office-365-plan-2';
  if (value.includes('entra id p2') || compact.includes('entraidp2')) return 'entra-id-p2';

  return value
    .replace(/\b(microsoft|office|365|license|licenses|subscription|commercial|nce|annual|monthly)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, '-');
}

function cippUserLicenses(user) {
  const cached = parseCachedData(user?.cached_data) || {};
  const fromCache = asArray(cached.license_names || cached.licenses)
    .map(formatLicenseName)
    .filter(Boolean);

  if (fromCache.length > 0) return [...new Set(fromCache)];

  return asArray(user?.assigned_licenses)
    .map(license => {
      if (typeof license === 'string') return formatLicenseName(license);
      return formatLicenseName(
        license?.skuName ||
        license?.SkuName ||
        license?.displayName ||
        license?.skuPartNumber ||
        license?.SkuPartNumber ||
        license?.skuId ||
        license?.SkuId
      );
    })
    .filter(Boolean);
}

export default function Pax8Tab({ customerId, pax8Mapping, queryClient: externalQC, canSync = false }) {
  const internalQC = useQueryClient();
  const queryClient = externalQC || internalQC;

  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState('');
  const [expandedProduct, setExpandedProduct] = useState(null);

  const { data: cippUsersRaw = [], isLoading: loadingCippUsers } = useQuery({
    queryKey: ['cipp-users', customerId],
    queryFn: () => client.entities.CIPPUser.filter({ customer_id: customerId }),
    enabled: !!customerId,
    staleTime: 1000 * 60 * 5,
  });
  const cippUsers = cippUsersRaw ?? [];

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
  const cippUsersByLicense = useMemo(() => {
    const map = new Map();
    for (const user of cippUsers) {
      for (const license of cippUserLicenses(user)) {
        const key = licenseMatchKey(license);
        if (!key) continue;
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(user);
      }
    }
    return map;
  }, [cippUsers]);
  const matchedCippUserCount = useMemo(() => {
    const userIds = new Set();
    for (const product of products) {
      for (const user of cippUsersByLicense.get(licenseMatchKey(product.name)) || []) {
        userIds.add(user.id || user.user_principal_name || user.mail);
      }
    }
    return userIds.size;
  }, [cippUsersByLicense, products]);
  const accountName = pax8Mapping?.pax8_company_name || 'Pax8 account';
  const lastSynced = formatDateTime(pax8Mapping?.last_synced);
  const userMatchLabel = canSync ? 'CIPP Matches' : 'User Assignments';
  const userMatchDetail = loadingCippUsers
    ? (canSync ? 'Checking CIPP users' : 'Checking Microsoft users')
    : (canSync ? 'Users matched to products' : 'Microsoft users linked to products');
  const productUserColumn = canSync ? 'CIPP users' : 'Assigned users';

  const handleSync = async () => {
    if (!canSync) return;
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
        {canSync && (
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
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-4">
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
          icon={Users}
          label={userMatchLabel}
          value={matchedCippUserCount}
          detail={userMatchDetail}
          tone="slate"
          className="p-3"
        />
      </div>

      <PortalSection
        title="Product Inventory"
        description={`Showing ${filteredProducts.length} of ${products.length} Pax8 products.`}
        badge={(
          <div className="flex items-center gap-2">
            <PortalStatusPill label={`${totalQuantity} licenses`} tone="blue" />
            <MetricHelp label="Pax8 product matching help">
              {canSync
                ? 'Pax8 is the billing source. Microsoft user assignments are linked by normalized license names, so add-ons, stale sync data, or vendor naming differences may need internal review.'
                : 'Pax8 is the billing source. Microsoft assignment detail appears when the portal can cleanly link the subscription to Microsoft users.'}
            </MetricHelp>
          </div>
        )}
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
            description="Subscription data will appear here once it is available for this account."
            action={canSync ? { label: 'Refresh Pax8', onClick: handleSync } : undefined}
          />
        ) : filteredProducts.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-slate-500">
            No products match the current search.
          </div>
        ) : (
          <div className="min-w-[780px]">
            <div className="grid grid-cols-[minmax(0,1fr)_110px_120px_120px_40px] gap-3 border-b border-slate-200 bg-slate-50 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <span>Product</span>
              <span className="text-right">Licenses</span>
              <span className="text-right">Subscriptions</span>
              <span className="text-right">{productUserColumn}</span>
              <span />
            </div>

            <div className="divide-y divide-slate-100">
              {filteredProducts.map(product => {
                const isExpanded = expandedProduct === product.name;
                const matchedUsers = cippUsersByLicense.get(licenseMatchKey(product.name)) || [];
                const hasMatchedUsers = matchedUsers.length > 0;
                const matchStatusLabel = loadingCippUsers
                  ? (canSync ? 'Checking CIPP' : 'Checking')
                  : hasMatchedUsers ? `${matchedUsers.length} linked`
                    : canSync ? 'Review mapping'
                      : 'Details unavailable';
                const matchStatusTone = hasMatchedUsers ? 'blue' : canSync ? 'amber' : 'slate';
                return (
                  <div key={product.name}>
                    <button
                      type="button"
                      onClick={() => setExpandedProduct(isExpanded ? null : product.name)}
                      className="grid w-full grid-cols-[minmax(0,1fr)_110px_120px_120px_40px] items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-slate-50"
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
                        {matchedUsers.length || (canSync ? 'Review' : '-')}
                      </span>
                      <span className="flex justify-end text-slate-400">
                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </span>
                    </button>

                    {isExpanded && (
                      <div className="border-t border-slate-100 bg-slate-50/70 px-5 py-3">
                        <div className="mb-4 rounded-lg border border-slate-200 bg-white">
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
                            <div>
                              <div className="flex items-center gap-1.5">
                                <p className="text-sm font-semibold text-slate-950">Assigned users in Microsoft 365</p>
                                <MetricHelp label="Assigned users matching help">
                                  {canSync
                                    ? 'Internal view: this list is matched by normalized Pax8 product names and Microsoft/CIPP license names.'
                                    : 'This list appears when the portal can safely link the billing subscription to Microsoft user assignments.'}
                                </MetricHelp>
                              </div>
                              <p className="text-xs text-slate-500">
                                {canSync
                                  ? 'Matched by Pax8 product name to Microsoft license names.'
                                  : 'Microsoft assignment details appear when the license can be linked cleanly.'}
                              </p>
                            </div>
                            <PortalStatusPill
                              label={matchStatusLabel}
                              tone={matchStatusTone}
                              icon={hasMatchedUsers ? Users : canSync ? AlertCircle : Users}
                            />
                          </div>
                          {loadingCippUsers ? (
                            <p className="px-4 py-3 text-sm text-slate-500">
                              {canSync ? 'Loading CIPP users...' : 'Loading Microsoft users...'}
                            </p>
                          ) : matchedUsers.length > 0 ? (
                            <div className="divide-y divide-slate-100">
                              {matchedUsers
                                .slice()
                                .sort((a, b) => (a.display_name || a.user_principal_name || '').localeCompare(b.display_name || b.user_principal_name || ''))
                                .map(user => (
                                  <div key={user.id || user.user_principal_name} className="grid grid-cols-[minmax(0,1fr)_160px_110px] items-center gap-3 px-4 py-2.5 text-sm">
                                    <div className="min-w-0">
                                      <p className="truncate font-semibold text-slate-950">{user.display_name || user.user_principal_name}</p>
                                      <p className="truncate text-xs text-slate-500">{user.mail || user.user_principal_name}</p>
                                    </div>
                                    <p className="truncate text-xs text-slate-600">{user.job_title || 'No title shown'}</p>
                                    <PortalStatusPill
                                      label={user.account_enabled === false ? 'Disabled' : 'Active'}
                                      tone={user.account_enabled === false ? 'amber' : 'emerald'}
                                      className="w-fit justify-self-end px-2 py-0.5"
                                    />
                                  </div>
                                ))}
                            </div>
                          ) : (
                            <div className={`px-4 py-3 text-sm ${canSync ? 'bg-amber-50 text-amber-800' : 'text-slate-500'}`}>
                              {canSync ? (
                                <div className="flex gap-2">
                                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                                  <div>
                                    <p className="font-semibold">Mapping review needed</p>
                                    <p className="mt-1 text-xs leading-5">
                                      Pax8 returned this as "{product.rawName || product.name}", but no Microsoft users matched the normalized license key yet. Common causes are NCE billing suffixes, Microsoft SKU aliases, add-ons that are not user-assigned, stale CIPP sync data, or a real open-seat difference.
                                    </p>
                                  </div>
                                </div>
                              ) : (
                                <p>
                                  Assignment detail is not available for this subscription in the portal yet. The subscription is still included in the license totals above.
                                </p>
                              )}
                            </div>
                          )}
                        </div>

                        {product.subscriptions.length > 0 ? (
                          <div className="divide-y divide-slate-200">
                            <div className="grid grid-cols-[minmax(0,1fr)_100px_90px_130px] gap-3 pb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                              <span>Subscription</span>
                              <span>Status</span>
                              <span className="text-right">Qty</span>
                              <span className="text-right">Start date</span>
                            </div>
                            {product.subscriptions.map((sub, index) => {
                              const key = sub.id || `${product.name}-${index}`;
                              const term = formatBillingTerm(sub.billingTerm);
                              const code = billingCode(sub.billingTerm);
                              return (
                                <div key={key} className="grid grid-cols-[minmax(0,1fr)_100px_90px_130px] items-center gap-3 py-2 text-sm">
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
