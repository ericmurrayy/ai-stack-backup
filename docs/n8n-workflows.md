# n8n Workflows - Murray's FSM

This document describes all n8n workflows used in Murray's FSM system.

## Overview

The system uses 8 workflows:

| # | Workflow | Trigger | Purpose |
|---|----------|---------|---------|
| 01 | Quo Webhook Ingest | Webhook | Process calls & texts from Quo/OpenPhone |
| 02 | Approval Executor | Webhook | Execute approved actions |
| 03 | Job Confirmation SMS | Webhook | Send booking confirmations |
| 04 | Day Before Reminder | Cron (Daily 9 AM) | Send appointment reminders |
| 05 | En Route SMS | Webhook | Notify customer technician is coming |
| 06 | Review Request | Webhook | Request reviews after job completion |
| 07 | Stripe Webhook | Webhook | Process payment events |
| 08 | Calendar Sync | Webhook | Sync jobs to external calendars |

## Import Instructions

1. Open n8n Dashboard
2. Go to **Workflows** > **Import from File**
3. Select each JSON file from `docs/n8n/`
4. Configure credentials (see below)
5. Activate workflows

## Required Credentials

### Supabase
- **Type:** Supabase API
- **Host:** Your Supabase project URL
- **Service Role Key:** From Supabase Dashboard > Settings > API

### Quo/OpenPhone API
- **Type:** HTTP Header Auth
- **Header Name:** `Authorization`
- **Header Value:** `Bearer YOUR_QUO_API_KEY`

### Anthropic (for intent extraction)
- **Type:** Anthropic API
- **API Key:** From console.anthropic.com

### Stripe
- **Type:** Stripe API (optional, for direct API calls)
- **Secret Key:** From Stripe Dashboard

### Google Calendar
- **Type:** Google Calendar OAuth2
- Follow n8n's OAuth setup guide

## Environment Variables

Set these in n8n Settings > Environment Variables:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_OWNER_ID=your-user-uuid

QUO_WEBHOOK_SIGNING_SECRET_BASE64=your-base64-secret
QUO_API_KEY=your-quo-api-key
QUO_PHONE_NUMBER_ID=your-phone-number-id

STRIPE_SECRET_KEY=sk_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

GOOGLE_CALENDAR_ID=primary

REVIEW_URL=https://g.page/r/YOUR_GOOGLE_REVIEW_LINK
```

## Workflow Details

### 01 - Quo Webhook Ingest

**Endpoint:** `POST /webhook/quo-webhook`

Processes all incoming Quo/OpenPhone webhook events:
- `message.received` - Inbound SMS/MMS
- `message.delivered` - Outbound message status
- `call.completed` - Call ended
- `call.transcript.completed` - Transcript ready
- `call.summary.completed` - AI summary ready

**Flow:**
1. Verify HMAC signature
2. Check idempotency (using event ID)
3. Route by event type
4. Process message/call data
5. Run LLM intent extraction
6. Create action_queue items

### 02 - Approval Executor

**Endpoint:** `POST /webhook/approval-executor`

Called by the web dashboard when a user approves an action.

**Input:**
```json
{
  "action_queue_id": "uuid"
}
```

**Supported Actions:**
- `create_job` - Create customer, location, and job
- `schedule_job` - Update job schedule + create calendar event
- `send_estimate` - Generate and send estimate
- `send_sms` - Send SMS via Quo

### 03 - Job Confirmation SMS

**Endpoint:** `POST /webhook/job-confirmation`

Sends booking confirmation after job is scheduled.

**Input:**
```json
{
  "job_id": "uuid"
}
```

### 04 - Day Before Reminder

**Trigger:** Daily at 9:00 AM

Automatically finds jobs scheduled for tomorrow and sends reminder SMS.

### 05 - En Route SMS

**Endpoint:** `POST /webhook/enroute-notification`

Triggered when technician is en route to job site.

**Input:**
```json
{
  "job_id": "uuid",
  "eta_minutes": 15
}
```

### 06 - Review Request

**Endpoint:** `POST /webhook/review-request`

Sends review request after job completion.

**Input:**
```json
{
  "job_id": "uuid"
}
```

### 07 - Stripe Webhook

**Endpoint:** `POST /webhook/stripe-webhook`

Processes Stripe webhook events:
- `payment_intent.succeeded` - Update payment status

### 08 - Calendar Sync

**Endpoint:** `POST /webhook/calendar-sync`

Creates or updates calendar events when job schedule changes.

**Input:**
```json
{
  "job_id": "uuid"
}
```

## Security Notes

1. **HMAC Verification:** All Quo webhooks verify the `openphone-signature` header
2. **Stripe Verification:** All Stripe webhooks verify the `stripe-signature` header
3. **Idempotency:** Events are deduplicated using `automation_events` table
4. **Service Role:** n8n uses Supabase service role key to bypass RLS

## Troubleshooting

### Webhook not receiving events
- Check n8n is running and accessible
- Verify webhook URLs in Quo/Stripe dashboards
- Check n8n execution logs

### Signature verification failing
- Verify signing secrets are base64 encoded correctly
- Check timestamp tolerance (30 min for Quo, 5 min for Stripe)
- Ensure raw body is preserved for signature computation

### Actions not executing
- Check action_queue status in Supabase
- Verify SUPABASE_OWNER_ID is set correctly
- Review n8n execution logs for errors
