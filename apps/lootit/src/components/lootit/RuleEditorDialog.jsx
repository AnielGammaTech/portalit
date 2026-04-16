import React, { useState } from 'react';

export default function RuleEditorDialog({ rule, onSave, onClose }) {
  const [label, setLabel] = useState(rule.label || '');
  const [matchPattern, setMatchPattern] = useState(rule.match_pattern || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(rule.id, { label, match_pattern: matchPattern });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <div
        className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="font-semibold text-slate-900 text-sm">Edit Rule</h3>
          <p className="text-xs text-slate-500 mt-1">
            Integration: <span className="font-medium">{rule.integration_key}</span>
          </p>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Label</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-300"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Match Pattern <span className="text-slate-400">(use | for OR)</span>
            </label>
            <input
              type="text"
              value={matchPattern}
              onChange={(e) => setMatchPattern(e.target.value)}
              placeholder="e.g. Managed IT|Remote Only"
              className="w-full text-sm font-mono border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-300"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Matches line items where description contains this text (case-insensitive)
            </p>
          </div>
        </div>

        <div className="px-6 py-3 border-t border-slate-200 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !label.trim() || !matchPattern.trim()}
            className="px-4 py-2 text-xs font-medium rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
