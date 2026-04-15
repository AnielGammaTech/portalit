---
phase: 04-lootit-service-extraction
plan: 01
subsystem: infra
tags: [vite, react, docker, caddy, railway, scaffold, tailwind]

# Dependency graph
requires: []
provides:
  - "apps/lootit/ self-contained Vite 6 + React 18 app scaffold"
  - "apps/lootit/package.json with minimal dependency surface (no framer-motion, recharts, leaflet, quill, zod)"
  - "apps/lootit/Dockerfile + Caddyfile + nixpacks.toml for Railway deployment"
  - "apps/lootit/src/{main,App,Layout}.jsx placeholder shell that builds green"
  - "Isolated apps/lootit/node_modules tree (202 packages, 0 vulnerabilities)"
  - "Green build artifact apps/lootit/dist/ (index.html + hashed assets, ~150 KB total)"
affects: [04-02, 04-03, 04-04, 04-05, 04-06, 04-07]

# Tech tracking
tech-stack:
  added:
    - "vite ^6.1.0 (isolated from portalit root)"
    - "react ^18.2.0 + react-dom ^18.2.0"
    - "@supabase/supabase-js ^2.49.1"
    - "@tanstack/react-query ^5.84.1"
    - "react-router-dom ^6.26.0"
    - "tailwindcss ^3.4.17 + tailwindcss-animate ^1.0.7"
    - "@radix-ui/react-dialog ^1.1.6, react-tooltip ^1.1.8, react-slot ^1.1.2, react-label ^2.1.2"
    - "lucide-react ^0.475.0, sonner ^2.0.1"
    - "class-variance-authority ^0.7.1, clsx ^2.1.1, tailwind-merge ^3.0.2, date-fns ^3.6.0"
  patterns:
    - "Self-contained per-app directory with own package.json / node_modules / build output (D-01, D-02, D-03)"
    - "Multi-stage Docker: node:20-alpine build stage -> caddy:2-alpine static serve on :8080 (D-27, RESEARCH Pattern 3)"
    - "Verbatim Caddyfile reuse from portalit root for SPA fallback + aggressive hashed-asset caching"
    - "Minimal Tailwind directives-only index.css (D-09) — CSS tokens deferred to Plan 04-03 when shadcn primitives land"

key-files:
  created:
    - "apps/lootit/package.json"
    - "apps/lootit/vite.config.js"
    - "apps/lootit/jsconfig.json"
    - "apps/lootit/tailwind.config.js"
    - "apps/lootit/postcss.config.js"
    - "apps/lootit/components.json"
    - "apps/lootit/index.html"
    - "apps/lootit/.gitignore"
    - "apps/lootit/.dockerignore"
    - "apps/lootit/public/favicon.svg"
    - "apps/lootit/src/main.jsx"
    - "apps/lootit/src/App.jsx"
    - "apps/lootit/src/Layout.jsx"
    - "apps/lootit/src/index.css"
    - "apps/lootit/Dockerfile"
    - "apps/lootit/Caddyfile"
    - "apps/lootit/nixpacks.toml"
    - "apps/lootit/package-lock.json"
  modified: []

key-decisions:
  - "D-01/D-02/D-03 enforced: apps/lootit/ is top-level, self-contained, isolated node_modules (202 packages vs portalit's larger tree)"
  - "D-10 minimal dep list applied verbatim — excluded framer-motion, recharts, react-quill, react-leaflet, zod, stripe, cmdk, etc. (confirmed via negative grep acceptance criterion)"
  - "Matched portalit's @types/node (^22.13.5), @types/react (^18.2.66), @types/react-dom (^18.2.22) versions exactly instead of the higher numbers shown as examples in the plan — 'minimize surprise' discretion note"
  - "tailwind.config.js copied verbatim (kept CommonJS module.exports + require('tailwindcss-animate')) — globs already relative so they resolve from apps/lootit/ at build time (Pitfall 7 avoided)"
  - "postcss.config.js uses ESM `export default` (package.json type=module) — matches portalit root pattern"
  - "Dockerfile uses `npm install` (not `npm ci`) because the plan's verification runs the Dockerfile fresh on Railway; package-lock.json is committed so installs stay reproducible regardless"
  - "index.css trimmed to `@tailwind base/components/utilities` only — shadcn CSS variables (--background, --foreground, etc.) deferred to Plan 04-03 per D-09"

