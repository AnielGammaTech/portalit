import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Cloud, Monitor, ChevronDown, CheckCircle2, Shield, Users, HardDrive, Wifi,
  ShieldAlert, Database, Fish, AlertTriangle, Rocket, Brain, ShieldCheck,
  Phone, Globe, ArrowLeft,
} from 'lucide-react';
import { cn } from "@/lib/utils";
import { client } from '@/api/client';
import { formatDistanceToNow } from 'date-fns';
import HaloPSAConfig from '../components/integrations/HaloPSAConfig';
import DattoRMMConfig from '../components/integrations/DattoRMMConfig';
import RocketCyberConfig from '../components/integrations/RocketCyberConfig';
import DattoEDRConfig from '../components/integrations/DattoEDRConfig';
import JumpCloudConfig from '../components/integrations/JumpCloudConfig';
import SpanningConfig from '../components/integrations/SpanningConfig';
import CoveDataConfig from '../components/integrations/CoveDataConfig';
import UniFiConfig from '../components/integrations/UniFiConfig';
import SaaSAlertsConfig from '../components/integrations/SaaSAlertsConfig';
import DarkWebIDConfig from '../components/integrations/DarkWebIDConfig';
import BullPhishIDConfig from '../components/integrations/BullPhishIDConfig';
import InkyConfig from '../components/integrations/InkyConfig';
import ThreeCXConfig from '../components/integrations/ThreeCXConfig';
import AIConfig from '../components/integrations/AIConfig';
import DmarcReportConfig from '../components/integrations/DmarcReportConfig';
import CIPPConfig from '../components/integrations/CIPPConfig';

const CONFIG_COMPONENTS = {
  halopsa: HaloPSAConfig, 'datto-rmm': DattoRMMConfig, 'datto-edr': DattoEDRConfig,
  rocketcyber: RocketCyberConfig, jumpcloud: JumpCloudConfig, spanning: SpanningConfig,
  cove: CoveDataConfig, unifi: UniFiConfig, 'saas-alerts': SaaSAlertsConfig,
  darkweb: DarkWebIDConfig, bullphish: BullPhishIDConfig, inky: InkyConfig,
  threecx: ThreeCXConfig, ai: AIConfig, dmarc: DmarcReportConfig, cipp: CIPPConfig,
};

const CATEGORIES = [
  {
    title: 'PSA & TICKETING',
    items: [
      { id: 'halopsa', name: 'HaloPSA', icon: Cloud, color: 'bg-indigo-500', mappingEntity: null },
    ],
  },
  {
    title: 'RMM & SECURITY',
    items: [
      { id: 'datto-rmm', name: 'Datto RMM', icon: Monitor, color: 'bg-blue-500', mappingEntity: 'DattoSiteMapping' },
      { id: 'datto-edr', name: 'Datto EDR', icon: Shield, color: 'bg-cyan-500', mappingEntity: 'DattoEDRMapping' },
      { id: 'rocketcyber', name: 'RocketCyber', icon: Rocket, color: 'bg-orange-500', mappingEntity: 'RocketCyberMapping' },
      { id: 'unifi', name: 'UniFi Network', icon: Wifi, color: 'bg-sky-500', mappingEntity: 'UniFiMapping' },
    ],
  },
  {
    title: 'IDENTITY & ACCESS',
    items: [
      { id: 'cipp', name: 'CIPP', icon: Users, color: 'bg-sky-600', mappingEntity: 'CIPPMapping' },
      { id: 'jumpcloud', name: 'JumpCloud', icon: Cloud, color: 'bg-green-500', mappingEntity: 'JumpCloudMapping' },
      { id: 'saas-alerts', name: 'SaaS Alerts', icon: ShieldAlert, color: 'bg-violet-500', mappingEntity: 'SaaSAlertsMapping' },
    ],
  },
  {
    title: 'BACKUP & RECOVERY',
    items: [
      { id: 'spanning', name: 'Unitrends', icon: Database, color: 'bg-purple-500', mappingEntity: 'SpanningMapping' },
      { id: 'cove', name: 'Cove Data', icon: HardDrive, color: 'bg-teal-500', mappingEntity: 'CoveDataMapping' },
    ],
  },
  {
    title: 'EMAIL & SECURITY AWARENESS',
    items: [
      { id: 'inky', name: 'INKY', icon: ShieldCheck, color: 'bg-blue-500' },
      { id: 'darkweb', name: 'Dark Web ID', icon: AlertTriangle, color: 'bg-red-500' },
      { id: 'bullphish', name: 'BullPhish ID', icon: Fish, color: 'bg-orange-500' },
      { id: 'dmarc', name: 'DMARC Report', icon: Globe, color: 'bg-emerald-500', mappingEntity: 'DmarcReportMapping' },
    ],
  },
  {
    title: 'VOIP & SETTINGS',
    items: [
      { id: 'threecx', name: '3CX VoIP', icon: Phone, color: 'bg-emerald-500', mappingEntity: 'ThreeCXMapping' },
      { id: 'ai', name: 'AI Provider', icon: Brain, color: 'bg-amber-500' },
    ],
  },
];

