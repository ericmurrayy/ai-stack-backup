// Murray's FSM - API Middleware (Auth + Rate Limiting)
// ====================================================
// Combines API key authentication with sliding-window rate limiting.
// Provides both a wrapper pattern (withApiMiddleware) and a standalone
// function (authenticateAndRateLimit) for inline use.

import { NextRequest, NextResponse } from 'next/server';
import {
  authenticateApiRequest,
  logApiUsage,
  type ApiAuthResult,
} from '@/lib/api-auth';
import { hasScope, type ApiKeyScope } from '@murray-fsm/services';
import {
  checkRateLimit,
  rateLimitResponse,
  applyRateLimitHeaders,
  type RateLimitResult,
} from '@/lib/rate-limiter';

/** Default rate limit per minute (used when API key has no custom limit) */
const DEFAULT_RATE_LIMIT_PER_MINUTE = 100;

export interface ApiMiddlewareResult {
  authenticated: boolean;
  auth: ApiAuthResult;
  rateLimit: RateLimitResult;
  error?: NextResponse;
}

/**
 * Perform authentication and rate limiting in a single call.
 *
 * Usage in route handlers (inline pattern):
 *
 * ```ts
 * export async function GET(request: NextRequest) {
 *   const { authenticated, auth, rateLimit, error } = await authenticateAndRateLimit(request);
 *   if (!authenticated) return error!;
 *
 *   // ... handle request ...
 *
 *   const response = NextResponse.json({ success: true, data: ... });
 *   return applyRateLimitHeaders(response, rateLimit);
 * }
 * ```
 */
export async function authenticateAndRateLimit(
  request: NextRequest
): Promise<ApiMiddlewareResult> {
  // Step 1: Authenticate
  const auth = await authenticateApiRequest(request);

  if (!auth.authenticated) {
    const errorResponse = NextResponse.json(
      { error: auth.error, code: 'UNAUTHORIZED' },
      { status: auth.statusCode || 401 }
    );

    return {
      authenticated: false,
      auth,
      rateLimit: { allowed: true, remaining: 0, resetAt: 0, limit: 0 },
      error: errorResponse,
    };
  }

  // Step 2: Determine rate limit for this API key.
  // The api_keys table stores rate_limit_per_minute per key; fall back to default.
  // We use apiKeyId as the rate limit key so each API key has its own bucket.
  const rateLimitPerMinute = auth.rateLimitPerMinute
    ?? DEFAULT_RATE_LIMIT_PER_MINUTE;

  const rateLimitResult = checkRateLimit(auth.apiKeyId!, {
    maxRequests: rateLimitPerMinute,
    windowMs: 60_000,
  });

  if (!rateLimitResult.allowed) {
    return {
      authenticated: true,
      auth,
      rateLimit: rateLimitResult,
      error: rateLimitResponse(rateLimitResult),
    };
  }

  return {
    authenticated: true,
    auth,
    rateLimit: rateLimitResult,
  };
}

/**
 * Higher-order function that wraps an API route handler with authentication,
 * scope checking, and rate limiting.
 *
 * This is a drop-in replacement for the existing `withApiAuth` in api-auth.ts
 * that adds rate limiting and automatic rate limit headers.
 *
 * Usage:
 *
 * ```ts
 * export const GET = withApiMiddleware(
 *   async (request, { auth, rateLimit }) => {
 *     // ... handle request ...
 *     return NextResponse.json({ success: true, data: ... });
 *   },
 *   { requiredScopes: ['read:jobs'] }
 * );
 * ```
 */
export function withApiMiddleware(
  handler: (
    request: NextRequest,
    context: {
      params: Record<string, string>;
      auth: ApiAuthResult;
      rateLimit: RateLimitResult;
    }
  ) => Promise<NextResponse>,
  options?: {
    requiredScopes?: ApiKeyScope[];
  }
) {
  return async (
    request: NextRequest,
    context: { params: Record<string, string> }
  ): Promise<NextResponse> => {
    const startTime = Date.now();

    // Authenticate + rate limit
    const { authenticated, auth, rateLimit, error } =
      await authenticateAndRateLimit(request);

    if (!authenticated || !rateLimit.allowed) {
      return error!;
    }

    // Check required scopes
    if (options?.requiredScopes && auth.scopes) {
      const hasAllScopes = options.requiredScopes.every((scope) =>
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
        return applyRateLimitHeaders(forbidden, rateLimit);
      }
    }

    // Execute the actual handler
    const response = await handler(request, { ...context, auth, rateLimit });

    // Attach rate limit headers to all responses
    applyRateLimitHeaders(response, rateLimit);

    // Log API usage (non-blocking)
    const endpoint = new URL(request.url).pathname;
    logApiUsage(
      auth.apiKeyId!,
      auth.ownerId!,
      endpoint,
      request.method,
      response.status,
      Date.now() - startTime,
      request
    ).catch(() => {
      // Ignore logging errors -- don't fail the request
    });

    return response;
  };
}
