/**
 * Stripe Webhook Handler
 * ======================
 * Handles payment events from Stripe
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

export const runtime = 'nodejs';
export const maxDuration = 30;

// Initialize Stripe lazily to avoid build-time errors
let stripeInstance: Stripe | null = null;

function getStripe() {
  if (!stripeInstance && process.env.STRIPE_SECRET_KEY) {
    stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2026-01-28.clover' as any, // Match installed SDK version
    });
  }
  return stripeInstance;
}

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

/**
 * POST /api/webhooks/stripe
 * Handle Stripe webhook events
 */
export async function POST(req: NextRequest) {
  try {
    const stripe = getStripe();
    if (!stripe) {
      return NextResponse.json(
        { error: 'Stripe not configured' },
        { status: 500 }
      );
    }

    const body = await req.text();
    const signature = req.headers.get('stripe-signature');

    if (!signature) {
      return NextResponse.json(
        { error: 'Missing stripe-signature header' },
        { status: 400 }
      );
    }

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err: any) {
      console.error('[Stripe Webhook] Signature verification failed:', err.message);
      return NextResponse.json(
        { error: `Webhook signature verification failed: ${err.message}` },
        { status: 400 }
      );
    }

    console.log(`[Stripe Webhook] Received event: ${event.type}`);

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutComplete(event.data.object as Stripe.Checkout.Session);
        break;

      case 'payment_intent.succeeded':
        await handlePaymentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;

      case 'payment_intent.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.PaymentIntent);
        break;

      case 'invoice.paid':
        await handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        await handleRefund(charge);
        break;
      }

      default:
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('[Stripe Webhook] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

/**
 * Handle checkout session completed (payment link used)
 * Creates a payment record and updates job.paid_cents
 */
async function handleCheckoutComplete(session: Stripe.Checkout.Session) {
  console.log(`[Stripe] Checkout completed: ${session.id}`);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const jobId = session.metadata?.job_id;
  const ownerId = session.metadata?.owner_id || '00000000-0000-0000-0000-000000000000';
  const amountCents = session.amount_total || 0;

  if (!jobId) {
    console.log('[Stripe] No job_id in checkout metadata — logging payment only');
  }

  // Create payment record
  await supabase.from('payments').insert({
    owner_id: ownerId,
    job_id: jobId || '00000000-0000-0000-0000-000000000000',
    provider: 'stripe',
    stripe_payment_intent_id: typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id || `checkout_${session.id}`,
    amount_cents: amountCents,
    status: 'succeeded',
    metadata: {
      checkout_session_id: session.id,
      customer_email: session.customer_details?.email,
      paid_at: new Date().toISOString(),
    },
  });

  // Update job paid_cents
  if (jobId && amountCents > 0) {
    const { data: job } = await supabase
      .from('jobs')
      .select('paid_cents')
      .eq('id', jobId)
      .single();

    if (job) {
      await supabase
        .from('jobs')
        .update({ paid_cents: (job.paid_cents || 0) + amountCents })
        .eq('id', jobId);

      console.log(`[Stripe] Checkout: job ${jobId} paid_cents updated`);
    }
  }
}

/**
 * Handle successful payment intent
 */
async function handlePaymentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  console.log(`[Stripe] Payment succeeded: ${paymentIntent.id}, Amount: $${(paymentIntent.amount / 100).toFixed(2)}`);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const jobId = paymentIntent.metadata?.job_id;

  // Update existing payment record (created by Edge Function) or insert new one
  const { data: existingPayment } = await supabase
    .from('payments')
    .select('id')
    .eq('stripe_payment_intent_id', paymentIntent.id)
    .single();

  if (existingPayment) {
    await supabase
      .from('payments')
      .update({
        status: 'succeeded',
        metadata: {
          stripe_charge_id: paymentIntent.latest_charge,
          payment_method: paymentIntent.payment_method,
          paid_at: new Date().toISOString(),
        },
      })
      .eq('id', existingPayment.id);
  } else {
    await supabase.from('payments').insert({
      owner_id: paymentIntent.metadata?.owner_id || '00000000-0000-0000-0000-000000000000',
      job_id: jobId || '00000000-0000-0000-0000-000000000000',
      stripe_payment_intent_id: paymentIntent.id,
      amount_cents: paymentIntent.amount,
      status: 'succeeded',
      metadata: {
        stripe_charge_id: paymentIntent.latest_charge,
        paid_at: new Date().toISOString(),
      },
    });
  }

  // Update the job's paid_cents if we have a job_id
  if (jobId) {
    const { data: job } = await supabase
      .from('jobs')
      .select('paid_cents, total_invoice_cents')
      .eq('id', jobId)
      .single();

    if (job) {
      const newPaidCents = (job.paid_cents || 0) + paymentIntent.amount;
      await supabase
        .from('jobs')
        .update({ paid_cents: newPaidCents })
        .eq('id', jobId);

      console.log(`[Stripe] Job ${jobId} paid_cents updated: ${newPaidCents}`);
    }
  }
}

