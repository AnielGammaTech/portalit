// Graphus scraper — extracts org names + protected user counts from MSP portal

function scrapeGraphus() {
  const teams = [];

  // Strategy 1: table rows (Organization list view)
  document.querySelectorAll('table tr, [role="row"]').forEach(row => {
    const cells = row.querySelectorAll('td, [role="cell"]');
    if (cells.length >= 2) {
      const name = cells[0]?.textContent?.trim();
      const nums = [];
      cells.forEach(c => {
        const n = parseInt(c.textContent?.trim(), 10);
        if (!isNaN(n) && n >= 0) nums.push(n);
      });
      if (name && name.length > 2 && !/^(organization|name|company|status|users|protected)/i.test(name) && nums.length > 0) {
        teams.push({
          name,
          vendorId: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
          count: nums[0],
        });
      }
    }
  });
  if (teams.length > 0) return teams;

  // Strategy 2: card/grid layout — look for org cards with user counts
  const cards = document.querySelectorAll('[class*="card"], [class*="org"], [class*="tenant"], [class*="customer"]');
  for (const card of cards) {
    const text = card.innerText || '';
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

    let name = '';
    let count = 0;
    for (const line of lines) {
      const numMatch = line.match(/(\d+)\s*(?:protected\s*users?|users?|mailbox(?:es)?|seats?)/i);
      if (numMatch) {
        count = parseInt(numMatch[1], 10);
        continue;
      }
      if (!name && line.length > 2 && line.length < 100 && !/^\d+$/.test(line) && !/^(status|active|inactive|edit|delete|view|details)/i.test(line)) {
        name = line;
      }
    }

    if (name && count > 0) {
      teams.push({
        name,
        vendorId: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
        count,
      });
    }
  }
  if (teams.length > 0) return teams;

  // Strategy 3: generic row pattern — look for text + number pairs in list items
  const listItems = document.querySelectorAll('li, [class*="list-item"], [class*="row"]');
  for (const item of listItems) {
    const text = item.innerText || '';
    const match = text.match(/^(.+?)\s+(\d+)\s*(?:protected\s*users?|users?|mailbox(?:es)?|seats?)?$/im);
    if (match) {
      const name = match[1].trim();
      const count = parseInt(match[2], 10);
      if (name.length > 2 && count > 0) {
        teams.push({
          name,
          vendorId: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
          count,
        });
      }
    }
  }

  return teams;
}

function check() {
  const text = document.body?.innerText || '';
  if (text.includes('Organization') || text.includes('Protected') || text.includes('Tenant') || text.includes('Users')) {
    const teams = scrapeGraphus();
    if (teams.length > 0) {
      chrome.storage.local.set({ lootit_vendor_data: { vendor: 'graphus', teams, time: Date.now() } });
      console.log(`[LootIT Link] Graphus: scraped ${teams.length} orgs`);
    }
  }
}

setTimeout(check, 2000);
setTimeout(check, 5000);
new MutationObserver(() => setTimeout(check, 2000)).observe(document.body || document.documentElement, { childList: true, subtree: true });

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'SCRAPE') {
    const teams = scrapeGraphus();
    if (teams.length > 0) {
      chrome.storage.local.set({ lootit_vendor_data: { vendor: 'graphus', teams, time: Date.now() } });
    }
    sendResponse({ teams });
    return true;
  }
});
