---
phase: 04-lootit-service-extraction
plan: 03
subsystem: frontend
tags:
  - vite
  - react
  - routing
  - supabase
  - sso
  - shadcn
  - tanstack-query
dependency_graph:
  requires:
    - "04-01 (apps/lootit/ scaffold — package.json, vite config, Docker/Caddy)"
    - "04-02 (apps/lootit/src/lib/auth-storage.js — createAuthStorage factory)"
  provides:
    - "apps/lootit/src/ standalone LootIT frontend with providers, routes, and pages"
    - "apps/lootit/src/api/client.js wired with cookie auth storage for cross-subdomain SSO"
    - "apps/lootit/src/components/RequireAuth.jsx SSO redirect guard"
    - "apps/lootit/src/Layout.jsx minimal chrome (sidebar + sign-out + Back to PortalIT)"
    - "apps/lootit/src/pages/{Dashboard,CustomerDetail,Settings}Page.jsx route wrappers"
    - "Green apps/lootit/dist/ build artifact (736 KB, ~198 KB gzip)"
  affects:
    - "04-04 (src/lib/auth-storage.js byte-copy + src/api/client.js wiring on portalit side)"
    - "04-05 (Railway service deploy — uses apps/lootit/ as Root Directory, no further code changes needed)"
    - "04-06 (portalit cutover + LootIT menu link to VITE_LOOTIT_URL)"
tech_stack:
  added: []  # all deps already provisioned by 04-01
  patterns:
    - "Verbatim file duplication (D-06/D-08) — 34 source files copied byte-identically from portalit src/"
    - "Single-file wire-in edit (api/client.js) — exactly 2 added lines vs portalit source"
    - "Route-param-driven customer fetch inside CustomerDetailPage (adapts to LootITCustomerDetail's `customer` object prop contract)"
    - "Full shadcn CSS variable token block in apps/lootit/src/index.css (light + dark themes, layout-shift guards)"
key_files:
  created:
    - apps/lootit/src/api/client.js
    - apps/lootit/src/lib/AuthContext.jsx
    - apps/lootit/src/lib/utils.js
    - apps/lootit/src/lib/lootit-reconciliation.js
    - apps/lootit/src/lib/query-client.js
    - apps/lootit/src/hooks/useAutoRetry.js
    - apps/lootit/src/hooks/useCustomerData.js
    - apps/lootit/src/hooks/useReconciliationData.js
    - apps/lootit/src/hooks/useReconciliationReviews.js
    - apps/lootit/src/hooks/useReconciliationRules.js
    - apps/lootit/src/components/ui/sheet.jsx
    - apps/lootit/src/components/ui/table.jsx
    - apps/lootit/src/components/ui/tooltip.jsx
    - apps/lootit/src/components/ui/button.jsx
    - apps/lootit/src/components/ui/dialog.jsx
    - apps/lootit/src/components/ui/label.jsx
    - apps/lootit/src/components/ui/input.jsx
    - apps/lootit/src/components/lootit/ContractCard.jsx
    - apps/lootit/src/components/lootit/ContractTab.jsx
    - apps/lootit/src/components/lootit/CustomerDetailHeader.jsx
    - apps/lootit/src/components/lootit/DetailDrawer.jsx
    - apps/lootit/src/components/lootit/LineItemPicker.jsx
    - apps/lootit/src/components/lootit/lootit-constants.js
    - apps/lootit/src/components/lootit/LootITCustomerDetail.jsx
    - apps/lootit/src/components/lootit/LootITDashboard.jsx
    - apps/lootit/src/components/lootit/LootITSettings.jsx
    - apps/lootit/src/components/lootit/Pax8GroupMapper.jsx
    - apps/lootit/src/components/lootit/Pax8SubscriptionCard.jsx
    - apps/lootit/src/components/lootit/ReconciliationBadge.jsx
    - apps/lootit/src/components/lootit/ReconciliationTab.jsx
    - apps/lootit/src/components/lootit/RecurringTab.jsx
    - apps/lootit/src/components/lootit/RuleEditorDialog.jsx
    - apps/lootit/src/components/lootit/ServiceCard.jsx
    - apps/lootit/src/components/lootit/SignOffButton.jsx
    - apps/lootit/src/components/lootit/UploadProgressCard.jsx
    - apps/lootit/src/components/RequireAuth.jsx
    - apps/lootit/src/pages/DashboardPage.jsx
    - apps/lootit/src/pages/CustomerDetailPage.jsx
    - apps/lootit/src/pages/SettingsPage.jsx
  modified:
    - apps/lootit/src/App.jsx
    - apps/lootit/src/Layout.jsx
    - apps/lootit/src/index.css
