/**
 * Phone API Route
 * ===============
 * Manage AI phone calls via Retell AI
 */

import { NextRequest, NextResponse } from 'next/server';
import { retellService } from '@packages/services/retell';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * GET /api/phone
 * Get phone service status and call history
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
        const stats = await retellService.getCallStats();
        return NextResponse.json(stats);

      case 'history':
        const limit = parseInt(searchParams.get('limit') || '50');
        const history = await retellService.getCallHistory(limit);
        return NextResponse.json({ calls: history });

      default:
        // Return service status
        return NextResponse.json({
          configured: retellService.isConfigured(),
          provider: 'retell',
          features: ['inbound', 'outbound', 'transcription', 'booking'],
        });
    }
  } catch (error: any) {
    console.error('Phone API error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get phone status' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/phone
 * Create outbound call or perform actions
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { action, phoneNumber, callId, customerId, metadata } = body;

    switch (action) {
      case 'call':
        // Create outbound call
        if (!phoneNumber) {
          return NextResponse.json(
            { error: 'phoneNumber is required' },
            { status: 400 }
          );
        }

        const callData = await retellService.createCall({
          toNumber: phoneNumber,
          metadata: {
            customerId,
            initiatedBy: user.id,
            ...metadata,
          },
        });

        return NextResponse.json({
          success: true,
          call: callData,
        });

      case 'status':
        // Get call status
        if (!callId) {
          return NextResponse.json(
            { error: 'callId is required' },
            { status: 400 }
          );
        }

        const status = await retellService.getCall(callId);
        return NextResponse.json(status);

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error('Phone API error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process phone request' },
      { status: 500 }
    );
  }
}
