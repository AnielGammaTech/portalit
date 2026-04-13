import React, { useState, useEffect, useMemo } from 'react';
import { client } from '@/api/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import UserAssignmentPanel from '../components/admin/UserAssignmentPanel';
import FeedbackPanel from '../components/admin/FeedbackPanel';
import ResendEmailConfig from '../components/admin/ResendEmailConfig';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from 'sonner';
import { cn } from "@/lib/utils";
import { createPageUrl } from '../utils';

import CronJobsPanel from '../components/admin/CronJobsPanel';
import SystemInfoPanel from '../components/admin/SystemInfoPanel';
import SecurityAuditPanel from '../components/admin/SecurityAuditPanel';
import HaloPSAConfig from '../components/integrations/HaloPSAConfig';
import DattoRMMConfig from '../components/integrations/DattoRMMConfig';
import JumpCloudConfig from '../components/integrations/JumpCloudConfig';
import SpanningConfig from '../components/integrations/SpanningConfig';
import DarkWebIDConfig from '../components/integrations/DarkWebIDConfig';
import BullPhishIDConfig from '../components/integrations/BullPhishIDConfig';
import DattoEDRConfig from '../components/integrations/DattoEDRConfig';
import RocketCyberConfig from '../components/integrations/RocketCyberConfig';
import CoveDataConfig from '../components/integrations/CoveDataConfig';
import UniFiConfig from '../components/integrations/UniFiConfig';
import SaaSAlertsConfig from '../components/integrations/SaaSAlertsConfig';
import Pax8Config from '../components/integrations/Pax8Config';
import AIConfig from '../components/integrations/AIConfig';
import InkyConfig from '../components/integrations/InkyConfig';
import ThreeCXConfig from '../components/integrations/ThreeCXConfig';
import DmarcReportConfig from '../components/integrations/DmarcReportConfig';
import VultrConfig from '../components/integrations/VultrConfig';
import VPenTestConfig from '../components/integrations/VPenTestConfig';
import MapboxConfig from '../components/integrations/MapboxConfig';
import CIPPConfig from '../components/integrations/CIPPConfig';

