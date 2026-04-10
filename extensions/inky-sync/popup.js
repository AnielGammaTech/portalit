const BACKEND_URL = 'https://backend-production-58b4.up.railway.app';
const SUPABASE_URL = 'https://rgsvvywlnnkckvockdoj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJnc3Z2eXdsbm5rY2t2b2NrZG9qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2MzA0OTAsImV4cCI6MjA4ODIwNjQ5MH0.W_PM7gzlvUqCrNW9YQ2NJvR2-6R7TlxiKg1eQlZH1yo';

const statusEl = document.getElementById('status');
const syncBtn = document.getElementById('sync-btn');
const resultsEl = document.getElementById('results');

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

async function init() {
  // Check for scraped team data
  const data = await chrome.storage.local.get(['inky_team_data', 'inky_team_data_time']);
  if (data.inky_team_data && data.inky_team_data.length > 0) {
    const mins = Math.floor((Date.now() - (data.inky_team_data_time || 0)) / 60000);
    const total = data.inky_team_data.reduce((s, t) => s + (t.mailboxes || 0), 0);
    statusEl.className = 'status ok';
    statusEl.innerHTML = `<div class="dot"></div><span>${data.inky_team_data.length} teams, ${total} mailboxes (${mins}m ago)</span>`;
    syncBtn.disabled = false;
  } else {
    statusEl.className = 'status warn';
    statusEl.innerHTML = '<div class="dot"></div><span>Go to INKY Team List page first</span>';

    // Try to trigger scrape on active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.url?.includes('inkyphishfence.com')) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'SCRAPE_TEAMS' }, (response) => {
          if (chrome.runtime.lastError) return;
          if (response?.teams?.length > 0) {
            const total = response.teams.reduce((s, t) => s + (t.mailboxes || 0), 0);
            statusEl.className = 'status ok';
            statusEl.innerHTML = `<div class="dot"></div><span>${response.teams.length} teams, ${total} mailboxes</span>`;
            syncBtn.disabled = false;
          }
        });
      }
    });
  }
}
init();

syncBtn.addEventListener('click', async () => {
  syncBtn.disabled = true;
  syncBtn.textContent = 'Syncing...';
  resultsEl.style.display = 'none';

  try {
    // Get scraped data
    const stored = await chrome.storage.local.get(['inky_team_data']);
    let teams = stored.inky_team_data;

    // Try live scrape if no stored data
    if (!teams || teams.length === 0) {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]?.url?.includes('inkyphishfence.com')) {
        const response = await new Promise(r => chrome.tabs.sendMessage(tabs[0].id, { type: 'SCRAPE_TEAMS' }, r));
        teams = response?.teams;
      }
    }

    if (!teams || teams.length === 0) {
      statusEl.className = 'status err';
      statusEl.innerHTML = '<div class="dot"></div><span>No team data — go to INKY Team List page</span>';
      return;
    }

    const totalMailboxes = teams.reduce((s, t) => s + (t.mailboxes || 0), 0);

    // Build team_results for backend
    const teamResults = teams.map(t => ({
      slug: t.id,
      name: t.label,
      count: t.mailboxes,
    }));

    // Send to PortalIT
    statusEl.innerHTML = '<div class="dot"></div><span>Saving to PortalIT...</span>';
    const portalToken = await getPortalToken();
    if (!portalToken) { statusEl.className = 'status err'; statusEl.innerHTML = '<div class="dot"></div><span>PortalIT login failed</span>'; return; }

    const resp = await fetch(`${BACKEND_URL}/api/functions/syncInky`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${portalToken}` },
      body: JSON.stringify({ action: 'save_team_counts', bearer_token: 'scraped', team_results: teamResults, total_users: totalMailboxes }),
    });
    const data = await resp.json();

    if (data.success) {
      statusEl.className = 'status ok';
      statusEl.innerHTML = `<div class="dot"></div><span>Synced ${data.synced} customers</span>`;

      let html = `
        <div class="row"><span class="label">Total Mailboxes</span><span class="value">${totalMailboxes}</span></div>
        <div class="row"><span class="label">Matched & Synced</span><span class="value green">${data.synced}</span></div>
        ${data.unmatched > 0 ? `<div class="row"><span class="label">Unmatched</span><span class="value amber">${data.unmatched}</span></div>` : ''}
      `;
      html += '<div class="team-list">';
      for (const r of (data.results || [])) {
        const ct = r.userCount != null ? `${r.userCount}` : '?';
        html += r.customer
          ? `<div class="team"><span class="name">${r.customer.name}</span><span class="count">${ct} mailboxes</span></div>`
          : `<div class="team"><span class="name">${r.teamName}</span><span class="unmatched">unmatched</span></div>`;
      }
      html += '</div>';
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
