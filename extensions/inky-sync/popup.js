const BACKEND_URL = 'https://backend-production-58b4.up.railway.app';
const INKY_API = 'https://app.inkyphishfence.com/api';
const SUPABASE_URL = 'https://rgsvvywlnnkckvockdoj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJnc3Z2eXdsbm5rY2t2b2NrZG9qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2MzA0OTAsImV4cCI6MjA4ODIwNjQ5MH0.W_PM7gzlvUqCrNW9YQ2NJvR2-6R7TlxiKg1eQlZH1yo';
const KEYCLOAK_TOKEN_URL = 'https://auth.dashboard.inky.com/auth/realms/inky/protocol/openid-connect/token';

const statusEl = document.getElementById('status');
const syncBtn = document.getElementById('sync-btn');
const resultsEl = document.getElementById('results');

async function getInkyToken() {
  const data = await chrome.storage.local.get(['inky_bearer_token', 'inky_token_time', 'inky_refresh_token']);
  if (data.inky_bearer_token && data.inky_token_time && (Date.now() - data.inky_token_time < 240000)) {
    return data.inky_bearer_token;
  }
  if (data.inky_refresh_token) {
    try {
      const resp = await fetch(KEYCLOAK_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'refresh_token', client_id: 'inky-dashboard', refresh_token: data.inky_refresh_token }),
      });
      if (resp.ok) {
        const t = await resp.json();
        await chrome.storage.local.set({
          inky_bearer_token: t.access_token,
          inky_token_time: Date.now(),
          inky_refresh_token: t.refresh_token || data.inky_refresh_token,
        });
        return t.access_token;
      }
    } catch {}
  }
  return data.inky_bearer_token || null;
}

async function getPortalToken() {
  const cached = await chrome.storage.local.get(['portalit_token', 'portalit_token_exp', 'portalit_refresh_token']);
  if (cached.portalit_token && cached.portalit_token_exp > Date.now()) return cached.portalit_token;
  if (cached.portalit_refresh_token) {
    try {
      const resp = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY },
        body: JSON.stringify({ refresh_token: cached.portalit_refresh_token }),
      });
      if (resp.ok) {
        const d = await resp.json();
        await chrome.storage.local.set({ portalit_token: d.access_token, portalit_token_exp: Date.now() + (d.expires_in * 1000) - 60000, portalit_refresh_token: d.refresh_token });
        return d.access_token;
      }
    } catch {}
  }
  const email = prompt('PortalIT login (one-time):\nEmail:');
  if (!email) return null;
  const pass = prompt('Password:');
  if (!pass) return null;
  try {
    const resp = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY },
      body: JSON.stringify({ email, password: pass }),
    });
    if (resp.ok) {
      const d = await resp.json();
      await chrome.storage.local.set({ portalit_token: d.access_token, portalit_token_exp: Date.now() + (d.expires_in * 1000) - 60000, portalit_refresh_token: d.refresh_token });
      return d.access_token;
    }
  } catch {}
  return null;
}

// Call INKY API directly from extension (has host_permissions)
async function inkyGet(endpoint, token, body) {
  const opts = {
    method: body ? 'POST' : 'GET',
    headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
  };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(`${INKY_API}${endpoint}`, opts);
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
}

// Get per-team user count by trying multiple INKY API patterns
async function getTeamCount(teamSlug, token) {
  const now = Math.floor(Date.now() / 1000);
  const from = String(now - 30 * 86400);
  const to = String(now);
  const dateFilter = {
    dashboardFilters: [
      { type: 'date', name: 'processed_date', format: 'STANDARD', value: { from, to }, not: false },
      { name: 'outbound', type: 'boolean_exists', value: false, not: false },
    ],
    setFilters: [],
    dashboardFilterMode: 'AND',
    setFilterMode: 'AND',
  };

  // Try 1: team_id in dashboardFilters
  try {
    const body = { ...dateFilter, dashboardFilters: [...dateFilter.dashboardFilters, { type: 'term', name: 'team_id', value: teamSlug, not: false }] };
    const r = await inkyGet('/dashboard/messages/aggregations/cardinality/email?direction=both', token, body);
    if (r.count > 0) return r.count;
  } catch {}

  // Try 2: team in setFilters
  try {
    const body = { ...dateFilter, setFilters: [{ type: 'term', name: 'team_id', value: teamSlug, not: false }] };
    const r = await inkyGet('/dashboard/messages/aggregations/cardinality/email?direction=both', token, body);
    if (r.count > 0) return r.count;
  } catch {}

  // Try 3: team query param
  try {
    const r = await inkyGet(`/dashboard/messages/aggregations/cardinality/email?direction=both&team=${teamSlug}`, token, dateFilter);
    if (r.count > 0) return r.count;
  } catch {}

  // Try 4: X-Team header approach
  try {
    const opts = {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'X-Team-Id': teamSlug },
      body: JSON.stringify(dateFilter),
    };
    const r = await fetch(`${INKY_API}/dashboard/messages/aggregations/cardinality/email?direction=both`, opts);
    if (r.ok) { const d = await r.json(); if (d.count > 0) return d.count; }
  } catch {}

  // Try 5: messages count scoped to team (different field names)
  for (const field of ['team', 'team_name', 'teamId', 'team_slug']) {
    try {
      const body = { ...dateFilter, dashboardFilters: [...dateFilter.dashboardFilters, { type: 'term', name: field, value: teamSlug, not: false }] };
      const r = await inkyGet('/dashboard/messages/aggregations/cardinality/email?direction=both', token, body);
      if (r.count > 0) return r.count;
    } catch {}
  }

  return null;
}

