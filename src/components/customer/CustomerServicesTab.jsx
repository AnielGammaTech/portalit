import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { client } from '@/api/client';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { staggerContainer, staggerItem, fadeInUp } from '@/lib/motion';
import {
  Cloud,
  Users,
  Shield,
  HardDrive,
  RefreshCw,
  ChevronDown,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  AlertTriangle,
  Fish,
  Monitor,
  Loader2,
  DollarSign,
  Wifi,
  ShieldAlert,
  Database,
  Package,
  ShieldCheck,
  Phone,
  Globe
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonTable } from "@/components/ui/shimmer-skeleton";
import UserDetailModal from './UserDetailModal';
import DarkWebTab from './DarkWebTab';
import BullPhishTab from './BullPhishTab';
import SpanningUsersTab from './SpanningUsersTab';
import DevicesTab from './DevicesTab';
import DattoEDRTab from './DattoEDRTab';
import RocketCyberTab from './RocketCyberTab';
import UniFiTab from './UniFiTab';
import SaaSAlertsTab from './SaaSAlertsTab';
import CoveTab from './CoveTab';
import Pax8Tab from './Pax8Tab';
import InkyTab from './InkyTab';
import ThreeCXTab from './ThreeCXTab';
import DmarcReportTab from './DmarcReportTab';

