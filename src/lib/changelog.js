// Shared changelog — imported by Adminland > System Info
// When pushing changes, add a new entry (or append to the latest version).

export const CHANGELOG = [
  {
    version: '1.6.0',
    date: '2026-04-20',
    changes: [
      'LootIT — Audit log fixed: entries now appear correctly (was querying wrong column + broken FK join)',
      'LootIT — "Approved as-is" actions now logged to audit trail with user name and reason',
      'LootIT — Note and exclusion saving: errors now surface as toast messages instead of silently failing',
      'LootIT — Dashboard: hidden empty "No Vendor" cards with no data',
      'LootIT — Dashboard: auto-matched items show "Auto-matched" instead of "Pending by Unknown"',
      'LootIT — Dashboard: snapshot cards now show exclusion-adjusted vendor qty with "-N excluded" indicator',
      'LootIT — Stale badge no longer clipped on reconciliation cards',
      'LootIT — Sign-off blocks when unresolved items remain (including unmatched and missing-from-PSA)',
      'LootIT — Matched count in header and filter tabs now includes force-matched items',
      'LootIT — EDR sync: fixed wrong action name, auth sign-off on timeout, sync_logs column mismatch',
      'LootIT — Staleness badges, due banner, and dashboard Due column added',
      'LootIT — RecurringTab: fixed stale dependency array, filtered discount/zero-qty items',
      'LootIT — Rule cards: suppressed no-PSA-data cards when vendor covered by override',
      'LootIT — Dashboard: filtered snapshots to only show cards with actual data',
    ],
  },
  {
    version: '1.5.0',
    date: '2026-03-24',
    changes: [
      'Backend — Fixed OOM crash during HaloPSA ticket sync (increased Node heap to 512MB, removed debug logging)',
      'System Info — Added to Adminland with build details and full changelog',
      'LootIT — Notes now persist correctly when reviewing/dismissing cards (was being overwritten with null)',
      'LootIT — Undo button on reviewed cards is now prominent with amber styling',
      'LootIT — Click any card to open detail drawer with full activity history (who, when, notes)',
      'LootIT — Every review action is logged to audit trail (reconciliation_review_history table)',
      'Fix — Customer detail page no longer shows stuck skeletons on SPA navigation (useSearchParams)',
      'Fix — Invoice line items now load correctly when navigating between customers',
      'Dashboard — Removed Company Information card (internal notes no longer visible to customers)',
      'Billing — Removed paid totals from invoice header (customers only see overdue)',
      'Services — Skeleton loading while integration mappings are loading (no more layout jump)',
      'RocketCyber — Skeleton loading while incidents are loading',
      'Cron — Added Datto EDR to nightly sync schedule (3:15 AM EST)',
    ],
  },
  {
    version: '1.4.0',
    date: '2026-03-18',
    changes: [
      'Fix — 3CX CSV upload no longer crashes on multi-line quoted fields (BLF entries with newlines)',
      'Spanning — Standard and Archived users are now separated; LootIT only counts Standard licenses',
      'Billing — Inactive/expired recurring bills excluded from Monthly Recurring cost (Dashboard, Billing, Services tabs)',
      'Sync — Unified "Sync All" button replaces scattered sync buttons across customer detail pages',
      'Sync — Customer address, phone, email, and contact are preserved when HaloPSA site fetch fails',
      'Sync — Recurring bill line items now use upsert (preserves UUIDs) so manual Pax8 overrides survive nightly syncs',
      'LootIT — Manual Pax8 mappings no longer disappear after daily sync (line item IDs are now stable)',
      'Invoice Summary — Removed "Paid" totals from customer-facing views; only Pending and Overdue shown',
      'Services — Monthly Recurring now filters to active bills only (matches Billing tab)',
    ],
  },
  {
    version: '1.3.0',
    date: '2026-03-17',
    changes: [
      'LootIT — Full reconciliation engine: vendor counts vs PSA line items with match/over/under status',
      'LootIT — Pax8 integration with per-subscription manual mapping overrides',
      'LootIT — Settings page for managing reconciliation rules and templates',
      'Datto EDR — Agent count now pulled from cached data correctly',
      'Fix — Skeleton loading screens no longer get stuck on slow API responses',
    ],
  },
  {
    version: '1.2.0',
    date: '2026-03-15',
    changes: [
      'Customer Detail — Redesigned with tabbed layout: Dashboard, Billing, Services, SaaS, Quotes, Tickets',
      'Services Tab — Sub-tabs for each integration (Spanning, JumpCloud, Datto, RocketCyber, etc.)',
      'Spanning Tab — User list with search, pagination, and protection status',
      'DMARC — New DMARC report tab with domain compliance and failure details',
      'Inky — Email protection stats tab with user counts',
    ],
  },
  {
    version: '1.1.0',
    date: '2026-03-12',
    changes: [
      'Auth — Supabase Auth with in-memory OTP + magic link invitation flow',
      'Email — Resend integration for branded transactional emails',
      'Sign-in Tracking — IP addresses and session history visible in Adminland',
      'Adminland — Users & Security, Branding, Integrations, Cron Jobs, API Docs, Feedback panels',
    ],
  },
  {
    version: '1.0.0',
    date: '2026-03-10',
    changes: [
      'Initial release — Customer portal with HaloPSA sync, Datto RMM, JumpCloud, Spanning, Cove integrations',
      'Dashboard — Customer overview with KPIs, recent tickets, and quick actions',
      'Recurring Bills — Synced from HaloPSA with line item detail',
      'Invoices — Synced with expandable line items and status tracking',
      'Scheduled Jobs — Nightly cron syncs for all integrations (2AM-6:30AM EST)',
    ],
  },
];

export const APP_VERSION = CHANGELOG[0]?.version || '0.0.0';
