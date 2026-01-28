import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import Breadcrumbs from '../components/ui/breadcrumbs';
import UserAssignmentPanel from '../components/admin/UserAssignmentPanel';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from 'sonner';

import {
  Shield,
  Users,
  FileText,
  Mail,
  MessageSquare,
  Link2,
  UserPlus,
  ChevronRight,
  AlertTriangle,
  Image,
  Upload,
  Palette,
  Save
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
    title: 'Settings',
    items: [
      {
        name: 'Portal Branding',
        description: 'Logo, colors, and appearance',
        icon: Palette,
        panel: 'portal-branding'
      },
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
  const queryClient = useQueryClient();

  // Portal Settings state
  const [portalName, setPortalName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [logoDarkUrl, setLogoDarkUrl] = useState('');
  const [showLogoAlways, setShowLogoAlways] = useState(false);
  const [primaryColor, setPrimaryColor] = useState('#8b5cf6');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

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

  // Fetch portal settings
  const { data: portalSettings = [] } = useQuery({
    queryKey: ['portal_settings'],
    queryFn: () => base44.entities.PortalSettings.list(),
    enabled: user?.role === 'admin'
  });

  // Load settings into state when fetched
  useEffect(() => {
    if (portalSettings.length > 0) {
      const settings = portalSettings[0];
      setPortalName(settings.portal_name || '');
      setLogoUrl(settings.logo_url || '');
      setLogoDarkUrl(settings.logo_dark_url || '');
      setShowLogoAlways(settings.show_logo_always || false);
      setPrimaryColor(settings.primary_color || '#8b5cf6');
    }
  }, [portalSettings]);

  const handleLogoUpload = async (e, type) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      if (type === 'light') {
        setLogoUrl(file_url);
      } else {
        setLogoDarkUrl(file_url);
      }
      toast.success('Logo uploaded!');
    } catch (error) {
      toast.error('Failed to upload logo');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSavePortalSettings = async () => {
    setIsSaving(true);
    try {
      const data = {
        portal_name: portalName,
        logo_url: logoUrl,
        logo_dark_url: logoDarkUrl,
        show_logo_always: showLogoAlways,
        primary_color: primaryColor
      };

      if (portalSettings.length > 0) {
        await base44.entities.PortalSettings.update(portalSettings[0].id, data);
      } else {
        await base44.entities.PortalSettings.create(data);
      }
      
      queryClient.invalidateQueries({ queryKey: ['portal_settings'] });
      toast.success('Portal settings saved!');
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };



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

  if (activePanel === 'portal-branding') {
    return (
      <div className="max-w-3xl mx-auto py-8">
        <Breadcrumbs items={[
          { label: 'Adminland', href: createPageUrl('Adminland') },
          { label: 'Portal Branding' }
        ]} />
        
        <div className="flex items-center gap-4 mb-8">
          <button 
            onClick={() => setActivePanel(null)}
            className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-slate-600 rotate-180" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Portal Branding</h1>
            <p className="text-sm text-slate-500">Customize your portal's appearance</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6">
          {/* Portal Name */}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-2 block">Portal Name</label>
            <Input
              value={portalName}
              onChange={(e) => setPortalName(e.target.value)}
              placeholder="PortalIT"
            />
          </div>

          {/* Logo Upload - Light */}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-2 block">Logo (Light Background)</label>
            <div className="flex items-start gap-4">
              <div className="w-32 h-20 rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center bg-slate-50 overflow-hidden">
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo" className="max-w-full max-h-full object-contain p-2" />
                ) : (
                  <Image className="w-8 h-8 text-slate-300" />
                )}
              </div>
              <div className="flex-1">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleLogoUpload(e, 'light')}
                  className="hidden"
                  id="logo-upload-light"
                />
                <label htmlFor="logo-upload-light">
                  <Button variant="outline" className="gap-2" asChild disabled={isUploading}>
                    <span>
                      <Upload className="w-4 h-4" />
                      {isUploading ? 'Uploading...' : 'Upload Logo'}
                    </span>
                  </Button>
                </label>
                <p className="text-xs text-slate-500 mt-2">Recommended: PNG with transparent background, 200x60px</p>
                {logoUrl && (
                  <Input
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    placeholder="Or paste URL"
                    className="mt-2"
                  />
                )}
              </div>
            </div>
          </div>

          {/* Logo Upload - Dark */}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-2 block">Logo (Dark Background)</label>
            <div className="flex items-start gap-4">
              <div className="w-32 h-20 rounded-xl border-2 border-dashed border-slate-700 flex items-center justify-center bg-slate-800 overflow-hidden">
                {logoDarkUrl ? (
                  <img src={logoDarkUrl} alt="Logo Dark" className="max-w-full max-h-full object-contain p-2" />
                ) : logoUrl ? (
                  <img src={logoUrl} alt="Logo" className="max-w-full max-h-full object-contain p-2" />
                ) : (
                  <Image className="w-8 h-8 text-slate-500" />
                )}
              </div>
              <div className="flex-1">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleLogoUpload(e, 'dark')}
                  className="hidden"
                  id="logo-upload-dark"
                />
                <label htmlFor="logo-upload-dark">
                  <Button variant="outline" className="gap-2" asChild disabled={isUploading}>
                    <span>
                      <Upload className="w-4 h-4" />
                      {isUploading ? 'Uploading...' : 'Upload Dark Logo'}
                    </span>
                  </Button>
                </label>
                <p className="text-xs text-slate-500 mt-2">Optional: Use if your main logo doesn't work on dark backgrounds</p>
                {logoDarkUrl && (
                  <Input
                    value={logoDarkUrl}
                    onChange={(e) => setLogoDarkUrl(e.target.value)}
                    placeholder="Or paste URL"
                    className="mt-2"
                  />
                )}
              </div>
            </div>
          </div>

          {/* Show Logo Always Toggle */}
          <div className="flex items-center justify-between py-4 border-t border-slate-100">
            <div>
              <p className="font-medium text-slate-900">Always Show Logo</p>
              <p className="text-sm text-slate-500">Display logo in header instead of icon</p>
            </div>
            <Switch
              checked={showLogoAlways}
              onCheckedChange={setShowLogoAlways}
            />
          </div>

          {/* Primary Color */}
          <div className="pt-4 border-t border-slate-100">
            <label className="text-sm font-medium text-slate-700 mb-2 block">Primary Color</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="w-12 h-10 rounded-lg border border-slate-200 cursor-pointer"
              />
              <Input
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                placeholder="#8b5cf6"
                className="w-32"
              />
              <div 
                className="px-4 py-2 rounded-lg text-white text-sm font-medium"
                style={{ backgroundColor: primaryColor }}
              >
                Preview
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="pt-4 border-t border-slate-100">
            <Button 
              onClick={handleSavePortalSettings}
              disabled={isSaving}
              className="gap-2"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Saving...' : 'Save Settings'}
            </Button>
          </div>
        </div>
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