patterns-established:
  - "Per-app scaffold layout: config root + src/ + public/ + Dockerfile/Caddyfile/nixpacks.toml at app dir"
  - "Vite alias `@` -> `./src` resolved from vite.config.js __dirname, identical to portalit"
  - "npm scripts pin dev port to 5174 (portalit dev runs on 5173) to avoid collision during local multi-app dev"

requirements-completed: []

# Metrics
duration: 3min
completed: 2026-04-15
---

# Phase 4 Plan 01: LootIT App Scaffold Summary

**Self-contained Vite 6 + React 18 app at apps/lootit/ with Docker/Caddy deployment artifacts and a minimal placeholder shell that builds green (143 KB JS + 5.7 KB CSS).**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-04-15T22:41:00Z (approx)
- **Completed:** 2026-04-15T22:44:30Z
- **Tasks:** 3 of 3 complete
- **Files created:** 18 (17 source/config + package-lock.json)
- **Files modified:** 0

## Accomplishments

- **Isolated Vite app scaffold** at `apps/lootit/` with self-contained `package.json`, `vite.config.js`, `jsconfig.json`, `tailwind.config.js`, `postcss.config.js`, `components.json`, `index.html` (D-01/D-02/D-03 enforced).
- **Minimal dependency surface** — 15 runtime deps + 10 dev deps, zero installation warnings, zero vulnerabilities; excluded every dep LootIT doesn't need per D-10 (no framer-motion, recharts, react-quill, react-leaflet, zod, stripe, lodash, cmdk, vaul, etc.).
- **Deployment artifacts ready** — multi-stage `Dockerfile` (node:20-alpine build -> caddy:2-alpine serve on :8080), verbatim `Caddyfile` from portalit root, `nixpacks.toml` fallback.
- **Placeholder React shell** — `main.jsx` boots StrictMode, `App.jsx` renders "LootIT app shell ready", `Layout.jsx` minimal chrome — enough to build green while Plan 04-03 drops in the full providers+routes tree.
- **Green build verified** — `npm run build` produces `dist/index.html` (0.46 kB) + `dist/assets/index-Dcf-cVRz.js` (143.88 kB, 46.21 kB gzip) + `dist/assets/index-C39ss33k.css` (5.68 kB, 1.66 kB gzip) in ~482ms; idempotent on re-run (310ms).

## Task Commits

Each task was committed atomically with `--no-verify` (parallel executor hygiene):

1. **Task 1: Create config files, package.json, and entry HTML** — `7c6f3b0` (feat)
2. **Task 2: Create React entry, App shell, Layout, index.css, and deployment artifacts** — `39180e9` (feat)
3. **Task 3: Install dependencies and verify a green build** — `cbb1ff6` (chore)

## Files Created

### Config + entry (Task 1)
- `apps/lootit/package.json` — 15 runtime deps, 10 dev deps, `dev`/`build`/`preview`/`typecheck` scripts, port 5174
- `apps/lootit/vite.config.js` — `@` alias to `./src`, port 5174, `sourcemap: false`
- `apps/lootit/jsconfig.json` — `baseUrl: "."`, `@/*` path alias, JSX = `react-jsx`
- `apps/lootit/tailwind.config.js` — verbatim copy (CommonJS + `tailwindcss-animate` plugin, full CSS variable theme extensions, shimmer/accordion animations)
- `apps/lootit/postcss.config.js` — ESM export with `tailwindcss` + `autoprefixer`
- `apps/lootit/components.json` — shadcn new-york style, JS (not TSX), neutral base color
- `apps/lootit/index.html` — `#root` mount, `/src/main.jsx` script, LootIT title, favicon link
- `apps/lootit/.gitignore` — node_modules, dist, .env*, logs, DS_Store
- `apps/lootit/.dockerignore` — same plus .git
- `apps/lootit/public/favicon.svg` — byte copy from portalit root

