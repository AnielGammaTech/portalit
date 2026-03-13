import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Cloud,
  Monitor,
  ChevronDown,
  CheckCircle2,
  Shield,
  Users,
  Clock,
  HardDrive,
  Wifi,
  ShieldAlert,
  Database,
  Fish,
  AlertTriangle,
  Rocket,
  Brain,
  Zap,
} from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { client } from '@/api/client';
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
import AIConfig from '../components/integrations/AIConfig';
import { formatDistanceToNow } from 'date-fns';

// ── Config component map ─────────────────────────────────────────────────

const CONFIG_COMPONENTS = {
  halopsa: HaloPSAConfig,
  'datto-rmm': DattoRMMConfig,
  'datto-edr': DattoEDRConfig,
  rocketcyber: RocketCyberConfig,
  jumpcloud: JumpCloudConfig,
  spanning: SpanningConfig,
  cove: CoveDataConfig,
  unifi: UniFiConfig,
  'saas-alerts': SaaSAlertsConfig,
  darkweb: DarkWebIDConfig,
  bullphish: BullPhishIDConfig,
  ai: AIConfig,
};

// ── Integration categories ───────────────────────────────────────────────

const CATEGORIES = [
  {
    title: 'PSA & TICKETING',
    items: [
      { id: 'halopsa', name: 'HaloPSA', desc: 'Sync customers, contacts, contracts & tickets', icon: Cloud, color: 'bg-indigo-500', mappingEntity: null },
    ],
  },
  {
    title: 'RMM & SECURITY',
    items: [
      { id: 'datto-rmm', name: 'Datto RMM', desc: 'Sync devices and map Datto sites', icon: Monitor, color: 'bg-blue-500', mappingEntity: 'DattoSiteMapping' },
      { id: 'datto-edr', name: 'Datto EDR', desc: 'Endpoint detection & response', icon: Shield, color: 'bg-cyan-500', mappingEntity: 'DattoEDRMapping' },
      { id: 'rocketcyber', name: 'RocketCyber SOC', desc: 'Security incidents and alerts', icon: Rocket, color: 'bg-orange-500', mappingEntity: 'RocketCyberMapping' },
      { id: 'unifi', name: 'UniFi Network', desc: 'Sync firewalls and network devices', icon: Wifi, color: 'bg-sky-500', mappingEntity: 'UniFiMapping' },
    ],
  },
  {
    title: 'SAAS SECURITY',
    items: [
      { id: 'saas-alerts', name: 'SaaS Alerts', desc: 'Monitor SaaS app security events', icon: ShieldAlert, color: 'bg-violet-500', mappingEntity: 'SaaSAlertsMapping' },
    ],
  },
  {
    title: 'IDENTITY & ACCESS',
    items: [
      { id: 'jumpcloud', name: 'JumpCloud', desc: 'Sync SSO applications and users', icon: Cloud, color: 'bg-green-500', mappingEntity: 'JumpCloudMapping' },
    ],
  },
  {
    title: 'BACKUP & RECOVERY',
    items: [
      { id: 'spanning', name: 'Unitrends', desc: 'Sync backup data from Unitrends MSP', icon: Database, color: 'bg-purple-500', mappingEntity: 'SpanningMapping' },
      { id: 'cove', name: 'Cove Data Protection', desc: 'Backup monitoring from N-able Cove', icon: HardDrive, color: 'bg-teal-500', mappingEntity: 'CoveDataMapping' },
    ],
  },
  {
    title: 'SECURITY AWARENESS',
    items: [
      { id: 'darkweb', name: 'Dark Web ID', desc: 'Monitor dark web compromises', icon: AlertTriangle, color: 'bg-red-500' },
      { id: 'bullphish', name: 'BullPhish ID', desc: 'Phishing simulation reports', icon: Fish, color: 'bg-orange-500' },
    ],
  },
  {
    title: 'AI & AUTOMATION',
    items: [
      { id: 'ai', name: 'AI Provider', desc: 'Choose between OpenAI and Claude AI', icon: Brain, color: 'bg-amber-500' },
    ],
  },
];

// ── Mapping count queries ────────────────────────────────────────────────

