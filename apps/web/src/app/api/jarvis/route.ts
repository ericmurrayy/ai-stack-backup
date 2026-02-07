/**
 * Jarvis Orchestrator API Route
 * ============================
 * Status and control for the multi-agent Jarvis system
 */

import { NextRequest, NextResponse } from 'next/server';
import { jarvisBridge } from '@packages/services/jarvis-bridge';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const includeAll = searchParams.get('full') === 'true';

    if (includeAll) {
      // Return full system status
      const status = await jarvisBridge.getFullSystemStatus();
      return NextResponse.json(status);
    }

    // Return just Jarvis status
    const jarvisStatus = await jarvisBridge.getOrchestratorStatus();
    return NextResponse.json(jarvisStatus);
  } catch (error: any) {
    console.error('Jarvis status error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get Jarvis status' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, taskType, description, target } = body;

    switch (action) {
      case 'delegate':
        if (!taskType || !description) {
          return NextResponse.json(
            { error: 'taskType and description are required' },
            { status: 400 }
          );
        }
        const delegateResult = await jarvisBridge.delegateTask(taskType, description);
        return NextResponse.json(delegateResult);

      case 'health':
        const healthResult = await jarvisBridge.runHealthCheck();
        return NextResponse.json(healthResult);

      case 'memory':
        if (target === 'today') {
          const memories = await jarvisBridge.getTodayMemory();
          return NextResponse.json({ memories });
        }
        const memory = await jarvisBridge.readMemory(target || 'MEMORY.md');
        return NextResponse.json(memory);

      case 'note':
        if (!description) {
          return NextResponse.json(
            { error: 'description is required for notes' },
            { status: 400 }
          );
        }
        const noteResult = await jarvisBridge.appendToMemory(description);
        return NextResponse.json({ success: noteResult });

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error('Jarvis action error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to execute Jarvis action' },
      { status: 500 }
    );
  }
}
