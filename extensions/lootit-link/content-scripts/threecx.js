// 3CX scraper — single-tenant: count users/extensions on the current instance
// Each customer has their own 3CX admin console (e.g., gammatech.m.3cx.us)

function scrape3CX() {
  // Get company name from subdomain (e.g., "gammatech" from gammatech.m.3cx.us)
  const hostname = window.location.hostname;
  const companySlug = hostname.split('.')[0] || 'unknown';
  const companyName = companySlug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  // Count user rows in the Users table
  let userCount = 0;

  // Strategy 1: table rows with User/Email/Extension pattern
  const rows = document.querySelectorAll('table tbody tr, .user-row, [class*="user"] tr');
  rows.forEach(row => {
    const cells = row.querySelectorAll('td');
    // A valid user row has at least a name and an extension number
    if (cells.length >= 3) {
      const hasExtension = Array.from(cells).some(c => /^\d{3,4}$/.test(c.textContent?.trim()));
      if (hasExtension) userCount++;
    }
  });

  // Strategy 2: count any row with an extension number pattern (3-4 digit)
  if (userCount === 0) {
    document.querySelectorAll('tr, [role="row"]').forEach(row => {
      const text = row.textContent;
      if (text && /\b\d{3,4}\b/.test(text) && (text.includes('@') || text.includes('User'))) {
        userCount++;
      }
    });
  }

  // Strategy 3: look for a total count in the page (e.g., "Export (34)")
  if (userCount === 0) {
    const body = document.body?.innerText || '';
    const exportMatch = body.match(/Export\s*\((\d+)\)/);
    if (exportMatch) userCount = parseInt(exportMatch[1], 10);
  }

  // Strategy 4: count all elements that look like user entries
  if (userCount === 0) {
    document.querySelectorAll('tr').forEach(row => {
      const cells = row.querySelectorAll('td');
      if (cells.length >= 4) userCount++;
    });
    // Subtract header row if counted
    if (userCount > 0) userCount = Math.max(0, userCount);
  }

  if (userCount > 0) {
    return [{ name: companyName, vendorId: companySlug, count: userCount }];
  }

  return [];
}

function check() {
  const teams = scrape3CX();
  if (teams.length > 0) {
    chrome.storage.local.set({ lootit_vendor_data: { vendor: 'threecx', teams, time: Date.now() } });
    console.log(`[LootIT Link] 3CX: ${teams[0].count} users at ${teams[0].name}`);
  }
}

setTimeout(check, 2000);
setTimeout(check, 4000);
new MutationObserver(() => setTimeout(check, 2000)).observe(document.body || document.documentElement, { childList: true, subtree: true });

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'SCRAPE') {
    const teams = scrape3CX();
    if (teams.length > 0) chrome.storage.local.set({ lootit_vendor_data: { vendor: 'threecx', teams, time: Date.now() } });
    sendResponse({ teams });
    return true;
  }
});
