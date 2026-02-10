import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import Breadcrumbs from '../components/ui/breadcrumbs';
import UserAssignmentPanel from '../components/admin/UserAssignmentPanel';
import FeedbackPanel from '../components/admin/FeedbackPanel';
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
  Save,
  Code,
  Copy,
  Check,
  Printer,
  Share2,
  ExternalLink
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
      },
      {
        name: 'Customer Feedback',
        description: 'Review feedback from customers',
        icon: MessageSquare,
        panel: 'customer-feedback'
      },
      {
        name: 'API Docs',
        description: 'API documentation for integrations',
        icon: Code,
        panel: 'api-docs'
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
  const [copiedEndpoint, setCopiedEndpoint] = useState(null);

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

  if (activePanel === 'customer-feedback') {
    return (
      <div className="max-w-4xl mx-auto py-8">
        <Breadcrumbs items={[
          { label: 'Adminland', href: createPageUrl('Adminland') },
          { label: 'Customer Feedback' }
        ]} />
        
        <div className="flex items-center gap-4 mb-8">
          <button 
            onClick={() => setActivePanel(null)}
            className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-slate-600 rotate-180" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Customer Feedback</h1>
            <p className="text-sm text-slate-500">Review and respond to customer feedback</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <FeedbackPanel />
        </div>
      </div>
    );
  }

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedEndpoint(id);
    setTimeout(() => setCopiedEndpoint(null), 2000);
  };

  if (activePanel === 'api-docs') {
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

    return (
      <div className="max-w-5xl mx-auto py-8">
        <Breadcrumbs items={[
          { label: 'Adminland', href: createPageUrl('Adminland') },
          { label: 'API Docs' }
        ]} />
        
        <div className="flex items-center gap-4 mb-8">
          <button 
            onClick={() => setActivePanel(null)}
            className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-slate-600 rotate-180" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">API Documentation</h1>
            <p className="text-sm text-slate-500">REST API endpoints for external integrations (e.g., Triggr)</p>
          </div>
        </div>

        {/* Authentication Section */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
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
        <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
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
        <div className="space-y-6">
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
        </div>

        {/* Usage Notes */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 mt-6">
          <h3 className="font-semibold text-amber-900 mb-2 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Usage Notes
          </h3>
          <ul className="text-sm text-amber-800 space-y-2">
            <li>• Always filter by <code className="bg-amber-100 px-1 rounded">customer_id</code> when querying customer-specific data</li>
            <li>• Use pagination for large datasets: <code className="bg-amber-100 px-1 rounded">?limit=50&skip=0</code></li>
            <li>• Sort results: <code className="bg-amber-100 px-1 rounded">?sort={'{"-created_date"}'}</code></li>
            <li>• All dates are returned in ISO 8601 format (UTC)</li>
            <li>• Rate limiting: 100 requests per minute per API key</li>
          </ul>
        </div>
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