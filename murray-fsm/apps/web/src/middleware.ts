// Murray's FSM - Middleware
// ===========================
// Updated for Next.js 16 + @supabase/ssr getAll/setAll pattern

import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { setCsrfCookie, validateCsrf, csrfErrorResponse } from '@/lib/csrf';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: Do NOT send getSession() here — use getUser() for security.
  // getUser() contacts the Supabase Auth server every time to revalidate the Auth token.
  const { data: { user } } = await supabase.auth.getUser();

  // Protect dashboard routes (deny-by-default)
  // Route groups like (dashboard) are NOT part of the URL path,
  // so we protect everything except known public paths.
  const publicPrefixes = ['/auth', '/book', '/portal', '/api/v1', '/api/webhooks/sms'];
  const isPublic = publicPrefixes.some(p => request.nextUrl.pathname.startsWith(p))
    || request.nextUrl.pathname === '/';

  if (!user && !isPublic) {
    // In development, skip auth redirect only if explicitly opted in.
    if (process.env.NODE_ENV === 'development' && process.env.SKIP_AUTH === 'true') {
      return supabaseResponse;
    }
    const url = request.nextUrl.clone();
    url.pathname = '/auth/login';
    return NextResponse.redirect(url);
  }

  // Redirect logged in users away from auth pages (except reset-password)
  if (user && request.nextUrl.pathname.startsWith('/auth')
    && !request.nextUrl.pathname.startsWith('/auth/reset-password')) {
    const url = request.nextUrl.clone();
    url.pathname = '/jobs';
    return NextResponse.redirect(url);
  }

  // CSRF protection for internal API mutation endpoints
  const isInternalApi = request.nextUrl.pathname.startsWith('/api/')
    && !request.nextUrl.pathname.startsWith('/api/v1')
    && !request.nextUrl.pathname.startsWith('/api/webhooks/sms');
  if (isInternalApi && !validateCsrf(request)) {
    return csrfErrorResponse();
  }

  // Set CSRF cookie on page navigations (GET requests for HTML pages)
  const isPageRequest = request.method === 'GET'
    && !request.nextUrl.pathname.startsWith('/api/')
    && !request.nextUrl.pathname.startsWith('/_next/');
  if (isPageRequest && !request.cookies.get('csrf_token')) {
    setCsrfCookie(supabaseResponse);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
