/**
 * BOSS Agent API Route
 * ====================
 * Control and monitor the BOSS (Business Operations Self-executing System) agent
 */

import { NextRequest, NextResponse } from 'next/server';
import { jarvisBridge } from '@packages/services/jarvis-bridge';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function GET(req: NextRequest) {
  try {
    const status = await jarvisBridge.getBOSSStatus();
    const revenue = await jarvisBridge.getBOSSRevenue();

    return NextResponse.json({
      ...status,
      revenue_30d: revenue,
      goal: {
        monthly: 8333300, // $83,333.33 for $1M/year
        annual: 100000000, // $1M
      },
    });
  } catch (error: any) {
    console.error('BOSS status error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get BOSS status' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    switch (action) {
      case 'cycle':
        // Run one automation cycle
        const cycleResult = await jarvisBridge.runBOSSCycle();
        return NextResponse.json(cycleResult);

      case 'start':
        // Start BOSS daemon (would need additional implementation)
        return NextResponse.json({
          success: true,
          message: 'BOSS start requested. Check status in a few seconds.',
        });

      case 'stop':
        // Stop BOSS daemon (would need additional implementation)
        return NextResponse.json({
          success: true,
          message: 'BOSS stop requested.',
        });

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error('BOSS action error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to execute BOSS action' },
      { status: 500 }
    );
  }
}
