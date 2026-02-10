# Murray's FSM - Claude Code Project Intelligence

## Project Identity
Murray's FSM is an **offline-first Field Service Management system** for solo garage door operators, built as a pnpm monorepo. The owner (Eric Murray) is building this to run his garage door business AND to generate revenue as a SaaS product for other field service operators.

## Business Goals (Priority Order)
1. **Launch Murray's own garage door business** on this platform ASAP
2. **Productize into a multi-tenant SaaS** for other solo operators / small teams
3. **Monetize AI automation workflows** (n8n templates, MCP integrations, plugin marketplace)
4. **Build recurring revenue** through subscriptions, not just per-job payments

## Architecture Quick Reference
```
murray-fsm/
  apps/mobile/    → Expo 51 + React Native + Legend-State (offline store)
  apps/web/       → Next.js 14 + Tailwind + SWR (dashboard + customer portal + booking widget)
  packages/services/ → Shared business logic (email, PDF, plugins, routing, scheduling, webhooks, API keys)
  packages/shared/   → Types, constants, validation, formatting
  supabase/       → PostgreSQL schema, RLS, Edge Functions (Deno)
  backup-system/  → FSM-based backup/restore with AI agent interface
  docs/n8n/       → 8 production workflow JSONs
  scripts/        → fsm-setup.sh, fsm-doctor.sh, fsm-smoke.sh
```

## Tech Stack
- **Mobile**: Expo 51, React Native 0.74, Legend-State v2.1 (offline-first), Stripe RN
- **Web**: Next.js 14.2, React 18.3, Tailwind 3.4, SWR 2.2
- **Database**: Supabase (PostgreSQL + RLS + Edge Functions + Realtime + Storage)
- **Automation**: n8n (8 workflows: Quo ingest, approval executor, SMS/reminders, Stripe webhooks, calendar sync)
- **Payments**: Stripe (PaymentIntent via Edge Functions, mobile PaymentSheet)
- **Communications**: Quo/OpenPhone (calls, SMS, transcription, webhooks)
- **Package Manager**: pnpm 8.15 (workspaces)
- **Node**: >=18.0.0

## Key Design Principles
1. **Approval-gated automation**: NOTHING impacts schedule or sends estimates without human approval. The `action_queue` table is the gate.
2. **Offline-first**: Mobile app works in airplane mode. Legend-State persists locally, syncs when online.
3. **AI extraction**: Call transcripts and SMS are parsed into structured `ai_extraction` JSONB fields with action items.
4. **Plugin architecture**: Supports payment, communication, calendar, accounting, CRM, marketing, storage, maps, AI, and custom plugin categories.

## Database Schema
### Core (schema.sql - 15 tables)
profiles, customers, locations, jobs, job_events, job_photos, job_signatures, line_items, payments, comm_threads, call_logs, message_logs, action_queue, automation_events, calendar_events

### Enterprise (schema-v2.sql - extensions)
team_members, technician_locations, time_entries, pipeline_stages, contracts, reviews, inventory, expenses, api_keys, webhook_endpoints

## Critical Paths
- **Inbound call flow**: Quo webhook → n8n workflow 01 → transcript + AI extraction → action_queue → dashboard approval → n8n workflow 02 → execution
- **Payment flow**: Mobile app → Supabase Edge Function (create-payment-intent) → Stripe PaymentSheet → Stripe webhook → n8n workflow 07 → payment record
- **Offline sync**: Legend-State local persistence → network reconnect → `/api/v1/sync` → Supabase upsert

## API Endpoints (apps/web/src/app/api/)
- `/api/v1/jobs` - Job CRUD
- `/api/v1/customers` - Customer management
- `/api/v1/sync` - Mobile sync
- `/api/v1/routes/optimize` - Route optimization
- `/api/api-keys` - API key management
- `/api/plugins` - Plugin install/config/test
- `/api/approvals/approve|reject` - Action approval gate
- `/api/pdf/estimate|invoice/[jobId]` - PDF generation
- `/api/webhooks` - Webhook management
- `/api/schedule/check` - Schedule availability

## Commands
```bash
pnpm dev:web          # Start Next.js dev server
pnpm dev:mobile       # Start Expo dev server
pnpm build:web        # Production build
pnpm lint             # Lint all packages
pnpm typecheck        # Type-check all packages
pnpm db:push          # Push schema to Supabase
pnpm db:reset         # Reset Supabase database
pnpm functions:serve  # Local Edge Functions
pnpm functions:deploy # Deploy Edge Functions
```

## n8n Workflows (docs/n8n/)
1. `01-quo-webhook-ingest` - Processes Quo call/SMS webhooks, extracts intents
2. `02-approval-executor` - Executes approved actions from dashboard
3. `03-job-confirmation-sms` - Sends confirmation texts
4. `04-day-before-reminder` - Day-before appointment reminders
5. `05-enroute-sms` - "On my way" notifications
6. `06-review-request` - Post-job review requests
7. `07-stripe-webhook` - Payment processing
8. `08-calendar-sync` - External calendar sync

## What's NOT Done Yet (Revenue Blockers)
- No subscription/billing system (no pricing tiers, no recurring billing)
- No multi-tenant isolation (single-owner RLS only)
- No CI/CD pipeline (GitHub Actions not configured)
- No environment files deployed (.env files are .example only)
- No app store submissions
- No production hosting configured
- Plugin marketplace not built (framework exists)
- Customer portal booking widget needs payment integration
- No onboarding flow for new SaaS customers

## Security Notes
- RLS on all tables (owner_id pattern)
- API keys with scopes and rate limiting
- Webhook signature validation (Quo, Stripe)
- Service role keys server-side only
- Backup encryption support (AES-256-CBC)

## Working With This Codebase
- Always run `pnpm install` from murray-fsm/ root after pulling
- Web app is the primary development surface (API routes, dashboard, portal)
- Mobile app requires Expo Go or EAS build
- Supabase local dev: `supabase start` (requires Docker)
- n8n workflows are JSON exports in docs/n8n/ - import via n8n UI
