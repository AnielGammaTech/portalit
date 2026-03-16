import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { client } from '@/api/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Phone,
  Users,
  PhoneForwarded,
  Voicemail,
  Headphones,
  RefreshCw,
  Clock,
  Search,
  Globe,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

export default function ThreeCXTab({ customerId, threecxMapping, queryClient: qc }) {
  const [syncing, setSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const internalQC = useQueryClient();
  const queryClient = qc || internalQC;

  const cached = threecxMapping?.cached_data;
  const extensions = cached?.extensions || [];

  const handleSync = async () => {
    setSyncing(true);
    try {
      const response = await client.functions.invoke('sync3CX', {
        action: 'sync_extensions',
        customer_id: customerId
      });
      if (response.success) {
        toast.success(`Synced ${response.totalExtensions} extensions`);
        queryClient.invalidateQueries({ queryKey: ['threecx-mapping', customerId] });
      } else {
        toast.error(response.error || 'Sync failed');
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSyncing(false);
    }
  };

  // Filter extensions
  const userExtensions = extensions.filter(ext => {
    const type = (ext.type || '').toLowerCase();
    return type === 'user' || type === '' || type === 'extension';
  });

  const filteredExtensions = userExtensions.filter(ext => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (ext.name || '').toLowerCase().includes(q) ||
           (ext.email || '').toLowerCase().includes(q) ||
           String(ext.number || '').includes(q);
  });

  if (!threecxMapping) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-8 text-center">
        <Phone className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
        <h3 className="font-semibold text-slate-900 mb-2">3CX Not Configured</h3>
        <p className="text-sm text-slate-500">
          Go to Adminland → Integrations to add this customer's 3CX instance
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-2xl border border-emerald-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
              <Phone className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">3CX VoIP System</h3>
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Globe className="w-3.5 h-3.5" />
                {threecxMapping.instance_name || threecxMapping.instance_url}
                {threecxMapping.last_synced && (
                  <span className="text-xs text-slate-400 flex items-center gap-1 ml-2">
                    <Clock className="w-3 h-3" />
                    {formatDistanceToNow(new Date(threecxMapping.last_synced), { addSuffix: true })}
                  </span>
                )}
              </div>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSync}
            disabled={syncing}
          >
            <RefreshCw className={cn("w-4 h-4 mr-2", syncing && "animate-spin")} />
            Sync
          </Button>
        </div>
      </div>

      {/* Metrics */}
      {cached && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Extensions</p>
                  <p className="text-3xl font-bold text-slate-900 mt-1">{cached.user_extensions || 0}</p>
                  <p className="text-xs text-slate-400 mt-1">user extensions</p>
                </div>
                <Phone className="w-5 h-5 text-emerald-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Ring Groups</p>
                  <p className="text-3xl font-bold text-slate-900 mt-1">{cached.ring_groups || 0}</p>
                  <p className="text-xs text-slate-400 mt-1">configured</p>
                </div>
                <PhoneForwarded className="w-5 h-5 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">IVR Menus</p>
                  <p className="text-3xl font-bold text-slate-900 mt-1">{cached.ivr_menus || 0}</p>
                  <p className="text-xs text-slate-400 mt-1">auto attendants</p>
                </div>
                <Voicemail className="w-5 h-5 text-purple-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Queues</p>
                  <p className="text-3xl font-bold text-slate-900 mt-1">{cached.queues || 0}</p>
                  <p className="text-xs text-slate-400 mt-1">call queues</p>
                </div>
                <Headphones className="w-5 h-5 text-orange-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Extension List */}
      {userExtensions.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-slate-600">
                User Extensions ({userExtensions.length})
              </CardTitle>
              {userExtensions.length > 5 && (
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 h-7 text-xs w-40"
                  />
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5 max-h-80 overflow-y-auto">
              {filteredExtensions.map((ext, idx) => (
                <div
                  key={ext.number || idx}
                  className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-medium text-xs flex-shrink-0">
                    {ext.number || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 text-sm truncate">
                      {ext.name || `${ext.firstName || ''} ${ext.lastName || ''}`.trim() || `Ext ${ext.number}`}
                    </p>
                    {ext.email && (
                      <p className="text-xs text-slate-500 truncate">{ext.email}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {ext.registered === true ? (
                      <Badge className="bg-emerald-100 text-emerald-700 text-[10px]">
                        <CheckCircle2 className="w-2.5 h-2.5 mr-0.5" />
                        Online
                      </Badge>
                    ) : ext.registered === false ? (
                      <Badge className="bg-slate-100 text-slate-500 text-[10px]">
                        <XCircle className="w-2.5 h-2.5 mr-0.5" />
                        Offline
                      </Badge>
                    ) : null}
                  </div>
                </div>
              ))}
              {filteredExtensions.length === 0 && searchQuery && (
                <p className="text-sm text-slate-500 text-center py-4">No extensions match "{searchQuery}"</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {!cached && (
        <div className="text-center py-8 bg-white rounded-xl border border-slate-200">
          <Phone className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No data synced yet</p>
          <p className="text-sm text-slate-400 mt-1">Click "Sync" to pull extensions from 3CX</p>
        </div>
      )}
    </div>
  );
}
