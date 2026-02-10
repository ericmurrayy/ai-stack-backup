// Murray's FSM - Public Jobs API v1
// ==================================
// Standardized request/response contracts with Zod validation.

import { NextRequest } from 'next/server';
import { authenticateApiRequest, logApiUsage } from '@/lib/api-auth';
import { hasScope } from '@murray-fsm/services';
import { JobCreateSchema, JobListQuerySchema } from '@murray-fsm/shared';
import { createClient } from '@/lib/supabase/server';
import {
  apiSuccess,
  apiUnauthorized,
  apiForbidden,
  apiValidationError,
  apiInternalError,
  generateRequestId,
  paginationMeta,
} from '@/lib/api-response';

// GET /api/v1/jobs - List jobs
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const requestId = generateRequestId();
  const auth = await authenticateApiRequest(request);

  if (!auth.authenticated) {
    return apiUnauthorized(auth.error || 'Unauthorized', requestId);
  }

  if (!hasScope(auth.scopes!, 'read:jobs')) {
    return apiForbidden('Insufficient permissions — requires read:jobs', requestId);
  }

  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    // Validate query params
    const parsed = JobListQuerySchema.safeParse({
      status: searchParams.get('status') || undefined,
      assigned_to: searchParams.get('assigned_to') || undefined,
      customer_id: searchParams.get('customer_id') || undefined,
      from_date: searchParams.get('from_date') || undefined,
      to_date: searchParams.get('to_date') || undefined,
      limit: searchParams.get('limit') || undefined,
      offset: searchParams.get('offset') || undefined,
    });

    if (!parsed.success) {
      return apiValidationError(parsed.error, requestId);
    }

    const { status, assigned_to, customer_id, from_date, to_date, limit, offset } = parsed.data;

    // Build query
    let query = supabase
      .from('jobs')
      .select(`
        id, title, status, service_type, scheduled_start, scheduled_end,
        total_estimate_cents, total_invoice_cents, paid_cents, internal_notes, created_at, updated_at,
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
    if (assigned_to) query = query.eq('assigned_to', assigned_to);
    if (customer_id) query = query.eq('customer_id', customer_id);
    if (from_date) query = query.gte('scheduled_start', from_date);
    if (to_date) query = query.lte('scheduled_start', to_date);

    const { data: jobs, error, count } = await query;

    if (error) throw error;

    const response = apiSuccess(
      { jobs },
      paginationMeta(count, limit, offset),
      200,
      requestId,
    );

    // Log usage (non-blocking)
    logApiUsage(
      auth.ownerId!,
      auth.ownerId!,
      '/api/v1/jobs',
      'GET',
      200,
      Date.now() - startTime,
      request,
    ).catch(() => {});

    return response;
  } catch (error) {
    return apiInternalError(error, 'Jobs:GET', requestId);
  }
}

// POST /api/v1/jobs - Create a job
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const requestId = generateRequestId();
  const auth = await authenticateApiRequest(request);

  if (!auth.authenticated) {
    return apiUnauthorized(auth.error || 'Unauthorized', requestId);
  }

  if (!hasScope(auth.scopes!, 'write:jobs')) {
    return apiForbidden('Insufficient permissions — requires write:jobs', requestId);
  }

  try {
    const supabase = await createClient();
    const body = await request.json();

    // Validate with Zod schema
    const parsed = JobCreateSchema.safeParse(body);
    if (!parsed.success) {
      return apiValidationError(parsed.error, requestId);
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

    const response = apiSuccess({ job }, undefined, 201, requestId);

    logApiUsage(
      auth.ownerId!,
      auth.ownerId!,
      '/api/v1/jobs',
      'POST',
      201,
      Date.now() - startTime,
      request,
    ).catch(() => {});

    return response;
  } catch (error) {
    return apiInternalError(error, 'Jobs:POST', requestId);
  }
}
