// Shared changelog — imported by Adminland > System Info
// When pushing changes, add a new entry (or append to the latest version).

export const CHANGELOG = [
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
