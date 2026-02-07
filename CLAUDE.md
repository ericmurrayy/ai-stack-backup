# Murray's Garage Door Services - FSM System

## Business Context
Field Service Management (FSM) system for Murray's Garage Door Services, a garage door repair and installation business based in Chelmsford, MA serving 100+ towns across Middlesex and Worcester counties.

Owner: Eric Murray
Phone: 978-758-0690
Email: eric@murraysgaragedoorservices.com

## Tech Stack
- **Frontend**: Next.js 14 + React 18 + TypeScript + Tailwind CSS
- **Backend**: Next.js API routes + Cloudflare Workers
- **Database**: Supabase (PostgreSQL)
  - Project URL: https://pglzuykkdazzvxrdargj.supabase.co
  - Dashboard: https://supabase.com/dashboard/project/pglzuykkdazzvxrdargj
- **Desktop**: Tauri (Windows native app from same codebase)
- **Mobile**: Expo React Native (planned)
- **Hosting**: Kinsta (Astro marketing site), Cloudflare (Workers)
- **Phone System**: OpenPhone (Beside) - webhook integrations
- **Payments**: Stripe
- **Automation**: n8n workflows
- **AI**: Claude API (transcript analysis, spam detection), Ollama (local models)
- **Package Manager**: pnpm (monorepo)

## Project Structure
```
murray-fsm/                  # THIS IS THE MAIN PROJECT
├── apps/
│   ├── web/                 # Next.js 14 web dashboard
│   │   ├── src/app/         # App Router pages (34 pages)
│   │   ├── src/components/  # React components
│   │   ├── src/lib/         # Utilities, Supabase client
│   │   └── src-tauri/       # Tauri desktop app config
│   └── mobile/              # Expo React Native app
├── packages/
│   └── services/            # Shared business logic (25 modules)
├── supabase/
│   ├── schema.sql           # Database schema
│   ├── rls.sql              # Row Level Security policies
│   ├── migrations/          # Database migrations
│   └── functions/           # Edge Functions (payments, health)
├── docs/
│   ├── n8n/                 # 8 workflow JSON exports
│   ├── SECURITY_AUDIT.md    # Security vulnerabilities to fix
│   ├── API.md               # API documentation
│   └── *.md                 # Setup guides (Stripe, Quo, Calendar)
├── backup-system/           # Backup scripts and config
├── scripts/                 # Setup, diagnostics, smoke tests
└── tools/                   # Utility scripts
```

## Key Features
- **Call-to-Job Automation**: Phone calls → transcript analysis → job creation
- **Offline-First**: Works without internet, syncs when connected
- **AI-Powered**: Claude transcript analysis for spam detection, service categorization
- **Approval-Gated**: No action executes without explicit approval
- **Stripe Payments**: Mobile and web payment collection
- **n8n Automations**: Confirmations, reminders, review requests

## Database Schema (Key Tables)
- `jobs` - Service jobs with status tracking
- `customers` - Customer records
- `locations` - Service locations
- `line_items` - Estimates and invoices
- `payments` - Payment records
- `call_logs` - Phone call records with transcripts
- `message_logs` - SMS/MMS messages
- `action_queue` - Pending/executed automations
- `service_areas` - Town/region coverage

## Development Commands
```bash
pnpm install        # Install dependencies
pnpm dev:web        # Start web app (localhost:3000)
pnpm build:web      # Production build
pnpm typecheck      # Type check
pnpm lint           # Lint
```

## API Endpoints (77 routes)
- `/api/v1/jobs` - Job CRUD
- `/api/v1/customers` - Customer management
- `/api/webhooks/[id]` - Webhook handlers
- `/api/v1/sync` - Offline sync endpoint
- `/api/ai/*` - AI assistant endpoints
- `/api/cron` - Scheduled tasks

## Coding Conventions
- TypeScript strict mode, no `any`
- Zod for validation
- Server components by default, client components when needed
- Use Supabase client from `@supabase/supabase-js`
- 2-space indentation, single quotes, no semicolons
- Async/await over .then()

## Environment Variables (Required)
- `SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `OPENPHONE_API_KEY` (phone integration)
- `ANTHROPIC_API_KEY` (AI features)
- `STRIPE_SECRET_KEY` / `STRIPE_PUBLISHABLE_KEY`

## Related Projects (separate repos)
- Marketing site (Astro): D:\murrays-astro-site-kinsta
- Call-to-job worker (Cloudflare): D:\murrays-call-to-job

## Known Issues
- See `docs/SECURITY_AUDIT.md` for critical security vulnerabilities to fix
- Timezone hardcoded to America/Chicago, should be America/New_York
- Some API routes lack authentication (see security audit)
