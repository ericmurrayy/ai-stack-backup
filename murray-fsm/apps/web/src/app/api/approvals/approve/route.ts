// Murray's FSM - Approve Action API
// ====================================

import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { actionId } = await request.json();

    if (!actionId) {
      return NextResponse.json({ error: 'actionId is required' }, { status: 400 });
    }

    const supabase = createClient();

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Update action status to approved
    const { data, error } = await supabase
      .from('action_queue')
      .update({
        status: 'approved',
        approved_at: new Date().toISOString(),
        approved_by: user.id,
      })
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

    // Trigger n8n approval executor webhook
    const n8nWebhookUrl = process.env.N8N_APPROVAL_EXECUTOR_WEBHOOK_URL;
    if (n8nWebhookUrl) {
      try {
        await fetch(n8nWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action_queue_id: actionId,
            action: data,
          }),
        });
      } catch (webhookError) {
        console.error('Failed to trigger n8n webhook:', webhookError);
        // Don't fail the request - webhook can be retried
      }
    }

    return NextResponse.json({ success: true, action: data });
  } catch (error) {
    console.error('Approval error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
