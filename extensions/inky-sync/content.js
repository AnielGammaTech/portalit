// Content script — bridges between page world (inject.js) and extension storage

const script = document.createElement('script');
script.src = chrome.runtime.getURL('inject.js');
script.onload = () => script.remove();
(document.head || document.documentElement).appendChild(script);

window.addEventListener('message', (event) => {
  if (event.source !== window) return;

  // Bearer token from API calls
  if (event.data?.type === 'INKY_TOKEN_CAPTURED' && event.data?.token) {
    chrome.storage.local.set({
      inky_bearer_token: event.data.token,
      inky_token_time: Date.now(),
    });
  }

  // Keycloak refresh token from OIDC token exchange
  if (event.data?.type === 'INKY_REFRESH_TOKEN' && event.data?.refresh_token) {
    chrome.storage.local.set({
      inky_refresh_token: event.data.refresh_token,
      inky_bearer_token: event.data.access_token,
      inky_token_time: Date.now(),
      inky_token_expires: Date.now() + ((event.data.expires_in || 300) * 1000),
    });
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'GET_TOKEN') {
    chrome.storage.local.get(['inky_bearer_token', 'inky_token_time'], sendResponse);
    return true;
  }
});
