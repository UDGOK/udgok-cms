import { redirect } from 'next/navigation';
import { requireMembership } from '@/lib/auth/require-membership';

// Convenience alias — the real route is under /procurement/.
// The procurement module owns vendors, material lists, and the
// future RFQ flow, so we put them all under one prefix. But
// for old / muscle-memory /vendors URLs, this redirect lands
// on the right page.
export default async function VendorsAlias({
  params,
}: {
  params: { workspace: string };
}) {
  await requireMembership(params.workspace);
  redirect(`/w/${params.workspace}/procurement/vendors`);
}
