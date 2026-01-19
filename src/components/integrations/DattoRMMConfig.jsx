import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Monitor, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle,
  Link2,
  Building2,
  Trash2,
  Wand2,
  Search,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from "@/lib/utils";

export default function DattoRMMConfig() {
  const [testing, setTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [loadingSites, setLoadingSites] = useState(false);
  const [dattoSites, setDattoSites] = useState([]);
  const [showMappingView, setShowMappingView] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [automapping, setAutomapping] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState('all'); // 'all', 'mapped', 'unmapped'
  const [currentPage, setCurrentPage] = useState(1);
  const [siteSelections, setSiteSelections] = useState({}); // siteId -> customerId
  const itemsPerPage = 10;

  const queryClient = useQueryClient();

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
  });

  const { data: mappings = [], refetch: refetchMappings } = useQuery({
    queryKey: ['datto_mappings'],
    queryFn: () => base44.entities.DattoSiteMapping.list(),
  });

  const testConnection = async () => {
    setTesting(true);
    try {
      const response = await base44.functions.invoke('syncDattoRMMDevices', { action: 'test_connection' });
      if (response.data.success) {
        setConnectionStatus({ success: true, account: response.data.account });
        toast.success(`Connected to ${response.data.account.name}`);
      } else {
        setConnectionStatus({ success: false, error: response.data.error });
        toast.error(response.data.error || 'Connection failed');
      }
    } catch (error) {
      setConnectionStatus({ success: false, error: error.message });
      toast.error(error.message);
    } finally {
      setTesting(false);
    }
  };

  const loadDattoSites = async () => {
    setLoadingSites(true);
    try {
      const response = await base44.functions.invoke('syncDattoRMMDevices', { action: 'list_sites' });
      if (response.data.success) {
        setDattoSites(response.data.sites);
        setShowMappingDialog(true);
      } else {
        toast.error(response.data.error || 'Failed to load sites');
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoadingSites(false);
    }
  };

  const createMapping = async () => {
    if (!selectedCustomer || !selectedSite) {
      toast.error('Please select both a customer and a Datto site');
      return;
    }

    const site = dattoSites.find(s => s.id === selectedSite || s.uid === selectedSite);
    
    try {
      await base44.entities.DattoSiteMapping.create({
        customer_id: selectedCustomer,
        datto_site_id: String(site.id || site.uid),
        datto_site_name: site.name
      });
      toast.success('Site mapped successfully!');
      refetchMappings();
      setSelectedCustomer('');
      setSelectedSite('');
    } catch (error) {
      toast.error(error.message);
    }
  };

  const deleteMapping = async (mappingId) => {
    try {
      await base44.entities.DattoSiteMapping.delete(mappingId);
      toast.success('Mapping removed');
      refetchMappings();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const autoMapSites = async () => {
    setAutomapping(true);
    try {
      const response = await base44.functions.invoke('syncDattoRMMDevices', { action: 'automap' });
      if (response.data.success) {
        if (response.data.mappedCount > 0) {
          toast.success(`Auto-mapped ${response.data.mappedCount} sites to customers!`);
        } else {
          toast.info('No new matches found. Sites may already be mapped or names don\'t match.');
        }
        refetchMappings();
      } else {
        toast.error(response.data.error || 'Auto-map failed');
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setAutomapping(false);
    }
  };

  const syncAllDevices = async () => {
    setSyncing(true);
    try {
      const response = await base44.functions.invoke('syncDattoRMMDevices', { action: 'sync_all' });
      if (response.data.success) {
        toast.success(`Synced ${response.data.recordsSynced} devices!`);
        queryClient.invalidateQueries({ queryKey: ['devices'] });
      } else {
        toast.error(response.data.error || 'Sync failed');
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSyncing(false);
    }
  };

  const getCustomerName = (customerId) => {
    const customer = customers.find(c => c.id === customerId);
    return customer?.name || 'Unknown';
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
            <Monitor className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">Datto RMM</h3>
            <p className="text-sm text-slate-500">Sync devices and monitoring data</p>
          </div>
        </div>
        {connectionStatus?.success && (
          <Badge className="bg-emerald-100 text-emerald-700">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Connected
          </Badge>
        )}
      </div>

      <div className="space-y-4">
        {/* Test Connection */}
        <div className="flex items-center gap-3">
          <Button
            onClick={testConnection}
            disabled={testing}
            variant="outline"
            className="gap-2"
          >
            <RefreshCw className={cn("w-4 h-4", testing && "animate-spin")} />
            Test Connection
          </Button>
          
          {connectionStatus && (
            <span className={cn(
              "text-sm",
              connectionStatus.success ? "text-emerald-600" : "text-red-600"
            )}>
              {connectionStatus.success 
                ? `Connected to ${connectionStatus.account?.name}` 
                : connectionStatus.error}
            </span>
          )}
        </div>

        {/* Site Mappings */}
        <div className="border-t border-slate-100 pt-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-slate-900">Site Mappings</h4>
            <div className="flex items-center gap-2">
              <Button
                onClick={autoMapSites}
                disabled={automapping}
                size="sm"
                variant="outline"
                className="gap-2"
              >
                <Wand2 className={cn("w-4 h-4", automapping && "animate-spin")} />
                Auto-Map
              </Button>
              <Button
                onClick={loadDattoSites}
                disabled={loadingSites}
                size="sm"
                variant="outline"
                className="gap-2"
              >
                <Link2 className={cn("w-4 h-4", loadingSites && "animate-spin")} />
                Map Site
              </Button>
              {mappings.length > 0 && (
                <Button
                  onClick={syncAllDevices}
                  disabled={syncing}
                  size="sm"
                  className="gap-2 bg-blue-600 hover:bg-blue-700"
                >
                  <RefreshCw className={cn("w-4 h-4", syncing && "animate-spin")} />
                  Sync All Devices
                </Button>
              )}
            </div>
          </div>

          {mappings.length === 0 ? (
            <p className="text-sm text-slate-500 py-4 text-center">
              No sites mapped yet. Click "Map Site" to link Datto sites to customers.
            </p>
          ) : (
            <div className="space-y-2">
              {mappings.map(mapping => (
                <div 
                  key={mapping.id} 
                  className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <Building2 className="w-4 h-4 text-slate-400" />
                    <div>
                      <p className="font-medium text-slate-900">{getCustomerName(mapping.customer_id)}</p>
                      <p className="text-sm text-slate-500">→ {mapping.datto_site_name}</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteMapping(mapping.id)}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Mapping Dialog */}
      <Dialog open={showMappingDialog} onOpenChange={setShowMappingDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Map Datto Site to Customer</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">Customer</label>
              <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map(customer => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">Datto Site</label>
              <Select value={selectedSite} onValueChange={setSelectedSite}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a Datto site" />
                </SelectTrigger>
                <SelectContent>
                  {dattoSites.map(site => (
                    <SelectItem key={site.id || site.uid} value={String(site.id || site.uid)}>
                      {site.name} ({site.deviceCount} devices)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setShowMappingDialog(false)}>
                Cancel
              </Button>
              <Button onClick={createMapping} className="bg-blue-600 hover:bg-blue-700">
                Create Mapping
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}