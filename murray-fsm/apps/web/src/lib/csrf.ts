// Murray's FSM - CSRF Protection
// ================================
// Double-submit cookie pattern for mutation endpoints.
// A random token is set in a cookie on page load (via middleware)
// and must be echoed back in the X-CSRF-Token header on POST/PUT/PATCH/DELETE.

import { NextRequest, NextResponse } from 'next/server';

const CSRF_COOKIE = 'csrf_token';
const CSRF_HEADER = 'x-csrf-token';
const TOKEN_LENGTH = 32; // 256 bits

/**
 * Generate a cryptographically random hex token using the Web Crypto API
 * (compatible with both Edge Runtime and Node.js).
 */
function generateToken(length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Generate a new CSRF token and set it as an HttpOnly cookie on the response.
 * Call this from middleware on GET requests so the cookie is available for
 * subsequent mutations.
 */
export function setCsrfCookie(response: NextResponse): string {
  const token = generateToken(TOKEN_LENGTH);

  response.cookies.set(CSRF_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24, // 24 hours
  });

  return token;
}

/**
 * Validate a CSRF token from the request. Returns true if valid.
 *
 * Skips validation for:
 * - GET / HEAD / OPTIONS requests (safe methods)
 * - Requests with a valid API key (external API clients use bearer tokens)
 * - Requests from the mobile app (identified by x-app-platform header)
 */
export function validateCsrf(request: NextRequest): boolean {
  // Safe methods don't need CSRF protection
  const method = request.method.toUpperCase();
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    return true;
  }

  // API key authenticated requests skip CSRF (they use bearer auth)
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer mfsm_')) {
    return true;
  }

  // Mobile app requests skip CSRF
  if (request.headers.get('x-app-platform')) {
    return true;
  }

  // Double-submit check: cookie value must match header value
  const cookieToken = request.cookies.get(CSRF_COOKIE)?.value;
  const headerToken = request.headers.get(CSRF_HEADER);

  if (!cookieToken || !headerToken) {
    return false;
  }

  // Constant-time comparison to prevent timing attacks
  return timingSafeEqual(cookieToken, headerToken);
}

/**
 * Return a 403 JSON response for CSRF failures.
 */
export function csrfErrorResponse(): NextResponse {
  return NextResponse.json(
    { error: 'CSRF token missing or invalid', code: 'CSRF_INVALID' },
    { status: 403 }
  );
}

/**
 * Constant-time string comparison.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
