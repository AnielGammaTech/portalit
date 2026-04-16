import React from 'react';
import { cn } from '@/lib/utils';
import { Bell } from 'lucide-react';

function AnomalyTimeline({ history, direction }) {
  const getSegmentColor = (idx) => {
    if (idx >= history.length - 1) return 'bg-slate-200';
    const curr = history[idx].amount;
    const next = history[idx + 1].amount;
    const diff = ((next - curr) / (curr || 1)) * 100;
    if (Math.abs(diff) < 5) return 'bg-emerald-400';
    return diff < 0 ? 'bg-red-400' : 'bg-amber-400';
  };

  const getNodeColor = (idx) => {
    const isLatest = idx === history.length - 1;
    if (isLatest) return direction === 'decrease' ? 'bg-red-500 ring-red-200' : 'bg-amber-500 ring-amber-200';
    if (idx === 0) return 'bg-slate-400 ring-slate-200';
    const prev = history[idx - 1]?.amount || 0;
    const curr = history[idx].amount;
    const diff = prev > 0 ? ((curr - prev) / prev) * 100 : 0;
    if (Math.abs(diff) >= 5) return diff < 0 ? 'bg-red-400 ring-red-100' : 'bg-amber-400 ring-amber-100';
    return 'bg-emerald-500 ring-emerald-200';
  };

  if (history.length === 0) return null;

  return (
    <div className="mb-4 px-2">
      <div className="flex items-end mb-1" style={{ paddingLeft: '4px', paddingRight: '4px' }}>
        {history.map((h, i) => {
          const isLatest = i === history.length - 1;
          return (
            <div key={h.month} className="flex-1 text-center">
              <span className={cn(
                'text-[10px] font-bold tabular-nums',
                isLatest
                  ? (direction === 'decrease' ? 'text-red-600' : 'text-amber-600')
                  : 'text-slate-500'
              )}>
                ${h.amount.toLocaleString()}
              </span>
            </div>
          );
        })}
      </div>

      <div className="relative flex items-center" style={{ height: '28px' }}>
        {history.map((h, i) => {
          const isLatest = i === history.length - 1;
          const isFirst = i === 0;
          return (
            <div key={h.month} className="flex-1 flex items-center">
              {!isFirst && (
                <div className={cn('flex-1 h-1 rounded-full', getSegmentColor(i - 1))} />
              )}
              <div className={cn(
                'shrink-0 rounded-full ring-2 z-10',
                isLatest ? 'w-4 h-4' : 'w-3 h-3',
                getNodeColor(i)
              )} />
              {!isLatest && (
                <div className={cn('flex-1 h-1 rounded-full', getSegmentColor(i))} />
              )}
            </div>
          );
        })}
      </div>

      <div className="flex mt-1" style={{ paddingLeft: '4px', paddingRight: '4px' }}>
        {history.map((h) => {
          const monthLabel = new Date(h.month + '-15').toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
          return (
            <div key={h.month} className="flex-1 text-center">
              <span className="text-[9px] text-slate-400 font-medium">{monthLabel}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function buildSummary(rawHistory, direction) {
  if (rawHistory.length < 2) return null;
  const newest = rawHistory[0];
  const oldest = rawHistory[rawHistory.length - 1];
  const oldestLabel = new Date(oldest.month + '-15').toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

  const sorted = [...rawHistory];
  let changeIdx = -1;
  for (let i = 0; i < sorted.length - 1; i++) {
    const diff = Math.abs(sorted[i].amount - sorted[i + 1].amount);
    if (diff > sorted[i + 1].amount * 0.05) { changeIdx = i; break; }
  }
  if (changeIdx < 0) return null;
  const changeMonth = new Date(sorted[changeIdx].month + '-15').toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  const beforeAmount = sorted[changeIdx + 1].amount;
  const afterAmount = sorted[changeIdx].amount;

  if (afterAmount < beforeAmount) {
    return `Was $${beforeAmount.toLocaleString()}/mo (${oldestLabel} \u2013 ${new Date(sorted[changeIdx + 1].month + '-15').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}). Dropped to $${afterAmount.toLocaleString()} in ${changeMonth}.`;
  }
  return `Was $${beforeAmount.toLocaleString()}/mo. Increased to $${afterAmount.toLocaleString()} in ${changeMonth}.`;
}

function AnomalyCard({ anomaly, anomalyHistory, acknowledgeId, acknowledgeNotes, onAcknowledgeNotesChange, onAcknowledge, onDismiss, onStartAcknowledge, onCancelAcknowledge }) {
  const categoryLabel = {
    monthly_recurring: 'Monthly Recurring',
    voip: 'VoIP',
  }[anomaly.category] || anomaly.category || 'Unknown';

  const rawHistory = anomalyHistory[anomaly.category] || [];
  const history = [...rawHistory].reverse();
  const summaryText = buildSummary(rawHistory, anomaly.direction);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={cn(
            'w-8 h-8 rounded-lg flex items-center justify-center',
            anomaly.direction === 'decrease' ? 'bg-red-100' : 'bg-amber-100'
          )}>
            <Bell className={cn('w-4 h-4', anomaly.direction === 'decrease' ? 'text-red-600' : 'text-amber-600')} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-900">{categoryLabel}</span>
              <span className={cn(
                'text-sm font-bold',
                anomaly.direction === 'decrease' ? 'text-red-600' : 'text-amber-600'
              )}>
                {anomaly.direction === 'decrease' ? '' : '+'}{anomaly.pct_change}%
              </span>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-0.5">
              <span>Now <strong className="text-slate-600">${anomaly.current_amount?.toLocaleString()}</strong></span>
              <span>Was <strong className="text-slate-600">${anomaly.previous_avg?.toLocaleString()}</strong></span>
              <span className={cn('font-semibold', anomaly.direction === 'decrease' ? 'text-red-500' : 'text-amber-500')}>
                {anomaly.direction === 'decrease' ? '-' : '+'}${Math.abs(anomaly.dollar_change).toLocaleString()}/mo
              </span>
            </div>
          </div>
        </div>
      </div>

      {summaryText && (
        <p className="text-[11px] text-slate-500 mb-3 px-1">{summaryText}</p>
      )}

      <AnomalyTimeline history={history} direction={anomaly.direction} />

      {acknowledgeId === anomaly.id ? (
        <div className="space-y-2 pt-3 border-t border-slate-100">
          <textarea
            value={acknowledgeNotes}
            onChange={e => onAcknowledgeNotesChange(e.target.value)}
            placeholder="Explain why this change is expected..."
            className="w-full text-xs border border-slate-200 rounded-lg p-2.5 resize-none focus:outline-none focus:ring-1 focus:ring-blue-400"
            rows={2}
          />
          <div className="flex gap-2">
            <button
              onClick={() => onAcknowledge(anomaly.id)}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-colors"
            >
              Confirm
            </button>
            <button
              onClick={onCancelAcknowledge}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2 pt-3 border-t border-slate-100">
          <button
            onClick={() => onStartAcknowledge(anomaly.id)}
            className="px-4 py-1.5 text-xs font-medium rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors border border-emerald-200"
          >
            Acknowledge
          </button>
          <button
            onClick={() => onDismiss(anomaly.id)}
            className="px-4 py-1.5 text-xs font-medium rounded-lg bg-slate-50 text-slate-500 hover:bg-slate-100 transition-colors border border-slate-200"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}

function AnomalyHistoryLog({ anomalies }) {
  return (
    <div className="mt-4 pt-3 border-t border-slate-100">
      <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-2">Activity Log</p>
      <div className="space-y-2">
        {anomalies.map(a => {
          const categoryLabel = { monthly_recurring: 'Monthly Recurring', voip: 'VoIP' }[a.category] || a.category || 'Unknown';
          const ts = a.acknowledged_at || a.reviewed_at;
          const dateStr = ts ? new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
          const statusLabel = a.status === 'acknowledged' ? 'Acknowledged' : 'Dismissed';
          const statusColor = a.status === 'acknowledged' ? 'text-emerald-600 bg-emerald-50' : 'text-slate-500 bg-slate-50';

          return (
            <div key={a.id} className="flex items-start gap-3 py-2 px-3 rounded-lg bg-slate-50/80">
              <div className="shrink-0 mt-0.5">
                <span className={cn('text-[9px] font-semibold px-1.5 py-0.5 rounded', statusColor)}>{statusLabel}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-medium text-slate-700">{categoryLabel}</span>
                  <span className={cn('font-bold text-[11px]', a.direction === 'decrease' ? 'text-red-500' : 'text-amber-500')}>
                    {a.direction === 'decrease' ? '' : '+'}{a.pct_change}%
                  </span>
                  <span className="text-slate-400">${a.current_amount?.toLocaleString()} (was ${a.previous_avg?.toLocaleString()})</span>
                  <span className="text-slate-300">|</span>
                  <span className="text-slate-400">{a.bill_period}</span>
                </div>
                {a.acknowledgement_notes && (
                  <p className="text-[11px] text-slate-500 mt-1">{a.acknowledgement_notes}</p>
                )}
                {dateStr && <p className="text-[9px] text-slate-300 mt-0.5">{dateStr}</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function BillingAnomaliesSection({
  openAnomalies,
  resolvedAnomalies,
  anomalyHistory,
  showHistory,
  onToggleHistory,
  acknowledgeId,
  acknowledgeNotes,
  onAcknowledgeNotesChange,
  onAcknowledge,
  onDismiss,
  onStartAcknowledge,
  onCancelAcknowledge,
}) {
  if (openAnomalies.length === 0 && resolvedAnomalies.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-red-200/60 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-red-500" />
          <h3 className="text-sm font-bold text-slate-900">Billing Anomalies</h3>
          {openAnomalies.length > 0 && (
            <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-semibold">{openAnomalies.length}</span>
          )}
        </div>
        {resolvedAnomalies.length > 0 && (
          <button
            onClick={onToggleHistory}
            className="text-[10px] font-medium text-slate-400 hover:text-slate-600 transition-colors flex items-center gap-1"
          >
            {showHistory ? 'Hide' : 'Show'} History ({resolvedAnomalies.length})
          </button>
        )}
      </div>
      <div className="space-y-3">
        {openAnomalies.map((a) => (
          <AnomalyCard
            key={a.id}
            anomaly={a}
            anomalyHistory={anomalyHistory}
            acknowledgeId={acknowledgeId}
            acknowledgeNotes={acknowledgeNotes}
            onAcknowledgeNotesChange={onAcknowledgeNotesChange}
            onAcknowledge={onAcknowledge}
            onDismiss={onDismiss}
            onStartAcknowledge={onStartAcknowledge}
            onCancelAcknowledge={onCancelAcknowledge}
          />
        ))}
      </div>

      {showHistory && resolvedAnomalies.length > 0 && (
        <AnomalyHistoryLog anomalies={resolvedAnomalies} />
      )}
    </div>
  );
}
