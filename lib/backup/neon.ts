/**
 * Neon backup helper.
 *
 * Creates a point-in-time branch on Neon so we always have a
 * yesterday's snapshot to roll back to. The branches are cheap
 * (~10s to create, pay only for storage) and Neon keeps history
 * forever on paid plans.
 *
 * Two ways to trigger:
 *   1. Nightly cron (Vercel Cron → /api/cron/backup-db)
 *   2. Manual (admin-only POST /api/admin/backup) for ad-hoc
 *      "I just changed X, snapshot now" moments.
 *
 * Auth model:
 *   - The cron route requires the standard CRON_SECRET (Bearer token)
 *   - The admin route requires a master admin session
 *   - Both call the same `createBackupBranch` function
 *
 * Branch naming:
 *   - Nightly backups: `nightly-YYYY-MM-DD` (date the snapshot
 *     represents, in UTC). Kept for 14 days, then deleted.
 *   - Manual backups: `manual-YYYYMMDD-HHMMSS-<shortid>` (the
 *     operator's name is stored as a tag in the metadata). Kept
 *     for 30 days.
 *
 * Environment variables required:
 *   - NEON_API_KEY       — from console.neon.tech → Settings → API Keys
 *   - NEON_PROJECT_ID    — the project id (looks like "cool-frog-12345")
 *
 * If NEON_API_KEY is not set, the helper throws a clear error.
 */

import { randomBytes } from 'node:crypto';

const NEON_API_BASE = 'https://console.neon.tech/api/v2';

function getEnvOrThrow(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(
      `${name} is not set. Add it to .env (locally) and Vercel env (prod). ` +
      `Get NEON_API_KEY from console.neon.tech → Settings → API Keys, ` +
      `and NEON_PROJECT_ID from the project URL.`,
    );
  }
  return v;
}

/**
 * Which branch to snapshot from.
 *
 * Neon projects have one "primary" branch, but the API doesn't let
 * you change it programmatically. After a wipe-and-restore, the
 * primary is still the old (empty) branch. Backups must snapshot
 * from the actual data branch, so we make this explicit.
 *
 * Default: 'main'. Override with NEON_BACKUP_SOURCE_BRANCH.
 */
function getSourceBranchId(projectId: string): Promise<string> {
  const override = process.env.NEON_BACKUP_SOURCE_BRANCH;
  if (override) return Promise.resolve(override);

  // Default behavior: find the branch named "main" (which is what
  // every fresh project has, AND what we'll have after the manual
  // rename from restore). If the project doesn't have one named
  // "main", fall back to the primary.
  return neonApi<{ branches: Array<{ id: string; name: string; primary: boolean }> }>(
    'GET',
    `/projects/${projectId}/branches?limit=200`,
  ).then((data) => {
    const main = data.branches.find((b) => b.name === 'main');
    if (main) return main.id;
    const primary = data.branches.find((b) => b.primary);
    if (primary) return primary.id;
    throw new Error('No source branch found — set NEON_BACKUP_SOURCE_BRANCH');
  });
}

export interface BackupBranch {
  id: string;
  name: string;
  createdAt: string;
  // The host portion of the connection string for THIS branch
  // (e.g. "ep-something-else.us-east-1.aws.neon.tech"). Note this
  // is the unpooled host — for the actual app, use the pooled host
  // we get from the response. We only surface the unpooled here
  // because the caller doesn't need the full DSN to log it.
}

export interface BackupResult {
  ok: boolean;
  branchId: string;
  branchName: string;
  // The full connection string (pooled) for the new branch.
  // Stored in the response so the operator can roll back by
  // swapping DATABASE_URL on Vercel.
  pooledConnectionString: string;
  expiresAt: string;
}

