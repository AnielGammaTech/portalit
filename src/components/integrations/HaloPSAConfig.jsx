import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from "@/lib/utils";

export default function HaloPSAConfig() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [settings, setSettings] = useState({
    halopsa_client_id: '',
    halopsa_client_secret: '',
    halopsa_tenant: '',
    halopsa_auth_url: '',
    halopsa_api_url: ''
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
      toast.success('Settings saved');
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    try {
      setTesting(true);
      setConnectionStatus(null);
      const response = await base44.functions.invoke('syncHaloPSACustomers', { action: 'test_connection' });
      if (response.data.success) {
        setConnectionStatus({ success: true });
        toast.success('Connection successful!');
      } else {
        setConnectionStatus({ success: false });
        toast.error(response.data.error || 'Connection failed');
      }
    } catch (error) {
      setConnectionStatus({ success: false });
      toast.error('Connection failed');
    } finally {
      setTesting(false);
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
    <div className="space-y-5">
      {/* Connection Status */}
      {connectionStatus?.success && (
        <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 px-3 py-2 rounded-lg">
          <CheckCircle2 className="w-4 h-4" />
          Connected to HaloPSA
        </div>
      )}

      {/* API Settings Form */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label className="text-sm text-slate-600">Client ID</Label>
          <Input
            type="password"
            value={settings.halopsa_client_id}
            onChange={(e) => handleChange('halopsa_client_id', e.target.value)}
            placeholder="Enter Client ID"
            className="mt-1.5"
          />
        </div>
        <div>
          <Label className="text-sm text-slate-600">Client Secret</Label>
          <Input
            type="password"
            value={settings.halopsa_client_secret}
            onChange={(e) => handleChange('halopsa_client_secret', e.target.value)}
            placeholder="Enter Client Secret"
            className="mt-1.5"
          />
        </div>
        <div>
          <Label className="text-sm text-slate-600">Auth URL</Label>
          <Input
            type="url"
            value={settings.halopsa_auth_url}
            onChange={(e) => handleChange('halopsa_auth_url', e.target.value)}
            placeholder="https://yourcompany.halopsa.com/auth/token"
            className="mt-1.5"
          />
        </div>
        <div>
          <Label className="text-sm text-slate-600">API URL</Label>
          <Input
            type="url"
            value={settings.halopsa_api_url}
            onChange={(e) => handleChange('halopsa_api_url', e.target.value)}
            placeholder="https://yourcompany.halopsa.com/api"
            className="mt-1.5"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-slate-900 hover:bg-slate-800"
        >
          {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Save
        </Button>
        <Button
          onClick={handleTestConnection}
          disabled={testing || !isConfigured}
          variant="outline"
        >
          <RefreshCw className={cn("w-4 h-4 mr-2", testing && "animate-spin")} />
          Test Connection
        </Button>
      </div>
    </div>
  );
}