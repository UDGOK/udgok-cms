'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui';
import { closeDealAction, reopenDealAction } from '../actions';
import { EditDealModal } from './EditDealModal';

interface PropertyRef {
  id: string;
  label: string;
}

interface EditDealButtonProps {
  workspaceSlug: string;
  dealId: string;
  initial: {
    title: string;
    value: number;
    margin: number | null;
    expectedClose: string | null;
    description: string | null;
    propertyId: string | null;
  };
  properties: PropertyRef[];
  currentStage: 'LEAD' | 'CONTACTED' | 'ESTIMATE_SENT' | 'NEGOTIATING' | 'WON' | 'LOST';
}

/**
 * The sidebar of the deal detail page has three things:
 *
 *   1. "Edit deal" — opens the edit modal
 *   2. "Mark as won" / "Mark as lost" — only when stage is one
 *      of the 4 active stages (LEAD..NEGOTIATING). These close
 *      the deal and move it out of the kanban into the WON/LOST
 *      terminal stages.
 *   3. "Reopen" — only when stage is WON or LOST, moves the
 *      deal back to NEGOTIATING.
 *
 * The server actions do the actual writes; the buttons are
 * thin client wrappers that close the modal / refresh the
 * page.
 */
export function EditDealButton({
  workspaceSlug,
  dealId,
  initial,
  properties,
  currentStage,
}: EditDealButtonProps) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const isClosed = currentStage === 'WON' || currentStage === 'LOST';

  function handleClose(result: 'WON' | 'LOST' | 'REOPEN') {
    setError(null);
    startTransition(async () => {
      const res =
        result === 'REOPEN'
          ? await reopenDealAction(workspaceSlug, dealId)
          : await closeDealAction(workspaceSlug, dealId, result);
      if (res?.error) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <>
      <Button variant="secondary" fullWidth onClick={() => setEditing(true)}>
        Edit deal
      </Button>

      {!isClosed ? (
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="primary"
            onClick={() => handleClose('WON')}
            disabled={pending}
          >
            {pending ? '…' : 'Mark as won'}
          </Button>
          <Button
            variant="ghost"
            onClick={() => handleClose('LOST')}
            disabled={pending}
          >
            Mark as lost
          </Button>
        </div>
      ) : (
        <Button
          variant="secondary"
          fullWidth
          onClick={() => handleClose('REOPEN')}
          disabled={pending}
        >
          Reopen deal
        </Button>
      )}

      {error ? (
        <div className="text-[11px] text-error">{error}</div>
      ) : null}

      {editing ? (
        <EditDealModal
          workspaceSlug={workspaceSlug}
          dealId={dealId}
          initial={initial}
          properties={properties}
          onClose={() => setEditing(false)}
        />
      ) : null}
    </>
  );
}
