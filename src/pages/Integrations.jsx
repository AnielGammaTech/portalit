import React, { useState } from 'react';
import { 
  Mail,
  Cloud,
  Shield,
  ChevronDown
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import HaloPSAConfig from '../components/integrations/HaloPSAConfig';

const INTEGRATIONS = [
  {
    id: 'resend',
    name: 'Resend Email',
    description: 'Configure email sending via Resend API',
    icon: Mail,
    color: 'bg-purple-500',
    status: 'connected'
  },
  {
    id: 'halopsa',
    name: 'HaloPSA',
    description: 'Sync customers, contacts, and sites from HaloPSA.',
    icon: Cloud,
    color: 'bg-blue-500',
    status: 'disabled'
  }
];

export default function Integrations() {
  const [expandedIntegration, setExpandedIntegration] = useState(null);
  const [integrationStates, setIntegrationStates] = useState({
    resend: { enabled: true },
    halopsa: { enabled: false }
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Integrations & Webhooks</h1>
            <p className="text-slate-500 mt-1">Connect external services and webhooks</p>
          </div>
          <Button className="bg-orange-500 hover:bg-orange-600 gap-2">
            💾 Save Changes
          </Button>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="integrations" className="w-full">
          <TabsList className="bg-white border border-slate-200/50 w-auto">
            <TabsTrigger value="integrations">Integrations</TabsTrigger>
            <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
            <TabsTrigger value="gammastack">GammaStackIT</TabsTrigger>
          </TabsList>

          {/* Integrations Tab */}
          <TabsContent value="integrations" className="space-y-4 mt-6">
            {INTEGRATIONS.map((integration) => {
              const Icon = integration.icon;
              const isExpanded = expandedIntegration === integration.id;
              const state = integrationStates[integration.id];

              return (
                <div
                  key={integration.id}
                  className="border border-slate-200/50 rounded-xl bg-white"
                >
                  <button
                    onClick={() => setExpandedIntegration(isExpanded ? null : integration.id)}
                    className="w-full flex items-center justify-between p-6 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-start gap-4">
                      <div className={cn("p-3 rounded-lg", integration.color)}>
                        <Icon className="w-6 h-6 text-white" />
                      </div>
                      <div className="text-left">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-slate-900">{integration.name}</h3>
                          <ChevronDown
                            className={cn(
                              "w-4 h-4 text-slate-400 transition-transform",
                              isExpanded && "rotate-180"
                            )}
                          />
                        </div>
                        <p className="text-sm text-slate-500 mt-1">{integration.description}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 ml-4">
                      {integration.status === 'connected' ? (
                        <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200">
                          ✓ Connected
                        </Badge>
                      ) : (
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-slate-500">Enable</span>
                          <Switch
                            checked={state?.enabled || false}
                            onCheckedChange={(checked) =>
                              setIntegrationStates({
                                ...integrationStates,
                                [integration.id]: { ...state, enabled: checked }
                              })
                            }
                          />
                        </div>
                      )}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-6 pb-6 border-t border-slate-100">
                      <div className="mt-6">
                        {integration.id === 'halopsa' ? (
                          <HaloPSAConfig />
                        ) : (
                          <p className="text-sm text-slate-600">
                            Configuration options for {integration.name} would appear here.
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </TabsContent>

          {/* Webhooks Tab */}
          <TabsContent value="webhooks" className="mt-6">
            <div className="text-center py-12">
              <p className="text-slate-500">Webhooks configuration coming soon</p>
            </div>
          </TabsContent>

          {/* GammaStackIT Tab */}
          <TabsContent value="gammastack" className="mt-6">
            <div className="text-center py-12">
              <p className="text-slate-500">GammaStackIT integration coming soon</p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}