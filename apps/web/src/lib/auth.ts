// Murray's FSM - API Authentication Utility
// ==========================================
// Shared auth wrapper for all API route handlers

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

export interface AuthenticatedUser {
  id: string
  email: string
  role: string
}

export interface AuthResult {
  user: AuthenticatedUser | null
  error: string | null
  status: number
}

/**
 * Authenticate an API request.
 * Checks session cookie, Bearer token, or API key.
 * Returns the authenticated user or an error.
 */
export async function authenticateRequest(
  request: NextRequest
): Promise<AuthResult> {
  // 1. Try session-based auth (cookie)
  try {
    const supabase = createClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (user && !error) {
      return {
        user: {
          id: user.id,
          email: user.email || '',
          role: user.user_metadata?.role || 'owner',
        },
        error: null,
        status: 200,
      }
    }
  } catch {
    // Session auth failed, try other methods
  }

  // 2. Try Bearer token auth
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    try {
      const supabase = createAdminClient()
      const { data: { user }, error } = await supabase.auth.getUser(token)

      if (user && !error) {
        return {
          user: {
            id: user.id,
            email: user.email || '',
            role: user.user_metadata?.role || 'owner',
          },
          error: null,
          status: 200,
        }
      }
    } catch {
      // Token auth failed
    }
  }

  // 3. Try API key auth
  const apiKey = request.headers.get('x-api-key')
  if (apiKey) {
    try {
      const supabase = createAdminClient()
      const { data: keyRecord, error } = await supabase
        .from('api_keys')
        .select('id, user_id, name, scopes, active')
        .eq('key_hash', hashApiKey(apiKey))
        .eq('active', true)
        .single()

      if (keyRecord && !error) {
        // Update last_used_at
        await supabase
          .from('api_keys')
          .update({ last_used_at: new Date().toISOString() })
          .eq('id', keyRecord.id)

        return {
          user: {
            id: keyRecord.user_id,
            email: '',
            role: 'api',
          },
          error: null,
          status: 200,
        }
      }
    } catch {
      // API key auth failed
    }
  }

  return {
    user: null,
    error: 'Authentication required',
    status: 401,
  }
}

/**
 * Require authentication - returns 401 JSON response if not authenticated
 */
export async function requireAuth(request: NextRequest) {
  const result = await authenticateRequest(request)

  if (!result.user) {
    return {
      user: null,
      response: NextResponse.json(
        { error: result.error },
        { status: result.status }
      ),
    }
  }

  return { user: result.user, response: null }
}

/**
 * Hash an API key for secure storage/lookup.
 * Uses SHA-256 — must match packages/services/src/api-keys.ts hashApiKey().
 */
function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex')
}

/**
 * Standard error response format
 */
export function apiError(message: string, status = 400, details?: unknown) {
  const body: Record<string, unknown> = { error: message }
  if (process.env.NODE_ENV === 'development' && details) {
    body.details = details instanceof Error ? details.message : details
  }
  return NextResponse.json(body, { status })
}

/**
 * Standard success response format
 */
export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json(data, { status })
}
