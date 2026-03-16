import { getServiceSupabase } from '../lib/supabase.js';

const DMARC_API_BASE = 'https://api.dmarcreport.com/v2';

function getApiToken() {
  return process.env.DMARC_REPORT_API_TOKEN;
}

function authHeaders(token) {
  return {
    'Authorization': `Token token=${token}`,
    'Content-Type': 'application/json',
  };
}

export async function syncDmarcReport(body, user) {
  const supabase = getServiceSupabase();
  const { action, customer_id } = body;

  const token = getApiToken();
  if (!token && action !== 'get_cached') {
    return { success: false, error: 'DMARC Report API token not configured. Set DMARC_REPORT_API_TOKEN in environment.' };
  }

  const headers = authHeaders(token);

  // ── Test connection ──────────────────────────────────────────────────
  if (action === 'test_connection') {
    try {
      const res = await fetch(`${DMARC_API_BASE}/accounts`, { headers });
      if (!res.ok) {
        return { success: false, error: `API returned ${res.status}: ${res.statusText}` };
      }
      const data = await res.json();
      const accounts = [...(data.owned_accounts || []), ...(data.accounts || [])];
      return {
        success: true,
        message: `Connected — ${accounts.length} account(s) found`,
        accountCount: accounts.length,
      };
    } catch (error) {
      return { success: false, error: error.message || 'Failed to connect to DMARC Report API' };
    }
  }

  // ── List accounts (for admin mapping UI) ─────────────────────────────
  if (action === 'list_accounts') {
    try {
      const res = await fetch(`${DMARC_API_BASE}/accounts`, { headers });
      if (!res.ok) {
        return { success: false, error: `Failed to fetch accounts: ${res.status}` };
      }
      const data = await res.json();
      const owned = (data.owned_accounts || []).map(a => ({ ...a, ownership: 'owned' }));
      const shared = (data.accounts || []).filter(a => !owned.find(o => o.id === a.id)).map(a => ({ ...a, ownership: 'shared' }));
      const accounts = [...owned, ...shared];

      // For each account, fetch domains
      const accountsWithDomains = await Promise.all(
        accounts.map(async (account) => {
          try {
            const domRes = await fetch(`${DMARC_API_BASE}/accounts/${account.id}/domains.json`, { headers });
            if (domRes.ok) {
              const domains = await domRes.json();
              return { ...account, domains: Array.isArray(domains) ? domains : [], domainCount: Array.isArray(domains) ? domains.length : 0 };
            }
          } catch { /* ignore */ }
          return { ...account, domains: [], domainCount: 0 };
        })
      );

      return { success: true, accounts: accountsWithDomains };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ── Get cached data ──────────────────────────────────────────────────
  if (action === 'get_cached') {
    if (!customer_id) return { success: false, error: 'customer_id required' };

    const { data: mappings } = await supabase
      .from('dmarc_report_mappings')
      .select('*')
      .eq('customer_id', customer_id);

    if (!mappings?.length) {
      return { success: false, error: 'Customer not mapped to DMARC Report account' };
    }

    const mapping = mappings[0];
    return {
      success: true,
      cached: true,
      last_synced: mapping.last_synced,
      data: mapping.cached_data || null,
    };
  }

  // ── Sync customer ────────────────────────────────────────────────────
  if (action === 'sync_customer') {
    if (!customer_id) return { success: false, error: 'customer_id required' };

    const { data: mappings } = await supabase
      .from('dmarc_report_mappings')
      .select('*')
      .eq('customer_id', customer_id);

    if (!mappings?.length) {
      return { success: false, error: 'Customer not mapped to DMARC Report account' };
    }

    const mapping = mappings[0];
    const accountId = mapping.dmarc_account_id;

    // Fetch domains for this account
    let domains = [];
    try {
      const domRes = await fetch(`${DMARC_API_BASE}/accounts/${accountId}/domains.json`, { headers });
      if (domRes.ok) {
        const domData = await domRes.json();
        domains = Array.isArray(domData) ? domData : [];
      }
    } catch (e) {
      console.error('Failed to fetch DMARC domains:', e.message);
    }

    // Fetch aggregate report stats for each domain (last 30 days)
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const startDate = thirtyDaysAgo.toISOString().split('T')[0];
    const endDate = now.toISOString().split('T')[0];

    const domainStats = await Promise.all(
      domains.map(async (domain) => {
        let stats = null;
        try {
          const statsUrl = `${DMARC_API_BASE}/accounts/${accountId}/domains/${domain.id}/agg_reports/agg_report_stats?q[start_date]=${startDate}&q[end_date]=${endDate}`;
          const statsRes = await fetch(statsUrl, { headers });
          if (statsRes.ok) {
            stats = await statsRes.json();
          }
        } catch { /* ignore */ }

        return {
          id: domain.id,
          address: domain.address,
          slug: domain.slug,
          dmarc_status: domain.dmarc_status,
          mta_sts_status: domain.mta_sts_status,
          rua_report: domain.rua_report,
          ruf_report: domain.ruf_report,
          parked_domain: domain.parked_domain,
          tags: domain.tags || [],
          stats: stats || { compliant: 0, non_compliant: 0, forwarded: 0, total: 0, none: 0, quarantine: 0, reject: 0 },
        };
      })
    );

    // Compute summary stats
    const totalDomains = domainStats.length;
    const activeDomains = domainStats.filter(d => d.dmarc_status === 'dmarc_record_published').length;
    const totalCompliant = domainStats.reduce((s, d) => s + (d.stats?.compliant || 0), 0);
    const totalNonCompliant = domainStats.reduce((s, d) => s + (d.stats?.non_compliant || 0), 0);
    const totalMessages = domainStats.reduce((s, d) => s + (d.stats?.total || 0), 0);
    const totalQuarantined = domainStats.reduce((s, d) => s + (d.stats?.quarantine || 0), 0);
    const totalRejected = domainStats.reduce((s, d) => s + (d.stats?.reject || 0), 0);

    const responseData = {
      totalDomains,
      activeDomains,
      totalMessages,
      totalCompliant,
      totalNonCompliant,
      totalQuarantined,
      totalRejected,
      complianceRate: totalMessages > 0 ? Math.round((totalCompliant / totalMessages) * 100) : 0,
      domains: domainStats,
      period: { start: startDate, end: endDate },
    };

    // Cache the data
    await supabase.from('dmarc_report_mappings').update({
      last_synced: new Date().toISOString(),
      cached_data: responseData,
    }).eq('id', mapping.id);

    return { success: true, data: responseData };
  }

  // ── Sync all ─────────────────────────────────────────────────────────
  if (action === 'sync_all') {
    const { data: allMappings } = await supabase.from('dmarc_report_mappings').select('*');
    const mappings = allMappings || [];
    let synced = 0;
    let failed = 0;

    for (const mapping of mappings) {
      try {
        const result = await syncDmarcReport({ action: 'sync_customer', customer_id: mapping.customer_id }, user);
        if (result.success) {
          synced++;
        } else {
          failed++;
          console.error(`DMARC sync failed for ${mapping.customer_name}:`, result.error);
        }
      } catch (e) {
        failed++;
        console.error(`DMARC sync error for ${mapping.customer_name}:`, e.message);
      }
    }

    return { success: true, synced, failed, total: mappings.length };
  }

  return { success: false, error: 'Invalid action' };
}
