import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Cloud,
  Monitor,
  ChevronDown,
  CheckCircle2,
  Shield,
  Users,
  RefreshCw,
  Clock,
} from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { client } from '@/api/client';
import HaloPSAConfig from '../components/integrations/HaloPSAConfig';
import DattoRMMConfig from '../components/integrations/DattoRMMConfig';
import RocketCyberConfig from '../components/integrations/RocketCyberConfig';
import { formatDistanceToNow } from 'date-fns';

function IntegrationStatusBadge({ configured, lastSync, customerCount }) {
  if (!configured) {
    return (
      <Badge variant="outline" className="text-slate-400 border-slate-200 font-normal text-xs">
        Not configured
      </Badge>
    );
  }
  if (lastSync?.status === 'success') {
    return (
      <div className="flex items-center gap-2">
        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 font-normal text-xs">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Connected
        </Badge>
        {customerCount > 0 && (
          <Badge variant="outline" className="text-slate-500 border-slate-200 font-normal text-xs">
            <Users className="w-3 h-3 mr-1" />
            {customerCount} customers
          </Badge>
        )}
      </div>
    );
  }
  return (
    <Badge className="bg-amber-50 text-amber-700 border-amber-200 font-normal text-xs">
      Configured
    </Badge>
  );
}

export default function Integrations() {
  const [expandedIntegration, setExpandedIntegration] = useState(null);

  // Fetch HaloPSA status
  const { data: haloStatus } = useQuery({
    queryKey: ['halo-status'],
    queryFn: () => client.halo.getStatus(),
    staleTime: 30_000,
  });

  const integrations = [
    {
      id: 'halopsa',
      name: 'HaloPSA',
      description: 'Sync customers, contacts, contracts, invoices, and tickets from HaloPSA.',
      icon: Cloud,
      color: 'bg-blue-500',
      configured: haloStatus?.configured,
      lastSync: haloStatus?.lastSync,
      customerCount: haloStatus?.customerCount,
    },
    {
      id: 'dattormm',
      name: 'Datto RMM',
      description: 'Sync devices and map Datto sites to customers.',
      icon: Monitor,
      color: 'bg-emerald-500',
    },
    {
      id: 'rocketcyber',
      name: 'RocketCyber SOC',
      description: 'Sync security incidents and alerts from RocketCyber.',
      icon: Shield,
      color: 'bg-orange-500',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Integrations</h1>
        <p className="text-slate-500 mt-1">Connect external services to sync data</p>
      </div>

      {/* Integrations List */}
      <div className="space-y-4">
        {integrations.map((integration) => {
          const Icon = integration.icon;
          const isExpanded = expandedIntegration === integration.id;

          return (
            <div
              key={integration.id}
              className="border border-slate-200 rounded-xl bg-white overflow-hidden"
            >
              <button
                onClick={() => setExpandedIntegration(isExpanded ? null : integration.id)}
                className="w-full flex items-center justify-between p-5 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className={cn("p-2.5 rounded-lg", integration.color)}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-left">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-slate-900">{integration.name}</h3>
                      <ChevronDown
                        className={cn(
                          "w-4 h-4 text-slate-400 transition-transform",
                          isExpanded && "rotate-180"
                        )}
                      />
                    </div>
                    <p className="text-sm text-slate-500">{integration.description}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                  {integration.lastSync?.completed_at && (
                    <span className="text-xs text-slate-400 hidden sm:flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDistanceToNow(new Date(integration.lastSync.completed_at), { addSuffix: true })}
                    </span>
                  )}
                  <IntegrationStatusBadge
                    configured={integration.configured}
                    lastSync={integration.lastSync}
                    customerCount={integration.customerCount}
                  />
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-slate-100 p-5 bg-slate-50/50">
                  {integration.id === 'halopsa' && <HaloPSAConfig />}
                  {integration.id === 'dattormm' && <DattoRMMConfig />}
                  {integration.id === 'rocketcyber' && <RocketCyberConfig />}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
