// Murray's FSM - Portal Payment Intent API
// ==========================================
// POST /api/portal/[token]/payments
// Customer-facing endpoint: creates a Stripe PaymentIntent for invoice payment.
// Validates portal token (no session auth required).

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Stripe from 'stripe';

// ============================================================================
// POST /api/portal/[token]/payments
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const supabase = await createClient();

    // ------------------------------------------------------------------
    // 1. Validate portal token
    // ------------------------------------------------------------------
    const { data: portalToken, error: tokenError } = await supabase
      .from('customer_portal_tokens')
      .select('id, owner_id, customer_phone, customer_email, token, job_id, expires_at')
      .eq('token', token)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (tokenError || !portalToken) {
      return NextResponse.json(
        { error: 'Invalid or expired portal token' },
        { status: 401 },
      );
    }

    // Update last_accessed_at on the token
    await supabase
      .from('customer_portal_tokens')
      .update({ last_accessed_at: new Date().toISOString() })
      .eq('id', portalToken.id);

    // ------------------------------------------------------------------
    // 2. Parse and validate body
    // ------------------------------------------------------------------
    let body: { job_id: string; amount_cents: number };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 },
      );
    }

    const { job_id, amount_cents } = body;

    if (!job_id || typeof job_id !== 'string') {
      return NextResponse.json(
        { error: '`job_id` is required' },
        { status: 400 },
      );
    }

    if (!amount_cents || typeof amount_cents !== 'number' || !Number.isInteger(amount_cents)) {
      return NextResponse.json(
        { error: '`amount_cents` must be a positive integer' },
        { status: 400 },
      );
    }

    if (amount_cents < 50) {
      return NextResponse.json(
        { error: 'Amount must be at least 50 cents ($0.50)' },
        { status: 400 },
      );
    }

    if (amount_cents > 99999999) {
      return NextResponse.json(
        { error: 'Amount exceeds maximum allowed' },
        { status: 400 },
      );
    }

    // ------------------------------------------------------------------
    // 3. Verify the job belongs to this customer
    // ------------------------------------------------------------------
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('id, owner_id, customer_name, email, phone_e164, issue_description')
      .eq('id', job_id)
      .eq('phone_e164', portalToken.customer_phone)
      .single();

    if (jobError || !job) {
      return NextResponse.json(
        { error: 'Job not found or does not belong to this customer' },
        { status: 404 },
      );
    }

    // ------------------------------------------------------------------
    // 4. Initialize Stripe and create PaymentIntent
    // ------------------------------------------------------------------
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      console.error('[portal/payments] STRIPE_SECRET_KEY not configured');
      return NextResponse.json(
        { error: 'Payment service not configured' },
        { status: 503 },
      );
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2025-02-24.acacia',
    });

    // Get or create Stripe customer
    let stripeCustomerId: string | undefined;
    const customerEmail = portalToken.customer_email || job.email;

    if (customerEmail) {
      const existingCustomers = await stripe.customers.list({
        email: customerEmail,
        limit: 1,
      });

      if (existingCustomers.data.length > 0) {
        stripeCustomerId = existingCustomers.data[0].id;
      } else {
        const newCustomer = await stripe.customers.create({
          email: customerEmail,
          name: job.customer_name || undefined,
          phone: portalToken.customer_phone,
          metadata: {
            job_id: job.id,
            owner_id: portalToken.owner_id,
            source: 'customer_portal',
          },
        });
        stripeCustomerId = newCustomer.id;
      }
    }

    const paymentIntentParams: Stripe.PaymentIntentCreateParams = {
      amount: amount_cents,
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      metadata: {
        job_id,
        owner_id: portalToken.owner_id,
        customer_phone: portalToken.customer_phone,
        source: 'customer_portal',
      },
      description: `Payment for: ${job.customer_name || 'Customer'} - ${job.issue_description || 'Service'}`,
    };

    if (stripeCustomerId) {
      paymentIntentParams.customer = stripeCustomerId;
    }

    const paymentIntent = await stripe.paymentIntents.create(paymentIntentParams);

    // ------------------------------------------------------------------
    // 5. Insert payment record into the payments table
    // ------------------------------------------------------------------
    const { error: insertError } = await supabase.from('payments').insert({
      owner_id: portalToken.owner_id,
      job_id,
      provider: 'stripe',
      method: 'card',
      status: 'pending',
      amount_cents,
      currency: 'usd',
      stripe_payment_intent_id: paymentIntent.id,
      stripe_customer_id: stripeCustomerId || null,
      description: paymentIntentParams.description,
      metadata: {
        source: 'customer_portal',
        customer_phone: portalToken.customer_phone,
        customer_email: customerEmail || null,
      },
    });

    if (insertError) {
      console.error('[portal/payments] Failed to insert payment record:', insertError.message);
      // Non-fatal: the PaymentIntent was already created in Stripe
    }

    // ------------------------------------------------------------------
    // 6. Return client secret + publishable key
    // ------------------------------------------------------------------
    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    });
  } catch (error: any) {
    console.error('[portal/payments] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
