---
phase: 04-lootit-service-extraction
plan: 02
subsystem: auth
tags:
  - auth
  - cookies
  - sso
  - supabase
  - cross-subdomain
dependency_graph:
  requires: []
  provides:
    - "apps/lootit/src/lib/auth-storage.js::createAuthStorage"
    - "cookie-backed Supabase storage adapter contract (D-16..D-22)"
  affects:
    - "Plan 04-03 (will import createAuthStorage into apps/lootit/src/api/client.js)"
    - "Plan 04-04 (copy this file byte-for-byte into src/lib/auth-storage.js on portalit side, per D-19)"
tech_stack:
  added: []
  patterns:
    - "Supabase custom storage adapter via SupportedStorage contract"
    - "Single-cookie chunking (3500-byte chunks + meta cookie) for sessions >4KB"
    - "Localhost bypass to plain localStorage (cookies dropped at .gtools.io scope)"
    - "Dual-write backcompat: cookie + localStorage during rollout window"
key_files:
  created:
    - apps/lootit/src/lib/auth-storage.js
  modified: []
decisions:
  - "Max-Age locked at 60 days (5184000s) to exceed Supabase default refresh token lifetime of 30 days"
  - "Chunk ceiling set to 10 (~35 KB) — 7-17x headroom over typical Supabase sessions"
  - "Default export added alongside named createAuthStorage for ergonomic importing"
metrics:
  duration_seconds: 0
  tasks_completed: 2
  files_created: 1
  files_modified: 0
completed: 2026-04-15
---

# Phase 4 Plan 2: LootIT auth-storage adapter Summary

**One-liner:** Cookie-backed Supabase storage adapter for cross-subdomain SSO on `.gtools.io` with localStorage backcompat and chunking for sessions >4KB.

## Objective Recap

Write the single file (`apps/lootit/src/lib/auth-storage.js`) that makes cross-subdomain SSO work between `portalit.gtools.io`, `customer.portalit.gtools.io`, and `lootit.gtools.io`. Implements D-16 through D-22 verbatim from the plan's RESEARCH Pattern 1 reference implementation.

## What Was Built

### `apps/lootit/src/lib/auth-storage.js` (167 lines, commit `2e83e74`)

Pure browser-API JavaScript module with zero imports. Exports:
- Named export `createAuthStorage()` — factory returning a Supabase `SupportedStorage`-compatible object
- Default export — a pre-instantiated adapter for `import authStorage from '@/lib/auth-storage'` ergonomics

**Constants locked per plan:**
- `COOKIE_DOMAIN = '.gtools.io'` (D-17)
- `MAX_AGE_SECONDS = 60 * 60 * 24 * 60` = 5184000s = 60 days
- `CHUNK_SIZE = 3500` bytes (under 4096 browser cap with encoding headroom)
- `IS_LOCALHOST` detection via `window.location.hostname === 'localhost' || '127.0.0.1'`

**Helper functions (module-private):**
- `readCookie(name)` / `writeCookie(name, value)` / `deleteCookie(name)` — low-level `document.cookie` ops; SSR-safe via `typeof document === 'undefined'` guards; non-localhost writes append `Domain=.gtools.io` and `Secure`
- `readFromCookie(key)` — meta-cookie aware reassembly; returns null on any missing chunk (corrupted → treat as no session, graceful anon fallback)
- `writeToCookie(key, value)` — always clears existing chunks first; single cookie if ≤3500 bytes, otherwise `chunks:N` meta + chunk indices
- `clearCookieChunks(key)` — deletes meta + 10 chunk slots

**Exported adapter methods (match Supabase `SupportedStorage` contract):**
- `getItem(key)` — localhost: plain `localStorage.getItem`; off-localhost: cookie first, fall back to localStorage (D-18 backcompat read path)
- `setItem(key, value)` — localhost: plain `localStorage.setItem`; off-localhost: write cookie AND localStorage (D-18 dual-write backcompat), localStorage wrapped in try/catch for quota errors
- `removeItem(key)` — localhost: plain `localStorage.removeItem`; off-localhost: clear all cookie chunks AND localStorage (D-22)

All methods are synchronous and perform no network work, no React state reads — Supabase auth-js contract requirement (called on every auth state transition).

## Task Completion

| Task | Name | Status | Commit | Files |
|------|------|--------|--------|-------|
| 1 | Write the cookie+localStorage auth adapter | ✅ complete | `2e83e74` | `apps/lootit/src/lib/auth-storage.js` |
| 2 | Round-trip smoke test via node eval | ✅ complete | (verification only — no file changes) | — |

### Task 1 acceptance criteria (all 17 pass)

```
exists: OK
createAuthStorage: OK
COOKIE_DOMAIN: OK
IS_LOCALHOST: OK
localhost check: OK
MAX_AGE: OK
CHUNK_SIZE: OK
SameSite: OK
Secure: OK
chunks: OK
ls.getItem: OK
ls.setItem: OK
ls.removeItem: OK
no imports: OK
no ssr: OK
no TS: OK
line count >= 100: OK (167 lines)
```

