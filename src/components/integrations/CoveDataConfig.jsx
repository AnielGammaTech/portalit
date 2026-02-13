import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { 
  Database, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle,
  Link2,
  Unlink,
  Search,
  HardDrive
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export default function CoveDataConfig() {
  const [testing, setTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [loadingPartners, setLoadingPartners] = useState(false);
  const [partners, setPartners] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [mappingCustomerId, setMappingCustomerId] = useState(null);
  const [mappingDialogOpen, setMappingDialogOpen] = useState(false);
  const [partnerSearchTerm, setPartnerSearchTerm] = useState('');

  const queryClient = useQueryClient();

  // Fetch customers
  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list()
  });

  // Fetch existing mappings
  const { data: mappings = [], refetch: refetchMappings } = useQuery({
    queryKey: ['cove-mappings'],
    queryFn: () => base44.entities.CoveDataMapping.list()
  });

  const handleTestConnection = async () => {
    setTesting(true);
    setConnectionStatus(null);
    try {
      const response = await base44.functions.invoke('syncCoveData', {
        action: 'test_connection'
      });
      if (response.data.success) {
        setConnectionStatus('success');
        toast.success('Connected to Cove API');
      } else {
        setConnectionStatus('error');
        toast.error(response.data.error || 'Connection failed');
      }
    } catch (error) {
      setConnectionStatus('error');
      toast.error(error.message);
    } finally {
      setTesting(false);
    }
  };

  const handleLoadPartners = async () => {
    setLoadingPartners(true);
    try {
      const response = await base44.functions.invoke('syncCoveData', {
        action: 'list_partners'
      });
      if (response.data.success) {
        setPartners(response.data.partners || []);
        toast.success(`Found ${response.data.partners?.length || 0} partners`);
      } else {
        toast.error(response.data.error || 'Failed to load partners');
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoadingPartners(false);
    }
  };

  const handleOpenMappingDialog = (customerId) => {
    setMappingCustomerId(customerId);
    setMappingDialogOpen(true);
    if (partners.length === 0) {
      handleLoadPartners();
    }
  };

  const handleMapCustomer = async (partner) => {
    const customer = customers.find(c => c.id === mappingCustomerId);
    if (!customer) return;

    try {
      // Check if mapping already exists
      const existingMapping = mappings.find(m => m.customer_id === mappingCustomerId);
      
      if (existingMapping) {
        await base44.entities.CoveDataMapping.update(existingMapping.id, {
          cove_partner_id: partner.id,
          cove_partner_name: partner.name
        });
      } else {
        await base44.entities.CoveDataMapping.create({
          customer_id: mappingCustomerId,
          customer_name: customer.name,
          cove_partner_id: partner.id,
          cove_partner_name: partner.name
        });
      }

      toast.success(`Mapped ${customer.name} to ${partner.name}`);
      refetchMappings();
      setMappingDialogOpen(false);
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleUnmapCustomer = async (mapping) => {
    try {
      await base44.entities.CoveDataMapping.delete(mapping.id);
      toast.success('Mapping removed');
      refetchMappings();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const getMappingForCustomer = (customerId) => {
    return mappings.find(m => m.customer_id === customerId);
  };

  const filteredCustomers = customers.filter(c => 
    c.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredPartners = partners.filter(p =>
    p.name?.toLowerCase().includes(partnerSearchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Connection Test */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5 text-blue-600" />
            Cove Data Protection
          </CardTitle>
          <CardDescription>
            Connect to N-able Cove Data Protection for backup monitoring
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Button 
              onClick={handleTestConnection}
              disabled={testing}
              variant="outline"
              className="gap-2"
            >
              <RefreshCw className={cn("w-4 h-4", testing && "animate-spin")} />
              Test Connection
            </Button>
            
            {connectionStatus === 'success' && (
              <Badge className="bg-green-100 text-green-700 gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Connected
              </Badge>
            )}
            {connectionStatus === 'error' && (
              <Badge className="bg-red-100 text-red-700 gap-1">
                <AlertCircle className="w-3 h-3" />
                Connection Failed
              </Badge>
            )}
          </div>

          <p className="text-sm text-slate-500">
            Credentials are configured via environment variables (COVE_API_USERNAME = login name, COVE_API_TOKEN = API token)
          </p>
        </CardContent>
      </Card>

      {/* Customer Mappings */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Customer Mappings</CardTitle>
              <CardDescription>Map your customers to Cove partners</CardDescription>
            </div>
            <Button 
              onClick={handleLoadPartners}
              disabled={loadingPartners}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <RefreshCw className={cn("w-4 h-4", loadingPartners && "animate-spin")} />
              Load Partners
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search customers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>Customer</TableHead>
                  <TableHead>Cove Partner</TableHead>
                  <TableHead>Last Synced</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCustomers.map(customer => {
                  const mapping = getMappingForCustomer(customer.id);
                  return (
                    <TableRow key={customer.id}>
                      <TableCell className="font-medium">{customer.name}</TableCell>
                      <TableCell>
                        {mapping ? (
                          <Badge className="bg-blue-100 text-blue-700 gap-1">
                            <HardDrive className="w-3 h-3" />
                            {mapping.cove_partner_name}
                          </Badge>
                        ) : (
                          <span className="text-slate-400">Not mapped</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {mapping?.last_synced ? (
                          <span className="text-sm text-slate-500">
                            {new Date(mapping.last_synced).toLocaleDateString()}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {mapping ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleUnmapCustomer(mapping)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Unlink className="w-4 h-4" />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenMappingDialog(customer.id)}
                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          >
                            <Link2 className="w-4 h-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Mapping Dialog */}
      <Dialog open={mappingDialogOpen} onOpenChange={setMappingDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Select Cove Partner</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search partners..."
                value={partnerSearchTerm}
                onChange={(e) => setPartnerSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            {loadingPartners ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="w-6 h-6 animate-spin text-slate-400" />
              </div>
            ) : partners.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <Database className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p>No partners found</p>
                <Button onClick={handleLoadPartners} variant="outline" size="sm" className="mt-2">
                  Load Partners
                </Button>
              </div>
            ) : (
              <div className="max-h-[300px] overflow-auto border rounded-lg">
                {filteredPartners.map(partner => (
                  <button
                    key={partner.id}
                    onClick={() => handleMapCustomer(partner)}
                    className="w-full px-4 py-3 text-left hover:bg-slate-50 border-b last:border-b-0 transition-colors"
                  >
                    <p className="font-medium text-slate-900">{partner.name}</p>
                    <p className="text-sm text-slate-500">ID: {partner.id}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}