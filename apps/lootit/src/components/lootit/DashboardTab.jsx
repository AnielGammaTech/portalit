import React from 'react';
import { useReconciliationSnapshot } from '@/hooks/useReconciliationSnapshot';
import SignOffBanner from './SignOffBanner';
import SnapshotCard from './SnapshotCard';

export default function DashboardTab({ customerId, onTabChange, onShowSnapshotDetail }) {
  const { latestSignOff, snapshots, isLoading } = useReconciliationSnapshot(customerId);

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400 text-sm">Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SignOffBanner
        signOff={latestSignOff}
        onStartReconciliation={() => onTabChange('reconciliation')}
      />

      {snapshots.length > 0 && (
        <div className="grid grid-cols-4 gap-3 auto-rows-fr">
          {snapshots.map((snapshot) => (
            <SnapshotCard
              key={snapshot.id}
              snapshot={snapshot}
              onDetails={onShowSnapshotDetail}
            />
          ))}
        </div>
      )}

      {!latestSignOff && (
        <div className="text-center py-8">
          <p className="text-slate-400 text-sm">
            Complete your first reconciliation to see the dashboard snapshot here.
          </p>
        </div>
      )}
    </div>
  );
}
