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
      refetchOnWindowFocus: 'always',
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