export default function CustomerServicesTab({ 
  customerId, 
  customer, 
  lineItems = [],
  expandedBills,
  setExpandedBills,
  isSyncing,
  setIsSyncing,
  queryClient,
  devices = []
}) {
  const [syncingJumpCloud, setSyncingJumpCloud] = useState(false);
  const [syncingSpanning, setSyncingSpanning] = useState(false);
  const [syncingDatto, setSyncingDatto] = useState(false);
  const [syncingHalo, setSyncingHalo] = useState(false);
  const [syncingAll, setSyncingAll] = useState(false);
  const [jcUsersPage, setJcUsersPage] = useState(0);
  const [spanningUsersPage, setSpanningUsersPage] = useState(0);
  const [selectedContact, setSelectedContact] = useState(null);
  const [syncStatuses, setSyncStatuses] = useState({
    halopsa: { status: 'idle', lastSync: null, error: null },
    datto: { status: 'idle', lastSync: null, error: null },
    jumpcloud: { status: 'idle', lastSync: null, error: null },
    spanning: { status: 'idle', lastSync: null, error: null }
  });

  // Fetch JumpCloud mapping for this customer (includes cached_data)
  const { data: jumpcloudMapping } = useQuery({
    queryKey: ['jumpcloud-mapping', customerId],
    queryFn: async () => {
      const mappings = await client.entities.JumpCloudMapping.filter({ customer_id: customerId });
      return mappings[0] || null;
    },
    enabled: !!customerId,
    staleTime: 1000 * 60 * 5 // Cache for 5 minutes
  });

  // Fetch Spanning mapping for this customer (includes cached_data)
  const { data: spanningMapping } = useQuery({
    queryKey: ['spanning-mapping', customerId],
    queryFn: async () => {
      const mappings = await client.entities.SpanningMapping.filter({ customer_id: customerId });
      return mappings[0] || null;
    },
    enabled: !!customerId,
    staleTime: 1000 * 60 * 5 // Cache for 5 minutes
  });

  // Fetch JumpCloud contacts for this customer
  const { data: jumpcloudContacts = [] } = useQuery({
    queryKey: ['jumpcloud-contacts', customerId],
    queryFn: () => client.entities.Contact.filter({ customer_id: customerId, source: 'jumpcloud' }),
    enabled: !!customerId && !!jumpcloudMapping,
    staleTime: 1000 * 60 * 5 // Cache for 5 minutes
  });

  // Fetch JumpCloud licenses for this customer
  const { data: jumpcloudLicenses = [] } = useQuery({
    queryKey: ['jumpcloud-licenses', customerId],
    queryFn: () => client.entities.SaaSLicense.filter({ customer_id: customerId, source: 'jumpcloud' }),
    enabled: !!customerId && !!jumpcloudMapping,
    staleTime: 1000 * 60 * 5 // Cache for 5 minutes
  });

  // Fetch Spanning contacts for this customer (any contact with spanning_status set)
  const { data: spanningContacts = [] } = useQuery({
    queryKey: ['spanning-contacts', customerId],
    queryFn: async () => {
      const contacts = await client.entities.Contact.filter({ customer_id: customerId });
      return contacts.filter(c => c.spanning_status);
    },
    enabled: !!customerId && !!spanningMapping
  });

  // Fetch Spanning licenses for this customer
  const { data: spanningLicenses = [] } = useQuery({
    queryKey: ['spanning-licenses', customerId],
    queryFn: () => client.entities.SaaSLicense.filter({ customer_id: customerId, vendor: 'Unitrends' }),
    enabled: !!customerId && !!spanningMapping
  });

  // Fetch Datto site mapping for this customer
  const { data: dattoMapping } = useQuery({
    queryKey: ['datto-mapping', customerId],
    queryFn: async () => {
      const mappings = await client.entities.DattoSiteMapping.filter({ customer_id: customerId });
      return mappings[0] || null;
    },
    enabled: !!customerId
  });

  // Fetch Dark Web ID mapping for this customer
  const { data: darkwebMapping } = useQuery({
    queryKey: ['darkwebid-mapping', customerId],
    queryFn: async () => {
      const mappings = await client.entities.DarkWebIDMapping.filter({ customer_id: customerId });
      return mappings[0] || null;
    },
    enabled: !!customerId
  });

  // Fetch Dark Web ID reports for this customer (reports can exist without mapping)
  const { data: darkwebReports = [] } = useQuery({
    queryKey: ['darkwebid-reports', customerId],
    queryFn: () => client.entities.DarkWebIDReport.filter({ customer_id: customerId }),
    enabled: !!customerId
  });

  // Fetch BullPhish ID reports for this customer
  const { data: bullphishReports = [] } = useQuery({
    queryKey: ['bullphishid-reports', customerId],
    queryFn: () => client.entities.BullPhishIDReport.filter({ customer_id: customerId }),
    enabled: !!customerId
  });

  // Fetch Inky reports for this customer
  const { data: inkyReports = [] } = useQuery({
    queryKey: ['inky-reports', customerId],
    queryFn: () => client.entities.InkyReport.filter({ customer_id: customerId }),
    enabled: !!customerId
  });

  // Fetch Datto EDR mapping for this customer
  const { data: edrMapping } = useQuery({
    queryKey: ['edr-mapping', customerId],
    queryFn: async () => {
      const mappings = await client.entities.DattoEDRMapping.filter({ customer_id: customerId });
      return mappings[0] || null;
    },
    enabled: !!customerId
  });

  // Fetch RocketCyber mapping for this customer
  const { data: rocketcyberMapping } = useQuery({
    queryKey: ['rocketcyber-mapping', customerId],
    queryFn: async () => {
      const mappings = await client.entities.RocketCyberMapping.filter({ customer_id: customerId });
      return mappings[0] || null;
    },
    enabled: !!customerId
  });

  // Fetch UniFi mapping for this customer
  const { data: unifiMapping } = useQuery({
    queryKey: ['unifi-mapping', customerId],
    queryFn: async () => {
      const mappings = await client.entities.UniFiMapping.filter({ customer_id: customerId });
      return mappings[0] || null;
    },
    enabled: !!customerId
  });

  // Fetch SaaS Alerts mapping for this customer
  const { data: saasAlertsMapping } = useQuery({
    queryKey: ['saas-alerts-mapping', customerId],
    queryFn: async () => {
      const mappings = await client.entities.SaaSAlertsMapping.filter({ customer_id: customerId });
      return mappings[0] || null;
    },
    enabled: !!customerId
  });

  // Fetch Cove Data Protection mapping for this customer
  const { data: coveMapping } = useQuery({
    queryKey: ['cove-mapping', customerId],
    queryFn: async () => {
      const mappings = await client.entities.CoveDataMapping.filter({ customer_id: customerId });
      return mappings[0] || null;
    },
    enabled: !!customerId
  });

  // Fetch 3CX mapping for this customer
  const { data: threecxMapping } = useQuery({
    queryKey: ['threecx-mapping', customerId],
    queryFn: async () => {
      const mappings = await client.entities.ThreeCXMapping.filter({ customer_id: customerId });
      return mappings[0] || null;
    },
    enabled: !!customerId,
    staleTime: 1000 * 60 * 5
  });

  // Fetch 3CX reports for this customer (CSV/PDF uploads)
  const { data: threecxReports = [] } = useQuery({
    queryKey: ['threecx-reports', customerId],
    queryFn: () => client.entities.ThreeCXReport.filter({ customer_id: customerId }),
    enabled: !!customerId,
    staleTime: 1000 * 60 * 5
  });

  // Fetch Pax8 mapping for this customer
  const { data: pax8Mapping } = useQuery({
    queryKey: ['pax8-mapping', customerId],
    queryFn: async () => {
      const mappings = await client.entities.Pax8Mapping.filter({ customer_id: customerId });
      return mappings[0] || null;
    },
    enabled: !!customerId,
    staleTime: 1000 * 60 * 5
  });

  // Fetch DMARC Report mapping for this customer
  const { data: dmarcMapping } = useQuery({
    queryKey: ['dmarc-mapping', customerId],
    queryFn: async () => {
      const mappings = await client.entities.DmarcReportMapping.filter({ customer_id: customerId });
      return mappings[0] || null;
    },
    enabled: !!customerId,
    staleTime: 1000 * 60 * 5
  });

  const hasDmarc = !!dmarcMapping;
  const has3CX = !!threecxMapping || threecxReports.length > 0;
  const hasInky = inkyReports.length > 0;
  const hasBullPhish = bullphishReports.length > 0;
  const hasDarkWeb = !!darkwebMapping || darkwebReports.length > 0;
  const hasEDR = !!edrMapping;
  const hasRocketCyber = !!rocketcyberMapping;
  const hasUniFi = !!unifiMapping;
  const hasSaaSAlerts = !!saasAlertsMapping;
  const hasCove = !!coveMapping;
  const hasPax8 = !!pax8Mapping;

  const updateSyncStatus = (service, status, error = null) => {
    setSyncStatuses(prev => ({
      ...prev,
      [service]: {
        status,
        lastSync: status === 'success' ? new Date().toISOString() : prev[service].lastSync,
        error: error
      }
    }));
  };

  const handleSyncHaloPSA = async () => {
    if (customer?.source !== 'halopsa' || !customer?.external_id) return;
    setSyncingHalo(true);
    updateSyncStatus('halopsa', 'syncing');
    try {
      const response = await client.functions.invoke('syncHaloPSAContacts', {
        action: 'sync_customer',
        customer_id: customer.external_id
      });
      if (response.success) {
        updateSyncStatus('halopsa', 'success');
        toast.success(`HaloPSA: Synced ${response.recordsSynced || 0} contacts`);
        queryClient.invalidateQueries();
      } else {
        updateSyncStatus('halopsa', 'error', response.error);
        toast.error(response.error || 'HaloPSA sync failed');
      }
    } catch (error) {
      updateSyncStatus('halopsa', 'error', error.message);
      toast.error(error.message);
    } finally {
      setSyncingHalo(false);
    }
  };

  const handleSyncDatto = async () => {
    if (!dattoMapping) return;
    setSyncingDatto(true);
    updateSyncStatus('datto', 'syncing');
    try {
      const response = await client.functions.invoke('syncDattoRMMDevices', {
        action: 'sync_devices',
        customer_id: customerId
      });
      if (response.success) {
        updateSyncStatus('datto', 'success');
        toast.success(`Datto: Synced ${response.recordsSynced || 0} devices`);
        queryClient.invalidateQueries();
      } else {
        updateSyncStatus('datto', 'error', response.error);
        toast.error(response.error || 'Datto sync failed');
      }
    } catch (error) {
      updateSyncStatus('datto', 'error', error.message);
      toast.error(error.message);
    } finally {
      setSyncingDatto(false);
    }
  };

  const handleSyncAll = async () => {
    setSyncingAll(true);
    const results = [];
    const errors = [];
    
    try {
      // Sync HaloPSA contacts if customer is from HaloPSA
      if (customer?.source === 'halopsa' && customer?.external_id) {
        updateSyncStatus('halopsa', 'syncing');
        try {
          const res = await client.functions.invoke('syncHaloPSAContacts', {
            action: 'sync_customer',
            customer_id: customer.external_id
          });
          if (res.success) {
            updateSyncStatus('halopsa', 'success');
            results.push(`HaloPSA (${res.recordsSynced || 0} contacts)`);
          } else {
            updateSyncStatus('halopsa', 'error', res.error);
            errors.push('HaloPSA');
          }
        } catch (e) {
          updateSyncStatus('halopsa', 'error', e.message);
          errors.push('HaloPSA');
        }
      }

      // Sync Datto RMM if mapped
      if (dattoMapping) {
        updateSyncStatus('datto', 'syncing');
        try {
          const res = await client.functions.invoke('syncDattoRMMDevices', {
            action: 'sync_devices',
            customer_id: customerId
          });
          if (res.success) {
            updateSyncStatus('datto', 'success');
            results.push(`Datto (${res.recordsSynced || 0} devices)`);
          } else {
            updateSyncStatus('datto', 'error', res.error);
            errors.push('Datto');
          }
        } catch (e) {
          updateSyncStatus('datto', 'error', e.message);
          errors.push('Datto');
        }
      }

      // Sync JumpCloud if mapped
      if (jumpcloudMapping) {
        updateSyncStatus('jumpcloud', 'syncing');
        try {
          const res = await client.functions.invoke('syncJumpCloudLicenses', {
            action: 'sync_licenses',
            customer_id: customerId
          });
          if (res.success) {
            updateSyncStatus('jumpcloud', 'success');
            results.push(`JumpCloud (${(res.contactsCreated || 0) + (res.contactsUpdated || 0)} users)`);
          } else {
            updateSyncStatus('jumpcloud', 'error', res.error);
            errors.push('JumpCloud');
          }
        } catch (e) {
          updateSyncStatus('jumpcloud', 'error', e.message);
          errors.push('JumpCloud');
        }
      }

      // Sync Spanning if mapped
      if (spanningMapping) {
        updateSyncStatus('spanning', 'syncing');
        try {
          const res = await client.functions.invoke('syncSpanningBackup', {
            action: 'sync_licenses',
            customer_id: customerId
          });
          if (res.success) {
            updateSyncStatus('spanning', 'success');
            results.push(`Spanning (${res.contactsUpdated || 0} users)`);
          } else {
            updateSyncStatus('spanning', 'error', res.error);
            errors.push('Spanning');
          }
        } catch (e) {
          updateSyncStatus('spanning', 'error', e.message);
          errors.push('Spanning');
        }
      }

      if (results.length > 0) {
        toast.success(`Synced: ${results.join(', ')}`);
        queryClient.invalidateQueries();
      }
      if (errors.length > 0) {
        toast.error(`Failed: ${errors.join(', ')}`);
      }
      if (results.length === 0 && errors.length === 0) {
        toast.info('No integrations to sync');
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSyncingAll(false);
    }
  };

  const handleSyncJumpCloud = async () => {
    if (!jumpcloudMapping) return;
    setSyncingJumpCloud(true);
    try {
      const response = await client.functions.invoke('syncJumpCloudLicenses', {
        action: 'sync_licenses',
        customer_id: customerId
      });
      if (response.success) {
        toast.success('JumpCloud data synced!');
        queryClient.invalidateQueries({ queryKey: ['jumpcloud-contacts', customerId] });
        queryClient.invalidateQueries({ queryKey: ['jumpcloud-licenses', customerId] });
        queryClient.invalidateQueries({ queryKey: ['jumpcloud-mapping', customerId] });
      } else {
        toast.error(response.error || 'Sync failed');
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSyncingJumpCloud(false);
    }
  };

  // Get cached JumpCloud stats
  const jumpcloudCachedStats = React.useMemo(() => {
    if (!jumpcloudMapping?.cached_data) return null;
    return typeof jumpcloudMapping.cached_data === 'string'
      ? (() => { try { return JSON.parse(jumpcloudMapping.cached_data); } catch { return null; } })()
      : jumpcloudMapping.cached_data;
  }, [jumpcloudMapping?.cached_data]);

  const handleSyncSpanning = async () => {
    if (!spanningMapping) return;
    setSyncingSpanning(true);
    try {
      const response = await client.functions.invoke('syncSpanningBackup', {
        action: 'sync_licenses',
        customer_id: customerId
      });
      if (response.success) {
        toast.success('Unitrends data synced!');
        queryClient.invalidateQueries({ queryKey: ['spanning-mapping', customerId] });
        queryClient.invalidateQueries({ queryKey: ['spanning-contacts', customerId] });
        queryClient.invalidateQueries({ queryKey: ['spanning-licenses', customerId] });
      } else {
        toast.error(response.error || 'Sync failed');
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSyncingSpanning(false);
    }
  };

  const hasJumpCloud = !!jumpcloudMapping;
  const hasSpanning = !!spanningMapping;
  const hasRecurringServices = lineItems.length > 0;

  const hasHaloPSA = customer?.source === 'halopsa' && customer?.external_id;
  const hasDatto = !!dattoMapping;
  const hasDevices = devices.length > 0 || hasDatto;

  const formatLastSync = (dateStr) => {
    if (!dateStr) return 'Never';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'syncing': return <Loader2 className="w-4 h-4 animate-spin text-primary" />;
      case 'success': return <CheckCircle2 className="w-4 h-4 text-success" />;
      case 'error': return <AlertCircle className="w-4 h-4 text-destructive" />;
      default: return <div className="w-4 h-4 rounded-full bg-zinc-200 dark:bg-zinc-700" />;
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'syncing': return <Badge variant="flat" className="gap-1"><Loader2 className="w-3 h-3 animate-spin" />Syncing...</Badge>;
      case 'success': return <Badge variant="flat-success">Synced</Badge>;
      case 'error': return <Badge variant="flat-destructive">Error</Badge>;
      default: return <Badge variant="secondary">Not synced</Badge>;
    }
  };

  const integrations = [
    { key: 'halopsa', name: 'HaloPSA', enabled: hasHaloPSA, icon: Users, color: 'purple', onSync: handleSyncHaloPSA, syncing: syncingHalo },
    { key: 'datto', name: 'Datto RMM', enabled: hasDatto, icon: HardDrive, color: 'blue', onSync: handleSyncDatto, syncing: syncingDatto },
    { key: 'jumpcloud', name: 'JumpCloud', enabled: hasJumpCloud, icon: Shield, color: 'indigo', onSync: handleSyncJumpCloud, syncing: syncingJumpCloud },
    { key: 'spanning', name: 'Spanning', enabled: hasSpanning, icon: Cloud, color: 'cyan', onSync: handleSyncSpanning, syncing: syncingSpanning }
  ].filter(i => i.enabled);

  return (
    <div className="space-y-6">
      <Tabs defaultValue="recurring" className="space-y-4">
        {/* Service Tabs — only show tabs for services the customer has */}
        <div className="flex justify-center">
          <TabsList className="bg-zinc-100 dark:bg-zinc-800/80 border-0 p-1.5 h-auto flex flex-wrap justify-center gap-1 rounded-hero-lg w-full max-w-4xl mx-auto">
            {[
              { value: 'recurring', label: 'Recurring', icon: DollarSign, show: true },
              { value: 'devices', label: 'Devices', icon: Monitor, show: hasDevices },
              { value: 'jumpcloud', label: 'JumpCloud', icon: Shield, iconClass: 'text-[#7828C8]', show: hasJumpCloud },
              { value: 'spanning', label: 'Spanning', icon: Cloud, iconClass: 'text-cyan-500', show: hasSpanning },
              { value: 'darkweb', label: 'Dark Web', icon: AlertTriangle, iconClass: 'text-destructive', show: hasDarkWeb },
              { value: 'bullphish', label: 'BullPhish', icon: Fish, iconClass: 'text-warning', show: hasBullPhish },
              { value: 'inky', label: 'Inky', icon: ShieldCheck, iconClass: 'text-blue-500', show: hasInky },
              { value: 'edr', label: 'Datto EDR', icon: Shield, iconClass: 'text-primary', show: hasEDR },
              { value: 'rocketcyber', label: 'RocketCyber', icon: Shield, iconClass: 'text-orange-500', show: hasRocketCyber },
              { value: 'firewall', label: 'Firewall', icon: Wifi, iconClass: 'text-sky-500', show: hasUniFi },
              { value: 'saas-alerts', label: 'SaaS Alerts', icon: ShieldAlert, iconClass: 'text-violet-500', show: hasSaaSAlerts },
              { value: 'm365', label: 'M365', icon: Package, iconClass: 'text-blue-500', show: hasPax8 },
              { value: 'cove', label: 'Cove', icon: Database, iconClass: 'text-teal-500', show: hasCove },
              { value: 'threecx', label: '3CX', icon: Phone, iconClass: 'text-emerald-500', show: has3CX },
              { value: 'dmarc', label: 'DMARC', icon: Globe, iconClass: 'text-emerald-600', show: hasDmarc },
            ].filter(tab => tab.show).map(tab => {
              const TabIcon = tab.icon;
              return (
                <TabsTrigger key={tab.value} value={tab.value} className="gap-2 py-2 px-4 text-xs font-medium rounded-hero-sm data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-700 data-[state=active]:shadow-sm transition-all duration-[250ms]">
                  <TabIcon className={cn("w-3.5 h-3.5", tab.iconClass)} />
                  {tab.label}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>

        {/* Recurring Services Tab */}
        <TabsContent value="recurring">
          <motion.div {...fadeInUp} className="space-y-4">
            {/* Stats row */}
            <motion.div variants={staggerContainer} initial="initial" animate="animate" className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { icon: DollarSign, label: 'Monthly Recurring', value: `$${lineItems.reduce((sum, item) => sum + (item.net_amount || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`, color: 'text-emerald-600', bg: 'bg-emerald-500/10', raw: true },
                { icon: HardDrive, label: 'Active Services', value: lineItems.length, color: 'text-primary', bg: 'bg-primary/10' },
                { icon: DollarSign, label: 'Billable Items', value: lineItems.filter(i => i.net_amount > 0).length, color: 'text-violet-600', bg: 'bg-violet-500/10' },
              ].map((stat) => (
                <motion.div key={stat.label} variants={staggerItem} className="bg-card rounded-[14px] border shadow-hero-sm p-4 hover:shadow-hero-md transition-all duration-[250ms]">
                  <div className="flex items-center gap-3">
                    <div className={cn('w-10 h-10 rounded-hero-md flex items-center justify-center', stat.bg)}>
                      <stat.icon className={cn('w-5 h-5', stat.color)} />
                    </div>
                    <div>
                      {stat.raw ? (
                        <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                      ) : (
                        <AnimatedCounter value={stat.value} className="text-2xl font-bold text-foreground" />
                      )}
                      <p className="text-xs text-muted-foreground">{stat.label}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>

            {/* Services table card */}
            <div className="bg-card rounded-[14px] border shadow-hero-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-border/50 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-foreground text-sm">Active Services</h3>
                  <p className="text-xs text-muted-foreground">{lineItems.length} line items from HaloPSA</p>
                </div>
                {customer?.source === 'halopsa' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      try {
                        setIsSyncing(true);
                        const response = await client.functions.invoke('syncHaloPSARecurringBills', {
                          action: 'sync_customer',
                          customer_id: customer.external_id
                        });
                        if (response.success) {
                          toast.success(`Synced ${response.recordsSynced || 0} recurring bills!`);
                          queryClient.invalidateQueries({ queryKey: ['recurring_bills', customerId] });
                          queryClient.invalidateQueries({ queryKey: ['line_items', customerId] });
                        } else {
                          toast.error(response.error || 'Sync failed');
                        }
                      } catch (error) {
                        toast.error(error.message || 'An error occurred');
                      } finally {
                        setIsSyncing(false);
                      }
                    }}
                    disabled={isSyncing}
                    className="gap-2"
                  >
                    {isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    {isSyncing ? 'Syncing…' : 'Sync'}
                  </Button>
                )}
              </div>

              {lineItems.length === 0 ? (
                <div className="p-3">
                  <EmptyState
                    icon={HardDrive}
                    title="No recurring services"
                    description={customer?.source === 'halopsa' ? 'Click "Sync" to pull from HaloPSA' : 'No recurring services found for this customer'}
                  />
                </div>
              ) : (
                <div className="divide-y divide-border/40">
                  {lineItems.map((item) => {
                    const amount = item.net_amount || 0;
                    const isCredit = amount < 0;
                    return (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 px-5 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors duration-150"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-foreground truncate">
                            {item.description?.replace(/\s*\$recurringbillingdate\s*/gi, '').trim()}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-muted-foreground">
                              Qty {item.quantity}
                            </span>
                            {item.unit_price > 0 && (
                              <span className="text-xs text-muted-foreground/50">
                                · ${parseFloat(item.unit_price).toLocaleString('en-US', { minimumFractionDigits: 2 })}/ea
                              </span>
                            )}
                          </div>
                        </div>
                        <p className={cn(
                          "text-sm font-semibold tabular-nums flex-shrink-0",
                          isCredit ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"
                        )}>
                          {isCredit ? '-' : ''}${Math.abs(amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                    );
                  })}

                  {/* Footer total */}
                  <div className="flex items-center justify-between px-5 py-3 bg-zinc-50 dark:bg-zinc-800/40">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total Monthly</p>
                    <p className="text-base font-bold text-foreground tabular-nums">
                      ${lineItems.reduce((sum, item) => sum + (item.net_amount || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </TabsContent>

        {/* Devices Tab */}
        <TabsContent value="devices">
          <DevicesTab 
            customerId={customerId} 
            customerExternalId={customer?.external_id}
          />
        </TabsContent>

        {/* JumpCloud Tab */}
        <TabsContent value="jumpcloud">
          {jumpcloudMapping ? (
            <motion.div {...fadeInUp} className="space-y-4">
              {/* Stats */}
              <motion.div variants={staggerContainer} initial="initial" animate="animate" className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { icon: Users, label: 'Directory Users', value: jumpcloudCachedStats?.totalUsers || jumpcloudContacts.length, color: 'text-[#7828C8]', bg: 'bg-[#7828C8]/10' },
                  { icon: Cloud, label: 'SSO Applications', value: jumpcloudCachedStats?.ssoApps || jumpcloudLicenses.length, color: 'text-primary', bg: 'bg-primary/10' },
                  { icon: CheckCircle2, label: 'App Assignments', value: jumpcloudLicenses.reduce((sum, l) => sum + (l.assigned_users || 0), 0), color: 'text-success', bg: 'bg-success/10' },
                ].map((stat) => (
                  <motion.div key={stat.label} variants={staggerItem} className="bg-card rounded-[14px] border shadow-hero-sm p-4 hover:shadow-hero-md transition-all duration-[250ms]">
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

              {/* Users */}
              <div className="bg-card rounded-[14px] border shadow-hero-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-border/50 flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-foreground text-sm">JumpCloud Users</h3>
                    <p className="text-xs text-muted-foreground">Synced from JumpCloud directory ({jumpcloudContacts.length} total)</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {jumpcloudMapping?.last_synced && (
                      <span className="text-xs text-muted-foreground/60">
                        Synced {new Date(jumpcloudMapping.last_synced).toLocaleDateString()}
                      </span>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSyncJumpCloud}
                      disabled={syncingJumpCloud}
                      className="gap-2"
                    >
                      {syncingJumpCloud ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                      {jumpcloudMapping?.last_synced ? 'Refresh' : 'Sync'}
                    </Button>
                  </div>
                </div>
                <div className="p-3">
                  {jumpcloudContacts.length === 0 ? (
                    <EmptyState
                      icon={Users}
                      title="No JumpCloud users"
                      description="Click Sync to pull users from JumpCloud directory"
                      action={{ label: 'Sync Now', onClick: handleSyncJumpCloud }}
                    />
                  ) : (
                    <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-1.5">
                      {jumpcloudContacts.slice(jcUsersPage * 10, (jcUsersPage + 1) * 10).map(contact => (
                        <motion.div
                          key={contact.id}
                          variants={staggerItem}
                          className="flex items-center gap-3 p-3 rounded-hero-md hover:bg-zinc-50 dark:hover:bg-zinc-800/50 cursor-pointer transition-colors duration-[250ms]"
                          onClick={() => setSelectedContact(contact)}
                        >
                          <div className="w-9 h-9 rounded-full bg-[#7828C8]/15 flex items-center justify-center text-[#7828C8] font-medium text-sm">
                            {contact.full_name?.charAt(0) || '?'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-foreground truncate text-sm">{contact.full_name}</p>
                            <p className="text-xs text-muted-foreground truncate">{contact.email}</p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-muted-foreground/40" />
                        </motion.div>
                      ))}
                      {jumpcloudContacts.length > 10 && (
                        <div className="flex items-center justify-between pt-3 border-t border-border/50 mt-2">
                          <p className="text-xs text-muted-foreground">
                            {jcUsersPage * 10 + 1}–{Math.min((jcUsersPage + 1) * 10, jumpcloudContacts.length)} of {jumpcloudContacts.length}
                          </p>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => setJcUsersPage(p => p - 1)} disabled={jcUsersPage === 0}>Previous</Button>
                            <Button variant="outline" size="sm" onClick={() => setJcUsersPage(p => p + 1)} disabled={(jcUsersPage + 1) * 10 >= jumpcloudContacts.length}>Next</Button>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )}
                </div>
              </div>
            </motion.div>
          ) : (
            <EmptyState icon={Shield} title="JumpCloud not configured" description="This customer doesn't have a JumpCloud organization linked. Go to Adminland > Integrations to map one." />
          )}
        </TabsContent>

        {/* Spanning Backup Tab */}
        <TabsContent value="spanning">
          {spanningMapping ? (
            <SpanningUsersTab
              customerId={customerId}
              spanningMapping={spanningMapping}
              queryClient={queryClient}
            />
          ) : (
            <EmptyState icon={Cloud} title="Spanning not configured" description="Go to Adminland > Integrations to map this customer's Spanning organization." />
          )}
        </TabsContent>

        {/* Dark Web ID Tab */}
        <TabsContent value="darkweb">
          {hasDarkWeb ? (
            <DarkWebTab customerId={customerId} />
          ) : (
            <EmptyState icon={AlertTriangle} title="Dark Web ID not configured" description="No Dark Web monitoring data found for this customer." />
          )}
        </TabsContent>

        {/* BullPhish ID Tab */}
        <TabsContent value="bullphish">
          {hasBullPhish ? (
            <BullPhishTab customerId={customerId} />
          ) : (
            <EmptyState icon={Fish} title="BullPhish not configured" description="No BullPhish training data found for this customer." />
          )}
        </TabsContent>

        {/* Inky Tab */}
        <TabsContent value="inky">
          {hasInky ? (
            <InkyTab customerId={customerId} />
          ) : (
            <EmptyState icon={ShieldCheck} title="Inky not configured" description="No Inky email protection reports found for this customer." />
          )}
        </TabsContent>

        {/* Datto EDR Tab */}
        <TabsContent value="edr">
          {hasEDR ? (
            <DattoEDRTab customerId={customerId} edrMapping={edrMapping} customerName={customer?.name} />
          ) : (
            <EmptyState icon={Shield} title="Datto EDR not configured" description="Go to Adminland > Integrations to map this customer's Datto EDR site." />
          )}
        </TabsContent>

        {/* RocketCyber Tab */}
        <TabsContent value="rocketcyber">
          {hasRocketCyber ? (
            <RocketCyberTab customer={customer} />
          ) : (
            <EmptyState icon={Shield} title="RocketCyber not configured" description="Go to Adminland > Integrations to map this customer's RocketCyber account." />
          )}
        </TabsContent>

        {/* Firewall / UniFi Tab */}
        <TabsContent value="firewall">
          <UniFiTab
            customerId={customerId}
            unifiMapping={unifiMapping}
            queryClient={queryClient}
          />
        </TabsContent>

        {/* SaaS Alerts Tab */}
        <TabsContent value="saas-alerts">
          <SaaSAlertsTab
            customerId={customerId}
            saasAlertsMapping={saasAlertsMapping}
            queryClient={queryClient}
          />
        </TabsContent>

        {/* M365 / Pax8 Tab */}
        <TabsContent value="m365">
          {hasPax8 ? (
            <Pax8Tab
              customerId={customerId}
              pax8Mapping={pax8Mapping}
              queryClient={queryClient}
            />
          ) : (
            <EmptyState icon={Package} title="Pax8 not configured" description="Go to Adminland > Integrations to map this customer's Pax8 company." />
          )}
        </TabsContent>

        {/* Cove Data Protection Tab */}
        <TabsContent value="cove">
          {hasCove ? (
            <CoveTab
              customerId={customerId}
              coveMapping={coveMapping}
              queryClient={queryClient}
            />
          ) : (
            <EmptyState icon={Database} title="Cove not configured" description="Go to Adminland > Integrations to map this customer's Cove partner." />
          )}
        </TabsContent>
        {/* 3CX VoIP Tab */}
        <TabsContent value="threecx">
          <ThreeCXTab
            customerId={customerId}
            threecxMapping={threecxMapping}
            threecxReports={threecxReports}
            queryClient={queryClient}
          />
        </TabsContent>

        {/* DMARC Report Tab */}
        <TabsContent value="dmarc">
          <DmarcReportTab
            customerId={customerId}
            dmarcMapping={dmarcMapping}
            queryClient={queryClient}
          />
        </TabsContent>
      </Tabs>



      {/* User Detail Modal */}
      <UserDetailModal 
        contact={selectedContact}
        open={!!selectedContact}
        onClose={() => setSelectedContact(null)}
        customerId={customerId}
      />
    </div>
  );
}