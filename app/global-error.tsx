'use client';

import { useEffect } from 'react';
import { captureError } from '@/lib/monitoring';

/**
 * The absolute last-resort error boundary. Triggered when an
 * unhandled error escapes the root layout itself (so the regular
 * error.tsx can't render). Per Next.js App Router, this MUST be
 * a client component and MUST include <html> and <body>.
 *
 * We render a clean recovery screen with two actions: go home
 * (works for any user) and try again (reloads the same URL).
 * No copy that requires the database or any server state.
 */

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Last-resort boundary. We don't know which user/route
    // we're in here (the root layout has crashed), so context
    // is just the error itself + digest.
    captureError(error, { kind: 'global-error-boundary', digest: error.digest });
  }, [error]);

  return (
    <html lang="en">
      <body
        className="antialiased min-h-screen bg-cream"
        style={{ fontFamily: 'system-ui, sans-serif' }}
      >
        <div className="min-h-screen flex items-center justify-center px-6">
          <div className="max-w-md text-center">
            <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-ink-50 mb-3">
              {'// 500'}
            </div>
            <h1 className="text-2xl font-black mb-3">Something broke.</h1>
            <p className="text-[14px] text-ink-70 mb-6">
              We hit an unexpected error. Our team has been notified. You
              can try the page again, or head back to the dashboard.
            </p>
            {error.digest ? (
              <p className="text-[10px] font-mono text-ink-50 mb-6">
                Reference: {error.digest}
              </p>
            ) : null}
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <button
                type="button"
                onClick={reset}
                className="px-4 py-2 bg-orange text-paper text-[11px] font-extrabold uppercase tracking-[0.1em] hover:bg-orange-d"
              >
                Try again
              </button>
              <a
                href="/"
                className="px-4 py-2 bg-paper border-2 border-ink text-ink text-[11px] font-extrabold uppercase tracking-[0.1em] hover:bg-cream-2"
              >
                Go to dashboard
              </a>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
