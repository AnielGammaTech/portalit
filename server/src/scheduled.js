import cron from 'node-cron';
import { getServiceSupabase } from './lib/supabase.js';
import { scheduledHaloPSASync } from './functions/scheduledHaloPSASync.js';
import { scheduledDattoSync } from './functions/scheduledDattoSync.js';
import { scheduledJumpCloudSync } from './functions/scheduledJumpCloudSync.js';
import { scheduledSpanningSync } from './functions/scheduledSpanningSync.js';
import { syncRocketCyber } from './functions/syncRocketCyber.js';
import { syncCoveData } from './functions/syncCoveData.js';
import { syncSaaSAlerts } from './functions/syncSaaSAlerts.js';
import { syncUniFiDevices } from './functions/syncUniFiDevices.js';
import { syncPax8Subscriptions } from './functions/syncPax8Subscriptions.js';
import { syncDattoEDR } from './functions/syncDattoEDR.js';
import { licenseRenewalReminder } from './functions/licenseRenewalReminder.js';
import { autoSuspendUnusedLicenses } from './functions/autoSuspendUnusedLicenses.js';
import { syncHaloPSARecurringBills } from './functions/syncHaloPSARecurringBills.js';
import { syncHaloPSAInvoices } from './functions/syncHaloPSAInvoices.js';
import scanBillingAnomalies from './functions/scanBillingAnomalies.js';
import { syncCIPP } from './functions/syncCIPP.js';
import { sync3CX } from './functions/sync3CX.js';
import { syncDarkWebID } from './functions/syncDarkWebID.js';
import { syncDmarcReport } from './functions/syncDmarcReport.js';
import { syncVPenTest } from './functions/syncVPenTest.js';
import { syncVultr } from './functions/syncVultr.js';
import { expireReconciliationReviews } from './functions/expireReconciliationReviews.js';
import { reconciliationReminders } from './functions/reconciliationReminders.js';
import { syncGraphus } from './functions/syncGraphus.js';


const SYSTEM_USER = { role: 'admin', email: 'system@portalit.app' };
const CRON_MAX_ATTEMPTS = Number(process.env.CRON_MAX_ATTEMPTS || 3);
const CRON_RETRY_DELAY_MS = Number(process.env.CRON_RETRY_DELAY_MS || 30000);
const CRON_CATCHUP_DELAY_MS = Number(process.env.CRON_CATCHUP_DELAY_MS || 60000);
const CRON_CATCHUP_STAGGER_MS = Number(process.env.CRON_CATCHUP_STAGGER_MS || 45000);
const CRON_STALE_MONITOR_INTERVAL_MS = Number(process.env.CRON_STALE_MONITOR_INTERVAL_MS || 60 * 60 * 1000);
export const DEFAULT_STALE_AFTER_HOURS = 26;
export const DEFAULT_FAILED_RETRY_AFTER_HOURS = 6;
const runningJobs = new Set();

export function getRunningCronJobNames() {
  return Array.from(runningJobs);
}

// ── Cron job definitions (used for scheduling + admin dashboard) ─────

