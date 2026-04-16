---
phase: 04-lootit-service-extraction
plan: 06
subsystem: ui
tags: [react, vite, sidebar, external-link, env-var]

requires:
  - phase: 04-05
    provides: lootit-frontend Railway service at lootit-frontend-production.up.railway.app

provides:
  - Portalit sidebar LootIT item as external link to VITE_LOOTIT_URL
  - Dashboard LootIT links pointing to external lootit-frontend service
  - LootIT route removed from pages.config.js (no in-app /LootIT route)

affects: [04-07]

tech-stack:
  added: []
  patterns: [external-nav-item-pattern, env-var-with-hardcoded-fallback]

key-files:
  created: []
  modified:
    - src/pages.config.js
    - src/Layout.jsx
    - src/pages/Dashboard.jsx

key-decisions:
  - "Same-tab navigation for external LootIT link (no target=_blank) -- matches SaaS menu behavior and keeps SSO cookie story simple"
  - "Nav item uses {external: true, href: LOOTIT_URL} flag pattern -- NavItem, MobileBottomTab, MobileDrawerNav all check item.external to render <a> instead of <Link>"
  - "LOOTIT_URL defined as module-level const in both Layout.jsx and Dashboard.jsx -- import.meta.env.VITE_LOOTIT_URL with hardcoded Railway fallback"

patterns-established:
  - "Pattern: external nav items use {external: true, href: url} in navigation config arrays"
  - "Pattern: VITE_ env vars with hardcoded production fallback for zero-config deploys"

requirements-completed: []

duration: ~3min
completed: 2026-04-16
---

# Plan 04-06: Replace In-App LootIT Route with External Link Summary

**Portalit sidebar and dashboard LootIT links now point to external lootit-frontend service via VITE_LOOTIT_URL with Railway fallback**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-04-16T12:09:16Z
- **Completed:** 2026-04-16T12:12:45Z
- **Tasks:** 3/4 (Task 4 is human-action checkpoint -- blocked on env var + merge to production)
- **Files modified:** 3

## Accomplishments
- Removed LootIT from portalit route config (pages.config.js) -- no in-app /LootIT route exists
- Sidebar LootIT menu item in all three nav contexts (desktop, mobile bottom tab, mobile drawer) now renders `<a href={LOOTIT_URL}>` instead of `<Link to="/LootIT">`
- Dashboard LootIT reconciliation section links ("View All", per-customer, "+N more") all point to external lootit-frontend URL
- src/components/lootit/* preserved (18 files) per D-35 rollback safety
- Build exits 0 with no errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Identify portalit LootIT route and sidebar menu item** - (discovery only, no file changes, no commit)
2. **Task 2: Replace in-app LootIT route with external link and verify build** - `9d6e629` (feat)
3. **Task 3: Commit and push feat/lootit-split** - (push of 9d6e629 to origin)
4. **Task 4: Add VITE_LOOTIT_URL env var and merge to production** - BLOCKED (human-action checkpoint)

## Files Created/Modified
- `src/pages.config.js` - Removed LootIT import and PAGES entry
- `src/Layout.jsx` - Added LOOTIT_URL constant; NavItem, MobileBottomTab, MobileDrawerNav render `<a>` for external items
- `src/pages/Dashboard.jsx` - Added LOOTIT_URL constant; replaced 3 internal Link components with external `<a>` tags

## Decisions Made
- Same-tab navigation (no `target="_blank"`) for the external LootIT link -- matches typical SaaS menu behavior and simplifies cookie handoff
- Used `{external: true, href: url}` pattern on nav items rather than special-casing by name -- extensible for future external links
- Fallback URL hardcoded to `https://lootit-frontend-production.up.railway.app` (from Plan 04-05)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Blocked: Task 4 (Human Action Required)

Task 4 requires two manual steps that cannot be automated:

**Step A -- Add VITE_LOOTIT_URL env var to portalit frontend service:**
1. Railway Dashboard -> PortalIT -> frontend service -> Variables
2. Add: `VITE_LOOTIT_URL` = `https://lootit-frontend-production.up.railway.app`
3. Save (triggers redeploy)

**Step B -- Merge feat/lootit-split to production:**
```bash
git fetch origin
git checkout production
git pull origin production
git merge --no-ff feat/lootit-split -m "Merge feat/lootit-split: extract LootIT into its own Railway service"
git push origin production
```

**IMPORTANT:** Because Vite inlines `import.meta.env.VITE_*` at build time, the env var only takes effect after a rebuild/redeploy. Setting the var without redeploying means the old bundle still has the fallback URL.

**Verification after deploy:**
1. Visit portalit.gtools.io
2. Click sidebar LootIT link
3. Confirm navigation to lootit-frontend URL
4. SSO cookie will NOT carry until Plan 04-07 adds lootit.gtools.io subdomain (expected)

## Rollback Instructions

If the external link causes problems after production deploy:
1. `git revert <merge-commit-sha>` on production branch
2. `git push origin production`
3. Railway auto-redeploys -- portalit reverts to in-app LootIT routing
4. Source files in src/components/lootit/* are intact (D-35)

## Next Phase Readiness
- Plan 04-07 can proceed once production deploy is verified
- Plan 04-07 adds lootit.gtools.io custom domain for SSO cookie sharing

---
*Phase: 04-lootit-service-extraction*
*Completed: 2026-04-16 (Tasks 1-3; Task 4 blocked on human action)*