decisions:
  - "query-client.js exports `queryClientInstance` (not `queryClient`) — App.jsx import adjusted per plan's explicit instruction to match AuthContext/query-client field names"
  - "LootITCustomerDetail takes `customer` (full object) + onBack/activeTab/onTabChange, NOT customerId — CustomerDetailPage fetches customer via useQuery and passes the full object, mirroring the src/pages/LootIT.jsx pattern from portalit"
  - "DashboardPage wires onSelectCustomer callback from LootITDashboard to navigate(/customers/:id?tab=...) instead of needing ref modifications to LootITDashboard"
  - "Full shadcn CSS variable block copied from portalit src/index.css (125 lines) — safer than trimming because every shadcn primitive references --background, --border, --ring, etc."
  - "AuthContext confirmed to expose isAuthenticated + isLoadingAuth (not isLoading) — RequireAuth destructure matches plan's Pattern 2 verbatim"
metrics:
  duration_seconds: 193
  duration_human: "~3 min"
  tasks_completed: 3
  files_created: 40
  files_modified: 3
completed: 2026-04-15
---

# Phase 4 Plan 03: LootIT App Frontend Copy and Wiring Summary

**One-liner:** Copied 34 LootIT source files byte-identically from portalit src/ into apps/lootit/src/, wired api/client.js to the cookie auth storage adapter (+2 lines), and built the App shell (providers + routes + RequireAuth SSO guard + Layout chrome + 3 page wrappers) to a green 736 KB production bundle.

## Performance

- **Duration:** ~193 seconds (~3 min) start-to-finish
- **Started:** 2026-04-15T22:48:11Z
- **Tasks:** 3 of 3 complete
- **Files created:** 40 (34 verbatim copies + 6 new shell files)
- **Files modified:** 3 (App.jsx, Layout.jsx, index.css — Plan 04-01 placeholders replaced)

## Task Commits

Each task committed atomically with `--no-verify`:

| # | Task | Commit | Type |
|---|------|--------|------|
| 1 | Copy lib/hooks/ui/lootit files verbatim (34 files) | `60dad4a` | feat |
| 2 | Copy api/client.js and wire cookie auth storage adapter | `106ebcf` | feat |
| 3 | Write App shell, Layout, RequireAuth, pages, CSS tokens | `a03e6b3` | feat |

## Final list of files copied

### lib/ (4 files, byte-identical)
- AuthContext.jsx, utils.js, lootit-reconciliation.js, query-client.js

### hooks/ (5 files, byte-identical)
- useAutoRetry.js, useCustomerData.js, useReconciliationData.js, useReconciliationReviews.js, useReconciliationRules.js

### components/ui/ (7 files, byte-identical)
- sheet.jsx, table.jsx, tooltip.jsx, button.jsx, dialog.jsx, label.jsx, input.jsx

### components/lootit/ (18 files, byte-identical — matches `ls src/components/lootit/ | wc -l`)
- ContractCard.jsx, ContractTab.jsx, CustomerDetailHeader.jsx, DetailDrawer.jsx, LineItemPicker.jsx, lootit-constants.js, LootITCustomerDetail.jsx, LootITDashboard.jsx, LootITSettings.jsx, Pax8GroupMapper.jsx, Pax8SubscriptionCard.jsx, ReconciliationBadge.jsx, ReconciliationTab.jsx, RecurringTab.jsx, RuleEditorDialog.jsx, ServiceCard.jsx, SignOffButton.jsx, UploadProgressCard.jsx

