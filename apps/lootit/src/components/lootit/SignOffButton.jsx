import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { client } from '@/api/client';
import { useAuth } from '@/lib/AuthContext';
import { cn } from '@/lib/utils';
import { ShieldCheck, Loader2, AlertTriangle, CheckCircle2, X, Stamp } from 'lucide-react';
import { toast } from 'sonner';

export default function SignOffButton({ customer, reconciliations, pax8Reconciliations, unmatchedItems, hasUnresolvedItems, unresolvedCount }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState(null);
  const [showPanel, setShowPanel] = useState(false);
  const [signOffNotes, setSignOffNotes] = useState('');

  // Check latest sign-off status
  const { data: signOffData } = useQuery({
    queryKey: ['sign_off_status', customer.id],
    queryFn: async () => {
      const res = await client.functions.invoke('verifyReconciliation', {
        action: 'status',
        customer_id: customer.id,
      });
      return res.sign_off;
    },
    staleTime: 1000 * 60 * 2,
  });

  const isSignedOff = signOffData?.status === 'signed_off';
  const currentPeriod = new Date().toISOString().slice(0, 7);
  const isCurrentPeriod = signOffData?.billing_period === currentPeriod;

  const handleVerify = async () => {
    setIsVerifying(true);
    setVerifyResult(null);
    try {
      const res = await client.functions.invoke('verifyReconciliation', {
        action: 'verify',
        customer_id: customer.id,
        customer_name: customer.name,
        reconciliations: reconciliations || [],
        pax8_reconciliations: pax8Reconciliations || [],
        unmatched_items: (unmatchedItems || []).slice(0, 20),
      });
      setVerifyResult(res);
      if (res.can_sign_off) {
        toast.success('Verification passed — ready for sign-off');
      } else {
        toast.error(`${(res.blockers || []).length} blocking issues found`);
      }
    } catch (err) {
      toast.error(`Verification failed: ${err.message}`);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSignOff = async () => {
    if (!verifyResult?.sign_off_id) return;
    try {
      await client.functions.invoke('verifyReconciliation', {
        action: 'sign_off',
        customer_id: customer.id,
        sign_off_id: verifyResult.sign_off_id,
        notes: signOffNotes,
      });
      toast.success(`Signed off by ${user?.full_name}`);
      setShowPanel(false);
      setVerifyResult(null);
      queryClient.invalidateQueries({ queryKey: ['sign_off_status', customer.id] });
    } catch (err) {
      toast.error(`Sign-off failed: ${err.message}`);
    }
  };

  const handleRemoveSignOff = async () => {
    if (!signOffData?.id) return;
    try {
      await client.entities.ReconciliationSignOff.delete(signOffData.id);
      toast.success('Sign-off removed');
      queryClient.invalidateQueries({ queryKey: ['sign_off_status', customer.id] });
      queryClient.invalidateQueries({ queryKey: ['all_sign_offs'] });
    } catch (err) {
      toast.error(`Failed to remove sign-off: ${err.message}`);
    }
  };

  // Already signed off for this period — show stamp with remove option
  if (isSignedOff && isCurrentPeriod) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200">
          <Stamp className="w-4 h-4 text-emerald-600" />
          <div className="text-xs">
            <span className="font-semibold text-emerald-700">Signed Off</span>
            <span className="text-emerald-500 ml-1.5">
              {signOffData.signer?.full_name} · {new Date(signOffData.signed_at).toLocaleDateString()}
            </span>
          </div>
        </div>
        <button
          onClick={handleRemoveSignOff}
          className="text-[10px] text-red-400 hover:text-red-600 underline"
        >
          Remove
        </button>
        <button
          onClick={() => { setShowPanel(true); setVerifyResult(null); }}
          className="text-[10px] text-slate-400 hover:text-slate-600 underline"
        >
          Re-verify
        </button>
      </div>
    );
  }

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => {
          if (hasUnresolvedItems) {
            toast.error(`Cannot sign off — ${unresolvedCount} item${unresolvedCount !== 1 ? 's' : ''} still unresolved (No Data, unmatched, or unreviewed)`);
            return;
          }
          setShowPanel(true); handleVerify();
        }}
        disabled={isVerifying}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-violet-600 text-white hover:bg-violet-700 shadow-sm transition-all disabled:opacity-50"
      >
        {isVerifying ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <ShieldCheck className="w-3.5 h-3.5" />
        )}
        {isVerifying ? 'Verifying...' : 'Sign Off'}
      </button>

      {/* Verification panel */}
      {showPanel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setShowPanel(false)}>
          <div className="absolute inset-0 bg-black/30" />
          <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden mx-4" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-violet-600" />
                <h3 className="font-bold text-slate-900">Reconciliation Sign-Off</h3>
              </div>
              <button onClick={() => setShowPanel(false)} className="p-1 hover:bg-slate-100 rounded-lg">
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
              {/* Loading */}
              {isVerifying && (
                <div className="text-center py-8">
                  <Loader2 className="w-8 h-8 text-violet-500 animate-spin mx-auto mb-3" />
                  <p className="text-sm text-slate-500">AI is reviewing reconciliation data...</p>
                  <p className="text-xs text-slate-400 mt-1">Checking all items for completeness</p>
                </div>
              )}

              {/* Results */}
              {verifyResult && !isVerifying && (
                <>
                  {/* Status badge */}
                  <div className={cn(
                    'flex items-center gap-3 p-4 rounded-xl border',
                    verifyResult.can_sign_off ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'
                  )}>
                    {verifyResult.can_sign_off ? (
                      <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-6 h-6 text-red-600 shrink-0" />
                    )}
                    <div>
                      <p className={cn('text-sm font-semibold', verifyResult.can_sign_off ? 'text-emerald-800' : 'text-red-800')}>
                        {verifyResult.can_sign_off ? 'Ready for Sign-Off' : 'Issues Found — Cannot Sign Off'}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        AI Confidence: {verifyResult.confidence}%
                      </p>
                    </div>
                  </div>

                  {/* Summary */}
                  {verifyResult.summary && (
                    <div>
                      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Summary</h4>
                      <p className="text-sm text-slate-700 leading-relaxed">{verifyResult.summary}</p>
                    </div>
                  )}

                  {/* Blockers */}
                  {verifyResult.blockers?.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-red-600 uppercase tracking-wider mb-1.5">
                        Blockers ({verifyResult.blockers.length})
                      </h4>
                      <div className="space-y-1.5">
                        {verifyResult.blockers.map((b, i) => (
                          <div key={i} className="flex items-start gap-2 px-3 py-2 bg-red-50 rounded-lg border border-red-100">
                            <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                            <p className="text-xs text-red-700">{b}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Warnings */}
                  {verifyResult.warnings?.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-amber-600 uppercase tracking-wider mb-1.5">
                        Warnings ({verifyResult.warnings.length})
                      </h4>
                      <div className="space-y-1.5">
                        {verifyResult.warnings.map((w, i) => (
                          <div key={i} className="flex items-start gap-2 px-3 py-2 bg-amber-50 rounded-lg border border-amber-100">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                            <p className="text-xs text-amber-700">{w}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recommendation */}
                  {verifyResult.recommendation && (
                    <div className="bg-slate-50 rounded-lg p-3 border">
                      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Recommendation</h4>
                      <p className="text-sm text-slate-700">{verifyResult.recommendation}</p>
                    </div>
                  )}

                  {/* Sign-off form (only if verified) */}
                  {verifyResult.can_sign_off && (
                    <div className="border-t pt-4 space-y-3">
                      <textarea
                        value={signOffNotes}
                        onChange={(e) => setSignOffNotes(e.target.value)}
                        placeholder="Optional sign-off notes..."
                        rows={2}
                        className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-300 resize-none"
                      />
                      <button
                        onClick={handleSignOff}
                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm transition-all"
                      >
                        <Stamp className="w-4 h-4" />
                        Sign Off as {user?.full_name}
                      </button>
                    </div>
                  )}

                  {/* Re-verify button if blocked */}
                  {!verifyResult.can_sign_off && (
                    <div className="border-t pt-4">
                      <p className="text-xs text-slate-400 mb-2">Resolve the blockers above, then re-verify.</p>
                      <button
                        onClick={handleVerify}
                        disabled={isVerifying}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        Re-verify
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
