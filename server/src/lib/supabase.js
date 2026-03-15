import { createClient } from '@supabase/supabase-js';

let serviceClient = null;

export function getServiceSupabase() {
  if (!serviceClient) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
    }

    serviceClient = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: {
        fetch: (fetchUrl, options = {}) => {
          // 30s timeout for server-side Supabase calls
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000);
          return fetch(fetchUrl, { ...options, signal: controller.signal })
            .finally(() => clearTimeout(timeoutId));
        },
      },
      db: {
        schema: 'public',
      },
    });
  }

  return serviceClient;
}
