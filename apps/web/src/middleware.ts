// Murray's FSM - Middleware
// ===========================

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import {
  checkRateLimit,
  getClientIdentifier,
  getRateLimitConfig,
  getRateLimitHeaders,
} from '@/lib/rate-limit';

export async function middleware(request: NextRequest) {
  // Rate limiting - check before any other processing
  const pathname = request.nextUrl.pathname;
  const clientId = getClientIdentifier(request);
  const rateLimitConfig = getRateLimitConfig(pathname);
  const rateLimitResult = checkRateLimit(clientId, rateLimitConfig);

  if (!rateLimitResult.success) {
    const headers = getRateLimitHeaders(rateLimitResult);
    return NextResponse.json(
      { 
        error: 'Too many requests',
        message: `Rate limit exceeded. Please try again in ${rateLimitResult.retryAfter} seconds.`
      },
      { status: 429, headers }
    );
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // Add rate limit headers to successful responses
  const rateLimitHeaders = getRateLimitHeaders(rateLimitResult);
  Object.entries(rateLimitHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({
            name,
            value,
            ...options,
          });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({
            name,
            value: '',
            ...options,
          });
        },
      },
    }
  );

  // Skip auth check for truly public routes only
  // SECURITY: /api is NOT public - each API route handles its own auth
  const publicPageRoutes = ['/auth', '/setup', '/book', '/portal', '/survey', '/r', '/quote', '/invoice'];
  const isPublicPage = publicPageRoutes.some(route => request.nextUrl.pathname.startsWith(route));

  // Public API routes that genuinely need no auth (webhooks with their own verification)
  const publicApiRoutes = [
    '/api/webhooks/', // Webhook endpoints verify signatures themselves
    '/api/phone/webhook', // Phone webhook has its own verification
    '/api/quotes/', // Public quote viewing (read-only, by UUID)
    '/api/invoices/', // Public invoice viewing (read-only, by UUID)
    '/api/cron', // Cron routes use CRON_SECRET
  ];
  const isPublicApi = publicApiRoutes.some(route => request.nextUrl.pathname.startsWith(route));

  if (isPublicPage || isPublicApi) {
    return response;
  }

  // API routes require authentication via session or API key
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const apiKey = request.headers.get('x-api-key');
    const authHeader = request.headers.get('authorization');

    // Check for API key authentication
    if (apiKey) {
      // API key validation happens in the route handler
      return response;
    }

    // Check for Bearer token
    if (authHeader?.startsWith('Bearer ')) {
      return response;
    }

    // Check for session-based auth
    try {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        );
      }
    } catch {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    return response;
  }

  // Authenticate user - no bypass allowed
  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch (error) {
    // Log the error but don't allow unauthenticated access
    console.error('Supabase auth check failed:', error);
    // Return error response for API routes, redirect for pages
    if (request.nextUrl.pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Authentication service unavailable' },
        { status: 503 }
      );
    }
  }

  // Protected dashboard routes (these map to the (dashboard) route group)
  const dashboardRoutes = [
    '/dashboard', '/schedule', '/jobs', '/pipeline', '/customers', '/calendar', '/approvals',
    '/calls', '/texts', '/analytics', '/payments', '/reviews', '/marketing', '/team',
    '/inventory', '/settings', '/invoices', '/quotes', '/revenue', '/expenses', '/phone',
    '/dispatch', '/recurring', '/equipment', '/profit', '/contracts', '/work-orders',
    '/surveys', '/referrals', '/tech'
  ];
  const isDashboardRoute = dashboardRoutes.some(route => request.nextUrl.pathname.startsWith(route));

  // Protect dashboard routes - redirect to login if not authenticated
  if (!user && isDashboardRoute) {
    return NextResponse.redirect(new URL('/auth/login', request.url));
  }

  // Redirect logged in users away from auth pages
  if (user && request.nextUrl.pathname.startsWith('/auth')) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Redirect root to schedule (main view)
  if (request.nextUrl.pathname === '/' && user) {
    return NextResponse.redirect(new URL('/schedule', request.url));
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
