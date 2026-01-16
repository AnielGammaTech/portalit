import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import {
  Shield,
  Users,
  Lock,
  RefreshCw,
  Settings as SettingsIcon,
  FileText,
  MessageSquare,
  Activity,
  Zap,
  Mail,
  Tag
} from 'lucide-react';

export default function Adminland() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
      } catch (error) {
        console.error('Failed to load user', error);
      }
    };
    loadUser();
  }, []);

  // Only show for admin users
  if (!user || user.role !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Shield className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h2 className="text-2xl font-semibold text-slate-900 mb-2">Access Denied</h2>
          <p className="text-slate-600">You need admin permissions to access this area.</p>
        </div>
      </div>
    );
  }

  const sections = [
    {
      title: 'People',
      items: [
        {
          icon: Users,
          title: 'People & Teams',
          description: 'Team members, groups, and admins',
          action: () => console.log('People & Teams')
        },
        {
          icon: Lock,
          title: 'Roles & Permissions',
          description: 'Access control',
          action: () => console.log('Roles & Permissions')
        }
      ]
    },
    {
      title: 'Data Management',
      items: [
        {
          icon: FileText,
          title: 'Customers',
          description: 'Manage customer records',
          link: 'Customers'
        },
        {
          icon: Tag,
          title: 'Contracts',
          description: 'View all contracts',
          action: () => console.log('Contracts')
        }
      ]
    },
    {
      title: 'Automation & Reports',
      items: [
        {
          icon: Zap,
          title: 'Workflows',
          description: 'Automation triggers',
          action: () => console.log('Workflows')
        },
        {
          icon: FileText,
          title: 'Reports',
          description: 'Run reports',
          action: () => console.log('Reports')
        },
        {
          icon: Mail,
          title: 'Email Templates',
          description: 'Notification templates',
          action: () => console.log('Email Templates')
        }
      ]
    },
    {
      title: 'Settings',
      items: [
        {
          icon: SettingsIcon,
          title: 'App Settings',
          description: 'Branding',
          link: 'Settings'
        },
        {
          icon: RefreshCw,
          title: 'Integrations',
          description: 'External services & webhooks',
          link: 'Integrations'
        },
        {
          icon: MessageSquare,
          title: 'Feedback',
          description: 'Bug reports',
          action: () => console.log('Feedback')
        },
        {
          icon: Activity,
          title: 'Audit Logs',
          description: 'Activity tracking',
          action: () => console.log('Audit Logs')
        }
      ]
    }
  ];

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-xl bg-purple-500 flex items-center justify-center">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Adminland</h1>
            <p className="text-slate-600">Manage your workspace settings</p>
          </div>
        </div>
      </div>

      {/* Sections Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {sections.map((section, sectionIdx) => (
          <div key={sectionIdx} className="bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-900 text-lg">{section.title}</h3>
            </div>
            <div className="p-3">
              {section.items.map((item, itemIdx) => {
                const Icon = item.icon;
                const content = (
                  <button
                    onClick={item.action}
                    className="w-full flex items-start gap-4 p-4 rounded-lg hover:bg-slate-50 transition-colors text-left group"
                  >
                    <div className="w-12 h-12 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0 group-hover:bg-purple-100 transition-colors">
                      <Icon className="w-6 h-6 text-purple-600" />
                    </div>
                    <div className="flex-1 min-w-0 pt-1">
                      <p className="font-medium text-slate-900">{item.title}</p>
                      <p className="text-sm text-slate-500 mt-1">{item.description}</p>
                    </div>
                  </button>
                );

                return item.link ? (
                  <Link key={itemIdx} to={createPageUrl(item.link)}>
                    {content}
                  </Link>
                ) : (
                  <div key={itemIdx}>{content}</div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}