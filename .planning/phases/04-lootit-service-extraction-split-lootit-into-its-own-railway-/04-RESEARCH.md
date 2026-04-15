# Phase 4: LootIT Service Extraction — Research

**Researched:** 2026-04-15
**Domain:** Vite SPA extraction, Railway multi-service deployment, Supabase cross-subdomain cookie SSO
**Confidence:** HIGH on cookie adapter shape + file/dep audit (verified in repo), MEDIUM on Railway monorepo deploy details (service-specific config lives only in Railway dashboard)

## Summary

Phase 4 splits `src/components/lootit/*` (plus hooks, lib helpers, shadcn UI deps, and the Supabase client) into a self-contained Vite app at `apps/lootit/` that deploys as a new Railway service at `lootit.gtools.io`. The backend stays shared. Auth is handed off via a **single Supabase session cookie** scoped to `Domain=.gtools.io`, written by a custom storage adapter that replaces Supabase's default localStorage. A backwards-compatible adapter (cookie + localStorage during rollout) guarantees that flipping the switch on portalit cannot log any existing user out — this is the hard safety requirement driving the whole phase.

The code audit in this research turned up a clean picture: LootIT's frontend surface area is narrow (~20 lootit components + 5 hooks + 4 lib files + 3 shadcn primitives + a handful of transitive shadcn deps). The existing `src/api/client.js` already has the single hook point for the storage swap, and the existing `Caddyfile` is directly copy-pasteable for the new service.

