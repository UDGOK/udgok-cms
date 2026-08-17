import { prisma } from '@/lib/db/client';
import type { Role } from '@prisma/client';

/**
 * Sync Clerk user → our DB.
 * Called from /api/webhooks/clerk for user.created, user.updated.
 */
export async function upsertUserFromClerk(payload: {
  id: string;
  email_addresses: Array<{ id: string; email_address: string }>;
  primary_email_address_id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  image_url?: string | null;
}) {
  const primaryEmail = payload.email_addresses.find(
    (e) => e.id === payload.primary_email_address_id,
  )?.email_address;
  const email = primaryEmail ?? payload.email_addresses[0]?.email_address;
  if (!email) {
    throw new Error(`Clerk user ${payload.id} has no email address`);
  }

  const name = [payload.first_name, payload.last_name].filter(Boolean).join(' ') || null;

  await prisma.user.upsert({
    where: { id: payload.id },
    create: {
      id: payload.id,
      email,
      name,
      avatarUrl: payload.image_url ?? null,
    },
    update: {
      email,
      name,
      avatarUrl: payload.image_url ?? null,
    },
  });
}

export async function deleteUserFromClerk(userId: string) {
  await prisma.user.delete({ where: { id: userId } }).catch(() => {
    // Ignore if not found — Clerk might send delete before we ever saw create
    // if our webhook was added late.
  });
}

/**
 * Sync Clerk organization → our Workspace.
 * Called for organization.created, organization.updated.
 */
export async function upsertWorkspaceFromClerk(payload: {
  id: string;
  name: string;
  slug: string;
}) {
  await prisma.workspace.upsert({
    where: { id: payload.id },
    create: {
      id: payload.id,
      name: payload.name,
      slug: payload.slug,
    },
    update: {
      name: payload.name,
      slug: payload.slug,
    },
  });
}

export async function deleteWorkspaceFromClerk(workspaceId: string) {
  await prisma.workspace.delete({ where: { id: workspaceId } }).catch(() => {
    // Ignore if not found.
  });
}

/**
 * Sync Clerk organization membership → our Membership.
 * Called for organizationMembership.created, organizationMembership.updated.
 *
 * Role is read from the Clerk user's publicMetadata under
 * `workspaceRoles[workspaceId]`. Defaults to MEMBER if not set.
 */
export async function upsertMembershipFromClerk(payload: {
  id: string;
  organization: { id: string };
  public_user_data: { user_id: string };
  public_metadata?: { workspaceRoles?: Record<string, Role> };
}) {
  const role = payload.public_metadata?.workspaceRoles?.[payload.organization.id] ?? 'MEMBER';

  await prisma.membership.upsert({
    where: {
      userId_workspaceId: {
        userId: payload.public_user_data.user_id,
        workspaceId: payload.organization.id,
      },
    },
    create: {
      userId: payload.public_user_data.user_id,
      workspaceId: payload.organization.id,
      role,
    },
    update: {
      role,
    },
  });
}

export async function deleteMembershipFromClerk(payload: {
  organization: { id: string };
  public_user_data: { user_id: string };
}) {
  await prisma.membership
    .delete({
      where: {
        userId_workspaceId: {
          userId: payload.public_user_data.user_id,
          workspaceId: payload.organization.id,
        },
      },
    })
    .catch(() => {
      // Ignore if not found.
    });
}
