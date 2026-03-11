// Murray's FSM - CSRF Client Helper
// ===================================
// Read the CSRF token from the cookie and attach it to fetch requests.
// Used by client-side components that call internal API routes.

'use client';

const CSRF_COOKIE = 'csrf_token';
const CSRF_HEADER = 'x-csrf-token';

/**
 * Read the CSRF token from the cookie.
 */
function getCsrfToken(): string | null {
  if (typeof document === 'undefined') return null;

  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${CSRF_COOKIE}=([^;]*)`)
  );

  return match?.[1] ?? null;
}

/**
 * Fetch wrapper that automatically includes the CSRF token header
 * for mutation requests to internal API routes.
 */
export async function csrfFetch(
  url: string,
  init?: RequestInit
): Promise<Response> {
  const headers = new Headers(init?.headers);

  // Attach CSRF token for non-GET requests
  const method = (init?.method ?? 'GET').toUpperCase();
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const token = getCsrfToken();
    if (token) {
      headers.set(CSRF_HEADER, token);
    }
  }

  return fetch(url, { ...init, headers });
}
