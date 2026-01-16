import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { 
  Settings as SettingsIcon,
  User,
  Building2,
  Bell,
  Shield,
  Key,
  Save,
  Mail
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

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
            <Key className="w-4 h-4" />
            API Keys
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
          <Card>
            <CardHeader>
              <CardTitle>API Credentials</CardTitle>
              <CardDescription>
                Configure your integration API keys
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-indigo-100 rounded-lg">
                      <Key className="w-4 h-4 text-indigo-600" />
                    </div>
                    <div>
                      <h4 className="font-medium text-slate-900">HaloPSA API</h4>
                      <p className="text-sm text-slate-500">Connect to your HaloPSA instance</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>API URL</Label>
                      <Input placeholder="https://your-instance.halopsa.com" disabled />
                    </div>
                    <div className="space-y-2">
                      <Label>API Key</Label>
                      <Input type="password" placeholder="••••••••••••••••" disabled />
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-emerald-100 rounded-lg">
                      <Shield className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div>
                      <h4 className="font-medium text-slate-900">Datto RMM API</h4>
                      <p className="text-sm text-slate-500">Connect to Datto RMM</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>API URL</Label>
                      <Input placeholder="https://pinotage-api.centrastage.net" disabled />
                    </div>
                    <div className="space-y-2">
                      <Label>API Key</Label>
                      <Input type="password" placeholder="••••••••••••••••" disabled />
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
                <p className="text-sm text-amber-800">
                  <strong>Note:</strong> API integration configuration is coming soon. 
                  Currently you can manually add data through the app interface.
                </p>
              </div>
            </CardContent>
          </Card>
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