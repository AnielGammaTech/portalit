import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import {
  ArrowLeft,
  Settings,
  Users,
  Shield,
  FileText,
  Zap,
  BarChart3,
  Mail,
  Building2,
  ChevronRight,
  ToggleRight,
  RefreshCw,
  Check,
  X
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { toast } from 'sonner';

const MENU_SECTIONS = [
  {
    title: 'INTEGRATIONS',
    items: [
      {
        id: 'halopsa',
        name: 'HaloPSA',
        description: 'Sync customers, contracts, and billing data',
        icon: () => (
          <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center text-purple-700 font-bold text-xs">
            HPS
          </div>
        ),
        hasToggle: true,
        page: 'Settings'
      }
    ]
  },
  {
    title: 'PEOPLE',
    items: [
      {
        id: 'people',
        name: 'People & Teams',
        description: 'Team members, groups, and admins',
        icon: Users,
        page: 'Customers'
      },
      {
        id: 'roles',
        name: 'Roles & Permissions',
        description: 'Access control',
        icon: Shield,
        page: 'Settings'
      }
    ]
  },
  {
    title: 'DATA MANAGEMENT',
    items: [
      {
        id: 'customers',
        name: 'Customers',
        description: 'Manage customer records',
        icon: Building2,
        page: 'Customers'
      },
      {
        id: 'contracts',
        name: 'Contracts',
        description: 'View all contracts',
        icon: FileText,
        page: 'Contracts'
      }
    ]
  },
  {
    title: 'AUTOMATION & REPORTS',
    items: [
      {
        id: 'workflows',
        name: 'Workflows',
        description: 'Automation triggers',
        icon: Zap,
        page: 'Settings'
      },
      {
        id: 'reports',
        name: 'Reports',
        description: 'Run reports',
        icon: BarChart3,
        page: 'SaaSReports'
      },
      {
        id: 'email',
        name: 'Email Templates',
        description: 'Notification templates',
        icon: Mail,
        page: 'Settings'
      }
    ]
  }
];

export default function Adminland() {
  const [user, setUser] = useState(null);
  const [haloPsaEnabled, setHaloPsaEnabled] = useState(false);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
        
        // Redirect non-admins
        if (currentUser?.role !== 'admin') {
          window.location.href = createPageUrl('Dashboard');
        }
      } catch (error) {
        console.error('Failed to load user');
      }
    };
    loadUser();
  }, []);

  const { data: settings = [] } = useQuery({
    queryKey: ['settings'],
    queryFn: () => base44.entities.Settings.list(),
  });

  useEffect(() => {
    if (settings.length > 0) {
      const config = settings[0];
      setHaloPsaEnabled(!!(config.halopsa_client_id && config.halopsa_api_url));
    }
  }, [settings]);

  if (user?.role !== 'admin') {
    return null;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to={createPageUrl('Dashboard')}>
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
            <Settings className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Adminland</h1>
            <p className="text-sm text-slate-500">Workspace settings</p>
          </div>
        </div>
      </div>

      {/* Menu Sections */}
      <div className="space-y-6">
        {MENU_SECTIONS.map((section) => (
          <div key={section.title}>
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 px-1">
              {section.title}
            </h2>
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isHaloPsa = item.id === 'halopsa';
                
                return (
                  <Link
                    key={item.id}
                    to={createPageUrl(item.page)}
                    className="flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors"
                  >
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center",
                      !isHaloPsa && "bg-purple-100"
                    )}>
                      {isHaloPsa ? (
                        <Icon />
                      ) : (
                        <Icon className="w-5 h-5 text-purple-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900">{item.name}</p>
                      <p className="text-sm text-slate-500">{item.description}</p>
                    </div>
                    {item.hasToggle ? (
                      <div className="flex items-center gap-3" onClick={(e) => e.preventDefault()}>
                        <Switch
                          checked={haloPsaEnabled}
                          onCheckedChange={() => {
                            window.location.href = createPageUrl('Settings');
                          }}
                        />
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      </div>
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}