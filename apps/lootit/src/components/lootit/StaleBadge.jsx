import React from 'react';

export default function StaleBadge({ stalenessDays, changeDetected }) {
  if (changeDetected) {
    return (
      <span
        className="absolute top-[-6px] right-3 text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded z-20"
        style={{ background: '#EF4444', color: '#FFFFFF', letterSpacing: '0.5px' }}
      >
        New Issue
      </span>
    );
  }

  if (stalenessDays != null) {
    return (
      <span
        className="absolute top-[-6px] right-3 text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded z-20"
        style={{ background: '#EAB308', color: '#000000', letterSpacing: '0.5px' }}
      >
        Stale · {stalenessDays}d
      </span>
    );
  }

  return null;
}
