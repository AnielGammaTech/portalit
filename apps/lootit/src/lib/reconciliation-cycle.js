const MONTH_LABEL_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  year: 'numeric',
});

function parseDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function daysSince(date, now = new Date()) {
  if (!date) return null;
  return Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
}

export function getMonthKey(dateInput = new Date()) {
  const date = parseDate(dateInput) || new Date();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${date.getFullYear()}-${month}`;
}

export function getMonthLabel(periodKey) {
  if (!periodKey) return '';
  const [year, month] = periodKey.split('-').map(Number);
  if (!year || !month) return periodKey;
  return MONTH_LABEL_FORMATTER.format(new Date(year, month - 1, 1));
}

export function getReconciliationCycleContext(latestSignOff, nowInput = new Date()) {
  const now = parseDate(nowInput) || new Date();
  const signedAt = parseDate(latestSignOff?.signed_at);
  const nextDueAt = parseDate(latestSignOff?.next_reconciliation_date);
  const latestSignedPeriod = latestSignOff?.billing_period || (signedAt ? getMonthKey(signedAt) : null);

  const overdueByDate = nextDueAt ? now >= nextDueAt : false;
  const overdueByAge = signedAt && !nextDueAt ? (daysSince(signedAt, now) ?? 0) >= 30 : false;
  const isDue = !latestSignOff || overdueByDate || overdueByAge;
  const activePeriod = isDue ? getMonthKey(now) : (latestSignedPeriod || getMonthKey(now));
  const startedAt = isDue
    ? (nextDueAt || startOfMonth(now))
    : (signedAt || startOfMonth(now));

  return {
    period: activePeriod,
    label: getMonthLabel(activePeriod),
    latestSignedPeriod,
    signedAt,
    nextDueAt,
    startedAt,
    isDue,
    isSignedOff: !!latestSignOff && !isDue && latestSignedPeriod === activePeriod,
    requiresFreshReview: isDue,
    daysSinceSignOff: signedAt ? daysSince(signedAt, now) : null,
  };
}

export function reviewCountsForCycle(review, cycleContext) {
  if (!review || !['reviewed', 'force_matched', 'dismissed'].includes(review.status)) return false;
  if (!cycleContext?.requiresFreshReview) return true;
  const reviewedAt = parseDate(review.reviewed_at);
  if (!reviewedAt || !cycleContext.startedAt) return false;
  return reviewedAt >= cycleContext.startedAt;
}

export function getReconciliationCycleStatus(cycleContext, verificationState) {
  if (cycleContext?.isSignedOff && verificationState?.allVerified) {
    return {
      key: 'signed_off',
      label: 'Signed Off',
      tone: 'emerald',
    };
  }
  if (cycleContext?.isSignedOff && verificationState && !verificationState.allVerified) {
    return {
      key: 'changed_since_signoff',
      label: 'Changed Since Sign-Off',
      tone: 'amber',
    };
  }
  if (!verificationState || verificationState.total === 0) {
    return {
      key: 'not_started',
      label: 'Not Started',
      tone: 'slate',
    };
  }
  if (verificationState.allVerified) {
    return {
      key: 'ready_to_sign',
      label: 'Ready to Sign',
      tone: 'emerald',
    };
  }
  if (verificationState.verified > 0) {
    return {
      key: 'in_progress',
      label: 'In Progress',
      tone: 'amber',
    };
  }
  return {
    key: 'not_started',
    label: 'Not Started',
    tone: 'red',
  };
}