async function init() {
  const token = await getInkyToken();
  if (token) {
    statusEl.className = 'status ok';
    statusEl.innerHTML = '<div class="dot"></div><span>INKY session active</span>';
    syncBtn.disabled = false;
  } else {
    const data = await chrome.storage.local.get(['inky_refresh_token']);
    statusEl.className = 'status warn';
    statusEl.innerHTML = data.inky_refresh_token
      ? '<div class="dot"></div><span>Refresh failed — browse INKY once</span>'
      : '<div class="dot"></div><span>Browse INKY portal once to capture session</span>';
  }
}
init();

syncBtn.addEventListener('click', async () => {
  syncBtn.disabled = true;
  syncBtn.textContent = 'Syncing...';
  resultsEl.style.display = 'none';

  try {
    const inkyToken = await getInkyToken();
    if (!inkyToken) { statusEl.className = 'status err'; statusEl.innerHTML = '<div class="dot"></div><span>No INKY token</span>'; return; }

    statusEl.innerHTML = '<div class="dot"></div><span>Getting teams from INKY...</span>';

    // 1. Get teams from INKY directly
    const perms = await inkyGet('/dashboard/users/permissions', inkyToken);
    let teams = [];
    for (const [id, info] of Object.entries(perms)) {
      if ((info.child_teamids || []).length > 0 && info.type !== 'k1_role') {
        teams = info.child_teamids.filter(t => !t.startsWith('$') && t !== id);
        break;
      }
    }
    if (teams.length === 0) teams = Object.keys(perms).filter(t => !t.startsWith('$'));

    // 2. Get total
    const now = Math.floor(Date.now() / 1000);
    const totalBody = {
      dashboardFilters: [
        { type: 'date', name: 'processed_date', format: 'STANDARD', value: { from: String(now - 30 * 86400), to: String(now) }, not: false },
        { name: 'outbound', type: 'boolean_exists', value: false, not: false },
      ],
      setFilters: [], dashboardFilterMode: 'AND', setFilterMode: 'AND',
    };
    const totalR = await inkyGet('/dashboard/messages/aggregations/cardinality/email?direction=both', inkyToken, totalBody);
    const totalUsers = totalR.count || 0;

    // 3. Try per-team counts
    statusEl.innerHTML = `<div class="dot"></div><span>Checking ${teams.length} teams...</span>`;
    const teamResults = [];
    for (const slug of teams) {
      const name = slug.replace(/-id-\d+$/, '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      const count = await getTeamCount(slug, inkyToken);
      teamResults.push({ slug, name, count });
    }

    // 4. Send to PortalIT backend to save
    statusEl.innerHTML = '<div class="dot"></div><span>Saving to PortalIT...</span>';
    const portalToken = await getPortalToken();
    if (!portalToken) { statusEl.className = 'status err'; statusEl.innerHTML = '<div class="dot"></div><span>PortalIT login failed</span>'; return; }

    const resp = await fetch(`${BACKEND_URL}/api/functions/syncInky`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${portalToken}` },
      body: JSON.stringify({ action: 'save_team_counts', bearer_token: inkyToken, team_results: teamResults, total_users: totalUsers }),
    });
    const data = await resp.json();

    if (data.success) {
      statusEl.className = 'status ok';
      statusEl.innerHTML = `<div class="dot"></div><span>Synced ${data.synced} customers</span>`;

      let html = `
        <div class="row"><span class="label">Total INKY Users</span><span class="value">${totalUsers}</span></div>
        <div class="row"><span class="label">Matched & Synced</span><span class="value green">${data.synced}</span></div>
        <div class="row"><span class="label">Unmatched</span><span class="value ${data.unmatched > 0 ? 'amber' : ''}">${data.unmatched}</span></div>
      `;
      if (data.results?.length > 0) {
        html += '<div class="team-list">';
        for (const r of data.results) {
          const ct = r.userCount != null ? `${r.userCount} users` : '? users';
          html += r.customer
            ? `<div class="team"><span class="name">${r.customer.name}</span><span class="count">${ct}</span></div>`
            : `<div class="team"><span class="name">${r.teamName}</span><span class="unmatched">unmatched</span></div>`;
        }
        html += '</div>';
      }
      resultsEl.innerHTML = html;
      resultsEl.style.display = 'block';
    } else {
      statusEl.className = 'status err';
      statusEl.innerHTML = `<div class="dot"></div><span>${data.error}</span>`;
    }
  } catch (err) {
    statusEl.className = 'status err';
    statusEl.innerHTML = `<div class="dot"></div><span>${err.message}</span>`;
  } finally {
    syncBtn.disabled = false;
    syncBtn.textContent = 'Sync User Counts';
  }
});
