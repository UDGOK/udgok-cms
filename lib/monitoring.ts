/**
 * Lightweight error monitoring facade.
 *
 * Why this exists: before this module, the only signal for
 * production errors was a developer opening the browser
 * console. That's not a process. We need errors to flow
 * somewhere persistent + searchable so we can fix them
 * before customers complain.
 *
 * Today: writes to console (Vercel captures this in their
 * runtime logs, which are searchable from the dashboard).
 * No external service required.
 *
 * Tomorrow: if/when we set SENTRY_DSN, this facade wraps
 * @sentry/nextjs. The call sites don't change — captureError()
 * is the only entry point.
 *
 * Usage from a route or server action:
 *
 *   try { ... } catch (err) {
 *     captureError(err, { route: 'pay-apps/[id]/acknowledge', userId });
 *     return { error: 'Internal error' };
 *   }
 *
 * The { route, userId, ... } context is attached to the log
 * line so you can grep Vercel logs for the user that hit it.
 */

interface ErrorContext {
  route?: string;
  userId?: string;
  workspaceId?: string;
  // Arbitrary extra fields — keep them small (no blobs, no PII)
  [key: string]: unknown;
}

function formatForLog(err: unknown, context: ErrorContext): string {
  const lines: string[] = [];
  lines.push('[monitoring] captured error');

  if (err instanceof Error) {
    lines.push(`  message: ${err.message}`);
    if (err.stack) {
      // The first frame is enough for grep — full stack is in
      // Vercel's runtime log anyway.
      const firstFrame = err.stack.split('\n').slice(0, 3).join('\n    ');
      lines.push(`  stack: ${firstFrame}`);
    }
    if ((err as { digest?: string }).digest) {
      lines.push(`  digest: ${(err as { digest?: string }).digest}`);
    }
  } else {
    lines.push(`  value: ${String(err)}`);
  }

  for (const [k, v] of Object.entries(context)) {
    if (v !== undefined) {
      lines.push(`  ${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`);
    }
  }
  return lines.join('\n');
}

/**
 * Capture an error. Currently writes to console (which Vercel
 * captures); swap in Sentry or another service by changing the
 * body of this function — call sites don't need to change.
 */
export function captureError(err: unknown, context: ErrorContext = {}): void {
  if (process.env.NODE_ENV === 'test') {
    // Tests shouldn't spam logs. Re-throw so test failures
    // surface naturally.
    if (err instanceof Error) throw err;
    return;
  }
  // eslint-disable-next-line no-console
  console.error(formatForLog(err, context));
}

/**
 * Capture a warning. Same as captureError but for non-fatal
 * anomalies we want to track (e.g. unexpected state that we
 * recovered from gracefully).
 */
export function captureWarning(message: string, context: ErrorContext = {}): void {
  if (process.env.NODE_ENV === 'test') return;
  const lines: string[] = [`[monitoring] warning: ${message}`];
  for (const [k, v] of Object.entries(context)) {
    if (v !== undefined) {
      lines.push(`  ${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`);
    }
  }
  // eslint-disable-next-line no-console
  console.warn(lines.join('\n'));
}
