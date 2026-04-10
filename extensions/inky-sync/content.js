// Content script — bridges page world and extension storage

// Inject fetch interceptor for Bearer token capture
const script = document.createElement('script');
script.src = chrome.runtime.getURL('inject.js');
script.onload = () => script.remove();
(document.head || document.documentElement).appendChild(script);

// Store tokens from intercepted fetch calls
window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  if (event.data?.type === 'INKY_TOKEN_CAPTURED' && event.data?.token) {
    chrome.storage.local.set({ inky_bearer_token: event.data.token, inky_token_time: Date.now() });
  }
  if (event.data?.type === 'INKY_REFRESH_TOKEN' && event.data?.refresh_token) {
    chrome.storage.local.set({
      inky_refresh_token: event.data.refresh_token,
      inky_bearer_token: event.data.access_token,
      inky_token_time: Date.now(),
    });
  }
});

// Scrape Team List page — try every possible DOM structure
function scrapeTeamList() {
  const teams = [];

  // Strategy 1: standard <table> with <tr>/<td>
  document.querySelectorAll('table tr').forEach(row => {
    const cells = row.querySelectorAll('td');
    if (cells.length >= 3) {
      const label = cells[0]?.textContent?.trim();
      const id = cells[1]?.textContent?.trim();
      const mailboxes = parseInt(cells[2]?.textContent?.trim(), 10);
      if (label && id && id.includes('-') && !isNaN(mailboxes)) {
        teams.push({ label, id, mailboxes });
      }
    }
  });

  if (teams.length > 0) {
    console.log(`[INKY Sync] Strategy 1 (table/tr/td): found ${teams.length} teams`);
    chrome.storage.local.set({ inky_team_data: teams, inky_team_data_time: Date.now() });
    return teams;
  }

  // Strategy 2: find team slugs in the page text and nearby numbers
  // Team slugs look like "allen-concrete-masonry", "venture-church-naples"
  const body = document.body.innerText;
  const lines = body.split('\n').map(l => l.trim()).filter(l => l);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Look for lines containing a slug pattern (word-word-word)
    const slugMatch = line.match(/([a-z][\w-]+-[\w-]+)/);
    if (!slugMatch) continue;
    const slug = slugMatch[1];
    if (slug.length < 5 || !slug.includes('-')) continue;

    // Look for a label before the slug (could be on same line or previous line)
    // And a number after (mailbox count)
    // Try parsing: "LABEL  slug  NUMBER  NUMBER"
    const parts = line.split(/\s{2,}|\t/);
    if (parts.length >= 3) {
      const label = parts[0]?.trim();
      const idPart = parts.find(p => p.match(/^[a-z][\w-]+-[\w-]+$/));
      const numbers = parts.filter(p => /^\d+$/.test(p.trim()));
      if (label && idPart && numbers.length > 0) {
        teams.push({ label, id: idPart, mailboxes: parseInt(numbers[0], 10) });
        continue;
      }
    }
  }

  if (teams.length > 0) {
    console.log(`[INKY Sync] Strategy 2 (text parse): found ${teams.length} teams`);
    chrome.storage.local.set({ inky_team_data: teams, inky_team_data_time: Date.now() });
    return teams;
  }

  // Strategy 3: find all elements containing team slug patterns and walk siblings for numbers
  const allElements = document.querySelectorAll('*');
  const slugElements = [];
  allElements.forEach(el => {
    const text = el.textContent?.trim();
    if (text && /^[a-z][\w-]+-[\w-]+$/.test(text) && text.length > 5 && el.children.length === 0) {
      slugElements.push(el);
    }
  });

  for (const slugEl of slugElements) {
    const slug = slugEl.textContent.trim();
    // Walk up to find the row container
    let row = slugEl.parentElement;
    for (let j = 0; j < 5 && row; j++) {
      const rowText = row.textContent;
      // Check if this container has a number (mailbox count)
      const nums = rowText.match(/\b(\d{1,4})\b/g);
      if (nums && nums.length > 0) {
        // Find the label — text that's NOT the slug and NOT a number
        const children = row.querySelectorAll('*');
        let label = '';
        children.forEach(child => {
          const t = child.textContent?.trim();
          if (t && t !== slug && !/^\d+$/.test(t) && t.length > 3 && t.length < 100
            && child.children.length === 0 && !t.includes(slug)) {
            if (!label || t.length > label.length) label = t;
          }
        });

        if (label) {
          teams.push({ label, id: slug, mailboxes: parseInt(nums[0], 10) });
          break;
        }
      }
      row = row.parentElement;
    }
  }

  if (teams.length > 0) {
    console.log(`[INKY Sync] Strategy 3 (DOM walk): found ${teams.length} teams`);
    chrome.storage.local.set({ inky_team_data: teams, inky_team_data_time: Date.now() });
    return teams;
  }

  console.log('[INKY Sync] No teams found with any strategy');
  return [];
}

// Auto-scrape on page changes
function checkAndScrape() {
  const text = document.body?.innerText || '';
  if (text.includes('Team List') || text.includes('Mailboxes')) {
    scrapeTeamList();
  }
}

setTimeout(checkAndScrape, 2000);
setTimeout(checkAndScrape, 5000);
const observer = new MutationObserver(() => setTimeout(checkAndScrape, 1500));
observer.observe(document.body || document.documentElement, { childList: true, subtree: true });

// Respond to popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'GET_TOKEN') {
    chrome.storage.local.get(['inky_bearer_token', 'inky_token_time'], sendResponse);
    return true;
  }
  if (msg.type === 'SCRAPE_TEAMS') {
    const teams = scrapeTeamList();
    sendResponse({ teams });
    return true;
  }
});
