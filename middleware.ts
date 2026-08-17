import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

// Public routes that don't require auth.
const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/pay-apps/(.*)', // public pay app share links (token-based, no auth)
  '/api/pay-apps/(.*)/acknowledge', // public ack endpoint called from share page
  '/api/presence/(.*)', // presence API does its own auth check (returns 401 for unauthed)
  '/api/presence', // also match the bare /api/presence path
  '/api/webhooks/(.*)', // Clerk webhook (verified via Svix signature)
]);

const isRoot = (path: string) => path === '/' || path === '';

export default clerkMiddleware(async (auth, req) => {
  const { pathname } = req.nextUrl;

  // Debug signature so we can detect which middleware version is deployed
  // from response headers. REMOVE BEFORE PRODUCTION.
  const debugRes = NextResponse.next();
  debugRes.headers.set('x-mw-version', 'e211f0a-presence-fix-v2');
  debugRes.headers.set('x-mw-pathname', pathname);

  // Public routes pass through.
  if (isPublicRoute(req)) {
    debugRes.headers.set('x-mw-public', '1');
    return debugRes;
  }
  debugRes.headers.set('x-mw-public', '0');

  // Root: if signed in, push to workspace switcher.
  if (isRoot(pathname)) {
    const { userId } = await auth();
    if (userId) {
      return NextResponse.redirect(new URL('/workspaces', req.url));
    }
    return NextResponse.next();
  }

  // Everything else: manual sign-in check (avoids Clerk's default
  // rewrite-to-404 behavior that auth.protect() does when signInUrl
  // can't be auto-detected).
  const { userId } = await auth();
  if (!userId) {
    const signInUrl = new URL('/sign-in', req.url);
    signInUrl.searchParams.set('redirect_url', pathname);
    return NextResponse.redirect(signInUrl);
  }

  // Authenticated — let the page handle the rest.
  debugRes.headers.set('x-mw-auth', 'ok');
  return debugRes;
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