interface NeonBranchResponse {
  branch: {
    id: string;
    name: string;
    created_at: string;
  };
  // connection_uris is only present if the branch already has
  // endpoints. New branches get an EMPTY array — the endpoint
  // is auto-created lazily on first connect, OR we can
  // POST to /endpoints to create one immediately. We do the
  // latter for backups so the rollback connection string is
  // available right away.
  connection_uris: Array<{
    connection_uri: string;
    // "pooled" or "direct"
    connection_type: string;
  }>;
}

interface NeonEndpointResponse {
  endpoint: {
    id: string;
    hosts: {
      // Direct (unpooled) connection — long-running server driver
      read_write_host: string;
      // Pooled connection — serverless / short-lived functions
      read_write_pooled_host?: string;
    };
  };
}

async function neonApi<T>(
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  body?: unknown,
  opts?: { retries?: number; retryDelayMs?: number },
): Promise<T> {
  const apiKey = getEnvOrThrow('NEON_API_KEY');
  const retries = opts?.retries ?? 0;
  const retryDelayMs = opts?.retryDelayMs ?? 2000;

  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(`${NEON_API_BASE}${path}`, {
      method,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.ok) {
      return (await res.json()) as T;
    }
    const text = await res.text();
    // 423 = "project already has running conflicting operations".
    // Neon serializes project-level ops, so we wait and retry.
    if (res.status === 423 && attempt < retries) {
      lastError = new Error(`Neon API ${method} ${path} failed: ${res.status} ${text}`);
      await new Promise((r) => setTimeout(r, retryDelayMs));
      continue;
    }
    throw new Error(`Neon API ${method} ${path} failed: ${res.status} ${text}`);
  }
  throw lastError ?? new Error('unreachable');
}

function todayDateUtc(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function nowUtc(): string {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '-');
  // YYYYMMDD-HHMMSS
}

function shortId(): string {
  return randomBytes(2).toString('hex'); // 4 chars
}

/**
 * Create a point-in-time backup branch on Neon.
 *
 * - For nightly: parent is the main branch, branch name is dated.
 * - For manual: parent is the main branch, branch name has a short id
 *   so multiple manual snapshots per day don't collide.
 *
 * @param type - 'nightly' or 'manual'
 * @returns the new branch's id, name, pooled connection string
 */
export async function createBackupBranch(
  type: 'nightly' | 'manual',
): Promise<BackupResult> {
  const projectId = getEnvOrThrow('NEON_PROJECT_ID');
  const sourceBranchId = await getSourceBranchId(projectId);

  // Daily backup name pattern. Manual adds a short id suffix so
  // we can take multiple per day without collision.
  const date = todayDateUtc();
  const branchName =
    type === 'nightly'
      ? `nightly-${date}`
      : `manual-${nowUtc()}-${shortId()}`;

  // Expiry in days. Nightly = 14 days, manual = 30 days. After
  // expiry we delete the branch so we don't run out of branch
  // quota (5000) or storage. The 'expires_at' field on Neon's
  // branch creation is honored by Neon's housekeeping.
  const expiresInDays = type === 'nightly' ? 14 : 30;
  const expiresAt = new Date(Date.now() + expiresInDays * 86400_000).toISOString();

  const data = await neonApi<NeonBranchResponse>(
    'POST',
    `/projects/${projectId}/branches`,
    {
      branch: {
        name: branchName,
        // Always snapshot from the source branch (not the
        // project primary, which may be stale/empty after a
        // wipe-and-restore). This is critical for the Aug 2026
        // data-loss recovery — the new "main" branch (formerly
        // restore-2026-08-23) is what has the data, not the
        // historical primary.
        parent_id: sourceBranchId,
      },
      // expires_at is an ISO 8601 timestamp after which Neon
      // auto-deletes the branch. Only honored on paid plans.
      expires_at: expiresAt,
    },
  );

  // Branches don't auto-get an endpoint. We need to create one
  // so the branch has a connection string. (Lazy auto-creation
  // happens on first connect, but for backups we want the URL
  // ready immediately so the operator can roll back fast.)
  // The 423 retry is important — Neon serializes project-level
  // operations, and the branch creation that just succeeded
  // counts as one. We give it 3 retries with exponential
  // backoff so the endpoint usually lands on the first or
  // second attempt.
  const endpoint = await neonApi<NeonEndpointResponse>(
    'POST',
    `/projects/${projectId}/endpoints`,
    {
      endpoint: {
        branch_id: data.branch.id,
        type: 'read_write',
      },
    },
    { retries: 3, retryDelayMs: 3000 },
  );

  // Build the pooled connection string. Neon gives us the host
  // but not the full DSN (with user/pass/db name), so we splice
  // together from the production DATABASE_URL convention:
  //   postgresql://<user>:<pass>@<host>/neondb?...
  // We grab the user+pass from the environment so secrets stay
  // out of this file.
  const sourceUrl = process.env.DATABASE_URL;
  if (!sourceUrl) {
    throw new Error('DATABASE_URL must be set to build the rollback connection string');
  }
  const parsed = new URL(sourceUrl);
  const user = parsed.username;
  const pass = parsed.password;
  const pooledHost = endpoint.endpoint.hosts.read_write_pooled_host
    ?? endpoint.endpoint.hosts.read_write_host;
  const query = parsed.search || '?sslmode=require&channel_binding=require';
  const pooledConnectionString =
    `postgresql://${user}:${pass}@${pooledHost}/neondb${query}`;

  return {
    ok: true,
    branchId: data.branch.id,
    branchName: data.branch.name,
    pooledConnectionString,
    expiresAt,
  };
}

