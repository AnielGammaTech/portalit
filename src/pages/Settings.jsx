import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import Breadcrumbs from '../components/ui/breadcrumbs';
import { 
  Settings as SettingsIcon,
  User,
  Building2,
  Bell,
  Shield,
  Key,
  Save,
  Mail,
  Link2,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import DattoRMMConfig from '../components/integrations/DattoRMMConfig';
import JumpCloudConfig from '../components/integrations/JumpCloudConfig';
import SpanningConfig from '../components/integrations/SpanningConfig';

function IntegrationSection({ title, description, children }) {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <Card>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full text-left"
      >
        <CardHeader className="flex flex-row items-center justify-between py-4">
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription className="text-sm mt-1">
              {description}
            </CardDescription>
          </div>
          {isOpen ? (
            <ChevronDown className="w-5 h-5 text-slate-400" />
          ) : (
            <ChevronRight className="w-5 h-5 text-slate-400" />
          )}
        </CardHeader>
      </button>
      {isOpen && (
        <CardContent className="pt-0 border-t border-slate-100">
          {children}
        </CardContent>
      )}
    </Card>
  );
}

export default function Settings() {
  const [user, setUser] = useState(null);
  const [companySettings, setCompanySettings] = useState({
    company_name: '',
    company_email: '',
    company_phone: '',
    company_address: ''
  });

  useEffect(() => {
    const loadUser = async () => {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      if (currentUser) {
        setCompanySettings({
          company_name: currentUser.company_name || '',
          company_email: currentUser.company_email || '',
          company_phone: currentUser.company_phone || '',
          company_address: currentUser.company_address || ''
        });
      }
    };
    loadUser();
  }, []);

  const handleSaveCompany = async () => {
    await base44.auth.updateMe(companySettings);
    toast.success('Company settings saved');
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <Breadcrumbs items={[{ label: 'Settings' }]} />
      
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Settings</h1>
        <p className="text-slate-500 mt-1">Manage your account and application settings</p>
      </div>

      <Tabs defaultValue="company" className="space-y-6">
        <TabsList className="bg-white border border-slate-200/50">
          <TabsTrigger value="company" className="gap-2">
            <Building2 className="w-4 h-4" />
            Company
          </TabsTrigger>
          <TabsTrigger value="profile" className="gap-2">
            <User className="w-4 h-4" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="integrations" className="gap-2">
            <Link2 className="w-4 h-4" />
            Integrations
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="w-4 h-4" />
            Notifications
          </TabsTrigger>
        </TabsList>

        <TabsContent value="company">
          <Card>
            <CardHeader>
              <CardTitle>Company Information</CardTitle>
              <CardDescription>
                Update your company details displayed across the portal
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="company_name">Company Name</Label>
                  <Input
                    id="company_name"
                    value={companySettings.company_name}
                    onChange={(e) => setCompanySettings({ ...companySettings, company_name: e.target.value })}
                    placeholder="Your MSP Company"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company_email">Company Email</Label>
                  <Input
                    id="company_email"
                    type="email"
                    value={companySettings.company_email}
                    onChange={(e) => setCompanySettings({ ...companySettings, company_email: e.target.value })}
                    placeholder="support@yourcompany.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company_phone">Phone</Label>
                  <Input
                    id="company_phone"
                    value={companySettings.company_phone}
                    onChange={(e) => setCompanySettings({ ...companySettings, company_phone: e.target.value })}
                    placeholder="+1 (555) 123-4567"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company_address">Address</Label>
                  <Input
                    id="company_address"
                    value={companySettings.company_address}
                    onChange={(e) => setCompanySettings({ ...companySettings, company_address: e.target.value })}
                    placeholder="123 Business St, City, State"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={handleSaveCompany} className="gap-2">
                  <Save className="w-4 h-4" />
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Profile Settings</CardTitle>
              <CardDescription>
                Manage your personal account settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {user && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Full Name</Label>
                    <Input value={user.full_name || ''} disabled />
                    <p className="text-xs text-slate-500">Contact admin to change</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input value={user.email || ''} disabled />
                    <p className="text-xs text-slate-500">Contact admin to change</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Role</Label>
                    <Input value={user.role || 'user'} disabled className="capitalize" />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integrations">
          <div className="space-y-4">
            <IntegrationSection
              title="Datto RMM"
              description="Connect your Datto RMM account to sync devices"
            >
              <DattoRMMConfig />
            </IntegrationSection>

            <IntegrationSection
              title="JumpCloud"
              description="Connect JumpCloud to automatically sync SSO applications as SaaS licenses for your customers"
            >
              <JumpCloudConfig />
            </IntegrationSection>

            <IntegrationSection
              title="Unitrends"
              description="Connect to Unitrends MSP to sync backup data and users"
            >
              <SpanningConfig />
            </IntegrationSection>
          </div>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>
                Configure how you receive notifications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <Mail className="w-5 h-5 text-slate-500" />
                    <div>
                      <p className="font-medium text-slate-900">Contract Renewals</p>
                      <p className="text-sm text-slate-500">Get notified when contracts are expiring</p>
                    </div>
                  </div>
                  <Switch defaultChecked />
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <Mail className="w-5 h-5 text-slate-500" />
                    <div>
                      <p className="font-medium text-slate-900">License Alerts</p>
                      <p className="text-sm text-slate-500">Alerts for license utilization issues</p>
                    </div>
                  </div>
                  <Switch defaultChecked />
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <Mail className="w-5 h-5 text-slate-500" />
                    <div>
                      <p className="font-medium text-slate-900">Sync Status</p>
                      <p className="text-sm text-slate-500">Notifications for sync failures</p>
                    </div>
                  </div>
                  <Switch />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}