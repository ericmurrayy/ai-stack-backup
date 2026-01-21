// Murray's FSM - Webhook Test API
// ================================
// Send a test event to a webhook endpoint

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  createWebhookDispatcher,
  type WebhookEndpoint,
} from '@murray-fsm/services';

// POST /api/webhooks/[webhookId]/test - Send test event
export async function POST(
  request: NextRequest,
  { params }: { params: { webhookId: string } }
) {
  try {
    const supabase = createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get webhook
    const { data: webhook, error } = await supabase
      .from('webhook_endpoints')
      .select('*')
      .eq('id', params.webhookId)
      .eq('deleted', false)
      .single();

    if (error || !webhook) {
      return NextResponse.json({ error: 'Webhook not found' }, { status: 404 });
    }

    // Create dispatcher
    const dispatcher = createWebhookDispatcher({
      timeout: 10000,
      retryAttempts: 1,
    });

    // Send test event
    const testEvent = 'job.created' as const;
    const testData = {
      id: 'test_' + Date.now(),
      type: 'test',
      message: 'This is a test webhook from Murray\'s FSM',
      timestamp: new Date().toISOString(),
    };

    const result = await dispatcher.dispatch(
      webhook as WebhookEndpoint,
      testEvent,
      testData
    );

    // Record delivery
    await supabase.from('webhook_deliveries').insert({
      webhook_id: params.webhookId,
      event: testEvent,
      payload: testData,
      response_status: result.statusCode,
      delivered_at: result.success ? new Date().toISOString() : null,
      error: result.error,
      attempts: 1,
      created_at: new Date().toISOString(),
    });

    // Update last triggered
    await supabase
      .from('webhook_endpoints')
      .update({
        last_triggered_at: new Date().toISOString(),
        failure_count: result.success ? 0 : webhook.failure_count + 1,
      })
      .eq('id', params.webhookId);

    return NextResponse.json({
      success: result.success,
      statusCode: result.statusCode,
      duration: result.duration,
      error: result.error,
    });
  } catch (error) {
    console.error('Error testing webhook:', error);
    return NextResponse.json(
      { error: 'Failed to test webhook' },
      { status: 500 }
    );
  }
}
