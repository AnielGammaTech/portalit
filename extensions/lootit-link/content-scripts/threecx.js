// 3CX scraper — single-tenant: each customer has their own 3CX instance
// Captures full extension list with names for audit/exclusion in PortalIT

function scrape3CX() {
  const hostname = window.location.hostname;
  const companySlug = hostname.split('.')[0] || 'unknown';

  // Get company name from page content
  let companyName = '';
  const body = document.body?.innerText || '';

  const ownerMatch = body.match(/License\s*Owner\s+([^\n]+)/i);
  if (ownerMatch) companyName = ownerMatch[1].trim();

  if (!companyName) {
    const fqdnMatch = body.match(/FQDN\s+(\S+\.3cx\.\w+)/i);
    if (fqdnMatch) companyName = fqdnMatch[1].split('.')[0];
  }

  if (!companyName) {
    companyName = companySlug
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/(tech|church|group|construction|service|farm|medical|star|coast|house|point|counsel)/gi, ' $1')
      .replace(/\s+/g, ' ').trim();
  }

  companyName = companyName.replace(/\b\w/g, c => c.toUpperCase());

  // Scrape full extension list from Users table
  const extensions = [];
  let userCount = 0;

  document.querySelectorAll('tr').forEach(row => {
    const cells = row.querySelectorAll('td');
    if (cells.length >= 3) {
      // Find the extension number cell (3-4 digit number)
      let extNum = null;
      let name = '';
      let email = '';
      let dept = '';

      Array.from(cells).forEach(c => {
        const txt = c.textContent?.trim() || '';
        if (/^\d{3,4}$/.test(txt) && !extNum) {
          extNum = txt;
        } else if (txt.includes('@') && !email) {
          email = txt;
        } else if (['DEFAULT', 'SALES', 'SUPPORT', 'ADMIN'].includes(txt.toUpperCase()) || dept) {
          if (!dept) dept = txt;
        } else if (txt.length > 2 && !extNum && !name) {
          name = txt;
        }
      });

      // Fallback: first cell is usually the name
      if (!name && cells[0]) name = cells[0].textContent?.trim() || '';

      if (extNum) {
        userCount++;
        extensions.push({
          number: extNum,
          name: name.replace(/\s*\(.*?\)\s*/g, '').trim(), // Remove "(User)", "(System Owner)" etc
          type: name.includes('System Owner') ? 'system_owner' : 'user',
          email: email || null,
          department: dept || 'DEFAULT',
        });
      }
    }
  });

  // Fallback: "Export (N)" button
  if (userCount === 0) {
    const exportMatch = body.match(/Export\s*\((\d+)\)/);
    if (exportMatch) userCount = parseInt(exportMatch[1], 10);
  }

  // Only use dashboard extension count if we actually found extension rows
  // (avoids picking up "8 Simultaneous Calls" or other dashboard numbers)
  if (userCount === 0 && extensions.length === 0) {
    const isUsersPage = /\/(users|extensions)/i.test(window.location.pathname) ||
      document.querySelector('[data-testid="users-list"], .users-list, .extension-list');
    if (isUsersPage) {
      const extMatch = body.match(/(\d+)\s*(?:Total\s*)?Extensions/i);
      if (extMatch) userCount = parseInt(extMatch[1], 10);
    }
  }

  if (userCount > 0 || extensions.length > 0) {
    return [{
      name: companyName || companySlug,
      vendorId: companySlug,
      count: extensions.length || userCount,
      extensions,
      instanceUrl: hostname,
    }];
  }

  return [];
}

function check() {
  const teams = scrape3CX();
  if (teams.length > 0) {
    chrome.storage.local.set({
      lootit_vendor_data: { vendor: 'threecx', teams, time: Date.now(), instance: window.location.hostname }
    });
    console.log(`[LootIT Link] 3CX: ${teams[0].count} extensions (${teams[0].extensions.length} detailed) at ${teams[0].name}`);
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
