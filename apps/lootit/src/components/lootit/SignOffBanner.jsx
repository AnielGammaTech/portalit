import React from 'react';

export default function SignOffBanner({ signOff, onStartReconciliation }) {
  if (!signOff) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-lg px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-slate-300" />
          <span className="text-sm text-slate-500">No reconciliation completed yet</span>
        </div>
        <button
          onClick={onStartReconciliation}
          className="text-xs font-medium text-pink-600 hover:text-pink-800 border border-pink-200 bg-pink-50 px-4 py-1.5 rounded-lg transition-colors"
        >
          Start Reconciliation →
        </button>
      </div>
    );
  }

  const signedDate = new Date(signOff.signed_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const signerName = signOff.signed_by_user?.full_name || signOff.signed_by_user?.email || 'Unknown';

  return (
    <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-5 py-4 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-emerald-500" />
        <span className="text-sm font-medium text-emerald-700">Signed off {signedDate}</span>
        <span className="text-sm text-emerald-600/70">by {signerName}</span>
      </div>
      <button
        onClick={onStartReconciliation}
        className="text-xs font-medium text-pink-600 hover:text-pink-800 border border-pink-200 bg-pink-50 px-4 py-1.5 rounded-lg transition-colors"
      >
        Start New Reconciliation →
      </button>
    </div>
  );
}
