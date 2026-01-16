import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export default function HaloPSAConfig() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [settings, setSettings] = useState({
    halopsa_client_id: '',
    halopsa_client_secret: '',
    halopsa_tenant: '',
    halopsa_auth_url: '',
    halopsa_api_url: '',
    halopsa_excluded_ids: ''
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const settingsList = await base44.entities.Settings.list();
      if (settingsList.length > 0) {
        setSettings(settingsList[0]);
      }
    } catch (error) {
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const settingsList = await base44.entities.Settings.list();
      if (settingsList.length > 0) {
        await base44.entities.Settings.update(settingsList[0].id, settings);
      } else {
        await base44.entities.Settings.create(settings);
      }
      toast.success('Settings saved successfully');
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    try {
      setTesting(true);
      const response = await base44.functions.invoke('syncHaloPSACustomers', { action: 'test_connection' });
      if (response.data.success) {
        toast.success('HaloPSA connection successful!');
      } else {
        toast.error(response.data.error || 'Connection test failed');
      }
    } catch (error) {
      toast.error('Failed to test connection');
    } finally {
      setTesting(false);
    }
  };

  const handleSyncNow = async () => {
    try {
      setSaving(true);
      const response = await base44.functions.invoke('syncHaloPSACustomers', { action: 'sync_now' });
      if (response.data.success) {
        toast.success(`Sync completed! Synced ${response.data.recordsSynced} records`);
      } else {
        toast.error(response.data.error || 'Sync failed');
      }
    } catch (error) {
      toast.error('Failed to start sync');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
      </div>
    );
  }

  const isConfigured = settings.halopsa_client_id && settings.halopsa_client_secret && 
                       settings.halopsa_auth_url && settings.halopsa_api_url;

  return (
    <div className="space-y-6">
      {/* Configuration Form */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="client_id" className="text-sm font-medium text-slate-700">Client ID</Label>
            <Input
              id="client_id"
              type="password"
              value={settings.halopsa_client_id}
              onChange={(e) => handleChange('halopsa_client_id', e.target.value)}
              placeholder="Your HaloPSA Client ID"
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
              placeholder="Your HaloPSA Client Secret"
              className="mt-1"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              placeholder="https://helpdesk.example.com/auth/token"
              className="mt-1"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="api_url" className="text-sm font-medium text-slate-700">API URL</Label>
          <Input
            id="api_url"
            type="url"
            value={settings.halopsa_api_url}
            onChange={(e) => handleChange('halopsa_api_url', e.target.value)}
            placeholder="https://helpdesk.example.com/api"
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="excluded_ids" className="text-sm font-medium text-slate-700">Excluded IDs (optional)</Label>
          <Textarea
            id="excluded_ids"
            value={settings.halopsa_excluded_ids}
            onChange={(e) => handleChange('halopsa_excluded_ids', e.target.value)}
            placeholder="Comma-separated list of IDs to exclude from sync"
            className="mt-1 h-20"
          />
          <p className="text-xs text-slate-500 mt-1">Enter customer/site IDs separated by commas to exclude them from syncs</p>
        </div>
      </div>

      {/* Info Box */}
      {!isConfigured && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-900">Configuration Required</p>
            <p className="text-sm text-amber-700 mt-1">
              Please provide your HaloPSA credentials to enable synchronization.
            </p>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3 pt-4 border-t border-slate-200">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-purple-500 hover:bg-purple-600 text-white"
        >
          {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Save Configuration
        </Button>
        <Button
          onClick={handleTestConnection}
          disabled={testing || !isConfigured}
          variant="outline"
          className="border-slate-200"
        >
          {testing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Test Connection
        </Button>
        <Button
          onClick={handleSyncNow}
          disabled={saving || !isConfigured}
          variant="outline"
          className="border-slate-200"
        >
          {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Sync Now
        </Button>
      </div>
    </div>
  );
}