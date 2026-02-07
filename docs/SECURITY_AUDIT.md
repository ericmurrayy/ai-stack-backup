# Murray FSM - Security Audit & Improvement Plan
**Generated: 2026-02-05**
**Migrated from: D:\murrayfsm\CODEBASE_ANALYSIS.md on 2026-02-06**

## Executive Summary
The codebase is a comprehensive FSM system with 100+ API routes, 37+ dashboard pages, a mobile app, and 22+ service modules. It has strong fundamentals (TypeScript strict mode, Zod schemas, monorepo structure) but has **critical security vulnerabilities** that must be addressed before production deployment.

---

## CRITICAL SECURITY ISSUES (Fix Immediately)

### 1. Middleware Bypasses All API Authentication
**File:** `apps/web/src/middleware.ts` line 90
- `/api` is listed as a public route, meaning ALL API routes skip middleware auth
- Each handler must implement its own auth -- and many do not
- **Fix:** Remove `/api` from public routes, add auth to middleware for API routes, or use a shared auth wrapper

### 2. Unauthenticated API Routes (10 routes exposed)
These routes have ZERO authentication:
| Route | Risk |
|-------|------|
| `/api/jobs` | Full read/write access to all jobs using admin client |
| `/api/sms` | Anyone can send SMS messages at your expense |
| `/api/ai/chat` | Consumes Anthropic API credits |
| `/api/test-env` | Leaks environment variable names |
| `/api/setup/*` | Exposes database schema, allows table creation |
| `/api/quotes/[id]/accept` | Anyone with a quote UUID can accept it |
| `/api/cron` | Triggers all scheduled tasks if CRON_SECRET not set |

### 3. Command Injection in Jarvis Bridge
**File:** `packages/services/src/jarvis-bridge.ts` lines 83-99, 173-176, 274-278
- Shell commands constructed with insufficient escaping
- Backticks, `$()`, semicolons not escaped -- only single/double quotes
- **Fix:** Use `child_process.execFile()` with argument arrays, never string interpolation

### 4. Path Traversal in Jarvis Bridge
**File:** `packages/services/src/jarvis-bridge.ts` lines 341-368
- `readMemory(filename)` and `writeMemory(filename, content)` accept unsanitized filenames
- `../../etc/passwd` would read/overwrite arbitrary files
- **Fix:** Sanitize filename to alphanumeric + limited characters, resolve and verify path stays within target directory

### 5. Missing Webhook Signature Verification
**File:** `apps/web/src/app/api/webhooks/beside/route.ts`
- No HMAC/signature verification on incoming webhooks
- Anyone can POST fabricated call/message events
- Contrast: Stripe webhook correctly verifies signatures

### 6. Webhook Signature Verification Only in Production
**File:** `apps/web/src/app/api/phone/webhook/route.ts` line 44
- Staging/preview deployments have no webhook verification

---

## HIGH PRIORITY ISSUES

### Input Validation
- **No Zod validation on core v1 API bodies** (jobs, customers) -- only manual `if (!title)` checks
- **Unrestricted field updates in sync endpoint** -- `change.data` spread directly into DB update
- **PostgREST filter injection** -- search params interpolated into `.ilike` filter strings
- **SSRF risk** -- webhook URLs not validated against internal/private IP ranges
- **Missing parseInt NaN handling** -- `limit=abc` produces `NaN` passed to `.limit()`

### Business Logic Bugs
- **SMS channel always uses WhatsApp** -- Both `sms` and `whatsapp` cases call `sendWhatsApp`
- **Wrong timezone** -- `DEFAULTS.TIMEZONE` set to `America/Chicago` instead of `America/New_York` (Chelmsford, MA)
- **Invoice number race condition** -- Non-atomic counter can produce duplicates
- **Email service is a stub** -- `createEmailService.send()` always returns `{ success: false }`
- **Supabase errors silently swallowed** -- Insert/update results never checked in invoicing

### Data Integrity
- **Job status enum divergence** -- `constants.ts` has 8 statuses, `schemas.ts` has 4
- **Cents vs dollars mismatch** -- Schemas use cents, invoicing service uses dollars
- **`owner_id` scoping inconsistency** -- Some routes scope to owner, others query globally

---

## MEDIUM PRIORITY ISSUES

### Error Handling & Information Leakage
- Raw database error messages exposed to clients in 10+ routes
- Stripe webhook verification failure details leaked to attackers
- Missing `try-catch` around `request.json()` calls
- `verifyWebhookSignature` throws on buffer length mismatch instead of returning false

### Code Quality
- XSS risk in email templates (no HTML escaping of user data)
- Three duplicate phone normalization implementations
- Duplicate validation APIs (Zod schemas + hand-rolled validators)
- Inconsistent auth patterns (API key vs session vs none)
- Inconsistent response formats across routes
- `formatDuration(0)` returns empty string instead of '0s'

### Architecture
- No test suite visible
- No CI/CD pipeline
- No structured logging
- No API documentation (OpenAPI/Swagger)
- Hardcoded values (phone number, Claude model version)

---

## RECOMMENDED IMPROVEMENT ROADMAP

### Phase 1: Security (Week 1-2)
1. Fix middleware to authenticate API routes
2. Add auth wrapper to all unauthenticated routes
3. Fix command injection in jarvis-bridge.ts
4. Add webhook signature verification to Beside webhook
5. Remove `/api/test-env` and `/api/setup/*` from production
6. Add SSRF protection to webhook URL validation
7. Fix CRON_SECRET to fail-closed

### Phase 2: Data Integrity (Week 3)
1. Align job status enums across files
2. Fix timezone to America/New_York
3. Fix SMS channel bug (WhatsApp fallback)
4. Add Zod validation to all API POST bodies
5. Add field allowlisting to sync endpoint
6. Fix invoice number generation (use DB sequence)
7. Fix cents/dollars inconsistency

### Phase 3: Code Quality (Week 4)
1. Consolidate duplicate phone normalization
2. Remove dead validation.ts (use Zod schemas only)
3. Add HTML escaping to email templates
4. Standardize error responses (never leak internals)
5. Standardize auth pattern across all routes
6. Add structured logging

### Phase 4: Testing & DevOps (Ongoing)
1. Add unit tests for services package
2. Add integration tests for API routes
3. Set up CI/CD pipeline
4. Add API documentation
5. Set up monitoring and alerting
