<!-- GSD:project-start source:PROJECT.md -->
## Project

**PortalIT — LootIT Redesign**

PortalIT is an MSP operations portal built with React + Vite + Supabase + Express. LootIT is its billing reconciliation module that compares PSA (HaloPSA) recurring invoices against vendor integrations (Pax8, Datto, Cove, JumpCloud, etc.) to catch billing discrepancies. This milestone focuses on redesigning the LootIT customer detail page for better usability and adding a Recurring tab for reconciliation workflows.

**Core Value:** MSP operators can quickly identify and resolve billing discrepancies between what vendors report and what customers are being billed — the customer detail page is the primary workspace for this.

### Constraints

- **Existing data**: Recurring bill line items already synced — no new data model needed for the Recurring tab
- **Immutability**: Follow immutable patterns per coding style rules
- **File size**: LootITCustomerDetail.jsx is already 2079 lines — must be split during redesign
- **Design system**: Radix UI + Tailwind CSS — use existing design tokens
<!-- GSD:project-end -->

<!-- GSD:stack-start source:STACK.md -->
## Technology Stack

Technology stack not yet documented. Will populate after codebase mapping or first phase.
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
