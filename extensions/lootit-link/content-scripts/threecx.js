// 3CX scraper — single-tenant: each customer has their own 3CX instance
// Detects company from subdomain/page content and counts extensions

function scrape3CX() {
  const hostname = window.location.hostname;
  // Extract company slug from subdomain (e.g., "venturechurch" from venturechurch.fl.3cx.us)
  const companySlug = hostname.split('.')[0] || 'unknown';

  // Try to get a better name from page content
  let companyName = '';

  // Look for License Owner or FQDN on the page
  const body = document.body?.innerText || '';

  // Try "License Owner" field
  const ownerMatch = body.match(/License\s*Owner\s+([^\n]+)/i);
  if (ownerMatch) companyName = ownerMatch[1].trim();

  // Try FQDN field (e.g., "venturechurch.fl.3cx.us")
  if (!companyName) {
    const fqdnMatch = body.match(/FQDN\s+(\S+\.3cx\.\w+)/i);
    if (fqdnMatch) companyName = fqdnMatch[1].split('.')[0];
  }

  // Fallback: split slug into words (venturechurch → Venture Church)
  if (!companyName) {
    // Try splitting camelCase or known word boundaries
    companyName = companySlug
      .replace(/([a-z])([A-Z])/g, '$1 $2')  // camelCase
      .replace(/(tech|church|group|construction|service|farm|medical|star|coast|house|point|star|counsel)/gi, ' $1')
      .replace(/\s+/g, ' ')
      .trim();
  }

  companyName = companyName.replace(/\b\w/g, c => c.toUpperCase());

  // Count extensions/users
  let userCount = 0;

  // Strategy 1: count table rows with extension numbers (3-4 digits)
  document.querySelectorAll('tr').forEach(row => {
    const cells = row.querySelectorAll('td');
    if (cells.length >= 3) {
      const hasExtension = Array.from(cells).some(c => /^\d{3,4}$/.test(c.textContent?.trim()));
      if (hasExtension) userCount++;
    }
  });

  // Strategy 2: "Export (N)" button text
  if (userCount === 0) {
    const exportMatch = body.match(/Export\s*\((\d+)\)/);
    if (exportMatch) userCount = parseInt(exportMatch[1], 10);
  }

  // Strategy 3: "TOTAL EXTENSIONS" or "X Extensions" on dashboard
  if (userCount === 0) {
    const extMatch = body.match(/(\d+)\s*(?:Total\s*)?Extensions/i);
    if (extMatch) userCount = parseInt(extMatch[1], 10);
  }

  // Strategy 4: "Simultaneous Calls" nearby number on dashboard
  if (userCount === 0) {
    const simMatch = body.match(/(\d+)\s*Simultaneous/i);
    if (simMatch) userCount = parseInt(simMatch[1], 10);
  }

  if (userCount > 0 || companyName) {
    return [{
      name: companyName || companySlug,
      vendorId: companySlug,
      count: userCount || null,
      instanceUrl: hostname,
    }];
  }

  return [];
}

function check() {
  const teams = scrape3CX();
  if (teams.length > 0) {
    // Store with instance URL so different 3CX instances don't overwrite each other
    chrome.storage.local.set({
      lootit_vendor_data: { vendor: 'threecx', teams, time: Date.now(), instance: window.location.hostname }
    });
    console.log(`[LootIT Link] 3CX: ${teams[0].count} extensions at ${teams[0].name} (${window.location.hostname})`);
  }
}

setTimeout(check, 2000);
setTimeout(check, 4000);
new MutationObserver(() => setTimeout(check, 2000)).observe(document.body || document.documentElement, { childList: true, subtree: true });

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'SCRAPE') {
    const teams = scrape3CX();
    if (teams.length > 0) {
      chrome.storage.local.set({
        lootit_vendor_data: { vendor: 'threecx', teams, time: Date.now(), instance: window.location.hostname }
      });
    }
    sendResponse({ teams });
    return true;
  }
});