### api/ (1 file, 2-line diff vs source)
- client.js — **+2 added lines, 0 deletions** vs `src/api/client.js`:
  - `import { createAuthStorage } from '@/lib/auth-storage';`
  - `storage: createAuthStorage(),` inside `createClient({ auth: { ... } })`

### Shell files (6 new, 3 replaced)
- **New:** `components/RequireAuth.jsx`, `pages/DashboardPage.jsx`, `pages/CustomerDetailPage.jsx`, `pages/SettingsPage.jsx`
- **Replaced:** `App.jsx` (full provider stack + routes), `Layout.jsx` (sidebar + sign-out + Back-to-PortalIT), `index.css` (full shadcn CSS variable block from portalit)

## npm packages added beyond Plan 04-01

**None.** Every import from copied files resolved against the dependency list 04-01 pinned. The import audit (`grep -rh "from ['\"]@/" ...`) showed every `@/` import resolves inside `apps/lootit/src/`, and every non-`@/` import matches a package already in `apps/lootit/package.json`.

## Exact diff count vs portalit's src/api/client.js

```
$ diff src/api/client.js apps/lootit/src/api/client.js
1a2
> import { createAuthStorage } from '@/lib/auth-storage';
11a13
>     storage: createAuthStorage(),
```

**Exactly 2 added lines, 0 deletions.** Matches acceptance criterion (`diff | grep '^>' | wc -l = 2` and `diff | grep '^<' | wc -l = 0`).

## dist/ build output

```
apps/lootit/dist/
├── index.html                      0.46 kB │ gzip:   0.30 kB
└── assets/
    ├── index-DDA7BQk7.css          52.23 kB │ gzip:   9.37 kB
    └── index-CDp-8Ayu.js          691.98 kB │ gzip: 198.32 kB
```

- **Total size:** 736 KB on disk (~208 KB gzipped)
- **Asset count:** 3 (index.html + 1 JS chunk + 1 CSS chunk)
- **Under 3MB ceiling:** YES (24% of budget)
- **Build time:** 1.57s cold
- **Modules transformed:** 2081
- **Warnings:** Only non-blocking advisories — browserslist data 7 months old (not our dep), tailwind `duration-[250ms]` ambiguity in an existing LootIT component (pre-existing, out of scope per Rule 1-3 scope boundary), and the 500 KB chunk size warning (expected — LootIT bundles React + TanStack Query + Radix primitives + Supabase into a single chunk; code-splitting is deferred to a future optimization plan).

## Modifications made to copied files to resolve build errors

**None.** All 34 verbatim copies worked at build time without any edits. The only modification to a "copy" was the intentional 2-line wire-in of createAuthStorage into `api/client.js` (Task 2), which is a plan-mandated edit and not a bug fix.

## AuthContext field names (note for Plan 04-04)

Confirmed via `grep` in `apps/lootit/src/lib/AuthContext.jsx` that `useAuth()` exposes:
- `isAuthenticated` (boolean) — line 131
- `isLoadingAuth` (boolean) — line 132
- `isLoadingPublicSettings` (boolean) — line 133
- `user` — from session state

**Plan 04-04 must use the same field names** when wiring the portalit-side `src/api/client.js` / `src/lib/auth-storage.js` and any portalit-side RequireAuth. No API drift needed — AuthContext.jsx was copied byte-identical, so both apps share the identical contract.

## LootITCustomerDetail props contract (IMPORTANT note for Plan 04-04)

**LootITCustomerDetail's signature is:**
```jsx
export default function LootITCustomerDetail({ customer, onBack, activeTab: activeTabProp = 'reconciliation', onTabChange }) { ... }
```

It takes a full `customer` **object** (not a `customerId` string). This required CustomerDetailPage to fetch the customer by id via `useQuery` before rendering — mirroring the pattern in `src/pages/LootIT.jsx` on portalit. Built the CustomerDetailPage to:
1. Extract `customerId` from `useParams()`
2. Fetch via `client.entities.Customer.filter({ id: customerId })`
3. Render loading spinner while fetching
4. Render "Customer not found" if fetch returns no rows
5. Pass the full customer object + `activeTab` from `?tab=` query param + `onTabChange` callback that updates query params + `onBack` callback that navigates to `/`

