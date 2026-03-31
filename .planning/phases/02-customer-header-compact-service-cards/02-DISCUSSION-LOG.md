# Phase 2: Customer Header & Compact Service Cards - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.

**Date:** 2026-03-31
**Phase:** 02-Customer Header & Compact Service Cards
**Areas discussed:** Customer data source, Financial summary, Card compact layout, Health score
**Mode:** Auto (all recommended defaults selected)

---

## Customer Data Source

| Option | Description | Selected |
|--------|-------------|----------|
| Use existing customer prop + contacts hook | Data already available via props and useCustomerContacts | ✓ |
| Fetch fresh from HaloPSA API | Call HaloPSA directly for latest data | |
| Create new customer profile hook | Dedicated hook combining all customer data | |

**User's choice:** Use existing data sources (auto-selected)

---

## Financial Summary Content

| Option | Description | Selected |
|--------|-------------|----------|
| Derive from existing data | MRR from recurring_bills, contract value from contracts, status from health % | ✓ |
| New financial endpoint | Backend endpoint that calculates financials server-side | |

**User's choice:** Derive from existing data (auto-selected)

---

## Service Card Compact Layout

| Option | Description | Selected |
|--------|-------------|----------|
| Shrink everything, keep all data | Reduce padding/fonts, icon-only action bar, thin divider | ✓ |
| Remove non-essential elements | Cut integration label, exclusion badge at small size | |
| Collapsible detail | Show minimal card, expand on hover/click | |

**User's choice:** Shrink everything, keep all data (auto-selected)

---

## Health Score Visualization

| Option | Description | Selected |
|--------|-------------|----------|
| Keep Phase 1 % badge | Already implemented, clean and functional | ✓ |
| Add gauge/ring | Circular progress indicator | |
| Health bar + badge | Progress bar at top + numeric badge | |

**User's choice:** Keep Phase 1 % badge (auto-selected)

---

## Claude's Discretion

- Responsive breakpoints for card grid
- Financial summary placement relative to integration widgets
- Exact compact font sizes

## Deferred Ideas

None