function useMappingCounts() {
  const ENTITIES = [
    'DattoSiteMapping', 'DattoEDRMapping', 'RocketCyberMapping', 'JumpCloudMapping',
    'SpanningMapping', 'CoveDataMapping', 'UniFiMapping', 'SaaSAlertsMapping',
    'ThreeCXMapping', 'CIPPMapping', 'DmarcReportMapping',
  ];
  const { data: counts = {}, isLoading } = useQuery({
    queryKey: ['mapping_counts'],
    queryFn: async () => {
      const results = await Promise.all(
        ENTITIES.map(async (e) => {
          try { return [e, await client.entities[e].count()]; }
          catch { return [e, 0]; }
        })
      );
      return Object.fromEntries(results);
    },
    staleTime: 1000 * 60 * 5,
  });
  return { counts, isLoading };
}

function getStatusInfo(id, mappingEntity, mappingCounts, haloStatus) {
  if (id === 'halopsa' && haloStatus) {
    if (haloStatus.configured && haloStatus.lastSync?.status === 'success') {
      return { dot: 'bg-emerald-500', label: `${haloStatus.customerCount || 0} customers`, connected: true };
    }
    if (haloStatus.configured) return { dot: 'bg-amber-500', label: 'Configured', connected: false };
  }
  if (mappingEntity && mappingCounts[mappingEntity] > 0) {
    return { dot: 'bg-emerald-500', label: `${mappingCounts[mappingEntity]} mapped`, connected: true };
  }
  if (mappingEntity) {
    return { dot: 'bg-slate-300', label: 'Not configured', connected: false };
  }
  return { dot: 'bg-slate-300', label: '', connected: false };
}

export default function Integrations() {
  const [openId, setOpenId] = useState(null);
  const { counts: mappingCounts, isLoading: countsLoading } = useMappingCounts();
  const { data: haloStatus } = useQuery({
    queryKey: ['halo-status'],
    queryFn: () => client.halo.getStatus(),
    staleTime: 30_000,
  });

  const ConfigComponent = openId ? CONFIG_COMPONENTS[openId] : null;
  const openIntegration = openId ? CATEGORIES.flatMap(c => c.items).find(i => i.id === openId) : null;

  // Detail view
  if (openId && ConfigComponent) {
    const Icon = openIntegration?.icon || Cloud;
    return (
      <div className="space-y-4">
        <button
          onClick={() => setOpenId(null)}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Integrations
        </button>
        <div className="flex items-center gap-3 mb-2">
          <div className={cn('p-2 rounded-lg', openIntegration?.color || 'bg-slate-500')}>
            <Icon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{openIntegration?.name}</h2>
            <p className="text-xs text-slate-500">{getStatusInfo(openId, openIntegration?.mappingEntity, mappingCounts, haloStatus).label}</p>
          </div>
        </div>
        <ConfigComponent />
      </div>
    );
  }

  // Dashboard grid view
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Integrations</h1>
        <p className="text-slate-500 text-sm mt-1">Connect external services to sync data</p>
      </div>

      <div className="space-y-6">
        {CATEGORIES.map((category) => (
          <div key={category.title}>
            <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-2">
              {category.title}
            </h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
              {category.items.map((integration) => {
                const Icon = integration.icon;
                const status = getStatusInfo(integration.id, integration.mappingEntity, mappingCounts, haloStatus);

                return (
                  <button
                    key={integration.id}
                    onClick={() => setOpenId(integration.id)}
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-lg border text-left transition-all hover:shadow-md group',
                      status.connected
                        ? 'bg-white border-emerald-200 hover:border-emerald-300'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    )}
                  >
                    <div className={cn('p-1.5 rounded-md shrink-0', integration.color)}>
                      <Icon className="w-4 h-4 text-white" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <div className={cn('w-1.5 h-1.5 rounded-full shrink-0', status.dot)} />
                        <p className="text-sm font-medium text-slate-900 truncate">{integration.name}</p>
                      </div>
                      {status.label && (
                        <p className={cn(
                          'text-[10px] mt-0.5 truncate',
                          status.connected ? 'text-emerald-600' : 'text-slate-400'
                        )}>
                          {countsLoading && integration.mappingEntity ? '...' : status.label}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
