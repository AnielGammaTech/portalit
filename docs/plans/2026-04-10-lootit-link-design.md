# LootIT Link — Chrome Extension Design

## Overview

A contextual Chrome extension that detects when the user is on a vendor portal without API integration, scrapes relevant data (user counts, device counts, report metrics) from the page DOM, and syncs it to PortalIT LootIT with one click. Includes vendor-specific report upload.

**Goal:** Make the auditor's workflow faster — no more manually copying numbers between vendor portals and PortalIT.

## Supported Vendors (Phase 1)

| Vendor | Portal URL | What to scrape | Report upload |
|--------|-----------|----------------|---------------|
| INKY | app.inkyphishfence.com | Team List → mailboxes per team | Threat reports (PDF) |
| BullPhish ID | TBD | Campaign results, emails sent per customer | Phishing reports |
| Dark Web ID | TBD | Domains monitored, compromises per customer | Scan reports |
| 3CX | TBD | Extensions/users per customer | - |

Future vendors can be added by creating a new content script + scraper module.

## How It Works

1. **Auto-detect** — Extension icon lights up pink when on a known vendor portal, grey otherwise
2. **Scrape** — Content script detects the right page (team list, customer summary) and extracts data from the DOM using multiple strategies (table parsing, text parsing, DOM walking)
3. **Match** — Auto-matches vendor team/customer names to PortalIT customers using fuzzy name matching. Unmatched entries get a dropdown picker. Mappings are remembered across syncs.
4. **Sync** — One click sends all matched data to the PortalIT backend
5. **Upload** — For vendors that support reports, show a drag/drop upload area in the popup

## Popup UI

- **Dark header** with LootIT Link logo (pink L with circle, matching LootIT branding)
- **Vendor badge** — auto-detected vendor name + icon (e.g., "INKY", "BullPhish ID")
- **Status indicator** — green (data ready), amber (partial data), red (no data / navigate to right page)
- **Data preview** — scrollable table showing teams/customers with scraped counts
- **Customer matching** — auto-matched rows show checkmark, unmatched show dropdown to pick PortalIT customer
- **Sync button** — pink, prominent, centered
- **Upload section** — drag/drop area for PDF/file reports (only shown for vendors that support it)
- **Design** — dark header, pink accents, slate cards — matches LootIT's look and feel

## Data Flow

```
Vendor Portal Page
  → Content script scrapes DOM (vendor-specific logic)
  → Data stored in chrome.storage.local
  → Popup reads and displays preview
  → User reviews matches, fixes unmatched via dropdown
  → User clicks Sync
  → Extension calls PortalIT backend API with auth
  → Backend matches to customers, saves to vendor report tables
```

## Customer Matching

- Auto-match by name using fuzzy string matching (contains, word overlap)
- Manual override via dropdown picker in the popup
- Mappings persisted in `chrome.storage.local` as `{ vendorSlug: { "vendor-team-id": "portalit-customer-id" } }`
- Persisted mappings take priority over fuzzy matching on subsequent syncs
- PortalIT customer list fetched from backend and cached in extension storage (refreshed on each sync)

## Architecture

```
extensions/lootit-link/
  manifest.json           — MV3, permissions for all vendor domains
  popup.html              — single adaptive popup
  popup.js                — popup logic, vendor detection, sync
  content-scripts/
    inky.js               — INKY Team List scraper
    bullphish.js          — BullPhish ID scraper
    darkweb.js            — Dark Web ID scraper
    threecx.js            — 3CX scraper
  inject.js               — shared fetch interceptor (Bearer token capture)
  lib/
    matching.js           — fuzzy customer name matching
    api.js                — PortalIT backend communication + auth
    vendors.js            — vendor registry (URLs, labels, icons, scraper config)
  icons/
    icon-16.png           — toolbar icon (grey/inactive)
    icon-48.png           — popup icon
    icon-128.png          — Chrome Web Store icon
    icon-active-16.png    — toolbar icon (pink/active on vendor portal)
```

## Auth

- PortalIT auth via Supabase — prompted once, refresh token stored for auto-renewal
- Vendor auth captured via fetch interceptor (Bearer tokens from Keycloak/SSO) — used if vendor API calls are needed
- No vendor credentials stored — extension only scrapes DOM, no API auth required for Phase 1

## Backend Changes

- `POST /api/functions/syncInky` — already exists, `save_team_counts` action handles extension data
- Add similar `save_*` actions to existing sync functions for BullPhish, Dark Web ID, 3CX
- Or create a generic `POST /api/functions/lootitLink` endpoint that accepts `{ vendor, team_results }` and routes to the right table

## Branding

- Extension name: **LootIT Link**
- Icon: pink L with circle (matching LootIT logo from the app)
- Popup header: dark slate (#1e293b) with pink accent (#ec4899)
- Buttons: pink (#ec4899) primary, slate secondary
- Typography: system font stack matching PortalIT
