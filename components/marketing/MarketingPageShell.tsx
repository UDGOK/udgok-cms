import { auth, currentUser } from '@clerk/nextjs/server';
import { Analytics } from '@vercel/analytics/react';
import { prisma } from '@/lib/db/client';
import { isMasterAdmin } from '@/lib/admin/permissions';

export async function MarketingPageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-cream text-ink">
      {/*
        Vercel Web Analytics — drop-in page-view + custom-event
        tracking. Free tier covers 100k events/mo, no cookies, no
        consent banner needed. The <Analytics /> component
        auto-injects the right script (a tiny loader from
        vercel.com that fetches the real analytics.js on demand).
        Do NOT manually reference /_vercel/insights/script.js —
        that path doesn't exist as a static file and Next.js's
        catch-all returns HTML for it, which the browser chokes
        on as "Unexpected token <".

        To verify: open https://cms.udgok.com, then the Vercel
        dashboard → Analytics. Events arrive within ~30s.
      */}
      <Analytics />
      {children}
    </div>
  );
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
