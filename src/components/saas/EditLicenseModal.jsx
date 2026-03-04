import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { client } from '@/api/client';
import { Cloud, Upload, Globe, Loader2, X, Image, Trash2 } from 'lucide-react';
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

export default function EditLicenseModal({ open, onClose, license, onSave, onDelete }) {
  const [form, setForm] = useState({});
  const [isUploading, setIsUploading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (license && open) {
      setForm({
        application_name: license.application_name || '',
        vendor: license.vendor || '',
        license_type: license.license_type || '',
        quantity: license.quantity || 1,
        cost_per_license: license.cost_per_license || 0,
        billing_cycle: license.billing_cycle || 'monthly',
        status: license.status || 'active',
        website_url: license.website_url || '',
        logo_url: license.logo_url || '',
        category: license.category || 'other',
        renewal_date: license.renewal_date || '',
        notes: license.notes || ''
      });
      setShowDeleteConfirm(false);
    }
  }, [license, open]);

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsUploading(true);
    try {
      const { file_url } = await client.integrations.Core.UploadFile({ file });
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
      total_cost: form.quantity * form.cost_per_license
    });
  };

  const totalCost = form.quantity * form.cost_per_license;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Cloud className="w-5 h-5 text-purple-600" />
            Edit License
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Logo Preview & Upload */}
          <div className="flex items-start gap-4">
            <div className={cn(
              "w-16 h-16 rounded-xl flex items-center justify-center flex-shrink-0 border-2 border-dashed transition-colors",
              form.logo_url ? "border-transparent bg-white" : "border-gray-300 bg-gray-50"
            )}>
              {isUploading ? (
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

          {/* Website URL */}
          <div>
            <Label className="flex items-center gap-2">
              <Globe className="w-3 h-3" />
              Website URL
            </Label>
            <Input
              value={form.website_url}
              onChange={(e) => setForm(prev => ({ ...prev, website_url: e.target.value }))}
              placeholder="e.g., microsoft.com"
              className="mt-1"
            />
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

          {/* Category & Status */}
          <div className="grid grid-cols-2 gap-4">
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
            <div>
              <Label>Status</Label>
              <Select 
                value={form.status} 
                onValueChange={(v) => setForm({ ...form, status: v })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
            <Label>Notes / Description</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Description or notes about this license..."
              className="mt-1 h-20"
            />
          </div>
          
          {/* Delete Section */}
          <div className="border-t pt-4">
            {!showDeleteConfirm ? (
              <Button 
                type="button" 
                variant="ghost" 
                className="text-red-600 hover:text-red-700 hover:bg-red-50 gap-2"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 className="w-4 h-4" />
                Delete License
              </Button>
            ) : (
              <div className="bg-red-50 rounded-lg p-4">
                <p className="text-sm text-red-700 mb-3">Are you sure you want to delete this license? This action cannot be undone.</p>
                <div className="flex gap-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={() => setShowDeleteConfirm(false)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="button" 
                    size="sm"
                    className="bg-red-600 hover:bg-red-700"
                    onClick={onDelete}
                  >
                    Yes, Delete
                  </Button>
                </div>
              </div>
            )}
          </div>
          
          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="bg-purple-600 hover:bg-purple-700 gap-2">
              Save Changes
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}