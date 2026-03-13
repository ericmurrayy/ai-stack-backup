// Murray's FSM - API Authentication Middleware
// =============================================
// Validates API keys and enforces rate limits

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { hashApiKey, hasScope, type ApiKeyScope } from '@murray-fsm/services';
import {
  checkRateLimit,
  rateLimitResponse,
  applyRateLimitHeaders,
  type RateLimitResult,
} from '@/lib/rate-limiter';

/** Default rate limit when API key has no custom limit configured */
const DEFAULT_RATE_LIMIT_PER_MINUTE = 100;

export interface ApiAuthResult {
  authenticated: boolean;
  apiKeyId?: string;
  ownerId?: string;
  scopes?: ApiKeyScope[];
  /** Per-minute rate limit for this API key (from DB or default) */
  rateLimitPerMinute?: number;
  error?: string;
  statusCode?: number;
}

/**
 * Authenticate API request using Bearer token
 */
export async function authenticateApiRequest(
  request: NextRequest
): Promise<ApiAuthResult> {
  const authHeader = request.headers.get('Authorization');

  if (!authHeader) {
    return {
      authenticated: false,
      error: 'Missing Authorization header',
      statusCode: 401,
    };
  }

  // Support both "Bearer token" and just "token" formats
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : authHeader;

  if (!token || !token.startsWith('mfsm_')) {
    return {
      authenticated: false,
      error: 'Invalid API key format',
      statusCode: 401,
    };
  }

  try {
    const supabase = createAdminClient();
    const keyHash = hashApiKey(token);

    // Lookup API key by hash
    const { data: apiKey, error } = await supabase
      .from('api_keys')
      .select('id, owner_id, scopes, rate_limit_per_minute, expires_at, allowed_ips')
      .eq('key_hash', keyHash)
      .eq('deleted', false)
      .eq('is_active', true)
      .single();

    if (error || !apiKey) {
      return {
        authenticated: false,
        error: 'Invalid or revoked API key',
        statusCode: 401,
      };
    }

    // Check expiration
    if (apiKey.expires_at && new Date(apiKey.expires_at) < new Date()) {
      return {
        authenticated: false,
        error: 'API key has expired',
        statusCode: 401,
      };
    }

    // Check IP allowlist (if configured)
    if (apiKey.allowed_ips && apiKey.allowed_ips.length > 0) {
      const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
        || request.headers.get('x-real-ip')
        || 'unknown';

      if (!apiKey.allowed_ips.includes(clientIp)) {
        return {
          authenticated: false,
          error: 'IP address not allowed',
          statusCode: 403,
        };
      }
    }

    // Update last_used_at
    await supabase
      .from('api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', apiKey.id);

    return {
      authenticated: true,
      apiKeyId: apiKey.id,
      ownerId: apiKey.owner_id,
      scopes: apiKey.scopes as ApiKeyScope[],
      rateLimitPerMinute: apiKey.rate_limit_per_minute ?? DEFAULT_RATE_LIMIT_PER_MINUTE,
    };
  } catch (error) {
    console.error('API authentication error:', error);
    return {
      authenticated: false,
      error: 'Authentication failed',
      statusCode: 500,
    };
  }
}

/**
 * Middleware wrapper for API routes requiring authentication.
 * Now includes rate limiting -- checks rate limit after successful auth
 * and attaches X-RateLimit-* headers to all responses.
 */
export function withApiAuth(
  handler: (
    request: NextRequest,
    context: { params: Record<string, string>; auth: ApiAuthResult; rateLimit: RateLimitResult }
  ) => Promise<NextResponse>,
  options?: {
    requiredScopes?: ApiKeyScope[];
  }
) {
  return async (
    request: NextRequest,
    context: { params: Record<string, string> }
  ): Promise<NextResponse> => {
    const auth = await authenticateApiRequest(request);

    if (!auth.authenticated) {
      return NextResponse.json(
        { error: auth.error, code: 'UNAUTHORIZED' },
        { status: auth.statusCode || 401 }
      );
    }

    // Enforce rate limit using the API key's configured limit
    const rateLimitResult = checkRateLimit(auth.apiKeyId!, {
      maxRequests: auth.rateLimitPerMinute ?? DEFAULT_RATE_LIMIT_PER_MINUTE,
      windowMs: 60_000,
    });

    if (!rateLimitResult.allowed) {
      return rateLimitResponse(rateLimitResult);
    }

    // Check required scopes
    if (options?.requiredScopes && auth.scopes) {
      const hasAllScopes = options.requiredScopes.every(scope =>
        hasScope(auth.scopes!, scope)
      );

      if (!hasAllScopes) {
        const forbidden = NextResponse.json(
          {
            error: 'Insufficient permissions',
            code: 'FORBIDDEN',
            required: options.requiredScopes,
          },
          { status: 403 }
        );
        return applyRateLimitHeaders(forbidden, rateLimitResult);
      }
    }

    const response = await handler(request, { ...context, auth, rateLimit: rateLimitResult });

    // Attach rate limit headers to all successful responses
    return applyRateLimitHeaders(response, rateLimitResult);
  };
}

/**
 * Log API usage for analytics
 */
export async function logApiUsage(
  apiKeyId: string,
  ownerId: string,
  endpoint: string,
  method: string,
  statusCode: number,
  responseTimeMs: number,
  request: NextRequest
): Promise<void> {
  try {
    const supabase = createAdminClient();

    await supabase.from('api_key_usage').insert({
      api_key_id: apiKeyId,
      owner_id: ownerId,
      endpoint,
      method,
      status_code: statusCode,
      response_time_ms: responseTimeMs,
      ip_address: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
        || request.headers.get('x-real-ip'),
      user_agent: request.headers.get('user-agent'),
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to log API usage:', error);
  }
}
