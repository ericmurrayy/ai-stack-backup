// Murray's FSM - Public Jobs API v1
// ==================================
// External API for job management

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { authenticateApiRequest, logApiUsage } from '@/lib/api-auth';
import { hasScope } from '@murray-fsm/services';
import { JobCreateSchema } from '@murray-fsm/shared';

// GET /api/v1/jobs - List jobs
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const auth = await authenticateApiRequest(request);

  if (!auth.authenticated) {
    return NextResponse.json(
      { error: auth.error, code: 'UNAUTHORIZED' },
      { status: auth.statusCode || 401 }
    );
  }

  if (!hasScope(auth.scopes!, 'read:jobs')) {
    return NextResponse.json(
      { error: 'Insufficient permissions', code: 'FORBIDDEN' },
      { status: 403 }
    );
  }

  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const status = searchParams.get('status');
    const assignedTo = searchParams.get('assigned_to');
    const customerId = searchParams.get('customer_id');
    const fromDate = searchParams.get('from_date');
    const toDate = searchParams.get('to_date');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build query
    let query = supabase
      .from('jobs')
      .select(`
        id, title, status, service_type, scheduled_start, scheduled_end,
        total_cents, paid_cents, internal_notes, created_at, updated_at,
        customer:customers(id, name, phone, email),
        location:locations(id, address1, city, state, postal_code, lat, lng),
        assigned:team_members(id, full_name, phone)
      `, { count: 'exact' })
      .eq('owner_id', auth.ownerId)
      .eq('deleted', false)
      .order('scheduled_start', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (status) query = query.eq('status', status);
    if (assignedTo) query = query.eq('assigned_to', assignedTo);
    if (customerId) query = query.eq('customer_id', customerId);
    if (fromDate) query = query.gte('scheduled_start', fromDate);
    if (toDate) query = query.lte('scheduled_start', toDate);

    const { data: jobs, error, count } = await query;

    if (error) throw error;

    const response = NextResponse.json({
      success: true,
      data: {
        jobs,
        total: count,
        limit,
        offset,
      },
    });

    // Log usage
    await logApiUsage(
      auth.ownerId!,
      auth.ownerId!,
      '/api/v1/jobs',
      'GET',
      200,
      Date.now() - startTime,
      request
    );

    return response;
  } catch (error) {
    console.error('Jobs API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch jobs', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

// POST /api/v1/jobs - Create a job
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const auth = await authenticateApiRequest(request);

  if (!auth.authenticated) {
    return NextResponse.json(
      { error: auth.error, code: 'UNAUTHORIZED' },
      { status: auth.statusCode || 401 }
    );
  }

  if (!hasScope(auth.scopes!, 'write:jobs')) {
    return NextResponse.json(
      { error: 'Insufficient permissions', code: 'FORBIDDEN' },
      { status: 403 }
    );
  }

  try {
    const supabase = await createClient();
    const body = await request.json();

    // Validate with Zod schema
    const parsed = JobCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', code: 'VALIDATION_ERROR', issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const validated = parsed.data;

    // Create job
    const { data: job, error } = await supabase
      .from('jobs')
      .insert({
        owner_id: auth.ownerId,
        title: validated.title,
        customer_id: validated.customer_id,
        location_id: validated.location_id,
        scheduled_start: validated.scheduled_start,
        scheduled_end: validated.scheduled_end,
        service_type: validated.service_type || 'general',
        status: 'scheduled',
        assigned_to: validated.assigned_to,
        internal_notes: validated.internal_notes,
        priority: validated.priority,
        estimated_duration_minutes: validated.estimated_duration_minutes || 120,
      })
      .select()
      .single();

    if (error) throw error;

    const response = NextResponse.json({
      success: true,
      data: { job },
    }, { status: 201 });

    await logApiUsage(
      auth.ownerId!,
      auth.ownerId!,
      '/api/v1/jobs',
      'POST',
      201,
      Date.now() - startTime,
      request
    );

    return response;
  } catch (error) {
    console.error('Create job error:', error);
    return NextResponse.json(
      { error: 'Failed to create job', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
