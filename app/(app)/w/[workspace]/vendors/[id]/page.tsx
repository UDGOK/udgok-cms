import { redirect } from 'next/navigation';
import { requireMembership } from '@/lib/auth/require-membership';

export default async function VendorDetailAlias({
  params,
}: {
  params: { workspace: string; id: string };
}) {
  await requireMembership(params.workspace);
  redirect(`/w/${params.workspace}/procurement/vendors/${params.id}`);
}
