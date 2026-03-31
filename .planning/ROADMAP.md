# Roadmap: PortalIT LootIT Redesign

## Overview

This milestone transforms the LootIT customer detail page from a functional but dense 2079-line monolith into a polished, dashboard-pro workspace. Phase 1 splits the component and establishes the visual design system. Phase 2 redesigns the header and compacts service cards for the Reconciliation tab. Phase 3 adds the Recurring tab for invoice line item reconciliation and wires up the master sync button to pull all vendor data at once.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Component Architecture & Visual Foundation** - Split LootITCustomerDetail.jsx into focused components and establish dashboard-pro design system
- [ ] **Phase 2: Customer Header & Compact Service Cards** - Redesign header with real customer data, financials, and health score; shrink service cards to fit 3-4 per row
- [ ] **Phase 3: Recurring Tab & Master Sync** - Add Recurring tab with color-coded line item matching and per-customer master sync across all vendors

## Phase Details

### Phase 1: Component Architecture & Visual Foundation
**Goal**: The customer detail page is composed of small, focused components with a consistent dashboard-pro visual language applied
**Depends on**: Nothing (first phase)
**Requirements**: UXRD-01, UXRD-02, UXRD-03, UXRD-04
**Success Criteria** (what must be TRUE):
  1. LootITCustomerDetail.jsx is split into multiple components, none exceeding 800 lines
  2. A consistent typography hierarchy is visible across the page (headings, labels, values at distinct sizes/weights)
  3. All status indicators use Lucide icons with consistent color coding (no emoji characters anywhere)
  4. The page looks noticeably more polished and dense than before -- a "dashboard pro" aesthetic is evident
**Plans**: 2 plans

Plans:
- [x] 01-01-PLAN.md -- Extract 7 inner components to separate files and create shared status color constants
- [x] 01-02-PLAN.md -- Apply dashboard-pro visual styling (dark/navy header, typography hierarchy, unified colors)
**UI hint**: yes

### Phase 2: Customer Header & Compact Service Cards
**Goal**: MSP operators see full customer context at a glance in the header and can scan 3-4 service cards per row in the Reconciliation tab
**Depends on**: Phase 1
**Requirements**: HEAD-01, HEAD-02, HEAD-03, HEAD-04, HEAD-05, CARD-01, CARD-02, CARD-03
**Success Criteria** (what must be TRUE):
  1. Header displays company name, contact info, and address pulled from HaloPSA data
  2. Header shows MRR, contract value, and billing status in a financial summary section
  3. Header shows a reconciliation health score with a visual indicator (color or gauge)
  4. Integration stat widgets (Users, Workstations, Servers, etc.) are compact and informative
  5. Service cards are approximately 50% smaller, fitting 3-4 per row while retaining PSA vs Vendor counts, status badges, and action buttons
**Plans**: 2 plans

Plans:
- [x] 02-01-PLAN.md -- Add customer contact info, financial summary (MRR, contract value, billing status) to header
- [ ] 02-02-PLAN.md -- Shrink service cards ~50% with icon-only tooltipped actions and 3-4 column grid
**UI hint**: yes

### Phase 3: Recurring Tab & Master Sync
**Goal**: MSP operators can view recurring invoice line items with match status and trigger a full per-customer data sync across all vendors
**Depends on**: Phase 2
**Requirements**: RECR-01, RECR-02, RECR-03, RECR-04, RECR-05, RECR-06, RECR-07, SYNC-01, SYNC-02, SYNC-03, SYNC-04, SYNC-05
**Success Criteria** (what must be TRUE):
  1. A "Recurring" tab appears alongside Reconciliation and Contract tabs
  2. The tab lists all HaloPSA recurring invoice line items showing description, quantity, price, net amount, item code, and active status
  3. Line items are color-coded: green for matched to a reconciliation rule, red for unmatched, gray for unused rules
  4. User can filter the list by status (All, Matched, Unmatched, Unused)
  5. Clicking the sync button triggers all vendor integrations, HaloPSA recurring sync, and device count refresh for that customer with visible progress
  6. After sync completes, all page data refreshes automatically without manual reload
**Plans**: 2 plans

Plans:
- [ ] 03-01-PLAN.md -- Create RecurringTab component with color-coded match status table and filter chips
- [ ] 03-02-PLAN.md -- Replace cache-only sync with real HaloPSA master sync and comprehensive data refresh
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Component Architecture & Visual Foundation | 0/2 | Not started | - |
| 2. Customer Header & Compact Service Cards | 1/2 | In Progress|  |
| 3. Recurring Tab & Master Sync | 0/2 | Not started | - |
