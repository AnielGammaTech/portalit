import { Router } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

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
import { syncCIPP } from '../functions/syncCIPP.js';
import { syncInky } from '../functions/syncInky.js';
import { syncGraphus } from '../functions/syncGraphus.js';
import { lootitLink } from '../functions/lootitLink.js';
import scanBillingAnomalies from '../functions/scanBillingAnomalies.js';
import { verifyReconciliation } from '../functions/verifyReconciliation.js';
import { expireReconciliationReviews } from '../functions/expireReconciliationReviews.js';
import { getServiceSupabase } from '../lib/supabase.js';

async function securityAudit() {
  const supabase = getServiceSupabase();
  const checks = [];

  // 1. Overpermissive RLS policies
  const { data: permissive } = await supabase.rpc('run_security_check_permissive_policies');
  const permissiveCount = permissive?.[0]?.count || 0;
  checks.push({ id: 'rls-permissive', name: 'No overpermissive RLS policies', status: permissiveCount === 0 ? 'pass' : 'fail', detail: permissiveCount === 0 ? 'Zero overpermissive policies' : `${permissiveCount} tables still vulnerable` });

  // 2. RLS enabled on all tables
  const { data: noRls } = await supabase.rpc('run_security_check_rls_enabled');
  const noRlsCount = noRls?.[0]?.count || 0;
  checks.push({ id: 'rls-enabled', name: 'RLS enabled on all tables', status: noRlsCount === 0 ? 'pass' : 'fail', detail: noRlsCount === 0 ? 'All tables have RLS' : `${noRlsCount} tables missing RLS` });

  // 3. Billing anomaly constraint
  const { data: constraint } = await supabase.rpc('run_security_check_anomaly_constraint');
  const hasAck = constraint?.[0]?.has_acknowledged || false;
  checks.push({ id: 'anomaly-constraint', name: 'Anomaly status constraint', status: hasAck ? 'pass' : 'warn', detail: hasAck ? 'Includes acknowledged' : 'Missing acknowledged status' });

  // 4. Sensitive tables have policies
  const sensitiveTables = ['settings', 'portal_settings', 'cron_job_runs', 'sync_logs', 'billing_anomalies'];
  const { data: policies } = await supabase.rpc('run_security_check_sensitive_policies', { table_list: sensitiveTables });
  const unprotected = (policies || []).filter(p => !p.has_policy);
  checks.push({ id: 'sensitive-policies', name: 'Sensitive tables protected', status: unprotected.length === 0 ? 'pass' : 'fail', detail: unprotected.length === 0 ? 'All protected' : `${unprotected.map(u => u.tablename).join(', ')} unprotected` });

  // 5. Upload bucket privacy
  const { data: buckets } = await supabase.storage.listBuckets();
  const uploadBucket = (buckets || []).find(b => b.id === 'uploads');
  checks.push({ id: 'storage-private', name: 'Upload bucket is private', status: uploadBucket && !uploadBucket.public ? 'pass' : 'warn', detail: uploadBucket ? (uploadBucket.public ? 'Bucket is PUBLIC' : 'Bucket is private') : 'Not found' });

  const passed = checks.filter(c => c.status === 'pass').length;
  const failed = checks.filter(c => c.status === 'fail').length;
  const warnings = checks.filter(c => c.status === 'warn').length;

  return { checks, passed, failed, warnings, score: Math.round((passed / checks.length) * 100), timestamp: new Date().toISOString() };
}

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
  syncCIPP,
  syncInky,
  syncGraphus,
  lootitLink,
  scanBillingAnomalies,
  verifyReconciliation,
  expireReconciliationReviews,
  securityAudit,
};

const router = Router();

router.post('/:functionName', requireAdmin, async (req, res, next) => {
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
        const safeName = (result.filename || 'download').replace(/["\r\n\\]/g, '').slice(0, 255);
        res.set('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(safeName)}`);
      }
      return res.send(result.buffer);
    }

    res.json(result);
  } catch (error) {
    next(error);
  }
});

export { router as functionsRouter };
