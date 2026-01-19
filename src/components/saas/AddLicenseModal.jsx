import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from '@/api/base44Client';
import { Cloud, Upload, Globe, Loader2, X, Image } from 'lucide-react';
import { cn } from "@/lib/utils";

const CATEGORIES = [
  { value: 'productivity', label: 'Productivity', icon: '📊' },
  { value: 'security', label: 'Security', icon: '🔒' },
  { value: 'collaboration', label: 'Collaboration', icon: '💬' },
  { value: 'crm', label: 'CRM & Sales', icon: '🤝' },
  { value: 'finance', label: 'Finance', icon: '💰' },
  { value: 'hr', label: 'HR & People', icon: '👥' },
  { value: 'marketing', label: 'Marketing', icon: '📣' },
  { value: 'development', label: 'Development', icon: '💻' },
  { value: 'other', label: 'Other', icon: '📦' },
];

export default function AddLicenseModal({ open, onClose, onSave, customerId }) {
  const [form, setForm] = useState({
    application_name: '',
    vendor: '',
    license_type: '',
    quantity: 1,
    cost_per_license: 0,
    billing_cycle: 'monthly',
    status: 'active',
    website_url: '',
    logo_url: '',
    category: 'other',
    renewal_date: '',
    notes: ''
  });
  const [isLoadingLogo, setIsLoadingLogo] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setForm({
        application_name: '',
        vendor: '',
        license_type: '',
        quantity: 1,
        cost_per_license: 0,
        billing_cycle: 'monthly',
        status: 'active',
        website_url: '',
        logo_url: '',
        category: 'other',
        renewal_date: '',
        notes: ''
      });
    }
  }, [open]);

  const [isLoadingInfo, setIsLoadingInfo] = useState(false);

  const fetchAppInfo = async (url) => {
    if (!url || url.length < 5) return;
    setIsLoadingLogo(true);
    setIsLoadingInfo(true);
    
    try {
      // Extract domain
      let domain = url;
      if (url.includes('://')) {
        domain = url.split('://')[1];
      }
      domain = domain.split('/')[0];
      
      // Try to get logo from multiple sources
      const clearbitLogo = `https://logo.clearbit.com/${domain}`;
      const googleFavicon = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
      
      // Test clearbit first
      try {
        const response = await fetch(clearbitLogo, { method: 'HEAD' });
        if (response.ok) {
          setForm(prev => ({ ...prev, logo_url: clearbitLogo }));
        } else {
          setForm(prev => ({ ...prev, logo_url: googleFavicon }));
        }
      } catch {
        setForm(prev => ({ ...prev, logo_url: googleFavicon }));
      }
      setIsLoadingLogo(false);

      // Use AI to get app info
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Research this software/SaaS application website: ${domain}
        
Provide information about this application. If you don't know it, make reasonable assumptions based on the domain name.

Return JSON with:
- name: The official application name
- vendor: The company that makes it
- description: A brief 1-2 sentence description of what the app does
- category: One of: productivity, security, collaboration, crm, finance, hr, marketing, development, other`,
        response_json_schema: {
          type: "object",
          properties: {
            name: { type: "string" },
            vendor: { type: "string" },
            description: { type: "string" },
            category: { type: "string" }
          }
        },
        add_context_from_internet: true
      });

      if (result) {
        setForm(prev => ({
          ...prev,
          application_name: prev.application_name || result.name || '',
          vendor: prev.vendor || result.vendor || '',
          notes: prev.notes || result.description || '',
          category: result.category || prev.category
        }));
      }
    } catch (error) {
      console.log('Could not fetch app info:', error);
    } finally {
      setIsLoadingLogo(false);
      setIsLoadingInfo(false);
    }
  };

  const handleWebsiteBlur = () => {
    const url = form.website_url;
    // Auto-fetch info when URL looks complete and we don't have app name yet
    if (url && url.includes('.') && url.length > 5) {
      fetchAppInfo(url);
    }
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setForm(prev => ({ ...prev, logo_url: file_url }));
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      ...form,
      customer_id: customerId,
      total_cost: form.quantity * form.cost_per_license,
      assigned_users: 0,
      source: 'manual'
    });
  };

  const totalCost = form.quantity * form.cost_per_license;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Cloud className="w-5 h-5 text-purple-600" />
            Add SaaS License
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Logo Preview & Upload */}
          <div className="flex items-start gap-4">
            <div className={cn(
              "w-16 h-16 rounded-xl flex items-center justify-center flex-shrink-0 border-2 border-dashed transition-colors",
              form.logo_url ? "border-transparent bg-white" : "border-gray-300 bg-gray-50"
            )}>
              {isLoadingLogo || isUploading ? (
                <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
              ) : form.logo_url ? (
                <img 
                  src={form.logo_url} 
                  alt="Logo" 
                  className="w-14 h-14 object-contain rounded-lg"
                  onError={() => setForm(prev => ({ ...prev, logo_url: '' }))}
                />
              ) : (
                <Image className="w-6 h-6 text-gray-400" />
              )}
            </div>
            <div className="flex-1 space-y-2">
              <Label className="text-xs text-gray-500">Application Logo</Label>
              <div className="flex gap-2">
                <label className="flex-1">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                  <Button type="button" variant="outline" size="sm" className="w-full gap-2" asChild>
                    <span>
                      <Upload className="w-3 h-3" />
                      Upload
                    </span>
                  </Button>
                </label>
                {form.logo_url && (
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setForm(prev => ({ ...prev, logo_url: '' }))}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Application Name */}
          <div>
            <Label>Application Name *</Label>
            <Input
              value={form.application_name}
              onChange={(e) => setForm({ ...form, application_name: e.target.value })}
              placeholder="e.g., Microsoft 365, Slack, Zoom"
              required
              className="mt-1"
            />
          </div>

          {/* Website URL - for auto logo */}
          <div>
            <Label className="flex items-center gap-2">
              <Globe className="w-3 h-3" />
              Website URL
              <span className="text-xs text-gray-400 font-normal">(auto-fetches logo & info)</span>
            </Label>
            <div className="relative mt-1">
              <Input
                value={form.website_url}
                onChange={(e) => setForm(prev => ({ ...prev, website_url: e.target.value }))}
                onBlur={handleWebsiteBlur}
                placeholder="e.g., microsoft.com or https://slack.com"
              />
              {isLoadingInfo && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Loader2 className="w-4 h-4 text-purple-500 animate-spin" />
                </div>
              )}
            </div>
            {isLoadingInfo && (
              <p className="text-xs text-purple-600 mt-1 flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                Fetching app information...
              </p>
            )}
          </div>
          
          {/* Vendor & License Type */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Vendor</Label>
              <Input
                value={form.vendor}
                onChange={(e) => setForm({ ...form, vendor: e.target.value })}
                placeholder="e.g., Microsoft"
                className="mt-1"
              />
            </div>
            <div>
              <Label>License Type</Label>
              <Input
                value={form.license_type}
                onChange={(e) => setForm({ ...form, license_type: e.target.value })}
                placeholder="e.g., Business Basic"
                className="mt-1"
              />
            </div>
          </div>

          {/* Category */}
          <div>
            <Label>Category</Label>
            <Select 
              value={form.category} 
              onValueChange={(v) => setForm({ ...form, category: v })}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map(cat => (
                  <SelectItem key={cat.value} value={cat.value}>
                    <span className="flex items-center gap-2">
                      <span>{cat.icon}</span>
                      <span>{cat.label}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* Seats & Cost */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Total Seats *</Label>
              <Input
                type="number"
                min="1"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: parseInt(e.target.value) || 1 })}
                required
                className="mt-1"
              />
            </div>
            <div>
              <Label>Cost per Seat ($/mo)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.cost_per_license}
                onChange={(e) => setForm({ ...form, cost_per_license: parseFloat(e.target.value) || 0 })}
                placeholder="0.00"
                className="mt-1"
              />
            </div>
          </div>

          {/* Total Cost Preview */}
          {totalCost > 0 && (
            <div className="bg-purple-50 rounded-lg p-3 flex items-center justify-between">
              <span className="text-sm text-purple-700">Total Monthly Cost</span>
              <span className="text-lg font-bold text-purple-900">${totalCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            </div>
          )}

          {/* Billing & Renewal */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Billing Cycle</Label>
              <Select 
                value={form.billing_cycle} 
                onValueChange={(v) => setForm({ ...form, billing_cycle: v })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="annually">Annually</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Renewal Date</Label>
              <Input
                type="date"
                value={form.renewal_date}
                onChange={(e) => setForm({ ...form, renewal_date: e.target.value })}
                className="mt-1"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label>Notes</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Any additional notes about this license..."
              className="mt-1 h-20"
            />
          </div>
          
          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="bg-purple-600 hover:bg-purple-700 gap-2">
              <Cloud className="w-4 h-4" />
              Add License
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}