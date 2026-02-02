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
  Database,
  Copy,
  RefreshCw,
  Zap
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
import DarkWebIDConfig from '../components/integrations/DarkWebIDConfig';
import BullPhishIDConfig from '../components/integrations/BullPhishIDConfig';
import DattoEDRConfig from '../components/integrations/DattoEDRConfig';
import { AlertTriangle, Fish } from 'lucide-react';

function GammaStackITPanel() {
  const [apiKey, setApiKey] = useState('');
  const [generating, setGenerating] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);

  // Load existing API key from user data
  useEffect(() => {
    const loadApiKey = async () => {
      const user = await base44.auth.me();
      if (user?.gammastack_api_key) {
        setApiKey(user.gammastack_api_key);
      }
    };
    loadApiKey();
  }, []);

  const generateApiKey = async () => {
    setGenerating(true);
    try {
      // Generate a random API key
      const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
      let key = 'gs_';
      for (let i = 0; i < 32; i++) {
        key += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      
      // Save to user data
      await base44.auth.updateMe({ gammastack_api_key: key });
      setApiKey(key);
      toast.success('New API key generated!');
    } catch (error) {
      toast.error('Failed to generate API key');
    } finally {
      setGenerating(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  const appBaseUrl = window.location.origin;
  const fullEndpoint = `${appBaseUrl}/api/functions/getCustomerData`;

  return (
    <div className="space-y-4">
      {/* External API Access Card */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full text-left px-5 py-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors"
        >
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center">
              <Zap className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-medium text-slate-900">External API Access</h3>
                <ChevronDown className={cn("w-4 h-4 text-slate-400 transition-transform", isExpanded && "rotate-180")} />
              </div>
              <p className="text-sm text-slate-500">Generate a key to allow other apps (like ProjectIT) to access data from this application</p>
            </div>
          </div>
        </button>

        {isExpanded && (
          <div className="px-5 pb-5 pt-2 border-t border-slate-100 space-y-6">
            {/* API Key Section */}
            <div>
              <Label className="text-sm font-medium text-slate-700 mb-2 block">This Application's API Key</Label>
              <div className="flex items-center gap-3">
                <div className="flex-1 relative">
                  <Input
                    value={apiKey || 'No API key generated yet'}
                    readOnly
                    className="pr-10 font-mono text-sm bg-slate-50"
                  />
                  {apiKey && (
                    <button
                      onClick={() => copyToClipboard(apiKey)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 hover:bg-slate-200 rounded transition-colors"
                    >
                      <Copy className="w-4 h-4 text-slate-500" />
                    </button>
                  )}
                </div>
                <Button
                  onClick={generateApiKey}
                  disabled={generating}
                  className="bg-orange-500 hover:bg-orange-600 text-white gap-2"
                >
                  <RefreshCw className={cn("w-4 h-4", generating && "animate-spin")} />
                  Generate New Key
                </Button>
              </div>
            </div>

            {/* Endpoint Info */}
            {apiKey && (
              <div className="bg-slate-50 rounded-xl p-4 space-y-4">
                <h4 className="font-medium text-slate-900">Get Customer Data</h4>
                
                <div>
                  <p className="text-xs font-medium text-orange-600 uppercase tracking-wide mb-1">App Base URL</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
                      <span className="text-orange-600 font-mono text-sm">{appBaseUrl}</span>
                    </div>
                    <button
                      onClick={() => copyToClipboard(appBaseUrl)}
                      className="p-2 hover:bg-slate-200 rounded-lg transition-colors border border-slate-200"
                    >
                      <Copy className="w-4 h-4 text-slate-500" />
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">👈 Use this for "PortalIT Base44 App URL" in ProjectIT</p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-slate-200" />
                  <span className="text-xs text-slate-400 uppercase">or full endpoint</span>
                  <div className="flex-1 h-px bg-slate-200" />
                </div>

                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Full Endpoint URL</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 overflow-hidden">
                      <span className="text-slate-600 font-mono text-sm truncate block">{fullEndpoint}</span>
                    </div>
                    <button
                      onClick={() => copyToClipboard(fullEndpoint)}
                      className="p-2 hover:bg-slate-200 rounded-lg transition-colors border border-slate-200"
                    >
                      <Copy className="w-4 h-4 text-slate-500" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-6 text-sm">
                  <div>
                    <span className="text-slate-500 uppercase text-xs font-medium">Method</span>
                    <p className="font-semibold text-slate-900">GET</p>
                  </div>
                  <div>
                    <span className="text-slate-500 uppercase text-xs font-medium">Auth Header</span>
                    <p className="font-mono text-slate-900">x-gammastack-key</p>
                  </div>
                </div>

                <p className="text-sm text-slate-500">
                  Authentication: Include header <code className="bg-slate-200 px-1.5 py-0.5 rounded text-slate-700">x-gammastack-key: YOUR_KEY</code>
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

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

  const { data: edrMappings = [] } = useQuery({
    queryKey: ['edr_mappings'],
    queryFn: () => base44.entities.DattoEDRMapping.list(),
  });

  const dattoMapped = dattoMappings.length;
  const jumpcloudMapped = jumpcloudMappings.length;
  const spanningMapped = spanningMappings.length;
  const edrMapped = edrMappings.length;

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

      {/* Dark Web ID */}
      <IntegrationCard
        icon={AlertTriangle}
        iconBg="bg-red-50"
        title="Dark Web ID"
        description="Monitor dark web compromises for your customers"
        status={<Badge variant="outline" className="text-slate-500">Configure</Badge>}
      >
        <DarkWebIDConfig />
      </IntegrationCard>

      {/* BullPhish ID */}
      <IntegrationCard
        icon={Fish}
        iconBg="bg-orange-50"
        title="BullPhish ID"
        description="Upload phishing simulation reports for QBR tracking"
        status={<Badge variant="outline" className="text-slate-500">Upload Reports</Badge>}
      >
        <BullPhishIDConfig />
      </IntegrationCard>

      {/* Datto EDR */}
      <IntegrationCard
        icon={Shield}
        iconBg="bg-cyan-50"
        title="Datto EDR"
        description="Endpoint detection & response - map tenants to customers"
        status={
          edrMapped > 0 ? (
            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">{edrMapped} mapped</Badge>
          ) : (
            <Badge variant="outline" className="text-slate-500">Not configured</Badge>
          )
        }
      >
        <DattoEDRConfig />
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
  const [isLoading, setIsLoading] = useState(true);
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
      setIsLoading(false);
    };
    loadUser();
  }, []);

  const handleSaveCompany = async () => {
    await base44.auth.updateMe(companySettings);
    toast.success('Company settings saved');
  };

  const isAdmin = user?.role === 'admin';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  // Non-admin users should not access this page at all
  if (!isAdmin) {
    return (
      <div className="space-y-6 max-w-4xl">
        <Breadcrumbs items={[{ label: 'Settings' }]} />
        <div className="text-center py-12">
          <Shield className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-900 mb-2">Access Restricted</h2>
          <p className="text-slate-500">This page is only available to administrators.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <Breadcrumbs items={[{ label: 'Settings' }]} />
      
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Settings</h1>
        <p className="text-slate-500 mt-1">Manage your account and application settings</p>
      </div>

      <Tabs defaultValue={defaultTab === 'company' || defaultTab === 'profile' || defaultTab === 'notifications' ? 'integrations' : defaultTab} className="space-y-6">
        <TabsList className="bg-white border border-slate-200/50">
          <TabsTrigger value="integrations" className="gap-2">
            <Link2 className="w-4 h-4" />
            Integrations
          </TabsTrigger>
          <TabsTrigger value="gammastack" className="gap-2">
            <Zap className="w-4 h-4" />
            GammaStackIT
          </TabsTrigger>
        </TabsList>

        <TabsContent value="integrations">
          <IntegrationsPanel />
        </TabsContent>

        <TabsContent value="gammastack">
          <GammaStackITPanel />
        </TabsContent>

      </Tabs>
    </div>
  );
}