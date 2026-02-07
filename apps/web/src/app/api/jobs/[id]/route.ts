// Murray's FSM - Job Detail API
// ==============================
// Schema: supabase/schema.sql — jobs table

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

interface RouteParams {
  params: { id: string };
}

// GET /api/jobs/[id] - Get single job with related data
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = createAdminClient();

    const { data: job, error } = await supabase
      .from('jobs')
      .select(`
        *,
        customers(id, name, phone, email),
        locations(id, address1, city, state, postal_code),
        line_items(id, kind, name, description, qty, unit_price_cents, total_cents, sort_order),
        payments(id, amount_cents, status, provider, created_at)
      `)
      .eq('id', params.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Job not found' }, { status: 404 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(job);
  } catch (error: unknown) {
    console.error('Job GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch job' }, { status: 500 });
  }
}

// PATCH /api/jobs/[id] - Update job
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = createAdminClient();
    const body = await request.json();

    // Only allow fields that actually exist in the jobs table
    const updates: Record<string, unknown> = {};
    const allowedFields = [
      'title', 'service_type', 'problem_description', 'status',
      'scheduled_start', 'scheduled_end', 'arrived_at', 'started_at', 'completed_at',
      'internal_notes', 'customer_notes', 'diagnostics',
      'customer_id', 'location_id',
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    // Validate status if provided
    if (updates.status) {
      const validStatuses = ['scheduled', 'in_progress', 'completed', 'canceled'];
      if (!validStatuses.includes(updates.status as string)) {
        return NextResponse.json(
          { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
          { status: 400 }
        );
      }
    }

    // Auto-set completed_at when marking as completed
    if (body.status === 'completed' && !body.completed_at) {
      updates.completed_at = new Date().toISOString();
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    const { data: job, error } = await supabase
      .from('jobs')
      .update(updates)
      .eq('id', params.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating job:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(job);
  } catch (error: unknown) {
    console.error('Job PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update job' }, { status: 500 });
  }
}

// DELETE /api/jobs/[id] - Soft delete job
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = createAdminClient();

    // Soft delete using the schema's `deleted` boolean column
    const { error } = await supabase
      .from('jobs')
      .update({ deleted: true })
      .eq('id', params.id);

    if (error) {
      console.error('Error deleting job:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Job DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete job' }, { status: 500 });
  }
}
