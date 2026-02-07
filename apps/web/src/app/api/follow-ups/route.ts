/**
 * Follow-Ups API
 * ==============
 * Manage automated follow-ups after job completion
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { z } from 'zod';

export const runtime = 'nodejs';

// Validation schemas
const FollowUpCreateSchema = z.object({
  customer_id: z.string().uuid('Invalid customer ID'),
  job_id: z.string().uuid().optional().nullable(),
  lead_id: z.string().uuid().optional().nullable(),
  type: z.enum(['call', 'email', 'sms', 'visit', 'satisfaction_check', 'review_request', 'survey', 'maintenance_reminder', 'upsell']),
  channel: z.enum(['email', 'sms', 'both']).default('email'),
  scheduled_at: z.string().datetime(),
  assigned_to: z.string().uuid().optional().nullable(),
  subject: z.string().max(200).optional().nullable(),
  message: z.string().max(5000).optional().nullable(),
  template_id: z.string().max(100).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  priority: z.coerce.number().int().min(0).max(10).default(0),
});

const FollowUpUpdateSchema = z.object({
  id: z.string().uuid('Invalid follow-up ID'),
  status: z.enum(['scheduled', 'sent', 'completed', 'cancelled', 'skipped', 'rescheduled']).optional(),
  scheduled_at: z.string().datetime().optional(),
  completed_at: z.string().datetime().optional().nullable(),
  outcome: z.string().max(1000).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

const FollowUpQuerySchema = z.object({
  status: z.string().optional(),
  type: z.string().optional(),
  customer_id: z.string().uuid().optional(),
  job_id: z.string().uuid().optional(),
  rules: z.enum(['true', 'false']).optional(),
  stats: z.enum(['true', 'false']).optional(),
});

// Default follow-up rules (would come from business_settings in production)
const DEFAULT_RULES = [
  {
    id: 'satisfaction-24h',
    name: '24-Hour Satisfaction Check',
    type: 'satisfaction_check',
    channel: 'email',
    delay_days: 1,
    is_active: true,
  },
  {
    id: 'review-request-3d',
    name: '3-Day Review Request',
    type: 'review_request',
    channel: 'email',
    delay_days: 3,
    is_active: true,
  },
  {
    id: 'survey-7d',
    name: '7-Day Survey',
    type: 'survey',
    channel: 'email',
    delay_days: 7,
    is_active: true,
  },
  {
    id: 'maintenance-90d',
    name: '90-Day Maintenance Reminder',
    type: 'maintenance_reminder',
    channel: 'both',
    delay_days: 90,
    is_active: true,
  },
];

/**
 * GET /api/follow-ups
 * Get follow-ups or rules
 */
