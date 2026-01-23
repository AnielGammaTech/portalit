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
  ChevronRight,
  Monitor,
  Cloud,
  Database
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import DattoRMMConfig from '../components/integrations/DattoRMMConfig';
import JumpCloudConfig from '../components/integrations/JumpCloudConfig';
import SpanningConfig from '../components/integrations/SpanningConfig';

function IntegrationsPanel() {
  const { data: dattoMappings = [] } = useQuery({
    queryKey: ['datto_mappings'],
    queryFn: () => base44.entities.DattoSiteMapping.list(),
  });
  
  const { data: jumpcloudMappings = [] } = useQuery({
    queryKey: ['jumpcloud_mappings'],
    queryFn: () => base44.entities.JumpCloudMapping.list(),
  });
  
  const { data: spanningMappings = [] } = useQuery({
    queryKey: ['spanning_mappings'],
    queryFn: () => base44.entities.SpanningMapping.list(),
  });

  const dattoMapped = dattoMappings.length;
  const jumpcloudMapped = jumpcloudMappings.length;
  const spanningMapped = spanningMappings.length;

  return (
    <div className="space-y-4">
      {/* Datto RMM */}
      <IntegrationCard
        icon={Monitor}
        iconBg="bg-blue-50"
        title="Datto RMM"
        description="Sync devices and map Datto sites to customers"
        status={
          dattoMapped > 0 ? (
            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">{dattoMapped} mapped</Badge>
          ) : (
            <Badge variant="outline" className="text-slate-500">Not configured</Badge>
          )
        }
      >
        <DattoRMMConfig />
      </IntegrationCard>

      {/* JumpCloud */}
      <IntegrationCard
        icon={Cloud}
        iconBg="bg-green-50"
        title="JumpCloud"
        description="Sync SSO applications and users from JumpCloud"
        status={
          jumpcloudMapped > 0 ? (
            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">{jumpcloudMapped} mapped</Badge>
          ) : (
            <Badge variant="outline" className="text-slate-500">Not configured</Badge>
          )
        }
      >
        <JumpCloudConfig />
      </IntegrationCard>

      {/* Unitrends */}
      <IntegrationCard
        icon={Database}
        iconBg="bg-purple-50"
        title="Unitrends"
        description="Sync backup data and users from Unitrends MSP"
        status={
          spanningMapped > 0 ? (
            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">{spanningMapped} mapped</Badge>
          ) : (
            <Badge variant="outline" className="text-slate-500">Not configured</Badge>
          )
        }
      >
        <SpanningConfig />
      </IntegrationCard>
    </div>
  );
}

function IntegrationCard({ icon: Icon, iconBg, title, description, status, children }) {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full text-left px-5 py-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors"
      >
        <div className="flex items-center gap-4">
          <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", iconBg || "bg-slate-100")}>
            <Icon className="w-5 h-5 text-slate-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-slate-900">{title}</h3>
              <ChevronDown className={cn("w-4 h-4 text-slate-400 transition-transform", isOpen && "rotate-180")} />
            </div>
            <p className="text-sm text-slate-500">{description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
          {status}
        </div>
      </button>
      {isOpen && (
        <div className="px-5 pb-5 pt-2 border-t border-slate-100">
          {children}
        </div>
      )}
    </div>
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

  // Get tab from URL params
  const urlParams = new URLSearchParams(window.location.search);
  const defaultTab = urlParams.get('tab') || 'company';

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

      <Tabs defaultValue={defaultTab} className="space-y-6">
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
          <IntegrationsPanel />
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