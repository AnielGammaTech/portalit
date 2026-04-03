import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Auto-retry hook: if key data arrays are all empty after initial load,
 * invalidate the cache and refetch once. Prevents stale/empty page states
 * without requiring manual refresh.
 *
 * @param {Array} dataArrays - Array of query results to check (e.g., [customers, invoices, bills])
 * @param {boolean} isLoading - True if any critical query is still loading
 * @param {Array} queryKeys - Query keys to invalidate on retry
 */
export function useAutoRetry(dataArrays, isLoading, queryKeys) {
  const queryClient = useQueryClient();
  const hasRetried = useRef(false);
  const mountTime = useRef(Date.now());

  useEffect(() => {
    // Only check within the first 5 seconds of mount
    if (Date.now() - mountTime.current > 5000) return;
    // Don't retry while still loading
    if (isLoading) return;
    // Only retry once per mount
    if (hasRetried.current) return;

    // Check if ALL data arrays are empty (suspicious)
    const allEmpty = dataArrays.every(arr => !arr || arr.length === 0);
    if (!allEmpty) return;

    // All data is empty after loading — likely a stale cache or failed fetch
    hasRetried.current = true;
    console.warn('[AutoRetry] Page loaded with all empty data — refetching');

    for (const key of queryKeys) {
      queryClient.invalidateQueries({ queryKey: key });
    }
  }, [isLoading, dataArrays, queryKeys, queryClient]);
}
