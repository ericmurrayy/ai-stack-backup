// Murray's FSM - In-Memory Sliding Window Rate Limiter
// =====================================================
// Enforces per-key request rate limits using a sliding window algorithm.
//
// NOTE: This is an in-memory rate limiter suitable for single-instance deployments.
// For multi-instance deployments (e.g., behind a load balancer), replace this with
// a distributed store such as Upstash Redis (@upstash/ratelimit) to ensure rate
// limits are enforced consistently across all instances.

import { NextResponse } from 'next/server';

export interface RateLimitConfig {
  /** Maximum number of requests allowed within the window. Default: 100 */
  maxRequests: number;
  /** Window size in milliseconds. Default: 60_000 (1 minute) */
  windowMs: number;
}

export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Number of requests remaining in the current window */
  remaining: number;
  /** Unix timestamp (seconds) when the window resets */
  resetAt: number;
  /** The configured limit for this window */
  limit: number;
}

/** Default rate limit: 100 requests per minute */
const DEFAULT_CONFIG: RateLimitConfig = {
  maxRequests: 100,
  windowMs: 60_000,
};

/** Interval for cleaning up expired entries (5 minutes) */
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Sliding window rate limiter store.
 * Maps each key (API key ID or IP address) to an array of request timestamps.
 */
const store = new Map<string, number[]>();

/** Tracks when the last cleanup ran */
let lastCleanup = Date.now();

/**
 * Remove expired entries from the store to prevent memory leaks.
 * Runs at most once every CLEANUP_INTERVAL_MS.
 */
function cleanupExpiredEntries(windowMs: number): void {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;

  lastCleanup = now;
  const cutoff = now - windowMs;

  for (const [key, timestamps] of store.entries()) {
    const valid = timestamps.filter((t) => t > cutoff);
    if (valid.length === 0) {
      store.delete(key);
    } else {
      store.set(key, valid);
    }
  }
}

/**
 * Check whether a request from the given key is allowed under the rate limit.
 *
 * @param key - Unique identifier for the client (API key ID, IP address, etc.)
 * @param config - Optional rate limit configuration overrides
 * @returns RateLimitResult with allowed status, remaining count, and reset time
 */
export function checkRateLimit(
  key: string,
  config?: Partial<RateLimitConfig>
): RateLimitResult {
  const { maxRequests, windowMs } = { ...DEFAULT_CONFIG, ...config };
  const now = Date.now();
  const windowStart = now - windowMs;

  // Run periodic cleanup
  cleanupExpiredEntries(windowMs);

  // Get existing timestamps and filter to current window
  const timestamps = store.get(key) || [];
  const validTimestamps = timestamps.filter((t) => t > windowStart);

  // Calculate reset time: when the earliest request in the window expires
  const resetAt = validTimestamps.length > 0
    ? Math.ceil((validTimestamps[0] + windowMs) / 1000)
    : Math.ceil((now + windowMs) / 1000);

  if (validTimestamps.length >= maxRequests) {
    // Rate limit exceeded -- do NOT record this request
    store.set(key, validTimestamps);

    return {
      allowed: false,
      remaining: 0,
      resetAt,
      limit: maxRequests,
    };
  }

  // Request is allowed -- record timestamp
  validTimestamps.push(now);
  store.set(key, validTimestamps);

  return {
    allowed: true,
    remaining: maxRequests - validTimestamps.length,
    resetAt,
    limit: maxRequests,
  };
}

/**
 * Build a 429 Too Many Requests response with standard rate limit headers.
 *
 * @param result - The rate limit check result
 * @returns NextResponse with 429 status, Retry-After header, and rate limit info
 */
export function rateLimitResponse(result: RateLimitResult): NextResponse {
  const retryAfterSeconds = Math.max(1, result.resetAt - Math.ceil(Date.now() / 1000));

  return NextResponse.json(
    {
      error: 'Rate limit exceeded',
      code: 'RATE_LIMITED',
      retryAfter: retryAfterSeconds,
      limit: result.limit,
      resetAt: new Date(result.resetAt * 1000).toISOString(),
    },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfterSeconds),
        'X-RateLimit-Limit': String(result.limit),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(result.resetAt),
      },
    }
  );
}

/**
 * Apply standard rate limit headers to an existing response.
 *
 * @param response - The response to add headers to
 * @param result - The rate limit check result
 * @returns The same response with rate limit headers added
 */
export function applyRateLimitHeaders(
  response: NextResponse,
  result: RateLimitResult
): NextResponse {
  response.headers.set('X-RateLimit-Limit', String(result.limit));
  response.headers.set('X-RateLimit-Remaining', String(result.remaining));
  response.headers.set('X-RateLimit-Reset', String(result.resetAt));
  return response;
}

/**
 * Get the current number of tracked keys (for monitoring/debugging).
 */
export function getRateLimitStoreSize(): number {
  return store.size;
}
