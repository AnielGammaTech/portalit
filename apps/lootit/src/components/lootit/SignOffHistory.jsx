import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { client } from '@/api/client';
import { History, ChevronDown, Stamp, StickyNote, User, Calendar, Hash, CheckCircle2, AlertTriangle, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import SnapshotCard from './SnapshotCard';

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTime(dateStr) {
  return new Date(dateStr).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function StatPill({ label, value, color }) {
  const colors = {
    emerald: 'bg-emerald-50 text-emerald-700',
    blue: 'bg-blue-50 text-blue-700',
    slate: 'bg-slate-50 text-slate-600',
    red: 'bg-red-50 text-red-600',
    amber: 'bg-amber-50 text-amber-700',
  };
  if (!value) return null;
  return (
    <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full tabular-nums', colors[color] || colors.slate)}>
      {value} {label}
    </span>
  );
}

function SignOffRow({ signOff, isLatest, onShowSnapshotDetail }) {
  const [expanded, setExpanded] = useState(false);

  const { data: snapshots = [], isLoading: snapshotsLoading } = useQuery({
    queryKey: ['reconciliation_snapshots', signOff.customer_id, signOff.id],
    queryFn: () => client.entities.ReconciliationSnapshot.filter({ sign_off_id: signOff.id }),
    enabled: expanded,
    staleTime: 1000 * 60 * 5,
  });

  const signerName = signOff.signed_by_user?.full_name || signOff.signed_by_user?.email || 'Unknown';
  const filteredSnapshots = snapshots.filter((s) => !['no_vendor_data', 'no_data'].includes(s.status));

  return (
    <div className={cn(
      'border rounded-xl overflow-hidden transition-all',
      isLatest ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-200',
    )}>
      <button
        onClick={() => setExpanded((prev) => !prev)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50/50 transition-colors text-left"
      >
        <div className={cn(
          'w-8 h-8 rounded-full flex items-center justify-center shrink-0',
          isLatest ? 'bg-emerald-100' : 'bg-slate-100',
        )}>
          <Stamp className={cn('w-4 h-4', isLatest ? 'text-emerald-600' : 'text-slate-400')} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-900">
              {formatDate(signOff.signed_at)}
            </span>
            <span className="text-[10px] text-slate-400">
              {formatTime(signOff.signed_at)}
            </span>
            {isLatest && (
              <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded">
                Current
              </span>
            )}
            {signOff.billing_period && (
              <span className="text-[10px] text-slate-400 font-mono">
                {signOff.billing_period}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <User className="w-3 h-3 text-slate-400" />
            <span className="text-xs text-slate-500">{signerName}</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <StatPill label="matched" value={signOff.matched_count} color="emerald" />
          <StatPill label="issues" value={signOff.issues_count} color="red" />
          <StatPill label="forced" value={signOff.force_matched_count} color="blue" />
          <StatPill label="dismissed" value={signOff.dismissed_count} color="slate" />
        </div>

        <ChevronDown className={cn(
          'w-4 h-4 text-slate-400 transition-transform shrink-0',
          expanded && 'rotate-180',
        )} />
      </button>

      {expanded && (
        <div className="border-t border-slate-100 px-4 py-3 space-y-3">
          {signOff.manual_notes && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              <StickyNote className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800">{signOff.manual_notes}</p>
            </div>
          )}

          {signOff.ai_verified && signOff.ai_summary && (
            <div className="flex items-start gap-2 bg-violet-50 border border-violet-100 rounded-lg px-3 py-2">
              <Shield className="w-3.5 h-3.5 text-violet-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] font-semibold text-violet-600 mb-0.5">
                  AI Verified · {signOff.ai_confidence}% confidence
                </p>
                <p className="text-xs text-violet-700">{signOff.ai_summary}</p>
              </div>
            </div>
          )}

          {snapshotsLoading ? (
            <div className="text-center py-4">
              <p className="text-xs text-slate-400">Loading snapshot...</p>
            </div>
          ) : filteredSnapshots.length > 0 ? (
            <div className="grid grid-cols-4 gap-2 auto-rows-fr">
              {filteredSnapshots.map((snapshot) => (
                <SnapshotCard
                  key={snapshot.id}
                  snapshot={snapshot}
                  onDetails={onShowSnapshotDetail}
                />
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 text-center py-3">No snapshot data for this sign-off</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function SignOffHistory({ allSignOffs, onShowSnapshotDetail }) {
  if (!allSignOffs || allSignOffs.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-3">
        <History className="w-4 h-4 text-slate-500" />
        <h3 className="text-sm font-bold text-slate-800">Sign-Off History</h3>
        <span className="text-[10px] text-slate-400 font-medium">{allSignOffs.length} sign-off{allSignOffs.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="space-y-2">
        {allSignOffs.map((signOff, idx) => (
          <SignOffRow
            key={signOff.id}
            signOff={signOff}
            isLatest={idx === 0}
            onShowSnapshotDetail={onShowSnapshotDetail}
          />
        ))}
      </div>
    </div>
  );
}
