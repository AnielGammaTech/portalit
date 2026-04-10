import { getServiceSupabase } from '../lib/supabase.js';

const INKY_API = 'https://app.inkyphishfence.com/api';

async function inkyFetch(endpoint, { method = 'GET', body, token } = {}) {
  const response = await fetch(`${INKY_API}${endpoint}`, {
    method,
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`INKY API ${response.status}: ${text.slice(0, 200)}`);
  }
  return response.json();
}

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

/**
 * Try multiple approaches to get per-team user count.
 */
async function getTeamUserCount(teamSlug, dateFilter, token) {
  // Approach 1: team_id filter in POST body
  try {
    const body = {
      ...dateFilter,
      dashboardFilters: [
        ...dateFilter.dashboardFilters,
        { type: 'term', name: 'team_id', value: teamSlug, not: false },
      ],
    };
    const r = await inkyFetch('/dashboard/messages/aggregations/cardinality/email?direction=both', { method: 'POST', body, token });
    if (typeof r.count === 'number' && r.count > 0) return r.count;
  } catch {}

  // Approach 2: team slug in URL path (INKY dashboard pattern)
  try {
    const r = await inkyFetch(`/dashboard/${teamSlug}/messages/aggregations/cardinality/email?direction=both`, { method: 'POST', body: dateFilter, token });
    if (typeof r.count === 'number' && r.count > 0) return r.count;
  } catch {}

  // Approach 3: setFilters instead of dashboardFilters
  try {
    const body = {
      ...dateFilter,
      setFilters: [{ type: 'term', name: 'team_id', value: teamSlug, not: false }],
    };
    const r = await inkyFetch('/dashboard/messages/aggregations/cardinality/email?direction=both', { method: 'POST', body, token });
    if (typeof r.count === 'number' && r.count > 0) return r.count;
  } catch {}

  // Approach 4: GraphQL team query
  try {
    const gql = {
      query: `query TeamStats($teamId: ID!) { team(teamId: $teamId) { teamId userCount activeUsers } }`,
      variables: { teamId: teamSlug },
    };
    const r = await inkyFetch('/graphql', { method: 'POST', body: gql, token });
    const count = r.data?.team?.userCount ?? r.data?.team?.activeUsers;
    if (typeof count === 'number') return count;
  } catch {}

  return null;
}

export async function syncInky(params) {
  const { action, bearer_token } = params;
  const supabase = getServiceSupabase();

  if (!bearer_token) {
    return { success: false, error: 'Bearer token required.' };
  }

  if (action === 'test_connection') {
    try {
      const perms = await inkyFetch('/dashboard/users/permissions', { token: bearer_token });
      return { success: true, message: `Connected! Found ${Object.keys(perms).length} team entries.` };
    } catch (err) {
      return { success: false, error: `Connection failed: ${err.message}` };
    }
  }

  if (action === 'sync_users') {
    try {
      // 1. Get team structure
      const perms = await inkyFetch('/dashboard/users/permissions', { token: bearer_token });
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

      // 2. Total user count
      const dateFilter = buildDateFilter();
      const totalResult = await inkyFetch(
        '/dashboard/messages/aggregations/cardinality/email?direction=both',
        { method: 'POST', body: dateFilter, token: bearer_token }
      );

      // 3. Get customers for matching
      const { data: customers } = await supabase.from('customers').select('id, name').eq('status', 'active');

      // 4. Per-team counts
      const results = [];
      const debugApproaches = {};

      for (const teamSlug of customerTeams) {
        const teamName = teamSlug.replace(/-id-\d+$/, '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        const userCount = await getTeamUserCount(teamSlug, dateFilter, bearer_token);

        // Name matching
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

        results.push({
          teamSlug, teamName, userCount,
          customer: matchedCustomer ? { id: matchedCustomer.id, name: matchedCustomer.name } : null,
        });

        // Save if matched with count
        if (matchedCustomer && userCount != null) {
          const { data: existing } = await supabase
            .from('inky_reports').select('id').eq('customer_id', matchedCustomer.id).limit(1);

          const reportData = { total_users: userCount };
          if (existing && existing.length > 0) {
            await supabase.from('inky_reports').update({
              total_users: userCount, report_data: reportData,
              report_date: new Date().toISOString().split('T')[0],
              updated_date: new Date().toISOString(),
            }).eq('id', existing[0].id);
          } else {
            await supabase.from('inky_reports').insert({
              customer_id: matchedCustomer.id, customer_name: matchedCustomer.name,
              total_users: userCount, report_data: reportData,
              report_type: 'user_count', report_date: new Date().toISOString().split('T')[0],
            });
          }
        }
      }

      const synced = results.filter(r => r.customer && r.userCount != null).length;
      const unmatched = results.filter(r => !r.customer).length;
      const noCount = results.filter(r => r.userCount == null).length;

      return {
        success: true,
        totalUsers: totalResult.count ?? null,
        synced, unmatched, noCount,
        total: results.length,
        results,
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // Extension sends pre-fetched team results — just match to customers and save
  if (action === 'save_team_counts') {
    const { team_results, total_users } = params;
    if (!team_results || !Array.isArray(team_results)) {
      return { success: false, error: 'team_results array required' };
    }

    try {
      const { data: customers } = await supabase.from('customers').select('id, name').eq('status', 'active');
      const normalize = (s) => (s || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();

      const results = [];
      for (const team of team_results) {
        const teamNorm = normalize(team.name);
        let matched = null;

        // Exact / contains match
        for (const c of (customers || [])) {
          const cn = normalize(c.name);
          if (cn === teamNorm || cn.includes(teamNorm) || teamNorm.includes(cn)) {
            matched = c;
            break;
          }
        }
        // Word overlap
        if (!matched) {
          const tw = teamNorm.split(/\s+/).filter(w => w.length > 2);
          let best = 0;
          for (const c of (customers || [])) {
            const cw = normalize(c.name).split(/\s+/).filter(w => w.length > 2);
            const overlap = tw.filter(t => cw.some(w => w.includes(t) || t.includes(w))).length;
            const score = tw.length > 0 ? overlap / tw.length : 0;
            if (score > best && score >= 0.5) { best = score; matched = c; }
          }
        }

        const userCount = team.count;
        results.push({
          teamSlug: team.slug,
          teamName: team.name,
          userCount,
          customer: matched ? { id: matched.id, name: matched.name } : null,
        });

        // Save — even without count, save with total_users=null so the mapping exists
        if (matched) {
          const { data: existing } = await supabase
            .from('inky_reports').select('id').eq('customer_id', matched.id).limit(1);

          const reportData = { total_users: userCount ?? null, synced_from: 'extension' };
          if (existing && existing.length > 0) {
            await supabase.from('inky_reports').update({
              total_users: userCount ?? existing[0].total_users ?? null,
              report_data: reportData,
              report_date: new Date().toISOString().split('T')[0],
              updated_date: new Date().toISOString(),
            }).eq('id', existing[0].id);
          } else {
            await supabase.from('inky_reports').insert({
              customer_id: matched.id, customer_name: matched.name,
              total_users: userCount ?? null, report_data: reportData,
              report_type: 'user_count', report_date: new Date().toISOString().split('T')[0],
            });
          }
        }
      }

      const synced = results.filter(r => r.customer).length;
      const unmatched = results.filter(r => !r.customer).length;
      return { success: true, synced, unmatched, total: results.length, results };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  return { success: false, error: `Unknown action: ${action}` };
}
