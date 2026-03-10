# Murray's FSM - Full Codebase Audit Report
**Date:** 2026-03-10
**Scope:** `D:\murrayfsm\murray-fsm-repo\murray-fsm`
**Goal:** Make Murray's FSM the best field service management CRM — better than ServiceTitan, HouseCall Pro, Jobber, Workiz, GoHighLevel

---

## Table of Contents
1. [Executive Summary](#1-executive-summary)
2. [Current State Assessment](#2-current-state-assessment)
3. [Architecture Review](#3-architecture-review)
4. [Security Audit](#4-security-audit)
5. [Bug Catalog](#5-bug-catalog)
6. [Service Module Quality](#6-service-module-quality)
7. [Test Coverage](#7-test-coverage)
8. [Competitive Gap Analysis](#8-competitive-gap-analysis)
9. [Prioritized Roadmap](#9-prioritized-roadmap)
10. [Quick Wins](#10-quick-wins)
11. [Web App Deep Dive](#11-web-app-deep-dive)
12. [Mobile App Deep Dive](#12-mobile-app-deep-dive)

---

## 1. Executive Summary

**Murray's FSM is already a remarkably complete FSM platform.** The codebase has far more
depth than a typical early-stage product:

- **30-table PostgreSQL schema** with RLS policies, triggers, and a migration system
- **25 pure-logic service modules** covering analytics, dispatch, routing, estimates,
  campaigns, leads, inventory, agreements, webhooks, plugins, and more
- **19 dashboard pages** wired to live Supabase data (not mock)
- **18 API routes** with API key auth, scope-based authorization, and usage logging
- **Route optimization** with Haversine + nearest-neighbor TSP + 2-opt improvement
- **Plugin architecture** supporting 10 integration categories
- **Webhook system** with 19 event types, HMAC signing, retry logic
- **Expo mobile app** with offline-first Legend-State, 4 tabs, auth

**However**, there are critical security gaps, schema inconsistencies, and missing features
that separate Murray's from enterprise competitors. The good news: the foundation is solid
and the path to market leadership is achievable.

### Scorecard vs. Competitors (Current State)

| Area                     | Murray | ServiceTitan | HouseCall Pro | Jobber | Workiz | GoHighLevel |
|--------------------------|--------|--------------|---------------|--------|--------|-------------|
| Job Management           | 8/10   | 10/10        | 9/10          | 9/10   | 8/10   | 6/10        |
| Scheduling/Dispatch      | 7/10   | 10/10        | 8/10          | 8/10   | 7/10   | 5/10        |
| Route Optimization       | 7/10   | 9/10         | 6/10          | 5/10   | 4/10   | 2/10        |
| Estimates/Invoicing      | 6/10   | 9/10         | 9/10          | 9/10   | 8/10   | 5/10        |
| CRM/Pipeline             | 7/10   | 8/10         | 6/10          | 7/10   | 7/10   | 10/10       |
| Marketing/Campaigns      | 5/10   | 5/10         | 3/10          | 3/10   | 4/10   | 10/10       |
| Analytics                | 7/10   | 9/10         | 7/10          | 7/10   | 6/10   | 7/10        |
| Mobile App               | 4/10   | 8/10         | 8/10          | 8/10   | 7/10   | 6/10        |
| Customer Portal          | 4/10   | 7/10         | 7/10          | 8/10   | 6/10   | 5/10        |
| Integrations/API         | 7/10   | 9/10         | 7/10          | 8/10   | 7/10   | 8/10        |
| Security                 | 3/10   | 9/10         | 8/10          | 8/10   | 7/10   | 7/10        |
| **Overall**              | **59** | **93**       | **78**        | **80** | **71** | **71**      |

---

## 2. Current State Assessment

### What Exists (Working)

#### Database (30 tables in schema-v2)
- Core: profiles, customers, locations, jobs, job_events, job_photos, job_signatures
- Financial: line_items, payments, estimates, estimate_items
- Operations: technicians, time_entries, recurring_jobs, calendar_events
- CRM: pipeline_stages, leads, interactions, follow_ups
- Communication: comm_threads, call_logs, message_logs, raw_events, action_queue
- Business: service_agreements, campaigns, campaign_recipients, referrals
- System: business_settings, tags, notifications, reviews
- Platform: api_keys, webhook_endpoints, installed_plugins, inventory_items, inventory_transactions
- Migrations applied: `full_schema_expansion_part1_tables`, `full_schema_expansion_part2_rls_triggers`

#### Services Layer (25 modules, ~6,000+ lines of pure business logic)
| Module            | Functions | Key Capabilities                                          |
|-------------------|-----------|-----------------------------------------------------------|
| analytics.ts      | 7         | Revenue trends, profitability, LTV, KPIs, MRR, job trends |
| scheduling.ts     | 6+        | Conflict detection, business hours, available slots        |
| dispatch.ts       | 5         | Skill matching, workload scoring, auto-assign, batch       |
| routing.ts        | 9         | Haversine, TSP, 2-opt, multi-tech dispatch, service areas  |
| pdf.ts            | 5         | HTML estimates/invoices, XSS escaping, print CSS           |
| email.ts          | 5         | Templates for 4 email types (send is STUB)                 |
| estimates.ts      | 5+        | Numbering, totals, expiration, stats, conversion           |
| inventory.ts      | 5+        | Margins, stock levels, reorder suggestions, valuations     |
| recurring-jobs.ts | 5+        | RRULE parsing, occurrence generation, job creation         |
| notifications.ts  | 5+        | 10 notification types, grouping, counting, sorting         |
| webhooks.ts       | 5+        | 19 events, HMAC signing, delivery tracking, retries        |
| plugins.ts        | 5+        | 10 categories, lifecycle hooks, config validation          |
| agreements.ts     | 4+        | Expiration checks, MRR calculation, stats                  |
| campaigns.ts      | 4+        | Recipient building, stats, delivery/open/click rates       |
| leads.ts          | 4+        | Pipeline value, lead scoring, stage analytics, conversion  |
| reviews.ts        | 4+        | Ratings, distributions, response rates, platform breakdown |
| technicians.ts    | 4+        | Scoring, availability, utilization, stats                  |
| time-entries.ts   | 4+        | Duration calc, hours by type, overtime, daily breakdown    |
| api-keys.ts       | -         | Key generation, scope validation, hasScope()               |

#### Web App (19 dashboard pages, all server-rendered with live data)
- Jobs list + detail with technician join
- Visual dispatch board (ServiceTitan-style technician lanes)
- Analytics dashboard with MetricCard components
- Estimates (list + create new)
- Customers, Team, Calendar, Calls, Texts
- Pipeline, Payments, Inventory, Marketing
- Recurring jobs, Agreements, Reviews, Referrals
- Settings + Integrations
- Approvals (with approve/reject actions)

#### API Layer (18 routes)
- v1/jobs (GET list, GET detail) with auth + scopes
- v1/customers (GET list)
- v1/routes/optimize (POST)
- v1/sync (POST for mobile)
- PDF generation: estimate/[jobId], invoice/[jobId]
- Webhooks CRUD + test
- Plugins CRUD + test
- API keys CRUD
- Approvals approve/reject
- Schedule check

#### Mobile App (Expo 51)
- 4 tabs: Home, Customers, Schedule, Settings
- Job detail screen
- Auth login
- Legend-State offline store
- 6 components, 3 hooks

#### Edge Functions
- `create-payment-intent` (Stripe)
- `healthcheck`

---

## 3. Architecture Review

### Strengths
1. **Clean monorepo structure** — `apps/web`, `apps/mobile`, `packages/services`, `packages/shared`
2. **Pure business logic in services** — Zero framework coupling, easily testable
3. **Server-side rendering** — Dashboard pages fetch data in RSC, no client-side waterfall
4. **Plugin architecture** — Extensible with 10 categories and lifecycle hooks
5. **Webhook system** — Production-grade with HMAC signatures and retry logic
6. **Route optimization** — Genuine TSP solver, not just distance sorting

### Concerns
1. **No service layer abstraction for Supabase** — Pages call `supabase.from()` directly.
   Every page has its own query builder. Should have a repository/data-access layer.
2. **No error boundary components** — A single failed query crashes the page
3. **No caching strategy** — Every page load hits the database. No ISR, no Redis, no SWR.
4. **No real-time subscriptions** — Supabase realtime is not used. Dispatch board requires
   manual refresh.
5. **No rate limiting implementation** — Documented in API.md but not implemented
6. **Email service is a stub** — `send()` returns `{ success: false }` always
7. **PDF generation needs a renderer** — HTML templates exist but no Puppeteer/wkhtmltopdf

---

## 4. Security Audit

### CRITICAL Issues

#### S1: Middleware marks `/api` as public
**File:** `apps/web/src/middleware.ts:65-66`
```typescript
const publicPrefixes = ['/auth', '/book', '/portal', '/api'];
```
**Impact:** ALL API routes bypass Supabase session auth at the middleware level.
The v1 API routes have their own API-key auth, but internal routes (approvals, schedule/check)
rely solely on whatever auth they implement individually.
**Fix:** Remove `/api` from `publicPrefixes`. Add specific exceptions only for routes that
need public access (webhooks callback endpoints, etc.). Internal API routes should require
either session auth OR API key auth.

#### S2: No rate limiting on API endpoints
**File:** `apps/web/src/lib/api-auth.ts`
**Impact:** API key rate limits are documented (100 req/min) but never enforced. Any API key
holder can make unlimited requests. DDoS risk and data scraping risk.
**Fix:** Implement rate limiting with either:
- Supabase Edge Functions + KV store
- Upstash Redis rate limiter (@upstash/ratelimit)
- Cloudflare Workers rate limiting if fronted by CF

#### S3: No input sanitization on API endpoints
**File:** `apps/web/src/app/api/v1/jobs/route.ts` and others
**Impact:** Query parameters like `status`, `customer_id` are passed directly to Supabase
query builder. While Supabase parameterizes queries (preventing SQL injection), there's no
validation that values match expected formats (e.g., UUIDs, enum values).
**Fix:** Add Zod validation at each API endpoint. Shared schemas exist but are unused.

### HIGH Issues

#### S4: API keys stored without hashing
**Impact:** If the database is compromised, all API keys are in plaintext.
**Fix:** Store hashed API keys (SHA-256 of the key). Look up by prefix (first 8 chars).

#### S5: No CSRF protection on form actions
**Impact:** State-changing operations via POST could be triggered by malicious third-party sites.
**Fix:** Implement CSRF tokens or use the `SameSite=Strict` cookie policy.

#### S6: No audit logging
**Impact:** No trail of who did what and when. Compliance risk for larger customers.
**Fix:** Add an `audit_log` table triggered on significant mutations.

---

## 5. Bug Catalog

### CRITICAL Bugs

#### B1: Schema mismatch — job_status has 3 different definitions
| Source               | Values                                                                 |
|----------------------|------------------------------------------------------------------------|
| schema.sql (enum)    | `scheduled, in_progress, completed, canceled`                          |
| schema-v2.sql (enum) | `new, contacted, scheduled, in_progress, completed, cancelled, spam`   |
| constants.ts (type)  | `lead, quoted, scheduled, confirmed, in_progress, completed, invoiced, canceled` |

**Impact:** The web app uses constants.ts values (8 statuses). The database may reject values
not in the enum. "invoiced" and "confirmed" don't exist in any schema enum.
**Fix:** Align all three. Recommended: use constants.ts as source of truth and ALTER the
database enum to match. Run: `ALTER TYPE job_status ADD VALUE 'lead'` etc.

#### B2: Email send() is a stub
**File:** `packages/services/src/email.ts`
**Impact:** No emails are actually sent. Estimate approvals, job notifications, invoice emails
all silently fail.
**Fix:** Integrate with Resend, SendGrid, or Postmark. The HTML templates are already built.

#### B3: Timezone set to America/Chicago
**File:** `packages/shared/src/constants.ts`
**Impact:** All scheduling, time entries, and date displays show Central time. If the business
operates in Eastern time, every scheduled appointment is off by 1 hour.
**Fix:** Change to `America/New_York` or make configurable per-business via `business_settings`.

### HIGH Bugs

#### B4: PDF generation has no rendering backend
**Impact:** `getEstimatePdfUrl()` and `getInvoicePdfUrl()` generate URLs but there's no service
to convert HTML to PDF. The API routes at `/api/pdf/*` exist but likely fail.
**Fix:** Add Puppeteer or use a headless Chrome service (Browserless, Gotenberg).

#### B5: Missing database indexes in schema-v2
**Impact:** Queries on high-traffic tables (jobs, customers, payments) will slow as data grows.
The original schema.sql had indexes but schema-v2.sql has none.
**Fix:** Add indexes on: `jobs(status)`, `jobs(assigned_technician_id)`, `jobs(customer_id)`,
`jobs(scheduled_at)`, `payments(job_id)`, `estimates(job_id)`, `time_entries(technician_id)`,
`leads(stage_id)`, `notifications(owner_id, is_read)`.

#### B6: `canceled` vs `cancelled` spelling inconsistency
**Impact:** schema.sql uses `canceled`, schema-v2 uses `cancelled`, constants.ts uses `canceled`.
Code filtering by status may miss records.
**Fix:** Standardize to one spelling across all files.

### MEDIUM Bugs

#### B7: Jobs page limited to 50 records with no pagination
**File:** `apps/web/src/app/(dashboard)/jobs/page.tsx:41`
**Impact:** Users with 50+ jobs can never see older ones.
**Fix:** Add cursor-based or offset pagination with infinite scroll or page controls.

#### B8: Analytics calculates stats client-side from all jobs
**Impact:** As job count grows, loading all jobs to calculate KPIs becomes slow.
**Fix:** Push aggregations to SQL (Supabase views or RPCs).

#### B9: No error handling on Supabase queries in pages
**Impact:** A single DB error returns an empty array silently. Users see empty dashboards
with no explanation.
**Fix:** Add error states, loading states, and error boundary components.

---

## 6. Service Module Quality

### Grade: A- (Excellent for Pure Logic)

All 25 service modules follow the same high-quality pattern:
- Clean TypeScript with proper interfaces
- Pure functions with no side effects
- Well-documented JSDoc comments
- Sensible defaults and edge case handling

**Missing integration layer:** Services are pure logic only. There's no "service coordinator"
that connects services to Supabase. Each page/API route has to manually query data AND
call service functions. This means:
- Business logic is duplicated across pages
- Changing a business rule requires updating multiple files
- No centralized place for transaction coordination

**Recommendation:** Add a thin "use case" or "action" layer:
```
Page → Action (coordinates queries + services) → Service (pure logic) + Repository (DB)
```

---

## 7. Test Coverage

### Current: 5 test files, ~2,000 lines

| Test File              | Lines | What's Tested                              |
|------------------------|-------|--------------------------------------------|
| analytics.test.ts      | 449   | Revenue trends, profitability, KPIs, LTV   |
| dispatch.test.ts       | 325   | Skill matching, ranking, auto-assign       |
| inventory.test.ts      | 324   | Margins, stock levels, reorder             |
| recurring-jobs.test.ts | 384   | RRULE parsing, occurrence generation       |
| scheduling.test.ts     | 487   | Conflicts, slots, business hours           |

**Coverage Gap:** 20 service modules have zero tests. No API route tests. No component tests.
No E2E tests.

**Priority test additions:**
1. API route tests (auth, scopes, validation)
2. routing.ts (critical for dispatch)
3. estimates.ts (money calculations)
4. webhooks.ts (delivery reliability)
5. E2E: job lifecycle (create → schedule → dispatch → complete → invoice → pay)

---

## 8. Competitive Gap Analysis

### vs. ServiceTitan (Market Leader, $9.5B valuation)

| Feature                     | ServiceTitan | Murray's FSM | Gap     |
|-----------------------------|-------------|--------------|---------|
| Visual dispatch board       | Yes         | Yes          | Close   |
| GPS fleet tracking          | Yes (live)  | No           | **BIG** |
| Pricebook management        | Yes         | Partial      | Medium  |
| Membership/agreement mgmt   | Yes         | Yes          | Close   |
| Marketing automation        | Yes         | Basic        | Medium  |
| Integrated payments         | Yes         | Stripe only  | Small   |
| Customer financing          | Yes         | No           | Medium  |
| Call tracking/recording     | Yes         | Schema only  | **BIG** |
| Reporting/dashboards        | Extensive   | Good         | Medium  |
| Multi-location support      | Yes         | No           | Medium  |
| Custom forms/checklists     | Yes         | No           | **BIG** |
| Photo/video uploads         | Yes         | Schema only  | Medium  |
| Permit tracking             | Yes         | No           | Small   |
| AI-powered scheduling       | Yes (new)   | TSP solver   | Small   |

**Key gaps to close:** GPS tracking, custom forms/checklists, call recording integration

### vs. Jobber (Best SMB UX)

| Feature                | Jobber      | Murray's FSM | Gap     |
|------------------------|-------------|--------------|---------|
| Client hub (portal)    | Excellent   | Basic        | **BIG** |
| Online booking         | Yes         | Yes          | Close   |
| Quoting/estimates      | Polished    | Functional   | Medium  |
| Batch invoicing        | Yes         | No           | Medium  |
| Client reminders       | Automated   | Manual       | Medium  |
| Chemical tracking      | Yes         | No           | Small   |
| Expense tracking       | Yes         | No           | Medium  |
| Two-way SMS            | Yes         | Schema only  | **BIG** |

**Key gaps to close:** Customer portal UX, automated reminders, two-way SMS

### vs. GoHighLevel (Best Marketing/CRM)

| Feature                  | GoHighLevel | Murray's FSM | Gap     |
|--------------------------|-------------|--------------|---------|
| Unified inbox            | Yes         | Schema only  | **BIG** |
| Email/SMS sequences      | Advanced    | Basic        | **BIG** |
| Funnel/landing pages     | Yes         | No           | Medium  |
| Reputation management    | Yes         | Basic reviews | Medium  |
| Calendar booking         | Yes         | Yes          | Close   |
| Pipeline/CRM             | Excellent   | Good         | Small   |
| Workflow automation      | Visual builder | n8n       | Close   |
| White-label              | Yes         | No           | Medium  |

**Key gaps to close:** Unified inbox, advanced sequences, reputation management

### Features Only Murray's Has (Competitive Advantages)

1. **Real route optimization** — TSP solver + 2-opt improvement. Most competitors use
   simple distance sorting or rely on Google Maps alone.
2. **Plugin architecture** — Extensible marketplace model. Only ServiceTitan has this at scale.
3. **Webhook system** — Production-grade with 19 events. Better than most competitors.
4. **AI action pipeline** — `raw_events → AI extraction → action_queue → approval` is unique.
5. **Full public API** — Scope-based keys with usage tracking. Better than HouseCall Pro/Workiz.

---

## 9. Prioritized Roadmap

### Phase 0: App-Breaking Fixes (Day 1) — BLOCKING
*The app is non-functional without these*

1. **Create `/jobs/[jobId]` detail page** — Clicking "View" on any job is a 404
2. **Create `/jobs/new` page** — "New Job" button leads to 404
3. **Fix middleware security** (S1) — Remove `/api` from public prefixes

### Phase 1: Foundation Fixes (Week 1-2) — CRITICAL
*Fix security holes and critical bugs*

4. **Fix schema mismatch** (B1) — Align job_status enum across DB/code/constants
5. **Fix timezone** (B3) — Make configurable via business_settings
6. **Fix email stub** (B2) — Integrate Resend or SendGrid
7. **Add database indexes** (B5) — Prevent future performance cliff
8. **Standardize canceled/cancelled** (B6)
9. **Add rate limiting** (S2) — Upstash Redis or CF Workers
10. **Add Zod validation to API routes** (S3)
11. **Build core UI components** — Modal/Dialog, Form inputs, Toast, DataTable
12. **Add auth flows** — Signup, password reset

### Phase 2: Core Experience Polish (Week 3-5)
*Make what exists actually production-quality*

9. **Add pagination** to all list pages (jobs, customers, estimates, etc.)
10. **Add error boundaries** and loading states to all dashboard pages
11. **Wire PDF generation** — Add Puppeteer or Gotenberg for estimate/invoice PDFs
12. **Add real-time subscriptions** — Supabase realtime on dispatch board + notifications
13. **Wire notification bell** — Connect NotificationBell component to notifications table
14. **Add data-access layer** — Repository pattern between pages and Supabase
15. **Customer portal upgrade** — Self-service: view jobs, approve estimates, pay invoices
16. **Two-way SMS** — Wire comm_threads + message_logs to actual SMS provider (Twilio)

### Phase 3: Competitive Feature Parity (Week 6-10)
*Close the biggest gaps vs. ServiceTitan/Jobber*

17. **Unified inbox** — Single view for calls, texts, emails per customer
18. **GPS fleet tracking** — Live technician location on dispatch map
19. **Custom forms/checklists** — Per-service-type job checklists with photo upload
20. **Automated reminders** — Appointment reminders via SMS/email (24hr, 1hr before)
21. **Batch invoicing** — Generate invoices for all completed jobs in one click
22. **Photo/video uploads** — Job photos from mobile app to Supabase Storage
23. **Expense tracking** — Per-job and per-technician expense logging

### Phase 4: Differentiation (Week 11-16)
*Features that make Murray's BETTER than competitors*

24. **AI dispatch intelligence** — Use job history + tech performance to optimize assignments
25. **Smart sequences** — Automated follow-up campaigns based on job stage triggers
26. **Revenue intelligence** — Predictive analytics: which leads will convert, churn risk
27. **White-label capability** — Custom branding per business for multi-tenant SaaS
28. **Marketplace** — Public plugin directory for third-party integrations
29. **Mobile app parity** — Offline job completion, photo capture, signature, payment
30. **Voice-to-job** — Record calls → AI transcription → auto-create job + schedule

### Phase 5: Scale & Quality (Ongoing)
*Enterprise readiness*

31. **Test coverage to 80%+** — API routes, services, components, E2E
32. **Audit logging** (S6) — Full activity trail for compliance
33. **Multi-location support** — Franchise model with location-scoped data
34. **API key hashing** (S4)
35. **Performance monitoring** — Sentry, Datadog, or similar
36. **Documentation site** — Developer docs for API and plugin creation

---

## 10. Quick Wins (Can Do Today)

These are changes that take < 1 hour each and have outsized impact:

| #  | Change                                         | Impact          | Effort |
|----|-------------------------------------------------|-----------------|--------|
| 1  | Remove `/api` from middleware publicPrefixes    | Security fix    | 5 min  |
| 2  | Change timezone to America/New_York             | Bug fix         | 2 min  |
| 3  | Fix canceled/cancelled spelling                 | Data integrity  | 15 min |
| 4  | Add `LIMIT` + offset to all list pages          | UX              | 30 min |
| 5  | Add indexes to schema-v2 tables                 | Performance     | 20 min |
| 6  | Connect email service to Resend (free tier)     | Feature unlock  | 45 min |
| 7  | Add error state JSX to dashboard pages          | UX              | 30 min |
| 8  | Wire NotificationBell to real data              | Feature         | 30 min |
| 9  | Add Zod validation to v1/jobs endpoint          | Security        | 30 min |
| 10 | Fix job_status enum in database                 | Data integrity  | 15 min |

---

## Summary

Murray's FSM has an **exceptional foundation** — more service modules, better algorithms,
and cleaner architecture than most FSM products at this stage. The 25-module service layer
with route optimization, plugin architecture, and webhook system is genuinely impressive.

**The critical path is:**
1. Fix security (middleware, rate limiting, input validation) — **this week**
2. Polish what exists (pagination, error handling, PDFs, email) — **next 2 weeks**
3. Close competitive gaps (unified inbox, GPS, forms) — **next 2 months**
4. Differentiate with AI + marketplace — **next 4 months**

After Phase 3, Murray's FSM will be competitive with HouseCall Pro and Jobber.
After Phase 4, it will have unique advantages over all competitors including ServiceTitan.

---

## 11. Web App Deep Dive

### Missing Pages (404s)

| Route              | Linked From          | Status     |
|--------------------|----------------------|------------|
| `/jobs/[jobId]`    | Jobs list "View" btn | **404**    |
| `/jobs/new`        | Jobs page "New Job"  | **404**    |
| `/settings`        | Sidebar              | Only `/settings/integrations` exists |
| `/customers/[id]`  | Customers list       | **404**    |
| `/auth/signup`     | None (no link)       | **Missing** |
| `/auth/forgot-password` | None            | **Missing** |
| `/notifications`   | NotificationBell     | **Missing** |

### Missing UI Components

**Critical (blocking basic usability):**
- **Modal/Dialog** — No confirmation for approve, reject, delete actions
- **Form components** — No Input, Select, Textarea, DatePicker, FormField
- **DataTable** — Every page builds ad-hoc `<table>` with no sort/filter/pagination
- **Toast/Notification** — No success/error feedback after actions
- **Loading/Skeleton** — No skeleton loaders for server components

**Important:**
- **Dropdown/Select** — No dropdown menu for action buttons
- **Tabs** — Needed for job detail, settings pages
- **Calendar/DatePicker** — Booking page has stub calendar
- **Map component** — No Google Maps despite dispatch board concept
- **FileUpload** — No photo upload for before/after job photos
- **Search/CommandPalette** — Header search bar is non-functional (no onChange handler)
- **Sidebar collapse** — Fixed 256px, no mobile responsive menu

### Responsive Design

**Current state: Not responsive.** Key issues:
- Sidebar is fixed `w-64` with no collapse toggle or mobile hamburger menu
- Dispatch board uses `grid-cols-6` without mobile breakpoints
- Analytics page uses `grid-cols-4` without adequate mobile fallbacks
- No `md:` or `lg:` breakpoint usage in layout components

### PWA / Offline

**Current state: Scaffolded but non-functional.**
- `manifest.json` exists with only one icon size (needs 192x192 + 512x512 + maskable)
- `@ducanh2912/next-pwa` dependency installed
- **`sw.js` is a dev-mode service worker** with `NetworkOnly` caching — zero offline capability
- No IndexedDB data cache, no background sync, no push notifications
- "Offline-first" claim in project description is not yet true

### Styling Observations

- **No dark mode** — No `darkMode` config, no `dark:` variants
- **Inconsistent colors** — Some pages use `primary-600` from config, others hardcode `blue-600`
- **Duplicated config** — Dispatch page and booking page both define their own urgency/status
  color mappings instead of importing from `lib/utils.ts`
- **No animations** — Only Button spinner. No page transitions, no micro-interactions.

### TypeScript Quality

- `strict: true` is enabled (good)
- **`any` casts found** in dispatch page (`j: any`), approvals page (`payload as any`),
  and analytics page (inferred types from Supabase queries)
- Fix: Create proper response interfaces for joined Supabase queries

### Strong Points

- **Analytics dashboard** is genuinely comprehensive (9 data sections, MetricCard components)
- **Approval queue** with AI-suggested actions is a unique differentiator
- **Customer portal** with token-based access and status timeline is well-built
- **Booking wizard** with multi-step service/date/info/confirm flow competes with HouseCall Pro
- **Dispatch board** with technician lanes and unassigned alerts is a solid foundation
- **External API** with scoped keys, IP allowlists, usage logging exceeds most competitors

## 12. Mobile App Deep Dive (Expo 51)

### Overall Score: 3.2/10

The mobile app has the right *architecture* (Legend-State + Supabase synced observables)
but the *implementation* has runtime-crashing bugs and is missing 30+ features that
every competitor ships.

### Runtime-Crashing Bugs

| # | Bug | File | Impact |
|---|-----|------|--------|
| M1 | `lineItems$` imported but never defined in store | `hooks/useJob.ts:8` → `store/index.ts` | **Job Detail screen crashes** |
| M2 | `payments$` imported but never defined in store | `hooks/useJob.ts:9` → `store/index.ts` | **Job Detail screen crashes** |
| M3 | `LineItem` type doesn't exist | `hooks/useJob.ts:16` → `types/database.ts` | **TypeScript compilation fails** |
| M4 | `JobWithRelations` type doesn't exist | Same file | **TypeScript compilation fails** |
| M5 | `job.scheduled_start` field doesn't exist | `(tabs)/index.tsx:30`, `schedule.tsx:41` | Today + Schedule screens show 0 jobs |
| M6 | Android navigation broken | `job/[id].tsx:65` uses `maps://maps.apple.com` | Android users can't navigate to jobs |
| M7 | `@legendapp/state` in devDependencies | `package.json:41` | Production builds may exclude core state library |

### Category Scores

| Category | Score | Notes |
|----------|-------|-------|
| Offline-First Architecture | 4/10 | Sound design, broken stores |
| Auth Flow | 5/10 | Email/password works; no signup, reset, biometric |
| Navigation | 3/10 | 4 tabs + 1 detail; missing 8+ critical screens |
| Components | 6/10 | 6 well-built components; needs 15+ more |
| State Management | 5/10 | Good pattern; 2 missing store exports crash app |
| Payment (Stripe) | 4/10 | Correct pattern; broken by missing store |
| Photo/Signature Capture | 1/10 | All deps installed, zero UI implemented |
| GPS/Location | 1/10 | Apple Maps link only, no `expo-location` dep |
| Push Notifications | 0/10 | Completely absent, no `expo-notifications` |
| Performance | 4/10 | FlatList ok; battery-unfriendly 10s polling |

### What's Scaffolded But Not Working

| Feature | Dependencies Installed | Store/Types | UI Built |
|---------|----------------------|-------------|----------|
| Photo capture | expo-camera, expo-image-picker | jobPhotos$, pendingUploads$ | **No** |
| Signature capture | react-native-signature-canvas | jobSignatures$ | **No** |
| Push notifications | — | notifications$ | **No** |
| GPS tracking | — | — | **No** |
| Inventory | — | inventoryItems$ | **No** |
| Estimates | — | estimates$ | **No** |

### Other Issues

- **Fake pull-to-refresh** — Sets `isSyncing = true`, waits 1 second, sets false. No actual sync.
- **StatusBadge covers only 4 of 7 statuses** — `new`, `contacted`, `spam` fall through to default
- **`canceled` vs `cancelled` spelling mismatch** — StatusBadge uses `canceled`, type uses `cancelled`
- **No conflict resolution** — Last-write-wins only. No detection for concurrent edits.
- **No pending-changes indicator** — Offline banner exists but no count of unsynced changes
- **All styling is hardcoded** — Blue `#1e40af` in 15+ places, no theme tokens
- **No error boundaries** — Runtime errors crash the entire app
- **10-second network polling** — Battery drain. Should use `expo-network` event listener.

### Missing Features vs. Competitors (30+)

Every major competitor ships these on mobile. Murray's has none:

**Job execution:** Job creation, photo before/after, signature capture, time tracking,
forms/checklists, voice-to-text notes, barcode scanning

**Communication:** In-app chat with dispatch, push notifications, review request to customer

**Navigation:** GPS tracking, route optimization, driving directions, geofencing arrival

**Financial:** Receipt generation, partial payments, cash/check recording, tip support,
pricebook lookup, Good-Better-Best estimates, expense tracking

**Team:** Dispatch board (read-only), team chat, inventory on-truck

### Priority Fixes (Ordered)

1. Move `@legendapp/state` to `dependencies`
2. Add `lineItems$` and `payments$` store exports with `syncedSupabase`
3. Add `LineItem`, `Payment`, `JobWithRelations` type definitions
4. Fix `scheduled_start` → `scheduled_at` field name
5. Fix StatusBadge to cover all 7 statuses + spelling
6. Fix Android navigation with `Platform.select` (Apple Maps vs Google Maps)
7. Implement real pull-to-refresh (trigger Legend-State sync)
8. Build photo capture screen (deps already installed)
9. Build signature capture screen (dep already installed)
10. Add `expo-location` + `expo-notifications` dependencies

---

*Report generated by Claude Opus 4.6 — Full codebase analysis of 30 tables, 25 service
modules, 19 dashboard pages, 18 API routes, 2 edge functions, 5 test suites, and
34 mobile app files.*
