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
import { prisma } from '@/lib/db/client';
import { logActivity } from '@/lib/activity/log';

// Force Node.js runtime (not Edge) because Prisma needs it.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    // Read raw body for Svix signature verification.
    const rawBody = await req.text();
    const event = verifyClerkWebhookBody(rawBody, req.headers);

    // For diagnostics: log every Clerk webhook event to the activity
    // log so the master admin's "Recent system events" panel shows
    // real data. We try to find a workspace context if possible.
    type LogPayload = {
      workspaceId: string;
      actorId: null;
      action: 'created' | 'updated' | 'deleted' | 'joined';
      entityType: 'member' | 'workspace' | 'user';
      entityId: string;
      entityName: string;
      details: string;
      metadata: Record<string, unknown>;
    };
    const eventLog: LogPayload | null = (() => {
      const data = event.data as unknown as Record<string, unknown> | undefined;
      const d = (data ?? {}) as Record<string, unknown>;
      const get = (key: string) => d[key];
      const getNested = (path: string) =>
        path.split('.').reduce<unknown>((acc, k) => (acc as Record<string, unknown> | null)?.[k], d);
      const eid: string = (get('id') as string) ?? (get('user_id') as string) ?? (getNested('organization.id') as string) ?? 'unknown';
      const ts = new Date().toISOString();
      if (event.type.startsWith('user.')) {
        const emails = get('email_addresses') as Array<{ email_address?: string }> | undefined;
        const email = emails?.[0]?.email_address ?? (get('id') as string) ?? 'unknown';
        return {
          workspaceId: 'clerk',
          actorId: null,
          action: event.type === 'user.created' ? 'created' : event.type === 'user.deleted' ? 'deleted' : 'updated',
          entityType: 'user',
          entityId: String(eid),
          entityName: String(email),
          details: `Clerk ${event.type} · ${email}`,
          metadata: { clerkEvent: event.type, ts },
        };
      }
      if (event.type.startsWith('organizationMembership.')) {
        return {
          workspaceId: (getNested('organization.id') as string) ?? 'clerk',
          actorId: null,
          action: event.type === 'organizationMembership.deleted' ? 'deleted' : 'joined',
          entityType: 'member',
          entityId: String((getNested('public_user_data.user_id') as string) ?? (get('user_id') as string) ?? eid),
          entityName: String((getNested('public_user_data.identifier') as string) ?? (getNested('public_user_data.user_id') as string) ?? 'unknown'),
          details: `Clerk ${event.type}`,
          metadata: { clerkEvent: event.type, role: get('role'), ts },
        };
      }
      if (event.type.startsWith('organization.')) {
        return {
          workspaceId: (get('id') as string) ?? 'clerk',
          actorId: null,
          action: event.type === 'organization.created' ? 'created' : event.type === 'organization.deleted' ? 'deleted' : 'updated',
          entityType: 'workspace',
          entityId: String((get('id') as string) ?? eid),
          entityName: String((get('name') as string) ?? (get('id') as string) ?? 'unknown'),
          details: `Clerk ${event.type}`,
          metadata: { clerkEvent: event.type, ts },
        };
      }
      return null;
    })();

    switch (event.type) {
      // --- User events ---
      case 'user.created':
        await upsertUserFromClerk(event.data);
        // Sales alert — notify the owner so they can follow up.
        // Best-effort: failures here don't break the webhook (we still
        // return 200 to Clerk so the user isn't re-delivered).
        try {
          const data = event.data as unknown as {
            id?: string;
            first_name?: string;
            last_name?: string;
            email_addresses?: Array<{ email_address?: string }>;
            unsafe_metadata?: Record<string, unknown>;
          };
          const email = data.email_addresses?.[0]?.email_address ?? null;
          const name = [data.first_name, data.last_name].filter(Boolean).join(' ') || null;
          const utm = (data.unsafe_metadata ?? {}) as Record<string, unknown>;
          if (email && data.id) {
            const { sendNewSignupAlert } = await import('@/lib/email/owner-alerts');
            await sendNewSignupAlert({
              email,
              name,
              clerkUserId: data.id,
              referer: req.headers.get('referer'),
              utmSource: (utm.utm_source as string) ?? null,
              utmMedium: (utm.utm_medium as string) ?? null,
              utmCampaign: (utm.utm_campaign as string) ?? null,
            });
          }
        } catch (alertErr) {
          console.warn('[clerk-webhook] signup-alert failed (non-fatal)', alertErr);
        }
        break;
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

    // Best-effort: log the event to our activity log
    if (eventLog) {
      try {
        // For user events that aren't tied to a workspace, use a special
        // workspaceId. For org-scoped events, use the real workspace.
        const wid = eventLog.workspaceId === 'clerk' ? '_system_' : eventLog.workspaceId;
        // If the workspace doesn't exist, skip the log
        const ws = await prisma.workspace.findUnique({ where: { id: wid }, select: { id: true } });
        if (ws) {
          await logActivity({
            workspaceId: wid,
            actorId: null,
            action: eventLog.action,
            entityType: eventLog.entityType,
            entityId: eventLog.entityId,
            entityName: eventLog.entityName,
            details: eventLog.details,
            metadata: eventLog.metadata,
          });
        }
      } catch {
        // noop
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error('[clerk-webhook] error', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
