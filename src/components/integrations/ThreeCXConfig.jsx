import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { client } from '@/api/client';
import { Globe, FileText } from 'lucide-react';
import { cn } from "@/lib/utils";
import {
  IntegrationHeader, CONNECTION_STATES, getConnectionStatusDisplay,
} from './shared/IntegrationTableParts';
import APISyncTab from './ThreeCXAPISyncTab';
import PDFReportsTab from './ThreeCXPDFReportsTab';

const TABS = [
  { id: 'api', label: 'API Sync', icon: Globe },
  { id: 'reports', label: 'Reports', icon: FileText },
];

export default function ThreeCXConfig() {
  const [activeTab, setActiveTab] = useState('api');

  const { data: mappings = [] } = useQuery({
    queryKey: ['threecx-mappings'],
    queryFn: () => client.entities.ThreeCXMapping.list('customer_name', 100),
  });

  const statusDisplay = getConnectionStatusDisplay(
    mappings.length > 0 ? CONNECTION_STATES.CONNECTED : CONNECTION_STATES.NOT_CONFIGURED
  );

  return (
    <div className="space-y-3">
      <IntegrationHeader
        statusDisplay={statusDisplay}
        integrationName="3CX VoIP"
        hasData={mappings.length > 0}
        mappedCount={mappings.length}
        totalCount={mappings.length}
      >
        <span className="text-xs text-slate-500">{mappings.length} instances configured</span>
      </IntegrationHeader>

      <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
        {TABS.map(tab => {
          const TabIcon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition-all',
                activeTab === tab.id
                  ? 'bg-white shadow-sm text-slate-900'
                  : 'text-slate-500 hover:text-slate-700'
              )}
            >
              <TabIcon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'api' ? <APISyncTab /> : <PDFReportsTab />}
    </div>
  );
}
