import cron from 'node-cron';
import { scheduledHaloPSASync } from './functions/scheduledHaloPSASync.js';
import { scheduledDattoSync } from './functions/scheduledDattoSync.js';
import { scheduledJumpCloudSync } from './functions/scheduledJumpCloudSync.js';
import { scheduledSpanningSync } from './functions/scheduledSpanningSync.js';
import { syncRocketCyber } from './functions/syncRocketCyber.js';
import { syncCoveData } from './functions/syncCoveData.js';
import { syncSaaSAlerts } from './functions/syncSaaSAlerts.js';
import { syncUniFiDevices } from './functions/syncUniFiDevices.js';
import { syncPax8Subscriptions } from './functions/syncPax8Subscriptions.js';
import { licenseRenewalReminder } from './functions/licenseRenewalReminder.js';
import { autoSuspendUnusedLicenses } from './functions/autoSuspendUnusedLicenses.js';

const SYSTEM_USER = { role: 'admin', email: 'system@portalit.app' };

function wrapScheduledJob(name, fn) {
  return async () => {
    console.log(`[CRON] Running ${name} at ${new Date().toISOString()}`);
    try {
      const result = await fn({ action: 'sync_now' }, SYSTEM_USER);
      console.log(`[CRON] ${name} completed:`, result?.message || 'OK');
    } catch (error) {
      console.error(`[CRON] ${name} failed:`, error.message);
    }
  };
}

function wrapSyncAllJob(name, fn) {
  return async () => {
    console.log(`[CRON] Running ${name} at ${new Date().toISOString()}`);
    try {
      const result = await fn({ action: 'sync_all' }, SYSTEM_USER);
      console.log(`[CRON] ${name} completed:`, result?.synced ?? result?.recordsSynced ?? 'OK');
    } catch (error) {
      console.error(`[CRON] ${name} failed:`, error.message);
    }
  };
}

export function setupScheduledJobs() {
  // ── Nightly syncs (staggered to avoid rate limits) ──────────────
  // 2:00 AM — HaloPSA (customers, contacts, contracts, invoices, billing, tickets)
  cron.schedule('0 2 * * *', wrapScheduledJob('scheduledHaloPSASync', scheduledHaloPSASync));

  // 3:00 AM — Datto RMM devices
  cron.schedule('0 3 * * *', wrapScheduledJob('scheduledDattoSync', scheduledDattoSync));

  // 3:30 AM — RocketCyber incidents
  cron.schedule('30 3 * * *', wrapSyncAllJob('syncRocketCyber', syncRocketCyber));

  // 4:00 AM — JumpCloud users
  cron.schedule('0 4 * * *', wrapScheduledJob('scheduledJumpCloudSync', scheduledJumpCloudSync));

  // 4:30 AM — Cove Data Protection devices
  cron.schedule('30 4 * * *', wrapSyncAllJob('syncCoveData', syncCoveData));

  // 5:00 AM — Spanning Backup users
  cron.schedule('0 5 * * *', wrapScheduledJob('scheduledSpanningSync', scheduledSpanningSync));

  // 5:30 AM — SaaS Alerts events
  cron.schedule('30 5 * * *', wrapSyncAllJob('syncSaaSAlerts', syncSaaSAlerts));

  // 6:00 AM — UniFi network devices
  cron.schedule('0 6 * * *', wrapSyncAllJob('syncUniFiDevices', syncUniFiDevices));

  // 6:30 AM — Pax8 subscriptions
  cron.schedule('30 6 * * *', wrapSyncAllJob('syncPax8Subscriptions', syncPax8Subscriptions));

  // ── Morning checks ──────────────────────────────────────────────
  cron.schedule('0 8 * * *', wrapScheduledJob('licenseRenewalReminder', licenseRenewalReminder));
  cron.schedule('0 9 * * *', wrapScheduledJob('autoSuspendUnusedLicenses', autoSuspendUnusedLicenses));

  console.log('[CRON] Scheduled jobs registered (HaloPSA 2AM → Pax8 6:30AM → checks 8-9AM)');
}