export const CRON_JOBS = [
  { name: 'scheduledHaloPSASync', label: 'HaloPSA Sync', description: 'Customers, contacts, contracts & tickets', schedule: '0 2 * * *', category: 'halopsa', fn: scheduledHaloPSASync, action: 'sync_now', staleAfterHours: 8 },
  { name: 'syncHaloPSARecurringBills', label: 'HaloPSA Recurring Bills', description: 'Recurring invoices & line items', schedule: '15 2 * * *', category: 'halopsa', fn: syncHaloPSARecurringBills, action: 'sync_now', staleAfterHours: 8 },
  { name: 'syncHaloPSAInvoices', label: 'HaloPSA Invoices', description: 'Invoices & invoice line items', schedule: '30 2 * * *', category: 'halopsa', fn: syncHaloPSAInvoices, action: 'sync_now', staleAfterHours: 8 },
  { name: 'scheduledDattoSync', label: 'Datto RMM Sync', description: 'RMM devices', schedule: '0 3 * * *', category: 'datto', fn: scheduledDattoSync, action: 'sync_now', staleAfterHours: 8 },
  { name: 'syncDattoEDR', label: 'Datto EDR Sync', description: 'EDR agent data', schedule: '15 3 * * *', category: 'datto', fn: syncDattoEDR, action: 'sync_all', staleAfterHours: 8 },
  { name: 'syncRocketCyber', label: 'RocketCyber Sync', description: 'Security incidents', schedule: '30 3 * * *', category: 'rocketcyber', fn: syncRocketCyber, action: 'sync_all', staleAfterHours: 8 },
  { name: 'syncRocketCyberAgents', label: 'RocketCyber Agents', description: 'Agent counts (fast)', schedule: '0 */4 * * *', category: 'rocketcyber', fn: syncRocketCyber, action: 'sync_agents', staleAfterHours: 8 },
  { name: 'scheduledJumpCloudSync', label: 'JumpCloud Sync', description: 'SSO users', schedule: '0 4 * * *', category: 'jumpcloud', fn: scheduledJumpCloudSync, action: 'sync_now', staleAfterHours: 8 },
  { name: 'syncCoveData', label: 'Cove Data Sync', description: 'Backup devices', schedule: '30 4 * * *', category: 'cove', fn: syncCoveData, action: 'sync_all', staleAfterHours: 8 },
  { name: 'scheduledSpanningSync', label: 'Spanning Sync', description: 'Backup users', schedule: '0 5 * * *', category: 'spanning', fn: scheduledSpanningSync, action: 'sync_now', staleAfterHours: 8 },
  { name: 'syncSaaSAlerts', label: 'SaaS Alerts Sync', description: 'SaaS security events', schedule: '30 5 * * *', category: 'saas_alerts', fn: syncSaaSAlerts, action: 'sync_all', staleAfterHours: 8 },
  { name: 'syncUniFiDevices', label: 'UniFi Sync', description: 'Network devices', schedule: '0 6 * * *', category: 'unifi', fn: syncUniFiDevices, action: 'sync_all', staleAfterHours: 8 },
  { name: 'syncPax8Subscriptions', label: 'Pax8 Sync', description: 'Cloud subscriptions', schedule: '30 6 * * *', category: 'pax8', fn: syncPax8Subscriptions, action: 'sync_all', staleAfterHours: 8 },
  { name: 'licenseRenewalReminder', label: 'License Renewal Reminder', description: 'Email alerts for upcoming renewals', schedule: '0 8 * * *', category: 'system', fn: licenseRenewalReminder, action: 'sync_now' },
  { name: 'autoSuspendUnusedLicenses', label: 'Auto-Suspend Licenses', description: 'Suspend unused licenses', schedule: '0 9 * * *', category: 'system', fn: autoSuspendUnusedLicenses, action: 'sync_now' },
  { name: 'syncCIPP', label: 'CIPP / M365 Sync', description: 'Microsoft 365 users, groups & mailboxes via CIPP', schedule: '45 3 * * *', category: 'cipp', fn: syncCIPP, action: 'sync_all', staleAfterHours: 8 },
  { name: 'sync3CX', label: '3CX Sync', description: 'Phone system extensions & call data', schedule: '15 4 * * *', category: 'threecx', fn: sync3CX, action: 'sync_all', staleAfterHours: 8 },
  { name: 'syncDarkWebID', label: 'Dark Web ID Sync', description: 'Dark web monitoring alerts', schedule: '45 4 * * *', category: 'darkweb', fn: syncDarkWebID, action: 'sync_all', staleAfterHours: 8 },
  { name: 'syncDmarcReport', label: 'DMARC Sync', description: 'DMARC email authentication reports', schedule: '15 5 * * *', category: 'dmarc', fn: syncDmarcReport, action: 'sync_all', staleAfterHours: 8 },
  { name: 'syncVultr', label: 'Vultr Sync', description: 'Cloud server instances', schedule: '45 5 * * *', category: 'vultr', fn: syncVultr, action: 'sync_all', staleAfterHours: 8 },
  { name: 'syncVPenTest', label: 'vPenTest Sync', description: 'Automated penetration test results', schedule: '15 6 * * *', category: 'vpentest', fn: syncVPenTest, action: 'sync_all', staleAfterHours: 8 },
  { name: 'syncGraphus', label: 'Graphus Sync', description: 'Email security protected users', schedule: '45 6 * * *', category: 'graphus', fn: syncGraphus, action: 'sync_all', staleAfterHours: 8 },
  { name: 'scanBillingAnomalies', label: 'Billing Anomaly Scan', description: 'Detect billing changes >5% per category (Monthly Recurring, VoIP)', schedule: '0 7 * * 1', category: 'lootit', fn: scanBillingAnomalies, action: 'scan', staleAfterHours: 170 },
  { name: 'expireReconciliationReviews', label: 'Expire Reconciliation Reviews', description: 'Reset sign-offs older than 30 days back to pending for re-review', schedule: '0 1 * * *', category: 'lootit', fn: expireReconciliationReviews, action: 'expire' },
  { name: 'reconciliationReminders', label: 'Reconciliation Reminders', description: 'Telegram alerts for customers due for reconciliation', schedule: '0 12 * * *', category: 'lootit', fn: reconciliationReminders, action: 'remind' },
];

