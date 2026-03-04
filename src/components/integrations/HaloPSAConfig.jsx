import React, { useState, useEffect, useCallback } from 'react';
import { client, supabase } from '@/api/client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Loader2, CheckCircle2, RefreshCw, XCircle, Eye, EyeOff, Clock, ChevronDown, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from 'date-fns';

const MASKED_PLACEHOLDER = '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022';

const CONNECTION_STATES = {
  CONNECTED: 'connected',
  CONFIGURED: 'configured',
  NOT_CONFIGURED: 'not_configured',
};

function getConnectionStatusDisplay(status) {
  switch (status) {
    case CONNECTION_STATES.CONNECTED:
      return { color: 'bg-emerald-500', label: 'Connected', bgClass: 'bg-emerald-50 border-emerald-200', textClass: 'text-emerald-700' };
    case CONNECTION_STATES.CONFIGURED:
      return { color: 'bg-amber-500', label: 'Configured', bgClass: 'bg-amber-50 border-amber-200', textClass: 'text-amber-700' };
    default:
      return { color: 'bg-slate-300', label: 'Not configured', bgClass: 'bg-slate-50 border-slate-200', textClass: 'text-slate-500' };
  }
}

export default function HaloPSAConfig() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [configStatus, setConfigStatus] = useState(CONNECTION_STATES.NOT_CONFIGURED);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [errorDetails, setErrorDetails] = useState(null);
  const [showErrorDetails, setShowErrorDetails] = useState(false);

  // Credential masking state
  const [showClientId, setShowClientId] = useState(false);
  const [showClientSecret, setShowClientSecret] = useState(false);
  const [hasExistingCredentials, setHasExistingCredentials] = useState(false);

  const [settings, setSettings] = useState({
    halopsa_client_id: '',
    halopsa_client_secret: '',
    halopsa_tenant: '',
    halopsa_auth_url: '',
    halopsa_api_url: ''
  });

  // Track which fields have been modified by user to avoid sending masked values
  const [dirtyFields, setDirtyFields] = useState(new Set());

  const fetchLastSync = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('sync_logs')
        .select('completed_at')
        .eq('integration_type', 'halopsa')
        .eq('status', 'success')
        .order('completed_at', { ascending: false })
        .limit(1);
      if (data && data.length > 0) {
        setLastSyncTime(data[0].completed_at);
      }
    } catch (_err) {
      // Sync logs table may not exist yet, silently ignore
    }
  }, []);

  useEffect(() => {
    loadSettings();
    fetchLastSync();
  }, [fetchLastSync]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const settingsList = await client.entities.Settings.list();
      if (settingsList.length > 0) {
        const s = settingsList[0];
        const hasCreds = !!(s.halopsa_client_id && s.halopsa_client_secret);
        setHasExistingCredentials(hasCreds);

        setSettings({
          ...s,
          halopsa_client_id: s.halopsa_client_id || '',
          halopsa_client_secret: s.halopsa_client_secret || '',
          halopsa_tenant: s.halopsa_tenant || '',
          halopsa_auth_url: s.halopsa_auth_url || '',
          halopsa_api_url: s.halopsa_api_url || ''
        });

        if (hasCreds && s.halopsa_auth_url && s.halopsa_api_url) {
          setConfigStatus(CONNECTION_STATES.CONFIGURED);
        } else if (!hasCreds) {
          setConfigStatus(CONNECTION_STATES.NOT_CONFIGURED);
        }
      }
    } catch (error) {
      toast.error('Failed to load settings');
      setErrorDetails(error.message || 'Unknown error loading settings');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setSettings(prev => ({ ...prev, [field]: value }));
    setDirtyFields(prev => new Set([...prev, field]));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setErrorDetails(null);

      // Build the update payload, only sending dirty secret fields
      const payload = { ...settings };
      if (hasExistingCredentials && !dirtyFields.has('halopsa_client_id')) {
        delete payload.halopsa_client_id;
      }
      if (hasExistingCredentials && !dirtyFields.has('halopsa_client_secret')) {
        delete payload.halopsa_client_secret;
      }

      const settingsList = await client.entities.Settings.list();
      if (settingsList.length > 0) {
        await client.entities.Settings.update(settingsList[0].id, payload);
      } else {
        await client.entities.Settings.create(payload);
      }
      setHasExistingCredentials(true);
      setDirtyFields(new Set());
      toast.success('Settings saved successfully');

      // Auto-test connection after save
      await handleTestConnection({ silent: false });
    } catch (error) {
      toast.error('Failed to save settings');
      setErrorDetails(error.message || 'Unknown error saving settings');
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async ({ silent = false } = {}) => {
    try {
      setTesting(true);
      setErrorDetails(null);
      const response = await client.functions.invoke('syncHaloPSACustomers', { action: 'test_connection' });
      if (response.data.success) {
        setConfigStatus(CONNECTION_STATES.CONNECTED);
        if (!silent) {
          toast.success('Connection successful!');
        }
      } else {
        const errorMsg = response.data.error || 'Connection failed';
        setConfigStatus(CONNECTION_STATES.CONFIGURED);
        setErrorDetails(errorMsg);
        if (!silent) {
          toast.error(errorMsg);
        }
      }
    } catch (error) {
      const errorMsg = error.message || 'Connection test failed';
      setConfigStatus(CONNECTION_STATES.CONFIGURED);
      setErrorDetails(errorMsg);
      if (!silent) {
        toast.error('Connection failed');
      }
    } finally {
      setTesting(false);
    }
  };

  const getMaskedValue = (fieldName, showRaw) => {
    const value = settings[fieldName];
    if (!value) return '';
    if (showRaw) return value;
    if (hasExistingCredentials && !dirtyFields.has(fieldName)) {
      return MASKED_PLACEHOLDER;
    }
    return value;
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

  const statusDisplay = getConnectionStatusDisplay(configStatus);

  return (
    <div className="space-y-5">
      {/* Connection Status Header */}
      <div className={cn("flex items-center justify-between px-4 py-3 rounded-lg border", statusDisplay.bgClass)}>
        <div className="flex items-center gap-3">
          <div className={cn("w-2.5 h-2.5 rounded-full", statusDisplay.color)} />
          <span className={cn("text-sm font-medium", statusDisplay.textClass)}>
            {statusDisplay.label}
          </span>
          {configStatus === CONNECTION_STATES.CONNECTED && (
            <Badge className="bg-emerald-100 text-emerald-700 text-xs font-normal">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              HaloPSA
            </Badge>
          )}
        </div>
        {lastSyncTime && (
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Clock className="w-3.5 h-3.5" />
            Last synced: {formatDistanceToNow(new Date(lastSyncTime), { addSuffix: true })}
          </div>
        )}
      </div>

      {/* Error Details (collapsible) */}
      {errorDetails && (
        <Collapsible open={showErrorDetails} onOpenChange={setShowErrorDetails}>
          <div className="border border-red-200 bg-red-50 rounded-lg overflow-hidden">
            <CollapsibleTrigger asChild>
              <button className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-red-700 hover:bg-red-100 transition-colors">
                <div className="flex items-center gap-2">
                  <XCircle className="w-4 h-4" />
                  Connection error detected
                </div>
                <ChevronDown className={cn("w-4 h-4 transition-transform", showErrorDetails && "rotate-180")} />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-4 pb-3 pt-1 border-t border-red-200">
                <pre className="text-xs text-red-600 whitespace-pre-wrap font-mono bg-red-100/50 rounded p-2">
                  {errorDetails}
                </pre>
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>
      )}

      {/* API Settings Form */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label className="text-sm text-slate-600">Client ID</Label>
          <div className="relative mt-1.5">
            <Input
              type={showClientId ? "text" : "password"}
              value={getMaskedValue('halopsa_client_id', showClientId)}
              onChange={(e) => handleChange('halopsa_client_id', e.target.value)}
              onFocus={() => {
                if (hasExistingCredentials && !dirtyFields.has('halopsa_client_id')) {
                  handleChange('halopsa_client_id', '');
                }
              }}
              placeholder="Enter Client ID"
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowClientId(prev => !prev)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              {showClientId ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <div>
          <Label className="text-sm text-slate-600">Client Secret</Label>
          <div className="relative mt-1.5">
            <Input
              type={showClientSecret ? "text" : "password"}
              value={getMaskedValue('halopsa_client_secret', showClientSecret)}
              onChange={(e) => handleChange('halopsa_client_secret', e.target.value)}
              onFocus={() => {
                if (hasExistingCredentials && !dirtyFields.has('halopsa_client_secret')) {
                  handleChange('halopsa_client_secret', '');
                }
              }}
              placeholder="Enter Client Secret"
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowClientSecret(prev => !prev)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              {showClientSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
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
          {saving ? 'Saving & Testing...' : 'Save'}
        </Button>
        <Button
          onClick={() => handleTestConnection()}
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
