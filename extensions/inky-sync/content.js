// Content script — bridges page world and extension storage

// Inject fetch interceptor for Bearer token capture
const script = document.createElement('script');
script.src = chrome.runtime.getURL('inject.js');
script.onload = () => script.remove();
(document.head || document.documentElement).appendChild(script);

// Store Bearer token from intercepted fetch calls
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

// Scrape Team List page for mailbox counts
function scrapeTeamList() {
  const rows = document.querySelectorAll('table tbody tr, [class*="team"] tr, [role="row"]');
  const teams = [];

  rows.forEach(row => {
    const cells = row.querySelectorAll('td, [role="cell"]');
    if (cells.length >= 3) {
      const label = cells[0]?.textContent?.trim();
      const id = cells[1]?.textContent?.trim();
      // Mailboxes is typically the 3rd column
      const mailboxes = parseInt(cells[2]?.textContent?.trim(), 10);

      if (label && id && !isNaN(mailboxes) && id.includes('-')) {
        teams.push({ label, id, mailboxes });
      }
    }
  });

  if (teams.length > 0) {
    chrome.storage.local.set({ inky_team_data: teams, inky_team_data_time: Date.now() });
    console.log(`[INKY Sync] Scraped ${teams.length} teams from Team List page`);
  }

  return teams;
}

// Watch for Team List page and scrape when found
function checkAndScrape() {
  const heading = document.querySelector('h1, h2, h3, [class*="heading"]');
  const hasTeamList = heading && heading.textContent?.includes('Team List');
  // Also check for table with Mailboxes column
  const headers = document.querySelectorAll('th, [role="columnheader"]');
  const hasMailboxCol = Array.from(headers).some(h => h.textContent?.trim() === 'Mailboxes');

  if (hasTeamList || hasMailboxCol) {
    const teams = scrapeTeamList();
    if (teams.length > 0) return;
  }
}

// Run on load and watch for page changes (SPA navigation)
setTimeout(checkAndScrape, 2000);
const observer = new MutationObserver(() => { setTimeout(checkAndScrape, 1000); });
observer.observe(document.body, { childList: true, subtree: true });

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