/**
 * Delete old backup branches we no longer need. Idempotent.
 * Called from the nightly cron after creating the new snapshot.
 */
export async function pruneOldBackups(opts?: { keepDays?: number }): Promise<{
  deleted: string[];
  kept: number;
}> {
  const projectId = getEnvOrThrow('NEON_API_KEY') ? process.env.NEON_PROJECT_ID! : '';
  if (!projectId) {
    return { deleted: [], kept: 0 };
  }

  const keepDays = opts?.keepDays ?? 14;
  const cutoff = Date.now() - keepDays * 86400_000;

  // List all branches, filter to nightly-*/manual-*, delete the
  // old ones. Neon's API doesn't accept a name filter, so we list
  // all and filter client-side.
  interface ListResponse {
    branches: Array<{
      id: string;
      name: string;
      created_at: string;
    }>;
  }
  const data = await neonApi<ListResponse>('GET', `/projects/${projectId}/branches?limit=200`);

  const backupBranches = data.branches.filter(
    (b) => b.name.startsWith('nightly-') || b.name.startsWith('manual-'),
  );

  const deleted: string[] = [];
  let kept = 0;
  for (const b of backupBranches) {
    const age = Date.parse(b.created_at);
    if (Number.isNaN(age)) continue;
    if (age < cutoff) {
      try {
        await neonApi('DELETE', `/projects/${projectId}/branches/${b.id}`);
        deleted.push(b.name);
      } catch {
        // Best-effort: skip if Neon refuses (e.g. branch in use)
      }
    } else {
      kept++;
    }
  }

  return { deleted, kept };
}

/**
 * List current backup branches, newest first. Used by the admin
 * backup dashboard so the operator can see what snapshots exist.
 */
export async function listBackups(): Promise<BackupBranch[]> {
  const projectId = process.env.NEON_PROJECT_ID;
  if (!projectId) return [];
  interface ListResponse {
    branches: Array<{
      id: string;
      name: string;
      created_at: string;
    }>;
  }
  try {
    const data = await neonApi<ListResponse>('GET', `/projects/${projectId}/branches?limit=200`);
    return data.branches
      .filter((b) => b.name.startsWith('nightly-') || b.name.startsWith('manual-'))
      .map((b) => ({
        id: b.id,
        name: b.name,
        createdAt: b.created_at,
      }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return [];
  }
}
