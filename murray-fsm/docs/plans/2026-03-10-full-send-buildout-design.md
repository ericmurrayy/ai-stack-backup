# Murray's FSM: Full-Send Build-Out Design

**Date:** 2026-03-10
**Goal:** Build a fully autonomous home service business platform competing with ServiceTitan, HubSpot, HouseCall Pro, and Jobber.
**Approach:** Schema-first, then services, then parallel UI + automation build-out.

---

## Current State

**15 tables** in Supabase (profiles, customers, locations, jobs, job_events, job_photos, job_signatures, line_items, payments, comm_threads, call_logs, message_logs, action_queue, automation_events, calendar_events).

**14 dashboard pages** — Jobs and Customers are production-ready with real DB. Analytics and Pipeline have real DB integration. Inventory, Marketing, Team, and Reviews have complete UIs but use mock data.

**Mobile app** — Expo with offline-first Legend-State sync, job completion flow, payment collection.

**Automation** — 8 n8n workflows for webhooks, approvals, reminders, calendar sync.

---

## Layer 1: Database Schema Expansion

### New Tables

#### `technicians`
Team members who perform field work.
```sql
- id, owner_id, profile_id (FK profiles), name, email, phone
- role ENUM ('technician', 'dispatcher', 'admin')
- skills TEXT[], hourly_rate_cents, color (for calendar)
- is_active, availability JSONB (weekly schedule)
- created_at, updated_at, deleted
```

#### `inventory_items`
Parts and materials tracked in stock.
```sql
- id, owner_id, name, sku (unique per owner), description
- category, unit_of_measure, cost_cents, price_cents
- qty_on_hand, qty_reserved, reorder_point, reorder_qty
- vendor, vendor_part_number, location_in_shop
- created_at, updated_at, deleted
```

#### `inventory_transactions`
Stock movement ledger (in/out/adjust).
```sql
- id, owner_id, item_id (FK inventory_items)
- transaction_type ENUM ('purchase', 'use', 'adjustment', 'return')
- qty_change (positive=in, negative=out), job_id (FK jobs nullable)
- notes, created_by, created_at
```

#### `recurring_jobs`
Templates for jobs that repeat on a schedule.
```sql
- id, owner_id, customer_id (FK), location_id (FK)
- title, service_type, description
- rrule TEXT (iCal RRULE format)
- duration_minutes, assigned_technician_id (FK technicians)
- line_items_template JSONB
- next_occurrence_at, last_generated_at
- is_active, created_at, updated_at, deleted
```

#### `reviews`
Customer reviews from various platforms.
```sql
- id, owner_id, customer_id (FK nullable), job_id (FK nullable)
- platform ENUM ('google', 'yelp', 'facebook', 'direct', 'other')
- reviewer_name, rating (1-5), review_text
- response_text, responded_at
- external_review_id, review_url
- reviewed_at, created_at, updated_at, deleted
```

#### `campaigns`
Marketing campaigns (email/SMS).
```sql
- id, owner_id, name, description
- type ENUM ('email', 'sms', 'both')
- status ENUM ('draft', 'scheduled', 'active', 'paused', 'completed')
- template_subject, template_body
- target_filter JSONB (customer segment criteria)
- scheduled_at, started_at, completed_at
- stats JSONB (sent, delivered, opened, clicked, converted)
- created_at, updated_at, deleted
```

#### `campaign_recipients`
Individual campaign delivery tracking.
```sql
- id, owner_id, campaign_id (FK), customer_id (FK)
- channel ENUM ('email', 'sms'), destination (email or phone)
- status ENUM ('pending', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed')
- sent_at, delivered_at, opened_at, clicked_at
- created_at
```

#### `pipeline_stages`
Customizable sales pipeline stages.
```sql
- id, owner_id, name, color, sort_order
- is_won BOOLEAN, is_lost BOOLEAN
- created_at, updated_at, deleted
```

#### `leads`
Sales leads tracked through the pipeline.
```sql
- id, owner_id, customer_id (FK nullable)
- stage_id (FK pipeline_stages)
- title, description, source TEXT
- estimated_value_cents, probability INTEGER (0-100)
- assigned_technician_id (FK technicians nullable)
- expected_close_date, won_at, lost_at, lost_reason
- created_at, updated_at, deleted
```

