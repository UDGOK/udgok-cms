import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireMembership } from '@/lib/auth/require-membership';
import { getRfqDetail } from '@/lib/procurement/rfq-queries';
import { RfqDetailView } from './RfqDetailView';

export const dynamic = 'force-dynamic';

export default async function RfqDetailPage({
  params,
}: {
  params: { workspace: string; id: string };
}) {
  const { workspace } = await requireMembership(params.workspace);
  const rfq = await getRfqDetail(workspace.id, params.id);
  if (!rfq) notFound();

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://cms.udgok.com';
  // Token plaintext is NOT recoverable from the DB (we only
  // store the hash). The "Copy link" button copies the URL
  // that would have been emailed. After a resend, the buyer's
  // most recent email is the active link; if they need to copy
  // an OLDER one, they can use the email outbox.
  // The link shows when status is DRAFT (created but email
  // failed) — otherwise we just say "see email".
  const lastSent = rfq.sentAt;

  return (
    <div className="p-4 md:p-6 max-w-[1100px] mx-auto">
      <Link
        href={`/w/${workspace.slug}/procurement/lists/${rfq.listId}`}
        className="text-[10px] font-mono uppercase tracking-[0.12em] text-ink-50 hover:text-ink"
      >
        ← {rfq.listName}
      </Link>
      <RfqDetailView
        rfq={rfq}
        workspaceId={workspace.id}
        workspaceSlug={workspace.slug}
        baseUrl={baseUrl}
        showMagicLinkCopy={rfq.status === 'DRAFT' && !lastSent}
      />
    </div>
  );
}
