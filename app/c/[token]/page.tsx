import { notFound } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db/client';
import { findCheckInCodeByToken } from '@/lib/checkins/queries';
import { PublicCheckInView } from './PublicCheckInView';

export const dynamic = 'force-dynamic';

export const metadata = {
  // We don't want this page indexed by search engines —
  // it leaks workspace + project names via the public URL.
  // The /c/* prefix is the one place we set a global noindex
  // via the layout in app/c/layout.tsx.
};

/**
 * Public check-in page. Reached by scanning the QR code
 * sticker at a job site. No auth required — the token
 * in the URL IS the credential.
 *
 * Resolves the token to a project, fetches the workspace's
 * subcontractor list (for the anonymous sub-foreman path),
 * and renders the friendly check-in form.
 */
export default async function PublicCheckInPage({
  params,
}: {
  params: { token: string };
}) {
  const code = await findCheckInCodeByToken(params.token);
  if (!code) notFound();

  // Pre-fetch the workspace's subcontractors for the
  // anonymous sub-foreman path. We don't need anything
  // from Clerk for this fetch; the public check-in page
  // works whether or not the visitor has a Clerk session.
  const [subs, signedInAuth] = await Promise.all([
    prisma.subcontractor.findMany({
      where: { workspaceId: code.workspaceId, name: { not: '' } },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, primaryTrade: true },
    }),
    auth().catch(() => ({ userId: null as string | null })),
  ]);

  // If the user is signed in to the CMS on this same
  // device, we can pre-resolve their name and offer the
  // "auto-attributed" path. Don't fail if the lookup
  // throws — a Clerk hiccup shouldn't block a sub.
  let signedInUser: { id: string; name: string; email: string } | null = null;
  if (signedInAuth?.userId) {
    const u = await prisma.user.findUnique({
      where: { id: signedInAuth.userId },
      select: { id: true, name: true, email: true },
    });
    if (u) {
      signedInUser = {
        id: u.id,
        name: u.name ?? u.email,
        email: u.email,
      };
    }
  }

  const projectAddress = [code.project.address, code.project.city, code.project.state, code.project.zip]
    .filter(Boolean)
    .join(', ');

  return (
    <PublicCheckInView
      token={params.token}
      project={{
        id: code.project.id,
        name: code.project.name,
        code: code.project.code,
        address: projectAddress || null,
        workspaceId: code.workspaceId,
        workspaceName: code.project.workspace.name,
        workspaceSlug: code.project.workspace.slug,
      }}
      codeLabel={code.label}
      isActive={code.isActive}
      signedInUser={signedInUser}
      subs={subs}
    />
  );
}
