// Murray's FSM - Internal Jobs API
// =================================
// Dashboard job management with scheduling support
// Schema: supabase/schema.sql — jobs table

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

const OWNER_ID = process.env.DEFAULT_OWNER_ID || '00000000-0000-0000-0000-000000000000';

// GET /api/jobs - List jobs for dashboard and schedule
export async function GET(request: NextRequest) {
  try {
    const supabase = createAdminClient();
    const { searchParams } = new URL(request.url);

    // Optional filters
    const status = searchParams.get('status');
    const startDate = searchParams.get('start');
    const endDate = searchParams.get('end');
    const customerId = searchParams.get('customer_id');

    let query = supabase
      .from('jobs')
      .select('*, customers(name, phone, email)')
      .eq('deleted', false)
      .order('created_at', { ascending: false })
      .limit(500);

    // Apply status filter (valid: scheduled, in_progress, completed, canceled)
    if (status) {
      query = query.eq('status', status);
    }

    // Apply date range filter for scheduled jobs
    if (startDate) {
      query = query.gte('scheduled_start', startDate);
    }
    if (endDate) {
      query = query.lte('scheduled_start', endDate);
    }

    // Filter by customer
    if (customerId) {
      query = query.eq('customer_id', customerId);
    }

    const { data: jobs, error } = await query;

    if (error) {
      console.error('Error fetching jobs:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ jobs: jobs || [] });
  } catch (error: unknown) {
    console.error('Jobs GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch jobs' }, { status: 500 });
  }
}

// POST /api/jobs - Create a new job
// Required: customer_id, title
// Optional: service_type, problem_description, scheduled_start, scheduled_end, etc.
export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminClient();
    const body = await request.json();

    const { customer_id, title } = body;

    if (!customer_id || !title) {
      return NextResponse.json(
        { error: 'customer_id and title are required' },
        { status: 400 }
      );
    }

    // Verify customer exists
    const { data: customer, error: custErr } = await supabase
      .from('customers')
      .select('id')
      .eq('id', customer_id)
      .single();

    if (custErr || !customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    // Determine status — default to 'scheduled' if a start time is provided
    const hasSchedule = !!body.scheduled_start;
    const status = body.status || (hasSchedule ? 'scheduled' : 'scheduled');

    // Validate status is a valid enum value
    const validStatuses = ['scheduled', 'in_progress', 'completed', 'canceled'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    const { data: job, error } = await supabase
      .from('jobs')
      .insert({
        owner_id: body.owner_id || OWNER_ID,
        customer_id,
        location_id: body.location_id || null,
        title,
        service_type: body.service_type || null,
        problem_description: body.problem_description || null,
        status,
        scheduled_start: body.scheduled_start || null,
        scheduled_end: body.scheduled_end || null,
        internal_notes: body.internal_notes || null,
        customer_notes: body.customer_notes || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating job:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ job }, { status: 201 });
  } catch (error: unknown) {
    console.error('Jobs POST error:', error);
    return NextResponse.json({ error: 'Failed to create job' }, { status: 500 });
  }
}
