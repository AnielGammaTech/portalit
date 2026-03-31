# Requirements: PortalIT LootIT Redesign

**Defined:** 2026-03-31
**Core Value:** MSP operators can quickly identify and resolve billing discrepancies from the customer detail page

## v1 Requirements

### Service Cards

- [x] **CARD-01**: Service cards shrunk ~50% so 3-4 cards fit per row instead of current 2
- [x] **CARD-02**: Card layout retains PSA vs Vendor counts, status badge, and action buttons at smaller size
- [x] **CARD-03**: Cards remain interactive (review, dismiss, map, notes) at compact size

### Customer Header

- [ ] **HEAD-01**: Header displays real customer details (company name, contact, address) from HaloPSA data
- [ ] **HEAD-02**: Header shows financial summary (MRR from recurring bills, contract value, billing status)
- [ ] **HEAD-03**: Header shows reconciliation health score with visual indicator
- [ ] **HEAD-04**: Header redesigned in dashboard-pro style (dense, polished, data hierarchy)
- [ ] **HEAD-05**: Integration stat widgets (Users, Workstations, Servers, etc.) redesigned to be more compact and informative

### Recurring Tab

- [x] **RECR-01**: New "Recurring" tab added alongside existing Reconciliation and Contract tabs
- [x] **RECR-02**: Tab displays all HaloPSA recurring invoice line items for the customer
- [x] **RECR-03**: Each line item shows: description, quantity, price, net amount, item code, active status
- [x] **RECR-04**: Line items color-coded green when matched to a reconciliation rule
- [x] **RECR-05**: Line items color-coded red when unmatched (no reconciliation rule maps to them)
- [x] **RECR-06**: Reconciliation rules with no matching line item shown as gray "unused" entries
- [x] **RECR-07**: List is filterable by status (All, Matched, Unmatched, Unused)

### Master Sync

- [ ] **SYNC-01**: Sync button triggers real per-customer sync of ALL vendor integrations (Datto, Cove, Pax8, JumpCloud, Spanning, RocketCyber, etc.)
- [ ] **SYNC-02**: Sync button triggers HaloPSA recurring invoice sync for that customer
- [ ] **SYNC-03**: Sync button shows progress/loading state during sync
- [ ] **SYNC-04**: After sync completes, all data on page refreshes automatically
- [ ] **SYNC-05**: Sync triggers device count refresh from all mapped vendors

### Visual Redesign

- [x] **UXRD-01**: Customer detail page follows dashboard-pro aesthetic (dense, polished, financial dashboard feel)
- [x] **UXRD-02**: Typography hierarchy establishes clear data importance levels
- [x] **UXRD-03**: Color system uses Lucide icons (no emojis), consistent status colors across all sections
- [x] **UXRD-04**: LootITCustomerDetail.jsx split into smaller focused components (<800 lines each)

## v2 Requirements

### Advanced Reconciliation

- **ADVR-01**: Auto-match suggestions based on line item description similarity
- **ADVR-02**: Bulk review/dismiss actions across multiple service cards
- **ADVR-03**: Historical reconciliation trend charts per customer

### Notifications

- **NOTF-01**: Alert when reconciliation status changes after sync
- **NOTF-02**: Weekly email digest of unresolved discrepancies

## Out of Scope

| Feature | Reason |
|---------|--------|
| LootIT Dashboard redesign | This milestone is customer detail page only |
| New vendor integrations | Only redesigning existing functionality |
| Backend data model changes | Recurring bill data already exists, just surfacing it |
| Mobile-specific layouts | Desktop-first for MSP reconciliation workflow |
| Contract tab redesign | Existing contract tab works, focus on new Recurring tab |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CARD-01 | Phase 2 | Complete |
| CARD-02 | Phase 2 | Complete |
| CARD-03 | Phase 2 | Complete |
| HEAD-01 | Phase 2 | Pending |
| HEAD-02 | Phase 2 | Pending |
| HEAD-03 | Phase 2 | Pending |
| HEAD-04 | Phase 2 | Pending |
| HEAD-05 | Phase 2 | Pending |
| RECR-01 | Phase 3 | Complete |
| RECR-02 | Phase 3 | Complete |
| RECR-03 | Phase 3 | Complete |
| RECR-04 | Phase 3 | Complete |
| RECR-05 | Phase 3 | Complete |
| RECR-06 | Phase 3 | Complete |
| RECR-07 | Phase 3 | Complete |
| SYNC-01 | Phase 3 | Pending |
| SYNC-02 | Phase 3 | Pending |
| SYNC-03 | Phase 3 | Pending |
| SYNC-04 | Phase 3 | Pending |
| SYNC-05 | Phase 3 | Pending |
| UXRD-01 | Phase 1 | Complete |
| UXRD-02 | Phase 1 | Complete |
| UXRD-03 | Phase 1 | Complete |
| UXRD-04 | Phase 1 | Complete |

**Coverage:**
- v1 requirements: 24 total
- Mapped to phases: 24
- Unmapped: 0

---
*Requirements defined: 2026-03-31*
*Last updated: 2026-03-31 after roadmap creation*