The plan explicitly predicted this possibility ("IMPORTANT: Read LootITCustomerDetail.jsx to check its top-level props. If it takes `customerId` as a prop, pass it. If it reads from useParams internally, just render `<LootITCustomerDetail />`. Match whatever the component already expects — do NOT modify LootITCustomerDetail.jsx.") — this branch is the third case (full object), and the plan's intent was clearly honored: LootITCustomerDetail itself was not touched.

## Deviations from Plan

### [Rule 3 - Blocking issue] query-client.js named export is `queryClientInstance`, not `queryClient`

- **Found during:** Task 3 (App.jsx write)
- **Issue:** The plan's example App.jsx uses `import { queryClient } from '@/lib/query-client'`, but the actual file exports `queryClientInstance`. A literal copy of the plan snippet would have failed at build time with `SyntaxError: The requested module '/src/lib/query-client.js' does not provide an export named 'queryClient'`.
- **Fix:** Used `import { queryClientInstance } from '@/lib/query-client'` and passed `client={queryClientInstance}` to `QueryClientProvider`. The plan explicitly anticipated this — it says "read apps/lootit/src/lib/query-client.js to confirm whether it exports `queryClient` as a named export or as default. Adjust the import line to match."
- **Files modified:** `apps/lootit/src/App.jsx`
- **Commit:** `a03e6b3`

### [Rule 2 - Critical functionality] LootITCustomerDetail requires full customer object, not customerId

- **Found during:** Task 3 (CustomerDetailPage write)
- **Issue:** The plan's example CustomerDetailPage renders `<LootITCustomerDetail customerId={customerId} />`, but LootITCustomerDetail actually takes `customer={customerObject}`. A literal copy would have rendered a blank detail page (customer undefined → every field access crashes or silently fails).
- **Fix:** Added a `useQuery` fetch inside CustomerDetailPage that mirrors the existing portalit src/pages/LootIT.jsx pattern — extract customerId from useParams, fetch via `client.entities.Customer.filter`, pass the fetched object as `customer` prop. Also added loading spinner + "Customer not found" fallback + onBack navigation + onTabChange URL sync. The plan explicitly flagged this branch as a possibility.
- **Files modified:** `apps/lootit/src/pages/CustomerDetailPage.jsx`
- **Commit:** `a03e6b3`

### [Rule 2 - Critical functionality] DashboardPage needs onSelectCustomer callback wiring

- **Found during:** Task 3 (DashboardPage write)
- **Issue:** LootITDashboard signature is `function LootITDashboard({ onSelectCustomer })` — it calls `onSelectCustomer(customer, 'reconciliation')` when the user clicks a customer row. The plan's example DashboardPage rendered `<LootITDashboard />` with no props, which would have left customer-selection broken (clicking a row throws because onSelectCustomer is undefined).
- **Fix:** DashboardPage now wraps a `navigate(/customers/:id?tab=...)` callback and passes it as onSelectCustomer. Matches the handleSelectCustomer pattern from src/pages/LootIT.jsx.
- **Files modified:** `apps/lootit/src/pages/DashboardPage.jsx`
- **Commit:** `a03e6b3`

### Plan 04-01 placeholders replaced (expected)

`App.jsx`, `Layout.jsx`, and `index.css` were modified (not created) because Plan 04-01 seeded them with minimal placeholders. This is intentional and anticipated by Plan 04-03's `files_modified` frontmatter.

## Threat Flags

None. No new network endpoints, no new auth paths, no new file-access patterns, no schema changes. The cookie-based auth flow surface was already in the phase's threat register (introduced by 04-02 and scheduled for security-reviewer pass in 04-04).

## Known Stubs

None. Every component is fully wired — no mock data, no hardcoded placeholders, no TODO markers. The Layout's `user?.email` display is live-bound to AuthContext, the sign-out handler is live-bound to supabase.auth.signOut(), and the routes all render real LootIT components with real data hooks.

## Issues Encountered

