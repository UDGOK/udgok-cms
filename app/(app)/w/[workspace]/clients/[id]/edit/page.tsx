import { notFound } from 'next/navigation';
import { requireMembership } from '@/lib/auth/require-membership';
import { prisma } from '@/lib/db/client';
import { PageHeader } from '@/components/ui/PageHeader';
import { ClientEditor } from './ClientEditor';

export const dynamic = 'force-dynamic';

export default async function EditClientPage({
  params,
}: {
  params: { workspace: string; id: string };
}) {
  const ctx = await requireMembership(params.workspace);
  const client = await prisma.client.findFirst({
    where: { id: params.id, workspaceId: ctx.workspace.id },
    select: { id: true, name: true, email: true, phone: true, type: true, status: true, source: true },
  });
  if (!client) notFound();

  return (
    <div className="px-10 py-8 max-w-3xl">
      <PageHeader
        title={`Edit ${client.name}`}
        breadcrumbs={[
          { label: ctx.workspace.name, href: `/w/${ctx.workspace.slug}/dashboard` },
          { label: 'Clients', href: `/w/${ctx.workspace.slug}/clients` },
          { label: client.name, href: `/w/${ctx.workspace.slug}/clients/${client.id}` },
          { label: 'Edit' },
        ]}
      />

      <ClientEditor
        workspaceSlug={ctx.workspace.slug}
        clientId={client.id}
        clientName={client.name}
        initial={client}
      />
    </div>
  );
}
