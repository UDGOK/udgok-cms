/**
 * "This RFQ has been revised" page for the vendor portal.
 *
 * Triggered when a vendor visits a link whose Rfq status is
 * SUPERSEDED (a newer revision exists). Distinct from the
 * generic ExpiredNotice so the vendor can move forward —
 * the buyer has re-sent the RFQ with changes, and the new
 * link is in the vendor's inbox.
 *
 * Spec §4.5: the old token is dead, the new token is the
 * new credential. We deliberately do NOT show the new
 * token's URL on this page — that would leak the credential
 * to anyone who visited the old link. The vendor must use
 * the email we sent.
 *
 * If the vendor got here by clicking a stale bookmark (not
 * an old email), they don't have the new link. We point
 * them at the buyer contact channel — the original email's
 * Reply-To — so the rep can ask for a fresh link.
 */

export function RevisedNotice({
  rfqNumber,
}: {
  rfqNumber?: string;
  // The new revision's Rfq id is on the row but we don't
  // expose the new magic link (we don't have the plaintext
  // token, and shouldn't surface it here even if we did).
  // Kept in the props for future enhancement (e.g. "request
  // a fresh link" button that emails the buyer).
  supersededByRfqId?: string | null;
}) {
  return (
    <main className="mx-auto max-w-2xl p-6">
      <div className="bg-paper border-2 border-info p-8">
        <p className="text-[10px] tracking-[0.12em] uppercase text-info font-mono mb-2">
          {'// REQUEST FOR QUOTE — REVISED'}
        </p>
        <h1 className="text-2xl font-black mb-3">
          {rfqNumber ? `${rfqNumber} has been revised` : 'This quote request has been revised'}
        </h1>
        <p className="text-[13px] text-ink-70 mb-3">
          We&apos;ve sent an updated version of this quote request. Please check
          your inbox — the new request was sent to the same email address as
          this link, and replaces this one.
        </p>
        <p className="text-[13px] text-ink-70 mb-3">
          If you can&apos;t find the new email, please reply to the original
          message and we&apos;ll re-send it. The previous link will keep showing
          this notice.
        </p>
        <p className="text-[11px] text-ink-50 font-mono uppercase tracking-[0.1em] mt-6">
          UDGOK Construction
        </p>
      </div>
    </main>
  );
}
