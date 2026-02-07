# Quo/OpenPhone Setup - Murray's FSM

This guide covers setting up Quo (formerly OpenPhone) for Murray's FSM.

## Prerequisites

- Quo/OpenPhone account with eligible plan (for transcripts/summaries)
- A phone number assigned to your account
- Call recording enabled

## Step 1: Enable Call Recording

1. Log in to Quo Dashboard
2. Go to **Settings** > **Phone Numbers**
3. Select your phone number
4. Enable **Call Recording**
5. Enable **AI Transcripts** (requires eligible plan)
6. Enable **AI Summaries** (requires eligible plan)

## Step 2: Create Webhook

1. Go to **Settings** > **Webhooks**
2. Click **Create Webhook**
3. Configure:
   - **URL:** `https://your-n8n.com/webhook/quo-webhook`
   - **Events:** Select all of:
     - `message.received`
     - `message.delivered`
     - `call.completed`
     - `call.recording.completed`
     - `call.transcript.completed`
     - `call.summary.completed`
4. Click **Save**

## Step 3: Get Signing Secret

1. After creating the webhook, click on it
2. Click **Reveal Signing Secret**
3. Copy the secret (it's base64 encoded)
4. Add to n8n as `QUO_WEBHOOK_SIGNING_SECRET_BASE64`

## Step 4: Get API Key

1. Go to **Settings** > **API Keys**
2. Click **Create API Key**
3. Name it "Murray FSM n8n"
4. Copy the key
5. Add to n8n as `QUO_API_KEY`

## Step 5: Get Phone Number ID

1. Go to **Settings** > **Phone Numbers**
2. Click on your phone number
3. Copy the Phone Number ID from the URL or details
4. Add to n8n as `QUO_PHONE_NUMBER_ID`

## Webhook Signature Verification

Quo webhooks include an `openphone-signature` header:

```
openphone-signature: hmac;1;<timestamp>;<base64_digest>
```

Verification steps:
1. Parse the header into components
2. Create signed data: `<timestamp>.<raw_payload>`
3. Decode signing secret from base64
4. Compute HMAC-SHA256 of signed data
5. Compare digests

## Webhook Events

### message.received
Fired when an inbound SMS/MMS is received.

```json
{
  "id": "EV...",
  "type": "message.received",
  "data": {
    "id": "MS...",
    "direction": "incoming",
    "from": "+15551234567",
    "to": ["+15559876543"],
    "body": "Message text",
    "media": [],
    "phoneNumberId": "PN...",
    "createdAt": "2024-01-01T12:00:00Z"
  }
}
```

### call.completed
Fired when a call ends.

```json
{
  "id": "EV...",
  "type": "call.completed",
  "data": {
    "id": "CA...",
    "direction": "incoming",
    "from": "+15551234567",
    "to": "+15559876543",
    "duration": 180,
    "phoneNumberId": "PN...",
    "createdAt": "2024-01-01T12:00:00Z",
    "completedAt": "2024-01-01T12:03:00Z",
    "answeredAt": "2024-01-01T12:00:05Z"
  }
}
```

### call.transcript.completed
Fired when transcript is ready (requires call recording + eligible plan).

```json
{
  "id": "EV...",
  "type": "call.transcript.completed",
  "data": {
    "callId": "CA...",
    "transcript": "Full transcript text...",
    "summary": "AI-generated summary...",
    "actionItems": ["Follow up on quote", "Schedule appointment"]
  }
}
```

## Sending Messages via API

To send SMS through Quo API (used by n8n workflows):

```bash
curl -X POST https://api.openphone.com/v1/messages \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "from": "PN_YOUR_PHONE_NUMBER_ID",
    "to": ["+15551234567"],
    "body": "Your message here"
  }'
```

## Testing

1. Make a test call to your Quo number
2. Leave a voicemail or have a conversation
3. Check n8n executions for webhook receipt
4. Verify `call_logs` table has the call data
5. After transcript is ready, check `action_queue` for suggestions

## Troubleshooting

### Webhooks not arriving
- Verify webhook URL is accessible from internet
- Check webhook status in Quo dashboard
- Look for failed webhook deliveries

### Transcripts not appearing
- Confirm call recording is enabled
- Verify your plan supports AI transcripts
- Check if call was long enough (very short calls may not transcribe)

### Signature verification failing
- Ensure you're using the raw request body
- Verify signing secret is correctly base64 encoded
- Check timestamp is within 30 minute tolerance
