/**
 * Reviews API Route
 * =================
 * Manage review requests
 */

import { NextRequest, NextResponse } from 'next/server';
import { reviewService } from '@packages/services/reviews';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * GET /api/reviews
 * Get review requests or stats
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');

    switch (action) {
      case 'stats':
        const stats = await reviewService.getStats();
        return NextResponse.json(stats);

      case 'pending':
        const pending = await reviewService.getPendingRequests();
        return NextResponse.json({ requests: pending });

      default:
        // List all requests
        const status = searchParams.get('status');
        const limit = parseInt(searchParams.get('limit') || '50');

        let query = supabase
          .from('review_requests')
          .select(`
            *,
            job:jobs(title, completed_at)
          `)
          .order('created_at', { ascending: false })
          .limit(limit);

        if (status) {
          query = query.eq('status', status);
        }

        const { data: requests, error } = await query;
        if (error) throw error;

        return NextResponse.json({ requests });
    }
  } catch (error: any) {
    console.error('Reviews API error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get reviews' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/reviews
 * Create or send review requests
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { action, jobId, requestId, message } = body;

    switch (action) {
      case 'create':
        // Create review request for job
        if (!jobId) {
          return NextResponse.json(
            { error: 'jobId is required' },
            { status: 400 }
          );
        }

        const request = await reviewService.createRequest(jobId);
        if (!request) {
          return NextResponse.json(
            { error: 'Could not create review request' },
            { status: 400 }
          );
        }

        return NextResponse.json({ success: true, request });

      case 'send':
        // Send review request
        if (!requestId) {
          return NextResponse.json(
            { error: 'requestId is required' },
            { status: 400 }
          );
        }

        const sent = await reviewService.sendRequest(requestId, message);
        return NextResponse.json({ success: sent });

      case 'mark-reviewed':
        // Mark as reviewed
        if (!requestId) {
          return NextResponse.json(
            { error: 'requestId is required' },
            { status: 400 }
          );
        }

        await reviewService.markReviewed(requestId);
        return NextResponse.json({ success: true });

      case 'send-follow-ups':
        // Send follow-up reminders
        const followUpResult = await reviewService.sendFollowUps();
        return NextResponse.json({ success: true, ...followUpResult });

      case 'process-completed':
        // Process all completed jobs
        const processResult = await reviewService.processCompletedJobs();
        return NextResponse.json({ success: true, ...processResult });

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error('Reviews API error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process review request' },
      { status: 500 }
    );
  }
}
