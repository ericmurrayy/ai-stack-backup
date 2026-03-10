// Murray's FSM - Public Jobs API v1
// ==================================
// External API for job management

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { authenticateApiRequest, logApiUsage } from '@/lib/api-auth';
import { hasScope } from '@murray-fsm/services';
import { z } from 'zod';
import { validateBody, validateQuery, positiveIntString, nonNegativeIntString, isoDateString, uuidString } from '@/lib/api-validation';

// --- Zod Schemas ---

const JOB_STATUSES = ['new', 'contacted', 'scheduled', 'in_progress', 'completed', 'cancelled', 'spam'] as const;

const listJobsQuerySchema = z.object({
  status: z.enum(JOB_STATUSES).optional(),
  assigned_to: uuidString.optional(),
  customer_id: uuidString.optional(),
  from_date: isoDateString.optional(),
  to_date: isoDateString.optional(),
  limit: positiveIntString(50).pipe(z.number().max(100, 'limit must be at most 100')),
  offset: nonNegativeIntString(0),
});

const createJobBodySchema = z.object({
  title: z.string().min(1, 'title is required').max(500),
  customer_id: uuidString,
  location_id: uuidString.optional(),
  scheduled_start: isoDateString.optional(),
  scheduled_end: isoDateString.optional(),
  service_type: z.string().max(200).optional(),
  status: z.enum(JOB_STATUSES).optional(),
  assigned_to: uuidString.optional(),
  notes: z.string().max(5000).optional(),
  priority: z.number().int().min(0).max(10).optional(),
  estimated_duration_minutes: z.number().int().positive().optional(),
});

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

    // Validate query parameters
    const queryResult = validateQuery(listJobsQuerySchema, searchParams);
    if (!queryResult.success) return queryResult.response;

    const { status, assigned_to: assignedTo, customer_id: customerId, from_date: fromDate, to_date: toDate, limit, offset } = queryResult.data;

    // Build query
    let query = supabase
      .from('jobs')
      .select(`
        id, title, status, service_type, scheduled_start, scheduled_end,
        total_cents, paid_cents, internal_notes, created_at, updated_at,
        customer:customers(id, name, phone, email),
        location:locations(id, address1, city, state, postal_code, lat, lng),
        assigned:technicians(id, name, phone)
      `, { count: 'exact' })
      .eq('owner_id', auth.ownerId)
      .eq('deleted', false)
      .order('scheduled_start', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (status) query = query.eq('status', status);
    if (assignedTo) query = query.eq('assigned_technician_id', assignedTo);
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
      auth.apiKeyId!,
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

    // Validate request body
    const bodyResult = validateBody(createJobBodySchema, body);
    if (!bodyResult.success) return bodyResult.response;

    const validated = bodyResult.data;

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
        status: validated.status || 'scheduled',
        assigned_to: validated.assigned_to,
        internal_notes: validated.notes,
        priority: validated.priority || 0,
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
      auth.apiKeyId!,
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
