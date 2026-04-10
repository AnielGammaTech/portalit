// INKY scraper — extracts team mailbox counts from Team List page

function scrapeInky() {
  const teams = [];

  // Strategy 1: table rows
  document.querySelectorAll('table tr').forEach(row => {
    const cells = row.querySelectorAll('td');
    if (cells.length >= 3) {
      const label = cells[0]?.textContent?.trim();
      const id = cells[1]?.textContent?.trim();
      const mailboxes = parseInt(cells[2]?.textContent?.trim(), 10);
      if (label && id && id.includes('-') && !isNaN(mailboxes)) {
        teams.push({ name: label, vendorId: id, count: mailboxes });
      }
    }
  });
  if (teams.length > 0) return teams;

  // Strategy 2: find slug elements and walk DOM
  const allEls = document.querySelectorAll('*');
  const slugEls = [];
  allEls.forEach(el => {
    const t = el.textContent?.trim();
    if (t && /^[a-z][\w-]+-[\w-]+$/.test(t) && t.length > 5 && el.children.length === 0) {
      slugEls.push(el);
    }
  });

  for (const slugEl of slugEls) {
    const slug = slugEl.textContent.trim();
    let row = slugEl.parentElement;
    for (let i = 0; i < 5 && row; i++) {
      const nums = row.textContent.match(/\b(\d{1,5})\b/g);
      if (nums) {
        let label = '';
        row.querySelectorAll('*').forEach(child => {
          const t = child.textContent?.trim();
          if (t && t !== slug && !/^\d+$/.test(t) && t.length > 3 && t.length < 100 && child.children.length === 0 && !t.includes(slug)) {
            if (!label || t.length > label.length) label = t;
          }
        });
        if (label) {
          teams.push({ name: label, vendorId: slug, count: parseInt(nums[0], 10) });
          break;
        }
      }
      row = row.parentElement;
    }
  }

  return teams;
}

// Also capture Bearer token
const injectScript = document.createElement('script');
injectScript.src = chrome.runtime.getURL('inject.js');
injectScript.onload = () => injectScript.remove();
(document.head || document.documentElement).appendChild(injectScript);

window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  if (event.data?.type === 'INKY_TOKEN_CAPTURED') {
    chrome.storage.local.set({ inky_bearer_token: event.data.token, inky_token_time: Date.now() });
  }
  if (event.data?.type === 'INKY_REFRESH_TOKEN') {
    chrome.storage.local.set({ inky_refresh_token: event.data.refresh_token, inky_bearer_token: event.data.access_token, inky_token_time: Date.now() });
  }
});

// Auto-scrape when Team List page detected
function check() {
  const text = document.body?.innerText || '';
  if (text.includes('Team List') || text.includes('Mailboxes')) {
    const teams = scrapeInky();
    if (teams.length > 0) {
      chrome.storage.local.set({ lootit_vendor_data: { vendor: 'inky', teams, time: Date.now() } });
      console.log(`[LootIT Link] INKY: scraped ${teams.length} teams`);
    }
  }
}

setTimeout(check, 2000);
setTimeout(check, 5000);
new MutationObserver(() => setTimeout(check, 1500)).observe(document.body || document.documentElement, { childList: true, subtree: true });

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'SCRAPE') {
    const teams = scrapeInky();
    if (teams.length > 0) {
      chrome.storage.local.set({ lootit_vendor_data: { vendor: 'inky', teams, time: Date.now() } });
    }
    sendResponse({ teams });
    return true;
  }
});
