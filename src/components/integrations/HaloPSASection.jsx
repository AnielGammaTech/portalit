import React, { useState, useEffect } from 'react';
import { client } from '@/api/client';
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Loader2, CheckCircle2, AlertCircle, Eye, EyeOff, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from "@/lib/utils";

const MASKED_PLACEHOLDER = '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022';

const CONNECTION_STATES = {
  CONNECTED: 'connected',
  CONFIGURED: 'configured',
  NOT_CONFIGURED: 'not_configured',
};

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
  const [configStatus, setConfigStatus] = useState(CONNECTION_STATES.NOT_CONFIGURED);
  const [errorDetails, setErrorDetails] = useState(null);
  const [showErrorDetails, setShowErrorDetails] = useState(false);

  // Credential masking
  const [showClientId, setShowClientId] = useState(false);
  const [showClientSecret, setShowClientSecret] = useState(false);
  const [hasExistingCredentials, setHasExistingCredentials] = useState(false);
  const [dirtyFields, setDirtyFields] = useState(new Set());

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const settingsList = await client.entities.Settings.list();
      if (settingsList.length > 0) {
        const s = settingsList[0];
        const hasCreds = !!(s.halopsa_client_id);
        setHasExistingCredentials(hasCreds);
        setSettings({
          halopsa_client_id: s.halopsa_client_id || '',
          halopsa_client_secret: s.halopsa_client_secret || '',
          halopsa_tenant: s.halopsa_tenant || '',
          halopsa_auth_url: s.halopsa_auth_url || '',
          halopsa_api_url: s.halopsa_api_url || ''
        });
        setIsEnabled(!!s.halopsa_client_id);
        if (hasCreds && s.halopsa_auth_url && s.halopsa_api_url) {
          setConfigStatus(CONNECTION_STATES.CONFIGURED);
        }
      }
    } catch (error) {
      toast.error(error.message || 'Failed to load settings');
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
    setDirtyFields(prev => new Set([...prev, field]));
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

  const handleSave = async () => {
    if (!settings.halopsa_client_id || !settings.halopsa_auth_url || !settings.halopsa_api_url) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      setSaving(true);
      setErrorDetails(null);

      // Build payload, only sending dirty secret fields
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
      setIsEnabled(true);
      setHasExistingCredentials(true);
      setDirtyFields(new Set());
      toast.success('HaloPSA configuration saved');

      // Auto-test connection after save
      await handleTestConnection({ silent: false });
    } catch (error) {
      toast.error('Failed to save configuration');
      setErrorDetails(error.message || 'Unknown error');
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async ({ silent = false } = {}) => {
    try {
      setTesting(true);
      setErrorDetails(null);
      const response = await client.functions.invoke('syncHaloPSACustomers', { action: 'test_connection' });
      if (response.success) {
        setConfigStatus(CONNECTION_STATES.CONNECTED);
        if (!silent) {
          toast.success('HaloPSA connection successful!');
        }
      } else {
        const errMsg = response.error || 'Connection test failed';
        setConfigStatus(CONNECTION_STATES.CONFIGURED);
        setErrorDetails(errMsg);
        if (!silent) {
          toast.error(errMsg);
        }
      }
    } catch (error) {
      const errMsg = error.message || 'Connection test failed';
      setConfigStatus(CONNECTION_STATES.CONFIGURED);
      setErrorDetails(errMsg);
      if (!silent) {
        toast.error('Failed to test connection');
      }
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return <Loader2 className="w-4 h-4 animate-spin" />;
  }

  const statusDotColor = configStatus === CONNECTION_STATES.CONNECTED
    ? 'bg-emerald-500'
    : configStatus === CONNECTION_STATES.CONFIGURED
      ? 'bg-amber-500'
      : 'bg-slate-300';

  const statusLabel = configStatus === CONNECTION_STATES.CONNECTED
    ? 'Connected'
    : configStatus === CONNECTION_STATES.CONFIGURED
      ? 'Configured'
      : 'Not configured';

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
            <div className="flex items-center gap-2">
              <p className="font-medium text-slate-900">HaloPSA</p>
              <div className="flex items-center gap-1.5">
                <div className={cn("w-2 h-2 rounded-full", statusDotColor)} />
                <span className="text-xs text-slate-500">{statusLabel}</span>
              </div>
            </div>
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
          {/* Connection Status Badge */}
          {configStatus === CONNECTION_STATES.CONNECTED && (
            <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-lg">
              <CheckCircle2 className="w-4 h-4" />
              Connected to HaloPSA
            </div>
          )}

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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="client_id" className="text-sm font-medium text-slate-700">Client ID</Label>
              <div className="relative mt-1">
                <Input
                  id="client_id"
                  type={showClientId ? "text" : "password"}
                  value={getMaskedValue('halopsa_client_id', showClientId)}
                  onChange={(e) => handleChange('halopsa_client_id', e.target.value)}
                  onFocus={() => {
                    if (hasExistingCredentials && !dirtyFields.has('halopsa_client_id')) {
                      handleChange('halopsa_client_id', '');
                    }
                  }}
                  placeholder="Your Client ID"
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
              <Label htmlFor="client_secret" className="text-sm font-medium text-slate-700">Client Secret</Label>
              <div className="relative mt-1">
                <Input
                  id="client_secret"
                  type={showClientSecret ? "text" : "password"}
                  value={getMaskedValue('halopsa_client_secret', showClientSecret)}
                  onChange={(e) => handleChange('halopsa_client_secret', e.target.value)}
                  onFocus={() => {
                    if (hasExistingCredentials && !dirtyFields.has('halopsa_client_secret')) {
                      handleChange('halopsa_client_secret', '');
                    }
                  }}
                  placeholder="Your Client Secret"
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

          <div className="flex gap-3 pt-2">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {saving ? 'Saving & Testing...' : 'Save'}
            </Button>
            <Button
              onClick={() => handleTestConnection()}
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
