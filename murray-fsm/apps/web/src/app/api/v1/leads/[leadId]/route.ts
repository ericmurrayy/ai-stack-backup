// Murray's FSM - Lead Detail API v1
// ==================================
// Update, move, and convert leads

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { authenticateApiRequest, logApiUsage } from '@/lib/api-auth';
import { hasScope } from '@murray-fsm/services';

// GET /api/v1/leads/:leadId
export async function GET(
  request: NextRequest,
  { params }: { params: { leadId: string } }
) {
  const auth = await authenticateApiRequest(request);
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error }, { status: auth.statusCode || 401 });
  }
  if (!hasScope(auth.scopes!, 'read:leads')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = createClient();
  const { data: lead, error } = await supabase
    .from('leads')
    .select(`
      *,
      customer:customers(id, name, phone, email),
      stage:pipeline_stages(id, name, color, is_won, is_lost),
      assigned:team_members(id, full_name)
    `)
    .eq('id', params.leadId)
    .eq('owner_id', auth.ownerId)
    .eq('deleted', false)
    .single();

  if (error || !lead) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: { lead } });
}

// PUT /api/v1/leads/:leadId - Update lead or move stage
export async function PUT(
  request: NextRequest,
  { params }: { params: { leadId: string } }
) {
  const startTime = Date.now();
  const auth = await authenticateApiRequest(request);
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error }, { status: auth.statusCode || 401 });
  }
  if (!hasScope(auth.scopes!, 'write:leads')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const supabase = createClient();
    const body = await request.json();

    const allowedFields = [
      'title', 'description', 'customer_id', 'stage_id', 'assigned_to',
      'source', 'source_detail', 'estimated_value_cents', 'probability',
      'expected_close_date', 'last_contact_at', 'next_follow_up_at',
      'tags', 'lost_reason', 'score',
    ];

    const updates: Record<string, unknown> = {};
    for (const key of allowedFields) {
      if (body[key] !== undefined) {
        updates[key] = body[key];
      }
    }

    // Handle conversion to job
    if (body.convert_to_job && body.customer_id) {
      const { data: job } = await supabase
        .from('jobs')
        .insert({
          owner_id: auth.ownerId,
          customer_id: body.customer_id,
          title: body.title || 'Converted from lead',
          service_type: body.service_type || 'general',
          status: 'scheduled',
          scheduled_start: body.scheduled_start,
          internal_notes: `Converted from lead ${params.leadId}`,
        })
        .select()
        .single();

      if (job) {
        updates.converted_job_id = job.id;
        updates.converted_at = new Date().toISOString();
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const { data: lead, error } = await supabase
      .from('leads')
      .update(updates)
      .eq('id', params.leadId)
      .eq('owner_id', auth.ownerId)
      .select()
      .single();

    if (error) throw error;

    // Log stage change as activity
    if (body.stage_id) {
      await supabase.from('lead_activities').insert({
        owner_id: auth.ownerId,
        lead_id: params.leadId,
        activity_type: 'stage_change',
        description: `Moved to stage`,
        metadata: { new_stage_id: body.stage_id },
      }).catch(() => {}); // Non-critical
    }

    const response = NextResponse.json({ success: true, data: { lead } });
    await logApiUsage(auth.ownerId!, auth.ownerId!, `/api/v1/leads/${params.leadId}`, 'PUT', 200, Date.now() - startTime, request);
    return response;
  } catch (error) {
    console.error('Update lead error:', error);
    return NextResponse.json({ error: 'Failed to update lead' }, { status: 500 });
  }
}

// DELETE /api/v1/leads/:leadId - Soft delete
export async function DELETE(
  request: NextRequest,
  { params }: { params: { leadId: string } }
) {
  const auth = await authenticateApiRequest(request);
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error }, { status: auth.statusCode || 401 });
  }
  if (!hasScope(auth.scopes!, 'write:leads')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = createClient();
  const { error } = await supabase
    .from('leads')
    .update({ deleted: true })
    .eq('id', params.leadId)
    .eq('owner_id', auth.ownerId);

  if (error) {
    return NextResponse.json({ error: 'Failed to delete lead' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
