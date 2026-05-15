import React, { useState } from 'react';
import { CalendarClock } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

const SCHEDULE_OPTIONS = [
  { label: '1 Month', months: 1 },
  { label: '3 Months', months: 3 },
  { label: '6 Months', months: 6 },
  { label: '12 Months', months: 12 },
];

function addMonths(date, months) {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

function formatDate(date) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function SignOffDialog({ open, onClose, summary, unresolvedItems, onConfirm, isSigningOff, verificationState }) {
  const [notes, setNotes] = useState('');
  const [selectedMonths, setSelectedMonths] = useState(null);

  const nextDate = selectedMonths ? addMonths(new Date(), selectedMonths) : null;

  const handleConfirm = () => {
    onConfirm(notes, nextDate?.toISOString());
    setNotes('');
    setSelectedMonths(1);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>Sign Off Reconciliation</DialogTitle>
          <DialogDescription>
            This will create a snapshot of the current reconciliation state.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {verificationState && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-center gap-3">
              <div className="text-2xl font-bold text-emerald-700">{verificationState.verified}/{verificationState.total}</div>
              <div>
                <p className="text-xs font-semibold text-emerald-700">All tiles verified</p>
                <p className="text-[10px] text-emerald-600">Every service has been reviewed by your team</p>
              </div>
            </div>
          )}
          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="bg-emerald-50 rounded-lg p-2">
              <div className="text-lg font-bold text-emerald-700">{summary?.matched || 0}</div>
              <div className="text-[10px] text-emerald-600">Matched</div>
            </div>
            <div className="bg-blue-50 rounded-lg p-2">
              <div className="text-lg font-bold text-blue-700">{summary?.forceMatched || 0}</div>
              <div className="text-[10px] text-blue-600">Approved</div>
            </div>
            <div className="bg-indigo-50 rounded-lg p-2">
              <div className="text-lg font-bold text-indigo-700">{summary?.reviewed || 0}</div>
              <div className="text-[10px] text-indigo-600">Verified</div>
            </div>
            <div className="bg-slate-50 rounded-lg p-2">
              <div className="text-lg font-bold text-slate-600">{summary?.dismissed || 0}</div>
              <div className="text-[10px] text-slate-500">Dismissed</div>
            </div>
          </div>

          {unresolvedItems.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-xs font-medium text-amber-700 mb-1">
                {unresolvedItems.length} unresolved item{unresolvedItems.length > 1 ? 's' : ''}:
              </p>
              <ul className="text-xs text-amber-600 space-y-0.5">
                {unresolvedItems.slice(0, 5).map((item) => (
                  <li key={item.ruleId}>• {item.label} ({item.status})</li>
                ))}
                {unresolvedItems.length > 5 && (
                  <li>...and {unresolvedItems.length - 5} more</li>
                )}
              </ul>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
              <CalendarClock className="w-3.5 h-3.5" />
              Next Reconciliation
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {SCHEDULE_OPTIONS.map((opt) => (
                <button
                  key={opt.months}
                  type="button"
                  onClick={() => setSelectedMonths(opt.months)}
                  className={`px-2 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                    selectedMonths === opt.months
                      ? 'bg-pink-50 border-pink-300 text-pink-700'
                      : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {nextDate && (
              <p className="text-[11px] text-slate-400">
                Due: {formatDate(nextDate)}
              </p>
            )}
            {!selectedMonths && (
              <p className="text-[11px] text-pink-500 font-medium">
                Required — select when to reconcile next
              </p>
            )}
          </div>

          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional sign-off notes..."
            className="w-full text-sm border border-slate-200 rounded-lg p-2.5 resize-none h-20 focus:outline-none focus:ring-2 focus:ring-pink-300 focus:border-pink-300"
          />
        </div>

        <DialogFooter className="gap-2">
          <button
            onClick={onClose}
            disabled={isSigningOff}
            className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isSigningOff || unresolvedItems.length > 0 || !selectedMonths}
            className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors disabled:opacity-50"
          >
            {isSigningOff ? 'Signing off...' : unresolvedItems.length > 0 ? `${unresolvedItems.length} Unresolved — Cannot Sign Off` : !selectedMonths ? 'Select Next Reconciliation' : 'Sign Off'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
