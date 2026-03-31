# PortalIT — LootIT Redesign

## What This Is

PortalIT is an MSP operations portal built with React + Vite + Supabase + Express. LootIT is its billing reconciliation module that compares PSA (HaloPSA) recurring invoices against vendor integrations (Pax8, Datto, Cove, JumpCloud, etc.) to catch billing discrepancies. This milestone focuses on redesigning the LootIT customer detail page for better usability and adding a Recurring tab for reconciliation workflows.

## Core Value

MSP operators can quickly identify and resolve billing discrepancies between what vendors report and what customers are being billed — the customer detail page is the primary workspace for this.

## Requirements

### Validated

- ✓ Customer list dashboard with health scores — existing
- ✓ Per-customer reconciliation with PSA vs Vendor comparison — existing
- ✓ Service cards showing matched/over/under/no-data status — existing
- ✓ Manual review, dismiss, and exclusion workflows — existing
- ✓ Pax8 subscription reconciliation with per-subscription cards — existing
- ✓ Contract upload and LLM extraction — existing
- ✓ Reconciliation rules management — existing
- ✓ HaloPSA recurring bill sync — existing
- ✓ Reconciliation/Contract tab system — existing

### Active

- [ ] Shrink service cards ~50% so 3-4 fit per row instead of 2
- [ ] Redesign customer header with real customer details, financial summary, and health score (dashboard pro style)
- [ ] Add "Recurring" tab showing HaloPSA recurring invoice line items per customer
- [ ] Color-coded list in Recurring tab: matched (green), unmatched (red), unused (gray)
- [ ] Per-customer master sync button that triggers ALL vendor integrations + HaloPSA recurring + contracts + device counts
- [x] Overall Pro Max dashboard-style visual redesign of customer detail page — Phase 1

### Out of Scope

- Full LootIT dashboard redesign — this milestone focuses on customer detail page only
- New integrations — only redesigning existing functionality
- Backend API changes beyond sync endpoint consolidation
- Mobile-specific layouts — desktop-first for this reconciliation workflow

## Context

- **Tech stack**: React 18, Vite 6, TanStack Query 5, Radix UI, Tailwind CSS 3, Supabase PostgreSQL, Express backend
- **Key files**: LootITCustomerDetail.jsx (394 lines orchestrator), 9 extracted components (CustomerDetailHeader, ReconciliationTab, ContractTab, etc.), lootit-constants.js (shared status colors), ServiceCard.jsx, lootit-reconciliation.js (471 lines), useReconciliationData.js, useCustomerSync.js
- **Data sources**: recurring_bills + recurring_bill_line_items tables already populated by HaloPSA sync
- **Existing tabs**: Reconciliation (service cards grid) and Contract (drag-drop upload + extraction)
- **Sync endpoints**: POST /api/halo/sync/customer (single customer), POST /api/halo/sync (bulk)
- **Vendor mappings**: datto_site_mappings, datto_edr_mappings, jump_cloud_mappings, spanning_mappings, rocket_cyber_mappings, cove_data_mappings, pax8_mappings, etc.
- **UI preferences**: No emojis (Lucide icons only), dramatic visual changes preferred, dashboard pro aesthetic

## Constraints

- **Existing data**: Recurring bill line items already synced — no new data model needed for the Recurring tab
- **Immutability**: Follow immutable patterns per coding style rules
- **File size**: LootITCustomerDetail.jsx is already 2079 lines — must be split during redesign
- **Design system**: Radix UI + Tailwind CSS — use existing design tokens

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Small cards (50% shrink, 3-4 per row) | Current 2-column layout wastes space | — Pending |
| Dashboard pro design style | Dense but polished, financial dashboard feel with data hierarchy | — Pending |
| "Recurring" tab name | Matches HaloPSA terminology | — Pending |
| Color-coded single list for match status | Green/red/gray indicators — simpler than grouped sections | — Pending |
| Master sync triggers everything | All vendors + HaloPSA + contracts + device counts per customer | — Pending |
| Customer header: details + financials + health | Full context at a glance for reconciliation work | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-31 after Phase 1 completion*