export async function GET(req: NextRequest) {
  const supabase = createAdminClient();
  const { searchParams } = new URL(req.url);

  // Validate query params
  const queryResult = FollowUpQuerySchema.safeParse({
    status: searchParams.get('status') || undefined,
    type: searchParams.get('type') || undefined,
    customer_id: searchParams.get('customer_id') || undefined,
    job_id: searchParams.get('job_id') || undefined,
    rules: searchParams.get('rules') || undefined,
    stats: searchParams.get('stats') || undefined,
  });

  if (!queryResult.success) {
    return NextResponse.json(
      { error: 'Invalid parameters', details: queryResult.error.flatten() },
      { status: 400 }
    );
  }

  const { status, type, customer_id, job_id, rules, stats } = queryResult.data;

  // Return rules if requested
  if (rules === 'true') {
    return NextResponse.json({ rules: DEFAULT_RULES });
  }

  // Return stats if requested
  if (stats === 'true') {
    try {
      const { data } = await supabase
        .from('follow_ups')
        .select('status, email_opened, link_clicked')
        .eq('deleted', false);

      const followUps = data || [];
      const sent = followUps.filter(f => f.status === 'sent' || f.status === 'completed');
      const opened = sent.filter(f => f.email_opened);
      const clicked = sent.filter(f => f.link_clicked);

      return NextResponse.json({
        stats: {
          total: followUps.length,
          scheduled: followUps.filter(f => f.status === 'scheduled').length,
          sent: sent.length,
          completed: followUps.filter(f => f.status === 'completed').length,
          cancelled: followUps.filter(f => f.status === 'cancelled').length,
          openRate: sent.length > 0 ? Math.round((opened.length / sent.length) * 100) : 0,
          clickRate: sent.length > 0 ? Math.round((clicked.length / sent.length) * 100) : 0,
        },
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[FollowUps API] Stats error:', errorMessage);
      return NextResponse.json(
        { error: 'Failed to fetch stats', message: errorMessage },
        { status: 500 }
      );
    }
  }

  try {
    let query = supabase
      .from('follow_ups')
      .select(`
        *,
        customers(name, email, phone),
        jobs(title),
        team_members(full_name)
      `)
      .eq('deleted', false)
      .order('scheduled_at', { ascending: true });

    if (status) {
      query = query.eq('status', status);
    }
    if (type) {
      query = query.eq('type', type);
    }
    if (customer_id) {
      query = query.eq('customer_id', customer_id);
    }
    if (job_id) {
      query = query.eq('job_id', job_id);
    }

    const { data: followUps, error } = await query.limit(50);

    if (error) throw error;

    // Transform to include related data
    const transformedFollowUps = (followUps || []).map(f => ({
      ...f,
      customer_name: (f.customers as any)?.name || null,
      customer_email: (f.customers as any)?.email || null,
      customer_phone: (f.customers as any)?.phone || null,
      job_title: (f.jobs as any)?.title || null,
      assigned_to_name: (f.team_members as any)?.full_name || null,
      customers: undefined,
      jobs: undefined,
      team_members: undefined,
    }));

    return NextResponse.json({ followUps: transformedFollowUps });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[FollowUps API] Error:', errorMessage);
    return NextResponse.json(
      { error: 'Failed to fetch follow-ups', message: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * POST /api/follow-ups
 * Schedule follow-ups for a job
 */
export async function POST(req: NextRequest) {
  const supabase = createAdminClient();

  try {
    const body = await req.json();

    // Validate input
    const parseResult = FollowUpCreateSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const validatedData = parseResult.data;

    const { data, error } = await supabase
      .from('follow_ups')
      .insert({
        ...validatedData,
        status: 'scheduled',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, id: data.id }, { status: 201 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[FollowUps API] Create error:', errorMessage);
    return NextResponse.json(
      { error: 'Failed to schedule follow-up', message: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/follow-ups
 * Update a follow-up
 */
export async function PATCH(req: NextRequest) {
  const supabase = createAdminClient();

  try {
    const body = await req.json();

    // Validate input
    const parseResult = FollowUpUpdateSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { id, ...updates } = parseResult.data;

    // Add sent_at timestamp if marking as sent
    const updateData: Record<string, unknown> = {
      ...updates,
      updated_at: new Date().toISOString(),
    };

    if (updates.status === 'sent' && !body.sent_at) {
      updateData.sent_at = new Date().toISOString();
    }
    if (updates.status === 'completed' && !updates.completed_at) {
      updateData.completed_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from('follow_ups')
      .update(updateData)
      .eq('id', id)
      .eq('deleted', false);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[FollowUps API] Update error:', errorMessage);
    return NextResponse.json(
      { error: 'Failed to update follow-up', message: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/follow-ups
 * Cancel a follow-up
 */
export async function DELETE(req: NextRequest) {
  const supabase = createAdminClient();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Follow-up ID is required' }, { status: 400 });
  }

  const uuidResult = z.string().uuid().safeParse(id);
  if (!uuidResult.success) {
    return NextResponse.json({ error: 'Invalid follow-up ID format' }, { status: 400 });
  }

  try {
    const { error } = await supabase
      .from('follow_ups')
      .update({
        status: 'cancelled',
        deleted: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[FollowUps API] Delete error:', errorMessage);
    return NextResponse.json(
      { error: 'Failed to cancel follow-up', message: errorMessage },
      { status: 500 }
    );
  }
}
