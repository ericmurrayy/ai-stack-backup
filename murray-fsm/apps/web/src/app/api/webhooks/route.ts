// Murray's FSM - Webhooks API
// ============================
// Manage outgoing webhook endpoints

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  generateWebhookSecret,
  WEBHOOK_EVENT_DESCRIPTIONS,
  WEBHOOK_EVENT_CATEGORIES,
  type WebhookEvent,
} from '@murray-fsm/services';

// GET /api/webhooks - List all webhook endpoints
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: webhooks, error } = await supabase
      .from('webhook_endpoints')
      .select('*')
      .eq('deleted', false)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({
      webhooks: webhooks || [],
      eventDescriptions: WEBHOOK_EVENT_DESCRIPTIONS,
      eventCategories: WEBHOOK_EVENT_CATEGORIES,
    });
  } catch (error) {
    console.error('Error fetching webhooks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch webhooks' },
      { status: 500 }
    );
  }
}

// POST /api/webhooks - Create a new webhook endpoint
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { url, events, description } = body;

    // Validate URL
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      );
    }

    // Validate events
    const validEvents = Object.keys(WEBHOOK_EVENT_DESCRIPTIONS) as WebhookEvent[];
    const invalidEvents = events.filter((e: string) => !validEvents.includes(e as WebhookEvent));
    if (invalidEvents.length > 0) {
      return NextResponse.json(
        { error: `Invalid events: ${invalidEvents.join(', ')}` },
        { status: 400 }
      );
    }

    // Generate secret
    const secret = generateWebhookSecret();

    const { data, error } = await supabase
      .from('webhook_endpoints')
      .insert({
        url,
        secret,
        events,
        description,
        is_active: true,
        failure_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      webhook: data,
      // Only show secret once on creation
      secret,
    });
  } catch (error) {
    console.error('Error creating webhook:', error);
    return NextResponse.json(
      { error: 'Failed to create webhook' },
      { status: 500 }
    );
  }
}
