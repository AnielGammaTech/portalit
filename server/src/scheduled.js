import cron from 'node-cron';
import { scheduledHaloPSASync } from './functions/scheduledHaloPSASync.js';
import { scheduledDattoSync } from './functions/scheduledDattoSync.js';
import { scheduledJumpCloudSync } from './functions/scheduledJumpCloudSync.js';
import { scheduledSpanningSync } from './functions/scheduledSpanningSync.js';
import { syncRocketCyber } from './functions/syncRocketCyber.js';
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

export function setupScheduledJobs() {
  // Run syncs daily at 2 AM
  cron.schedule('0 2 * * *', wrapScheduledJob('scheduledHaloPSASync', scheduledHaloPSASync));
  cron.schedule('0 3 * * *', wrapScheduledJob('scheduledDattoSync', scheduledDattoSync));
  cron.schedule('30 3 * * *', async () => {
    console.log(`[CRON] Running scheduledRocketCyberSync at ${new Date().toISOString()}`);
    try {
      const result = await syncRocketCyber({ action: 'sync_all' }, SYSTEM_USER);
      console.log(`[CRON] scheduledRocketCyberSync completed: ${result?.recordsSynced || 0} synced`);
    } catch (error) {
      console.error(`[CRON] scheduledRocketCyberSync failed:`, error.message);
    }
  });
  cron.schedule('0 4 * * *', wrapScheduledJob('scheduledJumpCloudSync', scheduledJumpCloudSync));
  cron.schedule('0 5 * * *', wrapScheduledJob('scheduledSpanningSync', scheduledSpanningSync));

  // Run license checks daily at 8 AM
  cron.schedule('0 8 * * *', wrapScheduledJob('licenseRenewalReminder', licenseRenewalReminder));
  cron.schedule('0 9 * * *', wrapScheduledJob('autoSuspendUnusedLicenses', autoSuspendUnusedLicenses));

  console.log('[CRON] Scheduled jobs registered');
}
