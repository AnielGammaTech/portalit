/**
 * Shared helpers for vendor sync functions.
 *
 * Why these exist: the original sync_all implementations called raw fetch()
 * inside serial for-loops, with no per-call timeout. A single hung vendor
 * endpoint froze the entire batch (root cause of EDR sync_all stopping at
 * 2/78 customers — the 3rd customer's fetch never resolved).
 */

export const DEFAULT_FETCH_TIMEOUT_MS = 30000;

/**
 * fetch with a hard AbortController timeout. Returns null on abort, network
 * error, or timeout — matches the `.catch(() => null)` shape callers already
 * use. Callers still must check `res?.ok` before reading the body.
 */
export async function fetchWithTimeout(url, opts = {}, timeoutMs = DEFAULT_FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  // Compose with any existing signal so callers can still cancel
  if (opts.signal) {
    opts.signal.addEventListener('abort', () => controller.abort(), { once: true });
  }
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/**
 * Run an async worker across `items` with bounded concurrency. Per-item errors
 * are caught — one bad mapping cannot break the batch. Returns an array of
 * { ok, value } | { ok: false, error } in input order.
 */
export async function runWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      try {
        results[i] = { ok: true, value: await worker(items[i], i) };
      } catch (err) {
        results[i] = { ok: false, error: err };
      }
    }
  });
  await Promise.all(runners);
  return results;
}

/**
 * Summarize a runWithConcurrency result array for logging / return payload.
 * Returns { synced, failed, total, errors: [{ index, customer?, reason }] }.
 *
 * `isSynced(value)` — caller-provided predicate, since some workers return
 * { synced: true, ... } and others return a record directly.
 */
export function summarizeResults(items, results, { isSynced = (v) => v?.synced !== false, customerKey = 'customer_name' } = {}) {
  const synced = results.filter((r) => r.ok && isSynced(r.value)).length;
  const failed = results.length - synced;
  const errors = results
    .map((r, i) => {
      if (r.ok && isSynced(r.value)) return null;
      return {
        index: i,
        customer: items[i]?.[customerKey],
        reason: r.ok ? (r.value?.reason || 'returned_not_synced') : (r.error?.message || 'unknown'),
      };
    })
    .filter(Boolean)
    .slice(0, 10);
  return { synced, failed, total: results.length, errors };
}
