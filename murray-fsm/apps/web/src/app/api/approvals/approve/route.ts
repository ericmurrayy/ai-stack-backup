// Murray's FSM - Approve Action API
// ====================================

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { logAction } from '@/lib/audit-log';

export async function POST(request: NextRequest) {
  try {
    const { actionId } = await request.json();

    if (!actionId) {
      return NextResponse.json({ error: 'actionId is required' }, { status: 400 });
    }

    const supabase = await createClient();

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
      .maybeSingle();

    if (error) {
      console.error('Error approving action:', error);
      return NextResponse.json({ error: 'Failed to approve action' }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Action not found or already processed' }, { status: 404 });
    }

    // Trigger n8n approval executor webhook with HMAC signature
    const n8nWebhookUrl = process.env.N8N_APPROVAL_EXECUTOR_WEBHOOK_URL;
    if (n8nWebhookUrl) {
      try {
        const payload = JSON.stringify({
          action_queue_id: actionId,
          action: data,
          timestamp: Date.now(),
        });

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };

        // Sign the payload if webhook secret is configured
        const webhookSecret = process.env.N8N_WEBHOOK_SECRET;
        if (webhookSecret) {
          const encoder = new TextEncoder();
          const key = await crypto.subtle.importKey(
            'raw',
            encoder.encode(webhookSecret),
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
          );
          const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
          const hexSignature = Array.from(new Uint8Array(signature))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
          headers['X-Webhook-Signature'] = `sha256=${hexSignature}`;
        }

        await fetch(n8nWebhookUrl, {
          method: 'POST',
          headers,
          body: payload,
        });
      } catch (webhookError) {
        console.error('Failed to trigger n8n webhook:', webhookError);
        // Don't fail the request - webhook can be retried
      }
    }

    logAction(request, {
      ownerId: user.id,
      actorId: user.id,
      actorEmail: user.email,
      action: 'approval.approved',
      resourceType: 'action_queue',
      resourceId: actionId,
      metadata: { action_type: data.action_type },
    });

    return NextResponse.json({ success: true, action: data });
  } catch (error) {
    console.error('Approval error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
