import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Auto-retry hook: if key data arrays are all empty after initial load,
 * invalidate the cache to refetch.
 * Retries up to 2 times within 15 seconds of mount.
 */
export function useAutoRetry(dataArrays = [], isLoading, queryKeys = []) {
  const queryClient = useQueryClient();
  const retryCount = useRef(0);
  const mountTime = useRef(Date.now());
  const retryTimer = useRef(null);
  const queryKeysRef = useRef(queryKeys);

  queryKeysRef.current = queryKeys;

  const dataLengths = dataArrays.map(arr => (Array.isArray(arr) ? arr.length : 0));
  const dataSignature = dataLengths.join('|');
  const allEmpty = dataLengths.length > 0 && dataLengths.every(length => length === 0);

  useEffect(() => () => {
    if (retryTimer.current) {
      clearTimeout(retryTimer.current);
    }
  }, []);

  useEffect(() => {
    if (Date.now() - mountTime.current > 15000) return;
    if (isLoading) return;
    if (retryCount.current >= 2) return;
    if (!allEmpty) return;
    if (retryTimer.current) return;

    retryCount.current += 1;
    const attempt = retryCount.current;
    console.warn(`[AutoRetry] Page loaded with empty data; retry ${attempt}/2`);

    // The API/auth client owns token refresh. This hook only retries active data queries.
    retryTimer.current = setTimeout(() => {
      retryTimer.current = null;
      for (const key of queryKeysRef.current) {
        queryClient.invalidateQueries({ queryKey: key });
      }
    }, 350);
  }, [isLoading, allEmpty, dataSignature, queryClient]);
}
