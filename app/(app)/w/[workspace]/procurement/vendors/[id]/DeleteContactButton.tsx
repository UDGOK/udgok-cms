'use client';

import { useTransition, useState } from 'react';
import { useRouter } from 'next/navigation';
import { deleteContactAction } from '@/lib/procurement/actions';

/**
 * DeleteContactButton — small "Delete" link in the contact
 * list. Confirms before calling the server action. After
 * success, the page is refreshed (router.refresh()) so the
 * list re-renders without the contact.
 *
 * Tenant-scoped on the server: the action refuses if the
 * contact is in a different workspace.
 */

export function DeleteContactButton({
  workspaceId,
  contactId,
  contactName,
}: {
  workspaceId: string;
  contactId: string;
  contactName: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onClick() {
    if (!confirm(`Delete contact ${contactName}?`)) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteContactAction(workspaceId, contactId);
      if (res.ok) {
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <span className="flex items-center gap-2">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="text-[9px] font-mono uppercase tracking-[0.1em] text-ink-50 hover:text-error disabled:opacity-50"
        title="Delete contact"
      >
        {pending ? '…' : 'Delete'}
      </button>
      {error ? (
        <span className="text-[9px] text-error font-semibold">{error}</span>
      ) : null}
    </span>
  );
}
