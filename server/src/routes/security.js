import { Router } from 'express';
import { requireAdmin } from '../middleware/auth.js';
import { getServiceSupabase } from '../lib/supabase.js';

const router = Router();

router.get('/audit', requireAdmin, async (req, res, next) => {
  try {
    const supabase = getServiceSupabase();
    const results = { checks: [], passed: 0, failed: 0, warnings: 0 };

    // 1. Check for overpermissive RLS policies
    const { data: permissive } = await supabase.rpc('run_security_check_permissive_policies');
    const permissiveCount = permissive?.[0]?.count || 0;
    results.checks.push({
      id: 'rls-permissive',
      name: 'No overpermissive RLS policies',
      description: 'All tables should use admin-only policies, not "Authenticated users can manage"',
      status: permissiveCount === 0 ? 'pass' : 'fail',
      detail: permissiveCount === 0 ? 'Zero overpermissive policies found' : `${permissiveCount} tables still have overpermissive policies`,
    });

    // 2. Check all tables have RLS enabled
    const { data: noRls } = await supabase.rpc('run_security_check_rls_enabled');
    const noRlsCount = noRls?.[0]?.count || 0;
    results.checks.push({
      id: 'rls-enabled',
      name: 'RLS enabled on all tables',
      description: 'Every public table must have row-level security enabled',
      status: noRlsCount === 0 ? 'pass' : 'fail',
      detail: noRlsCount === 0 ? 'All tables have RLS enabled' : `${noRlsCount} tables have RLS disabled`,
    });

    // 3. Check billing_anomalies status constraint includes 'acknowledged'
    const { data: constraint } = await supabase.rpc('run_security_check_anomaly_constraint');
    const hasAcknowledged = constraint?.[0]?.has_acknowledged || false;
    results.checks.push({
      id: 'anomaly-constraint',
      name: 'Billing anomaly status constraint',
      description: 'Status check constraint should include "acknowledged"',
      status: hasAcknowledged ? 'pass' : 'warn',
      detail: hasAcknowledged ? 'Constraint includes acknowledged' : 'Missing "acknowledged" in status constraint',
    });

    // 4. Check sensitive tables have policies
    const sensitiveTables = ['settings', 'portal_settings', 'cron_job_runs', 'sync_logs', 'billing_anomalies'];
    const { data: policies } = await supabase.rpc('run_security_check_sensitive_policies', { table_list: sensitiveTables });
    const unprotected = policies?.filter(p => !p.has_policy) || [];
    results.checks.push({
      id: 'sensitive-policies',
      name: 'Sensitive tables have RLS policies',
      description: 'Settings, cron logs, sync logs, and billing tables must be admin-only',
      status: unprotected.length === 0 ? 'pass' : 'fail',
      detail: unprotected.length === 0 ? 'All sensitive tables protected' : `${unprotected.map(u => u.tablename).join(', ')} missing policies`,
    });

    // 5. Check uploads bucket is private
    const { data: buckets } = await supabase.storage.listBuckets();
    const uploadBucket = (buckets || []).find(b => b.id === 'uploads');
    results.checks.push({
      id: 'storage-private',
      name: 'Upload storage bucket is private',
      description: 'Uploaded files should not be publicly accessible without auth',
      status: uploadBucket && !uploadBucket.public ? 'pass' : 'warn',
      detail: uploadBucket ? (uploadBucket.public ? 'Bucket is PUBLIC — consider making it private' : 'Bucket is private') : 'Bucket not found',
    });

    // Count results
    for (const check of results.checks) {
      if (check.status === 'pass') results.passed++;
      else if (check.status === 'fail') results.failed++;
      else results.warnings++;
    }

    results.timestamp = new Date().toISOString();
    results.score = results.checks.length > 0
      ? Math.round((results.passed / results.checks.length) * 100)
      : 0;

    res.json(results);
  } catch (error) {
    // If RPC functions don't exist, fall back to basic check
    res.json({
      checks: [{
        id: 'rpc-missing',
        name: 'Security audit functions',
        description: 'Database functions for security checks need to be created',
        status: 'warn',
        detail: `Run the security audit SQL setup first: ${error.message}`,
      }],
      passed: 0, failed: 0, warnings: 1,
      score: 0,
      timestamp: new Date().toISOString(),
    });
  }
});

export { router as securityRouter };
