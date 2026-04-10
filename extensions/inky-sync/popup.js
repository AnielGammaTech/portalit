const BACKEND_URL = 'https://backend-production-58b4.up.railway.app';
const SUPABASE_URL = 'https://rgsvvywlnnkckvockdoj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJnc3Z2eXdsbm5rY2t2b2NrZG9qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2MzA0OTAsImV4cCI6MjA4ODIwNjQ5MH0.W_PM7gzlvUqCrNW9YQ2NJvR2-6R7TlxiKg1eQlZH1yo';
const KEYCLOAK_TOKEN_URL = 'https://auth.dashboard.inky.com/auth/realms/inky/protocol/openid-connect/token';

const statusEl = document.getElementById('status');
const syncBtn = document.getElementById('sync-btn');
const resultsEl = document.getElementById('results');

// Get a valid INKY Bearer token — refresh from Keycloak if expired
async function getInkyToken() {
  const data = await new Promise(r => chrome.storage.local.get(
    ['inky_bearer_token', 'inky_token_time', 'inky_token_expires', 'inky_refresh_token'], r
  ));

  // Token still fresh (< 4 min old)
  if (data.inky_bearer_token && data.inky_token_time && (Date.now() - data.inky_token_time < 240000)) {
    return data.inky_bearer_token;
  }

  // Try refreshing via Keycloak
  if (data.inky_refresh_token) {
    try {
      const resp = await fetch(KEYCLOAK_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: 'inky-dashboard',
          refresh_token: data.inky_refresh_token,
        }),
      });
      if (resp.ok) {
        const tokens = await resp.json();
        await new Promise(r => chrome.storage.local.set({
          inky_bearer_token: tokens.access_token,
          inky_token_time: Date.now(),
          inky_token_expires: Date.now() + (tokens.expires_in * 1000),
          inky_refresh_token: tokens.refresh_token || data.inky_refresh_token,
        }, r));
        return tokens.access_token;
      }
    } catch {}
  }

  // Stale token as last resort
  if (data.inky_bearer_token) return data.inky_bearer_token;
  return null;
}

// Get PortalIT auth token
async function getPortalToken() {
  const cached = await new Promise(r => chrome.storage.local.get(['portalit_token', 'portalit_token_exp', 'portalit_refresh_token'], r));
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
        await new Promise(r => chrome.storage.local.set({
          portalit_token: d.access_token,
          portalit_token_exp: Date.now() + (d.expires_in * 1000) - 60000,
          portalit_refresh_token: d.refresh_token,
        }, r));
        return d.access_token;
      }
    } catch {}
  }

  // First time — prompt for credentials
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
      await new Promise(r => chrome.storage.local.set({
        portalit_token: d.access_token,
        portalit_token_exp: Date.now() + (d.expires_in * 1000) - 60000,
        portalit_refresh_token: d.refresh_token,
      }, r));
      return d.access_token;
    }
  } catch {}
  return null;
}

// Init — check token status
async function init() {
  const token = await getInkyToken();
  if (token) {
    statusEl.className = 'status ok';
    statusEl.innerHTML = '<div class="dot"></div><span>INKY session active</span>';
    syncBtn.disabled = false;
  } else {
    const data = await new Promise(r => chrome.storage.local.get(['inky_refresh_token'], r));
    if (data.inky_refresh_token) {
      statusEl.className = 'status warn';
      statusEl.innerHTML = '<div class="dot"></div><span>Token expired — refreshing failed. Browse INKY once.</span>';
    } else {
      statusEl.className = 'status warn';
      statusEl.innerHTML = '<div class="dot"></div><span>Browse INKY portal once to capture session</span>';
    }
  }
}
init();

// Sync
syncBtn.addEventListener('click', async () => {
  syncBtn.disabled = true;
  syncBtn.textContent = 'Syncing...';
  resultsEl.style.display = 'none';

  try {
    const inkyToken = await getInkyToken();
    if (!inkyToken) {
      statusEl.className = 'status err';
      statusEl.innerHTML = '<div class="dot"></div><span>No INKY token — browse INKY portal first</span>';
      return;
    }

    const portalToken = await getPortalToken();
    if (!portalToken) {
      statusEl.className = 'status err';
      statusEl.innerHTML = '<div class="dot"></div><span>PortalIT login cancelled</span>';
      return;
    }

    const response = await fetch(`${BACKEND_URL}/api/functions/syncInky`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${portalToken}` },
      body: JSON.stringify({ action: 'sync_users', bearer_token: inkyToken }),
    });

    const data = await response.json();

    if (data.success) {
      statusEl.className = 'status ok';
      statusEl.innerHTML = `<div class="dot"></div><span>Synced ${data.synced} customers</span>`;

      let html = `
        <div class="row"><span class="label">Total INKY Users</span><span class="value">${data.totalUsers ?? '—'}</span></div>
        <div class="row"><span class="label">Matched & Synced</span><span class="value green">${data.synced}</span></div>
        <div class="row"><span class="label">Unmatched Teams</span><span class="value ${data.unmatched > 0 ? 'amber' : ''}">${data.unmatched}</span></div>
        ${data.noCount > 0 ? `<div class="row"><span class="label">No user count</span><span class="value amber">${data.noCount}</span></div>` : ''}
      `;

      if (data.results?.length > 0) {
        html += '<div class="team-list">';
        for (const r of data.results) {
          const count = r.userCount != null ? `${r.userCount} users` : '? users';
          html += r.customer
            ? `<div class="team"><span class="name">${r.customer.name}</span><span class="count">${count}</span></div>`
            : `<div class="team"><span class="name">${r.teamName}</span><span class="unmatched">unmatched</span></div>`;
        }
        html += '</div>';
      }

      resultsEl.innerHTML = html;
      resultsEl.style.display = 'block';
    } else {
      statusEl.className = 'status err';
      statusEl.innerHTML = `<div class="dot"></div><span>${data.error || 'Sync failed'}</span>`;
    }
  } catch (err) {
    statusEl.className = 'status err';
    statusEl.innerHTML = `<div class="dot"></div><span>${err.message}</span>`;
  } finally {
    syncBtn.disabled = false;
    syncBtn.textContent = 'Sync User Counts';
  }
});
