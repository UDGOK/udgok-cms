/**
 * Public estimate page.
 *
 * Reached via /e/[token] — no auth required, the
 * token in the URL is the credential. The page
 * mirrors the admin detail view but renders for
 * a non-UDGOK user (the client).
 *
 * On first view we:
 *   1. Record the view (bumps firstViewedAt,
 *      transitions SENT→VIEWED).
 *   2. Render the estimate header, line items,
 *      totals.
 *   3. If status is SENT or VIEWED, show the
 *      Approve / Reject form. If APPROVED/REJECTED/
 *      CONVERTED, show the terminal state.
 */

import { notFound } from 'next/navigation';
import { getEstimateByToken, recordEstimateView } from '@/lib/estimates/queries';
import { PublicEstimateView } from './PublicEstimateView';

export const dynamic = 'force-dynamic';

export default async function PublicEstimatePage({
  params,
}: {
  params: { token: string };
}) {
  // Record the view first (so SENT→VIEWED
  // transitions correctly even on the first page
  // load). recordEstimateView returns null for
  // unknown / DRAFT tokens.
  const viewResult = await recordEstimateView(params.token);
  if (!viewResult) notFound();

  const estimate = await getEstimateByToken(params.token);
  if (!estimate) notFound();

  return (
    <PublicEstimateView
      token={params.token}
      estimate={estimate}
      workspaceName={estimate.workspaceName}
    />
  );
}
