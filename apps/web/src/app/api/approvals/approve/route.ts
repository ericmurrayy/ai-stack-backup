// Murray's FSM - Approve Action API
// ====================================
// Atomically transitions action: pending → approved
// Then triggers n8n executor webhook with retry.
// Event-logged for audit trail.

import { createClient } from '@/lib/supabase/server';
import { logActionEvent } from '@/lib/event-log';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { actionId, payloadOverrides } = await request.json();

    if (!actionId) {
      return NextResponse.json({ error: 'actionId is required' }, { status: 400 });
    }

    const supabase = await createClient();

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // If payloadOverrides provided, merge into existing payload before approving
    let mergedPayload: Record<string, unknown> | undefined;
    if (payloadOverrides && typeof payloadOverrides === 'object') {
      const { data: existing } = await supabase
        .from('action_queue')
        .select('payload')
        .eq('id', actionId)
        .eq('owner_id', user.id)
        .eq('status', 'pending')
        .single();

      if (existing) {
        mergedPayload = { ...(existing.payload as Record<string, unknown>), ...payloadOverrides };
      }
    }

    // Atomically approve: only pending actions owned by user can transition
    // The .eq('status', 'pending') acts as an optimistic lock
    const updateData: Record<string, unknown> = {
      status: 'approved',
      approved_at: new Date().toISOString(),
      approved_by: user.id,
    };
    if (mergedPayload) updateData.payload = mergedPayload;

    const { data, error } = await supabase
      .from('action_queue')
      .update(updateData)
      .eq('id', actionId)
      .eq('owner_id', user.id)
      .eq('status', 'pending')
      .select()
      .single();

    if (error) {
      console.error('Error approving action:', error);
      return NextResponse.json({ error: 'Failed to approve action' }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Action not found or already processed' }, { status: 404 });
    }

    // Log the approval event (never throws)
    await logActionEvent(supabase, {
      action_id: actionId,
      owner_id: user.id,
      event_type: 'approved',
      actor_type: 'user',
      actor_id: user.id,
      old_status: 'pending',
      new_status: 'approved',
    });

    // Trigger n8n approval executor webhook with retry
    const n8nWebhookUrl = process.env.N8N_APPROVAL_EXECUTOR_WEBHOOK_URL;
    if (n8nWebhookUrl) {
      const webhookPayload = JSON.stringify({
        action_queue_id: actionId,
        action: data,
      });

      let webhookSuccess = false;
      const maxRetries = 3;
      const backoffMs = [0, 1000, 3000]; // immediate, 1s, 3s

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          if (backoffMs[attempt] > 0) {
            await new Promise(resolve => setTimeout(resolve, backoffMs[attempt]));
          }

          const res = await fetch(n8nWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: webhookPayload,
            signal: AbortSignal.timeout(10000), // 10s timeout per attempt
          });

          if (res.ok) {
            webhookSuccess = true;
            break;
          }

          console.warn(`[Approve] n8n webhook attempt ${attempt + 1} returned ${res.status}`);
        } catch (webhookError) {
          console.error(`[Approve] n8n webhook attempt ${attempt + 1} failed:`, webhookError);
        }
      }

      if (webhookSuccess) {
        // Log successful webhook delivery
        await logActionEvent(supabase, {
          action_id: actionId,
          owner_id: user.id,
          event_type: 'webhook_sent',
          actor_type: 'system',
          metadata: { webhook_url: n8nWebhookUrl },
        });
      } else {
        // Log webhook failure and record on the action
        console.error(`[Approve] All ${maxRetries} n8n webhook attempts failed for action ${actionId}`);

        await logActionEvent(supabase, {
          action_id: actionId,
          owner_id: user.id,
          event_type: 'webhook_failed',
          actor_type: 'system',
          metadata: {
            webhook_url: n8nWebhookUrl,
            attempts: maxRetries,
            error: 'All retry attempts failed',
          },
        });

        await supabase
          .from('action_queue')
          .update({
            error: 'Webhook delivery failed after 3 attempts — needs manual retry',
          })
          .eq('id', actionId);
      }
    }

    return NextResponse.json({ success: true, action: data });
  } catch (error) {
    console.error('Approval error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
