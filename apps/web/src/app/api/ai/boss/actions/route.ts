/**
 * BOSS Actions API Route
 * ======================
 * View and manage pending AI actions
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'pending';
    const limit = parseInt(searchParams.get('limit') || '20');

    const { data: actions, error } = await supabase
      .from('ai_actions')
      .select('*')
      .eq('owner_id', user.id)
      .eq('status', status)
      .eq('deleted', false)
      .order('priority', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) throw error;

    return NextResponse.json({ actions });
  } catch (error: any) {
    console.error('Get actions error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get actions' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { actionId, operation, reason } = body;

    if (!actionId || !operation) {
      return NextResponse.json(
        { error: 'actionId and operation are required' },
        { status: 400 }
      );
    }

    switch (operation) {
      case 'approve':
        const { error: approveError } = await supabase
          .from('ai_actions')
          .update({
            status: 'approved',
            approved_by: user.id,
            approved_at: new Date().toISOString(),
          })
          .eq('id', actionId)
          .eq('owner_id', user.id)
          .eq('status', 'pending');

        if (approveError) throw approveError;
        return NextResponse.json({ success: true, message: 'Action approved' });

      case 'reject':
        const { error: rejectError } = await supabase
          .from('ai_actions')
          .update({
            status: 'rejected',
            rejected_reason: reason || 'Manually rejected',
          })
          .eq('id', actionId)
          .eq('owner_id', user.id)
          .eq('status', 'pending');

        if (rejectError) throw rejectError;
        return NextResponse.json({ success: true, message: 'Action rejected' });

      default:
        return NextResponse.json(
          { error: `Unknown operation: ${operation}` },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error('Action operation error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process action' },
      { status: 500 }
    );
  }
}