// ── Log cron job execution to database ───────────────────────────────

async function logCronRun(jobName, status, result, error, durationMs) {
  try {
    const supabase = getServiceSupabase();
    await supabase.from('cron_job_runs').insert({
      job_name: jobName,
      status,
      result: result ? JSON.stringify(result) : null,
      error_message: error || null,
      duration_ms: durationMs,
      started_at: new Date(Date.now() - durationMs).toISOString(),
      completed_at: new Date().toISOString(),
    });
  } catch (logErr) {
    console.error(`[CRON] Failed to log run for ${jobName}:`, logErr.message);
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function normalizeJobError(error) {
  return error?.message || String(error) || 'Unknown error';
}

async function executeJob(jobDef) {
  const result = await jobDef.fn({ action: jobDef.action }, SYSTEM_USER);
  if (result?.success === false) {
    throw new Error(result.error || result.message || `${jobDef.name} returned success=false`);
  }
  return result;
}

async function executeJobWithRetry(jobDef, maxAttempts = CRON_MAX_ATTEMPTS) {
  let lastError = null;
  const attempts = Math.max(1, maxAttempts);

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const result = await executeJob(jobDef);
      return { result, attempts: attempt };
    } catch (error) {
      lastError = error;
      if (attempt >= attempts) break;
      const delay = CRON_RETRY_DELAY_MS * attempt;
      console.warn(`[CRON] ${jobDef.name} attempt ${attempt}/${attempts} failed: ${normalizeJobError(error)}. Retrying in ${delay}ms`);
      await sleep(delay);
    }
  }

  throw Object.assign(new Error(normalizeJobError(lastError)), { cause: lastError });
}

async function getLastSuccessfulRun(jobName) {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from('cron_job_runs')
    .select('completed_at')
    .eq('job_name', jobName)
    .eq('status', 'success')
    .order('completed_at', { ascending: false })
    .limit(1);

  if (error) throw new Error(error.message);
  return data?.[0] || null;
}

async function getLastRun(jobName) {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from('cron_job_runs')
    .select('completed_at, status')
    .eq('job_name', jobName)
    .order('completed_at', { ascending: false })
    .limit(1);

  if (error) throw new Error(error.message);
  return data?.[0] || null;
}

function isRunStale(lastRun, staleAfterHours = DEFAULT_STALE_AFTER_HOURS) {
  if (!lastRun?.completed_at) return true;
  const lastCompleted = new Date(lastRun.completed_at).getTime();
  if (!Number.isFinite(lastCompleted)) return true;
  return Date.now() - lastCompleted > staleAfterHours * 60 * 60 * 1000;
}

function isRecentFailure(lastRun, retryAfterHours = DEFAULT_FAILED_RETRY_AFTER_HOURS) {
  if (lastRun?.status !== 'failed' || !lastRun.completed_at) return false;
  const lastCompleted = new Date(lastRun.completed_at).getTime();
  if (!Number.isFinite(lastCompleted)) return false;
  return Date.now() - lastCompleted < retryAfterHours * 60 * 60 * 1000;
}

// ── Job wrapper with DB logging ──────────────────────────────────────

function wrapJob(jobDef) {
  return async () => {
    if (runningJobs.has(jobDef.name)) {
      console.warn(`[CRON] ${jobDef.name} is already running; skipping overlapping trigger`);
      return;
    }

    runningJobs.add(jobDef.name);
    const startTime = Date.now();
    console.log(`[CRON] Running ${jobDef.name} at ${new Date().toISOString()}`);
    try {
      const { result, attempts } = await executeJobWithRetry(jobDef);
      const durationMs = Date.now() - startTime;
      console.log(`[CRON] ${jobDef.name} completed in ${durationMs}ms after ${attempts} attempt(s):`, result?.message || 'OK');
      await logCronRun(jobDef.name, 'success', { ...(result || {}), attempts }, null, durationMs);
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errMsg = normalizeJobError(error);
      console.error(`[CRON] ${jobDef.name} failed after ${durationMs}ms:`, errMsg);
      try {
        await logCronRun(jobDef.name, 'failed', null, errMsg, durationMs);
      } catch (logErr) {
        console.error(`[CRON] Failed to log cron failure for ${jobDef.name}:`, logErr?.message);
      }
    } finally {
      runningJobs.delete(jobDef.name);
    }
  };
}

