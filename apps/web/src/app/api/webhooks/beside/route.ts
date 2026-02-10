/**
 * Beside (formerly M1) Webhook Handler
 * ======================================
 * Handles Beside-specific events with HMAC signature verification.
 *
 * CALL events: Forwarded to /api/webhooks/call-received (canonical handler)
 * MESSAGE events: Handled directly here (SMS inbound/outbound)
 *
 * All call processing (AI analysis, job creation) flows through call-received.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getBesideWebhookSecret, getWebhookSecret } from '@/lib/env-secrets';
import crypto from 'crypto';

const DEFAULT_OWNER_ID = process.env.DEFAULT_OWNER_ID || '';

function verifySignature(rawBody: string, signature: string | null): { ok: boolean, reason?: string } {
  const secret = getBesideWebhookSecret()
  if (!secret) {
    return { ok: false, reason: 'BESIDE_WEBHOOK_SECRET not configured. Set it to the signing secret from your Beside dashboard.' }
  }
  if (!signature) {
    return { ok: false, reason: 'No signature header provided by Beside' }
  }
  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');
  try {
    const valid = crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    return valid ? { ok: true } : { ok: false, reason: 'Signature mismatch' }
  } catch {
    return { ok: false, reason: 'Signature verification error' }
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'Murray FSM — Beside Webhook',
    events: [
      'call.* → forwarded to /api/webhooks/call-received',
      'message.received',
      'message.sent',
      'message.delivered',
    ],
  });
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();

    // Verify HMAC signature
    const signature =
      request.headers.get('x-webhook-signature') ||
      request.headers.get('x-beside-signature');
    const sigResult = verifySignature(rawBody, signature);
    if (!sigResult.ok) {
      console.warn(`[Beside] Auth failed: ${sigResult.reason}`);
      return NextResponse.json(
        { error: 'Unauthorized', hint: sigResult.reason },
        { status: 401 }
      );
    }

    let payload: Record<string, any>;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const eventType: string = payload.type || '';
    console.log(`[Beside] Event: ${eventType}`);

    // ── CALL EVENTS → forward to canonical call handler ──
    if (eventType.startsWith('call.')) {
      // Re-format as Beside source for call-received normalization
      const forwarded = {
        event_type: eventType,
        source: 'beside',
        data: payload.data || payload,
      };

      const callReceivedUrl = new URL('/api/webhooks/call-received', request.url);
      const res = await fetch(callReceivedUrl.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-token': getWebhookSecret(),
        },
        body: JSON.stringify(forwarded),
      });

      const result = await res.json();
      return NextResponse.json({ forwarded: true, event: eventType, ...result });
    }

    // ── MESSAGE EVENTS → handle directly ──
    if (eventType.startsWith('message.')) {
      const ownerId = DEFAULT_OWNER_ID;
      if (!ownerId) {
        return NextResponse.json({ error: 'No DEFAULT_OWNER_ID' }, { status: 500 });
      }

      const supabase = createAdminClient();
      const data = payload.data || payload;

      const { error } = await supabase
        .from('message_logs')
        .upsert(
          {
            owner_id: ownerId,
            external_message_id: data.id || `beside_${Date.now()}`,
            direction: data.direction || 'inbound',
            from_phone: data.from || '',
            to_phone: data.to || '',
            body: data.body || null,
            media: data.media || [],
            status: data.status || null,
            sent_at: data.sentAt || null,
            delivered_at: data.deliveredAt || null,
            received_at: data.receivedAt || null,
            raw_event: payload,
          },
          { onConflict: 'external_message_id' }
        );

      if (error) {
        console.error('[Beside] Message upsert failed:', error);
        return NextResponse.json({ error: 'Failed to store message' }, { status: 500 });
      }

      return NextResponse.json({ success: true, event: eventType });
    }

    console.log(`[Beside] Unknown event type: ${eventType}`);
    return NextResponse.json({ success: true, event: eventType, ignored: true });
  } catch (error: any) {
    console.error('[Beside] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}
