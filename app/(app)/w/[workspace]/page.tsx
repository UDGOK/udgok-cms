import { redirect } from 'next/navigation';

/**
 * Top-level workspace route. There's no actual page here — the
 * workspace's home is `/w/[workspace]/dashboard`. This route exists
 * as a safety net: if anything ever navigates to `/w/[workspace]/`
 * (e.g. the mobile drawer closing logic used to do this), we redirect
 * to the dashboard instead of showing a 404.
 */
export default function WorkspaceRoot({
  params,
}: {
  params: { workspace: string };
}) {
  redirect(`/w/${params.workspace}/dashboard`);
}
