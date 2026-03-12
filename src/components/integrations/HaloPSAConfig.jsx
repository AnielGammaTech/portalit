import React, { useState, useEffect, useCallback } from 'react';
import { client, supabase } from '@/api/client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, CheckCircle2, RefreshCw, XCircle, Clock, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from 'date-fns';

const ENV_VARS = [
  'HALOPSA_CLIENT_ID',
  'HALOPSA_CLIENT_SECRET',
  'HALOPSA_TENANT',
  'HALOPSA_AUTH_URL',
  'HALOPSA_API_URL',
];

export default function HaloPSAConfig() {
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(false);
  const [customerCount, setCustomerCount] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState(null);

  // Test connection state
  const [testStatus, setTestStatus] = useState('idle'); // idle | loading | success | error
  const [testMessage, setTestMessage] = useState(null);
  const [testDebug, setTestDebug] = useState(null);

  // Sync state
  const [syncing, setSyncing] = useState(false);

  // Excluded IDs
  const [excludedIds, setExcludedIds] = useState('');
  const [savingExcluded, setSavingExcluded] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const status = await client.halo.getStatus();
      setConfigured(status.configured);
      setCustomerCount(status.customerCount || 0);
      if (status.lastSync?.completed_at) {
        setLastSyncTime(status.lastSync.completed_at);
      }
    } catch (_err) {
      setConfigured(false);
    }
  }, []);

  const fetchExcludedIds = useCallback(async () => {
    try {
      const settingsList = await client.entities.Settings.list();
      if (settingsList.length > 0 && settingsList[0].halopsa_excluded_ids) {
        setExcludedIds(settingsList[0].halopsa_excluded_ids);
      }
    } catch (_err) {
      // Settings table may not have this field yet
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchStatus(), fetchExcludedIds()]);
      setLoading(false);
    };
    init();
  }, [fetchStatus, fetchExcludedIds]);

  const handleTestConnection = async () => {
    try {
      setTestStatus('loading');
      setTestMessage(null);
      setTestDebug(null);

      const result = await client.halo.testConnection();

      if (result.success) {
        setTestStatus('success');
        setTestMessage(result.message || 'Connection successful!');
        toast.success(result.message || 'Connection successful!');
      } else {
        setTestStatus('error');
        setTestMessage(result.error || 'Connection failed');
        setTestDebug(result.debug || null);
        toast.error(result.error || 'Connection failed');
      }
    } catch (error) {
      setTestStatus('error');
      setTestMessage(error.message || 'Connection test failed');
      toast.error('Connection failed');
    }
  };

  const handleSync = async () => {
    try {
      setSyncing(true);
      const result = await client.halo.syncAll();

      if (result.success) {
        toast.success(result.message || `Synced ${result.recordsSynced} customers`);
        // Refresh status to update counts
        await fetchStatus();
      } else {
        toast.error(result.error || 'Sync failed');
      }
    } catch (error) {
      toast.error(error.message || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const handleSaveExcludedIds = async () => {
    try {
      setSavingExcluded(true);
      const settingsList = await client.entities.Settings.list();
      const payload = { halopsa_excluded_ids: excludedIds };

      if (settingsList.length > 0) {
        await client.entities.Settings.update(settingsList[0].id, payload);
      } else {
        await client.entities.Settings.create(payload);
      }
      toast.success('Excluded IDs saved');
    } catch (error) {
      toast.error('Failed to save excluded IDs');
    } finally {
      setSavingExcluded(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Connection Status Header */}
      {configured ? (
        <div className="flex items-center justify-between px-4 py-3 rounded-lg border bg-emerald-50 border-emerald-200">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span className="text-sm font-medium text-emerald-700">
              {customerCount > 0 ? `Connected — ${customerCount} customers synced` : 'Configured'}
            </span>
          </div>
          {lastSyncTime && (
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <Clock className="w-3.5 h-3.5" />
              Last synced: {formatDistanceToNow(new Date(lastSyncTime), { addSuffix: true })}
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg border bg-amber-50 border-amber-200">
          <AlertCircle className="w-4 h-4 text-amber-600" />
          <span className="text-sm font-medium text-amber-700">
            Missing environment variables — configure in Railway dashboard
          </span>
        </div>
      )}

      {/* Env var checkmarks — matches QuoteIT pattern */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {ENV_VARS.map(envVar => (
          <div
            key={envVar}
            className={cn(
              "flex items-center gap-1.5 p-2 rounded-lg border",
              configured
                ? "bg-green-50 border-green-200"
                : "bg-slate-50 border-slate-200"
            )}
          >
            {configured ? (
              <CheckCircle2 className="w-3 h-3 text-green-600 shrink-0" />
            ) : (
              <XCircle className="w-3 h-3 text-slate-400 shrink-0" />
            )}
            <span className={cn(
              "text-[10px] font-medium truncate",
              configured ? "text-green-800" : "text-slate-500"
            )}>
              {envVar}
            </span>
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-500">
        Credentials configured via Railway environment variables.
      </p>

      {/* Excluded IDs */}
      {configured && (
        <div className="space-y-2">
          <label className="text-xs font-medium text-slate-700">
            Excluded Customer IDs (comma separated)
          </label>
          <div className="flex gap-2">
            <Input
              value={excludedIds}
              onChange={(e) => setExcludedIds(e.target.value)}
              placeholder="123, 456"
              className="text-xs flex-1"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleSaveExcludedIds}
              disabled={savingExcluded}
            >
              {savingExcluded ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Save'}
            </Button>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      {configured && (
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleTestConnection}
            disabled={testStatus === 'loading'}
            className="flex-1"
          >
            {testStatus === 'loading' ? (
              <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : testStatus === 'success' ? (
              <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-green-600" />
            ) : testStatus === 'error' ? (
              <AlertCircle className="w-3.5 h-3.5 mr-1.5 text-red-600" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            )}
            Test Connection
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSync}
            disabled={syncing}
            className="flex-1"
          >
            <RefreshCw className={cn("w-3.5 h-3.5 mr-1.5", syncing && "animate-spin")} />
            Sync Now
          </Button>
        </div>
      )}

      {/* Test result message */}
      {testMessage && (
        <div className={cn(
          "text-xs p-3 rounded-lg border",
          testStatus === 'success'
            ? "bg-green-50 border-green-200 text-green-800"
            : testStatus === 'error'
              ? "bg-red-50 border-red-200 text-red-800"
              : "bg-slate-50 border-slate-200 text-slate-800"
        )}>
          <p className="font-medium">{testMessage}</p>
          {testDebug && (
            <pre className="mt-2 text-[10px] bg-white/50 p-2 rounded overflow-x-auto whitespace-pre-wrap">
              {typeof testDebug === 'string' ? testDebug : JSON.stringify(testDebug, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