None beyond the three deviations documented above (all Rule 2/Rule 3 auto-fixes the plan explicitly anticipated and instructed me to handle).

## Build warnings (non-blocking, pre-existing — out of scope)

1. `baseline-browser-mapping` data 2 months old — not in our dependency graph, upstream advisory only
2. `caniuse-lite` data 7 months old — upstream advisory only
3. `duration-[250ms]` tailwind ambiguity — pre-existing in one of the copied LootIT components; documented per Rule 1-3 scope boundary (only auto-fix issues caused by the current task's changes)
4. 500 KB chunk size warning — expected for a single-chunk SPA with React + TanStack Query + Radix + Supabase; code-splitting is deferred

## Self-Check: PASSED

**File existence:**
- `apps/lootit/src/api/client.js` FOUND
- `apps/lootit/src/App.jsx` FOUND
- `apps/lootit/src/Layout.jsx` FOUND
- `apps/lootit/src/components/RequireAuth.jsx` FOUND
- `apps/lootit/src/pages/DashboardPage.jsx` FOUND
- `apps/lootit/src/pages/CustomerDetailPage.jsx` FOUND
- `apps/lootit/src/pages/SettingsPage.jsx` FOUND
- `apps/lootit/src/index.css` FOUND
- `apps/lootit/src/lib/AuthContext.jsx` FOUND + byte-identical to src/lib/AuthContext.jsx
- `apps/lootit/src/lib/query-client.js` FOUND
- `apps/lootit/src/lib/lootit-reconciliation.js` FOUND + byte-identical
- `apps/lootit/src/lib/utils.js` FOUND + byte-identical
- `apps/lootit/src/hooks/useReconciliationData.js` FOUND + byte-identical
- `apps/lootit/src/components/ui/{sheet,table,tooltip,button,dialog,label,input}.jsx` ALL FOUND + byte-identical
- `apps/lootit/src/components/lootit/*` — 18 files (matches `ls src/components/lootit/ | wc -l = 18`)
- `apps/lootit/dist/index.html` FOUND (built artifact, gitignored)

**Commits:**
- `60dad4a` — FOUND in `git log`
- `106ebcf` — FOUND in `git log`
- `a03e6b3` — FOUND in `git log`

**Build result:**
- `cd apps/lootit && npm run build` → exit 0, dist/ 736 KB (under 3MB ceiling)

**Wiring acceptance:**
- `grep -q "import { createAuthStorage } from '@/lib/auth-storage'" apps/lootit/src/api/client.js` PASS
- `grep -q "storage: createAuthStorage()" apps/lootit/src/api/client.js` PASS
- `diff src/api/client.js apps/lootit/src/api/client.js | grep -c '^>' = 2` PASS
- `diff src/api/client.js apps/lootit/src/api/client.js | grep -c '^<' = 0` PASS
- Every `@/` import in apps/lootit/src/ resolves inside apps/lootit/src/ (no imports escape the app directory)

## Next Plan Readiness

**Plan 04-04** (portalit-side wire-in) can now:
1. `cp apps/lootit/src/lib/auth-storage.js src/lib/auth-storage.js` per D-19 (byte-identical duplicate)
2. Apply the same 2-line edit to `src/api/client.js` (portalit side):
   - Add `import { createAuthStorage } from '@/lib/auth-storage';`
   - Add `storage: createAuthStorage(),` inside the existing `createClient({ auth: {...} })` call
3. Run portalit's existing verification (npm run build + dev smoke) — the D-18 backcompat read path ensures existing localStorage sessions keep working through the transition.

**Plan 04-05** (Railway deploy) can now point a new `lootit-frontend` service at `apps/lootit/` as Root Directory with zero code changes. The Dockerfile/Caddyfile/nixpacks.toml from 04-01 + the buildable src/ from 04-03 are deploy-ready. Environment variables needed at deploy time: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_BASE_URL`, `VITE_PORTALIT_URL` (for RequireAuth redirect and Back-to-PortalIT link).

---
*Phase: 04-lootit-service-extraction-split-lootit-into-its-own-railway-*
*Plan: 03*
*Completed: 2026-04-15*
