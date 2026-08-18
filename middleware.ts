import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

// Public routes that don't require auth.
// The entire marketing site is public so prospective customers can
// browse without signing in. Only /w/* (app) and /admin/* require auth.
const isPublicRoute = createRouteMatcher([
  // Auth pages
  '/sign-in(.*)',
  '/sign-up(.*)',
  // Marketing site (customer-facing, public)
  '/',
  '/about',
  '/help',
  '/docs',
  '/changelog',
  '/security',
  '/privacy',
  '/terms',
  '/dpa',
  '/pricing',
  '/features',
  // Public pay app share links (token-based, no auth)
  '/pay-apps/(.*)',
  // API routes
  '/api/pay-apps/(.*)/acknowledge',
  '/api/presence/(.*)',
  '/api/presence',
  '/api/webhooks/(.*)',
  // Vercel Blob handleUpload routes — these are called by Vercel
  // Blob's server-to-server callback with no session cookie. Each
  // route does its own role check inside onBeforeGenerateToken, so
  // letting them through the middleware is safe. If the middleware
  // redirects the callback to /sign-in, the completion callback
  // never reaches the route and the file is in Blob with no DB row.
  '/api/files/upload',
  '/api/clients/files',
  '/api/subs/(.*)/documents',
  '/api/projects/(.*)/bim',
  // Static assets
  '/manifest.json',
  '/sw.js',
  '/icon-192.svg',
  '/icon-512.svg',
]);

const isRoot = (path: string) => path === '/' || path === '';

export default clerkMiddleware(async (auth, req) => {
  const { pathname } = req.nextUrl;

  // Public routes pass through (the routes themselves handle auth where needed).
  if (isPublicRoute(req)) {
    return NextResponse.next();
  }

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
  return NextResponse.next();
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files. We exclude .json so
    // manifest.json and other JSON static files pass through without
    // triggering the auth redirect. The previous regex `js(?!on)` left
    // .json files in the matcher, which is why manifest.json was 307ing
    // to the sign-in page.
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|json|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