### React shell + deploy (Task 2)
- `apps/lootit/src/main.jsx` — StrictMode boot, imports `./index.css` and `./App.jsx`, mounts into `#root`
- `apps/lootit/src/App.jsx` — placeholder that renders `<Layout>` with "LootIT app shell ready" centered
- `apps/lootit/src/Layout.jsx` — minimal `min-h-screen bg-slate-50` wrapper
- `apps/lootit/src/index.css` — `@tailwind base/components/utilities` only (3 lines per D-09)
- `apps/lootit/Dockerfile` — multi-stage node:20-alpine -> caddy:2-alpine, exposes :8080
- `apps/lootit/Caddyfile` — verbatim from portalit root (SPA fallback + asset cache headers)
- `apps/lootit/nixpacks.toml` — fallback with nodejs_20 + caddy nix packages

### Build artifact (Task 3)
- `apps/lootit/package-lock.json` — committed for reproducible Railway builds
- `apps/lootit/node_modules/` (gitignored, 180 MB, 202 packages)
- `apps/lootit/dist/` (gitignored, 160 KB) — output of `vite build`

## Exact dependency versions pinned (for Plan 04-03's reference)

### Runtime
| Package | Version |
|---|---|
| react | ^18.2.0 |
| react-dom | ^18.2.0 |
| react-router-dom | ^6.26.0 |
| @supabase/supabase-js | ^2.49.1 |
| @tanstack/react-query | ^5.84.1 |
| @radix-ui/react-dialog | ^1.1.6 |
| @radix-ui/react-tooltip | ^1.1.8 |
| @radix-ui/react-slot | ^1.1.2 |
| @radix-ui/react-label | ^2.1.2 |
| class-variance-authority | ^0.7.1 |
| clsx | ^2.1.1 |
| tailwind-merge | ^3.0.2 |
| date-fns | ^3.6.0 |
| lucide-react | ^0.475.0 |
| sonner | ^2.0.1 |

### Dev
| Package | Version |
|---|---|
| vite | ^6.1.0 |
| @vitejs/plugin-react | ^4.3.4 |
| tailwindcss | ^3.4.17 |
| tailwindcss-animate | ^1.0.7 |
| autoprefixer | ^10.4.20 |
| postcss | ^8.5.3 |
| typescript | ^5.8.2 |
| @types/node | ^22.13.5 |
| @types/react | ^18.2.66 |
| @types/react-dom | ^18.2.22 |

### Deliberately excluded (per D-10)
`@hello-pangea/dnd`, `@hookform/resolvers`, all unused `@radix-ui/*` packages (accordion, alert-dialog, popover, select, etc.), `@stripe/*`, `canvas-confetti`, `cmdk`, `embla-carousel-react`, `framer-motion`, `input-otp`, `lodash`, `next-themes`, `react-day-picker`, `react-hook-form`, `react-hot-toast`, `react-leaflet`, `react-markdown`, `react-quill`, `react-resizable-panels`, `recharts`, `vaul`, `zod`. Plan 04-03 must re-audit via `grep -rh "from ['\"]" apps/lootit/src` after copying the real LootIT code and add any transitive needs back.

## Build output location and size

```
apps/lootit/dist/
├── index.html                  0.46 kB  (gzip 0.29 kB)
└── assets/
    ├── index-Dcf-cVRz.js     143.88 kB  (gzip 46.21 kB)
    └── index-C39ss33k.css      5.68 kB  (gzip  1.66 kB)
```

Build time: ~480ms cold, ~310ms idempotent re-run. `dist/index.html` contains `<div id="root">` as required for SPA boot.

## Decisions Made

