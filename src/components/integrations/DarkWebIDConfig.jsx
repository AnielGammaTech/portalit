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
  Shield,
  Plus,
  Trash2,
  Upload,
  FileText,
  Building2,
  Eye,
  Loader2,
  XCircle,
  ChevronDown,
  RefreshCw,
  Globe,
  Clock,
  CheckCircle2,
  Search,
  Key,
} from 'lucide-react';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import { cn } from "@/lib/utils";

// ── Tab constants ───────────────────────────────────────────────────────

const TABS = [
  { id: 'api', label: 'API Sync', icon: Globe },
  { id: 'reports', label: 'PDF Reports', icon: FileText },
];

export default function DarkWebIDConfig() {
  const [activeTab, setActiveTab] = useState('api');

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
          <Shield className="w-5 h-5 text-red-600" />
        </div>
        <div>
          <h3 className="font-semibold text-slate-900">Dark Web ID</h3>
          <p className="text-sm text-slate-500">Monitor dark web compromises via API or uploaded reports</p>
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
// API Sync Tab
// ═══════════════════════════════════════════════════════════════════════

function APISyncTab() {
  const [showMapModal, setShowMapModal] = useState(false);
  const [errorDetails, setErrorDetails] = useState(null);
  const [showErrorDetails, setShowErrorDetails] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [fetchingIP, setFetchingIP] = useState(false);
  const [serverIP, setServerIP] = useState(null);
  const [syncingId, setSyncingId] = useState(null);
  const [syncingAll, setSyncingAll] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [selectedOrg, setSelectedOrg] = useState('');
  const [orgs, setOrgs] = useState([]);
  const [loadingOrgs, setLoadingOrgs] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const queryClient = useQueryClient();

  const { data: mappings = [], isLoading: loadingMappings, refetch: refetchMappings } = useQuery({
    queryKey: ['darkweb-mappings'],
    queryFn: () => client.entities.DarkWebIDMapping.list('customer_name', 100),
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => client.entities.Customer.list('name', 500),
  });

  const availableCustomers = customers.filter(c =>
    !mappings.some(m => m.customer_id === c.id)
  );

  const getServerIP = async () => {
    setFetchingIP(true);
    try {
      const response = await client.functions.invoke('syncDarkWebID', {
        action: 'get_outgoing_ip',
      });
      if (response.outgoing_ip) {
        setServerIP(response.outgoing_ip);
        toast.success(`Server IP: ${response.outgoing_ip}`);
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setFetchingIP(false);
    }
  };

  const testConnection = async () => {
    setTesting(true);
    setTestResult(null);
    setErrorDetails(null);
    try {
      const response = await client.functions.invoke('syncDarkWebID', {
        action: 'test_connection',
      });
      if (response.outgoing_ip) {
        setServerIP(response.outgoing_ip);
      }
      if (response.success) {
        setTestResult(response);
        setOrgs(response.organizations || []);
        toast.success('Connection successful!');
      } else {
        setErrorDetails(JSON.stringify(response, null, 2));
        toast.error(response.error || 'Connection failed');
      }
    } catch (error) {
      setErrorDetails(error.message);
      toast.error(error.message);
    } finally {
      setTesting(false);
    }
  };

  const fetchOrgs = async () => {
    setLoadingOrgs(true);
    try {
      const response = await client.functions.invoke('syncDarkWebID', {
        action: 'list_organizations',
      });
      if (response.success) {
        setOrgs(response.organizations || []);
      } else {
        toast.error(response.error || 'Failed to fetch organizations');
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoadingOrgs(false);
    }
  };

  const handleOpenMapModal = async () => {
    setShowMapModal(true);
    setSelectedCustomer('');
    setSelectedOrg('');
    if (orgs.length === 0) {
      await fetchOrgs();
    }
  };

  const handleSaveMapping = async () => {
    if (!selectedCustomer || !selectedOrg) {
      toast.error('Select both a customer and a Dark Web ID organization');
      return;
    }

    setIsSaving(true);
    try {
      const customer = customers.find(c => c.id === selectedCustomer);
      const org = orgs.find(o => (o.uuid || o.id) === selectedOrg);

      await client.entities.DarkWebIDMapping.create({
        customer_id: selectedCustomer,
        customer_name: customer?.name,
        darkweb_organization_uuid: selectedOrg,
        darkweb_org_name: org?.name || org?.organization_name || selectedOrg,
      });

      toast.success('Mapping created');
      refetchMappings();
      setShowMapModal(false);
    } catch (error) {
      toast.error(error.message || 'Failed to save mapping');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (mappingId) => {
    if (!confirm('Remove this Dark Web ID mapping?')) return;
    try {
      await client.entities.DarkWebIDMapping.delete(mappingId);
      toast.success('Mapping removed');
      refetchMappings();
    } catch (error) {
      toast.error(error.message || 'Failed to delete');
    }
  };

  const handleSync = async (customerId) => {
    setSyncingId(customerId);
    try {
      const response = await client.functions.invoke('syncDarkWebID', {
        action: 'sync_customer',
        customer_id: customerId,
      });
      if (response.success) {
        toast.success(`Synced ${response.synced} new compromises (${response.skipped} existing)`);
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
    if (mappings.length === 0) return;
    setSyncingAll(true);
    setErrorDetails(null);
    let succeeded = 0;
    let failed = 0;
    const errors = [];

    for (const mapping of mappings) {
      try {
        const response = await client.functions.invoke('syncDarkWebID', {
          action: 'sync_customer',
          customer_id: mapping.customer_id,
        });
        if (response.success) succeeded++;
        else {
          failed++;
          errors.push(`${mapping.customer_name}: ${response.error}`);
        }
      } catch (error) {
        failed++;
        errors.push(`${mapping.customer_name}: ${error.message}`);
      }
    }

    if (failed > 0) {
      setErrorDetails(errors.join('\n'));
      toast.error(`${failed} failed, ${succeeded} succeeded`);
    } else {
      toast.success(`Synced all ${succeeded} customers`);
    }
    refetchMappings();
    setSyncingAll(false);
  };

  const filteredMappings = mappings.filter(m => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (m.customer_name || '').toLowerCase().includes(q) ||
           (m.darkweb_org_name || '').toLowerCase().includes(q);
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

      {/* Setup Guide */}
      <div className="bg-gradient-to-br from-red-50 to-orange-50 border border-red-200 rounded-xl p-5 space-y-4">
        <p className="text-sm font-semibold text-red-900">Setup Instructions</p>
        <ol className="text-sm text-red-800 space-y-2 list-decimal list-inside">
          <li>Click <strong>"Get Server IP"</strong> below to find the backend's outgoing IP address</li>
          <li>Whitelist that IP in your <strong>Dark Web ID portal</strong> → Settings → API Access</li>
          <li>Set <code className="bg-red-100 px-1.5 py-0.5 rounded text-xs font-mono">DARKWEBID_USERNAME</code> and <code className="bg-red-100 px-1.5 py-0.5 rounded text-xs font-mono">DARKWEBID_PASSWORD</code> in Railway env vars</li>
          <li>Click <strong>"Test Connection"</strong> to verify everything works</li>
        </ol>

        {/* Server IP Display */}
        {serverIP && (
          <div className="flex items-center gap-3 bg-white/80 rounded-lg border border-red-200 p-3">
            <Key className="w-5 h-5 text-red-500 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-xs text-red-600 font-medium">Server Outgoing IP (whitelist this)</p>
              <p className="text-lg font-mono font-bold text-slate-900 tracking-wide">{serverIP}</p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="text-xs"
              onClick={() => {
                navigator.clipboard.writeText(serverIP);
                toast.success('IP copied to clipboard');
              }}
            >
              Copy
            </Button>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="outline" onClick={getServerIP} disabled={fetchingIP}>
          <Globe className={cn("w-4 h-4 mr-2", fetchingIP && "animate-pulse")} />
          {fetchingIP ? 'Fetching...' : 'Get Server IP'}
        </Button>
        <Button variant="outline" onClick={testConnection} disabled={testing}>
          <RefreshCw className={cn("w-4 h-4 mr-2", testing && "animate-spin")} />
          Test Connection
        </Button>
        {testResult?.success && (
          <Badge className="bg-emerald-100 text-emerald-700">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Connected — {testResult.organizations?.length || 0} organizations
          </Badge>
        )}
      </div>

      {/* Actions Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {mappings.length > 0 && (
            <Button variant="outline" onClick={handleSyncAll} disabled={syncingAll}>
              <RefreshCw className={cn("w-4 h-4 mr-2", syncingAll && "animate-spin")} />
              {syncingAll ? 'Syncing...' : 'Sync All'}
            </Button>
          )}
        </div>
        <Button onClick={handleOpenMapModal}>
          <Plus className="w-4 h-4 mr-2" />
          Map Customer
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
              const isSyncing = syncingId === mapping.customer_id;
              return (
                <div key={mapping.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Building2 className="w-5 h-5 text-slate-400 flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-slate-900">{mapping.customer_name}</p>
                        {mapping.darkweb_org_name && (
                          <Badge variant="outline" className="text-xs font-normal text-slate-500">
                            {mapping.darkweb_org_name}
                          </Badge>
                        )}
                      </div>
                      {mapping.last_sync && (
                        <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3" />
                          Synced {formatDistanceToNow(new Date(mapping.last_sync), { addSuffix: true })}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSync(mapping.customer_id)}
                      disabled={isSyncing}
                      className="text-xs h-7"
                    >
                      <RefreshCw className={cn("w-3 h-3 mr-1", isSyncing && "animate-spin")} />
                      Sync
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(mapping.id)}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 h-7 w-7"
                    >
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
          <Shield className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No customers mapped</p>
          <p className="text-sm text-slate-400 mt-1">Test connection first, then map customers to Dark Web ID organizations</p>
        </div>
      )}

      {/* Map Customer Modal */}
      <Dialog open={showMapModal} onOpenChange={setShowMapModal}>
        <DialogContent className="max-w-lg" style={{ zIndex: 9999 }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-red-600" />
              Map Customer to Dark Web ID Organization
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
                  {availableCustomers.map(customer => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <Label>Dark Web ID Organization</Label>
                <Button variant="ghost" size="sm" onClick={fetchOrgs} disabled={loadingOrgs} className="h-6 text-xs">
                  <RefreshCw className={cn("w-3 h-3 mr-1", loadingOrgs && "animate-spin")} />
                  Refresh
                </Button>
              </div>
              <Select value={selectedOrg} onValueChange={setSelectedOrg}>
                <SelectTrigger>
                  <SelectValue placeholder={loadingOrgs ? "Loading..." : "Select organization..."} />
                </SelectTrigger>
                <SelectContent style={{ zIndex: 10000 }}>
                  {orgs.map(org => (
                    <SelectItem key={org.uuid || org.id} value={org.uuid || org.id}>
                      {org.name || org.organization_name || org.uuid}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setShowMapModal(false)}>Cancel</Button>
              <Button onClick={handleSaveMapping} disabled={isSaving || !selectedCustomer || !selectedOrg}>
                {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                {isSaving ? 'Saving...' : 'Create Mapping'}
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
    queryKey: ['darkwebid-reports'],
    queryFn: () => client.entities.DarkWebIDReport.list('-report_date', 100),
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
        prompt: `You are analyzing a Dark Web ID business report PDF (monthly or quarterly). Extract ALL data carefully.

IMPORTANT: Read EVERY page of this PDF thoroughly. Do not stop at the cover page.

Look for these sections across all pages:
- **Cover/Header**: Customer/organization name (e.g. "Prepared for XXXX" or company name in header), date range
- **Summary/Overview**: Total compromises count, new compromises, monitoring statistics
- **Monitoring Details**: Compromise counts by category (Domains, Personal Emails, IPs), breach counts
- **Organizational Compromises**: Individual compromise entries with emails, sources, dates, passwords
- **Breaches Table**: List of breach sources with descriptions and dates

Extraction rules:
- customer_name: The organization/company name the report was prepared for
- report_date: End date of the reporting period in YYYY-MM-DD
- report_period_start / report_period_end: The full date range in YYYY-MM-DD
- total_compromises: Total number of compromises (look for large headline numbers, "Total Compromises", or count from the detail table)
- new_compromises: New compromises this period (look for "New", "Count Changes", or increases)
- Severity classification: password exposed = "critical", personal data exposed (name, address, phone) = "high", email only = "medium", other = "low"
- compromised_emails: ALL unique email addresses from compromise entries
- breach_sources: ALL breach/source names mentioned
- compromises_detail: EVERY individual compromise with email, password ("N/A" if none), source, breach_date (YYYY-MM-DD), severity

If the report shows NO compromises (e.g. "0 compromises"), still extract the customer name, dates, and set counts to 0.
If you cannot find a specific field, use 0 for numbers and empty array for lists.`,
        file_urls: [file_url],
        response_json_schema: {
          type: "object",
          properties: {
            customer_name: { type: "string", description: "Customer/organization name from the report" },
            report_date: { type: "string", description: "Report date converted to YYYY-MM-DD format" },
            report_period_start: { type: "string", description: "Report period start date YYYY-MM-DD" },
            report_period_end: { type: "string", description: "Report period end date YYYY-MM-DD" },
            total_compromises: { type: "number", description: "Total compromises found" },
            new_compromises: { type: "number", description: "New compromises since last report" },
            critical_count: { type: "number", description: "Number of critical severity" },
            high_count: { type: "number", description: "Number of high severity" },
            medium_count: { type: "number", description: "Number of medium severity" },
            low_count: { type: "number", description: "Number of low severity" },
            compromised_emails: {
              type: "array",
              items: { type: "string" },
              description: "List of compromised email addresses"
            },
            breach_sources: {
              type: "array",
              items: { type: "string" },
              description: "List of breach sources/databases"
            },
            compromises_detail: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  email: { type: "string" },
                  password: { type: "string", description: "Password if visible (may be partial/masked)" },
                  source: { type: "string", description: "Breach source" },
                  breach_date: { type: "string" },
                  severity: { type: "string", enum: ["critical", "high", "medium", "low"] }
                }
              }
            }
          }
        }
      });

      if (result) {
        setExtractedData({ ...result, pdf_url: file_url });

        // Auto-match customer using fuzzy word-token matching
        if (result.customer_name && !selectedCustomer) {
          const extractedWords = result.customer_name.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 1);
          let bestMatch = null;
          let bestScore = 0;

          for (const c of customers) {
            const customerWords = c.name.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 1);
            // Count how many extracted words appear in the customer name (or vice versa)
            const matchingWords = extractedWords.filter(ew =>
              customerWords.some(cw => cw.includes(ew) || ew.includes(cw))
            );
            const score = matchingWords.length / Math.max(extractedWords.length, 1);
            if (score > bestScore && score >= 0.4) {
              bestScore = score;
              bestMatch = c;
            }
          }

          // Also try simple substring match as fallback
          if (!bestMatch) {
            const normalizedExtracted = result.customer_name.toLowerCase().replace(/[^a-z0-9]/g, '');
            bestMatch = customers.find(c => {
              const normalizedName = c.name.toLowerCase().replace(/[^a-z0-9]/g, '');
              return normalizedName.includes(normalizedExtracted) ||
                     normalizedExtracted.includes(normalizedName);
            });
          }

          if (bestMatch) {
            setSelectedCustomer(bestMatch.id);
          }
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

      // Build the report_data JSONB with all extracted info
      const reportData = extractedData
        ? {
            total_compromises: extractedData.total_compromises || 0,
            new_compromises: extractedData.new_compromises || 0,
            critical_count: extractedData.critical_count || 0,
            high_count: extractedData.high_count || 0,
            medium_count: extractedData.medium_count || 0,
            low_count: extractedData.low_count || 0,
            compromised_emails: extractedData.compromised_emails || [],
            breach_sources: extractedData.breach_sources || [],
            compromises_detail: extractedData.compromises_detail || [],
            customer_name_extracted: extractedData.customer_name || null,
          }
        : null;

      await client.entities.DarkWebIDReport.create({
        customer_id: selectedCustomer,
        customer_name: customer?.name,
        report_date: reportDate,
        report_period_start: periodStart || null,
        report_period_end: periodEnd || null,
        pdf_url: pdfUrl,
        report_data: reportData,
        total_compromises: extractedData?.total_compromises || 0,
        new_compromises: extractedData?.new_compromises || 0,
        critical_count: extractedData?.critical_count || 0,
        high_count: extractedData?.high_count || 0,
        medium_count: extractedData?.medium_count || 0,
        low_count: extractedData?.low_count || 0,
        compromised_emails: extractedData?.compromised_emails ? JSON.stringify(extractedData.compromised_emails) : null,
        breach_sources: extractedData?.breach_sources ? JSON.stringify(extractedData.breach_sources) : null,
        compromises_detail: extractedData?.compromises_detail ? JSON.stringify(extractedData.compromises_detail) : null,
      });

      toast.success('Report saved successfully');
      setErrorDetails(null);
      queryClient.invalidateQueries({ queryKey: ['darkwebid-reports'] });
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
    if (!confirm('Are you sure you want to delete this report?')) return;
    try {
      await client.entities.DarkWebIDReport.delete(reportId);
      toast.success('Report deleted');
      queryClient.invalidateQueries({ queryKey: ['darkwebid-reports'] });
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
      <div className="bg-red-50 border border-red-200 rounded-xl p-4">
        <p className="text-sm text-red-800">
          <strong>PDF Upload:</strong> Export your Dark Web ID reports as PDF and upload them here.
          AI will automatically extract customer name, compromises, severity breakdown, and breach details for QBR reporting.
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
              <TableHead>Total</TableHead>
              <TableHead>Critical</TableHead>
              <TableHead>High</TableHead>
              <TableHead>New</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loadingReports ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto text-slate-400" />
                </TableCell>
              </TableRow>
            ) : reports.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  <Shield className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-slate-500">No reports uploaded yet</p>
                  <p className="text-sm text-slate-400">Upload a Dark Web ID report to get started</p>
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
                      {report.total_compromises || 0}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {report.critical_count > 0 ? (
                      <Badge variant="destructive">{report.critical_count}</Badge>
                    ) : (
                      <span className="text-slate-400">0</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {report.high_count > 0 ? (
                      <Badge className="bg-orange-100 text-orange-700">{report.high_count}</Badge>
                    ) : (
                      <span className="text-slate-400">0</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {report.new_compromises > 0 ? (
                      <span className="text-red-600 font-medium">+{report.new_compromises}</span>
                    ) : (
                      <span className="text-emerald-600">0</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {report.pdf_url && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(report.pdf_url, '_blank')}
                        >
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
        <DialogContent className="max-w-2xl w-[92vw] overflow-visible" style={{ zIndex: 9999 }}>
          {/* Header */}
          <div className="bg-gradient-to-r from-red-600 to-red-700 -m-6 mb-0 p-5 rounded-t-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-white">
                <Upload className="w-5 h-5" />
                Upload Dark Web ID Report
              </DialogTitle>
              <p className="text-red-200 text-sm mt-1">Upload a PDF report and AI will extract compromise data automatically</p>
            </DialogHeader>
          </div>

          <div className="space-y-5 pt-5">
            {/* Customer Select */}
            <div>
              <Label className="text-sm font-medium">Customer</Label>
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
              {extractedData?.customer_name && !selectedCustomer && (
                <p className="text-xs text-amber-600 mt-1">
                  Detected: "<strong>{extractedData.customer_name}</strong>" — please select matching customer
                </p>
              )}
            </div>

            {/* Date Fields */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label className="text-sm font-medium">Report Date</Label>
                <Input
                  type="date"
                  value={reportDate}
                  onChange={(e) => setReportDate(e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label className="text-sm font-medium">Period Start</Label>
                <Input
                  type="date"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label className="text-sm font-medium">Period End</Label>
                <Input
                  type="date"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                  className="mt-1.5"
                />
              </div>
            </div>

            {/* File Upload Zone */}
            <div>
              <Label className="text-sm font-medium">PDF Report</Label>
              <div className={cn(
                "mt-1.5 border-2 border-dashed rounded-xl p-6 text-center transition-colors",
                selectedFile ? "border-red-300 bg-red-50" : "border-slate-300 bg-slate-50 hover:border-red-400 hover:bg-red-50/50"
              )}>
                {selectedFile ? (
                  <div className="flex items-center justify-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
                      <FileText className="w-5 h-5 text-red-600" />
                    </div>
                    <div className="text-left min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{selectedFile.name}</p>
                      <p className="text-xs text-slate-500">{(selectedFile.size / 1024).toFixed(0)} KB</p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-600 hover:text-red-700 hover:bg-red-100 ml-2"
                      onClick={() => {
                        setSelectedFile(null);
                        setExtractedData(null);
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <label className="cursor-pointer block">
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <Upload className="w-10 h-10 mx-auto mb-3 text-slate-400" />
                    <p className="text-sm font-medium text-slate-700">Click to select PDF</p>
                    <p className="text-xs text-slate-400 mt-1">Dark Web ID monthly or quarterly report</p>
                  </label>
                )}
              </div>
            </div>

            {/* Extracting State */}
            {isExtracting && (
              <div className="flex items-center justify-center gap-3 py-4 bg-red-50 rounded-lg border border-red-200">
                <Loader2 className="w-5 h-5 animate-spin text-red-600" />
                <span className="text-sm font-medium text-red-700">Extracting data from PDF with AI...</span>
              </div>
            )}

            {/* Extracted Data Preview */}
            {extractedData && !isExtracting && (
              <div className="bg-gradient-to-br from-red-50 to-orange-50 border border-red-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <p className="text-sm font-semibold text-slate-900">Extracted Data</p>
                </div>

                {extractedData.customer_name && (
                  <p className="text-sm text-slate-700">
                    Customer: <strong>{extractedData.customer_name}</strong>
                  </p>
                )}
                {extractedData.report_period_start && extractedData.report_period_end && (
                  <p className="text-sm text-slate-600">
                    Period: <strong>{extractedData.report_period_start}</strong> to <strong>{extractedData.report_period_end}</strong>
                  </p>
                )}

                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Total', value: extractedData.total_compromises || 0, color: 'text-slate-900' },
                    { label: 'New', value: `+${extractedData.new_compromises || 0}`, color: 'text-red-600' },
                    { label: 'Critical', value: extractedData.critical_count || 0, color: 'text-red-600' },
                    { label: 'High', value: extractedData.high_count || 0, color: 'text-orange-600' },
                    { label: 'Medium', value: extractedData.medium_count || 0, color: 'text-yellow-600' },
                    { label: 'Low', value: extractedData.low_count || 0, color: 'text-slate-500' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="bg-white/60 rounded-lg px-3 py-2 text-center">
                      <p className="text-xs text-slate-500">{label}</p>
                      <p className={cn("text-lg font-bold", color)}>{value}</p>
                    </div>
                  ))}
                </div>

                {(extractedData.compromised_emails?.length > 0 || extractedData.breach_sources?.length > 0) && (
                  <div className="flex gap-4 text-xs text-slate-600 pt-1">
                    {extractedData.compromised_emails?.length > 0 && (
                      <span>📧 {extractedData.compromised_emails.length} compromised emails</span>
                    )}
                    {extractedData.breach_sources?.length > 0 && (
                      <span>🔓 {extractedData.breach_sources.length} breach sources</span>
                    )}
                    {extractedData.compromises_detail?.length > 0 && (
                      <span>📋 {extractedData.compromises_detail.length} detail entries</span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
              <Button variant="outline" onClick={resetForm}>
                Cancel
              </Button>
              <Button
                onClick={handleSaveReport}
                disabled={isUploading || !selectedCustomer || !reportDate}
                className="bg-red-600 hover:bg-red-700"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Save Report
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
