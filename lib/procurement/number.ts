/**
 * Race-safe gapless per-workspace/year document numbering.
 *
 * The spec's call-out: "Do NOT use count(*) + 1. Two people
 * clicking at once will collide." The fix is a single UPSERT
 * on (workspace_id, doc_type, period) — Postgres serializes
 * the increment per row, and the result is the new value
 * for THIS call. Other concurrent calls get +2, +3, etc.
 *
 * Usage:
 *   const num = await nextDocNumber(tx, workspaceId, 'PO')
 *   // → "PO-2026-0001"
 *
 * Pass the transaction client `tx` so the number is allocated
 * in the same atomic unit as the row that uses it. If we did
 * this outside a transaction, the PO create could fail AFTER
 * the number was taken, leaving a gap.
 */

import type { Prisma } from '@prisma/client';

export type DocType = 'PO' | 'RFQ';

export async function nextDocNumber(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  type: DocType,
): Promise<string> {
  const period = String(new Date().getFullYear());
  const rows = await tx.$queryRaw<{ value: number }[]>`
    INSERT INTO "DocCounter" ("workspaceId", "docType", "period", "value")
    VALUES (${workspaceId}, ${type}, ${period}, 1)
    ON CONFLICT ("workspaceId", "docType", "period")
      DO UPDATE SET "value" = "DocCounter"."value" + 1
    RETURNING "value";
  `;
  const value = rows[0]?.value ?? 1;
  const padded = String(value).padStart(4, '0');
  return `${type}-${period}-${padded}`;
}
