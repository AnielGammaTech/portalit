// ── In-memory rate limiter middleware ────────────────────────────────
// Tracks request counts per key (IP or custom) within sliding windows.
// No external dependencies required.

const stores = new Map(); // storeId → Map<key, { count, resetAt }>

function getStore(storeId) {
  if (!stores.has(storeId)) {
    stores.set(storeId, new Map());
  }
  return stores.get(storeId);
}

function cleanStore(store) {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.resetAt) {
      store.delete(key);
    }
  }
}

// Periodic cleanup every 5 minutes
setInterval(() => {
  for (const store of stores.values()) {
    cleanStore(store);
  }
}, 5 * 60 * 1000).unref();

/**
 * Creates a rate limiting middleware.
 *
 * @param {Object} options
 * @param {string} options.storeId   - Unique identifier for this limiter's store
 * @param {number} options.windowMs  - Time window in milliseconds
 * @param {number} options.max       - Maximum requests per window per key
 * @param {function} [options.keyGenerator] - Function(req) => string key. Defaults to IP.
 * @param {string} [options.message] - Error message when rate limited
 * @returns {function} Express middleware
 */
export function createRateLimiter({
  storeId,
  windowMs,
  max,
  keyGenerator,
  message = 'Too many requests. Please try again later.',
}) {
  const store = getStore(storeId);

  const getKey = keyGenerator || ((req) => {
    return req.ip || req.socket?.remoteAddress || 'unknown';
  });

  return (req, res, next) => {
    const key = getKey(req);
    const now = Date.now();
    const entry = store.get(key);

    if (!entry || now > entry.resetAt) {
      store.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (entry.count >= max) {
      const retryAfterSeconds = Math.ceil((entry.resetAt - now) / 1000);
      res.set('Retry-After', String(retryAfterSeconds));
      return res.status(429).json({ error: message });
    }

    // Return new entry with incremented count (immutable update)
    store.set(key, { ...entry, count: entry.count + 1 });
    next();
  };
}
