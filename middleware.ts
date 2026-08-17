import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

// Public routes that don't require auth.
const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/pay-apps/(.*)', // public pay app share links (token-based, no auth)
  '/api/pay-apps/(.*)/acknowledge', // public ack endpoint called from share page
  '/api/webhooks/(.*)', // Clerk webhook (verified via Svix signature)
]);

// Routes we want to redirect signed-in users away from (e.g., the marketing
// landing page → their workspace).
const isRoot = (path: string) => path === '/' || path === '';

export default clerkMiddleware(async (auth, req) => {
  const { pathname } = req.nextUrl;

  // Public routes pass through.
  if (isPublicRoute(req)) {
    return NextResponse.next();
  }

  // Root: if signed in, push to workspace switcher (which decides onboarding vs dashboard).
  if (isRoot(pathname)) {
    const { userId } = await auth();
    if (userId) {
      return NextResponse.redirect(new URL('/workspaces', req.url));
    }
    return NextResponse.next();
  }

  // Everything else requires sign-in. We tell Clerk exactly where to send
  // unauthenticated users (otherwise it defaults to a rewrite-to-404,
  // which is what was making /workspaces, /onboarding, etc. return 404).
  await auth.protect({ unauthenticatedUrl: '/sign-in' });
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
