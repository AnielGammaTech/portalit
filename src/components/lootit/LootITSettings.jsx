import React, { useState } from 'react';
import { Plus, Pencil, Trash2, Save, X, Sparkles } from 'lucide-react';
import { useReconciliationRules } from '@/hooks/useReconciliationRules';
import { INTEGRATION_LABELS } from '@/lib/lootit-reconciliation';

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
  inky: 'total_users',
  pax8: 'totalQuantity',
};

const TEMPLATE_RULES = [
  { integration_key: 'datto_rmm_workstation', match_pattern: 'Managed IT - Remote Only', label: 'Datto RMM Workstations', vendor_count_path: 'workstation_count' },
  { integration_key: 'datto_rmm_server', match_pattern: 'Managed Server', label: 'Datto RMM Servers', vendor_count_path: 'server_count' },
  { integration_key: 'rocket_cyber', match_pattern: 'RocketCyber', label: 'RocketCyber Agents', vendor_count_path: 'total_agents' },
  { integration_key: 'jumpcloud', match_pattern: 'Jump Cloud Platform Plus', label: 'JumpCloud Users', vendor_count_path: 'totalUsers' },
  { integration_key: 'bullphish', match_pattern: 'Bullphish User License', label: 'BullPhish Users', vendor_count_path: 'total_emails_sent' },
  { integration_key: 'darkweb', match_pattern: 'Darkweb lD', label: 'Dark Web ID Domains', vendor_count_path: 'domain_count' },
  { integration_key: 'datto_edr', match_pattern: 'Advanced Threat Protection', label: 'Datto EDR - ATP', vendor_count_path: 'hostCount' },
  { integration_key: 'datto_edr', match_pattern: 'EDR', label: 'Datto EDR', vendor_count_path: 'hostCount' },
  { integration_key: 'spanning', match_pattern: 'Spanning - Per User', label: 'Spanning Backup', vendor_count_path: 'numberOfUsers' },
  { integration_key: 'cove_workstation', match_pattern: 'Cove Doto Protection - Per Endpoint', label: 'Cove Workstations', vendor_count_path: 'workstation_count' },
  { integration_key: 'cove_server', match_pattern: 'Cove Doto Protection - Per Server', label: 'Cove Servers', vendor_count_path: 'server_count' },
  { integration_key: 'inky', match_pattern: 'Inky', label: 'Inky Email Protection', vendor_count_path: 'total_users' },
];

const EMPTY_FORM = {
  integration_key: 'cove',
  match_field: 'description',
  match_pattern: '',
  label: '',
  vendor_count_path: '',
  is_active: true,
};

