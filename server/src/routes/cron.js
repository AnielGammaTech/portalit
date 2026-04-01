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
import { CRON_JOBS, runCronJobManually } from '../scheduled.js';

const router = Router();

// ── GET /api/cron/jobs ──────────────────────────────────────────────
// Returns all registered cron jobs with their last run status

router.get('/jobs', requireAdmin, async (_req, res, next) => {
  try {
    const supabase = getServiceSupabase();

    // Get the most recent run for each job
    const { data: recentRuns } = await supabase
      .from('cron_job_runs')
      .select('*')
      .order('completed_at', { ascending: false })
      .limit(200);

    // Group by job_name, take the latest for each
    const lastRunByJob = {};
    for (const run of (recentRuns || [])) {
      if (!lastRunByJob[run.job_name]) {
        lastRunByJob[run.job_name] = run;
      }
    }

    const jobs = CRON_JOBS.map(job => ({
      name: job.name,
      label: job.label,
      description: job.description,
      schedule: job.schedule,
      category: job.category,
      lastRun: lastRunByJob[job.name] || null,
    }));

    res.json({ jobs });
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

export { router as cronRouter };
