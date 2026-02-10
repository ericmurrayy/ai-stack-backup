// Murray's FSM - Leads API v1
// ============================
// CRUD for sales pipeline leads

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { authenticateApiRequest, logApiUsage } from '@/lib/api-auth';
import { hasScope } from '@murray-fsm/services';

// GET /api/v1/leads - List leads
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const auth = await authenticateApiRequest(request);

  if (!auth.authenticated) {
    return NextResponse.json(
      { error: auth.error, code: 'UNAUTHORIZED' },
      { status: auth.statusCode || 401 }
    );
  }

  if (!hasScope(auth.scopes!, 'read:leads')) {
    return NextResponse.json(
      { error: 'Insufficient permissions', code: 'FORBIDDEN' },
      { status: 403 }
    );
  }

  try {
    const supabase = createClient();
    const { searchParams } = new URL(request.url);

    const stageId = searchParams.get('stage_id');
    const source = searchParams.get('source');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    let query = supabase
      .from('leads')
      .select(`
        id, title, description, source, source_detail,
        estimated_value_cents, probability, score,
        expected_close_date, last_contact_at, next_follow_up_at,
        tags, lost_reason, converted_at, created_at, updated_at,
        customer:customers(id, name, phone, email),
        stage:pipeline_stages(id, name, color, is_won, is_lost),
        assigned:team_members(id, full_name)
      `, { count: 'exact' })
      .eq('owner_id', auth.ownerId)
      .eq('deleted', false)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (stageId) query = query.eq('stage_id', stageId);
    if (source) query = query.eq('source', source);

    const { data: leads, error, count } = await query;

    if (error) throw error;

    const response = NextResponse.json({
      success: true,
      data: { leads, total: count, limit, offset },
    });

    await logApiUsage(auth.ownerId!, auth.ownerId!, '/api/v1/leads', 'GET', 200, Date.now() - startTime, request);
    return response;
  } catch (error) {
    console.error('Leads API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch leads', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

// POST /api/v1/leads - Create a lead
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const auth = await authenticateApiRequest(request);

  if (!auth.authenticated) {
    return NextResponse.json(
      { error: auth.error, code: 'UNAUTHORIZED' },
      { status: auth.statusCode || 401 }
    );
  }

  if (!hasScope(auth.scopes!, 'write:leads')) {
    return NextResponse.json(
      { error: 'Insufficient permissions', code: 'FORBIDDEN' },
      { status: 403 }
    );
  }

  try {
    const supabase = createClient();
    const body = await request.json();

    if (!body.title) {
      return NextResponse.json(
        { error: 'title is required', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    const { data: lead, error } = await supabase
      .from('leads')
      .insert({
        owner_id: auth.ownerId,
        title: body.title,
        description: body.description,
        customer_id: body.customer_id,
        stage_id: body.stage_id,
        assigned_to: body.assigned_to,
        source: body.source || 'manual',
        source_detail: body.source_detail,
        estimated_value_cents: body.estimated_value_cents || 0,
        probability: body.probability || 50,
        expected_close_date: body.expected_close_date,
        tags: body.tags || [],
      })
      .select()
      .single();

    if (error) throw error;

    const response = NextResponse.json({
      success: true,
      data: { lead },
    }, { status: 201 });

    await logApiUsage(auth.ownerId!, auth.ownerId!, '/api/v1/leads', 'POST', 201, Date.now() - startTime, request);
    return response;
  } catch (error) {
    console.error('Create lead error:', error);
    return NextResponse.json(
      { error: 'Failed to create lead', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
