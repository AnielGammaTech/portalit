import React, { useState } from 'react';
import { client } from '@/api/client';
import { Shield, AlertTriangle, RefreshCw, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const STATUS_CONFIG = {
  pass: { icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', label: 'PASS' },
  fail: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', label: 'FAIL' },
  warn: { icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', label: 'WARN' },
};

export default function SecurityAuditPanel() {
  const [isRunning, setIsRunning] = useState(false);
  const queryClient = useQueryClient();

  const [audit, setAudit] = useState(null);

  const runAudit = async () => {
    setIsRunning(true);
    try {
      const result = await client.functions.invoke('securityAudit', {});
      setAudit(result);
      toast.success('Security audit complete');
    } catch (err) {
      toast.error(err.message || 'Audit failed');
    } finally {
      setIsRunning(false);
    }
  };

  const ScoreRing = ({ score }) => {
    const color = score >= 80 ? 'text-emerald-500' : score >= 60 ? 'text-amber-500' : 'text-red-500';
    const bgColor = score >= 80 ? 'bg-emerald-50' : score >= 60 ? 'bg-amber-50' : 'bg-red-50';
    return (
      <div className={cn('w-20 h-20 rounded-full flex items-center justify-center border-4', bgColor,
        score >= 80 ? 'border-emerald-300' : score >= 60 ? 'border-amber-300' : 'border-red-300'
      )}>
        <span className={cn('text-2xl font-bold', color)}>{score}%</span>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
            <Shield className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900">Security Audit</h3>
            <p className="text-xs text-slate-400">RLS policies, storage, constraints</p>
          </div>
        </div>
        <Button onClick={runAudit} disabled={isRunning}>
          {isRunning ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Running...</>
          ) : (
            <><RefreshCw className="w-4 h-4 mr-2" />Run Audit</>
          )}
        </Button>
      </div>

      {/* Results */}
      {!audit ? (
        <div className="text-center py-12">
          <Shield className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <p className="text-sm text-slate-500">Click "Run Audit" to check security posture</p>
          <p className="text-xs text-slate-400 mt-1">Checks RLS policies, storage permissions, and database constraints</p>
        </div>
      ) : (
        <>
          {/* Score + Summary */}
          <div className="flex items-center gap-6 p-4 rounded-xl bg-slate-50 border border-slate-100">
            <ScoreRing score={audit.score} />
            <div className="flex-1">
              <div className="flex items-center gap-4 mb-2">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span className="text-sm font-semibold text-emerald-700">{audit.passed} passed</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <XCircle className="w-4 h-4 text-red-500" />
                  <span className="text-sm font-semibold text-red-700">{audit.failed} failed</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <span className="text-sm font-semibold text-amber-700">{audit.warnings} warnings</span>
                </div>
              </div>
              <p className="text-[10px] text-slate-400">
                Last run: {new Date(audit.timestamp).toLocaleString()}
              </p>
            </div>
          </div>

          {/* Individual Checks */}
          <div className="space-y-2">
            {audit.checks.map(check => {
              const cfg = STATUS_CONFIG[check.status] || STATUS_CONFIG.warn;
              const Icon = cfg.icon;
              return (
                <div key={check.id} className={cn('flex items-start gap-3 p-3 rounded-lg border', cfg.bg, cfg.border)}>
                  <Icon className={cn('w-4 h-4 mt-0.5 shrink-0', cfg.color)} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-800">{check.name}</span>
                      <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded', cfg.bg, cfg.color)}>{cfg.label}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">{check.detail}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
