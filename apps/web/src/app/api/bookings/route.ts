// Murray's FSM - Booking Submission API
// ======================================
// Public endpoint for customer self-booking. No auth required.
// Creates customer, location, job, and enqueues confirmation SMS.

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
    const {
      businessId,
      serviceType,
      scheduledStart,
      scheduledEnd,
      firstName,
      lastName,
      phone,
      email,
      address,
      city,
      state,
      zip,
      notes,
    } = body;

    // Validate required fields
    if (!businessId || !serviceType || !scheduledStart || !firstName || !phone || !address || !city || !state || !zip) {
      return NextResponse.json(
        { error: 'Missing required fields', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    const supabase = getServiceClient();

    // Verify business exists and has online booking enabled
    const { data: settings } = await supabase
      .from('business_settings')
      .select('owner_id, features, business_name')
      .eq('owner_id', businessId)
      .single();

    if (!settings) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const features = (settings.features as Record<string, boolean>) || {};
    if (!features.online_booking) {
      return NextResponse.json({ error: 'Online booking is not enabled' }, { status: 403 });
    }

    const ownerId = settings.owner_id;
    const customerName = `${firstName} ${lastName}`.trim();

    // Upsert customer by phone
    const { data: existingCustomer } = await supabase
      .from('customers')
      .select('id')
      .eq('owner_id', ownerId)
      .eq('phone', phone)
      .maybeSingle();

    let customerId: string;
    if (existingCustomer) {
      customerId = existingCustomer.id;
      // Update name/email if provided
      await supabase
        .from('customers')
        .update({ name: customerName, email: email || null })
        .eq('id', customerId);
    } else {
      const { data: newCustomer, error: custErr } = await supabase
        .from('customers')
        .insert({
          owner_id: ownerId,
          name: customerName,
          phone,
          email: email || null,
          notes: 'Created via online booking',
        })
        .select()
        .single();

      if (custErr) {
        return NextResponse.json({ error: 'Failed to create customer' }, { status: 500 });
      }
      customerId = newCustomer.id;
    }

    // Create location
    const { data: location, error: locErr } = await supabase
      .from('locations')
      .insert({
        owner_id: ownerId,
        customer_id: customerId,
        address1: address,
        city,
        state,
        postal_code: zip,
      })
      .select()
      .single();

    if (locErr) {
      return NextResponse.json({ error: 'Failed to create location' }, { status: 500 });
    }

    // Create job
    const serviceLabels: Record<string, string> = {
      repair: 'Garage Door Repair',
      installation: 'New Garage Door Installation',
      maintenance: 'Maintenance & Tune-up',
      inspection: 'Safety Inspection',
    };

    const { data: job, error: jobErr } = await supabase
      .from('jobs')
      .insert({
        owner_id: ownerId,
        customer_id: customerId,
        location_id: location.id,
        title: `${serviceLabels[serviceType] || serviceType} - ${customerName}`,
        service_type: serviceLabels[serviceType] || serviceType,
        status: 'scheduled',
        scheduled_start: scheduledStart,
        scheduled_end: scheduledEnd || null,
        problem_description: notes || null,
        internal_notes: 'Booked online by customer',
      })
      .select()
      .single();

    if (jobErr) {
      return NextResponse.json({ error: 'Failed to create job' }, { status: 500 });
    }

    // Enqueue confirmation SMS (approval-gated)
    await supabase.from('action_queue').insert({
      owner_id: ownerId,
      kind: 'send_sms',
      payload: {
        to_phone: phone,
        customer_name: customerName,
        message: `Hi ${firstName}! Your appointment with ${settings.business_name || 'us'} is confirmed for ${new Date(scheduledStart).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}. We'll see you then!`,
        job_id: job.id,
      },
      source_type: 'online_booking',
      source_id: job.id,
      requires_approval: false, // Auto-send booking confirmations
      status: 'pending',
      idempotency_key: `booking_confirm:${job.id}`,
      result: {},
      retry_count: 0,
      max_retries: 3,
    });

    // Create portal token for this customer
    const token = crypto.randomUUID();
    await supabase.from('customer_portal_tokens').insert({
      owner_id: ownerId,
      customer_id: customerId,
      token,
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
      is_active: true,
    });

    // Audit
    await supabase.from('audit_log').insert({
      owner_id: ownerId,
      actor: 'customer',
      action: 'online_booking',
      entity_type: 'job',
      entity_id: job.id,
      diff: { customer_name: customerName, service_type: serviceType, phone },
    });

    return NextResponse.json({
      success: true,
      data: {
        jobId: job.id,
        scheduledStart,
        scheduledEnd: scheduledEnd || null,
        serviceType: serviceLabels[serviceType] || serviceType,
        portalToken: token,
        portalUrl: `/portal/${token}`,
      },
    });
  } catch (error) {
    console.error('Booking error:', error);
    return NextResponse.json({ error: 'Booking failed' }, { status: 500 });
  }
}
