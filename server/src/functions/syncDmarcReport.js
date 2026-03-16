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

/**
 * Extract domains array from DMARC API response (handles multiple formats).
 */
function extractDomains(data) {
  if (Array.isArray(data)) return data;
  if (data?.domains && Array.isArray(data.domains)) return data.domains;
  if (data?.data && Array.isArray(data.data)) return data.data;
  return [];
}

/**
 * Fetch domains for a DMARC account — tries multiple endpoint formats.
 */
async function fetchDomainsForAccount(accountId, headers) {
  // Try endpoints in order of likelihood
  const endpoints = [
    `/accounts/${accountId}/domains`,
    `/accounts/${accountId}/domains.json`,
  ];

  for (const endpoint of endpoints) {
    try {
      const res = await fetch(`${DMARC_API_BASE}${endpoint}`, { headers });
      if (res.ok) {
        const data = await res.json();
        const domains = extractDomains(data);
        if (domains.length > 0) return domains;
      }
    } catch {
      // try next endpoint
    }
  }

  return [];
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

  // ── List accounts with domains (for admin mapping UI) ────────────────
  if (action === 'list_accounts') {
    try {
      const res = await fetch(`${DMARC_API_BASE}/accounts`, { headers });
      if (!res.ok) {
        const errText = await res.text();
        return { success: false, error: `Failed to fetch accounts: ${res.status} — ${errText}` };
      }
      const data = await res.json();
      const owned = (data.owned_accounts || []).map(a => ({ ...a, ownership: 'owned' }));
      const shared = (data.accounts || []).filter(a => !owned.find(o => o.id === a.id)).map(a => ({ ...a, ownership: 'shared' }));
      const accounts = [...owned, ...shared];

      // For each account, fetch domains
      const accountsWithDomains = await Promise.all(
        accounts.map(async (account) => {
          const domains = await fetchDomainsForAccount(account.id, headers);
          return {
            ...account,
            domains: domains.map(d => ({
              id: d.id,
              address: d.address || d.name || d.domain,
              slug: d.slug || '',
              dmarc_status: d.dmarc_status || d.status || 'unknown',
            })),
            domainCount: domains.length,
          };
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
      return { success: false, error: 'Customer not mapped to DMARC Report domain' };
    }

    const mapping = mappings[0];
    return {
      success: true,
      cached: true,
      last_synced: mapping.last_synced,
      data: mapping.cached_data || null,
    };
  }

  // ── Sync customer (domain-level) ───────────────────────────────────
  if (action === 'sync_customer') {
    if (!customer_id) return { success: false, error: 'customer_id required' };

    const { data: mappings } = await supabase
      .from('dmarc_report_mappings')
      .select('*')
      .eq('customer_id', customer_id);

    if (!mappings?.length) {
      return { success: false, error: 'Customer not mapped to DMARC Report domain' };
    }

    const mapping = mappings[0];
    const accountId = mapping.dmarc_account_id;
    const domainId = mapping.dmarc_domain_id;

    // Fetch domains for this account
    const allDomains = await fetchDomainsForAccount(accountId, headers);

    // Filter to the specific mapped domain(s), or use all if no domain specified
    const domains = domainId
      ? allDomains.filter(d => String(d.id) === String(domainId))
      : allDomains;

    // Fetch aggregate report stats for each domain (last 30 days)
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const startDate = thirtyDaysAgo.toISOString().split('T')[0];
    const endDate = now.toISOString().split('T')[0];

    const domainStats = await Promise.all(
      domains.map(async (domain) => {
        const domId = domain.id;
        const base = `${DMARC_API_BASE}/accounts/${accountId}/domains/${domId}`;

        // Fetch aggregate stats
        let stats = null;
        try {
          const statsRes = await fetch(`${base}/agg_reports/agg_report_stats?q[start_date]=${startDate}&q[end_date]=${endDate}`, { headers });
          if (statsRes.ok) stats = await statsRes.json();
        } catch { /* ignore */ }

        // Fetch top senders / source breakdown
        let topSources = [];
        try {
          const srcRes = await fetch(`${base}/agg_reports/agg_report_sources?q[start_date]=${startDate}&q[end_date]=${endDate}`, { headers });
          if (srcRes.ok) {
            const srcData = await srcRes.json();
            const sources = Array.isArray(srcData) ? srcData : (srcData?.sources || srcData?.data || []);
            topSources = sources.slice(0, 10).map(s => ({
              source_ip: s.source_ip || s.ip || '',
              org: s.org || s.organization || s.source_name || '',
              hostname: s.hostname || s.reverse_dns || '',
              count: s.count || s.total || 0,
              spf_pass: s.spf_pass || s.spf_aligned || 0,
              dkim_pass: s.dkim_pass || s.dkim_aligned || 0,
              compliant: s.compliant || 0,
              non_compliant: s.non_compliant || 0,
            }));
          }
        } catch { /* ignore */ }

        // Fetch domain detail (SPF, DKIM, DMARC records)
        let dnsRecords = {};
        try {
          const detailRes = await fetch(`${base}`, { headers });
          if (detailRes.ok) {
            const detail = await detailRes.json();
            const d = detail?.domain || detail || {};
            dnsRecords = {
              spf_record: d.spf_record || d.spf || null,
              spf_status: d.spf_status || d.spf_valid || null,
              dkim_record: d.dkim_record || d.dkim || null,
              dkim_status: d.dkim_status || d.dkim_valid || null,
              dmarc_record: d.dmarc_record || d.dmarc || null,
              dmarc_policy: d.dmarc_policy || d.policy || null,
              bimi_record: d.bimi_record || d.bimi || null,
              mx_records: d.mx_records || d.mx || null,
            };
          }
        } catch { /* ignore */ }

        return {
          id: domId,
          address: domain.address || domain.name || domain.domain,
          slug: domain.slug || '',
          dmarc_status: domain.dmarc_status || domain.status || 'unknown',
          mta_sts_status: domain.mta_sts_status || null,
          rua_report: domain.rua_report ?? null,
          ruf_report: domain.ruf_report ?? null,
          parked_domain: domain.parked_domain || false,
          tags: domain.tags || [],
          dns: dnsRecords,
          top_sources: topSources,
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