/**
 * Handle failed payment
 */
async function handlePaymentFailed(paymentIntent: Stripe.PaymentIntent) {
  console.log(`[Stripe] Payment failed: ${paymentIntent.id}, Reason: ${paymentIntent.last_payment_error?.message || 'unknown'}`);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Update existing payment record or insert new
  const { data: existingPayment } = await supabase
    .from('payments')
    .select('id')
    .eq('stripe_payment_intent_id', paymentIntent.id)
    .single();

  if (existingPayment) {
    await supabase
      .from('payments')
      .update({
        status: 'failed',
        metadata: {
          failure_code: paymentIntent.last_payment_error?.code,
          failure_message: paymentIntent.last_payment_error?.message,
          failed_at: new Date().toISOString(),
        },
      })
      .eq('id', existingPayment.id);
  } else {
    await supabase.from('payments').insert({
      owner_id: paymentIntent.metadata?.owner_id || '00000000-0000-0000-0000-000000000000',
      job_id: paymentIntent.metadata?.job_id || '00000000-0000-0000-0000-000000000000',
      stripe_payment_intent_id: paymentIntent.id,
      amount_cents: paymentIntent.amount,
      status: 'failed',
      metadata: {
        failure_code: paymentIntent.last_payment_error?.code,
        failure_message: paymentIntent.last_payment_error?.message,
        failed_at: new Date().toISOString(),
      },
    });
  }
}

/**
 * Handle Stripe invoice paid (for subscriptions)
 */
async function handleInvoicePaid(stripeInvoice: Stripe.Invoice) {
  console.log(`[Stripe] Invoice paid: ${stripeInvoice.id}`);
  // Handle subscription payments if needed
}

/**
 * Handle charge refund
 */
async function handleRefund(charge: Stripe.Charge) {
  const paymentIntentId = typeof charge.payment_intent === 'string'
    ? charge.payment_intent
    : charge.payment_intent?.id;

  if (!paymentIntentId) return;

  console.log(`[Stripe] Refund processed: charge ${charge.id}, Amount: $${(charge.amount_refunded / 100).toFixed(2)}`);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: payment } = await supabase
    .from('payments')
    .select('id, job_id, amount_cents')
    .eq('stripe_payment_intent_id', paymentIntentId)
    .single();

  if (payment) {
    // Mark as refunded if fully refunded
    if (charge.amount_refunded >= payment.amount_cents) {
      await supabase
        .from('payments')
        .update({ status: 'refunded' })
        .eq('id', payment.id);
    }

    // Update job paid_cents
    if (payment.job_id) {
      const { data: job } = await supabase
        .from('jobs')
        .select('paid_cents')
        .eq('id', payment.job_id)
        .single();

      if (job) {
        await supabase
          .from('jobs')
          .update({
            paid_cents: Math.max(0, (job.paid_cents || 0) - charge.amount_refunded),
          })
          .eq('id', payment.job_id);
      }
    }
  }
}

/**
 * GET /api/webhooks/stripe
 * Health check
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoint: '/api/webhooks/stripe',
    configured: !!process.env.STRIPE_WEBHOOK_SECRET,
  });
}
