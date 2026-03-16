import React, { useState, useEffect } from 'react';
import { client } from '@/api/client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Save,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Loader2,
  MapPin,
  Eye,
  EyeOff,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from "@/lib/utils";

const MAP_STYLES = [
  { id: 'dark-v11', label: 'Dark' },
  { id: 'light-v11', label: 'Light' },
  { id: 'streets-v12', label: 'Streets' },
  { id: 'outdoors-v12', label: 'Outdoors' },
  { id: 'satellite-v9', label: 'Satellite' },
];

const TEST_ADDRESS = '1600 Amphitheatre Parkway, Mountain View, CA';

export default function MapboxConfig() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [showToken, setShowToken] = useState(false);

  const [token, setToken] = useState('');
  const [style, setStyle] = useState('dark-v11');
  const [settingsId, setSettingsId] = useState(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const settingsList = await client.entities.Settings.list();
      if (settingsList.length > 0) {
        const s = settingsList[0];
        setSettingsId(s.id);
        setToken(s.mapbox_token || '');
        setStyle(s.mapbox_style || 'dark-v11');
      }
    } catch (error) {
      console.error('Failed to load Mapbox settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!token.trim()) {
      toast.error('Please enter a Mapbox access token');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        mapbox_token: token.trim(),
        mapbox_style: style,
      };

      if (settingsId) {
        await client.entities.Settings.update(settingsId, payload);
      } else {
        const created = await client.entities.Settings.create(payload);
        setSettingsId(created.id);
      }
      toast.success('Mapbox settings saved');
    } catch (error) {
      toast.error('Failed to save Mapbox settings');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!token.trim()) {
      toast.error('Enter a token first');
      return;
    }

    setTesting(true);
    setTestResult(null);
    try {
      const encoded = encodeURIComponent(TEST_ADDRESS);
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json?access_token=${token.trim()}&limit=1`
      );

      if (!res.ok) {
        const errorText = await res.text();
        setTestResult({ success: false, error: `HTTP ${res.status}: ${errorText}` });
        toast.error('Token validation failed');
        return;
      }

      const data = await res.json();
      const feature = data.features?.[0];

      if (feature) {
        setTestResult({
          success: true,
          message: `Geocoded "${TEST_ADDRESS}" to [${feature.center[0].toFixed(4)}, ${feature.center[1].toFixed(4)}]`,
        });
        toast.success('Mapbox token is valid');
      } else {
        setTestResult({ success: false, error: 'No geocoding results returned' });
        toast.error('Token works but no results returned');
      }
    } catch (error) {
      setTestResult({ success: false, error: error.message });
      toast.error('Connection test failed');
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  const isConfigured = Boolean(token.trim());

  return (
    <div className="space-y-6">
      {/* Status Header */}
      <div className={cn(
        'flex items-center justify-between p-4 rounded-xl border',
        isConfigured
          ? 'bg-emerald-50 border-emerald-200'
          : 'bg-slate-50 border-slate-200'
      )}>
        <div className="flex items-center gap-3">
          {isConfigured
            ? <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            : <XCircle className="w-5 h-5 text-slate-400" />
          }
          <div>
            <p className="font-medium text-slate-900">
              {isConfigured ? 'Token Configured' : 'Not Configured'}
            </p>
            <p className="text-xs text-slate-500">
              {isConfigured
                ? 'Mapbox access token is set'
                : 'Add your Mapbox access token to enable customer location maps'
              }
            </p>
          </div>
        </div>
      </div>

      {/* Token Input */}
      <div>
        <label className="text-sm font-medium text-slate-700 mb-2 block">
          Mapbox Access Token
        </label>
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <Input
              type={showToken ? 'text' : 'password'}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="pk.eyJ1Ijoi..."
              className="pr-10 font-mono text-sm"
            />
            <button
              type="button"
              onClick={() => setShowToken((prev) => !prev)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 hover:bg-slate-100 rounded transition-colors"
            >
              {showToken
                ? <EyeOff className="w-4 h-4 text-slate-400" />
                : <Eye className="w-4 h-4 text-slate-400" />
              }
            </button>
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-1.5">
          Get your token from{' '}
          <a
            href="https://account.mapbox.com/access-tokens/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            account.mapbox.com/access-tokens
          </a>
        </p>
      </div>

      {/* Map Style */}
      <div>
        <label className="text-sm font-medium text-slate-700 mb-2 block">
          Map Style
        </label>
        <Select value={style} onValueChange={setStyle}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MAP_STYLES.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.label} ({s.id})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-slate-500 mt-1.5">
          Style used for static map images on customer pages
        </p>
      </div>

      {/* Test Result */}
      {testResult && (
        <div className={cn(
          'p-3 rounded-lg border text-sm',
          testResult.success
            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
            : 'bg-red-50 border-red-200 text-red-700'
        )}>
          {testResult.success
            ? testResult.message
            : testResult.error
          }
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2">
        <Button onClick={handleTest} disabled={testing || !token.trim()} variant="outline">
          {testing
            ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            : <MapPin className="w-4 h-4 mr-2" />
          }
          Test Token
        </Button>
        <Button onClick={handleSave} disabled={saving || !token.trim()}>
          {saving
            ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            : <Save className="w-4 h-4 mr-2" />
          }
          Save Settings
        </Button>
      </div>
    </div>
  );
}
