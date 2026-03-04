import React, { useState, useEffect } from 'react';
import { client } from '@/api/client';
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronDown, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from "@/lib/utils";

export default function HaloPSASection() {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [settings, setSettings] = useState({
    halopsa_client_id: '',
    halopsa_client_secret: '',
    halopsa_tenant: '',
    halopsa_auth_url: '',
    halopsa_api_url: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const settingsList = await client.entities.Settings.list();
      if (settingsList.length > 0) {
        const s = settingsList[0];
        setSettings({
          halopsa_client_id: s.halopsa_client_id || '',
          halopsa_client_secret: s.halopsa_client_secret || '',
          halopsa_tenant: s.halopsa_tenant || '',
          halopsa_auth_url: s.halopsa_auth_url || '',
          halopsa_api_url: s.halopsa_api_url || ''
        });
        setIsEnabled(!!s.halopsa_client_id);
      }
    } catch (error) {
      console.error('Failed to load settings', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (enabled) => {
    if (enabled && !settings.halopsa_client_id) {
      toast.error('Please configure HaloPSA credentials first');
      return;
    }
    setIsEnabled(enabled);
    if (enabled && !isExpanded) {
      setIsExpanded(true);
    }
  };

  const handleChange = (field, value) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!settings.halopsa_client_id || !settings.halopsa_auth_url || !settings.halopsa_api_url) {
      toast.error('Please fill in all required fields');
      return;
    }
    
    try {
      setSaving(true);
      const settingsList = await client.entities.Settings.list();
      if (settingsList.length > 0) {
        await client.entities.Settings.update(settingsList[0].id, settings);
      } else {
        await client.entities.Settings.create(settings);
      }
      setIsEnabled(true);
      toast.success('HaloPSA configuration saved');
    } catch (error) {
      toast.error('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    try {
      setTesting(true);
      setConnectionStatus(null);
      const response = await client.functions.invoke('syncHaloPSACustomers', { action: 'test_connection' });
      if (response.data.success) {
        setConnectionStatus({ success: true, message: 'Connection successful!' });
        toast.success('HaloPSA connection successful!');
      } else {
        setConnectionStatus({ success: false, message: response.data.error || 'Connection test failed' });
        toast.error(response.data.error || 'Connection test failed');
      }
    } catch (error) {
      setConnectionStatus({ success: false, message: error.message });
      toast.error('Failed to test connection');
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return <Loader2 className="w-4 h-4 animate-spin" />;
  }

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3 flex-1">
          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
            <span className="text-blue-600 font-semibold text-sm">HPS</span>
          </div>
          <div className="text-left">
            <p className="font-medium text-slate-900">HaloPSA</p>
            <p className="text-xs text-slate-500">Sync customers, contracts, and billing data</p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <Switch
            checked={isEnabled}
            onCheckedChange={handleToggle}
            onClick={(e) => e.stopPropagation()}
          />
          <ChevronDown className={cn(
            "w-4 h-4 text-slate-400 transition-transform",
            isExpanded && "rotate-180"
          )} />
        </div>
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="border-t border-slate-200 p-6 space-y-4 bg-slate-50">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="client_id" className="text-sm font-medium text-slate-700">Client ID</Label>
              <Input
                id="client_id"
                type="password"
                value={settings.halopsa_client_id}
                onChange={(e) => handleChange('halopsa_client_id', e.target.value)}
                placeholder="Your Client ID"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="client_secret" className="text-sm font-medium text-slate-700">Client Secret</Label>
              <Input
                id="client_secret"
                type="password"
                value={settings.halopsa_client_secret}
                onChange={(e) => handleChange('halopsa_client_secret', e.target.value)}
                placeholder="Your Client Secret"
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="tenant" className="text-sm font-medium text-slate-700">Tenant Name</Label>
            <Input
              id="tenant"
              value={settings.halopsa_tenant}
              onChange={(e) => handleChange('halopsa_tenant', e.target.value)}
              placeholder="e.g., mycompany"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="auth_url" className="text-sm font-medium text-slate-700">Auth URL</Label>
            <Input
              id="auth_url"
              type="url"
              value={settings.halopsa_auth_url}
              onChange={(e) => handleChange('halopsa_auth_url', e.target.value)}
              placeholder="https://..."
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="api_url" className="text-sm font-medium text-slate-700">API URL</Label>
            <Input
              id="api_url"
              type="url"
              value={settings.halopsa_api_url}
              onChange={(e) => handleChange('halopsa_api_url', e.target.value)}
              placeholder="https://..."
              className="mt-1"
            />
          </div>

          {connectionStatus && (
            <div className={`border rounded-lg p-3 flex gap-2 ${connectionStatus.success ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
              <div className="flex-shrink-0">
                {connectionStatus.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600 mt-0.5" />
                )}
              </div>
              <p className={`text-sm ${connectionStatus.success ? 'text-emerald-700' : 'text-red-700'}`}>
                {connectionStatus.message}
              </p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save
            </Button>
            <Button
              onClick={handleTestConnection}
              disabled={testing || !settings.halopsa_client_id}
              variant="outline"
            >
              {testing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Test Connection
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}