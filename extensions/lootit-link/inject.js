// Injected into page's MAIN world — intercepts fetch for Bearer token capture
(function() {
  const originalFetch = window.fetch;
  window.fetch = async function(...args) {
    try {
      const [url, options] = args;
      let auth = null;
      if (options?.headers) {
        auth = (options.headers instanceof Headers)
          ? options.headers.get('Authorization')
          : (options.headers['Authorization'] || options.headers['authorization']);
      }
      if (auth && auth.startsWith('Bearer ')) {
        window.postMessage({ type: 'INKY_TOKEN_CAPTURED', token: auth.replace('Bearer ', '') }, '*');
      }
    } catch {}

    const response = await originalFetch.apply(this, args);

    // Capture Keycloak refresh tokens
    try {
      const urlStr = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
      if (urlStr.includes('/openid-connect/token')) {
        response.clone().json().then(data => {
          if (data.refresh_token) {
            window.postMessage({ type: 'INKY_REFRESH_TOKEN', refresh_token: data.refresh_token, access_token: data.access_token, expires_in: data.expires_in }, '*');
          }
        }).catch(() => {});
      }
    } catch {}

    return response;
  };
})();
