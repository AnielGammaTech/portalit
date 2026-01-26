import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { 
  Users, 
  HardDrive, 
  CheckCircle2, 
  RefreshCw,
  Archive,
  Mail,
  X,
  ChevronRight
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export default function SpanningUsersTab({ customerId, spanningMapping, queryClient }) {
  const [syncingSpanning, setSyncingSpanning] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null); // 'standard', 'archived', 'shared'

  // Fetch live Spanning data from API
  const { data: spanningData, isLoading, refetch } = useQuery({
    queryKey: ['spanning-live-users', customerId],
    queryFn: async () => {
      const response = await base44.functions.invoke('syncSpanningBackup', {
        action: 'list_users',
        customer_id: customerId
      });
      return response.data;
    },
    enabled: !!customerId && !!spanningMapping,
    staleTime: 5 * 60 * 1000 // Cache for 5 minutes
  });

  const handleSyncSpanning = async () => {
    setSyncingSpanning(true);
    try {
      const response = await base44.functions.invoke('syncSpanningBackup', {
        action: 'sync_licenses',
        customer_id: customerId
      });
      if (response.data.success) {
        await refetch();
        queryClient?.invalidateQueries({ queryKey: ['spanning-contacts', customerId] });
        queryClient?.invalidateQueries({ queryKey: ['spanning-licenses', customerId] });
      }
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setSyncingSpanning(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  const stats = spanningData || {};
  
  // Calculate stats from domain-level data
  const standardLicenses = stats.numberOfStandardLicensesTotal || 0;
  const protectedStandard = stats.numberOfProtectedStandardUsers || 0;
  const archivedLicenses = stats.numberOfArchivedLicensesTotal || 0;
  const protectedArchived = stats.numberOfProtectedArchivedUsers || 0;
  const sharedMailboxes = stats.numberOfSharedMailboxesTotal || 0;
  const protectedShared = stats.numberOfProtectedSharedMailboxes || 0;
  const totalUsers = stats.numberOfUsers || 0;
  const totalProtected = stats.numberOfProtectedUsers || 0;

  const categoryConfig = {
    standard: { 
      title: 'Standard Users', 
      count: protectedStandard, 
      total: standardLicenses,
      icon: Users, 
      color: 'purple',
      description: 'Regular M365 user backups'
    },
    archived: { 
      title: 'Archived Users', 
      count: protectedArchived, 
      total: archivedLicenses,
      icon: Archive, 
      color: 'amber',
      description: 'Departed user data retention'
    },
    shared: { 
      title: 'Shared Mailboxes', 
      count: protectedShared, 
      total: sharedMailboxes,
      icon: Mail, 
      color: 'cyan',
      description: 'Shared/resource mailbox backups'
    }
  };

  return (
    <div className="space-y-4">
      {/* Domain Info */}
      <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-2xl border border-blue-100 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-blue-600 uppercase tracking-wide">Spanning Backup Domain</p>
            <p className="text-xl font-bold text-slate-900 mt-1">{stats.domainName || 'Loading...'}</p>
            <p className="text-sm text-slate-500 mt-1">Domain ID: {stats.domainId || '...'}</p>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleSyncSpanning}
            disabled={syncingSpanning}
            className="gap-2"
          >
            <RefreshCw className={cn("w-4 h-4", syncingSpanning && "animate-spin")} />
            Sync
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-200 rounded-lg">
                <Users className="w-5 h-5 text-purple-700" />
              </div>
              <div>
                <p className="text-2xl font-bold text-purple-900">{protectedStandard}</p>
                <p className="text-sm text-purple-600">Standard Users</p>
                <p className="text-xs text-purple-500">{standardLicenses} licenses</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-200 rounded-lg">
                <Archive className="w-5 h-5 text-amber-700" />
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-900">{protectedArchived}</p>
                <p className="text-sm text-amber-600">Archived Users</p>
                <p className="text-xs text-amber-500">{archivedLicenses} licenses</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-cyan-50 to-cyan-100 border-cyan-200">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-cyan-200 rounded-lg">
                <Mail className="w-5 h-5 text-cyan-700" />
              </div>
              <div>
                <p className="text-2xl font-bold text-cyan-900">{protectedShared}</p>
                <p className="text-sm text-cyan-600">Shared Mailboxes</p>
                <p className="text-xs text-cyan-500">{sharedMailboxes} total</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-200 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-green-700" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-900">{totalProtected}</p>
                <p className="text-sm text-green-600">Total Protected</p>
                <p className="text-xs text-green-500">{totalUsers} total users</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-blue-600" />
            License Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Standard Users */}
            <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-purple-600" />
                <div>
                  <p className="font-medium text-slate-900">Standard User Licenses</p>
                  <p className="text-sm text-slate-500">Regular M365 user backups</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-purple-700">{protectedStandard} / {standardLicenses}</p>
                <p className="text-xs text-slate-500">protected / total</p>
              </div>
            </div>

            {/* Archived Users */}
            <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
              <div className="flex items-center gap-3">
                <Archive className="w-5 h-5 text-amber-600" />
                <div>
                  <p className="font-medium text-slate-900">Archived User Licenses</p>
                  <p className="text-sm text-slate-500">Departed user data retention</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-amber-700">{protectedArchived} / {archivedLicenses}</p>
                <p className="text-xs text-slate-500">protected / total</p>
              </div>
            </div>

            {/* Shared Mailboxes */}
            <div className="flex items-center justify-between p-3 bg-cyan-50 rounded-lg">
              <div className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-cyan-600" />
                <div>
                  <p className="font-medium text-slate-900">Shared Mailboxes</p>
                  <p className="text-sm text-slate-500">Shared/resource mailbox backups</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-cyan-700">{protectedShared} / {sharedMailboxes}</p>
                <p className="text-xs text-slate-500">protected / total</p>
              </div>
            </div>

            {/* Total */}
            <div className="flex items-center justify-between p-4 bg-slate-100 rounded-lg border-2 border-slate-200">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-green-600" />
                <div>
                  <p className="font-semibold text-slate-900">Total Protection</p>
                  <p className="text-sm text-slate-500">All backup types combined</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-green-700">{totalProtected}</p>
                <p className="text-xs text-slate-500">protected entities</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* API Response Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-slate-500">API Response Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="p-3 bg-slate-50 rounded-lg">
              <p className="text-slate-500">Total from API</p>
              <p className="text-lg font-bold text-slate-900">{totalFromApi}</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg">
              <p className="text-slate-500">numberOfUsers</p>
              <p className="text-lg font-bold text-slate-900">{totalUsers}</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg">
              <p className="text-slate-500">numberOfProtectedUsers</p>
              <p className="text-lg font-bold text-slate-900">{totalProtected}</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg">
              <p className="text-slate-500">Standard Licenses</p>
              <p className="text-lg font-bold text-slate-900">{standardLicenses}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}