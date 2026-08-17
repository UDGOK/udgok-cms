import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db/client';

/**
 * Authenticated app shell — auth check only.
 *
 * The actual workspace-scoped chrome (sidebar + topbar) is rendered by
 * app/(app)/w/[workspace]/layout.tsx, which validates that the URL slug
 * corresponds to a workspace the user belongs to.
 *
 * Special routes that don't need a workspace (the switcher, onboarding) live
 * directly under (app)/ and are NOT wrapped by the workspace layout.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  // If the user has no workspace yet, send them to /workspaces (which shows
  // the empty state + an onboarding CTA). Otherwise let them land wherever
  // they navigated (workspaces switcher, or /w/[slug]/dashboard via the
  // workspace layout).
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { memberships: { take: 1 } },
  });
  if (!user || user.memberships.length === 0) {
    // Allow /workspaces and /onboarding to render their own pages.
    // This layout doesn't intercept routing — only the page does.
  }

  return <>{children}</>;
}
