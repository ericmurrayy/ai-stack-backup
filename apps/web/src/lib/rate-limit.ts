// Murray FSM - Rate Limiting
// ==========================
// Simple in-memory rate limiter with sliding window
// Can be upgraded to Upstash Redis for distributed rate limiting

interface RateLimitConfig {
  maxRequests: number;  // Max requests per window
  windowMs: number;     // Window size in milliseconds
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory store (for single-instance deployment)
// For production at scale, replace with Redis
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup old entries periodically
const CLEANUP_INTERVAL = 60000; // 1 minute
let cleanupTimer: NodeJS.Timeout | null = null;

function startCleanup() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    rateLimitStore.forEach((entry, key) => {
      if (entry.resetAt < now) {
        rateLimitStore.delete(key);
      }
    });
  }, CLEANUP_INTERVAL);
}

// Default configurations for different route types
export const rateLimitConfigs = {
  // Standard API routes
  api: {
    maxRequests: 100,
    windowMs: 60000, // 100 requests per minute
  },
  // Auth routes (stricter to prevent brute force)
  auth: {
    maxRequests: 10,
    windowMs: 60000, // 10 requests per minute
  },
  // Webhook routes (more lenient for integrations)
  webhook: {
    maxRequests: 500,
    windowMs: 60000, // 500 requests per minute
  },
  // Public routes (booking, portal)
  public: {
    maxRequests: 30,
    windowMs: 60000, // 30 requests per minute
  },
  // AI/expensive operations
  ai: {
    maxRequests: 20,
    windowMs: 60000, // 20 requests per minute
  },
} as const;

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
}

/**
 * Check if a request should be rate limited
 * @param identifier - Unique identifier (e.g., IP address, user ID)
 * @param config - Rate limit configuration
 * @returns Rate limit result with headers info
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig = rateLimitConfigs.api
): RateLimitResult {
  startCleanup();
  
  const now = Date.now();
  const key = identifier;
  const entry = rateLimitStore.get(key);

  // First request or window expired
  if (!entry || entry.resetAt < now) {
    const resetAt = now + config.windowMs;
    rateLimitStore.set(key, { count: 1, resetAt });
    return {
      success: true,
      limit: config.maxRequests,
      remaining: config.maxRequests - 1,
      resetAt,
    };
  }

  // Within window
  if (entry.count >= config.maxRequests) {
    return {
      success: false,
      limit: config.maxRequests,
      remaining: 0,
      resetAt: entry.resetAt,
      retryAfter: Math.ceil((entry.resetAt - now) / 1000),
    };
  }

  // Increment count
  entry.count++;
  return {
    success: true,
    limit: config.maxRequests,
    remaining: config.maxRequests - entry.count,
    resetAt: entry.resetAt,
  };
}

/**
 * Get the appropriate rate limit config for a given pathname
 */
export function getRateLimitConfig(pathname: string): RateLimitConfig {
  // Auth routes
  if (pathname.startsWith('/api/auth') || pathname.startsWith('/auth')) {
    return rateLimitConfigs.auth;
  }
  
  // Webhook routes
  if (pathname.startsWith('/api/webhooks') || pathname.startsWith('/api/webhook')) {
    return rateLimitConfigs.webhook;
  }
  
  // Public routes
  if (
    pathname.startsWith('/book') ||
    pathname.startsWith('/portal') ||
    pathname.startsWith('/quote/') ||
    pathname.startsWith('/invoice/') ||
    pathname.startsWith('/survey') ||
    pathname.startsWith('/r/')
  ) {
    return rateLimitConfigs.public;
  }
  
  // AI routes
  if (
    pathname.includes('/ai/') ||
    pathname.includes('/phone/') ||
    pathname.includes('/jarvis')
  ) {
    return rateLimitConfigs.ai;
  }
  
  // Default API routes
  return rateLimitConfigs.api;
}

/**
 * Generate rate limit response headers
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
  };
  
  if (result.retryAfter) {
    headers['Retry-After'] = String(result.retryAfter);
  }
  
  return headers;
}

/**
 * Extract client identifier from request
 * Uses X-Forwarded-For for proxied requests, falls back to connection IP
 */
export function getClientIdentifier(request: Request, userId?: string): string {
  // If authenticated, use user ID for more accurate limiting
  if (userId) {
    return `user:${userId}`;
  }
  
  // Extract IP from headers (for proxied requests)
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    // Take the first IP (client IP)
    const clientIp = forwardedFor.split(',')[0].trim();
    if (clientIp) return `ip:${clientIp}`;
  }
  
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return `ip:${realIp}`;
  
  // Fallback to a hash of user-agent for basic fingerprinting
  const userAgent = request.headers.get('user-agent') || 'unknown';
  return `ua:${simpleHash(userAgent)}`;
}

/**
 * Simple hash function for fingerprinting
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}
