import { VENDORS, detectVendor } from './lib/vendors.js';
import { matchCustomer } from './lib/matching.js';
import { syncToPortalIT, getCustomers } from './lib/api.js';

const statusEl = document.getElementById('status');
const contentEl = document.getElementById('content');
const vendorBadge = document.getElementById('vendor-badge');
const vDot = document.getElementById('v-dot');
const vName = document.getElementById('v-name');
const vHint = document.getElementById('v-hint');

let currentVendor = null;
let vendorData = null;
let customers = [];
let savedMappings = {};

async function init() {
  // Load saved mappings
  const stored = await chrome.storage.local.get(['lootit_mappings']);
  savedMappings = stored.lootit_mappings || {};

  // Detect vendor from active tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.url) {
    currentVendor = detectVendor(tab.url);
  }

  if (currentVendor) {
    // Show vendor badge
    vendorBadge.style.display = 'flex';
    vDot.className = 'vendor-dot active';
    vName.textContent = currentVendor.label;

    // Check for scraped data
    const stored = await chrome.storage.local.get(['lootit_vendor_data']);
    const data = stored.lootit_vendor_data;
    if (data && data.vendor === currentVendor.key && data.teams?.length > 0) {
      vendorData = data;
      const age = Math.floor((Date.now() - data.time) / 60000);
      vHint.textContent = `${data.teams.length} entries (${age}m ago)`;
      setStatus('ok', `${data.teams.length} ${currentVendor.dataLabel || 'entries'} found`);
      await showSyncView();
    } else {
      // Try live scrape
      vHint.textContent = 'Scanning...';
      try {
        const response = await chrome.tabs.sendMessage(tab.id, { type: 'SCRAPE' });
        if (response?.teams?.length > 0) {
          vendorData = { vendor: currentVendor.key, teams: response.teams, time: Date.now() };
          vHint.textContent = `${response.teams.length} entries`;
          setStatus('ok', `${response.teams.length} ${currentVendor.dataLabel || 'entries'} found`);
          await showSyncView();
        } else {
          vHint.textContent = 'No data on this page';
          setStatus('warn', `Navigate to the ${currentVendor.label} page with customer/team data`);
          showEmptyState();
        }
      } catch {
        vHint.textContent = 'Refresh page';
        setStatus('warn', 'Refresh the page and try again');
        showEmptyState();
      }
    }
  } else {
    showNoVendor();
  }
}

function setStatus(type, text) {
  statusEl.className = `status ${type}`;
  statusEl.innerHTML = `<div class="dot"></div><span>${text}</span>`;
}

function showNoVendor() {
  vendorBadge.style.display = 'none';
  let html = `<div class="no-vendor">
    <div class="big">L</div>
    <p>Navigate to a supported vendor portal</p>
    <div class="supported">
      <h4>Supported Vendors</h4>`;

  for (const v of Object.values(VENDORS)) {
    html += `<div class="vendor-row"><div class="vdot" style="background:${v.color}"></div>${v.label}</div>`;
  }

  html += `</div></div>`;
  contentEl.innerHTML = html;
  setStatus('warn', 'Not on a vendor portal');
}

function showEmptyState() {
  contentEl.innerHTML = `<p style="font-size:11px;color:#94a3b8;text-align:center;padding:16px 0;">
    Go to the page that lists customers/teams with ${currentVendor.dataLabel || 'counts'}, then click here again.
  </p>`;
}

