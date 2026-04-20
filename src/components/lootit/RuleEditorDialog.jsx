import React, { useState, useMemo } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Save, Eye, EyeOff } from 'lucide-react';
import { INTEGRATION_LABELS, lineItemMatchesRule } from '@/lib/lootit-reconciliation';

const INTEGRATION_OPTIONS = Object.entries(INTEGRATION_LABELS).map(([key, label]) => ({
  value: key,
  label,
}));

const DEFAULT_VENDOR_PATHS = {
  cove: 'totalDevices',
  cove_workstation: 'workstation_count',
  cove_server: 'server_count',
  datto_rmm_workstation: 'workstation_count',
  datto_rmm_server: 'server_count',
  spanning: 'numberOfUsers',
  jumpcloud: 'totalUsers',
  datto_edr: 'hostCount',
  unifi: 'total_devices',
  rocket_cyber: 'total_agents',
  darkweb: 'domain_count',
  bullphish: 'total_emails_sent',
  threecx: 'user_extensions',
  inky: 'total_users',
  pax8: 'totalQuantity',
};

export default function RuleEditorDialog({ rule, onSave, onClose, lineItems = [] }) {
  const [form, setForm] = useState({
    label: rule.label || '',
    match_pattern: rule.match_pattern || '',
    integration_key: rule.integration_key || '',
    vendor_count_path: rule.vendor_count_path || '',
    match_field: rule.match_field || 'description',
    is_active: rule.is_active !== false,
  });
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const updateField = (key, value) => {
    setForm(prev => {
      const next = { ...prev, [key]: value };
      if (key === 'integration_key' && DEFAULT_VENDOR_PATHS[value]) {
        next.vendor_count_path = DEFAULT_VENDOR_PATHS[value];
      }
      return next;
    });
  };

  const previewMatches = useMemo(() => {
    if (!form.match_pattern.trim() || !lineItems.length) return [];
    const testRule = { match_pattern: form.match_pattern, match_field: form.match_field };
    return lineItems.filter(item => lineItemMatchesRule(item, testRule)).slice(0, 10);
  }, [form.match_pattern, form.match_field, lineItems]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(rule.id, form);
    } finally {
      setSaving(false);
    }
  };

  const canSave = form.label.trim() && form.match_pattern.trim();

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold text-slate-900">Edit Rule</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Label</label>
              <input
                type="text"
                value={form.label}
                onChange={(e) => updateField('label', e.target.value)}
                placeholder="e.g. Cove Backup - Servers"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-300"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Integration</label>
              <select
                value={form.integration_key}
                onChange={(e) => updateField('integration_key', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-300 bg-white"
              >
                <option value="">Select integration...</option>
                {INTEGRATION_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px] gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Match Pattern <span className="text-slate-400 font-normal">(use | for OR)</span>
              </label>
              <input
                type="text"
                value={form.match_pattern}
                onChange={(e) => updateField('match_pattern', e.target.value)}
                placeholder="e.g. Managed IT|Remote Only"
                className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-300"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Match On</label>
              <select
                value={form.match_field}
                onChange={(e) => updateField('match_field', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-300 bg-white"
              >
                <option value="description">Description</option>
                <option value="name">Name</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Vendor Count Field <span className="text-slate-400 font-normal">(auto-filled per integration)</span>
            </label>
            <input
              type="text"
              value={form.vendor_count_path}
              onChange={(e) => updateField('vendor_count_path', e.target.value)}
              placeholder="Auto-detected"
              className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-300"
            />
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => updateField('is_active', e.target.checked)}
                className="rounded text-pink-500 focus:ring-pink-300"
              />
              Active
            </label>
            {lineItems.length > 0 && (
              <button
                type="button"
                onClick={() => setShowPreview(!showPreview)}
                className="inline-flex items-center gap-1.5 text-xs text-pink-600 hover:text-pink-700 font-medium"
              >
                {showPreview ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                Preview ({previewMatches.length} match{previewMatches.length !== 1 ? 'es' : ''})
              </button>
            )}
          </div>

          {showPreview && lineItems.length > 0 && (
            <div className="rounded-lg border border-pink-200 bg-pink-50/50 overflow-hidden">
              <div className="px-3 py-2 border-b border-pink-200 bg-pink-50">
                <p className="text-[10px] font-semibold text-pink-700 uppercase tracking-wider">
                  Pattern matches {previewMatches.length} of {lineItems.length} line items
                </p>
              </div>
              {previewMatches.length === 0 ? (
                <p className="px-3 py-3 text-xs text-slate-400 text-center">No matches found</p>
              ) : (
                <div className="max-h-36 overflow-y-auto divide-y divide-pink-100">
                  {previewMatches.map((item, i) => (
                    <div key={item.id || i} className="px-3 py-1.5 text-xs">
                      <span className="text-slate-700">{item[form.match_field] || item.description}</span>
                      {item.quantity != null && (
                        <span className="ml-2 text-slate-400">qty: {item.quantity}</span>
                      )}
                    </div>
                  ))}
                  {previewMatches.length === 10 && (
                    <p className="px-3 py-1.5 text-[10px] text-slate-400 text-center">Showing first 10</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !canSave}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-pink-500 text-white hover:bg-pink-600 transition-colors disabled:opacity-50"
          >
            <Save className="w-3 h-3" />
            {saving ? 'Saving...' : 'Save'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
