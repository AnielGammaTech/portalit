---
phase: 04-lootit-service-extraction
plan: 07
subsystem: infra
tags: [railway, dns, cname, cors, sso, cookie]

requires:
  - phase: 04-05
    provides: lootit-frontend Railway service with Railway-provided domain
  - phase: 04-06
    provides: portalit sidebar external link to VITE_LOOTIT_URL

provides:
  - lootit.gtools.io custom domain on lootit-frontend Railway service
  - Backend CORS_ORIGIN includes lootit.gtools.io
  - VITE_LOOTIT_URL on portalit frontend set to https://lootit.gtools.io

affects: []

tech-stack:
  added: []
  patterns: [custom-domain-cname-railway]

key-files:
  created: []
  modified: []

key-decisions:
  - "Custom domain setup done in parallel with Wave 4 to avoid DNS propagation wait"
  - "VITE_LOOTIT_URL pointed directly to lootit.gtools.io (skipping Railway URL intermediate)"

patterns-established:
  - "Pattern: .gtools.io subdomains for all Gamma Tech services (enables cross-subdomain cookie SSO)"

requirements-completed: []

duration: ~5min
completed: 2026-04-16
---

# Plan 04-07: Custom Domain lootit.gtools.io + Final SSO

**Added lootit.gtools.io custom domain via CNAME, updated backend CORS and portalit VITE_LOOTIT_URL to final domain, curl-verified HTML serving**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-16T11:58:00Z
- **Completed:** 2026-04-16T12:05:00Z
- **Tasks:** 4/4
- **Files modified:** 0 (all Railway/DNS infrastructure)

## Accomplishments
- Custom domain `lootit.gtools.io` added to lootit-frontend Railway service (user via dashboard)
- CNAME DNS record created: `lootit` → `lootit-frontend-production.up.railway.app` (user via DNS provider)
- DNS propagation instant — curl verified HTTP 200 with correct HTML (`<div id="root">`, title "LootIT")
- Backend CORS_ORIGIN updated to include `https://lootit.gtools.io`
- Portalit frontend VITE_LOOTIT_URL set to `https://lootit.gtools.io`
- Production merge of feat/lootit-split → production pushed (1ef711c)

## Task Commits

No git commits — all work is Railway/DNS infrastructure. Domain setup done by user in Railway dashboard + DNS provider. CORS and env var updates done via Railway MCP.

## Decisions Made
- Collapsed Wave 5 work into Wave 4 execution window — user proactively set up custom domain while Wave 4 agent ran, eliminating DNS propagation wait
- Pointed VITE_LOOTIT_URL directly to lootit.gtools.io (not the Railway URL) since domain was ready

## Deviations from Plan
None — plan executed as written, just earlier than sequenced.

## Issues Encountered
None.

## Next Phase Readiness
- Phase 04 complete: LootIT runs as standalone service at lootit.gtools.io
- SSO verification pending: user to confirm cookie auth works cross-subdomain in Chrome/Safari
- src/components/lootit/* deferred cleanup per D-35

---
*Phase: 04-lootit-service-extraction*
*Completed: 2026-04-16*
