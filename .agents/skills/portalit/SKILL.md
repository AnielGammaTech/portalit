---
name: portalit-conventions
description: Development conventions and patterns for portalit. JavaScript Vite project with freeform commits.
---

# Portalit Conventions

> Generated from [AnielGammaTech/portalit](https://github.com/AnielGammaTech/portalit) on 2026-03-15

## Overview

This skill teaches Claude the development patterns and conventions used in portalit.

## Tech Stack

- **Primary Language**: JavaScript
- **Framework**: Vite
- **Architecture**: type-based module organization
- **Test Location**: separate

## When to Use This Skill

Activate this skill when:
- Making changes to this repository
- Adding new features following established patterns
- Writing tests that match project conventions
- Creating commits with proper message format

## Commit Conventions

Follow these commit message conventions based on 8 analyzed commits.

### Commit Style: Free-form Messages

### Prefixes Used

- `fix`
- `feat`

### Message Guidelines

- Average message length: ~26 characters
- Keep first line concise and descriptive
- Use imperative mood ("Add feature" not "Added feature")


*Commit message example*

```text
fix: resolve reload hang, optimize sync performance, add cron job dashboard
```

*Commit message example*

```text
feat: add Pax8 integration, nightly cron jobs, and LootIT gradient fix
```

*Commit message example*

```text
debug: add console.log tracing for Spanning cached_data issue
```

*Commit message example*

```text
refactor: rewrite HaloPSA config to match QuoteIT pattern
```

*Commit message example*

```text
fix: remove gradient seam on LootIT page
```

*Commit message example*

```text
feat: add LootIT billing reconciliation mini-app
```

*Commit message example*

```text
fix: eliminate duplicate auth calls causing refresh freeze
```

*Commit message example*

```text
fix: SaaS Alerts - use GET /reports/events with query params, add endpoint fallbacks
```

## Architecture

### Project Structure: Single Package

This project uses **type-based** module organization.

### Source Layout

```
src/
├── api/
├── components/
├── hooks/
├── lib/
├── pages/
├── utils/
```

### Entry Points

- `src/App.jsx`
- `src/main.jsx`

### Configuration Files

- `eslint.config.js`
- `package.json`
- `server/Dockerfile`
- `server/package.json`
- `tailwind.config.js`

### Guidelines

- Group code by type (components, services, utils)
- Keep related functionality in the same type folder
- Avoid circular dependencies between type folders

## Code Style

### Language: JavaScript

### Naming Conventions

| Element | Convention |
|---------|------------|
| Files | PascalCase |
| Functions | camelCase |
| Classes | PascalCase |
| Constants | SCREAMING_SNAKE_CASE |

### Import Style: Relative Imports

### Export Style: Default Exports


*Preferred import style*

```typescript
// Use relative imports
import { Button } from '../components/Button'
import { useAuth } from './hooks/useAuth'
```

*Preferred export style*

```typescript
// Use default exports for main component/function
export default function UserProfile() { ... }
```

## Error Handling

### Error Handling Style: Try-Catch Blocks


*Standard error handling pattern*

```typescript
try {
  const result = await riskyOperation()
  return result
} catch (error) {
  console.error('Operation failed:', error)
  throw new Error('User-friendly message')
}
```

## Common Workflows

These workflows were detected from analyzing commit patterns.

### Database Migration

Database schema changes with migration files

**Frequency**: ~3 times per month

**Steps**:
1. Create migration file
2. Update schema definitions
3. Generate/update types

**Files typically involved**:
- `migrations/*`

**Example commit sequence**:
```
feat: Adminland redesign + invitation system + security groups
fix: add CDN-Cache-Control and Surrogate-Control headers to bust Railway edge cache
fix: skip email when RESEND_API_KEY missing + handle re-invite gracefully
```

### Feature Development

Standard feature implementation workflow

**Frequency**: ~17 times per month

**Steps**:
1. Add feature implementation
2. Add tests for feature
3. Update documentation

**Files typically involved**:
- `src/components/integrations/*`
- `src/components/*`
- `src/components/admin/*`
- `**/*.test.*`
- `**/api/**`

**Example commit sequence**:
```
feat: redesign UI to match QuoteIT + enhance all integration components
feat: lock down customer-portal to customer-only access
feat: add PortalIT branding — dark purple theme + PT logo
```

### Refactoring

Code refactoring and cleanup workflow

**Frequency**: ~2 times per month

**Steps**:
1. Ensure tests pass before refactor
2. Refactor code structure
3. Verify tests still pass

**Files typically involved**:
- `src/**/*`

**Example commit sequence**:
```
feat: HaloPSA shared service module + dedicated REST routes
feat: add HaloPSA to Adminland integrations panel
fix: append /token to HaloPSA auth URL and validate response type
```


## Best Practices

Based on analysis of the codebase, follow these practices:

### Do

- Use PascalCase for file names
- Prefer default exports

### Don't

- Don't deviate from established patterns without discussion

---

*This skill was auto-generated by [ECC Tools](https://ecc.tools). Review and customize as needed for your team.*
