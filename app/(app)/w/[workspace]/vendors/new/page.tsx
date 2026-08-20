import { redirect } from 'next/navigation';
import { requireMembership } from '@/lib/auth/require-membership';

// Convenience alias — the real route is under /procurement/.
// Lives here so a bookmarked /vendors/new still lands on the form.
export default async function VendorNewAlias({
  params,
}: {
  params: { workspace: string };
}) {
  await requireMembership(params.workspace);
  redirect(`/w/${params.workspace}/procurement/vendors/new`);
}