#### `time_entries`
Technician time tracking per job.
```sql
- id, owner_id, technician_id (FK), job_id (FK nullable)
- entry_type ENUM ('travel', 'work', 'break')
- started_at, ended_at, duration_minutes (computed or manual)
- notes, created_at, updated_at, deleted
```

#### `estimates`
Standalone estimates not yet tied to a job.
```sql
- id, owner_id, customer_id (FK), location_id (FK nullable)
- estimate_number TEXT (auto-generated sequence)
- status ENUM ('draft', 'sent', 'viewed', 'approved', 'rejected', 'expired')
- title, notes, valid_until DATE
- total_cents, sent_at, approved_at, converted_job_id (FK jobs nullable)
- created_at, updated_at, deleted
```

#### `estimate_items`
Line items for standalone estimates.
```sql
- id, owner_id, estimate_id (FK estimates)
- name, description, qty, unit_price_cents, total_cents (computed)
- sort_order, created_at, updated_at, deleted
```

#### `tags`
Flexible tagging system for any entity.
```sql
- id, owner_id, entity_type TEXT, entity_id UUID
- tag TEXT
- created_at
- UNIQUE(owner_id, entity_type, entity_id, tag)
```

#### `notifications`
In-app notification center.
```sql
- id, owner_id, title, body
- type TEXT (new_job, approval_needed, payment_received, review_received, etc.)
- entity_type TEXT, entity_id UUID (links to related record)
- is_read BOOLEAN DEFAULT FALSE, read_at
- created_at
```

#### `service_agreements`
Maintenance contracts and memberships.
```sql
- id, owner_id, customer_id (FK), location_id (FK nullable)
- name, description
- type ENUM ('maintenance', 'warranty', 'membership')
- status ENUM ('active', 'expired', 'canceled')
- start_date DATE, end_date DATE
- recurring_job_id (FK recurring_jobs nullable)
- price_cents, billing_cycle ENUM ('monthly', 'quarterly', 'annual')
- terms TEXT
- created_at, updated_at, deleted
```

### Columns to Add to Existing Tables

**jobs**: `assigned_technician_id UUID REFERENCES technicians(id)`, `priority ENUM ('low', 'normal', 'high', 'emergency')`, `source TEXT`, `recurring_job_id UUID REFERENCES recurring_jobs(id)`, `estimate_id UUID REFERENCES estimates(id)`

**line_items**: `inventory_item_id UUID REFERENCES inventory_items(id)` (link to inventory for auto-deduct)

### RLS Policies

All new tables follow the same pattern: `owner_id = auth.uid()` for SELECT, INSERT, UPDATE, DELETE.

---

## Layer 2: Shared Services (packages/services)

### New Services to Build

1. **technician-service** — CRUD, availability checking, skill matching, workload balancing
2. **inventory-service** — CRUD, stock transactions, low-stock alerts, usage-from-job auto-deduct
3. **recurring-job-service** — RRULE parsing, next-occurrence calculation, job generation
4. **review-service** — CRUD, response management, rating aggregation, review request sending
5. **campaign-service** — CRUD, recipient targeting, send orchestration, stats tracking
6. **lead-service** — CRUD, stage transitions, pipeline analytics, lead scoring
7. **estimate-service** — CRUD, PDF generation, sending, approval tracking, convert-to-job
8. **time-entry-service** — CRUD, duration calculation, technician utilization reports
9. **notification-service** — Create, mark read, badge count, real-time via Supabase Realtime
10. **agreement-service** — CRUD, expiration tracking, auto-renewal, linked recurring jobs
11. **analytics-service** — Revenue calculations, KPIs, trend analysis, forecasting
12. **dispatch-service** — AI-powered technician selection (skills + proximity + availability)

---

## Layer 3: Wire Mock Pages to Real Data

### Inventory Page
- Replace 6-item mock array with `inventory_items` Supabase query
- Add create/edit item modals
- Wire stock adjustment actions to `inventory_transactions`
- Add low-stock alert badge to sidebar

