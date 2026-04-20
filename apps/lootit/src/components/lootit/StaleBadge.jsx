import React from 'react';

export default function StaleBadge({ stalenessDays, changeDetected, forceMatchStale, exclusionStale, exclusionDaysSinceVerified }) {
  if (changeDetected) {
    return (
      <span
        className="absolute top-[6px] right-3 text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded z-20"
        style={{ background: '#EF4444', color: '#FFFFFF', letterSpacing: '0.5px' }}
      >
        New Issue
      </span>
    );
  }

  if (forceMatchStale) {
    return (
      <span
        className="absolute top-[6px] right-3 text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded z-20"
        style={{ background: '#F97316', color: '#FFFFFF', letterSpacing: '0.5px' }}
        title={`Force-matched ${stalenessDays || '?'}d ago — quantities may have changed`}
      >
        Re-verify
      </span>
    );
  }

  if (exclusionStale) {
    return (
      <span
        className="absolute top-[6px] right-3 text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded z-20"
        style={{ background: '#F59E0B', color: '#000000', letterSpacing: '0.5px' }}
        title={`Exclusions last verified ${exclusionDaysSinceVerified || '?'}d ago`}
      >
        Exclusion Stale
      </span>
    );
  }

  if (stalenessDays != null) {
    return (
      <span
        className="absolute top-[6px] right-3 text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded z-20"
        style={{ background: '#EAB308', color: '#000000', letterSpacing: '0.5px' }}
      >
        Stale · {stalenessDays}d
      </span>
    );
  }

  return null;
}
