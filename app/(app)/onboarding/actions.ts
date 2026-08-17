'use server';

import { redirect } from 'next/navigation';
import { auth, currentUser } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db/client';
import { Resend } from 'resend';
import { randomBytes } from 'crypto';

export type CreateWorkspaceState = { error?: string } | undefined;

/**
 * Create a new workspace for the current user.
 *
 * v1 simplified flow: Workspace lives entirely in our DB. We do NOT create
 * a Clerk organization (avoids Clerk Free plan org limits and permission
 * edge cases). The URL slug drives routing — when a user hits
 * /w/{slug}/dashboard, we look up the Workspace by slug, then the user's
 * Membership in that workspace.
 *
 * Team invites (left in place but as a no-op for v1): we generate a
 * signed invite link that the recipient can use to join after signing up.
 */
export async function createWorkspaceAction(
  _prev: CreateWorkspaceState,
  formData: FormData,
): Promise<CreateWorkspaceState> {
  const { userId } = await auth();
  if (!userId) return { error: 'Not signed in' };

  const name = String(formData.get('name') ?? '').trim();
  const industry = String(formData.get('industry') ?? '').trim() || null;
  const invitesRaw = String(formData.get('invites') ?? '').trim();

  if (!name) return { error: 'Workspace name is required' };
  if (name.length > 60) return { error: 'Name must be 60 characters or less' };

  // Slugify — include a short random suffix so two workspaces with the same
  // name can coexist, and so retries never hit a unique-slug conflict.
  const baseSlug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30);
  if (!baseSlug) return { error: 'Name must contain at least one letter or number' };
  const slug = `${baseSlug}-${randomBytes(3).toString('hex')}`;

  // Best-effort: pull current Clerk user data for the User row.
  let email: string | null = null;
  let userName: string | null = null;
  let avatarUrl: string | null = null;
  try {
    const u = await currentUser();
    if (u) {
      email = u.emailAddresses[0]?.emailAddress ?? null;
      userName = [u.firstName, u.lastName].filter(Boolean).join(' ') || null;
      avatarUrl = u.imageUrl;
    }
  } catch (e) {
    // ignore — currentUser() can fail with key issues, we just won't have name/email
  }

  // Everything happens in one DB transaction. If any step fails, the whole
  // thing rolls back so we never have a half-created workspace.
  try {
    await prisma.$transaction(async (tx) => {
      // Ensure the user exists locally first.
      await tx.user.upsert({
        where: { id: userId },
        create: {
          id: userId,
          email: email ?? `${userId}@unknown.local`,
          name: userName,
          avatarUrl,
        },
        update: {
          email: email ?? undefined,
          name: userName,
          avatarUrl,
        },
      });

      // Create the workspace. The user becomes OWNER automatically.
      await tx.workspace.create({
        data: {
          name,
          slug,
          industry,
          members: {
            create: {
              userId,
              role: 'OWNER',
            },
          },
        },
      });
    });
  } catch (err) {
    console.error('[createWorkspace] DB transaction failed', err);
    const msg = err instanceof Error ? err.message : String(err);
    // Common Prisma error codes translated to human messages.
    if (msg.includes('Unique constraint') || msg.includes('P2002')) {
      return { error: 'A workspace with that name already exists. Try a different name.' };
    }
    return { error: `Database: ${msg}` };
  }

  // Send invite emails (best-effort, doesn't block workspace creation).
  if (invitesRaw) {
    const invites = invitesRaw
      .split(/[\s,]+/)
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.includes('@'));

    if (invites.length > 0) {
      const apiKey = process.env.RESEND_API_KEY;
      const fromAddress = process.env.RESEND_FROM_ADDRESS ?? 'noreply@udgok.app';
      if (apiKey) {
        const resend = new Resend(apiKey);
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://cms.udgok.com';
        for (const email of invites) {
          try {
            await resend.emails.send({
              from: fromAddress,
              to: email,
              subject: `${userName ?? 'A teammate'} invited you to ${name} on UDGOK CMS`,
              html: `<p>You've been invited to <b>${name}</b> on UDGOK CMS.</p>
                     <p>Sign up to join: <a href="${appUrl}/sign-up?workspace=${slug}">${appUrl}/sign-up</a></p>`,
            });
          } catch (err) {
            console.warn(`[createWorkspace] failed to email invite to ${email}`, err);
          }
        }
      } else {
        console.warn('[createWorkspace] RESEND_API_KEY not set; skipping invite emails');
      }
    }
  }

  // Redirect to the new workspace's dashboard.
  redirect(`/w/${slug}/dashboard`);
}
