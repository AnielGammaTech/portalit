---
status: testing
phase: 04-lootit-service-extraction-split-lootit-into-its-own-railway-
source:
  - 04-01-SUMMARY.md
  - 04-02-SUMMARY.md
  - 04-03-SUMMARY.md
  - 04-04-SUMMARY.md
  - 04-05-SUMMARY.md
  - 04-06-SUMMARY.md
  - 04-07-SUMMARY.md
started: 2026-04-16T17:25:00Z
updated: 2026-04-16T17:25:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

number: 1
name: LootIT Loads at Custom Domain
expected: |
  Visit https://lootit.gtools.io in your browser. The LootIT app loads showing the customer list dashboard (not a blank page or error). Title shows "LootIT".
awaiting: user response

## Tests

### 1. LootIT Loads at Custom Domain
expected: Visit https://lootit.gtools.io in your browser. The LootIT app loads showing the customer list dashboard (not a blank page or error). Title shows "LootIT".
result: [pending]

### 2. Cross-Subdomain SSO
expected: While logged into portalit.gtools.io, open lootit.gtools.io in the same browser. You should be automatically signed in without seeing a login prompt — the cookie-based SSO shares your session across .gtools.io subdomains.
result: [pending]

### 3. Portalit Sidebar LootIT Link
expected: On portalit.gtools.io, click the "LootIT" item in the sidebar. It navigates to lootit.gtools.io in the same tab (not a new tab). The link works in desktop sidebar, mobile bottom tab, and mobile drawer nav.
result: [pending]

### 4. Dashboard LootIT Links
expected: On the portalit dashboard, the LootIT reconciliation section's "View All" link and per-customer links navigate to lootit.gtools.io (not the old in-app /LootIT route).
result: [pending]

### 5. Customer Detail Page
expected: On lootit.gtools.io, click a customer from the dashboard list. The customer detail page loads showing the customer header (name, contact info, financial summary) and tabs: Reconciliation, Contract, and Recurring.
result: [pending]

### 6. Reconciliation Tab Works
expected: On the customer detail page, the Reconciliation tab shows service cards with PSA vs Vendor comparison, match status badges (matched/over/under/no-data), and action buttons. Cards are interactive — you can click to review or dismiss discrepancies.
result: [pending]

### 7. Recurring Tab Works
expected: On the customer detail page, click the Recurring tab. It shows HaloPSA recurring invoice line items with color-coded match status: green (matched to a rule), red (unmatched), gray (unused). Filter chips let you filter by status.
result: [pending]

### 8. Settings Page
expected: Navigate to /settings in LootIT (via sidebar or direct URL). The settings page loads showing reconciliation rules management.
result: [pending]

### 9. Back to PortalIT Link
expected: In the LootIT app, click the "Back to PortalIT" link in the sidebar/layout. It navigates back to portalit.gtools.io.
result: [pending]

### 10. Sign Out Propagation
expected: Sign out from portalit.gtools.io. Then refresh lootit.gtools.io — you should be redirected to the login page (session cookie cleared across both subdomains).
result: [pending]

### 11. Cookie Structure in DevTools
expected: While logged into portalit.gtools.io, open DevTools > Application > Cookies. Confirm sb-*-auth-token (or chunked sb-*-auth-token.0, .1, etc.) is present with Domain=.gtools.io, Secure flag, SameSite=Lax, and Max-Age around 5184000.
result: [pending]

### 12. Portalit Unaffected
expected: After all the LootIT extraction changes, portalit.gtools.io continues working normally. Navigation to other modules (Projects, Quotes, Phone, etc.), authentication, and all existing features are unaffected.
result: [pending]

## Summary

total: 12
passed: 0
issues: 0
pending: 12
skipped: 0

## Gaps

[none yet]
