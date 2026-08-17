import { requireMembership } from '@/lib/auth/require-membership';
import { prisma } from '@/lib/db/client';
import { PageHeader } from '@/components/ui/PageHeader';
import { ScanPageClient } from './ScanPageClient';

export const dynamic = 'force-dynamic';

export default async function ScanPage({
  params,
  searchParams,
}: {
  params: { workspace: string };
  searchParams: { code?: string };
}) {
  const workspace = await prisma.workspace.findUnique({ where: { slug: params.workspace } });
  if (!workspace) throw new Error('Workspace not found');
  await requireMembership(workspace.id);

  // If a code was passed, look it up in the workspace
  let lookup: { type: 'sub' | 'project' | 'client' | 'file' | 'none'; label: string; href: string } = {
    type: 'none',
    label: '',
    href: '',
  };
  if (searchParams.code) {
    const code = searchParams.code;
    const [sub, project, client] = await Promise.all([
      prisma.subcontractor.findFirst({
        where: { workspaceId: workspace.id, OR: [{ id: code }, { name: { contains: code, mode: 'insensitive' } }] },
        select: { id: true, name: true },
      }),
      prisma.project.findFirst({
        where: { workspaceId: workspace.id, OR: [{ id: code }, { name: { contains: code, mode: 'insensitive' } }] },
        select: { id: true, name: true },
      }),
      prisma.client.findFirst({
        where: { workspaceId: workspace.id, OR: [{ id: code }, { name: { contains: code, mode: 'insensitive' } }] },
        select: { id: true, name: true },
      }),
    ]);
    if (sub) {
      lookup = { type: 'sub', label: sub.name, href: `/w/${workspace.slug}/subcontractors/${sub.id}` };
    } else if (project) {
      lookup = { type: 'project', label: project.name, href: `/w/${workspace.slug}/projects/${project.id}` };
    } else if (client) {
      lookup = { type: 'client', label: client.name, href: `/w/${workspace.slug}/clients/${client.id}` };
    }
  }

  return (
    <div>
      <PageHeader
        title="Scan"
        subtitle="Scan a barcode or QR code to look up equipment, materials, or contacts"
      />

      {searchParams.code ? (
        <div className="mb-6 max-w-2xl mx-auto">
          <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-ink-50 mb-2">
            {'// Last scan result'}
          </div>
          <div className="bg-paper border-2 border-line p-4">
            <div className="text-[12px] font-mono break-all bg-cream-2 px-3 py-2 mb-3">
              {searchParams.code}
            </div>
            {lookup.type !== 'none' ? (
              <div>
                <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-success mb-1">
                  ✓ Found in workspace
                </div>
                <a
                  href={lookup.href}
                  className="font-extrabold text-[15px] text-orange-d hover:underline"
                >
                  {lookup.label} →
                </a>
              </div>
            ) : (
              <div>
                <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50 mb-1">
                  Not found
                </div>
                <p className="text-[12px] text-ink-70">
                  This code isn&apos;t linked to anything in your workspace yet. You can paste it into a new material, equipment, or contact.
                </p>
              </div>
            )}
          </div>
        </div>
      ) : null}

      <ScanPageClient
        workspaceSlug={workspace.slug}
        plan={workspace.plan}
      />
    </div>
  );
}
