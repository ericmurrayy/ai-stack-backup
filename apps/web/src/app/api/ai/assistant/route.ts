/**
 * AI Assistant API Route
 * =====================
 * Chat endpoint that routes to appropriate AI (local Ollama or Jarvis)
 */

import { NextRequest, NextResponse } from 'next/server';
import { jarvisBridge } from '@packages/services/jarvis-bridge';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

interface ChatRequest {
  message: string;
  sessionId?: string;
  context?: {
    currentPage?: string;
    selectedJobId?: string;
    selectedCustomerId?: string;
  };
}

export async function POST(req: NextRequest) {
  try {
    const body: ChatRequest = await req.json();
    const { message, sessionId, context } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // Get owner ID from session (optional - for logging)
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const ownerId = user?.id;

    // Build context prompt
    let contextPrompt = '';
    if (context?.currentPage) {
      contextPrompt += `User is on page: ${context.currentPage}. `;
    }
    if (context?.selectedJobId) {
      contextPrompt += `Selected job ID: ${context.selectedJobId}. `;
    }
    if (context?.selectedCustomerId) {
      contextPrompt += `Selected customer ID: ${context.selectedCustomerId}. `;
    }

    // Query the assistant
    const result = await jarvisBridge.askAssistant(
      contextPrompt ? `${contextPrompt}\n\nUser: ${message}` : message
    );

    // Log conversation to database (if user is authenticated)
    if (ownerId && sessionId) {
      try {
        // Log user message
        await supabase.from('ai_conversations').insert({
          owner_id: ownerId,
          session_id: sessionId,
          role: 'user',
          content: message,
          source: 'web',
          metadata: context ? { context } : {},
        });

        // Log assistant response
        await supabase.from('ai_conversations').insert({
          owner_id: ownerId,
          session_id: sessionId,
          role: 'assistant',
          content: result.response,
          source: 'web',
          metadata: { source: result.source },
        });
      } catch (logError) {
        // Don't fail the request if logging fails
        console.error('Failed to log conversation:', logError);
      }
    }

    return NextResponse.json({
      response: result.response,
      source: result.source,
      sessionId: sessionId || crypto.randomUUID(),
    });
  } catch (error: any) {
    console.error('AI assistant error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process request' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  // Return assistant status
  try {
    const ollama = await jarvisBridge.checkOllamaStatus();
    const jarvis = await jarvisBridge.getOrchestratorStatus();

    return NextResponse.json({
      status: 'ready',
      ollama: {
        running: ollama.running,
        models: ollama.models,
      },
      jarvis: {
        status: jarvis.orchestrator,
        agents: Object.keys(jarvis.agents).length,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { status: 'error', error: error.message },
      { status: 500 }
    );
  }
}
