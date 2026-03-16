import React, { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { client } from '@/api/client';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { staggerContainer, staggerItem, fadeInUp } from '@/lib/motion';
import {
  Package,
  RefreshCw,
  CheckCircle2,
  Hash,
  DollarSign,
  Search,
  Loader2,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { EmptyState } from "@/components/ui/empty-state";

const STATUS_COLORS = {
  Active: 'bg-success/15 text-success',
  active: 'bg-success/15 text-success',
  Suspended: 'bg-warning/15 text-warning',
  Cancelled: 'bg-destructive/15 text-destructive',
};

export default function Pax8Tab({ customerId, pax8Mapping, queryClient: externalQC }) {
  const internalQC = useQueryClient();
  const queryClient = externalQC || internalQC;

  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState('');
  const [expandedProduct, setExpandedProduct] = useState(null);

  // ── Cached data from mapping ──────────────────────────────────────
  const cachedData = useMemo(() => {
    if (!pax8Mapping?.cached_data) return null;
    return typeof pax8Mapping.cached_data === 'string'
      ? (() => { try { return JSON.parse(pax8Mapping.cached_data); } catch { return null; } })()
      : pax8Mapping.cached_data;
  }, [pax8Mapping?.cached_data]);

  // ── Sync handler ──────────────────────────────────────────────────
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

  // ── Products filtering ────────────────────────────────────────────
  const products = cachedData?.products || [];

  const filteredProducts = useMemo(() => {
    if (!search.trim()) return products;
    const q = search.toLowerCase();
    return products.filter(p =>
      (p.name || '').toLowerCase().includes(q)
    );
  }, [products, search]);

  const totalQuantity = cachedData?.totalQuantity || 0;
  const totalSubscriptions = cachedData?.totalSubscriptions || 0;

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Stat cards */}
      <motion.div variants={staggerContainer} initial="initial" animate="animate" className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[
          { key: 'totalSubscriptions', label: 'Active Subscriptions', value: totalSubscriptions, icon: Package, color: 'text-primary', bg: 'bg-primary/10' },
          { key: 'totalQuantity', label: 'Total Licences', value: totalQuantity, icon: Hash, color: 'text-[#7828C8]', bg: 'bg-[#7828C8]/10' },
          { key: 'products', label: 'Products', value: products.length, icon: CheckCircle2, color: 'text-success', bg: 'bg-success/10' },
        ].map((stat) => (
          <motion.div
            key={stat.key}
            variants={staggerItem}
            className="bg-card rounded-[14px] border shadow-hero-sm p-4 hover:shadow-hero-md transition-all duration-[250ms]"
          >
            <div className="flex items-center gap-3">
              <div className={cn('w-10 h-10 rounded-hero-md flex items-center justify-center', stat.bg)}>
                <stat.icon className={cn('w-5 h-5', stat.color)} />
              </div>
              <div>
                <AnimatedCounter value={stat.value} className="text-2xl font-bold text-foreground" />
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Products / Subscriptions table card */}
      <motion.div {...fadeInUp} className="bg-card rounded-[14px] border shadow-hero-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-border/50 flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground text-sm">M365 & Cloud Licences</h3>
            <p className="text-xs text-muted-foreground">
              {filteredProducts.length} product{filteredProducts.length !== 1 ? 's' : ''} · {totalQuantity} total licences
              {pax8Mapping?.last_synced && (
                <> · Synced {new Date(pax8Mapping.last_synced).toLocaleDateString()}</>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative w-48">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
              <Input
                placeholder="Search products..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); }}
                className="pl-8 h-8 text-xs"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSync}
              disabled={syncing}
              className="gap-2"
            >
              {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Sync
            </Button>
          </div>
        </div>

        {products.length === 0 && !cachedData ? (
          <EmptyState
            icon={Package}
            title="No Pax8 data yet"
            description="Click Sync to pull subscription data from Pax8"
            action={{ label: 'Sync Now', onClick: handleSync }}
          />
        ) : filteredProducts.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-muted-foreground">No products match your search</p>
          </div>
        ) : (
          <>
            {/* Table header */}
            <div className="grid grid-cols-[1fr_80px_80px] gap-2 px-5 py-2 bg-zinc-50 dark:bg-zinc-800/40 text-xs font-medium text-muted-foreground border-b border-border/30">
              <span>Product</span>
              <span className="text-right">Qty</span>
              <span className="text-right">Subs</span>
            </div>

            {/* Rows */}
            <motion.div variants={staggerContainer} initial="initial" animate="animate" className="divide-y divide-border/30">
              {filteredProducts.map((product) => {
                const isExpanded = expandedProduct === product.name;
                return (
                  <div key={product.name}>
                    <motion.div
                      variants={staggerItem}
                      className="grid grid-cols-[1fr_80px_80px] gap-2 px-5 py-3 items-center hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors duration-[250ms] cursor-pointer"
                      onClick={() => setExpandedProduct(isExpanded ? null : product.name)}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {isExpanded
                          ? <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          : <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        }
                        <div className={cn(
                          'w-8 h-8 rounded-hero-sm flex items-center justify-center flex-shrink-0 bg-primary/10'
                        )}>
                          <Package className="w-4 h-4 text-primary" />
                        </div>
                        <span className="text-sm font-medium text-foreground truncate">{product.name}</span>
                      </div>
                      <span className="text-sm font-semibold text-foreground text-right">{product.quantity}</span>
                      <span className="text-xs text-muted-foreground text-right">{product.subscriptions?.length || 0}</span>
                    </motion.div>

                    {/* Expanded subscriptions */}
                    {isExpanded && product.subscriptions?.length > 0 && (
                      <div className="bg-zinc-50/50 dark:bg-zinc-800/20 border-t border-border/20">
                        {product.subscriptions.map((sub) => (
                          <div
                            key={sub.id}
                            className="grid grid-cols-[1fr_60px_80px_80px] gap-2 px-5 pl-16 py-2 items-center text-xs border-b border-border/10 last:border-b-0"
                          >
                            <span className="text-muted-foreground truncate">
                              {sub.billingTerm || 'Monthly'}
                              {sub.startDate && <> · Started {new Date(sub.startDate).toLocaleDateString()}</>}
                            </span>
                            <Badge variant="flat" className={cn('text-[10px] w-fit', STATUS_COLORS[sub.status] || '')}>
                              {sub.status || '—'}
                            </Badge>
                            <span className="text-muted-foreground text-right">Qty {sub.quantity}</span>
                            <span className="text-muted-foreground text-right">
                              {sub.price ? `$${Number(sub.price).toFixed(2)}` : '—'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </motion.div>

            {/* Total row */}
            <div className="px-5 py-3 bg-zinc-50 dark:bg-zinc-800/50 border-t border-border/50 flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Total Licences</p>
              <p className="text-lg font-bold text-foreground">{totalQuantity}</p>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}
