// Injected into the page's MAIN world — intercept fetch + capture OIDC tokens
(function() {
  const originalFetch = window.fetch;
  window.fetch = async function(...args) {
    const [url, options] = args;

    try {
      // Capture Bearer token from outgoing API calls
      let auth = null;
      if (options?.headers) {
        if (options.headers instanceof Headers) {
          auth = options.headers.get('Authorization');
        } else if (typeof options.headers === 'object') {
          auth = options.headers['Authorization'] || options.headers['authorization'];
        }
      }
      if (auth && auth.startsWith('Bearer ')) {
        window.postMessage({ type: 'INKY_TOKEN_CAPTURED', token: auth.replace('Bearer ', '') }, '*');
      }
    } catch {}

    // Call original fetch
    const response = await originalFetch.apply(this, args);

    // Capture Keycloak token responses (contains refresh_token)
    try {
      const urlStr = typeof url === 'string' ? url : url?.url || '';
      if (urlStr.includes('/openid-connect/token')) {
        const clone = response.clone();
        clone.json().then(data => {
          if (data.refresh_token) {
            window.postMessage({
              type: 'INKY_REFRESH_TOKEN',
              refresh_token: data.refresh_token,
              access_token: data.access_token,
              expires_in: data.expires_in,
            }, '*');
          }
        }).catch(() => {});
      }
    } catch {}

    return response;
  };

  const origOpen = XMLHttpRequest.prototype.open;
  const origSetHeader = XMLHttpRequest.prototype.setRequestHeader;
  XMLHttpRequest.prototype.open = function(...a) { this._url = a[1]; return origOpen.apply(this, a); };
  XMLHttpRequest.prototype.setRequestHeader = function(name, value) {
    if (name.toLowerCase() === 'authorization' && value.startsWith('Bearer ')) {
      window.postMessage({ type: 'INKY_TOKEN_CAPTURED', token: value.replace('Bearer ', '') }, '*');
    }
    return origSetHeader.apply(this, arguments);
  };
})();
