# PortalIT Security Audit Report

**Date:** 2026-03-31
**Scope:** Express API, Supabase RLS, Frontend Auth, File Uploads, Role Enforcement
**Severity Scale:** CRITICAL > HIGH > MEDIUM > LOW

---

## Executive Summary

**8 CRITICAL** | **10 HIGH** | **8 MEDIUM** | **4 LOW** = 30 findings total

The most urgent risks are **overpermissive Supabase RLS policies** that allow any authenticated user to read/write data across ALL customers, combined with the **anon key exposed in the frontend bundle**. Together, these create a path to complete data theft. The Express API has strong auth middleware but several input validation gaps.

---

## CRITICAL FINDINGS

### C-1: Overpermissive RLS on 7 Integration Tables
**Files:** Migrations 006-011
**Impact:** Any authenticated user (including customer portal users) can read/modify/delete ALL rows

| Table | Migration | Policy |
|-------|-----------|--------|
| pax8_mappings | 006 | `USING (true) WITH CHECK (true)` |
| inky_reports | 007 | `USING (true) WITH CHECK (true)` |
| threecx_mappings | 008 | `USING (true) WITH CHECK (true)` |
| threecx_reports | 009 | `USING (true) WITH CHECK (true)` |
| vultr_mappings | 010 | `USING (true) WITH CHECK (true)` |
| dmarc_report_mappings | 010 | `USING (true) WITH CHECK (true)` |
| vpentest_mappings | 011 | `USING (true) WITH CHECK (true)` |

**Fix:** Add `auth.jwt() ->> 'role' = 'admin'` or customer_id filtering to each policy.

### C-2: Settings Table Exposes API Secrets to All Auth Users
**File:** `migrations/001_initial_schema.sql:744`
**Policy:** `FOR SELECT USING (auth.uid() IS NOT NULL)`
**Impact:** Any logged-in user (customer, sales, admin) can read HaloPSA, Datto, JumpCloud, DarkWebID credentials stored in plaintext.

### C-3: cron_job_runs Readable by All Auth Users
**File:** `migrations/004_add_cron_job_runs.sql:20`
**Impact:** Error messages in cron logs may contain API credentials or internal details.

### C-4: Direct supabase.from() Calls Bypass Server Middleware
**Files:** LootITCustomerDetail.jsx:94, useReconciliationReviews.js:26, Pax8Config.jsx:115,139
**Impact:** Frontend makes direct DB inserts/deletes without server-side authorization. RLS is the only guard (and it's permissive).

### C-5: Supabase Anon Key in Frontend Bundle
**Files:** src/api/client.js:3-4, src/lib/app-params.js:3-4
**Impact:** Combined with C-1, anyone with the anon key can query the database directly and access all customer data. This is expected for Supabase but dangerous with permissive RLS.

### C-6: Hardcoded Production URL
**File:** `server/src/routes/users.js:90`
**Impact:** Leaks Railway production infrastructure URL in source code.

### C-7: Path Traversal in File Upload
**File:** `server/src/routes/upload.js:16`
**Impact:** User-controlled filename `req.file.originalname` used without sanitization.

### C-8: Content-Disposition Header Injection
**File:** `server/src/routes/functions.js:90`
**Impact:** Unsanitized filename in response header could enable header injection.

---

## HIGH FINDINGS

### H-1: No Route-Level Role Enforcement
**File:** `src/App.jsx:73-92`
**Impact:** All pages render for all authenticated users. Permission checks are client-side UI hiding only.

### H-2: Settings Table Stores Plaintext API Secrets
**File:** `migrations/001_initial_schema.sql:302-325`
**Impact:** 15+ vendor API credentials (HaloPSA, Datto, JumpCloud, DarkWebID, etc.) stored unencrypted.

### H-3: File Upload No Type/Size Validation
**File:** `LootITCustomerDetail.jsx:94`, `server/src/routes/upload.js:16`
**Impact:** No MIME validation, no content-based type detection, no virus scanning.

### H-4: Parameter Injection in HaloPSA API Calls
**File:** `server/src/routes/halo.js:287,415`
**Impact:** User-supplied customer_id interpolated into API query string without validation.

### H-5: Stacked Rate Limiting Creates Bypass
**File:** `server/src/index.js:70-76`
**Impact:** General limiter (200/15min) applies before auth-specific limiters, potentially masking them.

### H-6: Missing IDOR on User Sign-Ins Endpoint
**File:** `server/src/routes/users.js:437-445`
**Impact:** Any admin can view any user's sign-in history.

### H-7: Missing Cron Query Parameter Validation
**File:** `server/src/routes/cron.js:59-60`
**Impact:** Unsanitized `limit` and `job_name` parameters.

### H-8: Email Enumeration via Logs
**File:** `server/src/routes/users.js:256-258`
**Impact:** Despite generic response, logs reveal email existence.

### H-9: CORS Allows No-Origin Requests
**File:** `server/src/index.js:36-50`
**Impact:** Non-browser clients can make credentialed requests.

### H-10: File Download Without Ownership Check
**File:** `LootITCustomerDetail.jsx:193-204`
**Impact:** No check that user owns the contract being downloaded.

---

## MEDIUM FINDINGS

### M-1: Line Items/Contracts/Quotes Readable by All Auth Users
**File:** `migrations/001_initial_schema.sql:784-793`
**Tables:** contract_items, invoice_line_items, recurring_bill_line_items, quote_items

### M-2: Activities/Sync Logs Readable by All Auth Users
**File:** `migrations/001_initial_schema.sql:774-777`

### M-3: Weak OTP Generation (Math.random)
**File:** `server/src/routes/users.js:72-74`

### M-4: Race Condition in User Invite Creation
**File:** `server/src/routes/users.js:124-137`

### M-5: Error Messages Leak Database Schema
**File:** `server/src/middleware/errorHandler.js:1-11`

### M-6: No Rate Limiting on Upload Endpoint
**File:** `server/src/routes/upload.js`

### M-7: Missing Customer Permission Check on Invite
**File:** `server/src/routes/users.js:109-110`

### M-8: Email Config Exposed in API Response
**File:** `server/src/routes/users.js:428-432`

---

## LOW FINDINGS

### L-1: No Helmet Security Headers
**File:** `server/src/index.js`

### L-2: PII in Console Logs (email, IP)
**Files:** Multiple server files

### L-3: Dead Code (Temp Password Generation)
**File:** `server/src/routes/users.js:140`

### L-4: LLM Prompt Injection Risk
**File:** `BullPhishIDConfig.jsx:96-112`

---

## POSITIVE FINDINGS

- All database queries use Supabase parameterized queries (no SQL injection)
- No hardcoded API keys in source code (all via env vars)
- Auth middleware properly validates JWT tokens via Supabase
- OTP rate limiting has dual-layer protection (per-IP + per-email)
- HTTPS enforced via Railway deployment

---

## Remediation Priority

**Immediate (this week):**
1. Fix RLS on 7 integration tables (C-1)
2. Restrict settings table to admin-only (C-2)
3. Sanitize file upload filenames (C-7)
4. Validate HaloPSA customer_id parameter (H-4)

**Short-term (2 weeks):**
5. Add route-level role guards (H-1)
6. Add file type validation server-side (H-3)
7. Fix Content-Disposition injection (C-8)
8. Replace Math.random OTP with crypto.randomInt (M-3)

**Medium-term (1 month):**
9. Encrypt API secrets in settings table (H-2)
10. Add helmet security headers (L-1)
11. Remove PII from logs (L-2)
12. Restrict line items/activities RLS (M-1, M-2)

---

*Audit completed: 2026-03-31*
