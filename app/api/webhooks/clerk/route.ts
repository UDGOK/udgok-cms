import { NextResponse } from 'next/server';
import { verifyClerkWebhookBody } from '@/lib/auth/svix';
import {
  upsertUserFromClerk,
  deleteUserFromClerk,
  upsertWorkspaceFromClerk,
  deleteWorkspaceFromClerk,
  upsertMembershipFromClerk,
  deleteMembershipFromClerk,
} from '@/lib/auth/sync';

// Force Node.js runtime (not Edge) because Prisma needs it.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    // Read raw body for Svix signature verification.
    const rawBody = await req.text();
    const event = verifyClerkWebhookBody(rawBody, req.headers);

    switch (event.type) {
      // --- User events ---
      case 'user.created':
      case 'user.updated':
        await upsertUserFromClerk(event.data);
        break;
      case 'user.deleted':
        if (event.data.id) {
          await deleteUserFromClerk(event.data.id);
        }
        break;

      // --- Organization (= Workspace) events ---
      case 'organization.created':
      case 'organization.updated':
        await upsertWorkspaceFromClerk(event.data);
        break;
      case 'organization.deleted':
        if (event.data.id) {
          await deleteWorkspaceFromClerk(event.data.id);
        }
        break;

      // --- Organization membership events ---
      case 'organizationMembership.created':
      case 'organizationMembership.updated':
        await upsertMembershipFromClerk(event.data);
        break;
      case 'organizationMembership.deleted':
        await deleteMembershipFromClerk(event.data);
        break;

      default:
        // Unhandled event type — ignore.
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error('[clerk-webhook] error', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
