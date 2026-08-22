import { notFound } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db/client';
import { findCheckInCodeByToken, findOpenCheckIn } from '@/lib/checkins/queries';
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
  let signedInUser: {
    id: string;
    name: string;
    email: string;
    timezone: string | null;
  } | null = null;
  if (signedInAuth?.userId) {
    const u = await prisma.user.findUnique({
      where: { id: signedInAuth.userId },
      select: { id: true, name: true, email: true, timezone: true },
    });
    if (u) {
      signedInUser = {
        id: u.id,
        name: u.name ?? u.email,
        email: u.email,
        timezone: u.timezone,
      };
    }
  }

  const projectAddress = [code.project.address, code.project.city, code.project.state, code.project.zip]
    .filter(Boolean)
    .join(', ');

  // For the signed-in path, query the user's current
  // open check-in on this project so the page can show
  // "You're on site since 2:14pm" + a "Check out" button
  // instead of a generic toggle. For the anonymous
  // sub-foreman path, the picked sub is unknown until the
  // user selects one in the client; we leave
  // `currentOpenEvent` null there and the button defaults
  // to "Check in". Re-scanning after a check-in is the
  // fallback to check out for the anonymous path.
  let currentOpenEvent: { id: string; checkedInAt: string; checkedInAtLabel: string } | null = null;
  if (signedInUser) {
    const open = await findOpenCheckIn(code.project.id, {
      userId: signedInUser.id,
    });
    if (open) {
      // "Since 2:14pm" — the server renders this label using
      // the signed-in user's IANA timezone (User.timezone) so
      // a CST user sees their local time, not Vercel's UTC.
      // For anonymous (sub) check-ins the server doesn't know
      // the visitor's timezone, so we fall back to the
      // browser's local time on the client side. Either way,
      // the rendered string should match the user's wall clock.
      const tz = signedInUser.timezone ?? 'America/Chicago';
      const since = new Date(open.checkedInAt);
      currentOpenEvent = {
        id: open.id,
        checkedInAt: open.checkedInAt.toISOString(),
        checkedInAtLabel: since.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          timeZone: tz,
        }),
      };
    }
  }

  // Geofence pin bound to this code. null when the code was
  // generated without GPS (the legacy "no GPS" flow) — in
  // that case the visitor form doesn't ask for location and
  // the action doesn't compute a distance.
  const codeGeofence =
    code.lat != null && code.lng != null
      ? {
          lat: code.lat,
          lng: code.lng,
          radiusMeters: code.geofenceMeters ?? 150,
          requireWithinGeofence: code.requireWithinGeofence,
        }
      : null;

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
      currentOpenEvent={currentOpenEvent}
      subs={subs}
      codeGeofence={codeGeofence}
    />
  );
}
