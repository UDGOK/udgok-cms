/**
 * Generic 410 page for the vendor portal.
 *
 * Spec §6.3: "Return an identical generic page for NOT_FOUND,
 * EXPIRED and REVOKED. Don't tell an attacker which one it was."
 * The buyer should also land here if the RFQ is ACCEPTED /
 * CANCELLED / DECLINED — those are closed, not 404-able.
 *
 * We use a single title/body so the rendered HTML is the same
 * no matter which path triggered it. No links to anywhere
 * inside the workspace.
 */

export function ExpiredNotice({
  title = 'This link is no longer active',
  body = "If you're expecting a quote request from us, please reply to the email and we'll send a fresh link.",
}: {
  title?: string;
  body?: string;
}) {
  return (
    <main className="mx-auto max-w-2xl p-6">
      <div className="bg-paper border-2 border-ink p-8">
        <p className="text-[10px] tracking-[0.12em] uppercase text-ink-50 font-mono mb-2">
          {'// REQUEST FOR QUOTE'}
        </p>
        <h1 className="text-2xl font-black mb-3">{title}</h1>
        <p className="text-[13px] text-ink-70">{body}</p>
        <p className="text-[11px] text-ink-50 font-mono uppercase tracking-[0.1em] mt-6">
          UDGOK Construction
        </p>
      </div>
    </main>
  );
}
