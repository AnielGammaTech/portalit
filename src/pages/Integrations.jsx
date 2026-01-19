import React, { useState } from 'react';
import { 
  Cloud,
  Monitor,
  ChevronDown,
  CheckCircle2
} from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import HaloPSAConfig from '../components/integrations/HaloPSAConfig';
import DattoRMMConfig from '../components/integrations/DattoRMMConfig';

export default function Integrations() {
  const [expandedIntegration, setExpandedIntegration] = useState(null);

  const integrations = [
    {
      id: 'halopsa',
      name: 'HaloPSA',
      description: 'Sync customers, contracts, invoices, and tickets.',
      icon: Cloud,
      color: 'bg-blue-500'
    },
    {
      id: 'dattormm',
      name: 'Datto RMM',
      description: 'Sync devices and map Datto sites to customers.',
      icon: Monitor,
      color: 'bg-emerald-500'
    }
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
              </button>

              {isExpanded && (
                <div className="border-t border-slate-100 p-5 bg-slate-50/50">
                  {integration.id === 'halopsa' && <HaloPSAConfig />}
                  {integration.id === 'dattormm' && <DattoRMMConfig />}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}