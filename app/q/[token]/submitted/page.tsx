/**
 * Submitted confirmation page for the vendor portal.
 * Lands here after a successful SUBMIT or DECLINE.
 */

export default function SubmittedPage() {
  return (
    <main className="mx-auto max-w-2xl p-6">
      <div className="bg-paper border-2 border-ink p-8">
        <p className="text-[10px] tracking-[0.12em] uppercase text-ink-50 font-mono mb-2">
          {'// THANK YOU'}
        </p>
        <h1 className="text-2xl font-black mb-3">Quote received</h1>
        <p className="text-[13px] text-ink-70">
          We&apos;ll review and follow up by email. If you need to revise, use the same link
          from the original email and submit again.
        </p>
        <p className="text-[11px] text-ink-50 font-mono uppercase tracking-[0.1em] mt-6">
          UDGOK Construction
        </p>
      </div>
    </main>
  );
}
