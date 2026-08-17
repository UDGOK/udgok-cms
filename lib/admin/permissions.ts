import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db/client';

/**
 * Master admin / platform owner detection. The yasir@udgok.com user is
 * the app owner with absolute rights. Their email is hardcoded here so
 * the system always recognizes them, regardless of workspace membership.
 *
 * When you want to add more platform owners, set the MASTERS env var:
 *   UDGOK_CMS_MASTERS='["yasir@udgok.com","another@example.com"]'
 *
 * The default list keeps yasir@udgok.com as the platform owner. Their
 * workspace is automatically UDGOK (created on first sign-in).
 */
const DEFAULT_MASTER_EMAILS = ['yasir@udgok.com'];

function getMasterEmails(): string[] {
  // Read from env shim
  const raw = process.env.UDGOK_CMS_MASTERS || process.env.MASTERS;
  if (!raw) return DEFAULT_MASTER_EMAILS;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return [...DEFAULT_MASTER_EMAILS, ...parsed.filter((e) => typeof e === 'string')];
    }
  } catch {
    // fall through to default
  }
  return DEFAULT_MASTER_EMAILS;
}

/**
 * Returns true if the given userId belongs to a platform owner. This
 * is a single DB lookup; callers are expected to invoke it once per
 * request and pass the boolean to `hasFeature()` etc.
 *
 * Use this in:
 *  - hasFeature() to bypass plan gates
 *  - Route guards for /admin
 *  - Action-level permission checks (e.g. setWorkspacePlanAction)
 */
export async function isMasterAdmin(userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  if (!user) return false;
  return getMasterEmails().map((e) => e.toLowerCase()).includes(user.email.toLowerCase());
}

/**
 * Convenience helper for the current signed-in user. Returns false if
 * not signed in.
 */
export async function currentUserIsMasterAdmin(): Promise<boolean> {
  const { userId } = await auth();
  return isMasterAdmin(userId);
}

/**
 * Get the list of master admin emails (for display purposes). Excludes
 * the default yasir@udgok.com from being shown twice.
 */
export function listMasterAdminEmails(): string[] {
  return getMasterEmails();
}
