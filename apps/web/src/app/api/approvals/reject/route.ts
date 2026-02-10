// Murray's FSM - Reject Action API
// ===================================
// Atomically transitions action: pending → rejected
// Event-logged for audit trail.

import { createClient } from '@/lib/supabase/server';
import { logActionEvent } from '@/lib/event-log';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { actionId, reason } = await request.json();

    if (!actionId) {
      return NextResponse.json({ error: 'actionId is required' }, { status: 400 });
    }

    const supabase = await createClient();

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Atomically reject: only pending actions owned by user can transition
    const { data, error } = await supabase
      .from('action_queue')
      .update({
        status: 'rejected',
        error: reason || 'Rejected by user',
      })
      .eq('id', actionId)
      .eq('owner_id', user.id)
      .eq('status', 'pending')
      .select()
      .single();

    if (error) {
      console.error('Error rejecting action:', error);
      return NextResponse.json({ error: 'Failed to reject action' }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Action not found or already processed' }, { status: 404 });
    }

    // Log the rejection event (never throws)
    await logActionEvent(supabase, {
      action_id: actionId,
      owner_id: user.id,
      event_type: 'rejected',
      actor_type: 'user',
      actor_id: user.id,
      old_status: 'pending',
      new_status: 'rejected',
      metadata: { reason: reason || 'Rejected by user' },
    });

    return NextResponse.json({ success: true, action: data });
  } catch (error) {
    console.error('Rejection error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
