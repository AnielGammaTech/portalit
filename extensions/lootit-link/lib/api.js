// PortalIT backend communication

const BACKEND_URL = 'https://backend-production-58b4.up.railway.app';
const SUPABASE_URL = 'https://rgsvvywlnnkckvockdoj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJnc3Z2eXdsbm5rY2t2b2NrZG9qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2MzA0OTAsImV4cCI6MjA4ODIwNjQ5MH0.W_PM7gzlvUqCrNW9YQ2NJvR2-6R7TlxiKg1eQlZH1yo';

export async function getPortalToken() {
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

  // First-time login
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

export async function syncToPortalIT(vendor, teamResults, totalCount) {
  const token = await getPortalToken();
  if (!token) throw new Error('PortalIT login required');

  const resp = await fetch(`${BACKEND_URL}/api/functions/lootitLink`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ action: 'sync', vendor, team_results: teamResults, total_count: totalCount }),
  });

  const data = await resp.json();
  if (!resp.ok || !data.success) throw new Error(data.error || 'Sync failed');
  return data;
}

export async function getCustomers() {
  const token = await getPortalToken();
  if (!token) return [];

  const resp = await fetch(`${SUPABASE_URL}/rest/v1/customers?select=id,name&status=eq.active&order=name&limit=500`, {
    headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${token}` },
  });
  if (!resp.ok) return [];
  return resp.json();
}
