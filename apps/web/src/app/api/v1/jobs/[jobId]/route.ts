// Murray's FSM - Single Job API v1
// =================================
// Standardized request/response contracts with Zod validation.

import { NextRequest } from 'next/server';
import { authenticateApiRequest } from '@/lib/api-auth';
import { hasScope } from '@murray-fsm/services';
import { JobUpdateSchema } from '@murray-fsm/shared';
import { createClient } from '@/lib/supabase/server';
import {
  apiSuccess,
  apiUnauthorized,
  apiForbidden,
  apiNotFound,
  apiValidationError,
  apiInternalError,
  generateRequestId,
} from '@/lib/api-response';

// GET /api/v1/jobs/:jobId - Get job details
export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
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

    const { data: job, error } = await supabase
      .from('jobs')
      .select(`
        *,
        customer:customers(id, name, phone, email),
        location:locations(*),
        assigned:team_members(id, full_name, phone, email, color),
        line_items:line_items(*),
        photos:job_photos(id, kind, storage_path, caption, captured_at)
      `)
      .eq('id', params.jobId)
      .eq('owner_id', auth.ownerId)
      .eq('deleted', false)
      .single();

    if (error || !job) {
      return apiNotFound('Job not found', requestId);
    }

    return apiSuccess({ job }, undefined, 200, requestId);
  } catch (error) {
    return apiInternalError(error, 'Jobs:GET/:id', requestId);
  }
}

// PATCH /api/v1/jobs/:jobId - Update job
export async function PATCH(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
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

    // Validate with Zod
    const parsed = JobUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return apiValidationError(parsed.error, requestId);
    }

    // Build update from validated data — only include fields that were provided
    const validated = parsed.data;
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    const allowedFields = [
      'title', 'status', 'service_type', 'scheduled_start', 'scheduled_end',
      'assigned_to', 'internal_notes', 'priority', 'estimated_duration_minutes',
      'actual_duration_minutes', 'customer_rating', 'customer_feedback',
    ] as const;

    for (const field of allowedFields) {
      if ((validated as any)[field] !== undefined) {
        updates[field] = (validated as any)[field];
      }
    }

    const { data: job, error } = await supabase
      .from('jobs')
      .update(updates)
      .eq('id', params.jobId)
      .eq('owner_id', auth.ownerId)
      .eq('deleted', false)
      .select()
      .single();

    if (error || !job) {
      return apiNotFound('Job not found', requestId);
    }

    return apiSuccess({ job }, undefined, 200, requestId);
  } catch (error) {
    return apiInternalError(error, 'Jobs:PATCH/:id', requestId);
  }
}

// DELETE /api/v1/jobs/:jobId - Delete job (soft delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
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

    const { error } = await supabase
      .from('jobs')
      .update({ deleted: true, updated_at: new Date().toISOString() })
      .eq('id', params.jobId)
      .eq('owner_id', auth.ownerId);

    if (error) throw error;

    return apiSuccess({ deleted: true }, undefined, 200, requestId);
  } catch (error) {
    return apiInternalError(error, 'Jobs:DELETE/:id', requestId);
  }
}
