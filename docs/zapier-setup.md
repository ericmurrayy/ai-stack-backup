# Zapier Integration - Murray's FSM

This guide covers setting up Zapier to connect Beside (OpenPhone) with Murray's FSM.

## Overview

The integration supports two data flows:

1. **Beside → Zapier → FSM**: Phone calls and messages from Beside trigger actions in your FSM
2. **FSM → Zapier**: Jobs, customers, and other events trigger automations in Zapier

## Prerequisites

- Zapier account (Free tier works for basic setup)
- Beside/OpenPhone account
- Murray's FSM deployed and accessible via public URL

---

## Part 1: Beside → Zapier → FSM (Incoming Calls)

This flow captures calls from Beside and sends them to your FSM.

### Step 1: Create Zapier Zap for Beside

1. Log in to [Zapier](https://zapier.com)
2. Click **Create Zap**
3. For the **Trigger**:
   - Search for "OpenPhone" or "Beside"
   - Select **New Call** as the trigger event
   - Connect your OpenPhone/Beside account
   - Test the trigger

### Step 2: Add Webhook Action

1. Click **+** to add an action
2. Search for **Webhooks by Zapier**
3. Select **POST** as the action event
4. Configure the webhook:

   **URL:**
   ```
   https://your-fsm-domain.com/api/webhooks/zapier
   ```

   **Payload Type:** `json`

   **Data:**
   ```json
   {
     "event": "beside.call.completed",
     "timestamp": "{{zap_meta_human_now}}",
     "source": "zapier",
     "data": {
       "call_id": "{{id}}",
       "direction": "{{direction}}",
       "from_number": "{{from}}",
       "to_number": "{{to}}",
       "duration_seconds": "{{duration}}",
       "started_at": "{{createdAt}}",
       "ended_at": "{{completedAt}}",
       "answered_at": "{{answeredAt}}"
     }
   }
   ```

5. **Headers** (optional but recommended):
   ```
   x-zapier-signature: your-secret-key
   Content-Type: application/json
   ```

### Step 3: Add Transcript Flow (Optional)

Create a second Zap for transcripts:

1. **Trigger:** OpenPhone → New Transcript
2. **Action:** Webhooks by Zapier → POST

   **Data:**
   ```json
   {
     "event": "beside.call.transcript",
     "timestamp": "{{zap_meta_human_now}}",
     "source": "zapier",
     "data": {
       "call_id": "{{callId}}",
       "from_number": "{{from}}",
       "transcript": "{{transcript}}",
       "summary": "{{summary}}",
       "action_items": "{{actionItems}}"
     }
   }
   ```

### Step 4: Add SMS Flow (Optional)

For incoming text messages:

1. **Trigger:** OpenPhone → New Message Received
2. **Action:** Webhooks by Zapier → POST

   **Data:**
   ```json
   {
     "event": "beside.message.received",
     "timestamp": "{{zap_meta_human_now}}",
     "source": "zapier",
     "data": {
       "message_id": "{{id}}",
       "from_number": "{{from}}",
       "to_number": "{{to}}",
       "message_body": "{{body}}",
       "media_urls": "{{media}}"
     }
   }
   ```

---

## Part 2: FSM → Zapier (Outgoing Events)

This flow sends FSM events (new jobs, customers, etc.) to Zapier.

### Step 1: Create Zapier Catch Hook

1. Create a new Zap
2. For the **Trigger**:
   - Search for **Webhooks by Zapier**
   - Select **Catch Hook**
   - Copy the webhook URL (looks like `https://hooks.zapier.com/hooks/catch/123456/abcdef/`)

### Step 2: Configure FSM Webhook

1. In Murray's FSM, go to **Settings** → **Integrations** → **Webhooks**
2. Click **Add Webhook**
3. Configure:
   - **URL:** Paste your Zapier Catch Hook URL
   - **Events:** Select the events you want to send:
     - `job.created`
     - `job.completed`
     - `customer.created`
     - `estimate.approved`
     - etc.
   - **Description:** "Zapier Integration"
4. Save and copy the **Webhook Secret** (shown once)

### Step 3: Test the Webhook

1. Click **Send Test** on the webhook
2. Go back to Zapier and click **Test Trigger**
3. You should see the test payload

### Step 4: Add Zapier Actions

Now you can add actions in Zapier based on FSM events:

**Example: Send SMS when job is created**
1. Add action: OpenPhone → Send Message
2. Map fields from the webhook payload

**Example: Create Google Calendar event for appointments**
1. Add action: Google Calendar → Create Detailed Event
2. Map job date, customer name, address

**Example: Send Slack notification**
1. Add action: Slack → Send Channel Message
2. Format message with job details

---

## Webhook Payload Reference

### FSM → Zapier Payloads

**job.created:**
```json
{
  "id": "delivery-id",
  "event": "job.created",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "id": "job-uuid",
    "customer_id": "customer-uuid",
    "title": "Garage Door Spring Replacement",
    "description": "Left spring broken",
    "status": "pending",
    "scheduled_date": "2024-01-16",
    "address": "123 Main St, Chelmsford, MA",
    "customer": {
      "name": "John Smith",
      "phone": "+15551234567",
      "email": "john@example.com"
    }
  }
}
```

**customer.created:**
```json
{
  "id": "delivery-id",
  "event": "customer.created",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "id": "customer-uuid",
    "name": "John Smith",
    "phone": "+15551234567",
    "email": "john@example.com",
    "address": "123 Main St",
    "city": "Chelmsford",
    "state": "MA",
    "zip": "01824"
  }
}
```

### Zapier → FSM Payloads

**beside.call.completed:**
```json
{
  "event": "beside.call.completed",
  "timestamp": "2024-01-15T10:30:00Z",
  "source": "zapier",
  "data": {
    "call_id": "CA123456",
    "direction": "incoming",
    "from_number": "+15551234567",
    "to_number": "+19787580690",
    "duration_seconds": 180,
    "started_at": "2024-01-15T10:27:00Z",
    "ended_at": "2024-01-15T10:30:00Z"
  }
}
```

---

## Security Configuration

### Setting Up Webhook Secrets

1. Generate a random secret:
   ```bash
   openssl rand -hex 32
   ```

2. Add to your `.env.local`:
   ```
   ZAPIER_WEBHOOK_SECRET=your-generated-secret
   ```

3. In Zapier, add header to your webhook actions:
   ```
   x-zapier-signature: your-generated-secret
   ```

### Verifying Signatures

The FSM webhook endpoint verifies signatures using HMAC-SHA256:

```
Signature = HMAC-SHA256(request_body, secret)
```

---

## Troubleshooting

### Webhooks not arriving in FSM

1. Check Zapier Task History for errors
2. Verify FSM URL is publicly accessible
3. Check FSM logs: `pnpm dev:web` and watch console

### Webhooks not triggering in Zapier

1. Verify webhook endpoint URL is correct
2. Check that events are enabled on the FSM webhook
3. Use FSM's "Send Test" to verify connection

### Signature verification failing

1. Ensure secret matches in both `.env.local` and Zapier headers
2. Check that Zapier is sending the header correctly
3. Verify no whitespace in the secret

### Duplicate events

The FSM webhook endpoint handles duplicates via `upsert` with `external_id`. If you see duplicates:
1. Check if the call_id/message_id is being sent correctly
2. Verify database constraints are in place

---

## Example Zaps

### 1. New Call → Create Job Draft

**Trigger:** OpenPhone - New Call (completed, incoming)
**Action 1:** Webhooks - POST to FSM
**Action 2:** Filter - Only if duration > 30 seconds
**Action 3:** Delay - Wait 5 minutes (for transcript)
**Action 4:** FSM API - Create draft job

### 2. Job Completed → Send Review Request

**Trigger:** FSM Webhook - job.completed
**Action 1:** Delay - Wait 1 hour
**Action 2:** OpenPhone - Send SMS with review link

### 3. Estimate Approved → Schedule in Google Calendar

**Trigger:** FSM Webhook - estimate.approved
**Action 1:** Google Calendar - Create Event
**Action 2:** Slack - Notify #jobs channel

---

## Environment Variables

Add these to your `.env.local`:

```bash
# Zapier Integration
ZAPIER_WEBHOOK_SECRET=your-secret-for-incoming-webhooks
ZAPIER_OUTGOING_WEBHOOK_URL=https://hooks.zapier.com/hooks/catch/123456/abcdef/
```

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/webhooks/zapier` | POST | Receive events from Zapier |
| `/api/webhooks/zapier` | GET | Health check / verify setup |
| `/api/webhooks` | POST | Register new outgoing webhook |
| `/api/webhooks` | GET | List all webhooks |

---

## Next Steps

1. Set up your first Zap: Beside calls → FSM
2. Configure outgoing webhook for job notifications
3. Add filters to prevent spam/test calls from creating jobs
4. Consider adding error notifications via Slack/email
