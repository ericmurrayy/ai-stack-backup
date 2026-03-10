// Murray's FSM - Individual Webhook API
// =====================================
// Update, toggle, delete webhooks

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  generateWebhookSecret,
  WEBHOOK_EVENT_DESCRIPTIONS,
  type WebhookEvent,
} from '@murray-fsm/services';

// GET /api/webhooks/[webhookId] - Get webhook details and deliveries
export async function GET(
  request: NextRequest,
  { params }: { params: { webhookId: string } }
) {
  try {
    const supabase = createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get webhook (exclude secret, scoped to owner)
    const { data: webhook, error } = await supabase
      .from('webhook_endpoints')
      .select('id, url, events, description, is_active, failure_count, created_at, updated_at')
      .eq('id', params.webhookId)
      .eq('owner_id', user.id)
      .eq('deleted', false)
      .single();

    if (error || !webhook) {
      return NextResponse.json({ error: 'Webhook not found' }, { status: 404 });
    }

    // Get recent deliveries
    const { data: deliveries } = await supabase
      .from('webhook_deliveries')
      .select('*')
      .eq('webhook_id', params.webhookId)
      .order('created_at', { ascending: false })
      .limit(50);

    return NextResponse.json({
      webhook,
      deliveries: deliveries || [],
    });
  } catch (error) {
    console.error('Error fetching webhook:', error);
    return NextResponse.json(
      { error: 'Failed to fetch webhook' },
      { status: 500 }
    );
  }
}

// PATCH /api/webhooks/[webhookId] - Update webhook
export async function PATCH(
  request: NextRequest,
  { params }: { params: { webhookId: string } }
) {
  try {
    const supabase = createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { url, events, description, is_active, regenerate_secret } = body;

    // Build update object
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (url !== undefined) {
      try {
        new URL(url);
        updates.url = url;
      } catch {
        return NextResponse.json(
          { error: 'Invalid URL format' },
          { status: 400 }
        );
      }
    }

    if (events !== undefined) {
      const validEvents = Object.keys(WEBHOOK_EVENT_DESCRIPTIONS) as WebhookEvent[];
      const invalidEvents = events.filter((e: string) => !validEvents.includes(e as WebhookEvent));
      if (invalidEvents.length > 0) {
        return NextResponse.json(
          { error: `Invalid events: ${invalidEvents.join(', ')}` },
          { status: 400 }
        );
      }
      updates.events = events;
    }

    if (description !== undefined) updates.description = description;
    if (is_active !== undefined) updates.is_active = is_active;

    // Regenerate secret if requested
    let newSecret: string | undefined;
    if (regenerate_secret) {
      newSecret = generateWebhookSecret();
      updates.secret = newSecret;
    }

    const { data, error } = await supabase
      .from('webhook_endpoints')
      .update(updates)
      .eq('id', params.webhookId)
      .eq('owner_id', user.id)
      .eq('deleted', false)
      .select('id, url, events, description, is_active, failure_count, created_at, updated_at')
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      webhook: data,
      ...(newSecret && { secret: newSecret }),
    });
  } catch (error) {
    console.error('Error updating webhook:', error);
    return NextResponse.json(
      { error: 'Failed to update webhook' },
      { status: 500 }
    );
  }
}

// DELETE /api/webhooks/[webhookId] - Delete webhook
export async function DELETE(
  request: NextRequest,
  { params }: { params: { webhookId: string } }
) {
  try {
    const supabase = createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { error } = await supabase
      .from('webhook_endpoints')
      .update({
        deleted: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.webhookId)
      .eq('owner_id', user.id);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: 'Webhook deleted',
    });
  } catch (error) {
    console.error('Error deleting webhook:', error);
    return NextResponse.json(
      { error: 'Failed to delete webhook' },
      { status: 500 }
    );
  }
}
