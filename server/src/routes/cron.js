/**
 * Cron Job Admin Routes
 *
 *   GET  /api/cron/jobs     — list all cron jobs with last run info
 *   GET  /api/cron/history  — recent cron job run history
 *   POST /api/cron/run      — manually trigger a cron job
 */

import { Router } from 'express';
import { requireAdmin } from '../middleware/auth.js';
import { getServiceSupabase } from '../lib/supabase.js';
import {
  CRON_JOBS,
  DEFAULT_FAILED_RETRY_AFTER_HOURS,
  DEFAULT_STALE_AFTER_HOURS,
  getRunningCronJobNames,
  runCronJobManually,
  runStaleJobCatchup,
} from '../scheduled.js';

const router = Router();

function completedAtMs(run) {
  if (!run?.completed_at) return null;
  const ms = new Date(run.completed_at).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function isStale(lastSuccess, staleAfterHours) {
  const completed = completedAtMs(lastSuccess);
  if (!completed) return true;
  return Date.now() - completed > staleAfterHours * 60 * 60 * 1000;
}

function isRecentFailure(lastRun, retryAfterHours) {
  if (lastRun?.status !== 'failed') return false;
  const completed = completedAtMs(lastRun);
  if (!completed) return false;
  return Date.now() - completed < retryAfterHours * 60 * 60 * 1000;
}

function summarizeJobs(jobs) {
  return jobs.reduce((summary, job) => {
    summary.total += 1;
    summary[job.health] = (summary[job.health] || 0) + 1;
    return summary;
  }, { total: 0, healthy: 0, stale: 0, failed: 0, backoff: 0, running: 0, never: 0 });
}

// ── GET /api/cron/jobs ──────────────────────────────────────────────
// Returns all registered cron jobs with their last run status

router.get('/jobs', requireAdmin, async (_req, res, next) => {
  try {
    const supabase = getServiceSupabase();

    // Get the most recent run for each job
    const { data: recentRuns, error } = await supabase
      .from('cron_job_runs')
      .select('*')
      .order('completed_at', { ascending: false })
      .limit(500);

    if (error) throw new Error(error.message);

    // Group by job_name, take the latest and latest successful run for each.
    const lastRunByJob = {};
    const lastSuccessByJob = {};
    for (const run of (recentRuns || [])) {
      if (!lastRunByJob[run.job_name]) {
        lastRunByJob[run.job_name] = run;
      }
      if (run.status === 'success' && !lastSuccessByJob[run.job_name]) {
        lastSuccessByJob[run.job_name] = run;
      }
    }
    const runningJobs = new Set(getRunningCronJobNames());

    const jobs = CRON_JOBS.map(job => {
      const lastRun = lastRunByJob[job.name] || null;
      const lastSuccess = lastSuccessByJob[job.name] || null;
      const staleAfterHours = job.staleAfterHours || DEFAULT_STALE_AFTER_HOURS;
      const failedRetryAfterHours = job.failedRetryAfterHours || DEFAULT_FAILED_RETRY_AFTER_HOURS;
      const running = runningJobs.has(job.name);
      const stale = isStale(lastSuccess, staleAfterHours);
      const recentFailure = isRecentFailure(lastRun, failedRetryAfterHours);
      const health = running
        ? 'running'
        : recentFailure
          ? 'backoff'
          : stale
            ? 'stale'
            : lastRun?.status === 'failed'
              ? 'failed'
              : lastRun?.status === 'success'
                ? 'healthy'
                : 'never';

      return {
        name: job.name,
        label: job.label,
        description: job.description,
        schedule: job.schedule,
        category: job.category,
        staleAfterHours,
        failedRetryAfterHours,
        lastRun,
        lastSuccess,
        isRunning: running,
        isStale: stale,
        isRecentFailure: recentFailure,
        health,
      };
    });

    res.json({ jobs, summary: summarizeJobs(jobs), catchupDisabled: process.env.DISABLE_CRON_CATCHUP === 'true' });
  } catch (error) {
    next(error);
  }
});

// ── GET /api/cron/history ───────────────────────────────────────────
// Returns recent cron job execution history

router.get('/history', requireAdmin, async (req, res, next) => {
  try {
    const supabase = getServiceSupabase();
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const jobName = req.query.job_name || null;

    let query = supabase
      .from('cron_job_runs')
      .select('*')
      .order('completed_at', { ascending: false })
      .limit(limit);

    if (jobName) {
      query = query.eq('job_name', jobName);
    }

    const { data: runs, error } = await query;
    if (error) throw new Error(error.message);

    res.json({ runs: runs || [] });
  } catch (error) {
    next(error);
  }
});

// ── POST /api/cron/run ──────────────────────────────────────────────
// Manually trigger a cron job

router.post('/run', requireAdmin, async (req, res, next) => {
  try {
    const { job_name } = req.body;
    if (!job_name) {
      return res.status(400).json({ error: 'job_name is required' });
    }

    // Validate job_name against the known allow-list to prevent arbitrary execution.
    const knownJobNames = CRON_JOBS.map(j => j.name);
    if (!knownJobNames.includes(job_name)) {
      return res.status(400).json({
        error: `Unknown job_name. Must be one of: ${knownJobNames.join(', ')}`,
      });
    }

    const result = await runCronJobManually(job_name);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// ── POST /api/cron/catch-up ─────────────────────────────────────────
// Queue stale jobs immediately, respecting the same overlap and failure-backoff
// rules as the automatic stale-job monitor.

router.post('/catch-up', requireAdmin, async (_req, res, next) => {
  try {
    const result = await runStaleJobCatchup({ immediate: true });
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
});

export { router as cronRouter };
