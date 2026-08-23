import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

// Public routes that don't require auth.
// The entire marketing site is public so prospective customers can
// browse without signing in. Only /w/* (app) and /admin/* require auth.
const isPublicRoute = createRouteMatcher([
  // Auth pages
  '/sign-in(.*)',
  '/sign-up(.*)',
  // SEO / RFC 8615 / well-known files (served by app/robots.ts,
  // app/sitemap.ts, public/.well-known/security.txt)
  '/robots.txt',
  '/sitemap.xml',
  '/changelog.xml',
  '/.well-known/(.*)',
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
  '/contact',
  // Public pay app share links (token-based, no auth)
  '/pay-apps/(.*)',
  // CM compliance suite public share links (token-based, no auth)
  // /co/[token]  — Change Order owner/architect approval portal
  // /lw/[token]  — Lien Waiver sub signing portal
  // /sub/[token] — Submittal architect/engineer review portal
  // /rfi/[token] — RFI architect/engineer response portal
  // The token IS the credential: anyone with the URL can view +
  // (for some flows) sign. The typed name + email in the form
  // is the audit trail of "who clicked what".
  '/co/(.*)',
  '/lw/(.*)',
  '/sub/(.*)',
  '/rfi/(.*)',
  // Public estimate approval links (token-based, no auth)
  // The token IS the credential: anyone with the URL
  // can view + approve / reject. The typed name + email
  // in the form is the audit trail of "who clicked what".
  '/e/(.*)',
  // Public site check-in / check-out (token-based, no auth)
  // The token IS the credential: anyone with the sticker
  // can scan it. The route itself decides whether to ask
  // for a sub foreman or to attribute the scan to the
  // signed-in user.
  '/c/(.*)',
  // Public check-in API (anonymous sub foreman path)
  '/api/checkins/(.*)',
  // API routes
  '/api/pay-apps/(.*)/acknowledge',
  '/api/presence/(.*)',
  '/api/presence',
  '/api/webhooks/(.*)',
  '/api/debug/(.*)', // TEMPORARY debug routes — remove after debugging
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
  '/api/projects/(.*)/photos/upload',
  // ---- PROCUREMENT / VENDOR PORTAL ----
  // Public, token-based vendor RFQ + PO portal. The token in
  // /q/:token or /p/:token is the credential — no Clerk session.
  // Same-origin + frame-ancestors 'none' + form-action 'self'
  // are already in the CSP. The /api/q/ and /api/p/ namespaces
  // are the vendor's view + submit endpoints (token-authed).
  '/q/(.*)',
  '/api/q/(.*)',
  '/p/(.*)',
  '/api/p/(.*)',
  // ---- DEBUG / HEALTH ----
  // The blob-health endpoint only returns { ok, storeId, blobs }
  // — no PII, no auth needed, useful for the user to verify
  // the BLOB_READ_WRITE_TOKEN is alive without an actual upload.
  '/api/debug/blob-health',
  // ---- CRON ----
  // Vercel Cron calls these with no Clerk session — the
  // CRON_SECRET bearer token is the credential, validated
  // inside the route. If the middleware 307s the cron
  // call to /sign-in, the cron never runs.
  '/api/cron/(.*)',
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
    // Skip Next.js internals and all static files. We exclude .json
    // and .txt so manifest.json, robots.txt, sitemap.xml, and
    // security.txt pass through without triggering the auth redirect.
    // The previous regex `js(?!on)` left .json files in the matcher,
    // which is why manifest.json was 307ing to the sign-in page.
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|json|txt|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
