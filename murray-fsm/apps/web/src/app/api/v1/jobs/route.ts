// Murray's FSM - Public Jobs API v1
// ==================================
// External API for job management

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { authenticateApiRequest, logApiUsage } from '@/lib/api-auth';
import { hasScope } from '@murray-fsm/services';

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
    const supabase = createClient();
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
    const supabase = createClient();
    const body = await request.json();

    // Validate required fields
    const { title, customer_id, location_id, scheduled_start } = body;

    if (!title || !customer_id) {
      return NextResponse.json(
        { error: 'title and customer_id are required', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    // Create job
    const { data: job, error } = await supabase
      .from('jobs')
      .insert({
        owner_id: auth.ownerId,
        title,
        customer_id,
        location_id,
        scheduled_start,
        scheduled_end: body.scheduled_end,
        service_type: body.service_type || 'general',
        status: body.status || 'scheduled',
        assigned_to: body.assigned_to,
        internal_notes: body.notes,
        priority: body.priority || 0,
        estimated_duration_minutes: body.estimated_duration_minutes || 120,
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
