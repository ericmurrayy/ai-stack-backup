// Murray's FSM - Reject Action API
// ===================================

import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { actionId, reason } = await request.json();

    if (!actionId) {
      return NextResponse.json({ error: 'actionId is required' }, { status: 400 });
    }

    const supabase = createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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

    // Write audit log
    await supabase.from('audit_log').insert({
      owner_id: user.id,
      actor: user.id,
      action: 'reject',
      entity_type: 'action',
      entity_id: actionId,
      diff: { reason: reason || 'Rejected by user' },
    });

    return NextResponse.json({ success: true, action: data });
  } catch (error) {
    console.error('Rejection error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
