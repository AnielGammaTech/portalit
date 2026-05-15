import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { client } from '@/api/client';
import { Package, Monitor } from 'lucide-react';
import { cn } from "@/lib/utils";
import Pax8Tab from './Pax8Tab';
import CIPPMicrosoftTab from './CIPPMicrosoftTab';

const M365_SUB_TABS = [
  { key: 'microsoft', label: 'Microsoft', icon: Monitor },
  { key: 'pax8', label: 'Pax8', icon: Package },
];

export default function M365Tab({ customerId, queryClient }) {
  const [activeSubTab, setActiveSubTab] = useState('microsoft');

  const { data: pax8MappingsRaw = [], isLoading: loadingPax8 } = useQuery({
    queryKey: ['pax8-mapping', customerId],
    queryFn: () => client.entities.Pax8Mapping.filter({ customer_id: customerId }),
    enabled: !!customerId,
  });
  const pax8Mappings = pax8MappingsRaw ?? [];
  const pax8Mapping = pax8Mappings[0] || null;

  const { data: cippMappingsRaw = [], isLoading: loadingCIPP } = useQuery({
    queryKey: ['cipp-mapping', customerId],
    queryFn: () => client.entities.CIPPMapping.filter({ customer_id: customerId }),
    enabled: !!customerId,
  });
  const cippMappings = cippMappingsRaw ?? [];
  const hasCIPP = cippMappings.length > 0;
  const hasPax8 = !!pax8Mapping;

  return (
    <div className="space-y-4">
      {/* Sub-tab switcher */}
      <div className="flex w-full justify-center">
        <div className="flex w-full max-w-xl gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
        {M365_SUB_TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.key;
          const hasData = tab.key === 'pax8' ? hasPax8 : hasCIPP;

          return (
            <button
              key={tab.key}
              onClick={() => setActiveSubTab(tab.key)}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-all",
                isActive
                  ? "bg-slate-950 text-white"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              {hasData && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              )}
            </button>
          );
        })}
        </div>
      </div>

      {/* Microsoft / CIPP sub-tab */}
      {activeSubTab === 'microsoft' && (
        loadingCIPP ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-slate-200 border-t-slate-600 rounded-full animate-spin" />
          </div>
        ) : hasCIPP ? (
          <CIPPMicrosoftTab customerId={customerId} />
        ) : (
          <div className="text-center py-16">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <Monitor className="w-7 h-7 text-slate-300" />
            </div>
            <p className="text-sm font-semibold text-slate-700">Microsoft 365 data is not connected yet</p>
            <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
              Subscription and tenant details will appear here once they are available for this account.
            </p>
          </div>
        )
      )}

      {/* Pax8 sub-tab */}
      {activeSubTab === 'pax8' && (
        loadingPax8 ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-slate-200 border-t-slate-600 rounded-full animate-spin" />
          </div>
        ) : hasPax8 ? (
          <Pax8Tab customerId={customerId} pax8Mapping={pax8Mapping} queryClient={queryClient} />
        ) : (
          <div className="text-center py-16">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <Package className="w-7 h-7 text-slate-300" />
            </div>
            <p className="text-sm font-semibold text-slate-700">Pax8 subscription data is not connected yet</p>
            <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
              License counts, billing totals, and subscription details will appear here once connected.
            </p>
          </div>
        )
      )}
    </div>
  );
}
