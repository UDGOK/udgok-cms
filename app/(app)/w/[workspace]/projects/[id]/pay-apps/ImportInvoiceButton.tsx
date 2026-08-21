'use client';

/**
 * Import-invoice button. Opens the ImportInvoiceModal
 * with the next free draw number pre-filled.
 */

import { useState } from 'react';
import { ImportInvoiceModal } from './ImportInvoiceModal';

export function ImportInvoiceButton({
  workspaceSlug,
  projectId,
  nextDrawNumber,
}: {
  workspaceSlug: string;
  projectId: string;
  nextDrawNumber: number;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="px-3 py-2 border-2 border-ink text-[11px] font-extrabold uppercase tracking-[0.12em] hover:bg-ink hover:text-paper"
        title="Import a paid (or future) invoice as a new draw"
      >
        ↑ Import invoice
      </button>
      {open ? (
        <ImportInvoiceModal
          workspaceSlug={workspaceSlug}
          projectId={projectId}
          nextDrawNumber={nextDrawNumber}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
