import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/api/client';

/**
 * Auto-retry hook: if key data arrays are all empty after initial load,
 * refresh the auth session and invalidate the cache to refetch.
 * Retries up to 2 times within 15 seconds of mount.
 */
export function useAutoRetry(dataArrays, isLoading, queryKeys) {
  const queryClient = useQueryClient();
  const retryCount = useRef(0);
  const mountTime = useRef(Date.now());

  useEffect(() => {
    if (Date.now() - mountTime.current > 15000) return;
    if (isLoading) return;
    if (retryCount.current >= 2) return;

    const allEmpty = dataArrays.every(arr => !arr || arr.length === 0);
    if (!allEmpty) return;

    retryCount.current += 1;
    const attempt = retryCount.current;
    console.warn(`[AutoRetry] Page loaded with all empty data — retry ${attempt}/2`);

    // Refresh session first (empty data often means auth wasn't ready), then refetch
    supabase.auth.refreshSession().catch(() => {}).finally(() => {
      for (const key of queryKeys) {
        queryClient.invalidateQueries({ queryKey: key });
      }
    });
  }, [isLoading, dataArrays, queryKeys, queryClient]);
}