1. **`@types/*` versions match portalit exactly** — plan's example package.json showed slightly higher `@types/node` (^22.10.7), `@types/react` (^18.3.18), `@types/react-dom` (^18.3.5). Plan explicitly said "If portalit package.json has DIFFERENT @types/* versions, use those instead. Read portalit/package.json and match exactly." Portalit has `@types/node ^22.13.5`, `@types/react ^18.2.66`, `@types/react-dom ^18.2.22` — those were used. [Rule: follow plan's explicit instruction.]
2. **`postcss.config.js` uses ESM** — matches portalit root (`type: module` in package.json makes CJS `.js` files fail).
3. **`tailwind.config.js` kept as CommonJS** — portalit root also uses `module.exports` + `require()` despite `type: module`; works because Tailwind loads it via its own config resolver, not Node's ESM loader.
4. **`nixpacks.toml` uses `npm install`** (not `npm ci`) to match the Dockerfile's fallback behavior; Railway will use whichever builder is configured.
5. **`.gitignore` excludes `dist/` and `node_modules/`** — package-lock.json committed explicitly for reproducibility.

## Deviations from Plan

None - plan executed exactly as written. The only micro-adjustment was using the portalit `@types/*` versions that the plan explicitly told me to use if they differed from the example. Excluded-dependency acceptance criterion passed on the first run.

## Issues Encountered

None.

## Self-Check: PASSED

Verified via Bash after writing SUMMARY.md:
- `apps/lootit/package.json` FOUND
- `apps/lootit/vite.config.js` FOUND
- `apps/lootit/jsconfig.json` FOUND
- `apps/lootit/tailwind.config.js` FOUND
- `apps/lootit/postcss.config.js` FOUND
- `apps/lootit/components.json` FOUND
- `apps/lootit/index.html` FOUND
- `apps/lootit/.gitignore` FOUND
- `apps/lootit/.dockerignore` FOUND
- `apps/lootit/public/favicon.svg` FOUND
- `apps/lootit/src/main.jsx` FOUND
- `apps/lootit/src/App.jsx` FOUND
- `apps/lootit/src/Layout.jsx` FOUND
- `apps/lootit/src/index.css` FOUND
- `apps/lootit/Dockerfile` FOUND
- `apps/lootit/Caddyfile` FOUND
- `apps/lootit/nixpacks.toml` FOUND
- `apps/lootit/package-lock.json` FOUND
- `apps/lootit/dist/index.html` FOUND (build artifact, gitignored)
- Commits 7c6f3b0, 39180e9, cbb1ff6 FOUND in `git log`

## Next Plan Readiness

**Plan 04-03** will:
1. Replace `apps/lootit/src/App.jsx` placeholder with the full providers + routes tree (`<AuthProvider>` + `<QueryClientProvider>` + `<BrowserRouter>` + `<Toaster>` with `/`, `/customers/:customerId`, `/settings` routes per D-12).
2. Populate `apps/lootit/src/api/`, `lib/`, `hooks/`, `components/`, `pages/` with the LootIT code copy from `src/components/lootit/*`, `src/hooks/useReconciliation*`, `src/lib/lootit-reconciliation.js`, etc. per D-07.
3. Re-audit real external imports via `grep -rh "from ['\"]" apps/lootit/src` and add any transitive deps the minimal list is missing.
4. Expand `apps/lootit/src/index.css` with the shadcn CSS variables (`--background`, `--foreground`, etc.) that the copied UI primitives will need.

**Plan 04-02** (parallel wave) will create `apps/lootit/src/lib/auth-storage.js` — the cookie-backed Supabase storage adapter — and wire it into the copied `api/client.js` in Plan 04-03.

**Plan 04-05** can use `apps/lootit/` as the Railway service Root Directory without further changes to the files created here. The `Dockerfile` + `Caddyfile` + `nixpacks.toml` are deployment-ready.

---
*Phase: 04-lootit-service-extraction-split-lootit-into-its-own-railway-*
*Plan: 01*
*Completed: 2026-04-15*
