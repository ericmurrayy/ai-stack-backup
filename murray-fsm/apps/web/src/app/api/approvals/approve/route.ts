// Murray's FSM - Approve Action API
// ====================================
// Approves an action and triggers execution via the action-queue service.
// Supports optional payload overrides (edit-and-approve).

import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { actionId, payloadOverrides } = await request.json();

    if (!actionId) {
      return NextResponse.json({ error: 'actionId is required' }, { status: 400 });
    }

    const supabase = createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch the action to validate ownership and status
    const { data: action, error: fetchError } = await supabase
      .from('action_queue')
      .select('*')
      .eq('id', actionId)
      .eq('owner_id', user.id)
      .single();

    if (fetchError || !action) {
      return NextResponse.json({ error: 'Action not found' }, { status: 404 });
    }

    if (action.status !== 'pending') {
      return NextResponse.json(
        { error: `Cannot approve action in '${action.status}' status` },
        { status: 400 }
      );
    }

    // Merge payload overrides if provided (edit-and-approve)
    const updatedPayload = payloadOverrides
      ? { ...action.payload, ...payloadOverrides }
      : action.payload;

    // Update to approved
    const { data: approved, error: updateError } = await supabase
      .from('action_queue')
      .update({
        status: 'approved',
        approved_at: new Date().toISOString(),
        approved_by: user.id,
        payload: updatedPayload,
      })
      .eq('id', actionId)
      .eq('owner_id', user.id)
      .select()
      .single();

    if (updateError) {
      console.error('Error approving action:', updateError);
      return NextResponse.json({ error: 'Failed to approve action' }, { status: 500 });
    }

    // Write audit log
    await supabase.from('audit_log').insert({
      owner_id: user.id,
      actor: user.id,
      action: 'approve',
      entity_type: 'action',
      entity_id: actionId,
      diff: {
        before: { status: 'pending', payload: action.payload },
        after: { status: 'approved', payload: updatedPayload },
      },
    });

    // Trigger n8n approval executor webhook for action types without built-in executors
    const n8nWebhookUrl = process.env.N8N_APPROVAL_EXECUTOR_WEBHOOK_URL;
    if (n8nWebhookUrl) {
      try {
        await fetch(n8nWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action_queue_id: actionId,
            action: approved,
          }),
        });
      } catch (webhookError) {
        console.error('Failed to trigger n8n webhook:', webhookError);
      }
    }

    return NextResponse.json({ success: true, action: approved });
  } catch (error) {
    console.error('Approval error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
