# Murray's FSM - Launch Readiness Checklist

This document tracks all requirements for a production launch.

## Quick Launch Commands

```bash
# Development setup
./scripts/fsm-setup.sh --dev

# Production validation
./scripts/fsm-setup.sh --prod

# System diagnostics
./scripts/fsm-doctor.sh --mode prod --verbose

# Smoke tests
./scripts/fsm-smoke.sh
```

---

## 1. Required Accounts

| Service | Purpose | Status |
|---------|---------|--------|
| Supabase | Database, Auth, Storage, Edge Functions | [ ] |
| Stripe | Payment processing | [ ] |
| Quo/OpenPhone | Business phone/SMS/calls | [ ] |
| n8n | Workflow automation | [ ] |
| Google Cloud | Calendar API (optional) | [ ] |
| Apple Developer | iOS app distribution | [ ] |
| Google Play | Android app distribution | [ ] |
| Vercel/Hosting | Web dashboard hosting | [ ] |

---

## 2. Supabase Setup

### Project Configuration
- [ ] Supabase project created
- [ ] Project URL obtained: `https://[project-ref].supabase.co`
- [ ] Anon key obtained
- [ ] Service role key obtained (keep secret!)

### Database
- [ ] Schema applied (`supabase db push` or manual SQL)
- [ ] RLS policies applied (`supabase/rls.sql`)
- [ ] Seed data loaded (if needed for testing)

### Storage Buckets
- [ ] `job-photos` bucket created (private)
- [ ] `job-signatures` bucket created (private)
- [ ] Storage policies applied

### Edge Functions
- [ ] `create-payment-intent` deployed
- [ ] `healthcheck` deployed
- [ ] Edge function secrets set:
  - [ ] `STRIPE_SECRET_KEY`
  - [ ] `STRIPE_PUBLISHABLE_KEY`

### Auth Configuration
- [ ] Email auth enabled
- [ ] Site URL configured for password reset
- [ ] Redirect URLs whitelisted

---

## 3. n8n Automation Setup

### Instance
- [ ] n8n instance running (self-hosted or cloud)
- [ ] Instance URL: `https://your-n8n.com`

### Credentials
Create these credentials in n8n:
- [ ] Supabase credential (URL + service role key)
- [ ] Quo API credential
- [ ] Stripe API credential
- [ ] Google Calendar OAuth (if using)

### Environment Variables
Set in n8n:
```
SUPABASE_URL=https://[project-ref].supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_OWNER_ID=your-user-uuid
QUO_WEBHOOK_SIGNING_SECRET_BASE64=xxx
QUO_API_KEY=xxx
QUO_PHONE_NUMBER_ID=xxx
STRIPE_SECRET_KEY=sk_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
GOOGLE_CALENDAR_ID=primary
```

### Workflows
Import and activate all workflows from `docs/n8n/`:
- [ ] `01-quo-webhook-ingest.json` - Processes Quo webhooks
- [ ] `02-approval-executor.json` - Executes approved actions
- [ ] `03-job-confirmation-sms.json` - Sends confirmation texts
- [ ] `04-day-before-reminder.json` - Sends reminder texts
- [ ] `05-enroute-sms.json` - Sends "on my way" texts
- [ ] `06-review-request.json` - Requests reviews after jobs
- [ ] `07-stripe-webhook.json` - Processes payments
- [ ] `08-calendar-sync.json` - Syncs with external calendar

---

## 4. Quo/OpenPhone Setup

- [ ] Business phone number acquired
- [ ] Call recording enabled
- [ ] Transcription enabled
- [ ] Webhook configured pointing to n8n
- [ ] Webhook URL: `https://your-n8n.com/webhook/quo-ingest`
- [ ] Signing secret copied and set in n8n

See `docs/quo-setup.md` for detailed instructions.

---

## 5. Stripe Setup

### Account
- [ ] Stripe account created and verified
- [ ] Business information completed

### API Keys
- [ ] Publishable key obtained: `pk_live_xxx`
- [ ] Secret key obtained: `sk_live_xxx`

### Webhook
- [ ] Webhook endpoint created
- [ ] Endpoint URL: `https://your-n8n.com/webhook/stripe`
- [ ] Events subscribed:
  - [ ] `payment_intent.succeeded`
  - [ ] `payment_intent.payment_failed`
- [ ] Webhook secret obtained: `whsec_xxx`

See `docs/stripe-setup.md` for detailed instructions.

---

## 6. Calendar Integration (Optional)

### Google Calendar
- [ ] Google Cloud project created
- [ ] Calendar API enabled
- [ ] OAuth consent screen configured
- [ ] OAuth credentials created
- [ ] Credentials imported to n8n

See `docs/calendar-setup.md` for detailed instructions.

---

## 7. Mobile App Configuration

### Environment
Create `apps/mobile/.env`:
```
EXPO_PUBLIC_SUPABASE_URL=https://[project-ref].supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxx
```

