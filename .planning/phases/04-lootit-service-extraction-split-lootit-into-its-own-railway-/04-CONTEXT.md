# Phase 4: LootIT Service Extraction - Context

**Gathered:** 2026-04-15
**Status:** Ready for planning
**Source:** Pre-planning design discussion between user and Claude (captured directly into CONTEXT.md)

<domain>
## Phase Boundary

Extract LootIT from inside the PortalIT frontend build (`src/components/lootit/`, `src/hooks/useReconciliation*`, `src/lib/lootit-reconciliation.js`) into a standalone Vite app under `apps/lootit/` that deploys as its own Railway frontend service at `lootit.gtools.io`. The new service shares the existing PortalIT backend (`backend-production-58b4.up.railway.app`) and the same Supabase project. Users authenticated in PortalIT click a LootIT link and arrive at `lootit.gtools.io` already signed in — achieved via a cookie-based Supabase session stored on the `.gtools.io` parent domain rather than localStorage. The in-PortalIT LootIT routes are removed and replaced with an external link once the new service is verified.

**Why now:** PortalIT is about to undergo heavy redesign work. LootIT is a billing-critical reconciliation tool that must not regress. Splitting it into its own bundle + repo subtree + Railway service gives hard isolation — PortalIT code changes cannot affect LootIT's built artifact.

**Out of scope:** Moving LootIT's backend routes out of PortalIT's Express server. The backend stays monolithic; only the frontend splits. No database schema changes. No LootIT feature changes — this is purely an extract/refactor.

</domain>

<decisions>
## Implementation Decisions

### Repository Structure (D-01 through D-05)
- **D-01:** New top-level folder `apps/lootit/` inside the existing `portalit` repo. Existing portalit code stays at the root (`src/`, `server/`, `vite.config.js`, etc.) — **do not restructure to monorepo** (`apps/portalit/` + workspaces). Keeping portalit at the root minimizes blast radius and lets us split without touching hundreds of import paths.
- **D-02:** `apps/lootit/` is a self-contained Vite app with its own `package.json`, `vite.config.js`, `index.html`, `Dockerfile`, `Caddyfile`, `nixpacks.toml`, `tailwind.config.js`, `postcss.config.js`, `components.json`, and `jsconfig.json`.
- **D-03:** `apps/lootit/` has its own `node_modules` and uses `npm install` independently. No npm workspaces, no pnpm, no cross-linking. Each app is as isolated as if they lived in separate repos.
- **D-04:** `apps/lootit/src/` directory mirrors portalit's structure so the `@/*` path alias works identically: `@/api/client`, `@/lib/utils`, `@/components/ui/*`, `@/hooks/*`. Copy-paste of shadcn UI components is intentional (shadcn is copy-paste by design).
- **D-05:** The existing `extensions/lootit-link/` browser extension stays where it is — it's a separate concern and doesn't import from the moved code.

### Code Duplication Strategy (D-06 through D-10)
- **D-06:** **Duplicate, don't share.** LootIT gets its own copy of every file it needs. No shared npm package, no git submodule, no symlinks. Isolation is the goal — if PortalIT refactors a shared component and breaks its callers, LootIT must be immune.
- **D-07:** Files that must be copied from `portalit/src/` into `apps/lootit/src/` (initial surface — planner should audit for transitive deps and add more as needed):
  - `api/client.js` (Supabase client + REST helpers + Entity proxy)
  - `lib/AuthContext.jsx` (auth state + session management)
  - `lib/utils.js` (cn helper + formatLineItemDescription)
  - `lib/lootit-reconciliation.js` (LootIT-specific reconciliation engine — actually a pure move, no longer needed in portalit after phase 5)
  - `lib/query-client.js` (react-query client config, if used transitively)
  - `components/ui/sheet.jsx`, `table.jsx`, `tooltip.jsx` (directly imported by LootIT)
  - Transitive shadcn deps: `button.jsx`, `dialog.jsx`, `label.jsx`, anything the above three use internally — planner must audit
  - `hooks/useAutoRetry.js`, `useCustomerData.js`, `useReconciliationData.js`, `useReconciliationReviews.js`, `useReconciliationRules.js`
  - `components/lootit/*` — every file in this directory (these are pure LootIT)