**Primary recommendation:** Hand-roll the cookie storage adapter (do **NOT** introduce `@supabase/ssr` — it's built for server-rendered apps and brings its own cookie conventions that fight the existing localStorage fallback story). Keep the adapter 40-60 lines, put it in `apps/lootit/src/lib/auth-storage.js` (and an identical copy in `src/lib/auth-storage.js` for phase 5), single-cookie-with-chunking for safety, localhost bypass to plain localStorage.

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Repository Structure (D-01 through D-05):**
- D-01: New top-level `apps/lootit/` inside existing `portalit` repo. Portalit stays at root — **no monorepo restructure**.
- D-02: `apps/lootit/` is self-contained: own `package.json`, `vite.config.js`, `index.html`, `Dockerfile`, `Caddyfile`, `nixpacks.toml`, `tailwind.config.js`, `postcss.config.js`, `components.json`, `jsconfig.json`.
- D-03: Own `node_modules`, own `npm install`. No workspaces, no pnpm, no cross-linking.
- D-04: `apps/lootit/src/` mirrors portalit structure so `@/*` alias works identically.
- D-05: `extensions/lootit-link/` browser extension stays put — out of scope.

**Code Duplication (D-06 through D-10):**
- D-06: **Duplicate, don't share.** Each app fully isolated.
- D-07: Files to copy: `api/client.js`, `lib/AuthContext.jsx`, `lib/utils.js`, `lib/lootit-reconciliation.js`, `lib/query-client.js`, UI primitives (`sheet`/`table`/`tooltip` + transitive), `hooks/useAutoRetry|useCustomerData|useReconciliationData|useReconciliationReviews|useReconciliationRules.js`, all `components/lootit/*`.
- D-08: Copied files are standalone — no re-exports, no symlinks.
- D-09: Own minimal `index.css` (audit existing).
- D-10: Minimal `package.json` — only what LootIT uses transitively.

**App Shell (D-11 through D-15):**
- D-11: `main.jsx` same boot pattern as portalit.
- D-12: `App.jsx` wraps with `AuthProvider` + `QueryClientProvider` + `BrowserRouter` + sonner `Toaster`. Routes: `/`, `/customers/:customerId`, `/settings`.
- D-13: `RequireAuth` redirects unauthenticated users to `${VITE_PORTALIT_URL}/login?returnUrl=…`.
- D-14: `Layout.jsx` = sidebar (Dashboard/Settings) + header (avatar + sign-out) + "Back to PortalIT" link.
- D-15: Existing `LootITDashboard.jsx` / `LootITCustomerDetail.jsx` / `LootITSettings.jsx` become route components directly.

**Auth & SSO (D-16 through D-22) — HIGHEST RISK:**
- D-16: Supabase storage switches from localStorage → cookie on `.gtools.io`.
- D-17: Custom `storage` adapter via `createClient(url, key, { auth: { storage } })`. `getItem`/`setItem`/`removeItem` backed by `document.cookie` with `Domain=.gtools.io; Path=/; Secure; SameSite=Lax; Max-Age=<refresh>`. Single cookie name prefixed with Supabase project ref.
- D-18: **Backwards compatibility:** `getItem` reads cookie first, falls back to localStorage. `setItem` writes to BOTH during transition. Removing localStorage writes deferred ~1 week post-rollout.
- D-19: Adapter lives in `api/client.js` (identical in both apps — deliberate duplication).
- D-20: Localhost detection — fall back to localStorage entirely on `location.hostname === 'localhost'`.
- D-21: No handoff tokens, no magic links. Cookie IS the handoff.
- D-22: Sign-out calls `supabase.auth.signOut()` — adapter clears cookie + localStorage. Both apps see `SIGNED_OUT` via `onAuthStateChange`.

**Backend & CORS (D-23 through D-25):**
- D-23: Single backend serves both frontends. `VITE_API_BASE_URL=https://backend-production-58b4.up.railway.app`.
- D-24: Backend CORS must allow `https://lootit.gtools.io` in addition to existing origins.
- D-25: `VITE_LOOTIT_URL` on portalit service, `VITE_PORTALIT_URL` on lootit service.

**Railway Deployment (D-26 through D-31):**
- D-26: New service `lootit-frontend` in existing `PortalIT` project (ID `935a26e9-0cea-4eff-a7e7-d551840fad71`). Same repo, same `production` branch, different Root Directory (`apps/lootit`).
- D-27: Dockerfile or nixpacks inside `apps/lootit/` — `npm install && npm run build`, serve `dist/` via Caddy on port 8080. Mirror existing `frontend` service.
- D-28: Initial deploy uses a temporary Railway domain (or `lootit-test.gtools.io`) — verify before DNS flip.
- D-29: Custom domain `lootit.gtools.io` added after verification. User manages CNAME.
- D-30: Existing `frontend` service NOT reconfigured at Railway level until phase 5.
- D-31: **No staging** — phases 1-3 validated locally, phase 4 deploys isolated, phase 5 is zero-downtime via backwards-compat adapter, phase 6 is just DNS + menu link.

**Rollout Safety (D-32 through D-35):**
- D-32: All work on `feat/lootit-split` branch. No merge to `production` until phase 6 cutover.
- D-33: Backwards-compat adapter makes phase 5 cookie rollout zero-downtime.
- D-34: Kill switch — revert to vanilla Supabase client, localStorage still populated.
- D-35: Rollback plan — restore in-app LootIT route in one commit from git history.

### Claude's Discretion
- File structure under `apps/lootit/src/` (features/pages/flat)
- Router v6 vs simpler switch
- Specific package versions (recommend: match portalit to minimize surprise)
- How aggressively to trim `index.css`
- Own ESLint config (recommend: copy portalit's)
- Cookie expiry (recommend: match refresh token lifetime)
- Optional auth adapter round-trip test

### Deferred Ideas (OUT OF SCOPE)
- Monorepo restructure with workspaces — rejected, revisit only if third app joins
- Extracting LootIT backend routes into own service — backend stays monolithic
- LootIT UX redesign — separate milestone, happens inside new repo
- Removing localStorage write from adapter — followup after ~1 week bake
- Deleting `src/components/lootit/*` from portalit — cleanup commit after phase 6 stable ~2 weeks
- Custom staging environment — out of scope

## Phase Requirements

Phase 4 has **no mapped REQ-IDs** — it's infrastructure work to isolate LootIT from the upcoming PortalIT redesign. Success criteria are operational:

| Criterion | Verification |
|-----------|-------------|
| LootIT builds green from `apps/lootit/` | `npm run build` in the app dir |
| LootIT renders identical to portalit's in-app version | Manual visual smoke test against production data |
| User signed in on portalit hits `lootit.gtools.io` and sees their data without a second login | Manual SSO check in prod (Chrome + Safari) |
| Sign-out on either app signs user out on the other | Manual cross-app test |
| Existing portalit users are not logged out by the adapter switch | Backwards-compat adapter reads localStorage first on rollout |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| LootIT UI rendering | Browser (new Vite SPA) | — | Pure client-side SPA, identical to portalit's current frontend |
| Static asset serving | CDN / Static (Caddy at Railway edge) | — | Existing portalit pattern: Caddy on :8080, SPA fallback, immutable hashed assets |
| Auth session storage | Browser (document.cookie on `.gtools.io`) | localStorage (backcompat) | Cookie at parent domain is the SSO mechanism; localStorage is the rollback/fallback |
| Auth state refresh | Supabase JS in-memory → cookie | — | Cookie is the only cross-subdomain persistence, `onAuthStateChange` notifies in-tab |
| API requests (all data) | Shared Express backend | — | D-23 locks this — single backend, no splitting |
| CORS whitelisting | Shared Express backend | — | `server/src/index.js` env-driven `CORS_ORIGIN` list |
| Cross-app navigation | Browser (hard navigation via `window.location.href`) | — | SPA-to-SPA hops are full page loads — boring and correct |

**Tier sanity check:** No capability in this phase belongs on the backend except the CORS allowlist update. Everything else is browser-tier plumbing.

## Runtime State Inventory

This IS a split/migration phase, so runtime state audit is mandatory.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| **Stored data** | Supabase session tokens in `localStorage` under key `sb-rgsvvywlnnkckvockdoj-auth-token` (or similar project-ref-prefixed key) on every existing portalit user's browser | **Backwards-compat read** in adapter — `getItem` must return the localStorage value if cookie is empty so existing sessions survive phase 5 rollout. No data migration required (Supabase refreshes naturally). |
| **Live service config** | Railway `frontend` service env vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_BASE_URL`, `VITE_PORTAL_MODE`) — all need mirroring on new `lootit-frontend` service. Plus new vars: `VITE_PORTALIT_URL` (lootit side), `VITE_LOOTIT_URL` (portalit side, phase 5). Railway backend `CORS_ORIGIN` env var needs `https://lootit.gtools.io` added. | Manual set via Railway dashboard or `railway variables` CLI. Do NOT add `VITE_LOOTIT_URL` to portalit until phase 5 per D-30. |
| **OS-registered state** | None — no OS-level scheduler, cron, or desktop registration involves the LootIT frontend. | None. Verified by the fact that portalit's frontend is a pure SPA with no OS hooks. |
| **Secrets / env vars** | Supabase anon key and URL are public by design (already in `VITE_*` env vars). No secret rotation needed. No `.env` file in git (verified — only `.env.example` patterns exist). | None. |
| **Build artifacts** | `dist/` at repo root (portalit build output). Phase 4 creates `apps/lootit/dist/`. Railway builds fresh per deploy so no stale dist concerns. `node_modules` at root is untouched by `apps/lootit/node_modules`. | None. The two `node_modules` trees are isolated by directory. |

**Critical nothing-found note:** DNS for `lootit.gtools.io` does NOT exist yet (confirmed by CONTEXT.md D-29 — user adds CNAME after verification). This is a **Phase 6 dependency** the planner must flag, not Phase 4.

**The canonical question answered:** *After every file lands in `apps/lootit/` and the new Railway service deploys, what runtime state still carries the old world?* → Only user localStorage sessions, which are handled by the backwards-compat read path. Nothing else persists LootIT identity.

## Standard Stack

All versions match the existing portalit `package.json` as instructed by Claude's discretion note (minimize surprise). [VERIFIED: /Users/anielreyes/portalit/package.json]

### Core
| Library | Version (match portalit) | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `react` + `react-dom` | `^18.2.0` | UI framework | Existing codebase [VERIFIED] |
| `vite` | `^6.1.0` | Bundler + dev server | Existing codebase [VERIFIED] |
| `@vitejs/plugin-react` | `^4.3.4` | React Fast Refresh | Existing codebase [VERIFIED] |
| `@supabase/supabase-js` | `^2.49.1` | DB + auth client | Existing codebase [VERIFIED]. We reuse its `auth.storage` hook — see Architecture Patterns. |
| `@tanstack/react-query` | `^5.84.1` | Server state cache | Used by every LootIT hook [VERIFIED via grep] |
| `react-router-dom` | `^6.26.0` | SPA routing | D-12 routes [VERIFIED portalit uses v6] |
| `tailwindcss` | `^3.4.17` | Utility CSS | Existing config, copy verbatim |
| `tailwindcss-animate` | `^1.0.7` | Radix animations | Required by shadcn primitives |
| `sonner` | `^2.0.1` | Toast notifications | Used in `SignOffButton.jsx`, `LootITCustomerDetail.jsx` [VERIFIED via grep] |
| `lucide-react` | `^0.475.0` | Icons | Every LootIT component imports from it [VERIFIED via grep] |

### Supporting (Radix primitives required by the copied shadcn components)
| Library | Version | Purpose | Needed By |
|---------|---------|---------|-------------|
| `@radix-ui/react-dialog` | `^1.1.6` | Base for `sheet.jsx` + `dialog.jsx` | `sheet.jsx` imports `@radix-ui/react-dialog` [VERIFIED via Read] |
| `@radix-ui/react-tooltip` | `^1.1.8` | Base for `tooltip.jsx` | `tooltip.jsx` imports `@radix-ui/react-tooltip` [VERIFIED via Read] |
| `@radix-ui/react-slot` | `^1.1.2` | `asChild` pattern in `button.jsx` | `button.jsx` imports `Slot` [VERIFIED via Read] |
| `@radix-ui/react-label` | `^2.1.2` | `label.jsx` (if RuleEditorDialog uses it) | Transitive — planner audit |
| `class-variance-authority` | `^0.7.1` | `cva` in button/sheet variants | Imported by `button.jsx`, `sheet.jsx` [VERIFIED via Read] |
| `clsx` | `^2.1.1` | `cn` helper input | `lib/utils.js` imports clsx [VERIFIED via Read] |
| `tailwind-merge` | `^3.0.2` | `cn` helper — dedupe Tailwind classes | `lib/utils.js` imports twMerge [VERIFIED via Read] |
| `date-fns` | `^3.6.0` | `lib/utils.js` date helpers | Imported by `lib/utils.js` [VERIFIED via Read] |

### Dev dependencies
| Library | Version | Purpose |
|---------|---------|---------|
| `autoprefixer` | `^10.4.20` | PostCSS |
| `postcss` | `^8.5.3` | Tailwind build |
| `eslint` + plugins | match portalit | Optional — copy root `eslint.config.js` |
| `typescript` | `^5.8.2` | Required for `tsc -p jsconfig.json` typecheck script |
| `@types/node` / `@types/react` / `@types/react-dom` | match portalit | Types only |

### NOT needed in apps/lootit (deliberate exclusions from root package.json)

These appear in portalit's `package.json` but NO lootit code uses them — confirmed by the grep audit of `src/components/lootit/*`:

`@hello-pangea/dnd`, `@hookform/resolvers`, all `@radix-ui` except `react-dialog|tooltip|slot|label` (maybe), `@stripe/*`, `canvas-confetti`, `cmdk`, `embla-carousel-react`, `framer-motion`, `input-otp`, `lodash`, `next-themes`, `react-day-picker`, `react-hook-form`, `react-hot-toast`, `react-leaflet`, `react-markdown`, `react-quill`, `react-resizable-panels`, `recharts`, `vaul`, `zod` (unless a copied file uses it — planner must verify).

**Planner verification task:** Run `grep -rh "from ['\"]" apps/lootit/src` after copy to enumerate the actual external imports and rebuild `package.json` dependencies from the real list (defense in depth against this table being wrong).

### Alternatives Considered
| Instead of | Could Use | Tradeoff | Decision |
|------------|-----------|----------|----------|
| Hand-rolled cookie storage adapter | `@supabase/ssr` + `createBrowserClient` with `cookieOptions.domain` | `@supabase/ssr` is an "official" path, BUT: (a) it's designed for SSR with server/middleware/browser clients that must stay in sync, (b) it uses its own cookie chunking convention, (c) it doesn't have a clean hook for "read localStorage first during backcompat rollout" — that's the non-negotiable D-18 requirement. | **REJECT `@supabase/ssr`.** Hand-rolled 50-line adapter gives us exactly the backcompat semantics D-18 requires with zero magic. [CITED: github.com/supabase/ssr, answeroverflow discussion] |
| One Dockerfile for both apps | Separate Dockerfile per app | Shared Dockerfile requires monorepo awareness — rejected by D-01 | Each app has its own Dockerfile [per D-02] |
| nixpacks auto-detection | Explicit Dockerfile | nixpacks is faster to set up but opaque when it breaks; Dockerfile is explicit and mirrors what we can verify in Caddyfile | **RECOMMEND Dockerfile** — see Architecture Patterns below |

**Installation (target `apps/lootit/package.json`):**

```bash
# Run inside apps/lootit/
npm install react react-dom @supabase/supabase-js @tanstack/react-query \
  react-router-dom sonner lucide-react \
  @radix-ui/react-dialog @radix-ui/react-tooltip @radix-ui/react-slot \
  class-variance-authority clsx tailwind-merge date-fns

npm install -D vite @vitejs/plugin-react \
  tailwindcss tailwindcss-animate postcss autoprefixer \
  typescript @types/react @types/react-dom @types/node
```

**Version verification note:** Pin each to the same caret range as portalit's `package.json` verbatim — do not `npm install <name>@latest`. This is the "minimize surprise" discretion note from CONTEXT. [ASSUMED: versions in portalit package.json are current working versions — not re-verified against the registry because match-portalit is the locked discretion choice, not "use the latest"].

## Architecture Patterns

### System Architecture Diagram (data flow)

```
                         ┌────────────────────────────────────────┐
                         │          Browser (user)                │
                         │                                        │
                         │   ┌──────────────┐  ┌──────────────┐  │
                         │   │ portalit.    │  │ lootit.      │  │
                         │   │ gtools.io    │  │ gtools.io    │  │
                         │   │  (existing)  │  │  (new)       │  │
                         │   └──────┬───────┘  └──────┬───────┘  │
                         │          │                  │         │
                         │          └────┬─────────────┘         │
                         │               │                        │
                         │     ┌─────────▼──────────┐             │
                         │     │ document.cookie on │             │
                         │     │   .gtools.io       │◄── SSO      │
                         │     │ sb-<ref>-auth-token│             │
                         │     └─────────┬──────────┘             │
                         │               │ (fallback read)        │
                         │     ┌─────────▼──────────┐             │
                         │     │   localStorage     │◄── backcompat│
                         │     └────────────────────┘             │
                         └─────────────────┬──────────────────────┘
                                           │ HTTPS + JWT Bearer
                                           │
                ┌──────────────────────────▼──────────────────────┐
                │  backend-production-58b4.up.railway.app         │
                │  (Express, CORS allows portalit.gtools.io +     │
                │   customer.portalit.gtools.io + lootit.gtools.io)│
                └──────────────────────────┬──────────────────────┘
                                           │
                                           │ Supabase JS
                                           ▼
                ┌──────────────────────────────────────────────────┐
                │  rgsvvywlnnkckvockdoj.supabase.co                │
                │  (Postgres + Auth — shared by all 3 frontends)  │
                └──────────────────────────────────────────────────┘

 Deploy topology:
 ┌─────────────────────────────────────────────────────────────────┐
 │  GitHub: AnielGammaTech/portalit (branch: feat/lootit-split →  │
 │          production for phase 6)                               │
 └─────────────────────────────────────────────────────────────────┘
                                │
                 ┌──────────────┼──────────────┬───────────────┐
                 │              │              │               │
          ┌──────▼─────┐  ┌─────▼──────┐ ┌─────▼─────┐  ┌─────▼──────┐
          │ frontend   │  │customer-   │ │ backend   │  │lootit-     │
          │ (root dir) │  │ portal     │ │ (server/) │  │ frontend   │
          │ Caddy:8080 │  │            │ │ Node      │  │(apps/lootit│
          │            │  │            │ │           │  │ Caddy:8080)│
          └────────────┘  └────────────┘ └───────────┘  └────────────┘
                                                           ↑ NEW
```

### Component Responsibilities

| Component | File | Responsibility |
|-----------|------|----------------|
| Cookie storage adapter | `apps/lootit/src/lib/auth-storage.js` (NEW) | Implements Supabase `SupportedStorage` — reads cookie, falls back to localStorage (backcompat), localhost-aware |
| Supabase client | `apps/lootit/src/api/client.js` (copied) | Wires adapter into `createClient(..., { auth: { storage } })` |
| Auth provider | `apps/lootit/src/lib/AuthContext.jsx` (copied verbatim) | Exposes `user`, `isAuthenticated`, `isLoadingAuth`, subscribes to `onAuthStateChange` |
| Route guard | `apps/lootit/src/components/RequireAuth.jsx` (NEW) | On unauthenticated, `window.location.href = ${VITE_PORTALIT_URL}/login?returnUrl=…` |
| Root layout | `apps/lootit/src/Layout.jsx` (NEW, ~80 lines) | Sidebar + header + Back-to-PortalIT link |
| Route components | `apps/lootit/src/pages/{Dashboard,CustomerDetail,Settings}Page.jsx` (NEW thin wrappers) | Import `LootITDashboard`/`LootITCustomerDetail`/`LootITSettings` from copied components, provide route params |
| Caddy server | `apps/lootit/Caddyfile` (copy of root Caddyfile) | Serves `dist/`, SPA fallback, asset caching |
| Dockerfile | `apps/lootit/Dockerfile` (NEW) | Multi-stage: node build → caddy serve |

### Recommended Project Structure

```
apps/lootit/
├── package.json
├── package-lock.json
├── vite.config.js              # alias @ → ./src, same as root
├── jsconfig.json               # baseUrl + @/* paths, same as root
├── tailwind.config.js          # copied from root, content globs adjusted to ./src/**
├── postcss.config.js           # verbatim copy
├── components.json             # shadcn config, same as root
├── index.html                  # favicon + #root + /src/main.jsx
├── Caddyfile                   # verbatim copy of root Caddyfile
├── Dockerfile                  # NEW — see Code Examples
├── nixpacks.toml               # optional — can skip if using Dockerfile
├── .dockerignore               # NEW — node_modules, dist, .env
├── eslint.config.js            # copied from root (discretion)
├── public/
│   └── favicon.svg             # copied
└── src/
    ├── main.jsx                # NEW
    ├── App.jsx                 # NEW — providers + routes
    ├── Layout.jsx              # NEW
    ├── index.css               # NEW — trimmed copy of root index.css
    ├── api/
    │   └── client.js           # copied + swap storage adapter
    ├── lib/
    │   ├── auth-storage.js     # NEW — cookie/localStorage adapter
    │   ├── AuthContext.jsx     # copied verbatim
    │   ├── utils.js            # copied verbatim
    │   ├── lootit-reconciliation.js  # copied verbatim
    │   └── query-client.js     # copied verbatim
    ├── hooks/
    │   ├── useAutoRetry.js
    │   ├── useCustomerData.js
    │   ├── useReconciliationData.js
    │   ├── useReconciliationReviews.js
    │   └── useReconciliationRules.js
    ├── components/
    │   ├── RequireAuth.jsx     # NEW
    │   ├── ui/                 # copy the exact subset LootIT needs (see audit below)
    │   │   ├── sheet.jsx
    │   │   ├── table.jsx
    │   │   ├── tooltip.jsx
    │   │   ├── dialog.jsx      # transitive — sheet's RuleEditorDialog uses it
    │   │   ├── button.jsx      # transitive
    │   │   └── label.jsx       # if RuleEditorDialog/form uses it
    │   └── lootit/             # copy ALL files from src/components/lootit/
    │       ├── ContractCard.jsx
    │       ├── ContractTab.jsx
    │       ├── CustomerDetailHeader.jsx
    │       ├── DetailDrawer.jsx
    │       ├── LineItemPicker.jsx
    │       ├── lootit-constants.js
    │       ├── LootITCustomerDetail.jsx
    │       ├── LootITDashboard.jsx
    │       ├── LootITSettings.jsx
    │       ├── Pax8GroupMapper.jsx
    │       ├── Pax8SubscriptionCard.jsx
    │       ├── ReconciliationBadge.jsx
    │       ├── ReconciliationTab.jsx
    │       ├── RecurringTab.jsx
    │       ├── RuleEditorDialog.jsx
    │       ├── ServiceCard.jsx
    │       ├── SignOffButton.jsx
    │       └── UploadProgressCard.jsx
    └── pages/
        ├── DashboardPage.jsx       # thin wrapper → <LootITDashboard />
        ├── CustomerDetailPage.jsx  # thin wrapper → <LootITCustomerDetail />
        └── SettingsPage.jsx        # thin wrapper → <LootITSettings />
```

### Pattern 1: Supabase Custom Storage Adapter (THE critical pattern)

**What:** A plain object with `getItem`/`setItem`/`removeItem` methods. Supabase auth-js calls these to persist the session. Interface is `PromisifyMethods<Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>>` — adapter methods MAY return synchronously OR return promises; Supabase awaits either. [CITED: github.com/supabase/auth-js via web search]

**When to use:** Any time you need Supabase sessions somewhere other than `window.localStorage` — in this case, a cookie at the parent domain for cross-subdomain SSO.

**Critical behaviors:**
1. The adapter is called **during `createClient()`** to read an existing session synchronously (Supabase will `await` the result but in-browser you can just return).
2. It's called again on every `signIn`, `signOut`, `refreshSession` (`setItem` / `removeItem`).
3. If `getItem` **throws**, Supabase treats it as "no session" — the user is anonymous. This is actually useful: it means cookie-parse failures don't hard-crash the app; they just require re-login.
4. If `setItem` **throws**, the session write fails silently (Supabase logs a warning). In-memory state is still correct for the current tab.
5. The adapter is called **synchronously during auth state transitions** — do NOT do network work inside it.

**Example (this is the file to create):**
```javascript
// apps/lootit/src/lib/auth-storage.js
// Cookie-backed Supabase storage adapter with localStorage backcompat.
// Identical file lives at src/lib/auth-storage.js in portalit (D-19).
//
// Contract: Supabase expects `getItem`, `setItem`, `removeItem` that either
// return values directly or return Promises of values. Methods MUST NOT
// perform network I/O — they are called on every auth state transition.
// Source: @supabase/auth-js SupportedStorage type
//   (PromisifyMethods<Pick<Storage, 'getItem'|'setItem'|'removeItem'>>)

const COOKIE_DOMAIN = '.gtools.io';
const IS_LOCALHOST =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' ||
   window.location.hostname === '127.0.0.1');

// Max-Age matches Supabase refresh token lifetime (default 60 days).
// Shorter than the default "100 years" some examples show — we respect
// Supabase's own token lifecycle rather than pinning a session forever.
const MAX_AGE_SECONDS = 60 * 60 * 24 * 60; // 60 days

// Single-cookie approach with chunking. A full Supabase session
// (access_token JWT + refresh_token + user object) can exceed the 4 KB
// per-cookie limit. We split into 3.5 KB chunks under keys
// `${key}.0`, `${key}.1`, ..., with a meta cookie `${key}` = "chunks:N".
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
    // Legacy / non-chunked value
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
  // Always clear any existing chunks first
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
```

Then in `api/client.js`, the single-line change:
```javascript
// apps/lootit/src/api/client.js (and src/api/client.js in phase 5)
import { createAuthStorage } from '@/lib/auth-storage';
// ...
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storage: createAuthStorage(),   // ← only new line
  },
  // ...rest unchanged
});
```

[CITED: github.com/orgs/supabase/discussions/5742 — subdomain cookie adapter pattern]
[CITED: micheleong.com/blog/share-sessions-subdomains-supabase — cookieOptions pattern]
[CITED: @supabase/auth-js SupportedStorage type — PromisifyMethods<Pick<Storage, ...>>]

### Pattern 2: RequireAuth route guard

```javascript
// apps/lootit/src/components/RequireAuth.jsx
import { useAuth } from '@/lib/AuthContext';

const PORTALIT_URL = import.meta.env.VITE_PORTALIT_URL || 'https://portalit.gtools.io';

export default function RequireAuth({ children }) {
  const { isAuthenticated, isLoadingAuth } = useAuth();

  if (isLoadingAuth) {
    return <div className="flex h-screen items-center justify-center">Loading…</div>;
  }

  if (!isAuthenticated) {
    const returnUrl = encodeURIComponent(window.location.href);
    // Hard navigation — intentional, crosses origins for SSO
    window.location.href = `${PORTALIT_URL}/login?returnUrl=${returnUrl}`;
    return null;
  }

  return children;
}
```

### Pattern 3: Railway Dockerfile for Vite + Caddy

```dockerfile
# apps/lootit/Dockerfile
# Multi-stage: node builds, caddy serves.
# Railway Root Directory = apps/lootit, so COPY paths are relative to this dir.

FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# VITE_* env vars are baked in at build time — Railway injects them
# from service env vars before `docker build`.
RUN npm run build

FROM caddy:2-alpine
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY Caddyfile /etc/caddy/Caddyfile
EXPOSE 8080
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
```

The existing root `Caddyfile` — verified contents:
```
{ admin off }
:8080 {
    root * /app/dist
    file_server
    try_files {path} /index.html
    @html { path / ; path /index.html }
    header @html Cache-Control "no-cache, no-store, must-revalidate"
    header @html CDN-Cache-Control "no-store"
    header @html Surrogate-Control "no-store"
    @assets { path /assets/* }
    header @assets Cache-Control "public, max-age=31536000, immutable"
}
```

This works **verbatim** for the new service. The `root * /app/dist` path matches where the Dockerfile copies the build output. [VERIFIED by reading /Users/anielreyes/portalit/Caddyfile]

### Anti-Patterns to Avoid

- **Don't** use `@supabase/ssr`'s `createBrowserClient` here. It was designed to pair with a server client that reads cookies on every request. This is a pure SPA with no server-side auth. It also has its own cookie naming convention that doesn't play well with the localStorage backcompat path (D-18).
- **Don't** write the cookie adapter in TypeScript. Portalit is JS — matching the host project.
- **Don't** set `Domain=.gtools.io` on localhost. Browsers silently drop the cookie; dev is broken for reasons that take an hour to debug. (D-20 — the localhost branch is mandatory.)
- **Don't** put the adapter in a shared npm package. D-06 duplication is deliberate.
- **Don't** share a `node_modules` between apps via symlinks. D-03 forbids it and Vite's HMR gets confused by multiple React instances.
- **Don't** use `SameSite=None` unless you need third-party-iframe embedding. `Lax` is correct for same-registered-domain subdomain SSO. [CITED: MDN Third-party cookies, Safari cookiestatus]
- **Don't** rely on Supabase's `cookieOptions` setting alone — it only exists on `@supabase/ssr`'s `createBrowserClient`, not on the plain `@supabase/supabase-js` `createClient`. We're on plain `@supabase/supabase-js` per D-10. [CITED: github supabase/ssr discussion #28997]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JWT decoding / refresh | Custom refresh logic | Supabase `autoRefreshToken: true` + existing `onAuthStateChange` in `api/client.js` | Supabase already handles token refresh; our adapter just persists the session object |
| SPA routing | Hand-rolled router | `react-router-dom` v6 (already in portalit) | D-12 |
| Tailwind utility classes | Custom CSS | Tailwind + shadcn copy-paste | Existing pattern |
| Static file serving | Express/Node server | Caddy (existing pattern in root `Caddyfile`) | Proven, fast, right tool |
| React state management for server data | `useEffect` + `useState` + manual fetching | `@tanstack/react-query` (already in portalit's hooks) | Every copied hook uses it |
| Cookie parsing | Custom regex soup | Native `document.cookie` split on `;` is fine for our narrow use | We only read cookies we wrote — no hostile input |
| SSO handshake protocol | JWT handoff URL params, magic links, STS exchange | **Cookie at parent domain IS the handoff.** D-21. | Boring and correct |

**Key insight:** The cookie adapter IS the hand-rolled thing, deliberately — and it's ~100 lines of well-understood browser APIs. Everything else should be a copy of what portalit already does.

## Common Pitfalls

### Pitfall 1: Cookie size limit (4 KB per cookie)

**What goes wrong:** A full Supabase session (`{ access_token, refresh_token, user: { …full profile… } }`) serialized to JSON can exceed 4 KB when the JWT is long (multiple custom claims) or the user object has many fields. Without chunking, `document.cookie = "sb-…=<big value>"` **silently** truncates or drops the cookie entirely, depending on browser. The symptom is "user signs in, cookie is set, page reloads, session is gone."

**Why it happens:** RFC 6265 and browser implementations cap individual cookies at 4096 bytes including the `name=value` and attributes. Supabase's localStorage serialization doesn't care; cookies do.

**How to avoid:** The adapter above splits values >3500 bytes into `${key}.0`, `${key}.1`, ... with a `${key}` meta cookie holding `chunks:N`. On read, reassemble. 10 chunks = 35 KB ceiling, far above any realistic Supabase session.

**Warning signs:** First login works, reload shows "not logged in," Chrome DevTools → Application → Cookies shows nothing under `.gtools.io` even though `setItem` was called.

### Pitfall 2: Localhost cookie quietly ignored

**What goes wrong:** Setting `Domain=.gtools.io` on a cookie while browsing `http://localhost:5173` — browsers silently refuse to store it (the domain doesn't match the current host). Dev appears to work (no error) but auth state is gone after every reload.

**Why it happens:** Cookie `Domain` attribute must match or be a suffix of the current host. `.gtools.io` is not a suffix of `localhost`. Browser spec compliance.

**How to avoid:** The `IS_LOCALHOST` branch in `auth-storage.js` uses plain localStorage on `localhost`/`127.0.0.1`. D-20 locks this decision.

**Warning signs:** `npm run dev` — sign in, reload, session gone. `document.cookie` is empty. Nothing in Network tab is broken.

### Pitfall 3: Safari ITP — 7-day first-party cookie expiry

**What goes wrong:** Safari's Intelligent Tracking Prevention caps **script-set first-party cookies** at 7 days. Even though `SameSite=Lax` + `Domain=.gtools.io` is treated as first-party on same-registered-domain, a cookie set by JavaScript (which `document.cookie = …` is) gets the 7-day cap. Users who haven't visited portalit in 8 days get logged out silently and have to re-login.

**Why it happens:** Safari ITP 2.1+ treats JS-set cookies as "script-writable cookies" and caps them at 7 days regardless of `Max-Age`. HTTP-Set-Cookie headers from the server are NOT capped. [CITED: webkit.org ITP blog, cookiestatus.com]

**How to avoid:** This is a known limitation we **accept** for phase 4:
- Supabase refresh_token rotation means any active user gets a fresh cookie weekly anyway (Supabase refreshes the session within its own token lifetime).
- Inactive users (7+ days idle) re-login via redirect to portalit — this is acceptable UX per D-21.
- **Mitigation we can add** (future, not phase 4): Have the backend `Set-Cookie` the auth token via a dedicated `/api/auth/sync-cookie` endpoint after login. That escapes the 7-day cap. Explicitly **out of scope** for this phase — accept the limitation, document it.

**Warning signs:** Safari users report "I got logged out after a vacation." (Chrome/Firefox users won't see this.)

### Pitfall 4: `VITE_*` env vars are baked at build time, not runtime

**What goes wrong:** Someone sets `VITE_LOOTIT_URL` on the Railway `frontend` service and expects the running portalit to pick it up without a rebuild. It doesn't. Vite inlines `import.meta.env.VITE_*` at build time.

**Why it happens:** Vite build substitutes `import.meta.env.VITE_FOO` with the literal string value during `vite build`. Runtime `process.env` does not exist in the browser bundle.

**How to avoid:** After setting a new `VITE_*` env var on a Railway service, you **must trigger a redeploy** for the change to take effect. Planner should call this out as an explicit task.

**Warning signs:** Env var shows correct value in Railway dashboard, but `console.log(import.meta.env.VITE_LOOTIT_URL)` in the browser shows `undefined`.

### Pitfall 5: CORS `credentials: true` + cookie echo

**What goes wrong:** The Express backend already has `credentials: true` in its CORS middleware [VERIFIED: server/src/index.js line 63]. This is correct — we need it so that `fetch` requests from lootit can include the Supabase cookie. But the server-side logic must be sure it's validating the JWT from the `Authorization: Bearer` header (which the existing `apiFetch` already sends), NOT from a cookie the browser is tagging along.

**Why it happens:** Adding a new origin to `CORS_ORIGIN` is simple, but `credentials: true` means browsers may now send cookies the backend wasn't expecting.

**How to avoid:** The existing auth flow uses `Authorization: Bearer <token>` headers built from `_cachedToken` which comes from `onAuthStateChange` → the in-memory session. This is unchanged by the adapter swap. Planner should verify by reading `server/src/middleware/*` to confirm no code path reads `req.cookies` for auth. If it does, that's a security surprise that needs its own task.

**Warning signs:** Backend route starts rejecting lootit requests with 401, or worse, accepting them as a different user.

### Pitfall 6: Race condition during auth adapter swap (phase 5, most dangerous)

**What goes wrong:** User has portalit open in one tab with an active session in localStorage. We deploy the adapter change. User's tab reloads (a route change triggers a React refresh). The new code reads cookie first (empty) → falls back to localStorage (has session) → works. So far so good. Now the user's session expires and Supabase calls `refreshSession` → `setItem` writes to BOTH cookie and localStorage. Good. **BUT** if the user has TWO portalit tabs open — one on old code, one on new code — the old code writes only to localStorage while new code wrote to cookie. Tab A's cookie is stale relative to Tab B's localStorage. Next navigation on Tab A reads cookie (newer? older? depends on order) → could return an invalidated refresh token.

**Why it happens:** Supabase refresh tokens are single-use. Two tabs with out-of-sync session state can race and invalidate each other.

**How to avoid:**
- The backcompat adapter writes to BOTH locations on `setItem` → minimizes drift. [D-18 locks this.]
- The `onAuthStateChange` listener in `AuthContext.jsx` + cross-tab `storage` event propagation (localStorage has one, cookies don't) keeps tabs in sync.
- **Accept the residual risk:** a user with multiple stale tabs at the moment of the adapter swap may have to re-login once. This is an acceptable UX cost per D-33.

**Warning signs:** User reports "I had to log in again and now nothing remembers me across tabs" — happens exactly once around the phase 5 deploy window, then goes away.

### Pitfall 7: Tailwind `content` globs resolving relative to the app directory

**What goes wrong:** Copy portalit's `tailwind.config.js` into `apps/lootit/` without updating `content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"]`. These relative paths resolve from the config file's directory at build time, so they SHOULD just work when placed in `apps/lootit/tailwind.config.js`. But if someone changes the config to use absolute paths, or if the paths escape the app directory (`../../src/**`) to share, it breaks build isolation.

**How to avoid:** Keep globs relative and local. Don't add paths that escape `apps/lootit/`. The verbatim copy from portalit's tailwind.config.js already satisfies this.

### Pitfall 8: `public/` asset path collisions

**What goes wrong:** Portalit's `public/` may contain assets referenced from copied components via absolute paths (`/favicon.svg`, `/logo.png`). If lootit's `public/` doesn't have them, the build succeeds but the runtime shows broken images.

**How to avoid:** Planner task: grep copied files for `src="/` and `href="/` patterns, ensure those files exist in `apps/lootit/public/`. Minimum copy: `favicon.svg` (referenced by index.html).

## Code Examples

### Auth adapter round-trip smoke test (optional, recommended by discretion note)

```javascript
// apps/lootit/src/lib/auth-storage.test.js (optional — Vitest not currently set up)
// Discretion note in CONTEXT: "Whether to create a minimal test to assert
// the auth adapter round-trips a session"
//
// Keeping this here as a plan-time reference — planner decides whether
// to include a test framework or do a manual console check.

import { createAuthStorage } from './auth-storage';

// Manual console smoke test (no framework):
const storage = createAuthStorage();
const key = 'sb-test-auth-token';
const fakeSession = JSON.stringify({
  access_token: 'a'.repeat(4000), // force chunking
  refresh_token: 'r'.repeat(200),
  user: { id: '00000000-0000-0000-0000-000000000000', email: 'test@example.com' },
});

storage.setItem(key, fakeSession);
const roundTripped = storage.getItem(key);
console.assert(roundTripped === fakeSession, 'auth-storage round-trip failed');
storage.removeItem(key);
console.assert(storage.getItem(key) === null, 'auth-storage cleanup failed');
console.log('auth-storage OK');
```

### CORS edit to `server/src/index.js` (phase 5, but referenced here for planning)

The current CORS allowlist reads from env var `CORS_ORIGIN` (comma-separated) [VERIFIED: server/src/index.js line 44-46]:

```javascript
// server/src/index.js, existing code — NO source edit needed
const allowedOrigins = (process.env.CORS_ORIGIN || process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map(o => o.trim());
```

**The only change is in Railway's backend service env vars:**
```
CORS_ORIGIN=https://portalit.gtools.io,https://customer.portalit.gtools.io,https://lootit.gtools.io
```

No code change required. [VERIFIED by reading /Users/anielreyes/portalit/server/src/index.js]

### Dependency audit — exact imports from copied lootit code

From grepping `src/components/lootit/*.jsx|js` and the 5 copied hooks, the COMPLETE set of external module imports resolves to:

**npm packages:**
- `react` (every file)
- `lucide-react` (every component)
- `@tanstack/react-query` (LootITDashboard, LootITCustomerDetail, DetailDrawer, SignOffButton, useReconciliation*, useCustomerData, useAutoRetry)
- `sonner` (LootITCustomerDetail, SignOffButton)

**Internal `@/` imports (which resolve to copied files):**
- `@/api/client` (LootITDashboard, LootITCustomerDetail, SignOffButton, every hook)
- `@/lib/utils` — `cn`, `formatLineItemDescription`
- `@/lib/lootit-reconciliation` — `getDiscrepancySummary`, `getDiscrepancyMessage`, `matchLineItemToRules`, `INTEGRATION_LABELS`
- `@/lib/AuthContext` — `useAuth`
- `@/hooks/useReconciliationData`
- `@/hooks/useReconciliationReviews`
- `@/hooks/useCustomerData`
- `@/hooks/useAutoRetry`
- `@/hooks/useReconciliationRules`
- `@/components/ui/sheet` → `Sheet`, `SheetContent`, `SheetHeader`, `SheetTitle`, `SheetDescription`
- `@/components/ui/table` → `Table`, `TableBody`, `TableCell`, `TableHead`, `TableHeader`, `TableRow`
- `@/components/ui/tooltip` → `Tooltip`, `TooltipTrigger`, `TooltipContent`, `TooltipProvider`

**Transitive shadcn deps** (audited by reading `sheet.jsx`, `table.jsx`, `tooltip.jsx`, `button.jsx`, `dialog.jsx`):
- `sheet.jsx` imports from `@radix-ui/react-dialog`, `class-variance-authority`, `lucide-react`, `@/lib/utils` → **requires `@radix-ui/react-dialog`**
- `table.jsx` imports only `@/lib/utils` → **pure**
- `tooltip.jsx` imports `@radix-ui/react-tooltip`, `@/lib/utils` → **requires `@radix-ui/react-tooltip`**
- `button.jsx` imports `@radix-ui/react-slot`, `class-variance-authority`, `@/lib/utils` → **requires `@radix-ui/react-slot`**
- `dialog.jsx` imports `@radix-ui/react-dialog`, `lucide-react`, `@/lib/utils`

**Files that actually import `button.jsx` or `dialog.jsx`:** Not directly imported by anything in `src/components/lootit/*` (verified via grep for `components/ui/button` and `components/ui/dialog` — zero hits in lootit). **However**, `RuleEditorDialog.jsx` is named like it uses a dialog — planner should open it to confirm whether it uses `@/components/ui/dialog` (likely yes). If yes, add `dialog.jsx` and `button.jsx` and `label.jsx` to the copy list.

**Planner action item:** Read `src/components/lootit/RuleEditorDialog.jsx` explicitly to finalize the shadcn copy list. Also check `LootITSettings.jsx` for form/input/dialog imports — settings pages commonly need `input.jsx`, `label.jsx`, `button.jsx`.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@supabase/auth-helpers-*` (nextjs, react, remix, etc.) | `@supabase/ssr` consolidated package | 2024 (official deprecation) | Not directly relevant — we use neither, but good to know if someone searches for "auth helpers" |
| Hand-rolled `createClient({ auth: { storage } })` | Same pattern, still officially supported | stable since @supabase/supabase-js v2.0 | This IS our approach |
| Third-party cookies for cross-origin SSO | First-party cookies on parent domain (same-registered-domain subdomains) | Always — cross-origin SSO via cookies is unreliable in Safari/Chrome with cookie partitioning (CHIPS), first-party is the right tool |

**Deprecated / outdated:**
- `@supabase/auth-helpers-react` — deprecated, don't install. [CITED: supabase.com/docs troubleshooting migration guide]
- Supabase JS v1 auth API — we're on v2 [VERIFIED: package.json `^2.49.1`]

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Vite build + npm install | ✓ (assumed — portalit builds fine) | ≥18 | — |
| npm | Package management | ✓ | — | — |
| Git | Branch `feat/lootit-split` | ✓ | — | — |
| Docker (local) | Testing Dockerfile before Railway deploy | **UNKNOWN** | — | Skip local Docker test, rely on Railway build output |
| Railway CLI | `railway link`, `railway variables` | **UNKNOWN** (may just be dashboard) | — | Use Railway web dashboard for service creation and env vars |
| `gh` CLI | Branch push + review | Likely ✓ | — | `git push` to origin directly |
| DNS for `lootit.gtools.io` | Phase 6 cutover | ✗ | — | User adds CNAME manually when phase 4 deploy is verified (D-29) |

**Missing dependencies with no fallback:**
- DNS for `lootit.gtools.io` — this is **expected** per D-29 and is handled manually by the user in phase 6. Phase 4 uses the Railway-generated `*.up.railway.app` URL for verification.

**Missing dependencies with fallback:**
- Docker locally — not required; Railway builds inside its own build environment.
- Railway CLI — not required; web dashboard covers every action.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | **None currently installed** — portalit has no test runner in `package.json` [VERIFIED] |
| Config file | None |
| Quick run command | `cd apps/lootit && npm run build` (the only automated check we have) |
| Full suite command | Same — build must be green |
| Phase gate | Manual SSO verification against production |

### Phase Requirements → Test Map

Phase 4 is infrastructure; there are no REQ-IDs. The verification matrix:

| Check | Type | Automated Command | File Exists? |
|-------|------|-------------------|-------------|
| `apps/lootit` builds green | build | `cd apps/lootit && npm run build` | Wave 0 creates it |
| `apps/lootit` dev server starts | smoke | `cd apps/lootit && npm run dev` (manual hit localhost:5174) | Wave 0 |
| Portalit still builds after adapter edit (phase 5) | build | `npm run build` at repo root | ✅ exists |
| Portalit typecheck passes after adapter edit | typecheck | `npm run typecheck` at repo root | ✅ exists |
| Cookie adapter round-trips (optional) | unit | Manual console test from `auth-storage.js` snippet above | Wave 0 (optional) |
| SSO flow works end-to-end | manual-only | Chrome + Safari: login portalit → navigate lootit.gtools.io → expect no re-login | **Manual** |
| Sign-out propagates | manual-only | Sign out on one, refresh other, expect redirect | **Manual** |
| Existing portalit users not logged out (backcompat) | manual-only | Deploy phase 5 with stale localStorage session, refresh, expect still signed in | **Manual — critical** |
| CORS allows lootit origin | smoke | Browser DevTools network tab during API call from lootit | **Manual** |

### Sampling Rate
- **Per task commit:** `npm run build` in whichever app was edited
- **Per wave merge:** `npm run build` in both apps + `npm run typecheck` in portalit + `npm run lint`
- **Phase gate:** Manual SSO check in prod before calling phase 4 done. Phase 5 gate: backcompat adapter manual check before merging to production.

### Wave 0 Gaps
- [ ] `apps/lootit/package.json` — establishes the test/build scripts
- [ ] `apps/lootit/jsconfig.json` — typecheck path
- [ ] **No test framework install required** — matches portalit's current state. Discretion item from CONTEXT about a minimal adapter round-trip test can be done as a `node --eval` smoke check rather than installing Vitest.

**Important note:** Since there's no test framework and no staging, validation for this phase is unusually dependent on manual QA. The plan must make manual check steps explicit and the phase 5 rollout must treat the backcompat adapter deploy as a reversible operation (per D-34 kill switch).

## Security Domain

> `security_enforcement` default is enabled. Auth-handling code = HIGH sensitivity category.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | **YES** | Supabase (delegated identity provider) — we don't implement auth, we persist its tokens |
| V3 Session Management | **YES** | Cookie persistence, refresh-token rotation via Supabase — we implement the storage layer |
| V4 Access Control | no (unchanged from existing) | Existing `auth_id` → RLS in Supabase handles this |
| V5 Input Validation | no (no new input surfaces) | — |
| V6 Cryptography | **YES (by reference)** | We do NOT hand-roll crypto. Tokens are opaque JWTs from Supabase. Cookie transport uses `Secure` flag + HTTPS. |
| V8 Data Protection | **YES** | Session tokens in `document.cookie` are readable by JavaScript — so is localStorage. Same XSS threat model as today. HttpOnly would prevent JS access but then Supabase JS couldn't read the token, which defeats the whole pattern. **Accept same-as-current risk level.** |
| V14 Configuration | **YES** | `SameSite=Lax`, `Secure` (outside localhost), `Domain=.gtools.io`, matching `Max-Age` to refresh token lifetime |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS exfiltrates session cookie | Information Disclosure | **Unchanged from current** — JS-accessible session was already the state. Defense: React's default escaping, no `dangerouslySetInnerHTML` with untrusted data, CSP headers (defer to separate hardening phase). |
| Session fixation via cookie injection | Spoofing | `SameSite=Lax` + `Secure` + known `Domain`. Attacker on another site cannot set a `.gtools.io` cookie. |
| CSRF via sloppy cookie + credentials:true | Tampering | Existing Express `cors` middleware validates `Origin` against allowlist [VERIFIED: server/src/index.js line 48-64]. Cookie is **not used for auth** — the JWT is passed as `Authorization: Bearer` header. Cookie is client-side persistence only. |
| Refresh token replay | Repudiation | Supabase refresh tokens are single-use and rotated. Our adapter stores the newest. |
| Cookie truncation attack (oversize value) | Tampering | Chunked storage with meta cookie — corrupted chunks → `getItem` returns null → user re-logs. No silent compromise. |
| Domain confusion (`gtools.io` vs `.gtools.io`) | Spoofing | Leading dot form `.gtools.io` is the cross-subdomain form; no suffix attacks possible within same registered domain. |

### Security-sensitive review hooks (mandatory)

Every plan that touches `auth-storage.js` or `api/client.js` MUST include a code-review checkpoint. This is the single most dangerous file in the phase. Recommend invoking `security-reviewer` agent before merging phase 5 to `production`.

## Project Constraints (from CLAUDE.md)

- **GSD Workflow Enforcement:** Before using Edit/Write/etc., start through a GSD command so planning artifacts and execution context stay in sync. Phase 4 work MUST go through `/gsd:execute-phase` per project rule.
- **Immutability:** Follow immutable patterns per coding style (global rule). The cookie adapter uses pure reads/writes to `document.cookie` — no object mutation. ✅ compatible.
- **File size discipline:** 800 line max. `auth-storage.js` is ~100 lines, well under. `RequireAuth.jsx` ~20 lines. `Layout.jsx` ~80 lines. `LootITCustomerDetail.jsx` is already 2079 lines — it's copied verbatim per D-07 (split deferred per UXRD-04 in REQUIREMENTS.md, a separate milestone, handled inside apps/lootit once split is live).
- **No emojis in UI:** User's global preference — Lucide icons only [MEMORY: feedback_no_emojis]. Phase 4 is pure extract/copy, no UI changes, so inherits this.
- **No console.log in production code:** Global TS/JS rule. `AuthContext.jsx` has some `console.error` / `console.warn` usages which are fine — those are logging APIs, not `console.log`.
- **Resilient API clients:** Global memory — never crash UI on missing tables/404s. Existing `api/client.js` already has `safeRead` handling for `42P01` / `PGRST204` errors [VERIFIED by reading file]. Preserved in the copy.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Versions in portalit `package.json` are current working versions and don't need to be re-verified against the npm registry before use in `apps/lootit/package.json` | Standard Stack | LOW — matching host project is the locked discretion choice. If portalit's versions have a known-bad entry, it's already bad in portalit. |
| A2 | `RuleEditorDialog.jsx` and `LootITSettings.jsx` use `@/components/ui/dialog`, `button`, `label`, and `input` (transitive shadcn primitives to copy) | Dependency audit | MEDIUM — planner MUST read these two files during planning to confirm the full UI copy list. The research flagged this as a Planner action item. |
| A3 | No code path in `server/src/middleware/*` authenticates via `req.cookies` | Pitfall 5, CORS | MEDIUM — this should be verified by reading the middleware before merging phase 5. The research didn't exhaustively audit middleware files. |
| A4 | Cookie chunking up to 10 chunks (35 KB ceiling) is enough for any realistic Supabase session | Cookie adapter | LOW — a typical Supabase session is 2-5 KB. 35 KB is 7-17x headroom. |
| A5 | Safari users accept the 7-day first-party-cookie ITP cap as "standard web behavior" | Pitfall 3 | MEDIUM — user-facing UX tradeoff. Recommend surfacing this to Aniel explicitly before phase 6. |
| A6 | Backend CORS middleware respects `CORS_ORIGIN` env var changes without a code deploy — just a service redeploy | CORS edit | LOW — standard Railway behavior. Env var changes need a restart, which Railway handles automatically. |
| A7 | Railway's "Root Directory" setting combined with a per-app `Dockerfile` is the supported pattern for deploying a subdirectory Vite app | Railway deployment | MEDIUM — matches Railway docs [CITED: docs.railway.com/guides/monorepo] and station.railway.com forum threads. Not personally verified against the specific `PortalIT` project config (which would require opening the Railway dashboard). |
| A8 | The existing `frontend` service uses either nixpacks auto-detection or an implicit Dockerfile that we haven't seen at repo root | Railway deployment | MEDIUM — CONTEXT says "No root Dockerfile exists — Railway uses nixpacks auto-detection OR there's service-level config I haven't seen." Planner should open Railway dashboard (or user provides a screenshot) to confirm before copying the pattern. |
| A9 | A user logged into portalit **before** phase 5 deploys will still have a valid Supabase session after the adapter change (because `getItem` falls back to localStorage) | Backcompat adapter | HIGH impact if wrong — this is the core D-18/D-33 safety claim. The backcompat path is direct: `cookie first, else localStorage`. Manually verifiable before phase 6 by loading portalit with a pre-phase-5 localStorage dump. |

**Planner action on assumptions:** A2, A3, A8 should be resolved by reading specific files / asking the user before Wave 1 of the plan. A5 should be surfaced to the user explicitly as a Discuss item before phase 6.

## Open Questions (RESOLVED)

1. **What is the actual Railway build pattern for the existing `frontend` service?**
   - What we know: Repo has a root `Caddyfile` but no root `Dockerfile` [VERIFIED].
   - What's unclear: Whether Railway uses nixpacks auto-detection, or if there's a service-level Dockerfile path set in the dashboard.
   - Recommendation: **Planner asks user to confirm via Railway dashboard OR just creates a Dockerfile in `apps/lootit/` — the Dockerfile path is defensively explicit regardless of what portalit does.**
   - **RESOLVED:** Don't care — `apps/lootit/` ships its own explicit Dockerfile (per plan 04-01 Task 2) so it doesn't matter what the existing `frontend` service uses. The new service is self-contained.

2. **Does `RuleEditorDialog.jsx` use `@/components/ui/dialog`?**
   - What we know: It's named `*Dialog.jsx` so it almost certainly does. Not directly imported by `LootITCustomerDetail.jsx` but likely referenced somewhere else in lootit/.
   - What's unclear: Exact shadcn surface it touches.
   - Recommendation: **Planner opens the file during planning and updates the UI copy list.** A grep for `@/components/ui/` across ALL of `src/components/lootit/*` + `src/lib/lootit-reconciliation.js` + the 5 copied hooks should be the definitive list.
   - **RESOLVED:** Resolved by execution strategy in plan 04-03 Task 1 — the executor runs `grep -rh "@/components/ui/" src/components/lootit/ | sort -u` BEFORE starting the copy, produces the real surface list, then copies every file that appears. The initial conservative list in CONTEXT.md D-07 is a starting point; the grep is authoritative.

3. **Is `zod` transitively required?**
   - What we know: Portalit has it in package.json; nothing in the grepped lootit code imports it directly.
   - What's unclear: Whether a copied shadcn primitive (e.g., if they add `form.jsx`) pulls it in.
   - Recommendation: Start without zod. Add if `npm run build` fails.
   - **RESOLVED:** Grep `src/components/lootit/ src/hooks/useReconciliation*.js src/lib/lootit-reconciliation.js` for `from 'zod'` during the audit in 04-03 Task 1. Include or exclude from apps/lootit/package.json based on the result. Default: EXCLUDE unless grep proves otherwise.

4. **Is the "Back to PortalIT" link a hard link or a SPA-to-SPA navigation?**
   - Locked: D-14 says "link pointing to `VITE_PORTALIT_URL`". This is a cross-origin hard nav. `<a href={VITE_PORTALIT_URL}>` is correct.
   - **RESOLVED:** (see CONTEXT.md D-14)

5. **Does the `customer-portal` service also need the cookie adapter?**
   - What we know: Per CONTEXT, the three frontends share the Supabase project.
   - What's unclear: Whether `customer.portalit.gtools.io` should also get the backcompat adapter so it participates in the SSO.
   - Recommendation: **Not in phase 4.** Phase 4 only touches `lootit-frontend`. Phase 5 touches portalit `frontend`. Whether `customer-portal` gets the same treatment is a **deferred decision** — flag for user to confirm the scope intentionally excludes it.
   - **RESOLVED:** NO — out of scope for phase 4. The `customer-portal` service runs the same portalit repo with `VITE_PORTAL_MODE=customer`, so when plan 04-04 modifies portalit's src/api/client.js, the customer-portal service picks it up automatically at its next rebuild. No extra plan needed.

6. **What is Supabase's refresh token default lifetime for this project?**
   - What we know: Default is "one week" on Supabase free tier, configurable up to longer on paid.
   - What's unclear: Specific setting on `rgsvvywlnnkckvockdoj.supabase.co`.
   - Recommendation: Set `MAX_AGE_SECONDS = 60 days` in the adapter (matches Supabase's default refresh rotation horizon without being over-permissive). Cookie will be rewritten on every successful refresh anyway.
   - **RESOLVED:** Use `Max-Age=5184000` (60 days), which exceeds the default Supabase refresh token lifetime of 30 days. If the refresh token expires before the cookie, Supabase's built-in refresh flow handles it — the cookie just holds a stale token briefly, which is harmless. Lock this value in plan 04-02 Task 1's adapter code.

## Sources

### Primary (HIGH confidence)
- **Codebase — direct reads (exact line citations):**
  - `/Users/anielreyes/portalit/src/api/client.js` — confirms `createClient` configuration shape, `onAuthStateChange` pattern, `_cachedToken` token cache, `credentials` handling
  - `/Users/anielreyes/portalit/src/lib/AuthContext.jsx` — confirms `checkUserAuth` flow, `withTimeout` pattern, `SIGNED_OUT` handling
  - `/Users/anielreyes/portalit/server/src/index.js` — confirms CORS config reads `process.env.CORS_ORIGIN` comma-list
  - `/Users/anielreyes/portalit/Caddyfile` — verbatim, confirmed reusable
  - `/Users/anielreyes/portalit/vite.config.js` — alias pattern `@` → `./src`
  - `/Users/anielreyes/portalit/package.json` — all version numbers for match-portalit strategy
  - `/Users/anielreyes/portalit/jsconfig.json`, `tailwind.config.js`, `components.json`, `postcss.config.js` — config files to copy
  - `/Users/anielreyes/portalit/src/lib/utils.js` — confirms `cn`/`formatLineItemDescription` exports and external imports (`clsx`, `tailwind-merge`, `date-fns`)
  - Full grep of `src/components/lootit/` — confirms every external and internal import
  - `src/components/ui/sheet.jsx` / `table.jsx` / `tooltip.jsx` / `button.jsx` / `dialog.jsx` — confirmed Radix peer dependencies

### Secondary (MEDIUM confidence — verified via web)
- **Supabase SupportedStorage type** — `PromisifyMethods<Pick<Storage, 'getItem'|'setItem'|'removeItem'>>` — [`github.com/supabase/auth-js` via search result](https://github.com/supabase/auth-js)
- **Cookie adapter pattern (chunking)** — [supabase GitHub discussion #5742](https://github.com/orgs/supabase/discussions/5742)
- **Cookie domain subdomain pattern** — [micheleong.com/blog/share-sessions-subdomains-supabase](https://micheleong.com/blog/share-sessions-subdomains-supabase)
- **`@supabase/ssr` vs `@supabase/auth-helpers` status** — [supabase.com troubleshooting migration guide](https://supabase.com/docs/guides/troubleshooting/how-to-migrate-from-supabase-auth-helpers-to-ssr-package-5NRunM)
- **`@supabase/ssr` is SSR-focused not SPA-focused** — [supabase GitHub discussion #28997](https://github.com/orgs/supabase/discussions/28997)
- **Railway monorepo + Root Directory + per-app Dockerfile pattern** — [docs.railway.com/guides/monorepo](https://docs.railway.com/guides/monorepo)
- **Caddy + Vite + Railway static pattern** — [station.railway.com Vite + Caddy thread](https://station.railway.com/questions/vite-react-with-caddy-881a0da8)
- **Safari ITP 7-day cap on script-set cookies** — [cookiestatus.com/safari](https://www.cookiestatus.com/safari/), [stape.io/blog/safari-itp](https://stape.io/blog/safari-itp)
- **SameSite behavior** — [web.dev samesite-cookies-explained](https://web.dev/articles/samesite-cookies-explained), [MDN third-party cookies](https://developer.mozilla.org/en-US/docs/Web/Privacy/Guides/Third-party_cookies)

### Tertiary (LOW confidence / context-only)
- StackOverflow and forum threads for general cookie chunking patterns — used only as corroboration of the primary Supabase discussion thread

## Metadata

**Confidence breakdown:**
- Standard stack (versions + packages): **HIGH** — verified directly against portalit's package.json
- Dependency audit (what to copy): **HIGH** for the files grepped; **MEDIUM** for `RuleEditorDialog.jsx` and `LootITSettings.jsx` transitive shadcn deps (Assumption A2)
- Cookie adapter implementation: **HIGH** — pattern is well-documented, corroborated across two independent Supabase community sources and matches the SupportedStorage type signature
- Cross-subdomain cookie semantics: **HIGH** — standard web platform behavior, no Supabase-specific magic
- Safari ITP limitation: **MEDIUM** — limitation is real and documented; the 7-day cap applies to script-written cookies. User-facing impact accepted
- Railway deployment specifics: **MEDIUM** — pattern is documented but specific Railway project config not personally inspected (Assumption A8)
- Backend CORS edit scope: **HIGH** — verified by reading `server/src/index.js`
- Backcompat adapter safety: **HIGH** in logic, **MEDIUM** in multi-tab race window (documented as Pitfall 6, accepted risk per D-33)

**Research date:** 2026-04-15
**Valid until:** ~2026-05-15 (cookie standards and Supabase auth semantics are stable; re-verify if Safari ships a material ITP change or Supabase ships auth-js v3)
