// apps/lootit/src/lib/auth-storage.js
// Cookie-backed Supabase storage adapter with localStorage backcompat.
// Identical file lives at src/lib/auth-storage.js in portalit (D-19).
//
// Contract: Supabase expects `getItem`, `setItem`, `removeItem` that either
// return values directly or return Promises of values. Methods MUST NOT
// perform network I/O — they are called on every auth state transition.
// Source: @supabase/auth-js SupportedStorage type
//   (PromisifyMethods<Pick<Storage, 'getItem'|'setItem'|'removeItem'>>)
//
// Decision refs:
//   D-16 — switch Supabase storage from localStorage to cookie on .gtools.io
//   D-17 — Domain=.gtools.io; Path=/; Secure; SameSite=Lax; Max-Age=<refresh>
//   D-18 — backcompat: read cookie then localStorage; write both during rollout
//   D-19 — identical copy lives in portalit's src/lib/auth-storage.js
//   D-20 — localhost bypass to plain localStorage (cookies silently dropped)
//   D-21 — cookie IS the handoff: no magic links, no tokens in URLs
//   D-22 — removeItem clears cookie chunks AND localStorage

const COOKIE_DOMAIN = '.gtools.io';
const IS_LOCALHOST =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' ||
   window.location.hostname === '127.0.0.1');

// Max-Age matches Supabase refresh token lifetime horizon (60 days).
// Exceeds the default 30-day refresh token lifetime so the cookie never
// expires before the refresh token — Supabase's refresh flow handles
// rotation on its own schedule.
const MAX_AGE_SECONDS = 60 * 60 * 24 * 60; // 60 days

// Single-cookie approach with chunking. A full Supabase session
// (access_token JWT + refresh_token + user object) can exceed the 4 KB
// per-cookie limit. We split into 3.5 KB chunks under keys
// `${key}.0`, `${key}.1`, ..., with a meta cookie `${key}` = "chunks:N".
// 10-chunk ceiling gives ~35 KB, far above any realistic Supabase session.
const CHUNK_SIZE = 3500;

function readCookie(name) {
  if (typeof document === 'undefined') return null;
  const prefix = name + '=';
  for (const piece of document.cookie.split(/;\s*/)) {
    if (piece.startsWith(prefix)) {
      return decodeURIComponent(piece.slice(prefix.length));
    }
  }
  return null;
}

function writeCookie(name, value) {
  if (typeof document === 'undefined') return;
  const attrs = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    `Max-Age=${MAX_AGE_SECONDS}`,
    'SameSite=Lax',
  ];
  if (!IS_LOCALHOST) {
    attrs.push(`Domain=${COOKIE_DOMAIN}`);
    attrs.push('Secure');
  }
  document.cookie = attrs.join('; ');
}

function deleteCookie(name) {
  if (typeof document === 'undefined') return;
  const attrs = [
    `${name}=`,
    'Path=/',
    'Max-Age=0',
    'SameSite=Lax',
  ];
  if (!IS_LOCALHOST) {
    attrs.push(`Domain=${COOKIE_DOMAIN}`);
    attrs.push('Secure');
  }
  document.cookie = attrs.join('; ');
}

function readFromCookie(key) {
  const meta = readCookie(key);
  if (!meta) return null;
  if (!meta.startsWith('chunks:')) {
    // Legacy / non-chunked value — meta cookie IS the value
    return meta;
  }
  const n = parseInt(meta.slice('chunks:'.length), 10);
  if (!Number.isFinite(n) || n < 1) return null;
  let assembled = '';
  for (let i = 0; i < n; i++) {
    const part = readCookie(`${key}.${i}`);
    if (part == null) return null; // corrupted — treat as no session
    assembled += part;
  }
  return assembled;
}

function writeToCookie(key, value) {
  // Always clear any existing chunks first so shrinking sessions don't
  // leave orphaned chunk cookies hanging around.
  clearCookieChunks(key);
  if (value.length <= CHUNK_SIZE) {
    writeCookie(key, value);
    return;
  }
  const chunks = Math.ceil(value.length / CHUNK_SIZE);
  writeCookie(key, `chunks:${chunks}`);
  for (let i = 0; i < chunks; i++) {
    writeCookie(`${key}.${i}`, value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE));
  }
}

function clearCookieChunks(key) {
  // Clear the meta cookie AND up to 10 chunk indices (covers ~35KB sessions).
  deleteCookie(key);
  for (let i = 0; i < 10; i++) {
    deleteCookie(`${key}.${i}`);
  }
}

/**
 * Factory that returns a Supabase-compatible storage adapter.
 *
 * Usage:
 *   createClient(url, key, { auth: { storage: createAuthStorage() } })
 *
 * Contract methods (all synchronous — Supabase awaits them either way):
 *   - getItem(key) returns the stored value or null
 *   - setItem(key, value) persists the value
 *   - removeItem(key) deletes the stored value
 */
export const createAuthStorage = () => ({
  getItem(key) {
    if (IS_LOCALHOST) {
      return window.localStorage.getItem(key);
    }
    // Cookie first (post-rollout), fallback to localStorage (backcompat D-18)
    const fromCookie = readFromCookie(key);
    if (fromCookie != null) return fromCookie;
    return window.localStorage.getItem(key);
  },

  setItem(key, value) {
    if (IS_LOCALHOST) {
      window.localStorage.setItem(key, value);
      return;
    }
    // Write both during backcompat window (D-18). Removing the localStorage
    // write is a deferred followup (~1 week post-phase-6).
    writeToCookie(key, value);
    try { window.localStorage.setItem(key, value); } catch { /* quota etc — ignore */ }
  },

  removeItem(key) {
    if (IS_LOCALHOST) {
      window.localStorage.removeItem(key);
      return;
    }
    clearCookieChunks(key);
    try { window.localStorage.removeItem(key); } catch { /* ignore */ }
  },
});

// Default export for callers that prefer
//   import authStorage from '@/lib/auth-storage'
// over the named factory import.
export default createAuthStorage();