- **D-08:** The copied files in `apps/lootit/src/` are **standalone** — they are not re-exports, not symlinks. Once copied, they are owned by the lootit app and can diverge freely.
- **D-09:** No index.css duplication ceremony — lootit gets its own minimal `index.css` with the Tailwind directives and any custom CSS tokens LootIT's design system needs. Planner audits the existing index.css and copies only what LootIT uses.
- **D-10:** The lootit app's `package.json` lists only the dependencies LootIT actually uses: React 18, Vite 6, TanStack Query, Supabase JS, shadcn's radix deps for `sheet`/`table`/`tooltip`/`dialog`/`button`, lucide-react, sonner, react-router-dom, tailwindcss + tailwindcss-animate, class-variance-authority, clsx, tailwind-merge, date-fns (if LootIT uses it). No mapbox, no stripe, no leaflet, no quill, no framer-motion, no confetti, no lodash, no zod unless the copied code needs it.

### App Shell (D-11 through D-15)
- **D-11:** `apps/lootit/src/main.jsx` boots React, mounts `<App />` into `#root`, imports `index.css`. Same pattern as portalit.
- **D-12:** `apps/lootit/src/App.jsx` wraps the tree with `<AuthProvider>`, `<QueryClientProvider>`, `<BrowserRouter>`, `<Toaster>` (sonner). Routes: `/` → dashboard, `/customers/:customerId` → customer detail, `/settings` → settings. Unauthenticated users redirect to portalit login URL (`VITE_PORTALIT_LOGIN_URL`).
- **D-13:** A top-level `RequireAuth` component checks `useAuth()`. If `!isAuthenticated && !isLoadingAuth`, redirect via `window.location.href` to `${VITE_PORTALIT_URL}/login?returnUrl=${encodeURIComponent(window.location.href)}`. After portalit login completes, the Supabase cookie is visible to lootit and `useAuth()` will pick it up.
- **D-14:** `apps/lootit/src/Layout.jsx` provides the chrome: sidebar with Dashboard/Settings links, header with user avatar + sign-out, a "Back to PortalIT" link pointing to `VITE_PORTALIT_URL`. Minimal — LootIT is a focused tool, not a portal.
- **D-15:** The existing `LootITDashboard.jsx`, `LootITCustomerDetail.jsx`, `LootITSettings.jsx` become route components directly (they're already self-contained in their directory). No further refactor needed in phase 4 — subsequent LootIT redesign milestones can happen inside the new repo without affecting portalit.

### Auth & SSO (D-16 through D-22) — Highest Risk
- **D-16:** Supabase session storage switches from **localStorage** (default) to a **cookie on `.gtools.io`**. This is the single change that enables SSO across `portalit.gtools.io`, `customer.portalit.gtools.io`, and `lootit.gtools.io`.
- **D-17:** Implement via a custom `storage` adapter passed to `createClient(url, key, { auth: { storage: customStorage } })`. The adapter implements `getItem`, `setItem`, `removeItem` backed by `document.cookie` with options `Domain=.gtools.io; Path=/; Secure; SameSite=Lax; Max-Age=<refresh_token_expiry>`. Use a single cookie name like `sb-auth-token` (or the Supabase project-ref-prefixed name if that's less invasive).
- **D-18:** **Backwards compatibility during rollout:** The adapter's `getItem` first reads from cookie, then falls back to localStorage if cookie is empty. On `setItem`, it writes to both cookie AND localStorage during a transition period. This guarantees no existing portalit user gets logged out by the switch. After phase 6 ships and bakes for ~1 week, a follow-up removes the localStorage write.
- **D-19:** The cookie adapter lives in `api/client.js` (both portalit's and lootit's copies) — identical code, duplicated deliberately. Adding it to portalit is the highest-risk edit in this phase and gets its own plan with rollback instructions.
- **D-20:** **Local development:** On `localhost`, the `.gtools.io` domain cookie doesn't apply. The adapter detects `location.hostname === 'localhost'` and falls back to localStorage entirely (no cookie writes). This keeps `npm run dev` working for both apps without requiring hosts-file tricks.
- **D-21:** No handoff tokens in URLs. No one-time login codes. No Supabase magic links. The cookie **IS** the handoff — if it's visible at `lootit.gtools.io`, auth works; if it isn't, redirect back to portalit login with a returnUrl. Clean and boring.
- **D-22:** Sign-out from either app calls `supabase.auth.signOut()`, which deletes the session from the storage adapter (cookie + localStorage). Both apps see `SIGNED_OUT` via the `onAuthStateChange` listener and reflect it. Users must re-login in portalit.

### Backend & CORS (D-23 through D-25)
- **D-23:** The Express backend at `server/src/index.js` stays in place — a single backend serves both frontends. Both apps point at `VITE_API_BASE_URL=https://backend-production-58b4.up.railway.app`.
- **D-24:** Backend CORS config must allow `https://lootit.gtools.io` as an origin in addition to `portalit.gtools.io` and `customer.portalit.gtools.io`. Planner identifies the exact file (likely `server/src/index.js` or a middleware file) and the edit.
- **D-25:** `VITE_LOOTIT_URL` env var is added to the portalit frontend service so the PortalIT sidebar's LootIT menu item can link to the new domain dynamically (not hardcoded). Similarly, the lootit service gets `VITE_PORTALIT_URL` for the "Back to PortalIT" link and login redirects.

### Railway Deployment (D-26 through D-31)
- **D-26:** A new Railway service named `lootit-frontend` is created inside the existing `PortalIT` Railway project (project ID `935a26e9-0cea-4eff-a7e7-d551840fad71`). Same repo (`AnielGammaTech/portalit`), same `production` branch, different **Root Directory** (`apps/lootit`).
- **D-27:** The service uses a Dockerfile or nixpacks config inside `apps/lootit/` that runs `npm install && npm run build` and serves `apps/lootit/dist` via Caddy on port 8080 — mirroring the existing `frontend` service's setup.
- **D-28:** **Initial deploy uses a temporary domain** — either the Railway-generated `*.up.railway.app` URL or a subdomain like `lootit-test.gtools.io`. This lets us verify the build, the SSO cookie flow, and CORS against production portalit before touching DNS for `lootit.gtools.io`.
- **D-29:** Once verified, add `lootit.gtools.io` as the custom domain on the `lootit-frontend` service. User (Aniel) manages DNS and adds the CNAME pointing to Railway.
- **D-30:** The `frontend` service (portalit) is NOT modified at Railway level until phase 5 (which only needs a single env var change: `VITE_LOOTIT_URL`). Root directory of existing services stays unchanged — no `apps/portalit/` move, so no Railway reconfiguration.
- **D-31:** **No staging environment exists** on the PortalIT Railway project — deploys go direct to production. Verification strategy: (a) all phases 1–3 are validated locally with `npm run dev` + `npm run build` before any deploy, (b) phase 4 deploys lootit to a temporary URL in isolation, (c) phase 5 modifies portalit with the backwards-compatible auth adapter that cannot log anyone out, (d) phase 6 only adds a DNS record and a menu link.

### Rollout Safety (D-32 through D-35)
- **D-32:** All work happens on git branch `feat/lootit-split` from `production`. Each phase commits atomically. No merge to `production` until phase 6 cutover.
- **D-33:** The backwards-compatible auth adapter (D-18) means phase 5's cookie-auth rollout on portalit is effectively zero-downtime. Existing sessions in localStorage keep working; new logins write to both cookie and localStorage.
- **D-34:** A kill-switch: if anything goes wrong with the auth adapter, revert to vanilla Supabase client (remove custom storage config). Existing users won't notice because the backwards-compat layer kept localStorage populated.
- **D-35:** Rollback plan for the cutover: if lootit.gtools.io has problems after phase 6, change the LootIT menu item in portalit back to its in-app route (`/lootit/...`) as a hotfix — the in-app code stays in git history and can be restored in one commit. (After a successful 2-week bake, the in-app LootIT code is deleted from portalit's source tree in a followup cleanup.)

### Claude's Discretion
- Exact file structure under `apps/lootit/src/` (features folder? pages folder? flat?)
- Whether the shell uses `react-router-dom` v6 routes or a simpler switch
- Specific package versions in `apps/lootit/package.json` (match portalit's versions to minimize surprise)
- How aggressively to trim the copied index.css
- Whether the lootit app has its own ESLint config (recommended: copy portalit's)
- Specific cookie expiry (recommend: match Supabase refresh token lifetime)
- Whether to create a minimal test to assert the auth adapter round-trips a session

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Files to Copy (Source)
- `src/api/client.js` — Supabase client, Entity proxy, REST helpers (591 lines — LootIT uses entities, auth, functions, integrations)
- `src/lib/AuthContext.jsx` — Auth provider with profile loading
- `src/lib/utils.js` — cn helper, formatLineItemDescription
- `src/lib/lootit-reconciliation.js` — Reconciliation engine with VENDOR_EXTRACTORS
- `src/lib/query-client.js` — react-query client config
- `src/hooks/useAutoRetry.js`
- `src/hooks/useCustomerData.js`
- `src/hooks/useReconciliationData.js`
- `src/hooks/useReconciliationReviews.js`
- `src/hooks/useReconciliationRules.js`
- `src/components/ui/sheet.jsx`, `table.jsx`, `tooltip.jsx` (plus transitive: `button.jsx`, `dialog.jsx`, `label.jsx`, etc.)
- `src/components/lootit/*` — ALL files

### Files to Create (Target)
- `apps/lootit/package.json`
- `apps/lootit/vite.config.js`
- `apps/lootit/index.html`
- `apps/lootit/tailwind.config.js`
- `apps/lootit/postcss.config.js`
- `apps/lootit/jsconfig.json`
- `apps/lootit/components.json`
- `apps/lootit/Dockerfile`
- `apps/lootit/Caddyfile`
- `apps/lootit/nixpacks.toml`
- `apps/lootit/.dockerignore`
- `apps/lootit/src/main.jsx`
- `apps/lootit/src/App.jsx`
- `apps/lootit/src/Layout.jsx`
- `apps/lootit/src/index.css`
- `apps/lootit/src/components/RequireAuth.jsx`
- `apps/lootit/src/lib/auth-storage.js` — NEW cookie/localStorage adapter for Supabase
- `apps/lootit/src/pages/DashboardPage.jsx`
- `apps/lootit/src/pages/CustomerDetailPage.jsx`
- `apps/lootit/src/pages/SettingsPage.jsx`

### Files to Modify (PortalIT side — phase 5 only)
- `src/api/client.js` — Add cookie storage adapter (duplicated from apps/lootit/src/lib/auth-storage.js — copy-paste identical code)
- `src/App.jsx` or router config — Remove LootIT routes, replace with external link (phase 5)
- `src/Layout.jsx` or sidebar component — LootIT menu item becomes `<a href={VITE_LOOTIT_URL}>`
- `server/src/index.js` or CORS middleware — Add `lootit.gtools.io` to allowed origins

### Files to Delete (PortalIT side — phase 5 only)
- `src/components/lootit/*` — Only after lootit.gtools.io is verified in production (can be a followup cleanup commit, NOT part of this phase)

### Railway Reference
- Project: **PortalIT** (ID `935a26e9-0cea-4eff-a7e7-d551840fad71`)
- Existing services: `frontend` (portalit.gtools.io), `customer-portal` (customer.portalit.gtools.io), `backend` (backend-production-58b4.up.railway.app)
- New service: `lootit-frontend` (lootit.gtools.io, eventually)

### External System Constraints
- Supabase project: `rgsvvywlnnkckvockdoj.supabase.co` (same for all three frontends)
- DNS: `gtools.io` managed by user, CNAME for `lootit.gtools.io` added manually when ready
- No staging environment — production-direct deploys

### Existing Deployment Reference
- `Caddyfile` (root) — Serves `dist/` on `:8080` with SPA fallback and aggressive asset caching. Copy this pattern.
- `server/nixpacks.toml` — Reference for nixpacks format (backend specific; frontend uses Dockerfile + Caddy)
- `vite.config.js` — Alias pattern `@ → ./src`

</canonical_refs>

<code_context>
## Existing Code Insights

### How PortalIT Currently Builds
- Vite 6 + React 18, `npm run build` emits to `dist/`
- `vite.config.js` aliases `@` → `./src`
- Caddyfile serves `dist/` on `:8080` with SPA fallback, caches hashed assets aggressively, never caches `index.html`
- No root Dockerfile exists — Railway uses nixpacks auto-detection OR there's service-level config I haven't seen (planner must verify by checking Railway service build configs)

### How PortalIT Currently Runs
- Three Railway services in the `PortalIT` project
- `frontend` service: `VITE_PORTAL_MODE=full`, domain `portalit.gtools.io`
- `customer-portal` service: `VITE_PORTAL_MODE=customer`, domain `customer.portalit.gtools.io`
- `backend` service: Express, domain `backend-production-58b4.up.railway.app`
- All three share the same Supabase project via `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` env vars

### How LootIT Currently Lives Inside PortalIT
- Components: `src/components/lootit/*` (20+ files, the whole feature)
- Hooks: `useReconciliationData`, `useReconciliationReviews`, `useReconciliationRules` — LootIT-specific
- Library: `lib/lootit-reconciliation.js` — reconciliation engine
- Backend: `server/src/functions/lootitLink.js` + routes through `server/src/routes/functions.js` — these STAY on the shared backend, not moved
- Integration with the PortalIT shell: routed through the main `App.jsx`/router, accessed via a sidebar menu item

### Supabase Client Currently
- `src/api/client.js` creates the client with `persistSession: true` (default localStorage)
- `onAuthStateChange` updates a module-level token cache used by `apiFetch` for the Authorization header
- No custom `storage` adapter is set — this is the exact hook point for D-17

</code_context>

<specifics>
## Specific Ideas

- User wants **hard isolation**: "whatever changes I'm making [to portalit], I don't want it to affect LootIT at all. I wanna separate them."
- The split is prep work for a hardcore PortalIT redesign — LootIT is the billing-critical piece that cannot regress
- Shared backend is fine and desired: "They can use the same back end, but separate from the front end"
- Auto-login via cookie SSO is the explicit UX requirement: "when you click on it, it kinda redirects you to that and automatically logs you in"
- User manages DNS and will add the CNAME when asked
- User approved duplication-over-monorepo when I explained shadcn components are copy-paste by design
- User wants superpowers workflow discipline applied during execution, and will personally greenlight automode — no autonomous multi-phase execution without explicit approval

</specifics>

<deferred>
## Deferred Ideas

- **Monorepo restructure** (`apps/portalit/` + `packages/shared/` + npm workspaces) — rejected in favor of duplicate-and-diverge because it requires ~100+ import path updates on the portalit side and touches hundreds of files. Can be reconsidered if a third app joins the repo.
- **Extracting LootIT backend routes** into their own Express service — out of scope. Backend stays monolithic; only the frontend splits.
- **LootIT UX redesign** — separate milestone. Once phase 4 ships, LootIT's future redesign work happens in `apps/lootit/` and is immune to PortalIT changes.
- **Removing the localStorage write from the cookie adapter** — deferred to a followup after ~1 week of cookie-auth bake time in production, to guarantee no user session is stranded.
- **Deleting `src/components/lootit/*` from portalit** — deferred to a cleanup commit AFTER phase 6 has been stable in production for ~2 weeks. Phase 5 only replaces the route with an external link; the source files stay in git for easy rollback.
- **Custom staging environment** for PortalIT Railway project — out of scope. Verification uses local builds + the isolated new service as effective "staging".

</deferred>

---

*Phase: 04-lootit-service-extraction-split-lootit-into-its-own-railway-*
*Context gathered: 2026-04-15 via pre-planning design discussion*
