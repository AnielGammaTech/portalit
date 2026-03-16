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
  Phone
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

  const has3CX = !!threecxMapping;
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
    if (!customer?.source === 'halopsa' || !customer?.external_id) return;
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
        {/* Service Tabs — HeroUI-inspired pill tabs */}
        <div className="flex justify-center">
          <TabsList className="bg-zinc-100 dark:bg-zinc-800/80 border-0 p-1.5 h-auto flex flex-wrap justify-center gap-1 rounded-hero-lg w-full max-w-4xl mx-auto">
            <TabsTrigger value="recurring" className="gap-2 py-2 px-4 text-xs font-medium rounded-hero-sm data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-700 data-[state=active]:shadow-sm transition-all duration-[250ms]">
              <DollarSign className="w-3.5 h-3.5" />
              Recurring
            </TabsTrigger>
            <TabsTrigger value="devices" className="gap-2 py-2 px-4 text-xs font-medium rounded-hero-sm data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-700 data-[state=active]:shadow-sm transition-all duration-[250ms]">
              <Monitor className="w-3.5 h-3.5" />
              Devices
            </TabsTrigger>
            <TabsTrigger value="jumpcloud" className="gap-2 py-2 px-4 text-xs font-medium rounded-hero-sm data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-700 data-[state=active]:shadow-sm transition-all duration-[250ms]">
              <Shield className="w-3.5 h-3.5 text-[#7828C8]" />
              JumpCloud
            </TabsTrigger>
            <TabsTrigger value="spanning" className="gap-2 py-2 px-4 text-xs font-medium rounded-hero-sm data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-700 data-[state=active]:shadow-sm transition-all duration-[250ms]">
              <Cloud className="w-3.5 h-3.5 text-cyan-500" />
              Spanning
            </TabsTrigger>
            <TabsTrigger value="darkweb" className="gap-2 py-2 px-4 text-xs font-medium rounded-hero-sm data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-700 data-[state=active]:shadow-sm transition-all duration-[250ms]">
              <AlertTriangle className="w-3.5 h-3.5 text-destructive" />
              Dark Web
            </TabsTrigger>
            <TabsTrigger value="bullphish" className="gap-2 py-2 px-4 text-xs font-medium rounded-hero-sm data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-700 data-[state=active]:shadow-sm transition-all duration-[250ms]">
              <Fish className="w-3.5 h-3.5 text-warning" />
              BullPhish
            </TabsTrigger>
            <TabsTrigger value="inky" className="gap-2 py-2 px-4 text-xs font-medium rounded-hero-sm data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-700 data-[state=active]:shadow-sm transition-all duration-[250ms]">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
              Inky
            </TabsTrigger>
            <TabsTrigger value="edr" className="gap-2 py-2 px-4 text-xs font-medium rounded-hero-sm data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-700 data-[state=active]:shadow-sm transition-all duration-[250ms]">
              <Shield className="w-3.5 h-3.5 text-primary" />
              Datto EDR
            </TabsTrigger>
            <TabsTrigger value="rocketcyber" className="gap-2 py-2 px-4 text-xs font-medium rounded-hero-sm data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-700 data-[state=active]:shadow-sm transition-all duration-[250ms]">
              <Shield className="w-3.5 h-3.5 text-orange-500" />
              RocketCyber
            </TabsTrigger>
            <TabsTrigger value="firewall" className="gap-2 py-2 px-4 text-xs font-medium rounded-hero-sm data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-700 data-[state=active]:shadow-sm transition-all duration-[250ms]">
              <Wifi className="w-3.5 h-3.5 text-sky-500" />
              Firewall
            </TabsTrigger>
            <TabsTrigger value="saas-alerts" className="gap-2 py-2 px-4 text-xs font-medium rounded-hero-sm data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-700 data-[state=active]:shadow-sm transition-all duration-[250ms]">
              <ShieldAlert className="w-3.5 h-3.5 text-violet-500" />
              SaaS Alerts
            </TabsTrigger>
            <TabsTrigger value="m365" className="gap-2 py-2 px-4 text-xs font-medium rounded-hero-sm data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-700 data-[state=active]:shadow-sm transition-all duration-[250ms]">
              <Package className="w-3.5 h-3.5 text-blue-500" />
              M365
            </TabsTrigger>
            <TabsTrigger value="cove" className="gap-2 py-2 px-4 text-xs font-medium rounded-hero-sm data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-700 data-[state=active]:shadow-sm transition-all duration-[250ms]">
              <Database className="w-3.5 h-3.5 text-teal-500" />
              Cove
            </TabsTrigger>
            <TabsTrigger value="threecx" className="gap-2 py-2 px-4 text-xs font-medium rounded-hero-sm data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-700 data-[state=active]:shadow-sm transition-all duration-[250ms]">
              <Phone className="w-3.5 h-3.5 text-emerald-500" />
              3CX
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Recurring Services Tab */}
        <TabsContent value="recurring">
          <motion.div {...fadeInUp} className="space-y-4">
            {/* Summary Card */}
            <div className="bg-card rounded-[14px] border shadow-hero-sm p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-hero-md bg-primary/10 flex items-center justify-center">
                    <DollarSign className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-primary uppercase tracking-wide">Monthly Recurring</p>
                    <p className="text-3xl font-bold text-foreground mt-0.5">
                      ${lineItems.reduce((sum, item) => sum + (item.net_amount || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-sm text-muted-foreground">{lineItems.length} services</p>
                  </div>
                </div>
                {customer?.source === 'halopsa' && (
                  <Button
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
                    variant="outline"
                    size="sm"
                    className="gap-2"
                  >
                    {isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    Sync
                  </Button>
                )}
              </div>
            </div>

            {/* Services List */}
            <div className="bg-card rounded-[14px] border shadow-hero-sm overflow-hidden">
              <div className="px-6 py-3 border-b border-border/50">
                <h3 className="font-semibold text-foreground text-sm">Active Services</h3>
              </div>
              {lineItems.length === 0 ? (
                <EmptyState
                  icon={HardDrive}
                  title="No recurring services"
                  description={customer?.source === 'halopsa' ? 'Click "Sync" to pull from HaloPSA' : 'No recurring services found for this customer'}
                />
              ) : (
                <motion.div variants={staggerContainer} initial="initial" animate="animate" className="divide-y divide-border/50">
                  {lineItems.map((item) => (
                    <motion.div
                      key={item.id}
                      variants={staggerItem}
                      className="px-6 py-4 flex items-center gap-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors duration-[250ms]"
                    >
                      <div className="w-10 h-10 rounded-hero-md bg-[#7828C8]/10 flex items-center justify-center flex-shrink-0">
                        <HardDrive className="w-5 h-5 text-[#7828C8]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground">{item.description?.replace(/\s*\$recurringbillingdate\s*/gi, '').trim()}</p>
                        <p className="text-sm text-muted-foreground mt-0.5">Qty: {item.quantity}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-foreground">${(item.net_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                        <p className="text-xs text-muted-foreground/60">/month</p>
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              )}
              {lineItems.length > 0 && (
                <div className="px-6 py-4 bg-zinc-50 dark:bg-zinc-800/50 border-t border-border/50 flex items-center justify-between">
                  <p className="text-sm font-medium text-muted-foreground">Total Monthly</p>
                  <p className="text-lg font-bold text-foreground">
                    ${lineItems.reduce((sum, item) => sum + (item.net_amount || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </p>
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