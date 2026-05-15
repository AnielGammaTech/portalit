# PortalIT Integration Audit Report

Generated: 2026-04-16

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Critical Findings (Reported Issues)](#critical-findings)
3. [Integration Details](#integration-details)
4. [Cron Schedule](#cron-schedule)
5. [Recommendations](#recommendations)

---

## Executive Summary

Audited **20 integration sync functions** across `server/src/functions/`. Found **4 critical data-loss bugs** directly explaining the reported issues, plus **8 medium-severity problems** across other integrations.

### Root Causes of Reported Issues

| Issue | Root Cause | Severity |
|-------|-----------|----------|
| **Spanning/Unitrends missing data** | NO PAGINATION on users endpoint -- `page_size=1000` is hardcoded and there is no loop to fetch subsequent pages. Tenants with >1000 users silently lose the rest. | CRITICAL |
| **Datto EDR missing data** | `sync_all` does NOT paginate agents -- fetches only the first page from `/agents`. Also, `hosts.slice(0, 100)` in cached_data truncates the device list to 100 even when more exist. | CRITICAL |
| **JumpCloud not bringing all companies** | `list_organizations` in `syncJumpCloudLicenses.js` does NOT paginate -- single call returns default page size. The scheduled sync in `scheduledJumpCloudSync.js` iterates only the mappings already in `jump_cloud_mappings`, so unmapped orgs are never discovered. SSO app user counts also lack pagination (`/applications/{id}/users` returns at most default page size). | HIGH |
| **RocketCyber only stores agent COUNT** | Confirmed. `fetchAgentCount()` extracts only a number from the response. Individual agent records (hostname, OS, IP, status) are discarded. `cached_data` stores `total_agents: <number>` only. No `agents` array is persisted. | CRITICAL |

---

## Critical Findings

### 1. Spanning/Unitrends -- Missing Users (NO PAGINATION)

**Files:** `syncSpanningBackup.js`, `scheduledSpanningSync.js`

**Bug:** Every call to the users endpoint uses a single request:
```
/v2/spanning/domains/{id}/users?page_size=1000
```
There is **no pagination loop**. If a tenant has more than 1000 users, only the first 1000 are returned. The Unitrends/Spanning API likely supports `page` or continuation tokens, but the code never requests page 2+.

**Impact:** Any customer with >1000 M365 users shows incomplete backup data, incorrect license counts, and missing contact sync entries.

**Also:** The domains endpoint uses `page_size=500` with no pagination, though it is unlikely any MSP has >500 tenants.

**Fix:** Add a pagination loop similar to the one in `scheduledJumpCloudSync.js`:
```js
let allUsers = [];
let page = 1;
while (true) {
  const resp = await unitrendsApiCall(`/v2/spanning/domains/${tenantId}/users?page_size=1000&page=${page}`);
  const users = parseUsersResponse(resp);
  allUsers = allUsers.concat(users);
  if (users.length < 1000) break;
  page++;
}
```

### 2. Datto EDR -- Missing Agents in sync_all (NO PAGINATION)

**File:** `syncDattoEDR.js`

**Bug (sync_all action, line 452-462):** The `sync_all` code path fetches agents with a single call:
```js
const agentsUrl = addAuth(`${DATTO_EDR_BASE_URL}/agents`);
const agentsRes = await fetch(agentsUrl, { headers });
```
No `$skip`/`$top` pagination. Only the first page of agents is returned (API default, likely 100 or fewer).

The `sync_customer` action (line 142-154) DOES paginate correctly with `$skip` and `$top=100`, but `sync_all` -- which is what the cron job runs -- does NOT.

**Second bug (line 219, 495):** `hosts.slice(0, 100)` truncates the device list stored in `cached_data` to 100 entries. Even if pagination works, customers with >100 agents will have an incomplete list in the cache.

**Impact:** The nightly sync (`sync_all`) loses agents for every EDR tenant. Manual per-customer syncs work correctly.

**Fix:**
1. In `sync_all`, use the same pagination loop from `sync_customer` (target-scoped endpoint with `$skip/$top`).
2. Remove or increase the `.slice(0, 100)` limit on `hosts` in `cached_data`, or store all agents.

### 3. JumpCloud -- Missing Organizations and Users

**File:** `syncJumpCloudLicenses.js`

**Bug:** The `list_organizations` action uses `fetchAllOrganizations()` which correctly paginates, BUT the SSO application user-list calls do NOT paginate:
```js
const users = await jumpcloudV2ApiCall(`/applications/${app.id}/users`, orgId);
userCount = users?.length || 0;
```
JumpCloud V2 API returns paginated results (default 50 per page). Applications with >50 assigned users will report incorrect counts.

**Structural issue:** The system only syncs organizations that are already mapped in `jump_cloud_mappings`. There is no automated discovery of new organizations added to the JumpCloud MTP account. The user must manually go to Settings and re-map.

**File:** `scheduledJumpCloudSync.js` -- The scheduled sync correctly paginates users (`/systemusers?limit=100&skip=N`) but the V2 applications endpoint is not paginated:
```js
const applications = await jumpcloudV2ApiCall('/applications', orgId);
```
This returns only the first page of applications (default 50).

**Impact:** SSO app counts are understated. New JumpCloud orgs are never discovered automatically.

**Fix:**
1. Paginate `/v2/applications` and `/v2/applications/{id}/users` endpoints.
2. Add an auto-discovery step that calls `fetchAllOrganizations()` and creates mappings for any new orgs found.

### 4. RocketCyber -- Only Stores Agent Count

**File:** `syncRocketCyber.js`

**Bug:** The `fetchAgentCount()` function (lines 111-138) tries 4 different API endpoints to get agent data, but then calls `extractAgentCount()` which **discards the response body** and returns only a count:
```js
const count = extractAgentCount(data);
if (count > 0) return count;
```

The individual agent records (hostname, OS, IP address, online/offline status, last seen timestamp) are never stored. `cached_data` stores:
```json
{
  "total_agents": 42,
  "totalIncidents": 15,
  "openIncidents": 3,
  ...
}
```

No `agents` array exists in the cache. The `get_agents` action (line 318-325) makes a live API call but doesn't store anything.

**Impact:** The frontend can display agent counts but cannot show a device list, device details, or online/offline status per device. This is unlike every other integration (Datto RMM, UniFi, Cove, EDR) which stores individual device records.

**Fix:** Replace `fetchAgentCount()` with `fetchAgentDetails()` that returns both count and individual agent records. Store the array in `cached_data.agents` and persist individual records to a `rocket_cyber_agents` table (or reuse the `devices` table with `source: 'rocketcyber'`).

---

## Integration Details

### HaloPSA (PSA -- Core CRM)

**Files:** `scheduledHaloPSASync.js`, `syncHaloPSACustomers.js`, `syncHaloPSAContacts.js`, `syncHaloPSAContracts.js`, `syncHaloPSATickets.js`, `syncHaloPSAInvoices.js`, `syncHaloPSARecurringBills.js`
**Cron:** Daily at 2:00 AM (customers/contacts/contracts/tickets), 2:15 AM (recurring bills), 2:30 AM (invoices)
**Tables:** `customers`, `contacts`, `contracts`, `tickets`, `halopsa_recurring_bills`, `halopsa_recurring_bill_lines`, `halopsa_invoices`, `halopsa_invoice_lines`, `sync_logs`

**What it syncs:**
- Customers (with site addresses), contacts, contracts, tickets
- Recurring bill headers + line items
- Invoice headers + line items

**Pagination:** Properly paginated with `page_size=1000` and page loop (max 20 pages). Tickets fetch only 50 most recent per customer.

**Sync strategy:** Full resync every night. Upserts by `external_id`. Does NOT delete stale records.

**cached_data:** No mapping table -- data goes directly to normalized tables.

**Issues:**
- Tickets limited to 50 most recent per customer (intentional for performance, but total count is saved separately)
- Contacts are fetched with `page_size=500`, no pagination loop (could miss contacts for very large clients)
- Uses `Promise.allSettled` for concurrency which is good, but errors in individual customer syncs don't halt the batch

**Status:** HEALTHY -- most mature integration.

---

### Datto RMM (RMM Devices)

**Files:** `syncDattoRMMDevices.js`, `scheduledDattoSync.js`, `fetchDattoRMMBilling.js`
**Cron:** Daily at 3:00 AM
**Tables:** `devices`, `datto_site_mappings`

**What it syncs:** All devices per site -- hostname, OS, IP, device type, online status, last seen, last user.

**Pagination:** Correctly paginated with `page=0` (0-based) and `max=250` per page, with safety limit of 50 pages (12,500 devices max).

**Sync strategy:** Full resync. Upserts by `external_id`. Deletes stale devices (only if API returned >0 results -- good safety check).

**cached_data:** `{ total_devices, online_count, offline_count, server_count, workstation_count }`

**Issues:**
- `automap` action does NOT paginate sites (single API call)
- `getDattoAccessToken` is duplicated between `syncDattoRMMDevices.js` and `scheduledDattoSync.js`
- No delta sync -- re-fetches all devices every night even if nothing changed

**Status:** HEALTHY -- pagination and deletion logic are solid.

---

### Datto EDR (Endpoint Detection & Response)

**File:** `syncDattoEDR.js`
**Cron:** Daily at 3:15 AM (action: `sync_all`)
**Tables:** `datto_edr_mappings`

**What it syncs:** Agents (hostname, IP, OS, online status, last seen), alert counts.

**Pagination:**
- `sync_customer`: YES -- paginates with `$skip/$top=100` on target-scoped endpoint
- `sync_all` (CRON): **NO** -- single fetch of `/agents` with no pagination

**cached_data:** `{ hostCount, activeHostCount, hosts: [...], alertCount, criticalAlerts, ... }`
- `hosts` array is TRUNCATED to 100 entries via `.slice(0, 100)`

**Issues:**
- **CRITICAL:** `sync_all` does not paginate (see Critical Findings #2)
- **HIGH:** `.slice(0, 100)` truncates cached host list
- Alert breakdown (critical/medium/low) is always 0 -- never populated from API
- `sync_all` uses global `/agents` endpoint and filters client-side, instead of using per-target endpoints like `sync_customer` does

**Status:** BROKEN for nightly sync.

---

### Spanning/Unitrends (M365 Backup)

**Files:** `syncSpanningBackup.js`, `scheduledSpanningSync.js`
**Cron:** Daily at 5:00 AM
**Tables:** `spanning_mappings`, `contacts` (updates `spanning_status` column)

**What it syncs:** Per-user backup status, storage usage, license counts, domain-level statistics (SharePoint, Teams).

**Pagination:** **NONE** on users endpoint -- hardcoded `page_size=1000`, no page loop.

**cached_data:** Rich structure with `users[]` array, license counts, storage totals, backup status for last 7 days, SharePoint/Teams counts.

**Issues:**
- **CRITICAL:** No pagination on users (see Critical Findings #1)
- SharePoint sites and Teams channels return only summary COUNTS, not individual records (by design -- Unitrends API limitation noted in code comments)
- Duplicated code between `syncSpanningBackup.js` (660 lines) and `scheduledSpanningSync.js` (278 lines) -- `formatUser`, `buildCacheData`, token management are duplicated
- Never creates new contacts from Spanning -- only updates existing contacts with `spanning_status`

**Status:** BROKEN for tenants with >1000 users.

---

### JumpCloud (Identity Directory)

**Files:** `syncJumpCloudLicenses.js`, `scheduledJumpCloudSync.js`, `fetchJumpCloudBilling.js`
**Cron:** Daily at 4:00 AM
**Tables:** `jump_cloud_mappings`, `contacts`, `saas_licenses`

**What it syncs:** Users (to contacts), SSO applications (to saas_licenses), JumpCloud platform license.

**Pagination:**
- Users (`/systemusers`): YES -- paginated with `limit=100&skip=N`
- Organizations: YES -- `fetchAllOrganizations()` paginates
- Applications (`/v2/applications`): **NO** -- single call, default page size
- Application users (`/v2/applications/{id}/users`): **NO** -- single call

**cached_data:** `{ totalUsers, ssoApps, usersCreated, usersUpdated, licensesCreated, licensesUpdated }`

**Issues:**
- **HIGH:** SSO application list and per-app user counts not paginated
- **MEDIUM:** No auto-discovery of new organizations -- only syncs what's mapped
- Duplicated code between `syncJumpCloudLicenses.js` (654 lines) and `scheduledJumpCloudSync.js` (285 lines)
- `catch {}` empty blocks swallow errors silently on app user count fetches

**Status:** PARTIALLY BROKEN -- user sync works, SSO app data may be incomplete.

---

### RocketCyber (SOC / Security)

**File:** `syncRocketCyber.js`
**Cron:** Daily at 3:30 AM
**Tables:** `rocket_cyber_mappings`, `rocket_cyber_incidents`

**What it syncs:** Security incidents (title, description, severity, status, hostname, app).

**Pagination:** Incidents are correctly paginated (pageSize=100, max 20 pages = 2000 incidents).

**Agent sync:** Fetches only a COUNT. Individual agent records are discarded.

**cached_data:** `{ total_agents, totalIncidents, openIncidents, resolvedIncidents, bySeverity: {...} }`

**Issues:**
- **CRITICAL:** Agent details not stored (see Critical Findings #4)
- `list_accounts` action caps customer fetching at 100 (`idsToFetch = customerIds.slice(0, 100)`)
- In-memory `endpointCache` for incident endpoint detection resets on server restart

**Status:** BROKEN for agent detail reporting.

---

### Cove Data Protection (N-able Backup)

**File:** `syncCoveData.js`
**Cron:** Daily at 4:30 AM
**Tables:** `cove_data_mappings`

**What it syncs:** Backup devices -- computer name, OS type, last backup status, storage used, errors.

**Pagination:** Uses `RecordsCount: 250` parameter. No pagination loop -- **hardcoded limit of 250 devices**.

**cached_data:** Rich -- `{ totalDevices, workstation_count, server_count, activeDevices, devicesWithErrors, healthyDevices, totalStorageUsed, successRate, devices: [...] }`
- `devices` array truncated to 50 entries via `.slice(0, 50)` in both `sync_customer` and `sync_all`

**Issues:**
- **HIGH:** Hardcoded `RecordsCount: 250` -- customers with >250 backup devices lose data
- **MEDIUM:** Device list in cache truncated to 50
- Cove API uses JSON-RPC, not REST -- pagination may need `StartRecordNumber` parameter

**Status:** At risk for large customers (>250 devices).

---

### SaaS Alerts

**File:** `syncSaaSAlerts.js`
**Cron:** Daily at 5:30 AM
**Tables:** `saas_alerts_mappings`

**What it syncs:** Security events from last 7 days -- user, event type, severity, IP, location, VPN/threat indicators.

**Pagination:** Events limited to `size: 500` with no pagination loop.

**cached_data:** `{ summary: {critical,high,medium,low,info}, total_events, recent_events: [...100], monitored_apps, unique_users, event_type_counts, country_counts, period }`

**Issues:**
- **MEDIUM:** 500-event limit with no pagination -- high-volume tenants lose events
- Falls back from GET to POST (Elasticsearch DSL) -- fragile
- `recent_events` truncated to 100

**Status:** FUNCTIONAL for most customers, may lose data for high-event-volume tenants.

---

### UniFi (Network Devices)

**File:** `syncUniFiDevices.js`
**Cron:** Daily at 6:00 AM
**Tables:** `unifi_mappings`

**What it syncs:** Network devices -- type (firewall/switch/AP), status, firmware, uptime, IP, MAC.

**Pagination:** N/A -- UniFi API returns all devices per host in one call (`/ea/devices`).

**cached_data:** `{ devices: [...], summary: { total, online, offline, firewalls, switches, access_points }, synced_at }`

**Issues:**
- Cloud site device resolution uses 4 fallback strategies (siteId match, gateway MAC + name prefix, gateway MAC only, proxy endpoint) -- complex but thorough
- No device persistence to the `devices` table -- only stored in mapping `cached_data`
- No delta sync

**Status:** HEALTHY.

---

### Pax8 (Cloud Marketplace)

**File:** `syncPax8Subscriptions.js`
**Cron:** Daily at 6:30 AM
**Tables:** `pax8_mappings`

**What it syncs:** Active subscriptions grouped by product -- quantity, billing term, price, start date.

**Pagination:** Correctly paginated with `pax8Paginate()` -- page 0-based, size=200, max 20 pages (4000 subscriptions).

**cached_data:** `{ totalSubscriptions, totalQuantity, products: [{ name, quantity, subscriptions: [...] }], period }`

**Issues:**
- Product name resolution uses in-memory cache with 24h TTL -- lost on restart
- `syncCompanySubscriptions` returns `{ success: false, error }` on catch instead of throwing, which means `sync_all` silently counts it as success

**Status:** HEALTHY.

---

### 3CX (VoIP Phone Systems)

**File:** `sync3CX.js`
**Cron:** Daily at 4:15 AM
**Tables:** `threecx_mappings`

**What it syncs:** Extensions -- number, name, email, type (user/ring group/IVR/queue), status, registered.

**Pagination:** N/A -- 3CX returns all extensions in one call. Most instances have <200 extensions.

**Sync strategy:** Per-customer credentials (each customer has their own 3CX instance).

**cached_data:** `{ total_extensions, user_extensions, ring_groups, ivr_menus, queues, extensions: [...] }`

**Issues:**
- 15-second timeout per API call -- may fail for slow instances
- SSRF validation on instance URLs is good security practice
- No call log or usage data synced -- only extension list

**Status:** HEALTHY.

---

### CIPP / Microsoft 365

**File:** `syncCIPP.js`
**Cron:** Daily at 3:45 AM
**Tables:** `cipp_mappings`, `cipp_users`, `cipp_groups`, `cipp_mailboxes`

**What it syncs:** M365 users (with MFA status, licenses, sign-in activity), groups (with members), mailboxes.

**Pagination:** No pagination parameters used -- relies on CIPP API returning all records.

**Sync strategy:** DELETE + INSERT (destructive) -- clears all existing records for the customer before inserting. This means a failed sync leaves the customer with zero data.

**cached_data:** `{ users: N, groups: N, mailboxes: N }`

**Issues:**
- **HIGH:** Destructive sync -- `DELETE FROM cipp_users WHERE customer_id = X` before insert. If the subsequent insert fails, data is lost.
- Group member fetching uses batch of 5 with `Promise.allSettled` (good rate limiting)
- `ListSignIns` filter hardcoded to last 30 days
- Logs token prefix to console (line 58) -- minor security concern

**Status:** FUNCTIONAL but risky due to destructive sync pattern.

---

### Dark Web ID

**File:** `syncDarkWebID.js`
**Cron:** Daily at 4:45 AM
**Tables:** `dark_web_id_mappings`, `dark_web_compromises`

**What it syncs:** Compromised credentials -- email, domain, password, source/breach, dates, severity.

**Pagination:** None apparent -- API returns all compromises for an organization in one call.

**Sync strategy:** Incremental -- skips existing compromises by `darkweb_id`. Never deletes.

**Issues:**
- Complex auth fallback (Basic -> REST session -> form login -> cookie retry) -- fragile
- `sync_all` action is missing -- only `sync_customer` exists, so cron cannot run
- `password` field stored in database -- potential security/compliance risk if DB is compromised

**Status:** FUNCTIONAL but missing `sync_all` for cron.

---

### DMARC Report

**File:** `syncDmarcReport.js`
**Cron:** Daily at 5:15 AM
**Tables:** `dmarc_report_mappings`

**What it syncs:** Domain DMARC compliance -- stats (compliant/non-compliant), top senders, DNS records (SPF/DKIM/DMARC/BIMI), aggregate report stats for last 30 days.

**Pagination:** N/A for domains. Stats are aggregated server-side.

**cached_data:** `{ totalDomains, activeDomains, totalMessages, complianceRate, domains: [...with dns, top_sources, stats] }`

**Issues:**
- Fetches DNS records + aggregate stats + top sources for EACH domain -- can be slow with many domains
- No error handling on stats/sources/dns fetches (empty catch blocks)

**Status:** HEALTHY.

---

### Inky (Email Security)

**File:** `syncInky.js`
**Cron:** Not scheduled (manual/extension only)
**Tables:** `inky_reports`

**What it syncs:** Per-team user counts via dashboard API. Matches teams to customers by name.

**Pagination:** N/A -- team structure comes from permissions endpoint.

**Issues:**
- Requires a bearer token passed per-request (not stored in env vars)
- User count retrieval tries 4 different approaches per team -- fragile
- Not in cron schedule -- data only updates when manually triggered or via browser extension

**Status:** FUNCTIONAL but manual-only.

---

### vPenTest

**File:** `syncVPenTest.js`
**Cron:** Daily at 6:15 AM
**Tables:** `vpentest_mappings`

**What it syncs:** Assessments and findings -- severity, affected hosts, CVSS scores, recommendations.

**Pagination:** Correctly paginated (`page=N&per_page=100`, max 20 pages).

**cached_data:** `{ assessments: [...], latest_assessment, findings: [...], summary: { total, critical, high, medium, low, info } }`

**Status:** HEALTHY.

---

### Vultr (Cloud Infrastructure)

**File:** `syncVultr.js`
**Cron:** Daily at 5:45 AM
**Tables:** `vultr_mappings`

**What it syncs:** VPS instances -- label, hostname, OS, specs (RAM/CPU/disk), IPs, status, bandwidth.

**Pagination:** Correctly paginated with cursor-based pagination.

**cached_data:** `{ instance: {...}, bandwidth, synced_at }`

**Issues:**
- Only syncs ONE instance per customer (first mapping) -- customers with multiple Vultr instances need multiple mappings

**Status:** HEALTHY.

---

### BullPhish ID

**Cron:** Not found
**Files:** Not found

**Status:** NOT IMPLEMENTED -- no sync function exists.

---

## Cron Schedule

All times are server local time. Every job runs daily unless noted.

| Time | Job | Action | Category |
|------|-----|--------|----------|
| 2:00 AM | scheduledHaloPSASync | sync_now | halopsa |
| 2:15 AM | syncHaloPSARecurringBills | sync_now | halopsa |
| 2:30 AM | syncHaloPSAInvoices | sync_now | halopsa |
| 3:00 AM | scheduledDattoSync | sync_now | datto |
| 3:15 AM | syncDattoEDR | **sync_all** | datto |
| 3:30 AM | syncRocketCyber | **sync_all** | rocketcyber |
| 3:45 AM | syncCIPP | sync_all | cipp |
| 4:00 AM | scheduledJumpCloudSync | sync_now | jumpcloud |
| 4:15 AM | sync3CX | sync_all | threecx |
| 4:30 AM | syncCoveData | sync_all | cove |
| 4:45 AM | syncDarkWebID | sync_all | darkweb |
| 5:00 AM | scheduledSpanningSync | sync_now | spanning |
| 5:15 AM | syncDmarcReport | sync_all | dmarc |
| 5:30 AM | syncSaaSAlerts | sync_all | saas_alerts |
| 5:45 AM | syncVultr | sync_all | vultr |
| 6:00 AM | syncUniFiDevices | sync_all | unifi |
| 6:15 AM | syncVPenTest | sync_all | vpentest |
| 6:30 AM | syncPax8Subscriptions | sync_all | pax8 |
| 8:00 AM | licenseRenewalReminder | sync_now | system |
| 9:00 AM | autoSuspendUnusedLicenses | sync_now | system |
| Mon 7:00 AM | scanBillingAnomalies | scan | lootit |

**Total window:** 2:00 AM -- 9:00 AM (7 hours). All syncs run sequentially within each job but jobs can overlap if one runs long.

---

## Recommendations

### Priority 1 -- Fix Critical Data Loss (Immediate)

1. **Spanning: Add pagination loop** to all `users` API calls in both `syncSpanningBackup.js` and `scheduledSpanningSync.js`. Check Unitrends API docs for the pagination parameter (`page`, `offset`, or continuation token).

2. **Datto EDR: Fix `sync_all` pagination.** Copy the pagination loop from `sync_customer` into `sync_all`. Use the target-scoped endpoint (`/targets/{id}/agents`) instead of the global `/agents` endpoint. Remove the `.slice(0, 100)` truncation on cached hosts.

3. **RocketCyber: Store individual agent records.** Modify `fetchAgentCount()` to return the full agent array. Store agent details (hostname, OS, IP, status, lastSeen) in `cached_data.agents` and/or a `rocket_cyber_agents` table.

4. **JumpCloud: Paginate SSO applications and app users.** Add pagination loops for `/v2/applications` and `/v2/applications/{id}/users`. Consider adding auto-discovery of new organizations.

### Priority 2 -- Fix Medium Issues (This Week)

5. **Cove: Add pagination** -- use `StartRecordNumber` parameter to fetch beyond 250 devices. Remove `.slice(0, 50)` device truncation.

6. **CIPP: Fix destructive sync** -- use upsert pattern instead of DELETE+INSERT, or at minimum wrap in a transaction so failures don't leave empty tables.

7. **SaaS Alerts: Add pagination** for events beyond 500.

8. **Dark Web ID: Add `sync_all`** action so the cron job works. Also evaluate storing compromised passwords in the database.

### Priority 3 -- Code Quality (Next Sprint)

9. **Eliminate code duplication** -- `syncSpanningBackup.js` and `scheduledSpanningSync.js` share >200 lines of identical code. Same for JumpCloud's two files. Extract shared logic into a common module.

10. **Add delta/incremental sync** where APIs support it (Datto RMM, HaloPSA, Cove) using `last_synced` timestamps to reduce API load.

11. **Replace empty `catch {}` blocks** with proper error logging -- found in JumpCloud (app user counts), DMARC (stats/sources), and Cove (partner info).

12. **Add monitoring/alerting** for sync failures -- the `cron_job_runs` table captures results but nothing alerts on repeated failures.
