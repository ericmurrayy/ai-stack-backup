// Murray's FSM - OpenPhone Inbound SMS Webhook
// ==============================================
// POST /api/webhooks/sms/openphone
// Receives inbound SMS messages from OpenPhone and logs them to message_logs.
// OpenPhone sends webhooks as JSON POST requests.

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// ============================================================================
// Types
// ============================================================================

interface OpenPhoneMediaItem {
  url: string;
  type?: string;
}

interface OpenPhoneMessageData {
  id: string;
  from: string;
  to: string[];
  body: string;
  media?: OpenPhoneMediaItem[];
  phoneNumberId?: string;
  createdAt?: string;
}

interface OpenPhoneWebhookPayload {
  id: string;
  object: string;
  type: string;
  data: {
    object: OpenPhoneMessageData;
  };
}

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
 * Validate OpenPhone webhook signature.
 *
 * OpenPhone signs webhooks with a shared secret using HMAC-SHA256.
 * The signature is sent in the `openphone-signature` header.
 *
 * @see https://www.openphone.com/docs/webhooks
 */
function validateOpenPhoneSignature(
  secret: string,
  signature: string,
  rawBody: string,
): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(rawBody, 'utf-8')
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
// POST /api/webhooks/sms/openphone
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    // ------------------------------------------------------------------
    // 1. Read raw body (needed for signature validation before parsing)
    // ------------------------------------------------------------------
    const rawBody = await request.text();

    let payload: OpenPhoneWebhookPayload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      console.error('[webhooks/sms/openphone] Invalid JSON body');
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 },
      );
    }

    console.log('[webhooks/sms/openphone] Received event:', payload.type);

    // ------------------------------------------------------------------
    // 2. Validate OpenPhone webhook signature (if secret is configured)
    // ------------------------------------------------------------------
    const webhookSecret = process.env.OPENPHONE_WEBHOOK_SECRET;
    if (webhookSecret) {
      const signature = request.headers.get('openphone-signature');
      if (!signature) {
        console.error('[webhooks/sms/openphone] Missing openphone-signature header');
        return NextResponse.json(
          { error: 'Missing signature' },
          { status: 403 },
        );
      }

      const isValid = validateOpenPhoneSignature(webhookSecret, signature, rawBody);
      if (!isValid) {
        console.error('[webhooks/sms/openphone] Invalid webhook signature');
        return NextResponse.json(
          { error: 'Invalid signature' },
          { status: 403 },
        );
      }
    }

    // ------------------------------------------------------------------
    // 3. Only process "message.received" events
    // ------------------------------------------------------------------
    if (payload.type !== 'message.received') {
      // Acknowledge but do nothing for other event types
      console.log('[webhooks/sms/openphone] Ignoring event type:', payload.type);
      return NextResponse.json({ received: true });
    }

    // ------------------------------------------------------------------
    // 4. Extract message fields
    // ------------------------------------------------------------------
    const message = payload.data?.object;
    if (!message) {
      console.error('[webhooks/sms/openphone] Missing message data in payload');
      return NextResponse.json(
        { error: 'Missing message data' },
        { status: 400 },
      );
    }

    const messageId = message.id || '';
    const from = message.from || '';
    const to = Array.isArray(message.to) ? message.to[0] || '' : '';
    const body = message.body || '';
    const media = (message.media || []).map((item: OpenPhoneMediaItem) => ({
      url: item.url,
      ...(item.type ? { contentType: item.type } : {}),
    }));

    // ------------------------------------------------------------------
    // 5. Resolve owner_id
    // ------------------------------------------------------------------
    const ownerId = resolveOwnerId();
    if (!ownerId) {
      console.error('[webhooks/sms/openphone] No owner_id configured. Set WEBHOOK_OWNER_ID env var.');
      // Still return 200 so OpenPhone doesn't retry, but log the issue
      return NextResponse.json({ received: true });
    }

    // ------------------------------------------------------------------
    // 6. Insert into message_logs
    // ------------------------------------------------------------------
    let supabase;
    try {
      supabase = getAdminClient();
    } catch (configError: any) {
      console.error('[webhooks/sms/openphone] Supabase config error:', configError.message);
      return NextResponse.json(
        { error: 'Internal configuration error' },
        { status: 500 },
      );
    }

    const { error: insertError } = await supabase.from('message_logs').insert({
      owner_id: ownerId,
      external_message_id: messageId,
      direction: 'inbound',
      from_phone: from,
      to_phone: to,
      body,
      media,
      status: 'received',
      raw_event: payload,
    });

    if (insertError) {
      console.error('[webhooks/sms/openphone] Failed to insert message_log:', insertError.message);
      // Return 200 anyway to prevent OpenPhone from retrying indefinitely
    } else {
      console.log('[webhooks/sms/openphone] Inbound SMS logged. ID:', messageId);
    }

    // ------------------------------------------------------------------
    // 7. Return success
    // ------------------------------------------------------------------
    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('[webhooks/sms/openphone] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
