import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Shield, 
  RefreshCw, 
  AlertTriangle,
  CheckCircle2,
  Eye,
  Mail,
  Calendar,
  AlertCircle
} from 'lucide-react';
import { cn } from "@/lib/utils";
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';

export default function DarkWebTab({ customerId }) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const queryClient = useQueryClient();

  const { data: mapping } = useQuery({
    queryKey: ['darkwebid-mapping', customerId],
    queryFn: async () => {
      const mappings = await base44.entities.DarkWebIDMapping.filter({ customer_id: customerId });
      return mappings[0] || null;
    },
    enabled: !!customerId
  });

  const { data: compromises = [], isLoading } = useQuery({
    queryKey: ['darkweb-compromises', customerId],
    queryFn: () => base44.entities.DarkWebCompromise.filter({ customer_id: customerId }),
    enabled: !!customerId
  });

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const response = await base44.functions.invoke('syncDarkWebID', {
        action: 'sync_customer',
        customer_id: customerId
      });
      if (response.data.success) {
        toast.success(`Synced ${response.data.synced} new compromises`);
        queryClient.invalidateQueries({ queryKey: ['darkweb-compromises', customerId] });
        queryClient.invalidateQueries({ queryKey: ['darkwebid-mapping', customerId] });
      } else {
        toast.error(response.data.error || 'Sync failed');
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleUpdateStatus = async (compromiseId, newStatus) => {
    try {
      await base44.entities.DarkWebCompromise.update(compromiseId, { status: newStatus });
      toast.success('Status updated');
      queryClient.invalidateQueries({ queryKey: ['darkweb-compromises', customerId] });
    } catch (error) {
      toast.error(error.message);
    }
  };

  const filteredCompromises = statusFilter === 'all' 
    ? compromises 
    : compromises.filter(c => c.status === statusFilter);

  const stats = {
    total: compromises.length,
    new: compromises.filter(c => c.status === 'new').length,
    acknowledged: compromises.filter(c => c.status === 'acknowledged').length,
    resolved: compromises.filter(c => c.status === 'resolved').length,
    critical: compromises.filter(c => c.severity === 'critical').length,
    high: compromises.filter(c => c.severity === 'high').length
  };

  if (!mapping) {
    return (
      <div className="bg-slate-50 rounded-xl border border-slate-200 p-8 text-center">
        <Shield className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-slate-900 mb-2">Dark Web ID Not Configured</h3>
        <p className="text-slate-500 mb-4">
          This customer hasn't been mapped to a Dark Web ID organization yet.
        </p>
        <p className="text-sm text-slate-400">
          Go to Adminland → Integrations → Dark Web ID to set up the mapping.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{stats.new}</p>
              <p className="text-sm text-slate-500">New Alerts</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
              <Eye className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{stats.acknowledged}</p>
              <p className="text-sm text-slate-500">Acknowledged</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{stats.resolved}</p>
              <p className="text-sm text-slate-500">Resolved</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
              <Shield className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
              <p className="text-sm text-slate-500">Total Found</p>
            </div>
          </div>
        </div>
      </div>

      {/* Critical/High Alert Banner */}
      {(stats.critical > 0 || stats.high > 0) && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-4">
          <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-medium text-red-900">
              {stats.critical > 0 && `${stats.critical} critical`}
              {stats.critical > 0 && stats.high > 0 && ' and '}
              {stats.high > 0 && `${stats.high} high severity`}
              {' '}compromises detected
            </p>
            <p className="text-sm text-red-700">Immediate action recommended</p>
          </div>
        </div>
      )}

      {/* Filters & Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="acknowledged">Acknowledged</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-sm text-slate-500">
            {filteredCompromises.length} compromises
          </span>
        </div>
        <div className="flex items-center gap-2">
          {mapping.last_sync && (
            <span className="text-xs text-slate-400">
              Last sync: {format(new Date(mapping.last_sync), 'MMM d, h:mm a')}
            </span>
          )}
          <Button onClick={handleSync} disabled={isSyncing}>
            <RefreshCw className={cn("w-4 h-4 mr-2", isSyncing && "animate-spin")} />
            Sync Now
          </Button>
        </div>
      </div>

      {/* Compromises Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Source/Breach</TableHead>
              <TableHead>Severity</TableHead>
              <TableHead>Discovered</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto text-slate-400" />
                </TableCell>
              </TableRow>
            ) : filteredCompromises.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  <Shield className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-slate-500">
                    {statusFilter === 'all' 
                      ? 'No compromises found' 
                      : `No ${statusFilter} compromises`}
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              filteredCompromises.map(compromise => (
                <TableRow key={compromise.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-slate-400" />
                      <span className="font-medium">{compromise.email}</span>
                    </div>
                    {compromise.domain && (
                      <p className="text-xs text-slate-400 ml-6">{compromise.domain}</p>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{compromise.source || 'Unknown'}</span>
                    {compromise.breach_date && (
                      <p className="text-xs text-slate-400">
                        Breach: {format(parseISO(compromise.breach_date), 'MMM d, yyyy')}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className={cn(
                      'text-xs',
                      compromise.severity === 'critical' && 'bg-red-100 text-red-700',
                      compromise.severity === 'high' && 'bg-orange-100 text-orange-700',
                      compromise.severity === 'medium' && 'bg-yellow-100 text-yellow-700',
                      compromise.severity === 'low' && 'bg-blue-100 text-blue-700',
                    )}>
                      {compromise.severity}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {compromise.discovered_date ? (
                      <div className="flex items-center gap-1 text-sm text-slate-600">
                        <Calendar className="w-3 h-3" />
                        {format(parseISO(compromise.discovered_date), 'MMM d, yyyy')}
                      </div>
                    ) : '-'}
                  </TableCell>
                  <TableCell>
                    <Badge className={cn(
                      'text-xs',
                      compromise.status === 'new' && 'bg-red-100 text-red-700',
                      compromise.status === 'acknowledged' && 'bg-yellow-100 text-yellow-700',
                      compromise.status === 'resolved' && 'bg-green-100 text-green-700',
                    )}>
                      {compromise.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Select 
                      value={compromise.status} 
                      onValueChange={(value) => handleUpdateStatus(compromise.id, value)}
                    >
                      <SelectTrigger className="w-32 h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="new">New</SelectItem>
                        <SelectItem value="acknowledged">Acknowledged</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}