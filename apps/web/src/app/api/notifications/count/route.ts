// Murray's FSM - Notification Count API
// ======================================
// Returns counts for sidebar badges

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = createAdminClient();

    // Fetch counts in parallel
    const [pendingApprovalsResult, missedCallsResult, unreadMessagesResult] = await Promise.all([
      // Pending approvals
      supabase
        .from('action_queue')
        .select('id', { count: 'exact', head: true })
        .eq('deleted', false)
        .eq('status', 'pending'),

      // Missed calls (inbound calls without answered_at in last 24 hours)
      supabase
        .from('call_logs')
        .select('id', { count: 'exact', head: true })
        .eq('deleted', false)
        .eq('direction', 'inbound')
        .is('answered_at', null)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),

      // Unread messages (messages received in last 24 hours - simplified)
      supabase
        .from('message_logs')
        .select('id', { count: 'exact', head: true })
        .eq('deleted', false)
        .eq('direction', 'inbound')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
    ]);

    return NextResponse.json({
      pendingApprovals: pendingApprovalsResult.count || 0,
      missedCalls: missedCallsResult.count || 0,
      unreadMessages: unreadMessagesResult.count || 0,
    });
  } catch (error) {
    console.error('Error fetching notification counts:', error);
    return NextResponse.json({
      pendingApprovals: 0,
      missedCalls: 0,
      unreadMessages: 0,
    });
  }
}
