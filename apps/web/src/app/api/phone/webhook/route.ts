/**
 * Retell AI Webhook Handler
 * =========================
 * Receives events from Retell AI for call lifecycle
 */

import { NextRequest, NextResponse } from 'next/server';
import { retellService, RetellWebhookEvent } from '@packages/services/retell';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * Verify webhook signature from Retell
 */
function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

/**
 * POST /api/phone/webhook
 * Handle Retell AI webhook events
 */
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-retell-signature') || '';
    const webhookSecret = process.env.RETELL_WEBHOOK_SECRET || '';

    // Verify signature in production
    if (webhookSecret && process.env.NODE_ENV === 'production') {
      if (!verifyWebhookSignature(rawBody, signature, webhookSecret)) {
        console.error('[Retell Webhook] Invalid signature');
        return NextResponse.json(
          { error: 'Invalid signature' },
          { status: 401 }
        );
      }
    }

    const event: RetellWebhookEvent = JSON.parse(rawBody);

    console.log(`[Retell Webhook] Event: ${event.event}, Call: ${event.call_id}`);

    // Process the webhook event
    await retellService.handleWebhook(event);

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('[Retell Webhook] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/phone/webhook
 * Health check for webhook endpoint
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    provider: 'retell',
    endpoint: '/api/phone/webhook',
  });
}
