import { getServiceSupabase } from '../lib/supabase.js';

const INKY_API = 'https://app.inkyphishfence.com/api';

async function inkyFetch(endpoint, { method = 'GET', body, token } = {}) {
  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };

  const response = await fetch(`${INKY_API}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`INKY API ${response.status}: ${text.slice(0, 200)}`);
  }

  return response.json();
}

/**
 * Build date filter for the last 30 days.
 */
function buildDateFilter() {
  const now = Math.floor(Date.now() / 1000);
  const thirtyDaysAgo = now - (30 * 24 * 60 * 60);
  return {
    dashboardFilters: [
      { type: 'date', name: 'processed_date', format: 'STANDARD', value: { from: String(thirtyDaysAgo), to: String(now) }, not: false },
      { name: 'outbound', type: 'boolean_exists', value: false, not: false },
    ],
    setFilters: [],
    dashboardFilterMode: 'AND',
    setFilterMode: 'AND',
  };
}

export async function syncInky(params) {
  const { action, bearer_token } = params;
  const supabase = getServiceSupabase();

  if (!bearer_token) {
    return { success: false, error: 'Bearer token required. Copy it from INKY Network tab → Authorization header.' };
  }

  // Test connection
  if (action === 'test_connection') {
    try {
      const perms = await inkyFetch('/dashboard/users/permissions', { token: bearer_token });
      const teamIds = Object.keys(perms);
      return { success: true, message: `Connected! Found ${teamIds.length} team entries.`, teams: teamIds };
    } catch (err) {
      return { success: false, error: `Connection failed: ${err.message}` };
    }
  }

  // Sync user counts per team
  if (action === 'sync_users') {
    try {
      // 1. Get team list
      const perms = await inkyFetch('/dashboard/users/permissions', { token: bearer_token });

      // Find customer teams from the parent group
      let customerTeams = [];
      for (const [teamId, info] of Object.entries(perms)) {
        if ((info.child_teamids || []).length > 0 && info.type !== 'k1_role') {
          customerTeams = info.child_teamids.filter(t => !t.startsWith('$') && t !== teamId);
          break;
        }
      }
      if (customerTeams.length === 0) {
        customerTeams = Object.keys(perms).filter(t => !t.startsWith('$'));
      }

      console.log(`[INKY] Found ${customerTeams.length} customer teams`);

      // 2. Get total user count
      const dateFilter = buildDateFilter();
      const totalResult = await inkyFetch(
        '/dashboard/messages/aggregations/cardinality/email?direction=both',
        { method: 'POST', body: dateFilter, token: bearer_token }
      );

      // 3. Get customers for name matching
      const { data: customers } = await supabase.from('customers').select('id, name').eq('status', 'active');

      // 4. Per-team user counts
      const results = [];
      for (const teamSlug of customerTeams) {
        const teamName = teamSlug
          .replace(/-id-\d+$/, '')
          .replace(/-/g, ' ')
          .replace(/\b\w/g, c => c.toUpperCase());

        // Try per-team user count
        let userCount = null;
        try {
          const teamFilter = {
            ...dateFilter,
            dashboardFilters: [
              ...dateFilter.dashboardFilters,
              { type: 'term', name: 'team_id', value: teamSlug, not: false },
            ],
          };
          const result = await inkyFetch(
            '/dashboard/messages/aggregations/cardinality/email?direction=both',
            { method: 'POST', body: teamFilter, token: bearer_token }
          );
          userCount = result.count ?? null;
        } catch {
          // Team filter might not work
        }

        // Match to customer by name
        const normalize = (s) => (s || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
        const teamNorm = normalize(teamName);
        let matchedCustomer = null;

        for (const cust of (customers || [])) {
          const cn = normalize(cust.name);
          if (cn === teamNorm || cn.includes(teamNorm) || teamNorm.includes(cn)) {
            matchedCustomer = cust;
            break;
          }
        }
        // Word overlap fallback
        if (!matchedCustomer) {
          const teamWords = teamNorm.split(/\s+/).filter(w => w.length > 2);
          let bestScore = 0;
          for (const cust of (customers || [])) {
            const custWords = normalize(cust.name).split(/\s+/).filter(w => w.length > 2);
            const overlap = teamWords.filter(tw => custWords.some(cw => cw.includes(tw) || tw.includes(cw))).length;
            const score = teamWords.length > 0 ? overlap / teamWords.length : 0;
            if (score > bestScore && score >= 0.5) {
              bestScore = score;
              matchedCustomer = cust;
            }
          }
        }

        results.push({ teamSlug, teamName, userCount, customer: matchedCustomer ? { id: matchedCustomer.id, name: matchedCustomer.name } : null });

        // Save if matched
        if (matchedCustomer && userCount != null) {
          const { data: existing } = await supabase
            .from('inky_reports')
            .select('id')
            .eq('customer_id', matchedCustomer.id)
            .limit(1);

          const reportData = { total_users: userCount };
          if (existing && existing.length > 0) {
            await supabase.from('inky_reports').update({
              total_users: userCount,
              report_data: reportData,
              report_date: new Date().toISOString().split('T')[0],
              updated_date: new Date().toISOString(),
            }).eq('id', existing[0].id);
          } else {
            await supabase.from('inky_reports').insert({
              customer_id: matchedCustomer.id,
              customer_name: matchedCustomer.name,
              total_users: userCount,
              report_data: reportData,
              report_type: 'user_count',
              report_date: new Date().toISOString().split('T')[0],
            });
          }
        }
      }

      const synced = results.filter(r => r.customer && r.userCount != null).length;
      const unmatched = results.filter(r => !r.customer).length;

      return { success: true, totalUsers: totalResult.count ?? null, synced, unmatched, total: results.length, results };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  return { success: false, error: `Unknown action: ${action}` };
}