function useMappingCounts() {
  const { data: datto = [] } = useQuery({ queryKey: ['datto_mappings'], queryFn: () => client.entities.DattoSiteMapping.list() });
  const { data: edr = [] } = useQuery({ queryKey: ['edr_mappings'], queryFn: () => client.entities.DattoEDRMapping.list() });
  const { data: rc = [] } = useQuery({ queryKey: ['rocketcyber_mappings'], queryFn: () => client.entities.RocketCyberMapping.list() });
  const { data: jc = [] } = useQuery({ queryKey: ['jumpcloud_mappings'], queryFn: () => client.entities.JumpCloudMapping.list() });
  const { data: sp = [] } = useQuery({ queryKey: ['spanning_mappings'], queryFn: () => client.entities.SpanningMapping.list() });
  const { data: cove = [] } = useQuery({ queryKey: ['cove_mappings'], queryFn: () => client.entities.CoveDataMapping.list() });
  const { data: unifi = [] } = useQuery({ queryKey: ['unifi_mappings'], queryFn: () => client.entities.UniFiMapping.list() });
  const { data: saas = [] } = useQuery({ queryKey: ['saas_alerts_mappings'], queryFn: () => client.entities.SaaSAlertsMapping.list() });

  return {
    DattoSiteMapping: datto.length,
    DattoEDRMapping: edr.length,
    RocketCyberMapping: rc.length,
    JumpCloudMapping: jc.length,
    SpanningMapping: sp.length,
    CoveDataMapping: cove.length,
    UniFiMapping: unifi.length,
    SaaSAlertsMapping: saas.length,
  };
}

// ── Status badge ─────────────────────────────────────────────────────────

function IntegrationStatusBadge({ mappingEntity, mappingCounts, haloStatus }) {
  // HaloPSA has its own status
  if (haloStatus) {
    if (haloStatus.configured && haloStatus.lastSync?.status === 'success') {
      return (
        <div className="flex items-center gap-2">
          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 font-normal text-xs">
            <CheckCircle2 className="w-3 h-3 mr-1" /> Connected
          </Badge>
          {haloStatus.customerCount > 0 && (
            <Badge variant="outline" className="text-slate-500 border-slate-200 font-normal text-xs">
              <Users className="w-3 h-3 mr-1" /> {haloStatus.customerCount}
            </Badge>
          )}
        </div>
      );
    }
    if (haloStatus.configured) {
      return <Badge className="bg-amber-50 text-amber-700 border-amber-200 font-normal text-xs">Configured</Badge>;
    }
  }

  // Other integrations use mapping counts
  if (mappingEntity && mappingCounts[mappingEntity] > 0) {
    return (
      <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 font-normal text-xs">
        <CheckCircle2 className="w-3 h-3 mr-1" /> {mappingCounts[mappingEntity]} mapped
      </Badge>
    );
  }

  if (mappingEntity) {
    return (
      <Badge variant="outline" className="text-slate-400 border-slate-200 font-normal text-xs">
        Not configured
      </Badge>
    );
  }

  return null;
}

// ── Main page ────────────────────────────────────────────────────────────

export default function Integrations() {
  const [expandedId, setExpandedId] = useState(null);
  const mappingCounts = useMappingCounts();

  const { data: haloStatus } = useQuery({
    queryKey: ['halo-status'],
    queryFn: () => client.halo.getStatus(),
    staleTime: 30_000,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Integrations</h1>
        <p className="text-slate-500 mt-1">Connect external services to sync data</p>
      </div>

      <div className="space-y-8">
        {CATEGORIES.map((category) => (
          <div key={category.title}>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              {category.title}
            </h3>
            <div className="space-y-3">
              {category.items.map((integration) => {
                const Icon = integration.icon;
                const isExpanded = expandedId === integration.id;
                const ConfigComponent = CONFIG_COMPONENTS[integration.id];

                return (
                  <div
                    key={integration.id}
                    className="border border-slate-200 rounded-xl bg-white overflow-hidden"
                  >
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : integration.id)}
                      className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className={cn('p-2.5 rounded-lg', integration.color)}>
                          <Icon className="w-5 h-5 text-white" />
                        </div>
                        <div className="text-left">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-slate-900 text-sm">{integration.name}</h4>
                            <ChevronDown className={cn(
                              'w-4 h-4 text-slate-400 transition-transform',
                              isExpanded && 'rotate-180'
                            )} />
                          </div>
                          <p className="text-xs text-slate-500">{integration.desc}</p>
                        </div>
                      </div>

                      <div onClick={(e) => e.stopPropagation()}>
                        <IntegrationStatusBadge
                          mappingEntity={integration.mappingEntity}
                          mappingCounts={mappingCounts}
                          haloStatus={integration.id === 'halopsa' ? haloStatus : null}
                        />
                      </div>
                    </button>

                    {isExpanded && ConfigComponent && (
                      <div className="border-t border-slate-100 p-5 bg-slate-50/50">
                        <ConfigComponent />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
