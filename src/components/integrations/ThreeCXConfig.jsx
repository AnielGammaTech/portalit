import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { client } from '@/api/client';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Phone,
  Plus,
  Trash2,
  RefreshCw,
  Building2,
  Clock,
  CheckCircle2,
  Search,
  XCircle,
  ChevronDown,
  Loader2,
  Globe,
  Users,
  Pencil,
  Upload,
  FileText,
  Eye,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from 'date-fns';

// ── Tab constants ───────────────────────────────────────────────────────

const TABS = [
  { id: 'api', label: 'API Sync', icon: Globe },
  { id: 'reports', label: 'PDF Reports', icon: FileText },
];

export default function ThreeCXConfig() {
  const [activeTab, setActiveTab] = useState('api');

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
          <Phone className="w-5 h-5 text-emerald-600" />
        </div>
        <div>
          <h3 className="font-semibold text-slate-900">3CX VoIP</h3>
          <p className="text-sm text-slate-500">Sync extensions via API or upload reports</p>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
        {TABS.map(tab => {
          const TabIcon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition-all',
                activeTab === tab.id
                  ? 'bg-white shadow-sm text-slate-900'
                  : 'text-slate-500 hover:text-slate-700'
              )}
            >
              <TabIcon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'api' ? <APISyncTab /> : <PDFReportsTab />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// API Sync Tab (original 3CX functionality)
// ═══════════════════════════════════════════════════════════════════════

function APISyncTab() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingMapping, setEditingMapping] = useState(null);
  const [errorDetails, setErrorDetails] = useState(null);
  const [showErrorDetails, setShowErrorDetails] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [syncingId, setSyncingId] = useState(null);
  const [syncingAll, setSyncingAll] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Form state
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [instanceUrl, setInstanceUrl] = useState('');
  const [instanceName, setInstanceName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const queryClient = useQueryClient();

  const { data: mappings = [], isLoading: loadingMappings, refetch: refetchMappings } = useQuery({
    queryKey: ['threecx-mappings'],
    queryFn: () => client.entities.ThreeCXMapping.list('customer_name', 100),
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => client.entities.Customer.list('name', 500),
  });

  const availableCustomers = customers.filter(c =>
    !mappings.some(m => m.customer_id === c.id) || editingMapping
  );

  const testConnection = async () => {
    if (!instanceUrl || !apiKey) {
      toast.error('Instance URL and API key are required');
      return;
    }

    setTesting(true);
    setTestResult(null);
    setErrorDetails(null);
    try {
      const response = await client.functions.invoke('sync3CX', {
        action: 'test_connection',
        instance_url: instanceUrl,
        api_key: apiKey,
        api_secret: apiSecret || undefined
      });
      if (response.success) {
        setTestResult(response);
        toast.success(response.message || 'Connection successful!');
      } else {
        setErrorDetails(response.error || 'Connection failed');
        toast.error(response.error || 'Connection failed');
      }
    } catch (error) {
      const errMsg = error.message || 'Connection test failed';
      setErrorDetails(errMsg);
      toast.error(errMsg);
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!selectedCustomer || !instanceUrl || !apiKey) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsSaving(true);
    try {
      const customer = customers.find(c => c.id === selectedCustomer);
      const payload = {
        customer_id: selectedCustomer,
        customer_name: customer?.name,
        instance_url: instanceUrl.replace(/\/$/, ''),
        instance_name: instanceName || customer?.name,
        api_key: apiKey,
        api_secret: apiSecret || null,
      };

      if (editingMapping) {
        await client.entities.ThreeCXMapping.update(editingMapping.id, payload);
        toast.success('3CX mapping updated');
      } else {
        await client.entities.ThreeCXMapping.create(payload);
        toast.success('3CX mapping created');
      }

      refetchMappings();
      resetForm();
    } catch (error) {
      toast.error(error.message || 'Failed to save mapping');
    } finally {
      setIsSaving(false);
    }
  };

  const resetForm = () => {
    setShowAddModal(false);
    setEditingMapping(null);
    setSelectedCustomer('');
    setInstanceUrl('');
    setInstanceName('');
    setApiKey('');
    setApiSecret('');
    setTestResult(null);
    setErrorDetails(null);
  };

  const handleEdit = (mapping) => {
    setEditingMapping(mapping);
    setSelectedCustomer(mapping.customer_id);
    setInstanceUrl(mapping.instance_url || '');
    setInstanceName(mapping.instance_name || '');
    setApiKey(mapping.api_key || '');
    setApiSecret(mapping.api_secret || '');
    setTestResult(null);
    setShowAddModal(true);
  };

  const handleDelete = async (mappingId) => {
    if (!confirm('Remove this 3CX mapping?')) return;
    try {
      await client.entities.ThreeCXMapping.delete(mappingId);
      toast.success('Mapping removed');
      refetchMappings();
    } catch (error) {
      toast.error(error.message || 'Failed to delete');
    }
  };

  const handleSync = async (customerId) => {
    setSyncingId(customerId);
    try {
      const response = await client.functions.invoke('sync3CX', {
        action: 'sync_extensions',
        customer_id: customerId
      });
      if (response.success) {
        toast.success(`Synced ${response.totalExtensions} extensions (${response.userExtensions} users)`);
        refetchMappings();
      } else {
        toast.error(response.error || 'Sync failed');
      }
    } catch (error) {
      toast.error(error.message || 'Sync failed');
    } finally {
      setSyncingId(null);
    }
  };

  const handleSyncAll = async () => {
    setSyncingAll(true);
    setErrorDetails(null);
    try {
      const response = await client.functions.invoke('sync3CX', { action: 'sync_all' });
      if (response.success) {
        toast.success(`Synced ${response.synced}/${response.total} customers`);
        if (response.failed > 0) {
          setErrorDetails(`${response.failed} failed:\n${(response.errors || []).join('\n')}`);
        }
        refetchMappings();
      } else {
        setErrorDetails(response.error || 'Sync failed');
        toast.error(response.error || 'Sync all failed');
      }
    } catch (error) {
      setErrorDetails(error.message);
      toast.error(error.message);
    } finally {
      setSyncingAll(false);
    }
  };

  const filteredMappings = mappings.filter(m => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (m.customer_name || '').toLowerCase().includes(q) ||
           (m.instance_name || '').toLowerCase().includes(q) ||
           (m.instance_url || '').toLowerCase().includes(q);
  });

  return (
    <div className="space-y-5">
      {/* Error Details */}
      {errorDetails && (
        <Collapsible open={showErrorDetails} onOpenChange={setShowErrorDetails}>
          <div className="border border-red-200 bg-red-50 rounded-lg overflow-hidden">
            <CollapsibleTrigger asChild>
              <button className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-red-700 hover:bg-red-100 transition-colors">
                <div className="flex items-center gap-2">
                  <XCircle className="w-4 h-4" />
                  Error details
                </div>
                <ChevronDown className={cn("w-4 h-4 transition-transform", showErrorDetails && "rotate-180")} />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-4 pb-3 pt-1 border-t border-red-200">
                <pre className="text-xs text-red-600 whitespace-pre-wrap font-mono bg-red-100/50 rounded p-2">{errorDetails}</pre>
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>
      )}

      {/* Info */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
        <p className="text-sm text-emerald-800">
          <strong>Per-customer setup:</strong> Each customer has their own 3CX instance.
          Add each customer's 3CX URL and API key to sync their extensions.
          Extension counts are used for LootIT reconciliation against the "GTVoice extension" recurring bill.
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {mappings.length > 0 && (
            <Button variant="outline" onClick={handleSyncAll} disabled={syncingAll}>
              <RefreshCw className={cn("w-4 h-4 mr-2", syncingAll && "animate-spin")} />
              {syncingAll ? 'Syncing...' : 'Sync All'}
            </Button>
          )}
        </div>
        <Button onClick={() => { resetForm(); setShowAddModal(true); }}>
          <Plus className="w-4 h-4 mr-2" />
          Add Customer
        </Button>
      </div>

      {/* Mappings List */}
      {mappings.length > 0 && (
        <div className="space-y-3">
          {mappings.length > 5 && (
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Search customers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>
          )}

          <div className="space-y-2">
            {filteredMappings.map(mapping => {
              const cached = mapping.cached_data;
              const isSyncing = syncingId === mapping.customer_id;

              return (
                <div key={mapping.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Building2 className="w-5 h-5 text-slate-400 flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-slate-900">{mapping.customer_name}</p>
                        {cached?.user_extensions !== undefined && (
                          <Badge className="bg-emerald-100 text-emerald-700 text-xs font-normal">
                            <Phone className="w-3 h-3 mr-1" />
                            {cached.user_extensions} extensions
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        <p className="text-xs text-slate-500 flex items-center gap-1">
                          <Globe className="w-3 h-3" />
                          {mapping.instance_url}
                        </p>
                        {mapping.last_synced && (
                          <p className="text-xs text-slate-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDistanceToNow(new Date(mapping.last_synced), { addSuffix: true })}
                          </p>
                        )}
                      </div>
                      {cached && (
                        <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                          {cached.ring_groups > 0 && <span>{cached.ring_groups} ring groups</span>}
                          {cached.ivr_menus > 0 && <span>{cached.ivr_menus} IVR</span>}
                          {cached.queues > 0 && <span>{cached.queues} queues</span>}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button variant="outline" size="sm" onClick={() => handleSync(mapping.customer_id)} disabled={isSyncing} className="text-xs h-7">
                      <RefreshCw className={cn("w-3 h-3 mr-1", isSyncing && "animate-spin")} />
                      Sync
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleEdit(mapping)} className="text-xs h-7">
                      <Pencil className="w-3 h-3 mr-1" />
                      Edit
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(mapping.id)} className="text-red-500 hover:text-red-700 hover:bg-red-50 h-7 w-7">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!loadingMappings && mappings.length === 0 && (
        <div className="text-center py-8 bg-white rounded-xl border border-slate-200">
          <Phone className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No 3CX instances configured</p>
          <p className="text-sm text-slate-400 mt-1">Click "Add Customer" to connect a customer's 3CX</p>
        </div>
      )}

      {/* Add/Edit Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-lg" style={{ zIndex: 9999 }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Phone className="w-5 h-5 text-emerald-600" />
              {editingMapping ? 'Edit 3CX Connection' : 'Add 3CX Connection'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <Label>Customer</Label>
              <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Select customer..." />
                </SelectTrigger>
                <SelectContent style={{ zIndex: 10000 }}>
                  {availableCustomers
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map(customer => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>3CX Instance URL</Label>
              <Input
                placeholder="https://mycompany.3cx.us:5001"
                value={instanceUrl}
                onChange={(e) => setInstanceUrl(e.target.value)}
                className="mt-1.5"
              />
              <p className="text-xs text-slate-400 mt-1">The full URL to the 3CX web client (include port if needed)</p>
            </div>

            <div>
              <Label>Instance Name (optional)</Label>
              <Input
                placeholder="Company 3CX"
                value={instanceName}
                onChange={(e) => setInstanceName(e.target.value)}
                className="mt-1.5"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>API Key / Security Code</Label>
                <Input
                  type="password"
                  placeholder="API Key..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label>API Secret (if required)</Label>
                <Input
                  type="password"
                  placeholder="Optional..."
                  value={apiSecret}
                  onChange={(e) => setApiSecret(e.target.value)}
                  className="mt-1.5"
                />
              </div>
            </div>

            {/* Test Connection */}
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={testConnection} disabled={testing || !instanceUrl || !apiKey}>
                <RefreshCw className={cn("w-4 h-4 mr-2", testing && "animate-spin")} />
                Test Connection
              </Button>
              {testResult && (
                <Badge className="bg-emerald-100 text-emerald-700">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  {testResult.extensionCount} extensions found
                </Badge>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={resetForm}>Cancel</Button>
              <Button onClick={handleSave} disabled={isSaving || !selectedCustomer || !instanceUrl || !apiKey}>
                {isSaving ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</>
                ) : (
                  <><Plus className="w-4 h-4 mr-2" />{editingMapping ? 'Update' : 'Save'}</>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// PDF Reports Tab
// ═══════════════════════════════════════════════════════════════════════

function PDFReportsTab() {
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [errorDetails, setErrorDetails] = useState(null);
  const [showErrorDetails, setShowErrorDetails] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [reportDate, setReportDate] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedData, setExtractedData] = useState(null);
  const queryClient = useQueryClient();

  const { data: reports = [], isLoading: loadingReports } = useQuery({
    queryKey: ['threecx-reports'],
    queryFn: () => client.entities.ThreeCXReport.list('-report_date', 100),
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => client.entities.Customer.list('name', 500),
  });

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file);
      setExtractedData(null);

      if (!reportDate) {
        setReportDate(new Date().toISOString().split('T')[0]);
      }

      await extractDataFromFile(file);
    } else {
      toast.error('Please select a PDF file');
    }
  };

  const extractDataFromFile = async (file) => {
    setIsExtracting(true);
    try {
      const { file_url } = await client.integrations.Core.UploadFile({ file });

      const result = await client.integrations.Core.InvokeLLM({
        prompt: `You are analyzing a 3CX VoIP system report PDF. Extract ALL data carefully.

Look for:
- Customer/company name
- Report date or reporting period
- Total number of extensions configured
- Number of user (non-system) extensions
- Ring groups count
- Call queues count
- SIP trunks count
- Call statistics: total calls, inbound, outbound, missed
- Average call duration
- Individual extension details if listed (extension number, name, type, department)

Rules:
- customer_name: Extract the company/customer name from the report header or footer
- report_date: The report date in YYYY-MM-DD format
- report_period_start / report_period_end: The date range covered, in YYYY-MM-DD
- total_extensions: Total extensions including system ones
- user_extensions: Only user-type extensions (not parking, queues, ring groups)
- extensions_detail: Array of individual extensions with number, name, type, department if available
- call_stats: Any call volume data as key-value pairs`,
        file_urls: [file_url],
        response_json_schema: {
          type: "object",
          properties: {
            customer_name: { type: "string", description: "Customer/company name" },
            report_date: { type: "string", description: "Report date YYYY-MM-DD" },
            report_period_start: { type: "string", description: "Period start YYYY-MM-DD" },
            report_period_end: { type: "string", description: "Period end YYYY-MM-DD" },
            total_extensions: { type: "number", description: "Total extensions" },
            user_extensions: { type: "number", description: "User extensions only" },
            ring_groups: { type: "number", description: "Number of ring groups" },
            queues: { type: "number", description: "Number of call queues" },
            trunks: { type: "number", description: "Number of SIP trunks" },
            total_calls: { type: "number", description: "Total calls in period" },
            inbound_calls: { type: "number", description: "Inbound calls" },
            outbound_calls: { type: "number", description: "Outbound calls" },
            missed_calls: { type: "number", description: "Missed calls" },
            avg_call_duration: { type: "string", description: "Average call duration" },
            extensions_detail: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  number: { type: "string" },
                  name: { type: "string" },
                  type: { type: "string" },
                  department: { type: "string" }
                }
              }
            },
            call_stats: { type: "object", description: "Additional call statistics as key-value pairs" }
          }
        }
      });

      if (result) {
        setExtractedData({ ...result, pdf_url: file_url });

        if (result.customer_name && !selectedCustomer) {
          const matchedCustomer = customers.find(c => {
            const norm1 = c.name.toLowerCase().replace(/[^a-z0-9]/g, '');
            const norm2 = result.customer_name.toLowerCase().replace(/[^a-z0-9]/g, '');
            return norm1.includes(norm2) || norm2.includes(norm1);
          });
          if (matchedCustomer) setSelectedCustomer(matchedCustomer.id);
        }

        if (result.report_period_start) setPeriodStart(result.report_period_start);
        if (result.report_period_end) setPeriodEnd(result.report_period_end);
        if (result.report_date) setReportDate(result.report_date);

        toast.success('Data extracted from PDF');
      }
    } catch (error) {
      const errMsg = error.message || 'Failed to extract data from PDF';
      setErrorDetails(errMsg);
      toast.error(errMsg);
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSaveReport = async () => {
    if (!selectedCustomer || !reportDate) {
      toast.error('Please select a customer and report date');
      return;
    }

    setIsUploading(true);
    try {
      const customer = customers.find(c => c.id === selectedCustomer);

      let pdfUrl = extractedData?.pdf_url;
      if (!pdfUrl && selectedFile) {
        const { file_url } = await client.integrations.Core.UploadFile({ file: selectedFile });
        pdfUrl = file_url;
      }

      await client.entities.ThreeCXReport.create({
        customer_id: selectedCustomer,
        customer_name: customer?.name,
        report_date: reportDate,
        report_period_start: periodStart || null,
        report_period_end: periodEnd || null,
        pdf_url: pdfUrl,
        total_extensions: extractedData?.total_extensions || 0,
        user_extensions: extractedData?.user_extensions || 0,
        ring_groups: extractedData?.ring_groups || 0,
        queues: extractedData?.queues || 0,
        trunks: extractedData?.trunks || 0,
        total_calls: extractedData?.total_calls || 0,
        inbound_calls: extractedData?.inbound_calls || 0,
        outbound_calls: extractedData?.outbound_calls || 0,
        missed_calls: extractedData?.missed_calls || 0,
        avg_call_duration: extractedData?.avg_call_duration || null,
        extensions_detail: extractedData?.extensions_detail ? JSON.stringify(extractedData.extensions_detail) : null,
        call_stats: extractedData?.call_stats ? JSON.stringify(extractedData.call_stats) : null,
      });

      toast.success('Report saved successfully');
      setErrorDetails(null);
      queryClient.invalidateQueries({ queryKey: ['threecx-reports'] });
      resetForm();
    } catch (error) {
      const errMsg = error.message || 'Failed to save report';
      setErrorDetails(errMsg);
      toast.error(errMsg);
    } finally {
      setIsUploading(false);
    }
  };

  const resetForm = () => {
    setShowUploadModal(false);
    setSelectedCustomer('');
    setReportDate('');
    setPeriodStart('');
    setPeriodEnd('');
    setSelectedFile(null);
    setExtractedData(null);
  };

  const handleDeleteReport = async (reportId) => {
    if (!confirm('Delete this report?')) return;
    try {
      await client.entities.ThreeCXReport.delete(reportId);
      toast.success('Report deleted');
      queryClient.invalidateQueries({ queryKey: ['threecx-reports'] });
    } catch (error) {
      toast.error(error.message || 'Failed to delete report');
    }
  };

  return (
    <div className="space-y-5">
      {/* Error Details */}
      {errorDetails && (
        <Collapsible open={showErrorDetails} onOpenChange={setShowErrorDetails}>
          <div className="border border-red-200 bg-red-50 rounded-lg overflow-hidden">
            <CollapsibleTrigger asChild>
              <button className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-red-700 hover:bg-red-100 transition-colors">
                <div className="flex items-center gap-2">
                  <XCircle className="w-4 h-4" />
                  Error details
                </div>
                <ChevronDown className={cn("w-4 h-4 transition-transform", showErrorDetails && "rotate-180")} />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-4 pb-3 pt-1 border-t border-red-200">
                <pre className="text-xs text-red-600 whitespace-pre-wrap font-mono bg-red-100/50 rounded p-2">{errorDetails}</pre>
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>
      )}

      {/* Info */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
        <p className="text-sm text-emerald-800">
          <strong>PDF Upload:</strong> Export 3CX reports as PDF and upload them here.
          AI will automatically extract extension counts, call statistics, and other metrics for QBR reporting.
        </p>
      </div>

      {/* Upload Button */}
      <div className="flex justify-end">
        <Button onClick={() => setShowUploadModal(true)}>
          <Upload className="w-4 h-4 mr-2" />
          Upload Report
        </Button>
      </div>

      {/* Reports Table */}
      <div className="bg-white rounded-xl border border-slate-200">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>Report Date</TableHead>
              <TableHead>Period</TableHead>
              <TableHead>Extensions</TableHead>
              <TableHead>Total Calls</TableHead>
              <TableHead>Missed</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loadingReports ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto text-slate-400" />
                </TableCell>
              </TableRow>
            ) : reports.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <Phone className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-slate-500">No reports uploaded yet</p>
                  <p className="text-sm text-slate-400">Upload a 3CX report to get started</p>
                </TableCell>
              </TableRow>
            ) : (
              reports.map(report => (
                <TableRow key={report.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-slate-400" />
                      <span className="font-medium">{report.customer_name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {format(new Date(report.report_date), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell className="text-xs text-slate-500">
                    {report.report_period_start && report.report_period_end
                      ? `${format(new Date(report.report_period_start), 'MM/dd/yy')} - ${format(new Date(report.report_period_end), 'MM/dd/yy')}`
                      : '—'
                    }
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      <Phone className="w-3 h-3 mr-1" />
                      {report.user_extensions || report.total_extensions || 0}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {report.total_calls > 0 ? (
                      <span className="font-medium">{report.total_calls.toLocaleString()}</span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {report.missed_calls > 0 ? (
                      <Badge className="bg-orange-100 text-orange-700">{report.missed_calls}</Badge>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {report.pdf_url && (
                        <Button size="sm" variant="outline" onClick={() => window.open(report.pdf_url, '_blank')}>
                          <Eye className="w-3 h-3 mr-1" />
                          View
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => handleDeleteReport(report.id)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Upload Modal */}
      <Dialog open={showUploadModal} onOpenChange={setShowUploadModal}>
        <DialogContent className="max-w-lg" style={{ zIndex: 9999 }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-emerald-600" />
              Upload 3CX Report
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <Label>Customer</Label>
              <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Select customer..." />
                </SelectTrigger>
                <SelectContent style={{ zIndex: 10000 }}>
                  {customers.map(customer => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Report Date</Label>
                <Input type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} className="mt-1.5" />
              </div>
              <div>
                <Label>Period Start</Label>
                <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} className="mt-1.5" />
              </div>
              <div>
                <Label>Period End</Label>
                <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className="mt-1.5" />
              </div>
            </div>

            <div>
              <Label>PDF Report</Label>
              <div className="mt-1.5 border-2 border-dashed border-slate-200 rounded-lg p-4 text-center">
                {selectedFile ? (
                  <div className="flex items-center justify-center gap-2">
                    <FileText className="w-5 h-5 text-emerald-600" />
                    <span className="text-sm font-medium">{selectedFile.name}</span>
                    <Button size="sm" variant="ghost" onClick={() => { setSelectedFile(null); setExtractedData(null); }}>
                      Remove
                    </Button>
                  </div>
                ) : (
                  <label className="cursor-pointer">
                    <input type="file" accept=".pdf" onChange={handleFileSelect} className="hidden" />
                    <div className="text-slate-500">
                      <Upload className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                      <p className="text-sm">Click to select PDF</p>
                    </div>
                  </label>
                )}
              </div>
            </div>

            {isExtracting && (
              <div className="flex items-center justify-center gap-2 py-3 text-slate-600">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Extracting data from PDF with AI...</span>
              </div>
            )}

            {extractedData && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                <p className="text-sm font-medium text-emerald-800 mb-2">Extracted Data:</p>
                {extractedData.customer_name && (
                  <p className="text-xs text-emerald-700 mb-1">Customer: <strong>{extractedData.customer_name}</strong></p>
                )}
                <div className="grid grid-cols-3 gap-x-4 gap-y-1 text-xs">
                  <div>Extensions: <strong>{extractedData.total_extensions || 0}</strong></div>
                  <div>User Ext: <strong>{extractedData.user_extensions || 0}</strong></div>
                  <div>Ring Groups: <strong>{extractedData.ring_groups || 0}</strong></div>
                  <div>Queues: <strong>{extractedData.queues || 0}</strong></div>
                  <div>Trunks: <strong>{extractedData.trunks || 0}</strong></div>
                  <div>Total Calls: <strong>{extractedData.total_calls || 0}</strong></div>
                  <div>Inbound: <strong>{extractedData.inbound_calls || 0}</strong></div>
                  <div>Outbound: <strong>{extractedData.outbound_calls || 0}</strong></div>
                  <div>Missed: <strong className="text-orange-600">{extractedData.missed_calls || 0}</strong></div>
                </div>
                {extractedData.extensions_detail?.length > 0 && (
                  <p className="text-xs text-emerald-700 mt-2">Extensions detail: {extractedData.extensions_detail.length} entries</p>
                )}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={resetForm}>Cancel</Button>
              <Button onClick={handleSaveReport} disabled={isUploading || !selectedCustomer || !reportDate}>
                {isUploading ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</>
                ) : (
                  <><Plus className="w-4 h-4 mr-2" />Save Report</>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
