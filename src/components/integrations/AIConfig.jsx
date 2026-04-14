import React, { useState, useEffect } from 'react';
import { client } from '@/api/client';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from 'sonner';
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  XCircle,
  RefreshCw,
  Brain,
  Sparkles,
  Loader2,
  ChevronDown,
  Save,
} from 'lucide-react';

const PROVIDER_CARDS = [
  {
    id: 'anthropic',
    name: 'Claude AI',
    company: 'Anthropic',
    envVar: 'ANTHROPIC_API_KEY',
    icon: Brain,
    color: 'text-[#D97706]',
    bg: 'bg-[#D97706]/10',
    border: 'border-[#D97706]/30',
    selectedBg: 'bg-[#D97706]/5',
    description: 'Advanced reasoning & code generation',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    company: 'OpenAI',
    envVar: 'OPENAI_API_KEY',
    icon: Sparkles,
    color: 'text-[#10A37F]',
    bg: 'bg-[#10A37F]/10',
    border: 'border-[#10A37F]/30',
    selectedBg: 'bg-[#10A37F]/5',
    description: 'GPT models for text & analysis',
  },
];

export default function AIConfig() {
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [errorDetails, setErrorDetails] = useState(null);

  const [selectedProvider, setSelectedProvider] = useState('anthropic');
  const [selectedModel, setSelectedModel] = useState('claude-sonnet-4-20250514');
  const [providerModels, setProviderModels] = useState({});
  const [keyStatus, setKeyStatus] = useState({ anthropic: false, openai: false });
  const [savedProvider, setSavedProvider] = useState(null);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const response = await client.functions.invoke('testAIConnection', {
        action: 'get_config',
      });
      if (response.success) {
        const { provider, model, providers, keyStatus: ks } = response.config;
        setSelectedProvider(provider);
        setSelectedModel(model);
        setProviderModels(providers);
        setKeyStatus(ks);
        setSavedProvider(provider);
      }
    } catch (error) {
      toast.error(error.message || 'Failed to load AI config');
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    setErrorDetails(null);
    try {
      const response = await client.functions.invoke('testAIConnection', {
        action: 'test_connection',
        provider: selectedProvider,
      });
      if (response.success) {
        setTestResult('success');
        toast.success(response.message);
      } else {
        setTestResult('error');
        setErrorDetails(response.error);
        toast.error(response.error);
      }
    } catch (error) {
      setTestResult('error');
      setErrorDetails(error.message);
      toast.error('Connection test failed');
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await client.functions.invoke('testAIConnection', {
        action: 'save_config',
        provider: selectedProvider,
        model: selectedModel,
      });
      if (response.success) {
        setSavedProvider(selectedProvider);
        toast.success(response.message);
      } else {
        toast.error(response.error);
      }
    } catch (error) {
      toast.error('Failed to save AI configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleProviderChange = (providerId) => {
    setSelectedProvider(providerId);
    setTestResult(null);
    setErrorDetails(null);
    // Auto-select first model for the new provider
    const models = providerModels[providerId]?.models;
    if (models?.length) setSelectedModel(models[0].id);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  const hasChanges = selectedProvider !== savedProvider;
  const currentKeyConfigured = keyStatus[selectedProvider];
  const currentModels = providerModels[selectedProvider]?.models || [];

  return (
    <div className="space-y-6">
      {/* Status Header */}
      <div className={cn(
        'flex items-center justify-between p-4 rounded-xl border',
        currentKeyConfigured
          ? 'bg-emerald-50 border-emerald-200'
          : 'bg-amber-50 border-amber-200'
      )}>
        <div className="flex items-center gap-3">
          {currentKeyConfigured
            ? <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            : <XCircle className="w-5 h-5 text-amber-600" />
          }
          <div>
            <p className="font-medium text-slate-900">
              {currentKeyConfigured ? 'API Key Configured' : 'API Key Not Set'}
            </p>
            <p className="text-xs text-slate-500">
              {currentKeyConfigured
                ? `${PROVIDER_CARDS.find(p => p.id === selectedProvider)?.envVar} is set in environment`
                : `Set ${PROVIDER_CARDS.find(p => p.id === selectedProvider)?.envVar} in Railway environment variables`
              }
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleTestConnection}
          disabled={testing || !currentKeyConfigured}
        >
          {testing
            ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            : <RefreshCw className="w-4 h-4 mr-2" />
          }
          Test Connection
        </Button>
      </div>

      {/* Test result */}
      {testResult && (
        <div className={cn(
          'p-3 rounded-lg border text-sm',
          testResult === 'success'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
            : 'bg-red-50 border-red-200 text-red-700'
        )}>
          {testResult === 'success' ? '✓ Connection successful' : `✕ ${errorDetails || 'Connection failed'}`}
        </div>
      )}

      {/* Provider Selection */}
      <div>
        <h4 className="text-sm font-medium text-slate-700 mb-3">AI Provider</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {PROVIDER_CARDS.map(provider => {
            const isSelected = selectedProvider === provider.id;
            const isConfigured = keyStatus[provider.id];
            const ProviderIcon = provider.icon;

            return (
              <button
                key={provider.id}
                onClick={() => handleProviderChange(provider.id)}
                className={cn(
                  'relative flex items-start gap-4 p-4 rounded-xl border-2 transition-all text-left',
                  isSelected
                    ? `${provider.border} ${provider.selectedBg} shadow-sm`
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                )}
              >
                {isSelected && (
                  <div className={cn('absolute top-3 right-3 w-5 h-5 rounded-full flex items-center justify-center', provider.bg)}>
                    <CheckCircle2 className={cn('w-4 h-4', provider.color)} />
                  </div>
                )}
                <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', provider.bg)}>
                  <ProviderIcon className={cn('w-5 h-5', provider.color)} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h5 className="font-medium text-slate-900 text-sm">{provider.name}</h5>
                    {isConfigured ? (
                      <Badge className="bg-emerald-100 text-emerald-700 text-[10px] px-1.5 py-0">
                        ● Key Set
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-slate-400 text-[10px] px-1.5 py-0">
                        ● No Key
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">{provider.description}</p>
                  <p className="text-[10px] text-slate-400 mt-1">Env: {provider.envVar}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Model Selection */}
      {currentModels.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-slate-700 mb-2">Model</h4>
          <div className="relative">
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full appearance-none bg-white border border-slate-200 rounded-lg px-4 py-2.5 text-sm text-slate-900 pr-10 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            >
              {currentModels.map(m => (
                <option key={m.id} value={m.id}>{m.label} ({m.id})</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
        </div>
      )}

      {/* Environment Variables Reference */}
      <div className="bg-slate-50 rounded-xl p-4 space-y-2">
        <h4 className="text-sm font-medium text-slate-700">Environment Variables</h4>
        <p className="text-xs text-slate-500">Set these in your Railway backend service:</p>
        <div className="space-y-1.5">
          {PROVIDER_CARDS.map(provider => (
            <div key={provider.id} className="flex items-center gap-2 text-sm">
              {keyStatus[provider.id]
                ? <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                : <XCircle className="w-4 h-4 text-slate-300 flex-shrink-0" />
              }
              <code className="text-xs bg-white border border-slate-200 px-2 py-0.5 rounded font-mono">
                {provider.envVar}
              </code>
              <span className={cn('text-xs', keyStatus[provider.id] ? 'text-emerald-600' : 'text-slate-400')}>
                {keyStatus[provider.id] ? 'Configured' : 'Not set'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Save Button */}
      <div className="flex items-center justify-between pt-2">
        <p className="text-xs text-slate-400">
          AI features use the selected provider for ticket summaries, insights, and more.
        </p>
        <Button onClick={handleSave} disabled={saving}>
          {saving
            ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            : <Save className="w-4 h-4 mr-2" />
          }
          Save Configuration
        </Button>
      </div>
    </div>
  );
}
