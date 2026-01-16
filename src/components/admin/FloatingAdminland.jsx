import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../../utils';
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
  Tag,
  X
} from 'lucide-react';
import { Button } from "@/components/ui/button";

export default function FloatingAdminland() {
  const [user, setUser] = useState(null);
  const [isOpen, setIsOpen] = useState(false);

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
    return null;
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
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-purple-500 hover:bg-purple-600 text-white shadow-lg flex items-center justify-center z-50 transition-all"
      >
        <Shield className="w-6 h-6" />
      </button>

      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sliding Panel */}
      <div
        className={`fixed top-0 right-0 h-full w-[480px] bg-white shadow-2xl z-50 transform transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-slate-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500 flex items-center justify-center">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">Adminland</h2>
                <p className="text-sm text-slate-600">Workspace settings</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsOpen(false)}
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {sections.map((section, sectionIdx) => (
              <div key={sectionIdx}>
                <h3 className="text-sm font-semibold text-slate-900 mb-3 uppercase tracking-wide">
                  {section.title}
                </h3>
                <div className="space-y-2">
                  {section.items.map((item, itemIdx) => {
                    const Icon = item.icon;
                    const content = (
                      <button
                        onClick={() => {
                          if (item.action) item.action();
                          if (item.link) setIsOpen(false);
                        }}
                        className="w-full flex items-center gap-4 p-3 rounded-lg hover:bg-slate-50 transition-colors text-left group"
                      >
                        <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0 group-hover:bg-purple-100 transition-colors">
                          <Icon className="w-5 h-5 text-purple-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-900 text-sm">{item.title}</p>
                          <p className="text-xs text-slate-500">{item.description}</p>
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
      </div>
    </>
  );
}