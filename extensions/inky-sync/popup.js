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
        await chrome.storage.local.set({ inky_bearer_token: t.access_token, inky_token_time: Date.now(), inky_refresh_token: t.refresh_token || data.inky_refresh_token });
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

async function inkyGet(endpoint, token, body) {
  const opts = { method: body ? 'POST' : 'GET', headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` } };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(`${INKY_API}${endpoint}`, opts);
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
}

async function init() {
  const token = await getInkyToken();
  if (token) {
    statusEl.className = 'status ok';
    statusEl.innerHTML = '<div class="dot"></div><span>INKY session active</span>';
    syncBtn.disabled = false;
  } else {
    statusEl.className = 'status warn';
    statusEl.innerHTML = '<div class="dot"></div><span>Browse INKY portal once to capture session</span>';
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

    // 1. Get teams
    const perms = await inkyGet('/dashboard/users/permissions', inkyToken);
    let teams = [];
    for (const [id, info] of Object.entries(perms)) {
      if ((info.child_teamids || []).length > 0 && info.type !== 'k1_role') {
        teams = info.child_teamids.filter(t => !t.startsWith('$') && t !== id);
        break;
      }
    }
    if (teams.length === 0) teams = Object.keys(perms).filter(t => !t.startsWith('$'));

    // 2. Total user count
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

    // 3. Build team list (no per-team counts — INKY API doesn't support it)
    const teamResults = teams.map(slug => ({
      slug,
      name: slug.replace(/-id-\d+$/, '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      count: null,
    }));

    // 4. Save mappings to PortalIT
    statusEl.innerHTML = '<div class="dot"></div><span>Saving mappings to PortalIT...</span>';
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
      statusEl.innerHTML = `<div class="dot"></div><span>Mapped ${data.synced} customers</span>`;

      let html = `
        <div class="row"><span class="label">Total INKY Users</span><span class="value">${totalUsers}</span></div>
        <div class="row"><span class="label">Mapped to Customers</span><span class="value green">${data.synced}</span></div>
        ${data.unmatched > 0 ? `<div class="row"><span class="label">Unmatched Teams</span><span class="value amber">${data.unmatched}</span></div>` : ''}
      `;

      html += '<div class="team-list">';
      for (const r of (data.results || [])) {
        html += r.customer
          ? `<div class="team"><span class="name">${r.customer.name}</span><span class="count">mapped</span></div>`
          : `<div class="team"><span class="name">${r.teamName}</span><span class="unmatched">unmatched</span></div>`;
      }
      html += '</div>';
      html += '<div style="margin-top:8px;padding:8px;background:#fffbeb;border:1px solid #fde68a;border-radius:6px;font-size:10px;color:#92400e;">INKY API doesn\'t expose per-team user counts. Go to PortalIT Integrations → INKY to enter counts per customer.</div>';

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
