# Murray's FSM - Field Service Management

Offline-first Field Service Management system for solo garage door operators.

## Features

- **Offline-First Mobile App**: Works without signal, syncs when online
- **Call & Text Integration**: Captures all Quo/OpenPhone communications
- **AI-Powered Automation**: Extracts intents from calls/texts, suggests actions
- **Approval-Gated Actions**: Nothing impacts schedule or sends estimates without approval
- **Multi-Calendar Sync**: Google, Outlook, and iCloud support
- **Stripe Payments**: Mobile PaymentSheet integration
- **Real-time Dashboard**: Web interface for management

## Architecture

```
┌─────────────────┐     ┌─────────────────┐
│  Mobile App     │     │  Web Dashboard  │
│  (Expo + LS)    │     │  (Next.js)      │
└────────┬────────┘     └────────┬────────┘
         │                       │
         └───────────┬───────────┘
                     │
              ┌──────▼──────┐
              │  Supabase   │
              │  (Postgres) │
              └──────┬──────┘
                     │
         ┌───────────┴───────────┐
         │                       │
    ┌────▼────┐           ┌──────▼──────┐
    │   n8n   │           │   Stripe    │
    │ (Flows) │           │  (Payments) │
    └────┬────┘           └─────────────┘
         │
    ┌────▼────┐
    │   Quo   │
    │(Comms)  │
    └─────────┘
```

## Quick Start

### One-Command Setup (Recommended)

```bash
# Clone the repository
git clone https://github.com/your-org/murray-fsm.git
cd murray-fsm

# Development setup (installs deps, creates .env files, starts local Supabase)
./scripts/fsm-setup.sh --dev

# Run system diagnostics
./scripts/fsm-doctor.sh --verbose

# Run smoke tests
./scripts/fsm-smoke.sh
```

See [LAUNCH.md](LAUNCH.md) for the complete launch readiness checklist.

### Manual Setup

#### Prerequisites

- Node.js 18+
- pnpm 8+
- Supabase account
- Quo/OpenPhone account
- Stripe account
- n8n instance (self-hosted or cloud)

#### 1. Clone & Install

```bash
git clone https://github.com/your-org/murray-fsm.git
cd murray-fsm
pnpm install
```

#### 2. Setup Supabase

1. Create a new Supabase project
2. Run the schema:

```bash
# Via Supabase CLI
supabase db push

# Or manually copy/paste supabase/schema.sql and supabase/rls.sql
```

3. Create storage buckets:
   - `job-photos` (private)
   - `job-signatures` (private)

4. Deploy Edge Functions:

```bash
supabase functions deploy create-payment-intent
supabase functions deploy healthcheck
```

5. Set Edge Function secrets:

```bash
supabase secrets set STRIPE_SECRET_KEY=sk_xxx
supabase secrets set STRIPE_PUBLISHABLE_KEY=pk_xxx
```

#### 3. Setup n8n

1. Import all workflows from `docs/n8n/`
2. Configure credentials (see `docs/n8n-workflows.md`)
3. Set environment variables:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_OWNER_ID=your-user-uuid
QUO_WEBHOOK_SIGNING_SECRET_BASE64=xxx
QUO_API_KEY=xxx
QUO_PHONE_NUMBER_ID=xxx
STRIPE_SECRET_KEY=sk_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
GOOGLE_CALENDAR_ID=primary
```

4. Activate all workflows

#### 4. Setup Quo/OpenPhone

See `docs/quo-setup.md` for detailed instructions.

1. Enable call recording & transcripts
2. Create webhook pointing to n8n
3. Copy signing secret

#### 5. Setup Stripe

See `docs/stripe-setup.md` for detailed instructions.

1. Get API keys
2. Create webhook pointing to n8n
3. Copy webhook secret

#### 6. Setup Calendar

See `docs/calendar-setup.md` for detailed instructions.

#### 7. Configure Mobile App

```bash
cd apps/mobile
cp .env.example .env
# Edit .env with your values
```

```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_xxx
```

Run the app:

```bash
pnpm dev:mobile
```

#### 8. Configure Web Dashboard

```bash
cd apps/web
cp .env.example .env
# Edit .env with your values
```

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
N8N_APPROVAL_EXECUTOR_WEBHOOK_URL=https://your-n8n.com/webhook/approval-executor
```

Run the dashboard:

```bash
pnpm dev:web
```

## Acceptance Tests

### Test 1: Call → Transcript → Action Suggestion

1. Make an outbound call from Quo number
2. Record a conversation about scheduling
3. Wait for transcript webhook
4. Verify:
   - `call_logs` has transcript
   - `action_queue` has suggested action

### Test 2: Text → Action Suggestion

1. Send inbound text: "Can you come tomorrow at 2pm to fix a broken spring at 123 Main St?"
2. Verify:
   - `message_logs` has the message
   - `action_queue` suggests `schedule_job` and `create_job`

### Test 3: Approval Gating

1. With pending action in queue
2. Verify NO calendar event exists
3. Click "Approve" in web dashboard
4. Verify:
   - Calendar event is created
   - Confirmation SMS is sent
   - Action status is `executed`

### Test 4: Offline Field Flow

1. Put phone in airplane mode
2. Start job, add line items, photos, signature
3. Mark job complete
4. Force close app
5. Reopen app (still offline)
6. Verify data persists
7. Enable network
8. Verify data syncs to Supabase

### Test 5: Stripe Payment

1. Create job with invoice line items
2. On mobile, tap "Collect Payment"
3. Enter test card: `4242424242424242`
4. Complete payment
5. Verify:
   - `payments` table updated
   - `jobs.paid_cents` updated

## Project Structure

```
murray-fsm/
├── README.md
├── package.json
├── pnpm-workspace.yaml
├── apps/
│   ├── mobile/          # Expo + Legend-State app
│   │   ├── app/         # Expo Router screens
│   │   └── src/
│   │       ├── components/
│   │       ├── hooks/
│   │       ├── store/   # Legend-State store
│   │       ├── types/
│   │       └── utils/
│   └── web/             # Next.js dashboard
│       └── src/
│           ├── app/     # App Router pages
│           ├── components/
│           └── lib/
├── supabase/
│   ├── schema.sql       # Database schema
│   ├── rls.sql          # RLS policies
│   ├── seed.sql         # Sample data
│   └── functions/       # Edge Functions
└── docs/
    ├── n8n/             # Workflow JSON exports
    ├── n8n-workflows.md
    ├── quo-setup.md
    ├── calendar-setup.md
    └── stripe-setup.md
```

## Data Model

See `supabase/schema.sql` for complete schema.

### Core Tables
- `profiles` - User profiles
- `customers` - Customer records
- `locations` - Service locations
- `jobs` - Work orders
- `line_items` - Estimates & invoices
- `payments` - Payment records

### Communication Tables
- `comm_threads` - Conversation threads
- `call_logs` - Call records with transcripts
- `message_logs` - SMS/MMS messages

### Automation Tables
- `action_queue` - Pending/executed actions
- `automation_events` - Idempotency tracking
- `calendar_events` - External calendar links

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT

## Support

For issues and feature requests, please use GitHub Issues.
