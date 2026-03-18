import React, { useState } from 'react';
import { Database, ChevronDown, ChevronRight, Settings2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { CHANGELOG, APP_VERSION } from '@/lib/changelog';

const BUILD_DETAILS = [
  { label: 'App Version', value: APP_VERSION },
  { label: 'Environment', value: import.meta.env.MODE || 'production' },
  { label: 'API Endpoint', value: import.meta.env.VITE_API_BASE_URL || '—' },
  { label: 'Supabase', value: (import.meta.env.VITE_SUPABASE_URL || '').replace('https://', '').replace('.supabase.co', '') || '—' },
  { label: 'Build Tool', value: 'Vite + React 18' },
  { label: 'UI Framework', value: 'Tailwind CSS + shadcn/ui' },
  { label: 'State Management', value: 'TanStack React Query v5' },
  { label: 'Backend', value: 'Express + Supabase' },
  { label: 'Hosting', value: 'Railway (Docker)' },
  { label: 'Brand Color', value: '#6366f1', isColor: true },
];

export default function SystemInfoPanel() {
  const [expandedVersions, setExpandedVersions] = useState({ [CHANGELOG[0]?.version]: true });

  const toggleVersion = (version) => {
    setExpandedVersions((prev) => ({ ...prev, [version]: !prev[version] }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-slate-900">System Info</h3>
        <p className="text-sm text-slate-500 mt-0.5">Build information and recent changes</p>
      </div>

      {/* Build Details */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <Database className="w-4.5 h-4.5 text-slate-600" />
            <h4 className="font-semibold text-slate-900 text-sm">Build Details</h4>
          </div>
          <Badge variant="outline" className="text-indigo-600 border-indigo-200 bg-indigo-50 font-mono text-xs">
            v{APP_VERSION}
          </Badge>
        </div>
        <div className="divide-y divide-slate-100">
          {BUILD_DETAILS.map((item) => (
            <div key={item.label} className="flex items-center justify-between px-5 py-3">
              <span className="text-sm text-slate-500">{item.label}</span>
              <span className="text-sm font-medium text-slate-900 font-mono flex items-center gap-2">
                {item.isColor && (
                  <span
                    className="w-3.5 h-3.5 rounded-full border border-slate-200 inline-block"
                    style={{ backgroundColor: item.value }}
                  />
                )}
                {item.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Changelog */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center gap-2.5 px-5 py-4 border-b border-slate-100">
          <Settings2 className="w-4.5 h-4.5 text-slate-600" />
          <h4 className="font-semibold text-slate-900 text-sm">What's Changed</h4>
        </div>
        <div className="divide-y divide-slate-100">
          {CHANGELOG.map((entry) => {
            const isExpanded = expandedVersions[entry.version];
            return (
              <div key={entry.version}>
                <button
                  onClick={() => toggleVersion(entry.version)}
                  className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors text-left"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  )}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className="font-semibold text-slate-900 text-sm">v{entry.version}</span>
                    <span className="text-xs text-slate-400">{entry.date}</span>
                  </div>
                  <span className="text-xs text-slate-400 flex-shrink-0">
                    {entry.changes.length} change{entry.changes.length !== 1 ? 's' : ''}
                  </span>
                </button>
                {isExpanded && (
                  <div className="px-5 pb-4 pl-12">
                    <ul className="space-y-1.5">
                      {entry.changes.map((change, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm text-slate-600">
                          <span className="text-emerald-500 mt-0.5 flex-shrink-0">+</span>
                          <span>{change}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
