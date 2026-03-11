// Murray's FSM - Twilio Inbound SMS Webhook
// ==========================================
// POST /api/webhooks/sms/twilio
// Receives inbound SMS messages from Twilio and logs them to message_logs.
// Twilio sends webhooks as form-urlencoded POST requests.

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// ============================================================================
// Helpers
// ============================================================================

/** Create a Supabase admin client that bypasses RLS (for webhook handlers). */
function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Missing Supabase config for webhook handler');
  }
  return createAdminClient(url, key);
}

/**
 * Validate the Twilio request signature (X-Twilio-Signature).
 *
 * Twilio computes the signature as:
 *   1. Take the full webhook URL
 *   2. Sort the POST parameters alphabetically by key
 *   3. Append each key-value pair (no delimiter) to the URL
 *   4. HMAC-SHA1 the resulting string with the Auth Token
 *   5. Base64-encode the result
 *
 * @see https://www.twilio.com/docs/usage/security#validating-requests
 */
function validateTwilioSignature(
  authToken: string,
  signature: string,
  url: string,
  params: Record<string, string>,
): boolean {
  // Build the data string: URL + sorted params concatenated
  const sortedKeys = Object.keys(params).sort();
  let data = url;
  for (const key of sortedKeys) {
    data += key + params[key];
  }

  const expectedSignature = crypto
    .createHmac('sha1', authToken)
    .update(data, 'utf-8')
    .digest('base64');

  // Constant-time comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature),
    );
  } catch {
    // Buffers of different length throw; that means they don't match
    return false;
  }
}

/**
 * Resolve the owner_id for the webhook. Checks WEBHOOK_OWNER_ID env var
 * as a fallback. In a multi-tenant setup you would look up the owner by
 * matching the `to` phone number against a user_configs table.
 */
function resolveOwnerId(): string | null {
  return process.env.WEBHOOK_OWNER_ID || null;
}

// ============================================================================
// POST /api/webhooks/sms/twilio
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    // ------------------------------------------------------------------
    // 1. Parse form-urlencoded body
    // ------------------------------------------------------------------
    const formData = await request.formData();
    const params: Record<string, string> = {};
    formData.forEach((value, key) => {
      params[key] = String(value);
    });

    console.log('[webhooks/sms/twilio] Received inbound SMS from:', params.From);

    // ------------------------------------------------------------------
    // 2. Validate Twilio signature (if auth token is configured)
    // ------------------------------------------------------------------
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    if (authToken) {
      const signature = request.headers.get('x-twilio-signature');
      if (!signature) {
        console.error('[webhooks/sms/twilio] Missing X-Twilio-Signature header');
        return new NextResponse(
          '<Response></Response>',
          { status: 403, headers: { 'Content-Type': 'text/xml' } },
        );
      }

      // Reconstruct the full webhook URL that Twilio used to compute the signature.
      // Use X-Forwarded-Proto/Host if behind a reverse proxy, otherwise fall back
      // to the request URL. TWILIO_WEBHOOK_URL env var takes highest priority.
      const webhookUrl =
        process.env.TWILIO_WEBHOOK_URL ||
        `${request.headers.get('x-forwarded-proto') || 'https'}://${request.headers.get('host')}${request.nextUrl.pathname}`;

      const isValid = validateTwilioSignature(authToken, signature, webhookUrl, params);
      if (!isValid) {
        console.error('[webhooks/sms/twilio] Invalid Twilio signature');
        return new NextResponse(
          '<Response></Response>',
          { status: 403, headers: { 'Content-Type': 'text/xml' } },
        );
      }
    }

    // ------------------------------------------------------------------
    // 3. Extract message fields
    // ------------------------------------------------------------------
    const messageSid = params.MessageSid || params.SmsSid || '';
    const from = params.From || '';
    const to = params.To || '';
    const body = params.Body || '';
    const numMedia = parseInt(params.NumMedia || '0', 10);

    // Collect media URLs (MediaUrl0, MediaUrl1, ...)
    const media: Array<{ url: string; contentType?: string }> = [];
    for (let i = 0; i < numMedia; i++) {
      const mediaUrl = params[`MediaUrl${i}`];
      const mediaContentType = params[`MediaContentType${i}`];
      if (mediaUrl) {
        media.push({
          url: mediaUrl,
          ...(mediaContentType ? { contentType: mediaContentType } : {}),
        });
      }
    }

    // ------------------------------------------------------------------
    // 4. Resolve owner_id
    // ------------------------------------------------------------------
    const ownerId = resolveOwnerId();
    if (!ownerId) {
      console.error('[webhooks/sms/twilio] No owner_id configured. Set WEBHOOK_OWNER_ID env var.');
      // Still return 200 so Twilio doesn't retry, but log the issue
      return new NextResponse(
        '<Response></Response>',
        { status: 200, headers: { 'Content-Type': 'text/xml' } },
      );
    }

    // ------------------------------------------------------------------
    // 5. Insert into message_logs
    // ------------------------------------------------------------------
    let supabase;
    try {
      supabase = getAdminClient();
    } catch (configError: any) {
      console.error('[webhooks/sms/twilio] Supabase config error:', configError.message);
      return new NextResponse(
        '<Response></Response>',
        { status: 500, headers: { 'Content-Type': 'text/xml' } },
      );
    }

    const { error: insertError } = await supabase.from('message_logs').insert({
      owner_id: ownerId,
      external_message_id: messageSid,
      direction: 'inbound',
      from_phone: from,
      to_phone: to,
      body,
      media,
      status: 'received',
      raw_event: params,
    });

    if (insertError) {
      console.error('[webhooks/sms/twilio] Failed to insert message_log:', insertError.message);
      // Return 200 anyway to prevent Twilio from retrying indefinitely
    } else {
      console.log('[webhooks/sms/twilio] Inbound SMS logged. SID:', messageSid);
    }

    // ------------------------------------------------------------------
    // 6. Return TwiML response
    // ------------------------------------------------------------------
    // Return an empty TwiML <Response> so Twilio knows we processed
    // the webhook. If you want to auto-reply, add a <Message> element.
    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?>\n<Response></Response>',
      {
        status: 200,
        headers: { 'Content-Type': 'text/xml' },
      },
    );
  } catch (error: any) {
    console.error('[webhooks/sms/twilio] Unexpected error:', error);
    // Always return valid TwiML even on errors
    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?>\n<Response></Response>',
      {
        status: 500,
        headers: { 'Content-Type': 'text/xml' },
      },
    );
  }
}
