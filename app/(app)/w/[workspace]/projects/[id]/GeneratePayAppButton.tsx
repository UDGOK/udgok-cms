'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui';

export function GeneratePayAppButton({
  workspaceSlug,
  projectId,
  hasDivisions,
}: {
  workspaceSlug: string;
  projectId: string;
  hasDivisions: boolean;
}) {
  const router = useRouter();

  function handleClick() {
    if (!hasDivisions) {
      alert('Add at least one division first.');
      return;
    }
    router.push(`/w/${workspaceSlug}/projects/${projectId}/pay-apps/new`);
  }

  return (
    <Button variant="copper" onClick={handleClick}>
      + Generate pay app
    </Button>
  );
}
