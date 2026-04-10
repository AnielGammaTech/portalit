// Dark Web ID scraper — extracts domain monitoring data

function scrapeDarkWeb() {
  const teams = [];

  document.querySelectorAll('table tr, [role="row"]').forEach(row => {
    const cells = row.querySelectorAll('td, [role="cell"]');
    if (cells.length >= 2) {
      const name = cells[0]?.textContent?.trim();
      const nums = [];
      cells.forEach(c => {
        const n = parseInt(c.textContent?.trim(), 10);
        if (!isNaN(n)) nums.push(n);
      });
      if (name && name.length > 2 && nums.length > 0) {
        teams.push({ name, vendorId: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), count: nums[0] });
      }
    }
  });

  return teams;
}

function check() {
  const teams = scrapeDarkWeb();
  if (teams.length > 0) {
    chrome.storage.local.set({ lootit_vendor_data: { vendor: 'darkweb', teams, time: Date.now() } });
    console.log(`[LootIT Link] DarkWeb: scraped ${teams.length} entries`);
  }
}

setTimeout(check, 3000);
new MutationObserver(() => setTimeout(check, 2000)).observe(document.body || document.documentElement, { childList: true, subtree: true });

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'SCRAPE') {
    const teams = scrapeDarkWeb();
    if (teams.length > 0) chrome.storage.local.set({ lootit_vendor_data: { vendor: 'darkweb', teams, time: Date.now() } });
    sendResponse({ teams });
    return true;
  }
});