### Marketing Page
- Replace mock campaigns with `campaigns` Supabase query
- Add campaign creation flow (select audience, write template, schedule)
- Wire recipient tracking to `campaign_recipients`
- Add automation template activation

### Team Page
- Replace 3 demo members with `technicians` Supabase query
- Add technician creation/edit forms
- Wire performance stats from real `jobs` + `time_entries` data
- Add availability calendar view

### Reviews Page
- Replace 4 sample reviews with `reviews` Supabase query
- Wire response form to update `reviews.response_text`
- Add review request sending (SMS/email to recent customers)
- Add platform filter from real data

---

## Layer 4: New Features

### Recurring Jobs
- Settings UI for creating recurring schedules (weekly, biweekly, monthly, quarterly, annual)
- RRULE generation from UI selections
- Cron job or n8n workflow to generate upcoming jobs from recurring templates
- Customer portal shows upcoming scheduled maintenance

### Multi-Technician Dispatch
- Technician list with skills and availability on job scheduling
- AI auto-suggest best technician for a job
- Calendar view showing all technicians' schedules
- Drag-and-drop job assignment

### Customer Portal Upgrade
- Self-service online booking with date/time selection
- Estimate review and approval
- Invoice viewing and online payment
- Job status tracking with real-time updates
- Communication history

### Notification Center
- Bell icon in header with unread badge
- Dropdown showing recent notifications
- Click-through to related entity
- Real-time via Supabase Realtime subscriptions

### Service Agreements
- Create/manage maintenance contracts
- Auto-link to recurring jobs
- Expiration alerts
- Revenue tracking for recurring revenue

### Standalone Estimates
- Create estimates before a job exists
- Email/SMS to customer with approval link
- Customer approves -> auto-create job
- Estimate numbering sequence

---

## Layer 5: Automation & AI

### Auto-Dispatch Logic
When a new job is created (from call, booking, or manual):
1. Extract required skills from service_type
2. Find available technicians with matching skills
3. Score by: proximity to job location, current workload, customer preference
4. Suggest top 3 or auto-assign if confidence > threshold

### Smart Sequences (n8n Workflows)
Extend existing 8 workflows with:
- **Post-Completion Sequence**: Complete job -> send invoice -> 2hr later thank you SMS -> 24hr later review request -> 7 days later follow-up
- **Lead Nurture**: New lead -> immediate response -> 3 day follow-up -> 7 day check-in -> 30 day re-engage
- **Maintenance Reminder**: Service agreement -> 30 days before due -> 7 days before -> day of reminder
- **Win-Back**: No activity 90 days -> special offer email -> 7 day follow-up SMS

### Auto-Invoicing
On job status change to 'completed':
1. Generate invoice from line items
2. Create PDF
3. Send via email and/or SMS
4. Create Stripe payment link
5. Log in notifications

### Revenue Intelligence (Analytics Enhancement)
- Revenue by technician, service type, time period
- Customer lifetime value calculation
- Job profitability (revenue - parts cost - labor cost)
- Forecasting based on pipeline + recurring jobs
- Seasonal trend detection

---

## Layer 6: Testing

### Setup
- Vitest + @testing-library/react for web
- Test utilities for Supabase mocking

### Coverage Targets
- All validation functions in @murray-fsm/shared
- All service functions in @murray-fsm/services
- API route handlers (happy path + error cases)
- Scheduling conflict detection
- RRULE parsing and job generation
- Revenue calculations

---

## Implementation Order

1. **Schema migrations** — Run all new table creation against live Supabase
2. **Add columns to existing tables** — jobs, line_items alterations
3. **RLS policies** — All new tables
4. **Shared services** — Build in dependency order
5. **Wire mock pages** — Inventory, Marketing, Team, Reviews
6. **New features** — Recurring jobs, dispatch, notifications, estimates, agreements
7. **Automation** — Auto-dispatch, smart sequences, auto-invoicing
8. **Analytics enhancement** — Revenue intelligence
9. **Customer portal** — Booking, estimate approval, payments
10. **Tests** — Unit tests for services and validation
11. **Mobile sync** — Add new tables to Legend-State sync
