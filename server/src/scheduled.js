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


const SYSTEM_USER = { role: 'admin', email: 'system@portalit.app' };

// ── Cron job definitions (used for scheduling + admin dashboard) ─────

export const CRON_JOBS = [
  { name: 'scheduledHaloPSASync', label: 'HaloPSA Sync', description: 'Customers, contacts, contracts & tickets', schedule: '0 2 * * *', category: 'halopsa', fn: scheduledHaloPSASync, action: 'sync_now' },
  { name: 'syncHaloPSARecurringBills', label: 'HaloPSA Recurring Bills', description: 'Recurring invoices & line items', schedule: '15 2 * * *', category: 'halopsa', fn: syncHaloPSARecurringBills, action: 'sync_now' },
  { name: 'syncHaloPSAInvoices', label: 'HaloPSA Invoices', description: 'Invoices & invoice line items', schedule: '30 2 * * *', category: 'halopsa', fn: syncHaloPSAInvoices, action: 'sync_now' },
  { name: 'scheduledDattoSync', label: 'Datto RMM Sync', description: 'RMM devices', schedule: '0 3 * * *', category: 'datto', fn: scheduledDattoSync, action: 'sync_now' },
  { name: 'syncDattoEDR', label: 'Datto EDR Sync', description: 'EDR agent data', schedule: '15 3 * * *', category: 'datto', fn: syncDattoEDR, action: 'sync_all' },
  { name: 'syncRocketCyber', label: 'RocketCyber Sync', description: 'Security incidents', schedule: '30 3 * * *', category: 'rocketcyber', fn: syncRocketCyber, action: 'sync_all' },
  { name: 'scheduledJumpCloudSync', label: 'JumpCloud Sync', description: 'SSO users', schedule: '0 4 * * *', category: 'jumpcloud', fn: scheduledJumpCloudSync, action: 'sync_now' },
  { name: 'syncCoveData', label: 'Cove Data Sync', description: 'Backup devices', schedule: '30 4 * * *', category: 'cove', fn: syncCoveData, action: 'sync_all' },
  { name: 'scheduledSpanningSync', label: 'Spanning Sync', description: 'Backup users', schedule: '0 5 * * *', category: 'spanning', fn: scheduledSpanningSync, action: 'sync_now' },
  { name: 'syncSaaSAlerts', label: 'SaaS Alerts Sync', description: 'SaaS security events', schedule: '30 5 * * *', category: 'saas_alerts', fn: syncSaaSAlerts, action: 'sync_all' },
  { name: 'syncUniFiDevices', label: 'UniFi Sync', description: 'Network devices', schedule: '0 6 * * *', category: 'unifi', fn: syncUniFiDevices, action: 'sync_all' },
  { name: 'syncPax8Subscriptions', label: 'Pax8 Sync', description: 'Cloud subscriptions', schedule: '30 6 * * *', category: 'pax8', fn: syncPax8Subscriptions, action: 'sync_all' },
  { name: 'licenseRenewalReminder', label: 'License Renewal Reminder', description: 'Email alerts for upcoming renewals', schedule: '0 8 * * *', category: 'system', fn: licenseRenewalReminder, action: 'sync_now' },
  { name: 'autoSuspendUnusedLicenses', label: 'Auto-Suspend Licenses', description: 'Suspend unused licenses', schedule: '0 9 * * *', category: 'system', fn: autoSuspendUnusedLicenses, action: 'sync_now' },
  { name: 'syncCIPP', label: 'CIPP / M365 Sync', description: 'Microsoft 365 users, groups & mailboxes via CIPP', schedule: '45 3 * * *', category: 'cipp', fn: syncCIPP, action: 'sync_all' },
  { name: 'sync3CX', label: '3CX Sync', description: 'Phone system extensions & call data', schedule: '15 4 * * *', category: 'threecx', fn: sync3CX, action: 'sync_all' },
  { name: 'syncDarkWebID', label: 'Dark Web ID Sync', description: 'Dark web monitoring alerts', schedule: '45 4 * * *', category: 'darkweb', fn: syncDarkWebID, action: 'sync_all' },
  { name: 'syncDmarcReport', label: 'DMARC Sync', description: 'DMARC email authentication reports', schedule: '15 5 * * *', category: 'dmarc', fn: syncDmarcReport, action: 'sync_all' },
  { name: 'syncVultr', label: 'Vultr Sync', description: 'Cloud server instances', schedule: '45 5 * * *', category: 'vultr', fn: syncVultr, action: 'sync_all' },
  { name: 'syncVPenTest', label: 'vPenTest Sync', description: 'Automated penetration test results', schedule: '15 6 * * *', category: 'vpentest', fn: syncVPenTest, action: 'sync_all' },
  { name: 'scanBillingAnomalies', label: 'Billing Anomaly Scan', description: 'Detect billing changes >5% per category (Monthly Recurring, VoIP)', schedule: '0 7 * * 1', category: 'lootit', fn: scanBillingAnomalies, action: 'scan' },
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

// ── Job wrapper with DB logging ──────────────────────────────────────

function wrapJob(jobDef) {
  return async () => {
    const startTime = Date.now();
    console.log(`[CRON] Running ${jobDef.name} at ${new Date().toISOString()}`);
    try {
      const result = await jobDef.fn({ action: jobDef.action }, SYSTEM_USER);
      const durationMs = Date.now() - startTime;
      console.log(`[CRON] ${jobDef.name} completed in ${durationMs}ms:`, result?.message || 'OK');
      await logCronRun(jobDef.name, 'success', result, null, durationMs);
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errMsg = error?.message || String(error) || 'Unknown error';
      console.error(`[CRON] ${jobDef.name} failed after ${durationMs}ms:`, errMsg);
      try {
        await logCronRun(jobDef.name, 'failed', null, errMsg, durationMs);
      } catch (logErr) {
        console.error(`[CRON] Failed to log cron failure for ${jobDef.name}:`, logErr?.message);
      }
    }
  };
}

// ── Manual trigger (for admin "Run Now" button) ──────────────────────

export async function runCronJobManually(jobName) {
  const jobDef = CRON_JOBS.find(j => j.name === jobName);
  if (!jobDef) throw new Error(`Unknown cron job: ${jobName}`);

  const startTime = Date.now();
  try {
    const result = await jobDef.fn({ action: jobDef.action }, SYSTEM_USER);
    const durationMs = Date.now() - startTime;
    await logCronRun(jobDef.name, 'success', result, null, durationMs);
    return { success: true, result, durationMs };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    await logCronRun(jobDef.name, 'failed', null, error.message, durationMs);
    return { success: false, error: error.message, durationMs };
  }
}

// ── Setup all scheduled jobs ─────────────────────────────────────────

export function setupScheduledJobs() {
  for (const jobDef of CRON_JOBS) {
    cron.schedule(jobDef.schedule, wrapJob(jobDef));
  }

  console.log(`[CRON] ${CRON_JOBS.length} scheduled jobs registered (HaloPSA 2AM → Pax8 6:30AM → checks 8-9AM)`);
}
