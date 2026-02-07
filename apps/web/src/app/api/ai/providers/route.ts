// Murray's FSM - AI Provider Management API
// ==========================================
// Configure and test AI providers

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, apiError, apiSuccess } from '@/lib/auth'
import {
  getAvailableProviders,
  testProvider,
  type AIProvider,
} from '@packages/services/ai-engine'

/**
 * GET /api/ai/providers
 * List available AI providers and their status
 */
export async function GET(request: NextRequest) {
  const { user, response } = await requireAuth(request)
  if (response) return response

  const providers = getAvailableProviders()

  const providerStatus = providers.map(p => ({
    provider: p,
    configured: isConfigured(p),
    model: getDefaultModel(p),
    cost: getCostInfo(p),
  }))

  return apiSuccess({
    providers: providerStatus,
    default: providers[0] || 'ollama',
    totalConfigured: providerStatus.filter(p => p.configured).length,
  })
}

/**
 * POST /api/ai/providers/test
 * Test an AI provider connection
 */
export async function POST(request: NextRequest) {
  const { user, response } = await requireAuth(request)
  if (response) return response

  try {
    const body = await request.json()
    const { provider, model, apiKey, baseUrl } = body

    const result = await testProvider({
      provider: provider as AIProvider,
      model,
      apiKey,
      baseUrl,
    })

    return apiSuccess(result)
  } catch (error) {
    return apiError(
      error instanceof Error ? error.message : 'Test failed',
      500
    )
  }
}

function isConfigured(provider: AIProvider): boolean {
  switch (provider) {
    case 'anthropic':
      return !!process.env.ANTHROPIC_API_KEY
    case 'openai':
      return !!process.env.OPENAI_API_KEY
    case 'ollama':
      return true // Always available locally
    default:
      return false
  }
}

function getDefaultModel(provider: AIProvider): string {
  switch (provider) {
    case 'anthropic':
      return 'claude-sonnet-4-20250514'
    case 'openai':
      return 'gpt-4o'
    case 'ollama':
      return 'llama3.2:latest'
    default:
      return 'unknown'
  }
}

function getCostInfo(provider: AIProvider): string {
  switch (provider) {
    case 'anthropic':
      return '$3/M input, $15/M output tokens'
    case 'openai':
      return '$2.50/M input, $10/M output tokens'
    case 'ollama':
      return 'Free (runs locally)'
    default:
      return 'Varies'
  }
}
