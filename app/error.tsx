'use client';

import { useEffect } from 'react';
import { captureError } from '@/lib/monitoring';

/**
 * Route-level error boundary. Triggered when an unhandled error
 * is thrown from a server component, a server action, or a
 * client component during render. The user can recover without
 * losing their session.
 *
 * `reset()` re-renders the segment. If the error is deterministic
 * (bad data, missing required prop) this won't help — but for
 * transient errors (network, hydration, third-party flake) it
 * gives the user a way out without a hard refresh.
 *
 * We capture the error on mount so it lands in Vercel's runtime
 * logs (and eventually Sentry, if we wire that up). Server-side
 * errors get their own server-component error boundary in
 * Next.js — this one only runs for client-side errors that
 * escape the route segment.
 */

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    captureError(error, { kind: 'route-error-boundary', digest: error.digest });
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6 py-12">
      <div className="max-w-md text-center">
        <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-ink-50 mb-3">
          {'// Error'}
        </div>
        <h2 className="text-xl font-black mb-2">We hit a snag.</h2>
        <p className="text-[13px] text-ink-70 mb-5">
          The page didn&apos;t load cleanly. Try again, or head back to
          the dashboard and pick up where you left off.
        </p>
        {error.digest ? (
          <p className="text-[10px] font-mono text-ink-50 mb-4">
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
  );
}
