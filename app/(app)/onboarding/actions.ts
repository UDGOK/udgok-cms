'use server';

import { redirect } from 'next/navigation';
import { auth, currentUser } from '@clerk/nextjs/server';
import { clerkClient } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db/client';

export type CreateWorkspaceState = { error?: string } | undefined;

/**
 * Create a new workspace for the current user.
 * 1. Creates a Clerk organization (org ID becomes workspace ID)
 * 2. Inserts Workspace + Membership rows in our DB
 * 3. Redirects to the workspace dashboard
 *
 * Best-effort cleanup: if DB insert fails after Clerk org was created, the
 * Clerk org is deleted to avoid orphans.
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

  // Slugify
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  if (!slug) return { error: 'Name must contain at least one letter or number' };

  const user = await currentUser();
  if (!user) return { error: 'User not found' };

  // Create the Clerk org.
  const client = await clerkClient();
  let clerkOrg;
  try {
    clerkOrg = await client.organizations.createOrganization({
      name,
      slug: `${slug}-${Date.now().toString(36)}`,
      createdBy: userId,
    });
  } catch (err) {
    console.error('[createWorkspace] Clerk org create failed', err);
    return { error: 'Could not create workspace. Please try again.' };
  }

  // Insert the Workspace + Membership in our DB.
  try {
    // Ensure the user exists locally first.
    await prisma.user.upsert({
      where: { id: userId },
      create: {
        id: userId,
        email: user.emailAddresses[0]?.emailAddress ?? `${userId}@unknown.local`,
        name: [user.firstName, user.lastName].filter(Boolean).join(' ') || null,
        avatarUrl: user.imageUrl,
      },
      update: {
        email: user.emailAddresses[0]?.emailAddress ?? undefined,
        name: [user.firstName, user.lastName].filter(Boolean).join(' ') || null,
        avatarUrl: user.imageUrl,
      },
    });

    await prisma.workspace.create({
      data: {
        id: clerkOrg.id,
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

    // Process invites (best-effort).
    if (invitesRaw) {
      const invites = invitesRaw
        .split(/[\s,]+/)
        .map((e) => e.trim().toLowerCase())
        .filter((e) => e.includes('@'));

      for (const email of invites) {
        try {
          await client.organizations.createOrganizationInvitation({
            organizationId: clerkOrg.id,
            emailAddress: email,
            role: 'org:member',
            inviterUserId: userId,
          });
        } catch (err) {
          console.warn(`[createWorkspace] failed to invite ${email}`, err);
        }
      }
    }
  } catch (err) {
    console.error('[createWorkspace] DB insert failed, rolling back Clerk org', err);
    // Best-effort cleanup.
    await client.organizations
      .deleteOrganization(clerkOrg.id)
      .catch((e) => console.error('[createWorkspace] rollback also failed', e));
    return { error: 'Could not save workspace. Please try again.' };
  }

  // Redirect to the new workspace's dashboard.
  redirect(`/w/${slug}/dashboard`);
}