// ── Manual trigger (for admin "Run Now" button) ──────────────────────

export async function runCronJobManually(jobName) {
  const jobDef = CRON_JOBS.find(j => j.name === jobName);
  if (!jobDef) throw new Error(`Unknown cron job: ${jobName}`);
  if (runningJobs.has(jobDef.name)) {
    return { success: false, error: `${jobDef.label} is already running`, durationMs: 0 };
  }

  runningJobs.add(jobDef.name);
  const startTime = Date.now();
  try {
    const { result, attempts } = await executeJobWithRetry(jobDef);
    const durationMs = Date.now() - startTime;
    await logCronRun(jobDef.name, 'success', { ...(result || {}), attempts }, null, durationMs);
    return { success: true, result, durationMs, attempts };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errMsg = normalizeJobError(error);
    await logCronRun(jobDef.name, 'failed', null, errMsg, durationMs);
    return { success: false, error: errMsg, durationMs };
  } finally {
    runningJobs.delete(jobDef.name);
  }
}

export async function runStaleJobCatchup({ immediate = false, ignoreFailureBackoff = false } = {}) {
  if (process.env.DISABLE_CRON_CATCHUP === 'true') {
    return { queued: [], skipped: CRON_JOBS.map(job => ({ name: job.name, reason: 'catch-up disabled' })) };
  }

  console.log('[CRON] Checking for stale scheduled jobs');
  let offset = 0;
  const queued = [];
  const skipped = [];

  for (const jobDef of CRON_JOBS) {
    try {
      const lastSuccess = await getLastSuccessfulRun(jobDef.name);
      const lastRun = await getLastRun(jobDef.name);
      const staleAfterHours = jobDef.staleAfterHours || DEFAULT_STALE_AFTER_HOURS;
      if (runningJobs.has(jobDef.name)) {
        skipped.push({ name: jobDef.name, reason: 'already running' });
        continue;
      }
      if (!isRunStale(lastSuccess, staleAfterHours)) {
        skipped.push({ name: jobDef.name, reason: 'fresh' });
        continue;
      }
      if (!ignoreFailureBackoff && isRecentFailure(lastRun, jobDef.failedRetryAfterHours || DEFAULT_FAILED_RETRY_AFTER_HOURS)) {
        skipped.push({ name: jobDef.name, reason: 'recent failure backoff' });
        continue;
      }

      const delayMs = offset + (immediate && queued.length === 0 ? 0 : CRON_CATCHUP_STAGGER_MS);
      setTimeout(() => {
        console.log(`[CRON] Catch-up run queued for stale job ${jobDef.name}`);
        wrapJob(jobDef)();
      }, delayMs).unref();
      queued.push({ name: jobDef.name, label: jobDef.label, delayMs, staleAfterHours });
      offset = delayMs;
    } catch (error) {
      skipped.push({ name: jobDef.name, reason: normalizeJobError(error) });
      console.warn(`[CRON] Could not evaluate catch-up for ${jobDef.name}:`, normalizeJobError(error));
    }
  }

  return { queued, skipped };
}

// ── Setup all scheduled jobs ─────────────────────────────────────────

export function setupScheduledJobs() {
  for (const jobDef of CRON_JOBS) {
    cron.schedule(jobDef.schedule, wrapJob(jobDef));
  }

  setTimeout(() => {
    runStaleJobCatchup().catch((error) => {
      console.error('[CRON] Catch-up scheduler failed:', normalizeJobError(error));
    });
  }, CRON_CATCHUP_DELAY_MS).unref();

  setInterval(() => {
    runStaleJobCatchup().catch((error) => {
      console.error('[CRON] Stale-job monitor failed:', normalizeJobError(error));
    });
  }, CRON_STALE_MONITOR_INTERVAL_MS).unref();

  console.log(`[CRON] ${CRON_JOBS.length} scheduled jobs registered with retries and stale-job catch-up enabled`);
}
