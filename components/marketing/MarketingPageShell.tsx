import { auth, currentUser } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db/client';
import { isMasterAdmin } from '@/lib/admin/permissions';

export async function MarketingPageShell({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-cream text-ink">{children}</div>;
}

/**
 * Use this version of the shell when you want the nav to reflect the
 * current user's session. Renders server-side with no extra request.
 */
export async function MarketingPageShellAuthed({ children }: { children: React.ReactNode }) {
  const { userId } = await auth();
  let userName: string | null = null;
  let userEmail: string | null = null;
  let userAvatar: string | null = null;
  let primaryWorkspaceSlug: string | undefined;
  let masterAdmin = false;

  if (userId) {
    const me = await currentUser();
    userName = me?.firstName || me?.username || null;
    userEmail = me?.emailAddresses?.[0]?.emailAddress ?? null;
    userAvatar = me?.imageUrl ?? null;
    masterAdmin = await isMasterAdmin(userId);

    // Find primary workspace (oldest membership)
    const membership = await prisma.membership.findFirst({
      where: { userId },
      orderBy: { joinedAt: 'asc' },
      include: { workspace: { select: { slug: true } } },
    });
    primaryWorkspaceSlug = membership?.workspace.slug;
  }

  return (
    <div className="min-h-screen bg-cream text-ink" data-ctx={JSON.stringify({ signedIn: !!userId, masterAdmin, slug: primaryWorkspaceSlug ?? null })}>
      {/* Inject the props into a global so the client MarketingNav can read them */}
      <script
        dangerouslySetInnerHTML={{
          __html: `window.__udgNav = ${JSON.stringify({
            signedIn: !!userId,
            userName,
            userEmail,
            userAvatar,
            isMasterAdmin: masterAdmin,
            primaryWorkspaceSlug,
          })};`,
        }}
      />
      {children}
    </div>
  );
}
