import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';

// Import all ported functions
import { syncHaloPSACustomers } from '../functions/syncHaloPSACustomers.js';
import { syncHaloPSAContacts } from '../functions/syncHaloPSAContacts.js';
import { syncHaloPSAContracts } from '../functions/syncHaloPSAContracts.js';
import { syncHaloPSAInvoices } from '../functions/syncHaloPSAInvoices.js';
import { syncHaloPSARecurringBills } from '../functions/syncHaloPSARecurringBills.js';
import { syncHaloPSATickets } from '../functions/syncHaloPSATickets.js';
import { scheduledHaloPSASync } from '../functions/scheduledHaloPSASync.js';
import { createHaloPSATicket } from '../functions/createHaloPSATicket.js';
import { lookupHaloPSATicket } from '../functions/lookupHaloPSATicket.js';
import { syncDattoRMMDevices } from '../functions/syncDattoRMMDevices.js';
import { scheduledDattoSync } from '../functions/scheduledDattoSync.js';
import { fetchDattoRMMBilling } from '../functions/fetchDattoRMMBilling.js';
import { syncDattoEDR } from '../functions/syncDattoEDR.js';
import { syncJumpCloudLicenses } from '../functions/syncJumpCloudLicenses.js';
import { scheduledJumpCloudSync } from '../functions/scheduledJumpCloudSync.js';
import { fetchJumpCloudBilling } from '../functions/fetchJumpCloudBilling.js';
import { syncSpanningBackup } from '../functions/syncSpanningBackup.js';
import { scheduledSpanningSync } from '../functions/scheduledSpanningSync.js';
import { syncRocketCyber } from '../functions/syncRocketCyber.js';
import { syncCoveData } from '../functions/syncCoveData.js';
import { syncDarkWebID } from '../functions/syncDarkWebID.js';
import { syncUniFiDevices } from '../functions/syncUniFiDevices.js';
import { syncSaaSAlerts } from '../functions/syncSaaSAlerts.js';
import { syncPax8Subscriptions } from '../functions/syncPax8Subscriptions.js';
import { autoSuspendUnusedLicenses } from '../functions/autoSuspendUnusedLicenses.js';
import { licenseRenewalReminder } from '../functions/licenseRenewalReminder.js';
import { sync3CX } from '../functions/sync3CX.js';
import { testAIConnection } from '../functions/testAIConnection.js';
import { syncDmarcReport } from '../functions/syncDmarcReport.js';
import { syncVultr } from '../functions/syncVultr.js';
import { syncVPenTest } from '../functions/syncVPenTest.js';

const functionMap = {
  syncHaloPSACustomers,
  syncHaloPSAContacts,
  syncHaloPSAContracts,
  syncHaloPSAInvoices,
  syncHaloPSARecurringBills,
  syncHaloPSATickets,
  scheduledHaloPSASync,
  createHaloPSATicket,
  lookupHaloPSATicket,
  syncDattoRMMDevices,
  scheduledDattoSync,
  fetchDattoRMMBilling,
  syncDattoEDR,
  syncJumpCloudLicenses,
  scheduledJumpCloudSync,
  fetchJumpCloudBilling,
  syncSpanningBackup,
  scheduledSpanningSync,
  syncRocketCyber,
  syncCoveData,
  syncDarkWebID,
  syncUniFiDevices,
  syncSaaSAlerts,
  syncPax8Subscriptions,
  autoSuspendUnusedLicenses,
  licenseRenewalReminder,
  sync3CX,
  testAIConnection,
  syncDmarcReport,
  syncVultr,
  syncVPenTest,
};

const router = Router();

router.post('/:functionName', requireAuth, async (req, res, next) => {
  try {
    const { functionName } = req.params;
    const handler = functionMap[functionName];

    if (!handler) {
      return res.status(404).json({ error: `Function '${functionName}' not found` });
    }

    const result = await handler(req.body, req.user);

    // Handle binary responses (e.g., PDF downloads from syncDattoEDR)
    if (result && result._binary) {
      res.set('Content-Type', result.contentType || 'application/octet-stream');
      if (result.filename) {
        res.set('Content-Disposition', `attachment; filename="${result.filename}"`);
      }
      return res.send(result.buffer);
    }

    res.json(result);
  } catch (error) {
    next(error);
  }
});

export { router as functionsRouter };
