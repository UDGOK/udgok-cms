'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

interface DeactivateCodeButtonProps {
  workspaceSlug: string;
  codeId: string;
  // We import the action at the call site so this client
  // component doesn't pull server-only deps into its
  // module graph. The action is passed as a prop.
  action: (workspaceSlug: string, codeId: string, isActive: boolean) => Promise<
    { ok: true } | { ok: false; error: string }
  >;
}

/**
 * Small confirmation-prompt client component for the
 * "retire this code" admin action. Wraps the server
 * action in a transition so the page revalidates and
 * the row visually reflects the new state.
 */
export function DeactivateCodeButton({ workspaceSlug, codeId, action }: DeactivateCodeButtonProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function handleClick() {
    if (!window.confirm('Retire this QR code? It will stop accepting scans, but existing history is preserved.')) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await action(workspaceSlug, codeId, false);
      if (!res.ok) {
        setError(res.error);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="px-2.5 py-1.5 bg-paper text-error text-[10px] font-extrabold uppercase tracking-[0.12em] hover:bg-error hover:text-paper border-2 border-error disabled:opacity-50"
      >
        {pending ? 'Retiring…' : 'Retire'}
      </button>
      {error ? (
        <div className="absolute z-10 right-0 top-full mt-1 bg-error text-paper text-[10px] font-mono px-2 py-1 whitespace-nowrap">
          {error}
        </div>
      ) : null}
    </div>
  );
}
