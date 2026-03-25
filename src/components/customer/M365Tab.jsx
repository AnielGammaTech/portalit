import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { client } from '@/api/client';
import { Package, Users, Loader2 } from 'lucide-react';
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";
import Pax8Tab from './Pax8Tab';
import CIPPMicrosoftTab from './CIPPMicrosoftTab';

const M365_SUB_TABS = [
  { key: 'pax8', label: 'Pax8 Subscriptions', icon: Package },
  { key: 'microsoft', label: 'Microsoft', icon: Users },
];

export default function M365Tab({ customerId, queryClient }) {
  const [activeSubTab, setActiveSubTab] = useState('pax8');

  // Check if Pax8 mapping exists
  const { data: pax8Mappings = [] } = useQuery({
    queryKey: ['pax8-mapping', customerId],
    queryFn: () => client.entities.Pax8Mapping.filter({ customer_id: customerId }),
    enabled: !!customerId,
  });
  const pax8Mapping = pax8Mappings[0] || null;

  // Check if CIPP mapping exists
  const { data: cippMappings = [] } = useQuery({
    queryKey: ['cipp-mapping', customerId],
    queryFn: () => client.entities.CIPPMapping.filter({ customer_id: customerId }),
    enabled: !!customerId,
  });
  const hasCIPP = cippMappings.length > 0;
  const hasPax8 = !!pax8Mapping;

  return (
    <div className="space-y-4">
      {/* Sub-tab switcher */}
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
        {M365_SUB_TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.key;
          const hasData = tab.key === 'pax8' ? hasPax8 : hasCIPP;

          return (
            <button
              key={tab.key}
              onClick={() => setActiveSubTab(tab.key)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all",
                isActive
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              {!hasData && (
                <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
              )}
            </button>
          );
        })}
      </div>

      {/* Pax8 sub-tab */}
      {activeSubTab === 'pax8' && (
        hasPax8 ? (
          <Pax8Tab customerId={customerId} pax8Mapping={pax8Mapping} queryClient={queryClient} />
        ) : (
          <EmptyState
            icon={Package}
            title="No Pax8 mapping"
            description="This customer hasn't been mapped to a Pax8 company yet. Set it up in Adminland → Integrations → Pax8."
          />
        )
      )}

      {/* Microsoft / CIPP sub-tab */}
      {activeSubTab === 'microsoft' && (
        hasCIPP ? (
          <CIPPMicrosoftTab customerId={customerId} />
        ) : (
          <EmptyState
            icon={Users}
            title="No CIPP mapping"
            description="This customer hasn't been mapped to a CIPP tenant yet. Set it up in Adminland → Integrations → CIPP."
          />
        )
      )}
    </div>
  );
}
