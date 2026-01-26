import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import Breadcrumbs from '../components/ui/breadcrumbs';
import UserAssignmentPanel from '../components/admin/UserAssignmentPanel';

import {
  Shield,
  Users,
  FileText,
  Mail,
  MessageSquare,
  Link2,
  UserPlus,
  ChevronRight,
  AlertTriangle
} from 'lucide-react';

const MENU_SECTIONS = [
  {
    title: 'People',
    items: [
      {
        name: 'Customers',
        description: 'Manage all customer accounts',
        icon: Users,
        page: 'Customers'
      },
      {
        name: 'User Access',
        description: 'Assign users to organizations',
        icon: UserPlus,
        panel: 'user-access'
      }
    ]
  },
  {
    title: 'Integrations',
    items: [
      {
        name: 'Integrations',
        description: 'Datto, JumpCloud, Unitrends, Dark Web ID',
        icon: Link2,
        page: 'Settings',
        tab: 'integrations'
      }
    ]
  }
];

export default function Adminland() {
  const [user, setUser] = useState(null);
  const [activePanel, setActivePanel] = useState(null);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
        
        if (currentUser?.role !== 'admin') {
          window.location.href = createPageUrl('Dashboard');
        }
      } catch (error) {
        console.error('Failed to load user');
      }
    };
    loadUser();
  }, []);

  if (user?.role !== 'admin') {
    return null;
  }

  if (activePanel === 'user-access') {
    return (
      <div className="max-w-5xl mx-auto py-8">
        <Breadcrumbs items={[
          { label: 'Adminland', href: createPageUrl('Adminland') },
          { label: 'User Access' }
        ]} />
        
        <div className="flex items-center gap-4 mb-8">
          <button 
            onClick={() => setActivePanel(null)}
            className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-slate-600 rotate-180" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">User Access</h1>
            <p className="text-sm text-slate-500">Assign users to customer organizations</p>
          </div>
        </div>

        <UserAssignmentPanel />
      </div>
    );
  }



  return (
    <div className="max-w-4xl mx-auto py-8">
      <Breadcrumbs items={[{ label: 'Adminland' }]} />
      
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 rounded-2xl bg-blue-500 flex items-center justify-center">
          <Shield className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Adminland</h1>
          <p className="text-sm text-slate-500">Manage your workspace settings</p>
        </div>
      </div>

      {/* Menu Grid - 2 columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {MENU_SECTIONS.map((section) => (
          <div 
            key={section.title} 
            className="bg-white rounded-2xl border border-slate-200 p-6"
          >
            <h2 className="text-base font-semibold text-slate-900 mb-4">
              {section.title}
            </h2>
            <div className="space-y-1">
              {section.items.map((item) => {
                const Icon = item.icon;
                
                if (item.panel) {
                  return (
                    <button
                      key={item.name}
                      onClick={() => setActivePanel(item.panel)}
                      className="flex items-center gap-3 p-3 -mx-3 rounded-xl hover:bg-slate-50 transition-colors w-full text-left"
                    >
                      <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                        <Icon className="w-5 h-5 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-blue-600">{item.name}</p>
                        <p className="text-sm text-slate-500">{item.description}</p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-400" />
                    </button>
                  );
                }
                
                return (
                  <Link
                    key={item.name}
                    to={createPageUrl(item.page) + (item.tab ? `?tab=${item.tab}` : '')}
                    className="flex items-center gap-3 p-3 -mx-3 rounded-xl hover:bg-slate-50 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                      <Icon className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-blue-600">{item.name}</p>
                      <p className="text-sm text-slate-500">{item.description}</p>
                    </div>
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