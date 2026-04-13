# Integrations Page Redesign

## Overview

Redesign the PortalIT Integrations page and all 21 integration config components to share a consistent, compact layout. Currently only 6 out of 21 use the shared dense table pattern — the rest have custom UIs with duplicated code.

## Landing Page

Replace the accordion/category layout with a dashboard-style grid:

- **Category headers** — flat section labels (PSA, Security, Backup, VoIP, Email, Monitoring, Cloud, Settings)
- **Integration cards** — compact cards in a responsive grid showing:
  - Status dot (green = connected, amber = configured, grey = not configured)
  - Integration name + small icon
  - Key metric at a glance: "12/15 mapped", "Last sync 2h ago", "3 reports", or "Not configured"
  - Click to open config
- No accordion expand/collapse — everything visible at a glance
- Cards should be small/tight — think 3-4 per row

## Data Integration Template

One unified template for ALL mapping and report integrations. Extends the existing pattern from Datto RMM/Cove/JumpCloud/Spanning/RocketCyber to cover all 18 data integrations.

### Layout

1. **Header bar** — `IntegrationHeader` component
   - Status dot + label (Connected/Configured/Not configured)
   - Integration name
   - `MiniProgressBar` (mapped/total)
   - Action buttons: Test, Refresh, Auto-Map, Sync All
   - Upload Report button (small, only for integrations that support reports — opens modal)

2. **Filter bar** — `FilterBar` component
   - Tabs: All | Mapped | Unmapped | Stale
   - Search input (right-aligned)

3. **Dense table** — consistent columns across all integrations
   - Status dot | Item Name | Count (context-specific label) | Customer | Last Sync | Actions
   - `MappingRow` component for each row
   - Inline customer search with suggested match for unmapped rows
   - Re-sync button on stale rows, delete button on mapped rows

4. **Pagination** — `TablePagination` at 25 items per page

### Integrations to convert

| Integration | Current Pattern | Count Column Label |
|------------|----------------|-------------------|
| UniFi | Custom collapsible (820 lines) | Devices |
| Datto EDR | Collapsible + table (529 lines) | Hosts |
| SaaS Alerts | Collapsible + modal (520 lines) | Events |
| DarkWeb ID | Tabs (1152 lines) | Domains |
| BullPhish ID | Collapsible + modal (685 lines) | Emails Sent |
| INKY | Dialog + editor (691 lines) | Mailboxes |
| 3CX | Tabs (1269 lines) | Extensions |
| DMARC | Expandable rows (545 lines) | Domains |
| CIPP | Collapsible + modal (517 lines) | Users |
| Pax8 | Modal-based (302 lines) | Subscriptions |
| Vultr | Modal + filter (499 lines) | Instances |
| VPenTest | Collapsible + custom (429 lines) | Findings |

### Report Upload

For integrations that support reports (3CX, BullPhish, Dark Web, INKY):
- Small "Upload Report" button in the header bar
- Opens a modal for file upload (PDF/CSV)
- Reports are secondary to the mapping table — not a separate tab

### Expandable Rows

For integrations with detail data (like 3CX extensions list):
- Click a row to expand and show detail panel
- Detail panel has checkboxes for exclusion (already built for 3CX)

## Settings Template

Simple form card for config-only integrations (HaloPSA, AI Provider, Mapbox):
- Same `IntegrationHeader` style (status dot + name + test button)
- Clean form fields (masked inputs for secrets, dropdowns for options)
- Save button
- No table, no filter bar, no pagination

### Integrations using settings template
- HaloPSAConfig / HaloPSASection (credentials)
- AIConfig (provider selection)
- MapboxConfig (token + style)

## Shared Components

All from `src/components/integrations/shared/IntegrationTableParts.jsx`:
- `CONNECTION_STATES`, `ITEMS_PER_PAGE`, `STALE_THRESHOLD_HOURS`
- `getConnectionStatusDisplay()`, `getRelativeTime()`, `isStale()`, `getRowStatusDot()`, `getSuggestedMatch()`
- `InlineCustomerSearch`, `MiniProgressBar`, `TablePagination`, `FilterBar`, `IntegrationHeader`, `MappingRow`

No more duplicated helpers in individual config files.

## File Size Targets

Each config file should be under 400 lines. Current offenders:
- ThreeCXConfig: 1269 → ~400
- DarkWebIDConfig: 1152 → ~400
- UniFiConfig: 820 → ~400 (refactor to use shared parts)
- InkyConfig: 691 → ~350
- BullPhishIDConfig: 685 → ~350

## Implementation Order

Phase 1: Landing page redesign (Integrations.jsx)
Phase 2: Convert remaining 12 data integrations to shared template
Phase 3: Convert 3 settings integrations to settings template
Phase 4: Refactor UniFiConfig to use shared parts (it was the original pattern source)