export default function LootITSettings() {
  const { rules, isLoading, createRule, updateRule, deleteRule, isCreating, isUpdating } = useReconciliationRules();
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [isAdding, setIsAdding] = useState(false);

  const handleEdit = (rule) => {
    setEditingId(rule.id);
    setForm({
      integration_key: rule.integration_key,
      match_field: rule.match_field || 'description',
      match_pattern: rule.match_pattern,
      label: rule.label,
      vendor_count_path: rule.vendor_count_path,
      is_active: rule.is_active,
    });
    setIsAdding(false);
  };

  const handleStartAdd = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setIsAdding(true);
  };

  const handleCancel = () => {
    setEditingId(null);
    setIsAdding(false);
    setForm({ ...EMPTY_FORM });
  };

  const handleSave = async () => {
    const payload = { ...form };
    if (!payload.vendor_count_path) {
      payload.vendor_count_path = DEFAULT_VENDOR_PATHS[payload.integration_key] || '';
    }

    if (editingId) {
      await updateRule({ id: editingId, ...payload });
    } else {
      await createRule(payload);
    }
    handleCancel();
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this reconciliation rule?')) return;
    await deleteRule(id);
  };

  const handleAddTemplates = async () => {
    const existing = rules.map((r) => `${r.integration_key}:${r.match_pattern.toLowerCase()}`);
    const toAdd = TEMPLATE_RULES.filter(
      (t) => !existing.includes(`${t.integration_key}:${t.match_pattern.toLowerCase()}`)
    );

    for (const template of toAdd) {
      await createRule({
        ...template,
        match_field: 'description',
        is_active: true,
      });
    }
  };

  const updateForm = (key, value) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      // Auto-fill vendor_count_path when integration changes
      if (key === 'integration_key' && DEFAULT_VENDOR_PATHS[value]) {
        next.vendor_count_path = DEFAULT_VENDOR_PATHS[value];
      }
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-pink-200 border-t-pink-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Reconciliation Rules</h3>
          <p className="text-sm text-slate-500 mt-0.5">
            Map HaloPSA line item descriptions to vendor integrations
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleAddTemplates}
            disabled={isCreating}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-pink-50 transition-colors disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Add Templates
          </button>
          <button
            onClick={handleStartAdd}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-pink-500 text-white hover:bg-pink-600 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Rule
          </button>
        </div>
      </div>

      {/* Add/Edit Form */}
      {(isAdding || editingId) && (
        <RuleForm
          form={form}
          onUpdate={updateForm}
          onSave={handleSave}
          onCancel={handleCancel}
          isSaving={isCreating || isUpdating}
          isEditing={!!editingId}
        />
      )}

      {/* Rules Table */}
      {rules.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
          <Sparkles className="w-10 h-10 text-pink-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No rules configured yet</p>
          <p className="text-sm text-slate-400 mt-1">
            Click &quot;Add Templates&quot; to get started with common rules
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">Label</th>
                <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">Integration</th>
                <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">Pattern</th>
                <th className="text-center text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">Active</th>
                <th className="text-right text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rules.map((rule) => (
                <tr key={rule.id} className="hover:bg-pink-50/30 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-slate-900">{rule.label}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {INTEGRATION_LABELS[rule.integration_key] || rule.integration_key}
                  </td>
                  <td className="px-4 py-3">
                    <code className="text-xs bg-slate-50 text-slate-600 px-2 py-0.5 rounded">
                      {rule.match_pattern}
                    </code>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block w-2 h-2 rounded-full ${rule.is_active ? 'bg-emerald-400' : 'bg-slate-300'}`} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleEdit(rule)}
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(rule.id)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function RuleForm({ form, onUpdate, onSave, onCancel, isSaving, isEditing }) {
  const canSave = form.match_pattern.trim() && form.label.trim();

  return (
    <div className="bg-white rounded-xl border border-pink-200 p-5 space-y-4">
      <h4 className="font-medium text-slate-900 text-sm">
        {isEditing ? 'Edit Rule' : 'New Rule'}
      </h4>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Label</label>
          <input
            type="text"
            value={form.label}
            onChange={(e) => onUpdate('label', e.target.value)}
            placeholder="e.g. Cove Backup - Servers"
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-300"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Integration</label>
          <select
            value={form.integration_key}
            onChange={(e) => onUpdate('integration_key', e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-300"
          >
            {INTEGRATION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            Match Pattern
            <span className="text-slate-400 font-normal"> (substring in description)</span>
          </label>
          <input
            type="text"
            value={form.match_pattern}
            onChange={(e) => onUpdate('match_pattern', e.target.value)}
            placeholder="e.g. Cove"
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-300"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            Vendor Count Field
            <span className="text-slate-400 font-normal"> (auto-filled)</span>
          </label>
          <input
            type="text"
            value={form.vendor_count_path}
            onChange={(e) => onUpdate('vendor_count_path', e.target.value)}
            placeholder="Auto-detected"
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-300"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => onUpdate('is_active', e.target.checked)}
            className="rounded text-pink-500 focus:ring-pink-300"
          />
          Active
        </label>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={onSave}
          disabled={!canSave || isSaving}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-pink-500 text-white hover:bg-pink-600 transition-colors disabled:opacity-50"
        >
          <Save className="w-3.5 h-3.5" />
          {isSaving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
}
