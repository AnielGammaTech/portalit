import { QueryClient } from '@tanstack/react-query';
import { supabase } from '@/api/client';

// Track whether a session refresh is already in flight to avoid hammering
let _refreshing = false;

async function handleQueryError(error) {
  // Detect auth/JWT errors from Supabase or backend
  const msg = (error?.message || '').toLowerCase();
  const code = error?.code || '';
  const status = error?.status;

  const isAuthError =
    status === 401 ||
    code === 'PGRST301' ||
    msg.includes('jwt') ||
    msg.includes('token') ||
    msg.includes('unauthorized') ||
    msg.includes('not authenticated');

  if (isAuthError && !_refreshing) {
    _refreshing = true;
    try {
      await supabase.auth.refreshSession();
    } catch {
      // If refresh fails, user will need to re-login — don't loop
    } finally {
      _refreshing = false;
    }
  }
}

export const queryClientInstance = new QueryClient({
  defaultOptions: {
    queries: {
      // Was 'always' — caused a race with the visibility handler below:
      // refetchOnWindowFocus fires synchronously when the tab regains focus,
      // so queries went out with a stale/expired token and silently returned
      // empty arrays from RLS, leaving pages blank with footer. Default `true`
      // only refetches stale queries; the TOKEN_REFRESHED handler invalidates
      // after refresh so refetches use the new token.
      refetchOnWindowFocus: true,
      refetchOnReconnect: 'always',
      refetchOnMount: true,
      retry: (failureCount, error) => {
        // Don't retry auth errors — refresh session instead
        const status = error?.status;
        if (status === 401 || status === 403) return false;
        return failureCount < 2;
      },
      staleTime: 1000 * 60 * 2,
      gcTime: 1000 * 60 * 5,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
    },
    mutations: {
      retry: false,
    },
  },
});

// Global error handler — refreshes session on auth failures
queryClientInstance.getQueryCache().config.onError = handleQueryError;

// When supabase refreshes the access token (auto-refresh, or our explicit
// tab-resume refresh below), invalidate React Query so any data fetched
// during the refresh window — including silently-empty RLS responses —
// is re-fetched with the new token.
supabase.auth.onAuthStateChange((event) => {
  if (event === 'TOKEN_REFRESHED') {
    queryClientInstance.invalidateQueries();
  }
});

// Force a session refresh when the tab regains visibility after being idle.
// Without this, the access token can expire in the background and the next
// queries fire with it before supabase's auto-refresh resolves — RLS then
// returns empty arrays (no error), and pages render blank. Awaiting the
// refresh fires TOKEN_REFRESHED, which invalidates queries above.
let _visibilityRefreshing = false;
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState !== 'visible') return;
    if (_visibilityRefreshing) return;
    _visibilityRefreshing = true;
    try {
      await supabase.auth.refreshSession();
    } catch (err) {
      console.warn('[auth] tab-resume refresh failed:', err?.message);
    } finally {
      _visibilityRefreshing = false;
    }
  });
}
