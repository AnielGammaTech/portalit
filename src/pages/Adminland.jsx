import React, { useState, useEffect, useMemo } from 'react';
import { client } from '@/api/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import UserAssignmentPanel from '../components/admin/UserAssignmentPanel';
import FeedbackPanel from '../components/admin/FeedbackPanel';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from 'sonner';
import { cn } from "@/lib/utils";
import { createPageUrl } from '../utils';

import DattoRMMConfig from '../components/integrations/DattoRMMConfig';
import JumpCloudConfig from '../components/integrations/JumpCloudConfig';
import SpanningConfig from '../components/integrations/SpanningConfig';
import DarkWebIDConfig from '../components/integrations/DarkWebIDConfig';
import BullPhishIDConfig from '../components/integrations/BullPhishIDConfig';
import DattoEDRConfig from '../components/integrations/DattoEDRConfig';
import RocketCyberConfig from '../components/integrations/RocketCyberConfig';
import CoveDataConfig from '../components/integrations/CoveDataConfig';

import {
  Shield,
  Users,
  Link2,
  MessageSquare,
  Image,
  Upload,
  Palette,
  Save,
  Code,
  Copy,
  Check,
  Printer,
  Share2,
  AlertTriangle,
  ChevronDown,
  Monitor,
  Cloud,
  Database,
  Fish,
  Rocket,
  HardDrive,
  Zap,
  RefreshCw,
  Settings as SettingsIcon,
  Menu,
  X,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Tab definitions
// ---------------------------------------------------------------------------

const TABS = [
  { id: 'branding',     label: 'Branding',     icon: Palette,        color: 'text-violet-600', bg: 'bg-violet-50' },
  { id: 'users',        label: 'Users',         icon: Users,          color: 'text-blue-600',   bg: 'bg-blue-50' },
  { id: 'integrations', label: 'Integrations',  icon: Link2,          color: 'text-emerald-600', bg: 'bg-emerald-50' },
  { id: 'api',          label: 'API',           icon: Code,           color: 'text-orange-600', bg: 'bg-orange-50' },
  { id: 'feedback',     label: 'Feedback',      icon: MessageSquare,  color: 'text-pink-600',   bg: 'bg-pink-50' },
];

// ---------------------------------------------------------------------------
// IntegrationCard  (collapsible card used in IntegrationsPanel)
// ---------------------------------------------------------------------------

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
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
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

// ---------------------------------------------------------------------------
// IntegrationsPanel
// ---------------------------------------------------------------------------

function IntegrationsPanel() {
  const { data: dattoMappings = [] } = useQuery({
    queryKey: ['datto_mappings'],
    queryFn: () => client.entities.DattoSiteMapping.list(),
  });
  const { data: jumpcloudMappings = [] } = useQuery({
    queryKey: ['jumpcloud_mappings'],
    queryFn: () => client.entities.JumpCloudMapping.list(),
  });
  const { data: spanningMappings = [] } = useQuery({
    queryKey: ['spanning_mappings'],
    queryFn: () => client.entities.SpanningMapping.list(),
  });
  const { data: edrMappings = [] } = useQuery({
    queryKey: ['edr_mappings'],
    queryFn: () => client.entities.DattoEDRMapping.list(),
  });
  const { data: rocketcyberMappings = [] } = useQuery({
    queryKey: ['rocketcyber_mappings'],
    queryFn: () => client.entities.RocketCyberMapping.list(),
  });
  const { data: coveMappings = [] } = useQuery({
    queryKey: ['cove_mappings'],
    queryFn: () => client.entities.CoveDataMapping.list(),
  });

  const dattoMapped = dattoMappings.length;
  const jumpcloudMapped = jumpcloudMappings.length;
  const spanningMapped = spanningMappings.length;
  const edrMapped = edrMappings.length;
  const rocketcyberMapped = rocketcyberMappings.length;
  const coveMapped = coveMappings.length;

  return (
    <div className="space-y-4">
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

      <IntegrationCard
        icon={AlertTriangle}
        iconBg="bg-red-50"
        title="Dark Web ID"
        description="Monitor dark web compromises for your customers"
        status={<Badge variant="outline" className="text-slate-500">Configure</Badge>}
      >
        <DarkWebIDConfig />
      </IntegrationCard>

      <IntegrationCard
        icon={Fish}
        iconBg="bg-orange-50"
        title="BullPhish ID"
        description="Upload phishing simulation reports for QBR tracking"
        status={<Badge variant="outline" className="text-slate-500">Upload Reports</Badge>}
      >
        <BullPhishIDConfig />
      </IntegrationCard>

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

      <IntegrationCard
        icon={Shield}
        iconBg="bg-orange-50"
        title="RocketCyber SOC"
        description="Sync security incidents and alerts from RocketCyber"
        status={
          rocketcyberMapped > 0 ? (
            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">{rocketcyberMapped} mapped</Badge>
          ) : (
            <Badge variant="outline" className="text-slate-500">Not configured</Badge>
          )
        }
      >
        <RocketCyberConfig />
      </IntegrationCard>

      <IntegrationCard
        icon={HardDrive}
        iconBg="bg-teal-50"
        title="Cove Data Protection"
        description="Sync backup devices and status from N-able Cove"
        status={
          coveMapped > 0 ? (
            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">{coveMapped} mapped</Badge>
          ) : (
            <Badge variant="outline" className="text-slate-500">Not configured</Badge>
          )
        }
      >
        <CoveDataConfig />
      </IntegrationCard>
    </div>
  );
}

// ---------------------------------------------------------------------------
// GammaStackITPanel  (External API key management)
// ---------------------------------------------------------------------------

function GammaStackITPanel() {
  const [apiKey, setApiKey] = useState('');
  const [generating, setGenerating] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);

  useEffect(() => {
    const loadApiKey = async () => {
      const user = await client.auth.me();
      if (user?.gammastack_api_key) {
        setApiKey(user.gammastack_api_key);
      }
    };
    loadApiKey();
  }, []);

  const generateApiKey = async () => {
    setGenerating(true);
    try {
      const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
      let key = 'gs_';
      for (let i = 0; i < 32; i++) {
        key += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      await client.auth.updateMe({ gammastack_api_key: key });
      setApiKey(key);
      toast.success('New API key generated!');
    } catch (error) {
      toast.error('Failed to generate API key');
    } finally {
      setGenerating(false);
    }
  };

  const copyText = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  const appBaseUrl = window.location.origin;
  const fullEndpoint = `${appBaseUrl}/api/functions/getCustomerData`;

  return (
    <div className="space-y-4">
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
            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">This Application's API Key</label>
              <div className="flex items-center gap-3">
                <div className="flex-1 relative">
                  <Input
                    value={apiKey || 'No API key generated yet'}
                    readOnly
                    className="pr-10 font-mono text-sm bg-slate-50"
                  />
                  {apiKey && (
                    <button
                      onClick={() => copyText(apiKey)}
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
                      onClick={() => copyText(appBaseUrl)}
                      className="p-2 hover:bg-slate-200 rounded-lg transition-colors border border-slate-200"
                    >
                      <Copy className="w-4 h-4 text-slate-500" />
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Use this for "PortalIT App URL" in ProjectIT</p>
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
                      onClick={() => copyText(fullEndpoint)}
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

// ---------------------------------------------------------------------------
// API_ENDPOINTS constant for the API Docs panel
// ---------------------------------------------------------------------------

const API_ENDPOINTS = [
  {
    id: 'customers',
    method: 'GET',
    entity: 'Customer',
    description: 'List all customers or filter by criteria',
    fields: [
      { name: 'id', type: 'string', description: 'Unique customer ID' },
      { name: 'name', type: 'string', description: 'Customer/company name' },
      { name: 'external_id', type: 'string', description: 'ID from external system (HaloPSA, etc.)' },
      { name: 'source', type: 'enum', description: 'Source system: halopsa, dattormm, manual' },
      { name: 'status', type: 'enum', description: 'Status: active, inactive, suspended' },
      { name: 'primary_contact', type: 'string', description: 'Primary contact name' },
      { name: 'email', type: 'string', description: 'Primary contact email' },
      { name: 'phone', type: 'string', description: 'Phone number' },
      { name: 'total_devices', type: 'number', description: 'Total device count' },
      { name: 'total_users', type: 'number', description: 'Total user count' },
      { name: 'monthly_revenue', type: 'number', description: 'Monthly recurring revenue' },
    ],
    example: '{"name": "Acme Corp"}',
  },
  {
    id: 'saas-licenses',
    method: 'GET',
    entity: 'SaaSLicense',
    description: 'List all SaaS licenses/software for a customer',
    fields: [
      { name: 'id', type: 'string', description: 'Unique license ID' },
      { name: 'customer_id', type: 'string', required: true, description: 'Reference to Customer' },
      { name: 'customer_name', type: 'string', description: 'Customer name for display' },
      { name: 'application_name', type: 'string', description: 'Name of the SaaS application' },
      { name: 'vendor', type: 'string', description: 'Software vendor (Microsoft, Google, etc.)' },
      { name: 'license_type', type: 'string', description: 'Type of license (Business Basic, E3, etc.)' },
      { name: 'management_type', type: 'enum', description: 'managed = company-wide, per_user = individual' },
      { name: 'quantity', type: 'number', description: 'Number of seats (for managed licenses)' },
      { name: 'assigned_users', type: 'number', description: 'Number of licenses currently assigned' },
      { name: 'cost_per_license', type: 'number', description: 'Monthly cost per license/seat' },
      { name: 'total_cost', type: 'number', description: 'Total monthly cost' },
      { name: 'billing_cycle', type: 'enum', description: 'monthly or annually' },
      { name: 'renewal_date', type: 'date', description: 'License renewal date' },
      { name: 'status', type: 'enum', description: 'active, suspended, cancelled, pending' },
      { name: 'source', type: 'enum', description: 'halopsa, dattormm, csp, manual, jumpcloud, spanning' },
      { name: 'category', type: 'enum', description: 'productivity, security, collaboration, crm, etc.' },
    ],
    example: '{"customer_id": "abc123"}',
  },
  {
    id: 'license-assignments',
    method: 'GET',
    entity: 'LicenseAssignment',
    description: 'List which users are assigned to which licenses',
    fields: [
      { name: 'id', type: 'string', description: 'Unique assignment ID' },
      { name: 'license_id', type: 'string', required: true, description: 'Reference to SaaSLicense' },
      { name: 'contact_id', type: 'string', required: true, description: 'Reference to Contact (assigned user)' },
      { name: 'customer_id', type: 'string', required: true, description: 'Reference to Customer' },
      { name: 'assigned_date', type: 'date', description: 'Date license was assigned' },
      { name: 'status', type: 'enum', description: 'active, suspended, revoked' },
      { name: 'renewal_date', type: 'date', description: 'Individual renewal date for per-user licenses' },
      { name: 'cost_per_license', type: 'number', description: 'Individual cost for per-user licenses' },
      { name: 'license_type', type: 'string', description: 'License type (Pro, Basic, etc.)' },
    ],
    example: '{"customer_id": "abc123"}',
  },
  {
    id: 'contacts',
    method: 'GET',
    entity: 'Contact',
    description: 'List all contacts/users for a customer',
    fields: [
      { name: 'id', type: 'string', description: 'Unique contact ID' },
      { name: 'customer_id', type: 'string', required: true, description: 'Reference to Customer' },
      { name: 'full_name', type: 'string', description: 'Contact full name' },
      { name: 'email', type: 'string', description: 'Email address' },
      { name: 'phone', type: 'string', description: 'Phone number' },
      { name: 'title', type: 'string', description: 'Job title' },
      { name: 'is_primary', type: 'boolean', description: 'Primary contact flag' },
      { name: 'source', type: 'enum', description: 'halopsa, jumpcloud, spanning, manual' },
      { name: 'jumpcloud_id', type: 'string', description: 'JumpCloud user ID' },
      { name: 'jumpcloud_status', type: 'string', description: 'JumpCloud user status info' },
      { name: 'spanning_status', type: 'string', description: 'Spanning backup status and storage info' },
    ],
    example: '{"customer_id": "abc123"}',
  },
  {
    id: 'devices',
    method: 'GET',
    entity: 'Device',
    description: 'List all devices for a customer',
    fields: [
      { name: 'id', type: 'string', description: 'Unique device ID' },
      { name: 'customer_id', type: 'string', required: true, description: 'Reference to Customer' },
      { name: 'datto_id', type: 'string', description: 'Device ID from Datto RMM' },
      { name: 'hostname', type: 'string', description: 'Device hostname' },
      { name: 'device_type', type: 'enum', description: 'desktop, laptop, server, network, printer, other' },
      { name: 'os', type: 'string', description: 'Operating system' },
      { name: 'os_version', type: 'string', description: 'OS version' },
      { name: 'manufacturer', type: 'string', description: 'Hardware manufacturer' },
      { name: 'model', type: 'string', description: 'Hardware model' },
      { name: 'serial_number', type: 'string', description: 'Serial number' },
      { name: 'ip_address', type: 'string', description: 'IP address' },
      { name: 'mac_address', type: 'string', description: 'MAC address' },
      { name: 'last_seen', type: 'datetime', description: 'Last seen timestamp' },
      { name: 'last_user', type: 'string', description: 'Last logged in user' },
      { name: 'status', type: 'enum', description: 'online, offline, unknown' },
      { name: 'assigned_contact_id', type: 'string', description: 'Reference to assigned Contact' },
    ],
    example: '{"customer_id": "abc123"}',
  },
  {
    id: 'applications',
    method: 'GET',
    entity: 'Application',
    description: 'List all applications for a customer',
    fields: [
      { name: 'id', type: 'string', description: 'Unique application ID' },
      { name: 'customer_id', type: 'string', required: true, description: 'Reference to Customer' },
      { name: 'name', type: 'string', description: 'Application name' },
      { name: 'vendor', type: 'string', description: 'Vendor name' },
      { name: 'category', type: 'enum', description: 'productivity, security, backup, collaboration, etc.' },
      { name: 'logo_url', type: 'string', description: 'Logo URL' },
      { name: 'website_url', type: 'string', description: 'Website URL' },
      { name: 'status', type: 'enum', description: 'active, inactive' },
    ],
    example: '{"customer_id": "abc123"}',
  },
];

// ---------------------------------------------------------------------------
// ApiDocsPanel
// ---------------------------------------------------------------------------

function ApiDocsPanel() {
  const [copiedEndpoint, setCopiedEndpoint] = useState(null);

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedEndpoint(id);
    setTimeout(() => setCopiedEndpoint(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Authentication Section */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5 text-blue-600" />
          Authentication
        </h2>
        <p className="text-sm text-slate-600 mb-4">
          All API requests require authentication via Bearer token in the Authorization header.
        </p>
        <div className="bg-slate-900 rounded-xl p-4 font-mono text-sm text-green-400">
          <p>Authorization: Bearer YOUR_API_KEY</p>
        </div>
        <p className="text-xs text-slate-500 mt-3">
          Contact your administrator to obtain an API key for external integrations.
        </p>
      </div>

      {/* Base URL */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Base URL</h2>
        <div className="bg-slate-900 rounded-xl p-4 font-mono text-sm text-green-400 flex items-center justify-between">
          <span>GET /api/entities/{'{EntityName}'}</span>
          <button
            onClick={() => copyToClipboard('/api/entities/{EntityName}', 'base')}
            className="p-1 hover:bg-slate-700 rounded"
          >
            {copiedEndpoint === 'base' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4 text-slate-400" />}
          </button>
        </div>
        <p className="text-xs text-slate-500 mt-3">
          Use query parameters to filter results: <code className="bg-slate-100 px-1 rounded">?query={'{...}'}</code>
        </p>
      </div>

      {/* Endpoints */}
      {API_ENDPOINTS.map((endpoint) => (
        <div key={endpoint.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100">
            <div className="flex items-center gap-3 mb-2">
              <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-bold rounded">
                {endpoint.method}
              </span>
              <code className="text-sm font-mono text-slate-700">/api/entities/{endpoint.entity}</code>
              <button
                onClick={() => copyToClipboard(`/api/entities/${endpoint.entity}`, endpoint.id)}
                className="p-1 hover:bg-slate-100 rounded"
              >
                {copiedEndpoint === endpoint.id ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 text-slate-400" />}
              </button>
            </div>
            <p className="text-sm text-slate-600">{endpoint.description}</p>
          </div>

          <div className="p-6">
            <h4 className="text-sm font-semibold text-slate-900 mb-3">Response Fields</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left py-2 px-3 font-medium text-slate-600">Field</th>
                    <th className="text-left py-2 px-3 font-medium text-slate-600">Type</th>
                    <th className="text-left py-2 px-3 font-medium text-slate-600">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {endpoint.fields.map((field) => (
                    <tr key={field.name} className="hover:bg-slate-50">
                      <td className="py-2 px-3">
                        <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded text-purple-700">
                          {field.name}
                        </code>
                        {field.required && <span className="text-red-500 text-xs ml-1">*</span>}
                      </td>
                      <td className="py-2 px-3 text-slate-500 text-xs">{field.type}</td>
                      <td className="py-2 px-3 text-slate-600">{field.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4">
              <h4 className="text-sm font-semibold text-slate-900 mb-2">Example Query</h4>
              <div className="bg-slate-900 rounded-xl p-4 font-mono text-xs text-green-400">
                GET /api/entities/{endpoint.entity}?query={endpoint.example}
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* GammaStackIT External API Key */}
      <div className="pt-2">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">External API Key</h2>
        <GammaStackITPanel />
      </div>

      {/* Usage Notes */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
        <h3 className="font-semibold text-amber-900 mb-2 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          Usage Notes
        </h3>
        <ul className="text-sm text-amber-800 space-y-2">
          <li>Always filter by <code className="bg-amber-100 px-1 rounded">customer_id</code> when querying customer-specific data</li>
          <li>Use pagination for large datasets: <code className="bg-amber-100 px-1 rounded">?limit=50&skip=0</code></li>
          <li>Sort results: <code className="bg-amber-100 px-1 rounded">?sort={'{"-created_date"}'}</code></li>
          <li>All dates are returned in ISO 8601 format (UTC)</li>
          <li>Rate limiting: 100 requests per minute per API key</li>
        </ul>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// BrandingPanel
// ---------------------------------------------------------------------------

function BrandingPanel() {
  const queryClient = useQueryClient();
  const [portalName, setPortalName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [logoDarkUrl, setLogoDarkUrl] = useState('');
  const [showLogoAlways, setShowLogoAlways] = useState(false);
  const [primaryColor, setPrimaryColor] = useState('#8b5cf6');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const { data: portalSettings = [] } = useQuery({
    queryKey: ['portal_settings'],
    queryFn: () => client.entities.PortalSettings.list(),
  });

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
      const { file_url } = await client.integrations.Core.UploadFile({ file });
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

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const data = {
        portal_name: portalName,
        logo_url: logoUrl,
        logo_dark_url: logoDarkUrl,
        show_logo_always: showLogoAlways,
        primary_color: primaryColor,
      };

      if (portalSettings.length > 0) {
        await client.entities.PortalSettings.update(portalSettings[0].id, data);
      } else {
        await client.entities.PortalSettings.create(data);
      }

      queryClient.invalidateQueries({ queryKey: ['portal_settings'] });
      toast.success('Portal settings saved!');
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
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
            onClick={handleSave}
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

// ---------------------------------------------------------------------------
// Main Adminland component
// ---------------------------------------------------------------------------

export default function Adminland() {
  const [user, setUser] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const activeTab = searchParams.get('tab') || 'branding';

  const setActiveTab = (tabId) => {
    setSearchParams({ tab: tabId }, { replace: true });
    setMobileMenuOpen(false);
  };

  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await client.auth.me();
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

  // Handle legacy panel= param migration
  useEffect(() => {
    const panel = searchParams.get('panel');
    if (panel) {
      const mapping = {
        'portal-branding': 'branding',
        'user-access': 'users',
        'customer-feedback': 'feedback',
        'api-docs': 'api',
      };
      const mapped = mapping[panel] || panel;
      setSearchParams({ tab: mapped }, { replace: true });
    }
  }, []);

  const currentTab = useMemo(
    () => TABS.find((t) => t.id === activeTab) || TABS[0],
    [activeTab]
  );

  if (!user || user?.role !== 'admin') {
    return null;
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'branding':
        return <BrandingPanel />;
      case 'users':
        return (
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <UserAssignmentPanel />
          </div>
        );
      case 'integrations':
        return <IntegrationsPanel />;
      case 'api':
        return <ApiDocsPanel />;
      case 'feedback':
        return (
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <FeedbackPanel />
          </div>
        );
      default:
        return <BrandingPanel />;
    }
  };

  return (
    <div className="max-w-6xl mx-auto py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <SettingsIcon className="w-6 h-6 text-slate-400" />
          <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        </div>
        <p className="text-sm text-slate-500 ml-9">Manage your workspace, integrations, and portal appearance</p>
      </div>

      {/* Mobile tab selector */}
      <div className="md:hidden mb-6">
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="w-full flex items-center justify-between px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-900"
        >
          <span className="flex items-center gap-2">
            <currentTab.icon className={cn("w-4 h-4", currentTab.color)} />
            {currentTab.label}
          </span>
          {mobileMenuOpen ? <X className="w-4 h-4 text-slate-400" /> : <Menu className="w-4 h-4 text-slate-400" />}
        </button>

        {mobileMenuOpen && (
          <div className="mt-2 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-lg">
            {TABS.map((tab) => {
              const TabIcon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors text-left",
                    isActive
                      ? "bg-slate-50 text-slate-900"
                      : "text-slate-600 hover:bg-slate-50"
                  )}
                >
                  <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", isActive ? tab.bg : "bg-slate-100")}>
                    <TabIcon className={cn("w-4 h-4", isActive ? tab.color : "text-slate-400")} />
                  </div>
                  {tab.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Desktop: sidebar + content */}
      <div className="flex gap-8">
        {/* Sidebar - hidden on mobile */}
        <nav className="hidden md:flex flex-col w-52 flex-shrink-0">
          <div className="bg-white border border-slate-200 rounded-2xl p-2 sticky top-24">
            {TABS.map((tab) => {
              const TabIcon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors text-left mb-0.5",
                    isActive
                      ? "bg-slate-900 text-white"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  )}
                >
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                    isActive ? "bg-white/10" : tab.bg
                  )}>
                    <TabIcon className={cn("w-4 h-4", isActive ? "text-white" : tab.color)} />
                  </div>
                  {tab.label}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Content area */}
        <div className="flex-1 min-w-0">
          {/* Tab content header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", currentTab.bg)}>
                <currentTab.icon className={cn("w-5 h-5", currentTab.color)} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{currentTab.label}</h2>
                <p className="text-sm text-slate-500">
                  {activeTab === 'branding' && 'Customize your portal appearance'}
                  {activeTab === 'users' && 'Assign users to customer organizations'}
                  {activeTab === 'integrations' && 'Connect and configure third-party services'}
                  {activeTab === 'api' && 'API documentation and external access keys'}
                  {activeTab === 'feedback' && 'Review and respond to customer feedback'}
                </p>
              </div>
            </div>

            {/* Extra actions for API tab */}
            {activeTab === 'api' && (
              <div className="hidden sm:flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => {
                    const url = `${window.location.origin}${window.location.pathname}?tab=api`;
                    navigator.clipboard.writeText(url);
                    toast.success('Link copied to clipboard');
                  }}
                >
                  <Share2 className="w-4 h-4" />
                  Share Link
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => window.print()}
                >
                  <Printer className="w-4 h-4" />
                  Print
                </Button>
              </div>
            )}
          </div>

          {renderContent()}
        </div>
      </div>
    </div>
  );
}
