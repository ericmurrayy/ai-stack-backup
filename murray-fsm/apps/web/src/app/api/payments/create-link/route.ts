// Murray's FSM - Create Stripe Payment Link API Route
// ====================================================
// POST /api/payments/create-link
// Generates a Stripe Checkout Session URL that can be sent to customers
// via SMS or email for payment collection.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logAction } from '@/lib/audit-log';
import { z } from 'zod';
import { validateBody } from '@/lib/api-validation';
import Stripe from 'stripe';

// ============================================================================
// Validation
// ============================================================================

/** Minimal E.164 phone validation: +{country}{number}, 8-15 digits total */
const E164_REGEX = /^\+[1-9]\d{7,14}$/;

const createPaymentLinkSchema = z
  .object({
    job_id: z.string().uuid({ message: 'job_id must be a valid UUID' }),
    amount_cents: z
      .number()
      .int({ message: 'amount_cents must be an integer' })
      .min(50, { message: 'amount_cents must be at least 50 (i.e. $0.50)' }),
    description: z.string().trim().max(500).optional(),
    customer_email: z.string().email().optional(),
    customer_name: z.string().trim().max(200).optional(),
    send_sms: z.boolean().optional().default(false),
    customer_phone: z.string().optional(),
  })
  .refine(
    (data) => {
      // If send_sms is true, customer_phone is required and must be E.164
      if (data.send_sms) {
        return !!data.customer_phone && E164_REGEX.test(data.customer_phone);
      }
      return true;
    },
    {
      message:
        'customer_phone is required in E.164 format (e.g. +15551234567) when send_sms is true',
      path: ['customer_phone'],
    }
  );

type CreatePaymentLinkInput = z.infer<typeof createPaymentLinkSchema>;

// ============================================================================
// POST /api/payments/create-link
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    // ------------------------------------------------------------------
    // 1. Auth check
    // ------------------------------------------------------------------
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ------------------------------------------------------------------
    // 2. Parse and validate body
    // ------------------------------------------------------------------
    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 },
      );
    }

    const validation = validateBody(createPaymentLinkSchema, rawBody);
    if (!validation.success) {
      return validation.response;
    }

    const {
      job_id,
      amount_cents,
      description,
      customer_email,
      customer_name,
      send_sms,
      customer_phone,
    } = validation.data;

    // ------------------------------------------------------------------
    // 3. Verify job exists and belongs to the user
    // ------------------------------------------------------------------
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('id, job_number, owner_id')
      .eq('id', job_id)
      .eq('owner_id', user.id)
      .eq('deleted', false)
      .single();

    if (jobError || !job) {
      return NextResponse.json(
        { error: 'Job not found or access denied', code: 'NOT_FOUND' },
        { status: 404 },
      );
    }

    // ------------------------------------------------------------------
    // 4. Initialize Stripe
    // ------------------------------------------------------------------
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      console.error('[payments/create-link] STRIPE_SECRET_KEY is not configured');
      return NextResponse.json(
        { error: 'Payment service not configured. Please set STRIPE_SECRET_KEY.' },
        { status: 503 },
      );
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2025-02-24.acacia',
      typescript: true,
    });

    // ------------------------------------------------------------------
    // 5. Create Stripe Checkout Session
    // ------------------------------------------------------------------
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const lineItemName = description || `Service - Job #${job.job_number}`;

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: lineItemName,
              description: `Payment for ${customer_name || 'service'}`,
            },
            unit_amount: amount_cents,
          },
          quantity: 1,
        },
      ],
      customer_email: customer_email || undefined,
      metadata: {
        job_id,
        owner_id: user.id,
        source: 'dashboard_payment_link',
      },
      success_url: `${appUrl}/portal/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/portal/payment-cancelled`,
    });

    // ------------------------------------------------------------------
    // 6. Insert payment record
    // ------------------------------------------------------------------
    const { error: paymentInsertError } = await supabase.from('payments').insert({
      owner_id: user.id,
      job_id,
      provider: 'stripe',
      stripe_payment_intent_id: session.payment_intent as string | null,
      amount_cents,
      status: 'pending',
      description: lineItemName,
      metadata: {
        stripe_session_id: session.id,
        customer_email: customer_email || null,
        customer_name: customer_name || null,
        customer_phone: customer_phone || null,
      },
    });

    if (paymentInsertError) {
      // Non-fatal: log but do not fail the request since checkout session
      // was already created
      console.error(
        '[payments/create-link] Failed to insert payment record:',
        paymentInsertError.message,
      );
    }

    // ------------------------------------------------------------------
    // 7. Optionally send payment link via SMS
    // ------------------------------------------------------------------
    let smsSent = false;

    if (send_sms && customer_phone && session.url) {
      try {
        const smsResponse = await fetch(
          `${appUrl}/api/sms/send`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              cookie: request.headers.get('cookie') || '',
            },
            body: JSON.stringify({
              to: customer_phone,
              template: 'invoice' as const,
              templateData: {
                customerName: customer_name || 'Customer',
                amount: `$${(amount_cents / 100).toFixed(2)}`,
                paymentUrl: session.url,
                jobNumber: String(job.job_number),
              },
              jobId: job_id,
            }),
          },
        );

        const smsResult = await smsResponse.json();
        smsSent = smsResult.success === true;

        if (!smsSent) {
          console.error(
            '[payments/create-link] SMS send failed:',
            smsResult.error || 'Unknown error',
          );
        }
      } catch (smsError: any) {
        console.error(
          '[payments/create-link] SMS send error:',
          smsError.message,
        );
        // Non-fatal: payment link was still created
      }
    }

    // ------------------------------------------------------------------
    // 8. Audit log
    // ------------------------------------------------------------------
    logAction(request, {
      ownerId: user.id,
      actorId: user.id,
      actorEmail: user.email,
      action: 'payment_link.created',
      resourceType: 'payment',
      resourceId: session.id,
      metadata: {
        job_id,
        amount_cents,
        customer_email: customer_email || null,
        customer_name: customer_name || null,
        sms_sent: smsSent,
        stripe_session_id: session.id,
      },
    });

    // ------------------------------------------------------------------
    // 9. Return result
    // ------------------------------------------------------------------
    return NextResponse.json({
      success: true,
      checkoutUrl: session.url,
      sessionId: session.id,
      smsSent,
    });
  } catch (error: any) {
    // Handle Stripe-specific errors with better messaging
    if (error instanceof Stripe.errors.StripeError) {
      console.error('[payments/create-link] Stripe error:', error.message);
      return NextResponse.json(
        {
          error: 'Payment provider error',
          code: 'STRIPE_ERROR',
          details: error.message,
        },
        { status: 502 },
      );
    }

    console.error('[payments/create-link] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