### Build & Submit
- [ ] Expo account connected
- [ ] EAS Build configured
- [ ] iOS certificates/provisioning
- [ ] Android keystore
- [ ] App icons and splash screen
- [ ] App submitted to App Store
- [ ] App submitted to Google Play

---

## 8. Web Dashboard Configuration

### Environment
Create `apps/web/.env`:
```
NEXT_PUBLIC_SUPABASE_URL=https://[project-ref].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_SITE_URL=https://dashboard.yourdomain.com
N8N_APPROVAL_EXECUTOR_WEBHOOK_URL=https://your-n8n.com/webhook/approval-executor
```

### Deployment
- [ ] Hosting platform selected (Vercel recommended)
- [ ] Environment variables configured
- [ ] Custom domain configured
- [ ] SSL certificate active

---

## 9. DNS Configuration

| Record | Type | Value | Purpose |
|--------|------|-------|---------|
| dashboard.yourdomain.com | CNAME | vercel.app | Web dashboard |
| n8n.yourdomain.com | A/CNAME | [your-n8n-ip] | n8n webhooks |

---

## 10. Security Checklist

### Secrets Management
- [ ] All secrets stored securely (not in git)
- [ ] Service role key restricted to server-side only
- [ ] API keys rotated from development

### Supabase
- [ ] RLS enabled on all tables
- [ ] No `anon` access to sensitive data
- [ ] Service role key not exposed to clients

### Webhooks
- [ ] Quo webhook signature validation enabled
- [ ] Stripe webhook signature validation enabled
- [ ] n8n webhooks protected (auth or IP whitelist)

---

## 11. Monitoring & Alerting

- [ ] Supabase dashboard monitoring enabled
- [ ] n8n execution logging enabled
- [ ] Error alerting configured (email/Slack)
- [ ] Stripe webhook failure notifications

---

## 12. Backup & Recovery

- [ ] Database backup schedule configured
- [ ] Backup restoration tested
- [ ] Murray's FSM backup system configured (optional)

```bash
# Run backup system doctor
./backup-system/scripts/doctor.sh

# Configure backups
./backup-system/scripts/setup.sh --init
```

---

## 13. Acceptance Tests

Before launch, verify all critical flows:

### Test 1: Inbound Call → Action Suggestion
1. [ ] Call comes in via Quo
2. [ ] Transcript appears in `call_logs`
3. [ ] Suggested action appears in `action_queue`
4. [ ] NO automatic execution (approval gate holds)

### Test 2: Approval → Execution
1. [ ] Pending action visible in web dashboard
2. [ ] Approve the action
3. [ ] Calendar event created (if schedule action)
4. [ ] Confirmation SMS sent
5. [ ] Action status updated to `executed`

### Test 3: Offline Field Work
1. [ ] Put phone in airplane mode
2. [ ] Create/edit job data
3. [ ] Add photos, signature
4. [ ] Complete job
5. [ ] Force close app
6. [ ] Reopen (still offline) - data persists
7. [ ] Reconnect - data syncs to Supabase

### Test 4: Payment Collection
1. [ ] On mobile, tap "Collect Payment"
2. [ ] Enter test card `4242424242424242`
3. [ ] Payment completes
4. [ ] Payment record in `payments` table
5. [ ] Job marked as paid

---

## 14. Launch Day Checklist

### Pre-Launch (1 day before)
- [ ] All acceptance tests passing
- [ ] `./scripts/fsm-doctor.sh --mode prod` passes
- [ ] `./scripts/fsm-smoke.sh` passes
- [ ] Database backup taken
- [ ] Rollback plan documented

### Launch
- [ ] Switch Stripe to live mode
- [ ] Enable n8n production workflows
- [ ] Mobile apps approved and live
- [ ] Web dashboard deployed
- [ ] DNS propagated

### Post-Launch (1 hour after)
- [ ] Verify Quo webhooks receiving
- [ ] Verify Stripe webhooks receiving
- [ ] Test one real call → action flow
- [ ] Monitor error logs

---

## Definition of Done

Murray's FSM is considered **launch-ready** when:

1. **One-Command Setup**: `./scripts/fsm-setup.sh --prod` validates all config
2. **Health Check**: `./scripts/fsm-doctor.sh --mode prod` passes with no failures
3. **Smoke Tests**: `./scripts/fsm-smoke.sh` passes all tests
4. **Acceptance Tests**: All 4 acceptance tests pass on production
5. **Approval Gate**: Verified that NO action executes without approval
6. **Offline-First**: Data persists and syncs correctly
7. **Documentation**: All setup docs are accurate and complete

---

## Support & Troubleshooting

### Common Issues

**Webhooks not receiving:**
- Check n8n workflow is active
- Verify webhook URL is correct
- Check n8n execution logs

**Offline data not syncing:**
- Check Supabase connection in mobile .env
- Verify anon key is correct
- Check RLS policies allow the user

**Payments failing:**
- Verify Stripe keys match environment (test vs live)
- Check edge function logs in Supabase
- Verify Stripe webhook secret

### Getting Help
- GitHub Issues: [repo-url]/issues
- Documentation: See `docs/` folder
