---
name: add-database-table-or-schema-change
description: Workflow command scaffold for add-database-table-or-schema-change in portalit.
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /add-database-table-or-schema-change

Use this workflow when working on **add-database-table-or-schema-change** in `portalit`.

## Goal

Adds a new database table or modifies schema, including migrations and sometimes RLS (Row Level Security) policies.

## Common Files

- `supabase/migrations/*.sql`

## Suggested Sequence

1. Understand the current state and failure mode before editing.
2. Make the smallest coherent change that satisfies the workflow goal.
3. Run the most relevant verification for touched files.
4. Summarize what changed and what still needs review.

## Typical Commit Signals

- Create or modify a SQL migration file in supabase/migrations/
- If needed, update RLS or security policies in the same migration
- Backend code updated to use new/changed table

## Notes

- Treat this as a scaffold, not a hard-coded script.
- Update the command if the workflow evolves materially.