async function showSyncView() {
  // Fetch PortalIT customers for matching
  if (customers.length === 0) {
    customers = await getCustomers();
  }

  const teams = vendorData.teams;
  const vendorKey = currentVendor.key;
  const totalCount = teams.reduce((s, t) => s + (t.count || 0), 0);
  const vendorMappings = savedMappings[vendorKey] || {};

  // Auto-match teams to customers
  const matched = teams.map(t => {
    // Check saved mapping first
    const savedId = vendorMappings[t.vendorId || t.name];
    if (savedId) {
      const cust = customers.find(c => c.id === savedId);
      if (cust) return { ...t, customer: cust, source: 'saved' };
    }
    // Fuzzy match
    const cust = matchCustomer(t.name, customers);
    return { ...t, customer: cust, source: cust ? 'auto' : null };
  });

  const matchedCount = matched.filter(m => m.customer).length;
  const unmatchedCount = matched.filter(m => !m.customer).length;

  const showMatchStats = matched.length > 1;
  let html = `
    <div class="stats">
      <div class="stat"><div class="num pink">${totalCount}</div><div class="label">Total ${currentVendor.dataLabel || ''}</div></div>
      ${showMatchStats ? `<div class="stat"><div class="num green">${matchedCount}</div><div class="label">Customers</div></div>` : ''}
      ${showMatchStats && unmatchedCount > 0 ? `<div class="stat"><div class="num amber">${unmatchedCount}</div><div class="label">Unmatched</div></div>` : ''}
    </div>
    <button class="btn btn-sync" id="sync-btn">Sync to LootIT</button>
    <div class="team-list">`;

  for (let i = 0; i < matched.length; i++) {
    const m = matched[i];
    const selectedId = m.customer?.id || '';
    html += `<div class="team">
      <select data-idx="${i}" class="match-select">
        <option value="">-- Pick customer --</option>
        ${customers.map(c => `<option value="${c.id}" ${c.id === selectedId ? 'selected' : ''}>${c.name}</option>`).join('')}
      </select>
      <span class="count">${m.count ?? '?'} ${currentVendor.dataLabel || ''}</span>
    </div>`;
  }

  html += '</div>';

  // Upload area for vendors that support it
  if (currentVendor.supportsUpload) {
    html += `<div class="upload-area" id="upload-area">
      <p>${currentVendor.uploadLabel || 'Upload Report'}</p>
      <input type="file" id="upload-file" accept=".pdf,.csv,.xlsx" />
    </div>`;
  }

  contentEl.innerHTML = html;

  // Bind sync button
  document.getElementById('sync-btn').addEventListener('click', async () => {
    const btn = document.getElementById('sync-btn');
    btn.disabled = true;
    btn.textContent = 'Syncing...';

    try {
      // Collect manual matches from dropdowns
      const selects = document.querySelectorAll('.match-select');
      selects.forEach(sel => {
        const idx = parseInt(sel.dataset.idx, 10);
        const custId = sel.value;
        if (custId && matched[idx]) {
          const cust = customers.find(c => c.id === custId);
          if (cust) {
            matched[idx].customer = cust;
            // Save mapping
            if (!savedMappings[vendorKey]) savedMappings[vendorKey] = {};
            savedMappings[vendorKey][matched[idx].vendorId || matched[idx].name] = custId;
          }
        }
      });

      // Persist mappings
      await chrome.storage.local.set({ lootit_mappings: savedMappings });

      // Build results for backend (include extensions detail if available)
      const teamResults = matched.filter(m => m.customer).map(m => ({
        slug: m.vendorId || m.name,
        name: m.name,
        count: m.count,
        extensions: m.extensions || null,
        customer_id: m.customer.id,
        customer_name: m.customer.name,
      }));

      const result = await syncToPortalIT(vendorKey, teamResults, totalCount);
      setStatus('ok', `Synced ${result.synced} customers to LootIT`);
      btn.textContent = 'Synced!';
      setTimeout(() => { btn.textContent = 'Sync to LootIT'; btn.disabled = false; }, 2000);
    } catch (err) {
      setStatus('err', err.message);
      btn.textContent = 'Sync to LootIT';
      btn.disabled = false;
    }
  });

  // Upload handler
  const uploadArea = document.getElementById('upload-area');
  if (uploadArea) {
    const fileInput = document.getElementById('upload-file');
    uploadArea.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
      if (fileInput.files[0]) {
        setStatus('ok', `File selected: ${fileInput.files[0].name}`);
        // TODO: upload to PortalIT backend
      }
    });
  }
}

init();
