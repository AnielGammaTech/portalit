---
phase: 04-lootit-service-extraction
plan: 05
subsystem: infra
tags: [railway, docker, caddy, cors, sso, vite]

requires:
  - phase: 04-03
    provides: apps/lootit/ build-ready frontend with route shell
  - phase: 04-04
    provides: portalit root wired with cookie auth adapter

provides:
  - lootit-frontend Railway service in PortalIT project
  - Railway-provided domain at lootit-frontend-production.up.railway.app
  - Backend CORS_ORIGIN updated to allow lootit-frontend origin
  - Dockerfile-based deploy from apps/lootit/ on feat/lootit-split

affects: [04-06, 04-07]

tech-stack:
  added: []
  patterns: [dockerfile-caddy-spa-deploy, railway-service-per-app]

key-files:
  created: []
  modified: []

key-decisions:
  - "Railway CLI `railway add` used for service creation; Root Directory + Branch required dashboard manual config (CLI/API limitation)"
  - "SSO verification deferred to Wave 5 (lootit.gtools.io) — Railway URL is not a .gtools.io subdomain so cookie adapter correctly ignores it"

patterns-established:
  - "Pattern: Dockerfile + Caddy SPA serving for Railway frontend services"
  - "Pattern: CORS_ORIGIN comma-separated allowlist on backend service"

requirements-completed: []

duration: ~15min (including human-action wait)
completed: 2026-04-16
---

# Plan 04-05: Railway lootit-frontend Service Deploy

**Deployed lootit-frontend as standalone Railway service with Dockerfile+Caddy, env vars configured, backend CORS updated, HTML serving verified via curl**

## Performance

- **Duration:** ~15 min (including dashboard manual step)
- **Started:** 2026-04-15T22:55:00Z
- **Completed:** 2026-04-16T12:00:00Z
- **Tasks:** 5/5 (Task 5 SSO deferred to Wave 5)
- **Files modified:** 0 (all work is Railway infrastructure)

## Accomplishments
- Created lootit-frontend service (id 9cf03e49) in PortalIT Railway project via `railway add`
- Set 4 env vars: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_API_BASE_URL, VITE_PORTALIT_URL
- Successful Dockerfile deploy from `feat/lootit-split` branch, root `/apps/lootit`
- Generated Railway domain: https://lootit-frontend-production.up.railway.app
- Backend CORS_ORIGIN updated to include lootit-frontend URL
- curl verification: HTML contains `<div id="root"></div>`, title "LootIT", JS/CSS assets loading

## Task Commits

No git commits — all work is Railway infrastructure configuration (service creation, env vars, domain, CORS). SUMMARY.md committed by orchestrator.

## Decisions Made
- Railway CLI created service defaulting to `production` branch + root `/` — required manual dashboard fix to set `feat/lootit-split` + `/apps/lootit`
- SSO cross-subdomain verification deferred: Railway URL (`.up.railway.app`) cannot share cookies with `.gtools.io` domain. This is expected per D-20/D-28. Real SSO test happens in Plan 04-07 after `lootit.gtools.io` custom domain is configured.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Railway source config required dashboard intervention**
- **Found during:** Task 1 (service creation)
- **Issue:** `railway add --repo` defaults to wrong branch (production) and no root directory
- **Fix:** User manually set Branch=feat/lootit-split and Root Directory=apps/lootit in Railway dashboard
- **Verification:** Deploy metadata confirmed correct branch + rootDirectory after re-deploy

---

**Total deviations:** 1 (dashboard manual step for Railway source config)
**Impact on plan:** Minor workflow adjustment. All must_haves achieved except SSO verification (deferred to Wave 5 by design).

## Issues Encountered
- Initial deploy built from `production` branch + root `/` (wrong). Resolved after user updated Source settings in dashboard.
- White page on Railway URL in browser is expected — cookie adapter only activates on `.gtools.io` subdomains.

## Next Phase Readiness
- Plan 04-06 can reference `VITE_LOOTIT_URL=https://lootit-frontend-production.up.railway.app` for portalit sidebar link
- Plan 04-07 will add `lootit.gtools.io` custom domain and run the definitive SSO test

---
*Phase: 04-lootit-service-extraction*
*Completed: 2026-04-16*
