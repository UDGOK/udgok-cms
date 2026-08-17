'use client';

import Link from 'next/link';
import { useEffect } from 'react';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string; status?: number };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface to the console so it's visible in DevTools and Vercel logs.
    console.error('[AppError]', error);
  }, [error]);

  // Known auth errors get specific messaging
  const isAuth = error.message?.toLowerCase().includes('not signed in') ||
                 error.message?.toLowerCase().includes('workspace') ||
                 error.message?.toLowerCase().includes('authentication');

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-8">
      <div className="max-w-xl text-center">
        <div className="label-eyebrow mb-4 inline-flex">
          {isAuth ? '// Need to sign in' : '// Something broke'}
        </div>
        <h1 className="text-display-xl mb-4">
          {isAuth ? (
            <>
              <span className="font-serif italic text-orange-d">Lost</span> your session.
            </>
          ) : (
            <>
              <span className="font-serif italic text-orange-d">Something</span> went sideways.
            </>
          )}
        </h1>
        <p className="text-base text-ink-70 mb-3">
          {isAuth
            ? 'We couldn\'t confirm you\'re signed in. Sign in again to get back to your workspace.'
            : 'We hit an unexpected error. Your data is safe — try again, and if it keeps failing, send us a note.'}
        </p>
        {error.digest ? (
          <p className="text-[11px] font-mono text-ink-50 mb-6">
            ref: {error.digest}
          </p>
        ) : null}
        <div className="flex justify-center gap-3 flex-wrap">
          <button
            onClick={() => reset()}
            className="px-5 py-3 bg-paper border-2 border-ink text-ink text-xs font-extrabold uppercase tracking-[0.12em] hover:bg-ink hover:text-cream transition-colors"
          >
            Try again
          </button>
          <Link
            href="/sign-in"
            className="px-5 py-3 bg-ink text-cream border-2 border-ink text-xs font-extrabold uppercase tracking-[0.12em] hover:bg-orange hover:border-orange transition-colors"
          >
            Sign in again
          </Link>
          <Link
            href="/"
            className="px-5 py-3 text-ink text-xs font-extrabold uppercase tracking-[0.12em] hover:text-orange-d transition-colors"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}