### Task 2 smoke test output

Ran the node `--input-type=module` script from the plan (with stubbed `window`/`document`, hostname `lootit.gtools.io`):

```
auth-storage smoke test PASS
```

All four assertions passed:
1. **Small value round-trip** — `storage.setItem(key, "hello-world")` then `getItem(key) === "hello-world"`
2. **Chunked round-trip** — `storage.setItem(key, "x".repeat(12000))` forces 4 chunks (`Math.ceil(12000/3500) = 4`); reassembly returns the exact 12000-char string
3. **removeItem cleanup** — after `removeItem`, `getItem` returns `null` (meta cookie + all chunks cleared)
4. **D-18 backcompat read path** — populated `window.localStorage` directly, cleared cookie jar, `getItem` still returns `"legacy-session"` via the localStorage fallback

Exit code 0.

## Deviations from Plan

**None — plan executed exactly as RESEARCH Pattern 1 specified.**

One minor stylistic adjustment during Task 1 verification: the plan's acceptance criterion grep `! grep -q ": string\|: number\|interface "` matched a JSDoc comment line describing the return type (`getItem(key): string | null`). Rewrote the JSDoc line to plain English (`getItem(key) returns the stored value or null`) so the acceptance check passes literally. Behavior is unchanged — JSDoc is comments only.

No deviations required Rules 1-3 (no bugs, no missing critical functionality, no blocking issues). No Rule 4 architectural decisions.

## Security Notes

This file is HIGH sensitivity per RESEARCH Security Domain:
- **V3 Session Management:** Cookie is the session transport; chunking handles 4KB browser cap safely; corrupted chunks return null → user re-logs (no silent compromise)
- **V14 Configuration:** `SameSite=Lax` + `Secure` (off-localhost) + `Domain=.gtools.io`; cookie is NOT used for backend auth (JWT still flows via `Authorization: Bearer`), cookie is client-side persistence only
- **XSS exposure unchanged from current state** — JS-accessible session was already the threat model with localStorage; moving to `document.cookie` (readable by JS) is same-risk
- **CSRF via credentials:true** — backend already validates `Origin` against allowlist, and auth is header-based not cookie-based, so the cookie is irrelevant to backend authZ

Phase 5 (plan 04-04) should invoke `security-reviewer` before merging the identical copy into portalit.

## Key Decisions

1. **Max-Age = 60 days.** Exceeds Supabase default 30-day refresh token lifetime. If the refresh token expires before the cookie, Supabase's built-in refresh flow handles it — the stale cookie is harmless because the adapter just re-writes on the next refresh. Locked in Task 1 per RESEARCH Open Question #6.

2. **Chunk ceiling = 10.** Covers ~35KB sessions vs. typical 2-5KB Supabase sessions. 7-17x headroom is deliberate defense against future Supabase payload growth.

3. **Default export added.** The plan spec asked for it (`export default createAuthStorage()`). Callers can use either `import { createAuthStorage } from '@/lib/auth-storage'` (factory) or `import authStorage from '@/lib/auth-storage'` (pre-instantiated).

4. **Zero imports.** The file has literally no `import` statements — pure `document.cookie` and `window.localStorage` browser APIs only. This is the RESEARCH anti-pattern avoidance for `@supabase/ssr` and keeps the file byte-for-byte copyable to portalit in Plan 04-04.

## Note for Plan 04-04 (portalit side)

**This file is the source of truth for cross-subdomain SSO storage.** Per D-19, Plan 04-04 must create `src/lib/auth-storage.js` (at the portalit repo root, not under `apps/`) as a byte-for-byte copy of this file. Do NOT diverge — any change to the auth contract must be made in BOTH files as a paired edit, or the two apps will desync and users will get logged out on cross-domain navigation.

Suggested copy command for Plan 04-04:
```bash
cp apps/lootit/src/lib/auth-storage.js src/lib/auth-storage.js
```
Followed by a commit adding only the new file.

## Note for Plan 04-03 (lootit api/client wiring)

Plan 04-03 will import this adapter and wire it into Supabase's `createClient` config:
```javascript
import { createAuthStorage } from '@/lib/auth-storage';
// ...
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storage: createAuthStorage(),   // ← single-line change from portalit's client.js
  },
  // ...rest unchanged
});
```

The factory call is deliberate — do NOT pass the module default export as `storage`, because that instantiates at module-load time before `window`/`document` exist in unusual test environments. Call the factory inside the `createClient` invocation so any fresh tab gets a fresh adapter with the current global environment.

## Known Stubs

None. The file is production-complete and testable.

## Self-Check: PASSED

**File existence:**
- `apps/lootit/src/lib/auth-storage.js` — FOUND (167 lines)

**Commits:**
- `2e83e74` — FOUND (`feat(04-02): add cookie+localStorage Supabase auth storage adapter`)

**Acceptance criteria:** 17/17 grep checks pass, smoke test prints `auth-storage smoke test PASS` with exit code 0.
