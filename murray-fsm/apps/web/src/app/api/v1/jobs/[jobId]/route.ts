// Murray's FSM - Single Job API v1
// =================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { authenticateAndRateLimit } from '@/lib/api-middleware';
import { applyRateLimitHeaders } from '@/lib/rate-limiter';
import { hasScope } from '@murray-fsm/services';
import { z } from 'zod';
import { validateBody, validateUUID, isoDateString, uuidString, JOB_STATUSES } from '@/lib/api-validation';
import { dispatchWebhookEvent } from '@/lib/webhook-dispatch';

// --- Zod Schemas ---

const updateJobBodySchema = z.object({
  title: z.string().min(1).max(500).optional(),
  status: z.enum(JOB_STATUSES).optional(),
  service_type: z.string().max(200).optional(),
  scheduled_start: isoDateString.optional(),
  scheduled_end: isoDateString.optional(),
  assigned_to: uuidString.optional(),
  internal_notes: z.string().max(5000).optional(),
  priority: z.number().int().min(0).max(10).optional(),
  estimated_duration_minutes: z.number().int().positive().optional(),
  actual_duration_minutes: z.number().int().nonnegative().optional(),
  customer_rating: z.number().int().min(1).max(5).optional(),
  customer_feedback: z.string().max(2000).optional(),
}).strict({ message: 'Unknown fields are not allowed' });

// GET /api/v1/jobs/:jobId - Get job details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { authenticated, auth, rateLimit, error: authError } = await authenticateAndRateLimit(request);

  if (!authenticated || !rateLimit.allowed) return authError!;

  if (!hasScope(auth.scopes!, 'read:jobs')) {
    return applyRateLimitHeaders(
      NextResponse.json(
        { error: 'Insufficient permissions', code: 'FORBIDDEN' },
        { status: 403 }
      ),
      rateLimit
    );
  }

  // Validate jobId is a UUID
  const jobIdResult = validateUUID((await params).jobId, 'jobId');
  if (!jobIdResult.success) return jobIdResult.response;

  try {
    const supabase = await createClient();

    const { data: job, error } = await supabase
      .from('jobs')
      .select(`
        *,
        customer:customers(id, name, phone, email),
        location:locations(*),
        assigned:technicians(id, name, phone, email, color),
        line_items:line_items(*),
        photos:job_photos(id, url, caption, taken_at)
      `)
      .eq('id', (await params).jobId)
      .eq('owner_id', auth.ownerId)
      .eq('deleted', false)
      .single();

    if (error || !job) {
      return applyRateLimitHeaders(
        NextResponse.json(
          { error: 'Job not found', code: 'NOT_FOUND' },
          { status: 404 }
        ),
        rateLimit
      );
    }

    return applyRateLimitHeaders(
      NextResponse.json({
        success: true,
        data: { job },
      }),
      rateLimit
    );
  } catch (error) {
    console.error('Get job error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch job', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

// PATCH /api/v1/jobs/:jobId - Update job
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { authenticated, auth, rateLimit, error: authError } = await authenticateAndRateLimit(request);

  if (!authenticated || !rateLimit.allowed) return authError!;

  if (!hasScope(auth.scopes!, 'write:jobs')) {
    return applyRateLimitHeaders(
      NextResponse.json(
        { error: 'Insufficient permissions', code: 'FORBIDDEN' },
        { status: 403 }
      ),
      rateLimit
    );
  }

  // Validate jobId is a UUID
  const patchJobIdResult = validateUUID((await params).jobId, 'jobId');
  if (!patchJobIdResult.success) return patchJobIdResult.response;

  try {
    const supabase = await createClient();
    const body = await request.json();

    // Validate update fields against allowed list with proper types
    const bodyResult = validateBody(updateJobBodySchema, body);
    if (!bodyResult.success) return bodyResult.response;

    const validated = bodyResult.data;

    // Build update object (only include fields that were provided)
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    for (const [field, value] of Object.entries(validated)) {
      if (value !== undefined) {
        updates[field] = value;
      }
    }

    const { data: job, error } = await supabase
      .from('jobs')
      .update(updates)
      .eq('id', (await params).jobId)
      .eq('owner_id', auth.ownerId)
      .eq('deleted', false)
      .select()
      .single();

    if (error) {
      return applyRateLimitHeaders(
        NextResponse.json(
          { error: 'Job not found', code: 'NOT_FOUND' },
          { status: 404 }
        ),
        rateLimit
      );
    }

    // Fire-and-forget: notify webhook subscribers
    dispatchWebhookEvent(auth.ownerId!, 'job.updated', { job });

    // Fire additional status-specific events
    if (validated.status === 'completed') {
      dispatchWebhookEvent(auth.ownerId!, 'job.completed', { job });
    } else if (validated.status === 'cancelled') {
      dispatchWebhookEvent(auth.ownerId!, 'job.cancelled', { job });
    }

    return applyRateLimitHeaders(
      NextResponse.json({
        success: true,
        data: { job },
      }),
      rateLimit
    );
  } catch (error) {
    console.error('Update job error:', error);
    return NextResponse.json(
      { error: 'Failed to update job', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

// DELETE /api/v1/jobs/:jobId - Delete job (soft delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { authenticated, auth, rateLimit, error: authError } = await authenticateAndRateLimit(request);

  if (!authenticated || !rateLimit.allowed) return authError!;

  if (!hasScope(auth.scopes!, 'write:jobs')) {
    return applyRateLimitHeaders(
      NextResponse.json(
        { error: 'Insufficient permissions', code: 'FORBIDDEN' },
        { status: 403 }
      ),
      rateLimit
    );
  }

  // Validate jobId is a UUID
  const deleteJobIdResult = validateUUID((await params).jobId, 'jobId');
  if (!deleteJobIdResult.success) return deleteJobIdResult.response;

  try {
    const supabase = await createClient();

    const { error } = await supabase
      .from('jobs')
      .update({ deleted: true, updated_at: new Date().toISOString() })
      .eq('id', (await params).jobId)
      .eq('owner_id', auth.ownerId);

    if (error) throw error;

    return applyRateLimitHeaders(
      NextResponse.json({
        success: true,
        message: 'Job deleted',
      }),
      rateLimit
    );
  } catch (error) {
    console.error('Delete job error:', error);
    return NextResponse.json(
      { error: 'Failed to delete job', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
