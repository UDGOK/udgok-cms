'use client';

/**
 * Generic 410-style page for the vendor PO portal.
 * Used for NOT_FOUND / EXPIRED / REVOKED / NOT_ISSUED —
 * all collapse to one page to avoid leaking state.
 */

export function PoPortalExpired({
  title = 'This link is no longer active',
  body = "If you received this link from an email, the purchase order has been cancelled, expired, or the link was replaced. Please reply to the email you received and we'll send a fresh one.",
}: {
  title?: string;
  body?: string;
}) {
  return (
    <main className="min-h-screen bg-cream flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-paper border-2 border-ink p-8 text-center">
        <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-ink-50 mb-3">
          {'// UDGOK Construction'}
        </div>
        <h1 className="text-2xl font-black mb-3">{title}</h1>
        <p className="text-[13px] text-ink-70 leading-relaxed">{body}</p>
        <div className="mt-6 text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50">
          Questions? Reply to the email you received.
        </div>
      </div>
    </main>
  );
}
