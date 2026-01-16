import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../../utils';
import {
  Shield,
  X,
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export default function Adminland() {
  const [isOpen, setIsOpen] = useState(false);
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
          link: 'Contracts'
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
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-3 px-5 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 group"
      >
        <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center">
          <Shield className="w-4 h-4 text-white" />
        </div>
        <span className="font-semibold">Adminland</span>
      </button>

      {/* Admin Panel Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-hidden p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500 flex items-center justify-center">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-2xl">Adminland</DialogTitle>
                <p className="text-sm text-slate-500 font-normal">Manage your workspace settings</p>
              </div>
            </div>
          </DialogHeader>

          <div className="px-6 pb-6 overflow-y-auto max-h-[calc(85vh-120px)]">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
              {sections.map((section, sectionIdx) => (
                <div key={sectionIdx} className="bg-white rounded-xl border border-slate-200">
                  <div className="px-4 py-3 border-b border-slate-100">
                    <h3 className="font-semibold text-slate-900">{section.title}</h3>
                  </div>
                  <div className="p-2">
                    {section.items.map((item, itemIdx) => {
                      const Icon = item.icon;
                      const content = (
                        <button
                          onClick={() => {
                            if (item.link) {
                              setIsOpen(false);
                            } else if (item.action) {
                              item.action();
                            }
                          }}
                          className="w-full flex items-start gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors text-left group"
                        >
                          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-100 transition-colors">
                            <Icon className="w-5 h-5 text-blue-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-slate-900 text-sm">{item.title}</p>
                            <p className="text-xs text-slate-500 mt-0.5">{item.description}</p>
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
        </DialogContent>
      </Dialog>
    </>
  );
}