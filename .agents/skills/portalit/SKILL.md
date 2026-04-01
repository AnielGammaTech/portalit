```markdown
# portalit Development Patterns

> Auto-generated skill from repository analysis

## Overview
This skill teaches you the core development patterns, coding conventions, and common workflows used in the `portalit` codebase—a JavaScript project built with the Vite framework. The repository features a full-stack architecture, including a Supabase-managed database, backend API routes, and a React-based frontend. You'll learn how to contribute features, fix bugs, manage schema changes, and maintain code quality according to established standards.

## Coding Conventions

- **File Naming:** Use `camelCase` for files and folders.
  - Example: `customerDetail.jsx`, `apiClient.js`
- **Import Style:** Use relative imports.
  - Example:
    ```js
    import apiClient from '../api/client.js';
    import useCustomer from '../../hooks/useCustomer.js';
    ```
- **Export Style:** Use default exports.
  - Example:
    ```js
    // src/components/lootit/customerDetail.jsx
    export default function CustomerDetail(props) {
      // ...
    }
    ```
- **Commit Messages:** Follow the [Conventional Commits](https://www.conventionalcommits.org/) format.
  - Prefixes: `fix`, `feat`, `docs`, `chore`
  - Example: `fix: correct customer detail rendering on dashboard`
- **Frontend Components:** Located in `src/components/lootit/`, written in React (`.jsx`).
- **Hooks & Utilities:** Custom hooks in `src/hooks/`, utilities in `src/lib/`.

## Workflows

### Add Database Table or Schema Change
**Trigger:** When you need to introduce a new database table or make a significant schema change  
**Command:** `/new-table`

1. Create or modify a SQL migration file in `supabase/migrations/`.
    ```sql
    -- supabase/migrations/20240601_add_orders_table.sql
    CREATE TABLE orders (
      id SERIAL PRIMARY KEY,
      customer_id INTEGER REFERENCES customers(id),
      total NUMERIC
    );
    ```
2. If needed, update RLS (Row Level Security) or security policies in the same migration.
3. Update backend code to use the new or changed table.

### Add Backend Functionality with API Route
**Trigger:** When you want to add a new backend feature or API endpoint  
**Command:** `/new-api-endpoint`

1. Create or update a function in `server/src/functions/`.
    ```js
    // server/src/functions/getOrders.js
    export default async function getOrders(req, res) {
      // logic here
    }
    ```
2. Register or update the function in `server/src/routes/functions.js`.
    ```js
    import getOrders from '../functions/getOrders.js';
    router.get('/orders', getOrders);
    ```
3. Update the frontend API client (`src/api/client.js`) if needed.
4. Update frontend components to use the new API.

### Feature Development Full Stack
**Trigger:** When implementing a new feature that spans backend, frontend, and database  
**Command:** `/new-feature`

1. Create/modify backend functions and routes.
2. Create/modify frontend components in `src/components/lootit/`.
3. Update or add database migrations in `supabase/migrations/`.
4. Update the API client if needed.
5. Wire up the UI to the backend.

### Frontend Component Enhancement or Bugfix
**Trigger:** When fixing a bug or enhancing the UI for a specific feature  
**Command:** `/fix-ui`

1. Modify one or more components in `src/components/lootit/`.
    ```jsx
    // src/components/lootit/dashboard.jsx
    export default function Dashboard() {
      // updated logic/UI
    }
    ```
2. Optionally update related hooks in `src/hooks/`.
3. Optionally update utility libraries in `src/lib/`.

### Security Audit and Hardening
**Trigger:** When a security audit is performed and issues are found  
**Command:** `/security-fix`

1. Add or update a security audit report in `.planning/`.
2. Create or update SQL migrations to fix RLS/security.
    ```sql
    -- supabase/migrations/20240601_fix_rls_security.sql
    ALTER POLICY ...;
    ```
3. Update backend code for security fixes.
4. Update dependencies as needed (`server/package.json`, `server/package-lock.json`).

## Testing Patterns

- **Test Files:** Test files follow the pattern `*.test.*`.
- **Framework:** The specific test framework is unknown, but look for files like `customerDetail.test.js`.
- **Placement:** Tests are typically located alongside the code they test or in dedicated test directories.

## Commands

| Command           | Purpose                                                        |
|-------------------|----------------------------------------------------------------|
| /new-table        | Add a new database table or modify schema                      |
| /new-api-endpoint | Implement new backend functionality and expose via API route   |
| /new-feature      | Develop a new full-stack feature (backend, frontend, DB)      |
| /fix-ui           | Enhance or fix frontend React components                       |
| /security-fix     | Address security audit findings and harden the system          |
```