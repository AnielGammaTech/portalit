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

export default function AddSoftwareModal({ open, onClose, onSave, customerId }) {
  const [form, setForm] = useState({
    application_name: '',
    vendor: '',
    website_url: '',
    logo_url: '',
    category: 'other',
    notes: ''
  });
  const [isLoadingLogo, setIsLoadingLogo] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoadingInfo, setIsLoadingInfo] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({
        application_name: '',
        vendor: '',
        website_url: '',
        logo_url: '',
        category: 'other',
        notes: ''
      });
    }
  }, [open]);

  const fetchAppInfoByName = async (name) => {
    if (!name || name.length < 2) return;
    setIsLoadingInfo(true);
    
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Research this software/SaaS application by name: "${name}"
        
Find information about this application. Search for the official website and details.

Return JSON with:
- name: The official application name
- vendor: The company that makes it
- website: The official website URL (just domain like "slack.com" or "adobe.com")
- description: A brief 1-2 sentence description of what the app does
- category: One of: productivity, security, backup, collaboration, crm, finance, hr, marketing, development, other`,
        response_json_schema: {
          type: "object",
          properties: {
            name: { type: "string" },
            vendor: { type: "string" },
            website: { type: "string" },
            description: { type: "string" },
            category: { type: "string" }
          }
        },
        add_context_from_internet: true
      });

      if (result) {
        const updates = {
          application_name: result.name || name,
          vendor: result.vendor || '',
          notes: result.description || '',
          category: result.category || 'other'
        };
        
        if (result.website) {
          let domain = result.website.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
          updates.website_url = domain;
          // Also fetch logo for the discovered website
          const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
          updates.logo_url = faviconUrl;
        }
        
        setForm(prev => ({ ...prev, ...updates }));
      }
    } catch (error) {
      console.log('Could not fetch app info:', error);
    } finally {
      setIsLoadingInfo(false);
    }
  };

  const fetchAppInfoByUrl = async (url) => {
    if (!url || url.length < 5) return;
    setIsLoadingLogo(true);
    setIsLoadingInfo(true);
    
    try {
      let domain = url;
      if (url.includes('://')) {
        domain = url.split('://')[1];
      }
      domain = domain.replace(/^www\./, '').split('/')[0];
      
      const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
      setForm(prev => ({ ...prev, logo_url: faviconUrl }));
      setIsLoadingLogo(false);

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Research this software/SaaS application website: ${domain}
        
Provide information about this application. If you don't know it, make reasonable assumptions based on the domain name.

Return JSON with:
- name: The official application name
- vendor: The company that makes it
- description: A brief 1-2 sentence description of what the app does
- category: One of: productivity, security, backup, collaboration, crm, finance, hr, marketing, development, other`,
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

  const fetchLogoOnly = async () => {
    const url = form.website_url || form.application_name;
    if (!url) return;
    
    setIsLoadingLogo(true);
    try {
      // First try Brandfetch for high-quality logos
      let domain = url;
      if (url.includes('://')) {
        domain = url.split('://')[1];
      }
      domain = domain.replace(/^www\./, '').split('/')[0];
      
      // If no dots, it might be just a name - try to find the domain
      if (!domain.includes('.')) {
        const result = await base44.integrations.Core.InvokeLLM({
          prompt: `What is the official website domain for the software/company "${url}"? Return just the domain like "slack.com" or "adobe.com"`,
          response_json_schema: {
            type: "object",
            properties: {
              domain: { type: "string" }
            }
          },
          add_context_from_internet: true
        });
        if (result?.domain) {
          domain = result.domain.replace(/^www\./, '');
          setForm(prev => ({ ...prev, website_url: domain }));
        }
      }
      
      // Try Brandfetch first
      const brandfetchUrl = `https://cdn.brandfetch.io/${domain}/w/400/h/400/theme/dark/icon.png`;
      
      // Test if Brandfetch works by creating an image
      const img = new window.Image();
      img.onload = () => {
        setForm(prev => ({ ...prev, logo_url: brandfetchUrl }));
        setIsLoadingLogo(false);
      };
      img.onerror = () => {
        // Fallback to Google favicon
        const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
        setForm(prev => ({ ...prev, logo_url: faviconUrl }));
        setIsLoadingLogo(false);
      };
      img.src = brandfetchUrl;
    } catch (error) {
      console.log('Could not fetch logo:', error);
      setIsLoadingLogo(false);
    }
  };

  const handleNameBlur = () => {
    const name = form.application_name;
    // Only auto-fetch if we don't have website/vendor already
    if (name && name.length >= 2 && !form.website_url && !form.vendor) {
      fetchAppInfoByName(name);
    }
  };

  const handleWebsiteBlur = () => {
    const url = form.website_url;
    if (url && url.includes('.') && url.length > 5) {
      fetchAppInfoByUrl(url);
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
    const softwareData = {
      name: form.application_name,
      vendor: form.vendor,
      website_url: form.website_url,
      logo_url: form.logo_url,
      category: form.category,
      notes: form.notes,
      customer_id: customerId,
      status: 'active'
    };
    onSave(softwareData);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Cloud className="w-5 h-5 text-purple-600" />
            Add Software
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
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm"
                  onClick={fetchLogoOnly}
                  disabled={isLoadingLogo || (!form.application_name && !form.website_url)}
                  className="gap-1"
                >
                  {isLoadingLogo ? <Loader2 className="w-3 h-3 animate-spin" /> : <Globe className="w-3 h-3" />}
                  Auto
                </Button>
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
            <Label className="flex items-center gap-2">
              Software Name *
              <span className="text-xs text-gray-400 font-normal">(auto-lookup on blur)</span>
            </Label>
            <div className="relative mt-1">
              <Input
                value={form.application_name}
                onChange={(e) => setForm({ ...form, application_name: e.target.value })}
                onBlur={handleNameBlur}
                placeholder="e.g., Adobe Creative Cloud, Slack"
                required
              />
              {isLoadingInfo && !form.website_url && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Loader2 className="w-4 h-4 text-purple-500 animate-spin" />
                </div>
              )}
            </div>
          </div>

          {/* Website URL */}
          <div>
            <Label className="flex items-center gap-2">
              <Globe className="w-3 h-3" />
              Website URL
              <span className="text-xs text-gray-400 font-normal">(auto-fetches logo)</span>
            </Label>
            <div className="relative mt-1">
              <Input
                value={form.website_url}
                onChange={(e) => setForm(prev => ({ ...prev, website_url: e.target.value }))}
                onBlur={handleWebsiteBlur}
                placeholder="e.g., adobe.com"
              />
              {isLoadingInfo && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Loader2 className="w-4 h-4 text-purple-500 animate-spin" />
                </div>
              )}
            </div>
          </div>
          
          {/* Vendor */}
          <div>
            <Label>Vendor</Label>
            <Input
              value={form.vendor}
              onChange={(e) => setForm({ ...form, vendor: e.target.value })}
              placeholder="e.g., Adobe Inc."
              className="mt-1"
            />
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

          {/* Notes */}
          <div>
            <Label>Notes</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Any notes about this software..."
              className="mt-1 h-16"
            />
          </div>
          
          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="bg-purple-600 hover:bg-purple-700 gap-2">
              <Cloud className="w-4 h-4" />
              Add Software
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}