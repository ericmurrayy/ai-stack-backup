// Murray's FSM - Portal Payment API
// ==================================
// Creates a Stripe Checkout session for invoice payment.
// Customer clicks "Pay" → redirected to Stripe → webhook confirms.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, jobId } = body;

    if (!token || !jobId) {
      return NextResponse.json({ error: 'token and jobId are required' }, { status: 400 });
    }

    const supabase = getServiceClient();

    // Verify portal token
    const { data: portalToken } = await supabase
      .from('customer_portal_tokens')
      .select('*, customer:customers(*)')
      .eq('token', token)
      .eq('is_active', true)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (!portalToken) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    // Get job with balance info
    const { data: job } = await supabase
      .from('jobs')
      .select('id, title, total_invoice_cents, customer_id, owner_id')
      .eq('id', jobId)
      .eq('customer_id', portalToken.customer_id)
      .single();

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Calculate balance due
    const { data: payments } = await supabase
      .from('payments')
      .select('amount_cents')
      .eq('job_id', jobId)
      .eq('status', 'succeeded');

    const totalPaid = (payments || []).reduce((sum, p) => sum + p.amount_cents, 0);
    const balanceDue = (job.total_invoice_cents || 0) - totalPaid;

    if (balanceDue <= 0) {
      return NextResponse.json({ error: 'No balance due' }, { status: 400 });
    }

    // Get business settings for Stripe
    const { data: settings } = await supabase
      .from('business_settings')
      .select('stripe_account_id, business_name')
      .eq('owner_id', job.owner_id)
      .single();

    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      return NextResponse.json({ error: 'Payment not configured' }, { status: 503 });
    }

    // Create Stripe Checkout Session via API
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.headers.get('origin') || 'http://localhost:3000';
    const customer = portalToken.customer;

    const params = new URLSearchParams();
    params.append('mode', 'payment');
    params.append('success_url', `${baseUrl}/portal/${token}?paid=true`);
    params.append('cancel_url', `${baseUrl}/portal/${token}?canceled=true`);
    params.append('customer_email', customer.email || '');
    params.append('line_items[0][price_data][currency]', 'usd');
    params.append('line_items[0][price_data][product_data][name]', job.title);
    params.append('line_items[0][price_data][product_data][description]',
      `Invoice payment for ${settings?.business_name || 'service'}`);
    params.append('line_items[0][price_data][unit_amount]', String(balanceDue));
    params.append('line_items[0][quantity]', '1');
    params.append('payment_intent_data[metadata][owner_id]', job.owner_id);
    params.append('payment_intent_data[metadata][job_id]', jobId);
    params.append('payment_intent_data[metadata][customer_id]', customer.id);
    params.append('payment_intent_data[metadata][source]', 'customer_portal');

    if (settings?.stripe_account_id) {
      params.append('payment_intent_data[transfer_data][destination]', settings.stripe_account_id);
    }

    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const session = await response.json();

    if (!response.ok) {
      console.error('Stripe error:', session);
      return NextResponse.json({ error: 'Failed to create payment session' }, { status: 500 });
    }

    // Create pending payment record
    await supabase.from('payments').insert({
      owner_id: job.owner_id,
      job_id: jobId,
      provider: 'stripe',
      stripe_payment_intent_id: session.payment_intent || session.id,
      amount_cents: balanceDue,
      status: 'pending',
      metadata: { checkout_session_id: session.id, source: 'customer_portal' },
    });

    return NextResponse.json({
      success: true,
      data: {
        checkoutUrl: session.url,
        sessionId: session.id,
        amount: balanceDue,
      },
    });
  } catch (error) {
    console.error('Portal payment error:', error);
    return NextResponse.json({ error: 'Payment failed' }, { status: 500 });
  }
}