import {
  Shield,
  Users,
  Link2,
  MessageSquare,
  Image,
  Upload,
  ShoppingCart,
  Palette,
  Save,
  Code,
  Copy,
  Check,
  AlertTriangle,
  ChevronRight,
  ArrowLeft,
  Monitor,
  Cloud,
  Database,
  Fish,
  Rocket,
  HardDrive,
  Wifi,
  ShieldAlert,
  Zap,
  RefreshCw,
  Mail,
  Ticket,
  Brain,
  Clock,
  ShieldCheck,
  Phone,
  Globe,
  Server,
  Crosshair,
  MapPin,
  Info,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════
// IntegrationsPanel — Category-grouped card grid with drill-in
// ═══════════════════════════════════════════════════════════════════════

const LOGO = (domain) => `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
const LOGOS = {
  halopsa: LOGO('halopsa.com'),
  'datto-rmm': LOGO('datto.com'),
  'datto-edr': LOGO('datto.com'),
  rocketcyber: LOGO('rocketcyber.com'),
  unifi: LOGO('ui.com'),
  vpentest: LOGO('vonahi.io'),
  'saas-alerts': LOGO('saasalerts.com'),
  cipp: LOGO('cipp.app'),
  jumpcloud: LOGO('jumpcloud.com'),
  spanning: LOGO('unitrends.com'),
  cove: LOGO('n-able.com'),
  pax8: LOGO('pax8.com'),
  darkweb: LOGO('idagent.com'),
  bullphish: LOGO('idagent.com'),
  inky: LOGO('inky.com'),
  dmarc: LOGO('dmarcreport.com'),
  threecx: LOGO('3cx.com'),
  vultr: LOGO('vultr.com'),
  ai: LOGO('anthropic.com'),
  mapbox: LOGO('mapbox.com'),
  'external-api': null,
};

const INTEGRATION_CATEGORIES = [
  {
    title: 'PSA & TICKETING',
    items: [
      { id: 'halopsa', label: 'HaloPSA', desc: 'Sync customers, contacts, contracts & tickets', icon: Ticket, iconBg: 'bg-indigo-50', iconColor: 'text-indigo-600', statusType: 'halopsa' },
    ],
  },
  {
    title: 'RMM & SECURITY',
    items: [
      { id: 'datto-rmm', label: 'Datto RMM', desc: 'Sync devices and map Datto sites', icon: Monitor, iconBg: 'bg-blue-50', iconColor: 'text-blue-600', mappingKey: 'datto_mappings', mappingEntity: 'DattoSiteMapping' },
      { id: 'datto-edr', label: 'Datto EDR', desc: 'Endpoint detection & response', icon: Shield, iconBg: 'bg-cyan-50', iconColor: 'text-cyan-600', mappingKey: 'edr_mappings', mappingEntity: 'DattoEDRMapping' },
      { id: 'rocketcyber', label: 'RocketCyber SOC', desc: 'Security incidents and alerts', icon: Rocket, iconBg: 'bg-orange-50', iconColor: 'text-orange-600', mappingKey: 'rocketcyber_mappings', mappingEntity: 'RocketCyberMapping' },
      { id: 'unifi', label: 'UniFi Network', desc: 'Sync firewalls and network devices', icon: Wifi, iconBg: 'bg-sky-50', iconColor: 'text-sky-600', mappingKey: 'unifi_mappings', mappingEntity: 'UniFiMapping' },
      { id: 'vpentest', label: 'vPenTest', desc: 'Automated network penetration testing', icon: Crosshair, iconBg: 'bg-rose-50', iconColor: 'text-rose-600', mappingKey: 'vpentest_mappings', mappingEntity: 'VPenTestMapping' },
    ],
  },
  {
    title: 'SAAS SECURITY',
    items: [
      { id: 'saas-alerts', label: 'SaaS Alerts', desc: 'Monitor SaaS app security events', icon: ShieldAlert, iconBg: 'bg-violet-50', iconColor: 'text-violet-600', mappingKey: 'saas_alerts_mappings', mappingEntity: 'SaaSAlertsMapping' },
    ],
  },
  {
    title: 'IDENTITY & ACCESS',
    items: [
      { id: 'cipp', label: 'CIPP', desc: 'M365 users, groups & shared mailboxes via CIPP', icon: Users, iconBg: 'bg-sky-50', iconColor: 'text-sky-600', mappingKey: 'cipp_mappings', mappingEntity: 'CIPPMapping' },
      { id: 'jumpcloud', label: 'JumpCloud', desc: 'Sync SSO applications and users', icon: Cloud, iconBg: 'bg-green-50', iconColor: 'text-green-600', mappingKey: 'jumpcloud_mappings', mappingEntity: 'JumpCloudMapping' },
    ],
  },
  {
    title: 'BACKUP & RECOVERY',
    items: [
      { id: 'spanning', label: 'Unitrends', desc: 'Sync backup data from Unitrends MSP', icon: Database, iconBg: 'bg-purple-50', iconColor: 'text-purple-600', mappingKey: 'spanning_mappings', mappingEntity: 'SpanningMapping' },
      { id: 'cove', label: 'Cove Data Protection', desc: 'Sync backup devices from N-able Cove', icon: HardDrive, iconBg: 'bg-teal-50', iconColor: 'text-teal-600', mappingKey: 'cove_mappings', mappingEntity: 'CoveDataMapping' },
    ],
  },
  {
    title: 'MARKETPLACE & LICENSING',
    items: [
      { id: 'pax8', label: 'Pax8', desc: 'Sync Microsoft 365, Azure & cloud subscriptions', icon: ShoppingCart, iconBg: 'bg-pink-50', iconColor: 'text-pink-600', mappingKey: 'pax8_mappings', mappingEntity: 'Pax8Mapping' },
    ],
  },
  {
    title: 'SECURITY AWARENESS',
    items: [
      { id: 'darkweb', label: 'Dark Web ID', desc: 'Monitor dark web compromises', icon: AlertTriangle, iconBg: 'bg-red-50', iconColor: 'text-red-600', statusType: 'reports' },
      { id: 'bullphish', label: 'BullPhish ID', desc: 'Phishing simulation reports', icon: Fish, iconBg: 'bg-orange-50', iconColor: 'text-orange-600', statusType: 'reports' },
      { id: 'inky', label: 'Inky', desc: 'Email protection reports', icon: ShieldCheck, iconBg: 'bg-blue-50', iconColor: 'text-blue-600', statusType: 'reports' },
    ],
  },
  {
    title: 'EMAIL SECURITY',
    items: [
      { id: 'dmarc', label: 'DMARC Report', desc: 'Domain DMARC compliance monitoring', icon: Globe, iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600', mappingKey: 'dmarc_mappings', mappingEntity: 'DmarcReportMapping' },
    ],
  },
  {
    title: 'VOIP & CLOUD',
    items: [
      { id: 'threecx', label: '3CX', desc: 'Per-customer VoIP extension sync', icon: Phone, iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600', mappingKey: 'threecx_reports_count', mappingEntity: 'ThreeCXReport' },
      { id: 'vultr', label: 'Vultr', desc: 'Map cloud instances to customers for 3CX hosting', icon: Server, iconBg: 'bg-blue-50', iconColor: 'text-blue-600', mappingKey: 'vultr_mappings', mappingEntity: 'VultrMapping' },
    ],
  },
  {
    title: 'AI & AUTOMATION',
    items: [
      { id: 'ai', label: 'AI Provider', desc: 'Choose between OpenAI and Claude AI', icon: Brain, iconBg: 'bg-gradient-to-br from-amber-50 to-orange-50', iconColor: 'text-amber-600', statusType: 'settings' },
    ],
  },
  {
    title: 'MAPS & LOCATION',
    items: [
      { id: 'mapbox', label: 'Mapbox', desc: 'Customer location maps and geocoding', icon: MapPin, iconBg: 'bg-indigo-50', iconColor: 'text-indigo-600', statusType: 'settings' },
    ],
  },
  {
    title: 'GAMMASTACK ECOSYSTEM',
    items: [
      { id: 'external-api', label: 'External API Access', desc: 'Generate API keys for external apps', icon: Zap, iconBg: 'bg-amber-50', iconColor: 'text-amber-600' },
    ],
  },
];

const INTEGRATION_COMPONENTS = {
  'halopsa': HaloPSAConfig,
  'datto-rmm': DattoRMMConfig,
  'datto-edr': DattoEDRConfig,
  'rocketcyber': RocketCyberConfig,
  'jumpcloud': JumpCloudConfig,
  'spanning': SpanningConfig,
  'cove': CoveDataConfig,
  'unifi': UniFiConfig,
  'saas-alerts': SaaSAlertsConfig,
  'darkweb': DarkWebIDConfig,
  'bullphish': BullPhishIDConfig,
  'inky': InkyConfig,
  'threecx': ThreeCXConfig,
  'dmarc': DmarcReportConfig,
  'vultr': VultrConfig,
  'vpentest': VPenTestConfig,
  'ai': AIConfig,
  'pax8': Pax8Config,
  'mapbox': MapboxConfig,
  'cipp': CIPPConfig,
};

function IntegrationsPanel({ activeIntegration, setActiveIntegration }) {

  const { data: haloStatus } = useQuery({
    queryKey: ['halo-status-integrations'],
    queryFn: () => client.halo.getStatus().catch(() => null),
    staleTime: 60_000,
  });

  // Single query to fetch all mapping counts
  const { data: mappingCounts = {}, isLoading: countsLoading } = useQuery({
    queryKey: ['integration_mapping_counts'],
    queryFn: async () => {
      const safeCount = (fn) => fn().catch(() => 0);
      const [datto, jumpcloud, spanning, edr, rocketcyber, cove, unifi, saasAlerts, pax8, threecx, dmarc, vultr, vpentest, cipp] = await Promise.all([
        safeCount(() => client.entities.DattoSiteMapping.count()),
        safeCount(() => client.entities.JumpCloudMapping.count()),
        safeCount(() => client.entities.SpanningMapping.count()),
        safeCount(() => client.entities.DattoEDRMapping.count()),
        safeCount(() => client.entities.RocketCyberMapping.count()),
        safeCount(() => client.entities.CoveDataMapping.count()),
        safeCount(() => client.entities.UniFiMapping.count()),
        safeCount(() => client.entities.SaaSAlertsMapping.count()),
        safeCount(() => client.entities.Pax8Mapping.count()),
        safeCount(() => client.entities.ThreeCXReport.count()),
        safeCount(() => client.entities.DmarcReportMapping.count()),
        safeCount(() => client.entities.VultrMapping.count()),
        safeCount(() => client.entities.VPenTestMapping.count()),
        safeCount(() => client.entities.CIPPMapping.count()),
      ]);
      return {
        datto_mappings: datto,
        jumpcloud_mappings: jumpcloud,
        spanning_mappings: spanning,
        edr_mappings: edr,
        rocketcyber_mappings: rocketcyber,
        cove_mappings: cove,
        unifi_mappings: unifi,
        saas_alerts_mappings: saasAlerts,
        pax8_mappings: pax8,
        threecx_reports_count: threecx,
        dmarc_mappings: dmarc,
        vultr_mappings: vultr,
        vpentest_mappings: vpentest,
        cipp_mappings: cipp,
      };
    },
  });

  if (activeIntegration) {
    const allItems = INTEGRATION_CATEGORIES.flatMap(c => c.items);
    const item = allItems.find(i => i.id === activeIntegration);
    const ConfigComponent = INTEGRATION_COMPONENTS[activeIntegration];

    if (activeIntegration === 'external-api') {
      return (
        <div>
          <Button variant="ghost" className="mb-4 pl-0 hover:pl-2 transition-all" onClick={() => setActiveIntegration(null)}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Integrations
          </Button>
          <GammaStackITPanel />
        </div>
      );
    }

    return (
      <div>
        <Button variant="ghost" className="mb-4 pl-0 hover:pl-2 transition-all" onClick={() => setActiveIntegration(null)}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Integrations
        </Button>
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-slate-900">{item?.label}</h3>
          <p className="text-sm text-slate-500">{item?.desc}</p>
        </div>
        {ConfigComponent ? <ConfigComponent /> : <p className="text-slate-500">Configuration not available</p>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {INTEGRATION_CATEGORIES.map((category) => (
        <div key={category.title}>
          <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1.5">{category.title}</h3>
          <div className="grid grid-cols-3 gap-2.5">
            {category.items.map((item) => {
              const count = item.mappingKey ? mappingCounts[item.mappingKey] : 0;
              const ItemIcon = item.icon;

              // Determine status based on type
              let isConfigured = false;
              let statusLabel = countsLoading && item.mappingKey ? '...' : 'Not connected';

              if (item.statusType === 'halopsa') {
                isConfigured = haloStatus?.configured || false;
                statusLabel = isConfigured ? `${haloStatus?.customerCount || 0} customers` : 'Not connected';
              } else if (item.statusType === 'reports') {
                isConfigured = true;
                statusLabel = 'Reports';
              } else if (item.statusType === 'settings') {
                isConfigured = true;
                statusLabel = 'Settings';
              } else if (item.mappingKey) {
                isConfigured = count > 0;
                statusLabel = isConfigured ? `${count} mapped` : 'Not connected';
              }

              return (
                <button
                  key={item.id}
                  onClick={() => setActiveIntegration(item.id)}
                  className={cn(
                    "flex items-center gap-3 px-3.5 py-3 rounded-xl border text-left transition-all hover:shadow-md",
                    isConfigured ? "bg-white border-emerald-200 hover:border-emerald-300" : "bg-white border-slate-200 hover:border-slate-300"
                  )}
                >
                  <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0 overflow-hidden", item.iconBg)}>
                    {LOGOS[item.id] ? (
                      <img src={LOGOS[item.id]} alt="" className="w-5 h-5 object-contain" onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
                    ) : null}
                    <ItemIcon className={cn("w-4 h-4", item.iconColor, LOGOS[item.id] ? "hidden" : "")} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900 truncate">{item.label}</p>
                    <p className={cn("text-[10px] mt-0.5", isConfigured ? "text-emerald-600 font-medium" : "text-slate-400")}>{statusLabel}</p>
                  </div>
                  {isConfigured && item.statusType !== 'settings' && (
                    <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 shrink-0">Connected</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// GammaStackITPanel
// ═══════════════════════════════════════════════════════════════════════

function GammaStackITPanel() {
  const [apiKey, setApiKey] = useState('');
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    const loadApiKey = async () => {
      const user = await client.auth.me();
      if (user?.gammastack_api_key) setApiKey(user.gammastack_api_key);
    };
    loadApiKey();
  }, []);

  const generateApiKey = async () => {
    setGenerating(true);
    try {
      // Use crypto.getRandomValues for cryptographically secure key generation
      const array = new Uint8Array(32);
      crypto.getRandomValues(array);
      const key = 'gs_' + Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
      await client.auth.updateMe({ gammastack_api_key: key });
      setApiKey(key);
      toast.success('New API key generated!');
    } catch (error) {
      toast.error('Failed to generate API key');
    } finally {
      setGenerating(false);
    }
  };

  const copyText = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  const appBaseUrl = window.location.origin;
  const fullEndpoint = `${appBaseUrl}/api/functions/getCustomerData`;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-6">
      <div>
        <label className="text-sm font-medium text-slate-700 mb-2 block">This Application's API Key</label>
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <Input value={apiKey || 'No API key generated yet'} readOnly className="pr-10 font-mono text-sm bg-slate-50" />
            {apiKey && (
              <button onClick={() => copyText(apiKey)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 hover:bg-slate-200 rounded transition-colors">
                <Copy className="w-4 h-4 text-slate-500" />
              </button>
            )}
          </div>
          <Button onClick={generateApiKey} disabled={generating} className="bg-orange-500 hover:bg-orange-600 text-white gap-2">
            <RefreshCw className={cn("w-4 h-4", generating && "animate-spin")} /> Generate New Key
          </Button>
        </div>
      </div>
      {apiKey && (
        <div className="bg-slate-50 rounded-xl p-4 space-y-4">
          <h4 className="font-medium text-slate-900">Get Customer Data</h4>
          <div>
            <p className="text-xs font-medium text-orange-600 uppercase tracking-wide mb-1">App Base URL</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
                <span className="text-orange-600 font-mono text-sm">{appBaseUrl}</span>
              </div>
              <button onClick={() => copyText(appBaseUrl)} className="p-2 hover:bg-slate-200 rounded-lg transition-colors border border-slate-200">
                <Copy className="w-4 h-4 text-slate-500" />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-xs text-slate-400 uppercase">or full endpoint</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Full Endpoint URL</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 overflow-hidden">
                <span className="text-slate-600 font-mono text-sm truncate block">{fullEndpoint}</span>
              </div>
              <button onClick={() => copyText(fullEndpoint)} className="p-2 hover:bg-slate-200 rounded-lg transition-colors border border-slate-200">
                <Copy className="w-4 h-4 text-slate-500" />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-6 text-sm">
            <div><span className="text-slate-500 uppercase text-xs font-medium">Method</span><p className="font-semibold text-slate-900">GET</p></div>
            <div><span className="text-slate-500 uppercase text-xs font-medium">Auth Header</span><p className="font-mono text-slate-900">x-gammastack-key</p></div>
          </div>
          <p className="text-sm text-slate-500">
            Authentication: Include header <code className="bg-slate-200 px-1.5 py-0.5 rounded text-slate-700">x-gammastack-key: YOUR_KEY</code>
          </p>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// ApiDocsPanel
// ═══════════════════════════════════════════════════════════════════════

const API_ENDPOINTS = [
  { id: 'customers', method: 'GET', entity: 'Customer', description: 'List all customers', fields: [{ name: 'id', type: 'string', description: 'Unique customer ID' }, { name: 'name', type: 'string', description: 'Customer/company name' }, { name: 'status', type: 'enum', description: 'active, inactive, suspended' }], example: '{"name": "Acme Corp"}' },
  { id: 'saas-licenses', method: 'GET', entity: 'SaaSLicense', description: 'List SaaS licenses for a customer', fields: [{ name: 'customer_id', type: 'string', required: true, description: 'Customer reference' }, { name: 'application_name', type: 'string', description: 'SaaS app name' }, { name: 'total_cost', type: 'number', description: 'Monthly cost' }], example: '{"customer_id": "abc123"}' },
  { id: 'contacts', method: 'GET', entity: 'Contact', description: 'List contacts for a customer', fields: [{ name: 'customer_id', type: 'string', required: true, description: 'Customer reference' }, { name: 'full_name', type: 'string', description: 'Full name' }, { name: 'email', type: 'string', description: 'Email' }], example: '{"customer_id": "abc123"}' },
  { id: 'devices', method: 'GET', entity: 'Device', description: 'List devices for a customer', fields: [{ name: 'customer_id', type: 'string', required: true, description: 'Customer reference' }, { name: 'hostname', type: 'string', description: 'Hostname' }, { name: 'status', type: 'enum', description: 'online, offline' }], example: '{"customer_id": "abc123"}' },
];

function ApiDocsPanel() {
  const [copiedEndpoint, setCopiedEndpoint] = useState(null);
  const copyToClipboard = (text, id) => { navigator.clipboard.writeText(text); setCopiedEndpoint(id); setTimeout(() => setCopiedEndpoint(null), 2000); };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2"><Shield className="w-5 h-5 text-blue-600" />Authentication</h2>
        <p className="text-sm text-slate-600 mb-4">All API requests require authentication via Bearer token.</p>
        <div className="bg-slate-900 rounded-xl p-4 font-mono text-sm text-green-400"><p>Authorization: Bearer YOUR_API_KEY</p></div>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Base URL</h2>
        <div className="bg-slate-900 rounded-xl p-4 font-mono text-sm text-green-400 flex items-center justify-between">
          <span>GET /api/entities/{'{EntityName}'}</span>
          <button onClick={() => copyToClipboard('/api/entities/{EntityName}', 'base')} className="p-1 hover:bg-slate-700 rounded">
            {copiedEndpoint === 'base' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4 text-slate-400" />}
          </button>
        </div>
      </div>
      {API_ENDPOINTS.map((endpoint) => (
        <div key={endpoint.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100">
            <div className="flex items-center gap-3 mb-2">
              <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-bold rounded">{endpoint.method}</span>
              <code className="text-sm font-mono text-slate-700">/api/entities/{endpoint.entity}</code>
              <button onClick={() => copyToClipboard(`/api/entities/${endpoint.entity}`, endpoint.id)} className="p-1 hover:bg-slate-100 rounded">
                {copiedEndpoint === endpoint.id ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 text-slate-400" />}
              </button>
            </div>
            <p className="text-sm text-slate-600">{endpoint.description}</p>
          </div>
          <div className="p-6">
            <h4 className="text-sm font-semibold text-slate-900 mb-3">Response Fields</h4>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-100"><th className="text-left py-2 px-3 font-medium text-slate-600">Field</th><th className="text-left py-2 px-3 font-medium text-slate-600">Type</th><th className="text-left py-2 px-3 font-medium text-slate-600">Description</th></tr></thead>
              <tbody className="divide-y divide-slate-50">
                {endpoint.fields.map((field) => (
                  <tr key={field.name} className="hover:bg-slate-50">
                    <td className="py-2 px-3"><code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded text-purple-700">{field.name}</code>{field.required && <span className="text-red-500 text-xs ml-1">*</span>}</td>
                    <td className="py-2 px-3 text-slate-500 text-xs">{field.type}</td>
                    <td className="py-2 px-3 text-slate-600">{field.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-4">
              <h4 className="text-sm font-semibold text-slate-900 mb-2">Example Query</h4>
              <div className="bg-slate-900 rounded-xl p-4 font-mono text-xs text-green-400">GET /api/entities/{endpoint.entity}?query={endpoint.example}</div>
            </div>
          </div>
        </div>
      ))}
      <div className="pt-2"><h2 className="text-lg font-semibold text-slate-900 mb-4">External API Key</h2><GammaStackITPanel /></div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// BrandingPanel
// ═══════════════════════════════════════════════════════════════════════

function BrandingPanel() {
  const queryClient = useQueryClient();
  const [portalName, setPortalName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [logoDarkUrl, setLogoDarkUrl] = useState('');
  const [showLogoAlways, setShowLogoAlways] = useState(false);
  const [primaryColor, setPrimaryColor] = useState('#8b5cf6');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const { data: portalSettings = [] } = useQuery({ queryKey: ['portal_settings'], queryFn: () => client.entities.PortalSettings.list() });

  useEffect(() => {
    if (portalSettings.length > 0) {
      const s = portalSettings[0];
      setPortalName(s.portal_name || '');
      setLogoUrl(s.logo_url || '');
      setLogoDarkUrl(s.logo_dark_url || '');
      setShowLogoAlways(s.show_logo_always || false);
      setPrimaryColor(s.primary_color || '#8b5cf6');
    }
  }, [portalSettings]);

  const handleLogoUpload = async (e, type) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const { file_url } = await client.integrations.Core.UploadFile({ file });
      if (type === 'light') setLogoUrl(file_url); else setLogoDarkUrl(file_url);
      toast.success('Logo uploaded!');
    } catch (error) { toast.error('Failed to upload logo'); }
    finally { setIsUploading(false); }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const data = { portal_name: portalName, logo_url: logoUrl, logo_dark_url: logoDarkUrl, show_logo_always: showLogoAlways, primary_color: primaryColor };
      if (portalSettings.length > 0) await client.entities.PortalSettings.update(portalSettings[0].id, data);
      else await client.entities.PortalSettings.create(data);
      queryClient.invalidateQueries({ queryKey: ['portal_settings'] });
      toast.success('Portal settings saved!');
    } catch (error) { toast.error('Failed to save settings'); }
    finally { setIsSaving(false); }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6">
        <div>
          <label className="text-sm font-medium text-slate-700 mb-2 block">Portal Name</label>
          <Input value={portalName} onChange={(e) => setPortalName(e.target.value)} placeholder="PortalIT" />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700 mb-2 block">Logo (Light Background)</label>
          <div className="flex items-start gap-4">
            <div className="w-32 h-20 rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center bg-slate-50 overflow-hidden">
              {logoUrl ? <img src={logoUrl} alt="Logo" className="max-w-full max-h-full object-contain p-2" /> : <Image className="w-8 h-8 text-slate-300" />}
            </div>
            <div className="flex-1">
              <input type="file" accept="image/*" onChange={(e) => handleLogoUpload(e, 'light')} className="hidden" id="logo-upload-light" />
              <label htmlFor="logo-upload-light"><Button variant="outline" className="gap-2" asChild disabled={isUploading}><span><Upload className="w-4 h-4" />{isUploading ? 'Uploading...' : 'Upload Logo'}</span></Button></label>
              <p className="text-xs text-slate-500 mt-2">Recommended: PNG with transparent background, 200x60px</p>
              {logoUrl && <Input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="Or paste URL" className="mt-2" />}
            </div>
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700 mb-2 block">Logo (Dark Background)</label>
          <div className="flex items-start gap-4">
            <div className="w-32 h-20 rounded-xl border-2 border-dashed border-slate-700 flex items-center justify-center bg-slate-800 overflow-hidden">
              {logoDarkUrl ? <img src={logoDarkUrl} alt="Logo Dark" className="max-w-full max-h-full object-contain p-2" />
                : logoUrl ? <img src={logoUrl} alt="Logo" className="max-w-full max-h-full object-contain p-2" />
                  : <Image className="w-8 h-8 text-slate-500" />}
            </div>
            <div className="flex-1">
              <input type="file" accept="image/*" onChange={(e) => handleLogoUpload(e, 'dark')} className="hidden" id="logo-upload-dark" />
              <label htmlFor="logo-upload-dark"><Button variant="outline" className="gap-2" asChild disabled={isUploading}><span><Upload className="w-4 h-4" />{isUploading ? 'Uploading...' : 'Upload Dark Logo'}</span></Button></label>
              <p className="text-xs text-slate-500 mt-2">Optional: for dark backgrounds</p>
              {logoDarkUrl && <Input value={logoDarkUrl} onChange={(e) => setLogoDarkUrl(e.target.value)} placeholder="Or paste URL" className="mt-2" />}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between py-4 border-t border-slate-100">
          <div><p className="font-medium text-slate-900">Always Show Logo</p><p className="text-sm text-slate-500">Display logo in header instead of icon</p></div>
          <Switch checked={showLogoAlways} onCheckedChange={setShowLogoAlways} />
        </div>
        <div className="pt-4 border-t border-slate-100">
          <label className="text-sm font-medium text-slate-700 mb-2 block">Primary Color</label>
          <div className="flex items-center gap-3">
            <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="w-12 h-10 rounded-lg border border-slate-200 cursor-pointer" />
            <Input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} placeholder="#8b5cf6" className="w-32" />
            <div className="px-4 py-2 rounded-lg text-white text-sm font-medium" style={{ backgroundColor: primaryColor }}>Preview</div>
          </div>
        </div>
        <div className="pt-4 border-t border-slate-100">
          <Button onClick={handleSave} disabled={isSaving} className="gap-2"><Save className="w-4 h-4" />{isSaving ? 'Saving...' : 'Save Settings'}</Button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Main Adminland — Card-Grid Menu + Drill-in
// ═══════════════════════════════════════════════════════════════════════

const MENU_GROUPS = [
  { title: 'People', items: [{ id: 'users', label: 'Users & Security', desc: 'Team members, invitations & roles', icon: Users, iconBg: 'bg-blue-50', iconColor: 'text-blue-600' }] },
  { title: 'Appearance', items: [{ id: 'branding', label: 'Branding', desc: 'Portal name, logo & colors', icon: Palette, iconBg: 'bg-violet-50', iconColor: 'text-violet-600' }] },
  { title: 'Integrations', items: [{ id: 'integrations', label: 'Integrations', desc: 'RMM, security & backup services', icon: Link2, iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600' }] },
  { title: 'Communication', items: [{ id: 'email', label: 'Email (Resend)', desc: 'Configure email sending via Resend API', icon: Mail, iconBg: 'bg-pink-50', iconColor: 'text-pink-600' }] },
  { title: 'Automation', items: [{ id: 'cron', label: 'Scheduled Jobs', desc: 'Cron job status, history & manual runs', icon: Clock, iconBg: 'bg-sky-50', iconColor: 'text-sky-600' }] },
  { title: 'Developer', items: [{ id: 'api', label: 'API Documentation', desc: 'API docs & external access keys', icon: Code, iconBg: 'bg-orange-50', iconColor: 'text-orange-600' }] },
  { title: 'Support', items: [{ id: 'feedback', label: 'User Feedback', desc: 'Review and respond to feedback', icon: MessageSquare, iconBg: 'bg-pink-50', iconColor: 'text-pink-600' }] },
  { title: 'System', items: [
    { id: 'security', label: 'Security Audit', desc: 'Run RLS, storage & policy checks', icon: Shield, iconBg: 'bg-violet-50', iconColor: 'text-violet-600' },
    { id: 'system-info', label: 'System Info', desc: 'Build details, version history & changelog', icon: Info, iconBg: 'bg-slate-100', iconColor: 'text-slate-600' },
  ] },
];

export default function Adminland() {
  const [user, setUser] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();

  const activeSection = searchParams.get('section') || null;
  const activeIntegrationId = searchParams.get('id') || null;

  const setActiveSection = (sectionId) => {
    if (sectionId === null) setSearchParams({}, { replace: false });
    else setSearchParams({ section: sectionId }, { replace: false });
  };

  const setActiveIntegration = (integrationId) => {
    if (integrationId === null) setSearchParams({ section: 'integrations' }, { replace: false });
    else setSearchParams({ section: 'integrations', id: integrationId }, { replace: false });
  };

  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await client.auth.me();
        setUser(currentUser);
        if (currentUser?.role !== 'admin') window.location.href = createPageUrl('Dashboard');
      } catch (error) { console.error('Failed to load user'); }
    };
    loadUser();
  }, []);

  // Legacy tab= param migration
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab) setSearchParams({ section: tab }, { replace: true });
  }, []);

  const allMenuItems = useMemo(() => MENU_GROUPS.flatMap((g) => g.items), []);

  if (!user || user?.role !== 'admin') return null;

  const renderSectionContent = () => {
    switch (activeSection) {
      case 'users': return <div className="bg-white rounded-2xl border border-slate-200 p-6"><UserAssignmentPanel /></div>;
      case 'branding': return <BrandingPanel />;
      case 'integrations': return <IntegrationsPanel activeIntegration={activeIntegrationId} setActiveIntegration={setActiveIntegration} />;
      case 'cron': return <div className="bg-white rounded-2xl border border-slate-200 p-6"><CronJobsPanel /></div>;
      case 'email': return <ResendEmailConfig />;
      case 'api': return <ApiDocsPanel />;
      case 'feedback': return <div className="bg-white rounded-2xl border border-slate-200 p-6"><FeedbackPanel /></div>;
      case 'security': return <SecurityAuditPanel />;
      case 'system-info': return <SystemInfoPanel />;
      default: return null;
    }
  };

  if (!user) {
    return (
      <div className="max-w-5xl mx-auto py-8 px-4 space-y-6">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-11 h-11 rounded-xl bg-slate-200 animate-pulse" />
          <div className="h-7 w-40 bg-slate-200 rounded-lg animate-pulse" />
        </div>
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="space-y-3">
            <div className="h-4 w-24 bg-slate-100 rounded animate-pulse" />
            <div className="grid grid-cols-2 gap-3">
              {[1, 2].map(j => (
                <div key={j} className="h-20 bg-slate-100 rounded-xl animate-pulse" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="mb-8">
        {activeSection ? (
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
            <button onClick={() => setActiveSection(null)} className="hover:text-slate-900 hover:underline">Adminland</button>
            <ChevronRight className="w-4 h-4" />
            {activeIntegrationId ? (
              <>
                <button onClick={() => setActiveIntegration(null)} className="hover:text-slate-900 hover:underline">
                  {allMenuItems.find((i) => i.id === activeSection)?.label || activeSection}
                </button>
                <ChevronRight className="w-4 h-4" />
                <span className="text-slate-900 font-medium">
                  {INTEGRATION_CATEGORIES.flatMap(c => c.items).find(i => i.id === activeIntegrationId)?.label || activeIntegrationId}
                </span>
              </>
            ) : (
              <span className="text-slate-900 font-medium">{allMenuItems.find((i) => i.id === activeSection)?.label || activeSection}</span>
            )}
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-purple-600 p-2.5 rounded-xl text-white"><Shield className="w-6 h-6" /></div>
              <h1 className="text-2xl font-bold text-slate-900">Adminland</h1>
            </div>
            <p className="text-slate-500">Manage your workspace settings</p>
          </div>
        )}
      </div>

      {/* Content */}
      {activeSection === null ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {MENU_GROUPS.map((group) => (
            <div key={group.title} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-100">
                <h2 className="font-semibold text-slate-900 text-sm">{group.title}</h2>
              </div>
              <div className="divide-y divide-slate-100">
                {group.items.map((item) => {
                  const ItemIcon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveSection(item.id)}
                      className="w-full flex items-center gap-3.5 px-5 py-4 hover:bg-slate-50 transition-colors text-left group"
                    >
                      <div className={cn("p-2.5 rounded-xl transition-colors flex-shrink-0", item.iconBg, "group-hover:opacity-90")}>
                        <ItemIcon className={cn("w-5 h-5", item.iconColor)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-slate-900 text-sm">{item.label}</h3>
                        <p className="text-xs text-slate-500 mt-0.5">{item.desc}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors flex-shrink-0" />
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div>
          <Button variant="ghost" className="mb-4 pl-0 hover:pl-2 transition-all md:hidden" onClick={() => setActiveSection(null)}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>
          {renderSectionContent()}
        </div>
      )}
    </div>
  );
}
