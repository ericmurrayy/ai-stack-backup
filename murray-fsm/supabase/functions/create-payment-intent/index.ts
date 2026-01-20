// Murray's FSM - Create Payment Intent Edge Function
// ===================================================
// Creates Stripe PaymentIntent for mobile PaymentSheet

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PaymentRequest {
  job_id: string
  amount_cents: number
  customer_email?: string
  description?: string
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Stripe
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeSecretKey) {
      throw new Error('STRIPE_SECRET_KEY not configured')
    }
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    })

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get auth token from request
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify user
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    const body: PaymentRequest = await req.json()
    const { job_id, amount_cents, customer_email, description } = body

    if (!job_id || !amount_cents) {
      return new Response(
        JSON.stringify({ error: 'job_id and amount_cents are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (amount_cents < 50) {
      return new Response(
        JSON.stringify({ error: 'Amount must be at least 50 cents' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify job exists and belongs to user
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('id, customer_id, title, customers(name, email)')
      .eq('id', job_id)
      .eq('owner_id', user.id)
      .single()

    if (jobError || !job) {
      return new Response(
        JSON.stringify({ error: 'Job not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get or create Stripe customer
    let stripeCustomerId: string | undefined
    const customerEmail = customer_email || (job.customers as any)?.email

    if (customerEmail) {
      // Search for existing customer
      const existingCustomers = await stripe.customers.list({
        email: customerEmail,
        limit: 1,
      })

      if (existingCustomers.data.length > 0) {
        stripeCustomerId = existingCustomers.data[0].id
      } else {
        // Create new customer
        const newCustomer = await stripe.customers.create({
          email: customerEmail,
          name: (job.customers as any)?.name,
          metadata: {
            supabase_customer_id: job.customer_id,
            owner_id: user.id,
          },
        })
        stripeCustomerId = newCustomer.id
      }
    }

    // Create ephemeral key for mobile
    let ephemeralKey: Stripe.EphemeralKey | undefined
    if (stripeCustomerId) {
      ephemeralKey = await stripe.ephemeralKeys.create(
        { customer: stripeCustomerId },
        { apiVersion: '2023-10-16' }
      )
    }

    // Create PaymentIntent
    const paymentIntentData: Stripe.PaymentIntentCreateParams = {
      amount: amount_cents,
      currency: 'usd',
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        job_id,
        owner_id: user.id,
      },
      description: description || `Payment for: ${job.title}`,
    }

    if (stripeCustomerId) {
      paymentIntentData.customer = stripeCustomerId
    }

    const paymentIntent = await stripe.paymentIntents.create(paymentIntentData)

    // Create payment record in database
    const { error: insertError } = await supabase.from('payments').insert({
      owner_id: user.id,
      job_id,
      provider: 'stripe',
      stripe_payment_intent_id: paymentIntent.id,
      amount_cents,
      status: 'pending',
      metadata: {
        stripe_customer_id: stripeCustomerId,
      },
    })

    if (insertError) {
      console.error('Failed to insert payment record:', insertError)
      // Don't fail the request - payment can still proceed
    }

    // Return response for PaymentSheet
    const response: Record<string, any> = {
      paymentIntent: paymentIntent.client_secret,
      publishableKey: Deno.env.get('STRIPE_PUBLISHABLE_KEY'),
    }

    if (stripeCustomerId && ephemeralKey) {
      response.customer = stripeCustomerId
      response.ephemeralKey = ephemeralKey.secret
    }

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error creating payment intent:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
