/**
 * System diagnostic for the master admin. Reads env vars (without
 * exposing secrets) and reports the status of each integration so the
 * platform owner can quickly identify which leg of the stack is broken.
 */
import { prisma } from '@/lib/db/client';

export interface SystemCheck {
  id: string;
  label: string;
  status: 'ok' | 'warning' | 'error' | 'unknown';
  detail: string;
  hint?: string;
}

function maskKey(key: string | undefined | null): string {
  if (!key) return '(not set)';
  if (key.length < 12) return '***';
  return `${key.slice(0, 6)}…${key.slice(-4)} (${key.length} chars)`;
}

function isLiveKey(key: string | undefined | null): boolean {
  if (!key) return false;
  return key.startsWith('pk_live_') || key.startsWith('sk_live_');
}

function isTestKey(key: string | undefined | null): boolean {
  if (!key) return false;
  return key.startsWith('pk_test_') || key.startsWith('sk_test_');
}

export async function getSystemChecks(): Promise<SystemCheck[]> {
  const checks: SystemCheck[] = [];

  // ---- Database ----
  try {
    const start = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const ms = Date.now() - start;
    const userCount = await prisma.user.count();
    const workspaceCount = await prisma.workspace.count();
    checks.push({
      id: 'database',
      label: 'Database (Neon Postgres)',
      status: 'ok',
      detail: `Connected in ${ms}ms · ${userCount} users · ${workspaceCount} workspaces`,
    });
  } catch (err) {
    checks.push({
      id: 'database',
      label: 'Database (Neon Postgres)',
      status: 'error',
      detail: err instanceof Error ? err.message : String(err),
    });
  }

  // ---- Clerk ----
  const pk = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const sk = process.env.CLERK_SECRET_KEY;
  const whSecret = process.env.CLERK_WEBHOOK_SECRET || process.env.UDGOK_CMS_CLERK_WEBHOOK_SECRET;
  const signInUrl = process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL;
  const signUpUrl = process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL;

  const clerkKeyPairConsistent =
    (pk?.startsWith('pk_live_') && sk?.startsWith('sk_live_')) ||
    (pk?.startsWith('pk_test_') && sk?.startsWith('sk_test_'));

  checks.push({
    id: 'clerk-publishable',
    label: 'Clerk publishable key (NEXT_PUBLIC_*)',
    status: pk ? (isLiveKey(pk) || isTestKey(pk) ? 'ok' : 'warning') : 'error',
    detail: pk ? `Set · ${maskKey(pk)}` : 'NOT SET — auth will not work',
  });

  checks.push({
    id: 'clerk-secret',
    label: 'Clerk secret key (server-side)',
    status: sk ? (isLiveKey(sk) || isTestKey(sk) ? 'ok' : 'warning') : 'error',
    detail: sk ? `Set · ${maskKey(sk)}` : 'NOT SET — auth() will fail',
  });

  checks.push({
    id: 'clerk-key-consistency',
    label: 'Clerk key pair consistency',
    status: clerkKeyPairConsistent ? 'ok' : 'error',
    detail: clerkKeyPairConsistent
      ? 'Both keys are on the same instance (test or live)'
      : 'MIXED — pk_test + sk_live or vice versa will break auth()',
    hint: !clerkKeyPairConsistent && pk && sk
      ? `pk=${pk.slice(0, 8)}…  sk=${sk.slice(0, 8)}…`
      : undefined,
  });

  checks.push({
    id: 'clerk-webhook',
    label: 'Clerk webhook secret',
    status: whSecret ? 'ok' : 'warning',
    detail: whSecret ? 'Set — Clerk → /api/webhooks/clerk will verify Svix signatures' : 'NOT SET — new signups via Clerk won\'t sync to DB',
    hint: !whSecret ? 'Add UDGOK_CMS_CLERK_WEBHOOK_SECRET from Clerk Dashboard → Webhooks → Signing Secret' : undefined,
  });

  checks.push({
    id: 'clerk-sign-in-url',
    label: 'Clerk sign-in / sign-up URLs',
    status: signInUrl && signUpUrl ? 'ok' : 'ok',
    detail: `signIn=${signInUrl ?? '/sign-in'}  signUp=${signUpUrl ?? '/sign-up'}`,
  });

  // ---- Resend ----
  const resendKey = process.env.RESEND_API_KEY;
  const fromAddress =
    process.env.RESEND_FROM_ADDRESS ??
    (process.env.UDGOK_MESSAGING_RESEND_EMAIL_DOMAIN
      ? `noreply@${process.env.UDGOK_MESSAGING_RESEND_EMAIL_DOMAIN}`
      : '(using default)');

  checks.push({
    id: 'resend-api-key',
    label: 'Resend API key',
    status: resendKey ? 'ok' : 'error',
    detail: resendKey ? `Set · ${maskKey(resendKey)}` : 'NOT SET — pay app share / invite emails will not send',
  });

  checks.push({
    id: 'resend-from',
    label: 'Resend from address',
    status: fromAddress === '(using default)' ? 'warning' : 'ok',
    detail: fromAddress,
    hint: fromAddress === '(using default)'
      ? 'Set UDGOK_CMS_RESEND_FROM_ADDRESS or UDGOK_MESSAGING_RESEND_EMAIL_DOMAIN to a verified domain'
      : undefined,
  });

  // ---- Vercel Blob ----
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
  checks.push({
    id: 'vercel-blob',
    label: 'Vercel Blob',
    status: blobToken ? 'ok' : 'error',
    detail: blobToken ? `Set · ${maskKey(blobToken)}` : 'NOT SET — file uploads will fail',
  });

  // ---- App URL ----
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  checks.push({
    id: 'app-url',
    label: 'App URL (NEXT_PUBLIC_APP_URL)',
    status: appUrl ? 'ok' : 'warning',
    detail: appUrl ?? 'NOT SET — share links will use fallback (https://cms.udgok.com)',
  });

  // ---- Email activity (last 7 days) ----
  try {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentSignups = await prisma.user.count({
      where: { createdAt: { gte: since } },
    });
    checks.push({
      id: 'signups',
      label: 'Recent signups (7 days)',
      status: 'ok',
      detail: `${recentSignups} new user${recentSignups === 1 ? '' : 's'} in the last 7 days`,
    });
  } catch {
    // already reported above
  }

  return checks;
}

// Placeholder for future Clerk sign-in token API. Currently a no-op
// because the /v1/sign_in_tokens endpoint requires a user_id parameter
// (we can't pre-create tokens for arbitrary emails without an existing
// user). Kept here for when Clerk adds that capability or we wire a
// custom flow.
void undefined;
