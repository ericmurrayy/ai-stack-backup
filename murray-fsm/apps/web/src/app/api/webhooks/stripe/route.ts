// Murray's FSM - Stripe Webhook Handler
// =======================================
// Handles payment_intent.succeeded and payment_intent.payment_failed events.
// Updates payments table, job paid_cents, and enqueues review request.

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHmac, timingSafeEqual } from 'crypto';

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function verifyStripeSignature(
  payload: string,
  signature: string | null,
  secret: string
): boolean {
  if (!signature || !secret) return false;
  try {
    const parts = signature.split(',');
    const timestamp = parts.find(p => p.startsWith('t='))?.split('=')[1];
    const sig = parts.find(p => p.startsWith('v1='))?.split('=')[1];
    if (!timestamp || !sig) return false;

    const signedPayload = `${timestamp}.${payload}`;
    const expected = createHmac('sha256', secret)
      .update(signedPayload)
      .digest('hex');

    return timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const rawBody = await request.text();

  // Verify Stripe signature
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (webhookSecret) {
    const signature = request.headers.get('stripe-signature');
    if (!verifyStripeSignature(rawBody, signature, webhookSecret)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
  }

  let event: { type: string; data: { object: Record<string, unknown> }; id: string };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const supabase = getServiceClient();

  // Idempotency check
  const { data: existing } = await supabase
    .from('automation_events')
    .select('id')
    .eq('idempotency_key', `stripe:${event.id}`)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  const pi = event.data.object;
  const paymentIntentId = pi.id as string;
  const metadata = pi.metadata as Record<string, string> | undefined;
  const ownerId = metadata?.owner_id;

  if (!ownerId) {
    // Can't process without owner_id in metadata
    return NextResponse.json({ received: true, skipped: 'no_owner_id' });
  }

  try {
    if (event.type === 'payment_intent.succeeded') {
      const amountReceived = pi.amount_received as number;

      // Update or create payment record
      const { data: existingPayment } = await supabase
        .from('payments')
        .select('id, job_id')
        .eq('stripe_payment_intent_id', paymentIntentId)
        .maybeSingle();

      if (existingPayment) {
        await supabase
          .from('payments')
          .update({
            status: 'succeeded',
            amount_cents: amountReceived,
            metadata: pi,
          })
          .eq('id', existingPayment.id);
      } else {
        const jobId = metadata?.job_id;
        await supabase.from('payments').insert({
          owner_id: ownerId,
          job_id: jobId ?? null,
          provider: 'stripe',
          stripe_payment_intent_id: paymentIntentId,
          amount_cents: amountReceived,
          status: 'succeeded',
          metadata: pi,
        });
      }

      // If there's a job_id, enqueue review request
      const jobId = existingPayment?.job_id ?? metadata?.job_id;
      if (jobId) {
        // Check if review request already queued
        const { data: existingAction } = await supabase
          .from('action_queue')
          .select('id')
          .eq('idempotency_key', `review_request:${jobId}`)
          .maybeSingle();

        if (!existingAction) {
          // Get customer info
          const { data: job } = await supabase
            .from('jobs')
            .select('customer_id, customers(name, phone, email)')
            .eq('id', jobId)
            .single();

          const customer = job?.customers as { name: string; phone: string; email: string } | null;

          await supabase.from('action_queue').insert({
            owner_id: ownerId,
            kind: 'request_review',
            payload: {
              job_id: jobId,
              customer_id: job?.customer_id,
              customer_name: customer?.name,
              customer_phone: customer?.phone,
              customer_email: customer?.email,
              send_via: customer?.phone ? 'sms' : 'email',
            },
            source_type: 'stripe_webhook',
            source_id: paymentIntentId,
            requires_approval: true,
            job_id: jobId,
            idempotency_key: `review_request:${jobId}`,
            status: 'pending',
            result: {},
            retry_count: 0,
            max_retries: 3,
          });
        }
      }

      // Audit
      await supabase.from('audit_log').insert({
        owner_id: ownerId,
        actor: 'stripe',
        action: 'payment_succeeded',
        entity_type: 'payment',
        entity_id: paymentIntentId,
        diff: { amount_cents: amountReceived, job_id: jobId },
      });
    }

    if (event.type === 'payment_intent.payment_failed') {
      await supabase
        .from('payments')
        .update({
          status: 'failed',
          metadata: pi,
        })
        .eq('stripe_payment_intent_id', paymentIntentId);

      await supabase.from('audit_log').insert({
        owner_id: ownerId,
        actor: 'stripe',
        action: 'payment_failed',
        entity_type: 'payment',
        entity_id: paymentIntentId,
        diff: { error: pi.last_payment_error },
      });
    }

    // Record idempotency
    await supabase.from('automation_events').insert({
      owner_id: ownerId,
      source: 'stripe_webhook',
      event_type: event.type,
      idempotency_key: `stripe:${event.id}`,
      payload: { payment_intent_id: paymentIntentId },
    });

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Stripe webhook error:', error);
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
}
