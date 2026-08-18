import { prisma } from '@/lib/db/client';
import { listProjectMaterials, listProjectEquipment } from '@/lib/inventory/queries';

/**
 * Project INVENTORY tab. Shows materials + equipment scoped
 * to this project, plus a one-click "add" button for each.
 *
 * The tab is a server component because the lists are
 * server-rendered (small, fast, no client JS). The add
 * buttons are <a> tags that go to the scan page with the
 * project pre-selected — the scan page is the canonical
 * place to scan OR type a code, so the add button takes
 * you there with a "create a material for project X" hint.
 */
export async function InventoryTab({
  workspaceSlug,
  projectId,
}: {
  workspaceSlug: string;
  projectId: string;
}) {
  const [materials, equipment] = await Promise.all([
    listProjectMaterials(projectId),
    listProjectEquipment(projectId),
  ]);

  // We also need the project's name to show in the empty
  // state copy ("scan a code to add to THIS project").
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { name: true },
  });

  const totalMaterialsCount = materials.length;
  const totalEquipmentCount = equipment.length;
  const totalValue = materials.reduce(
    (acc, m) => acc + (m.unitCost ? Number(m.unitCost) * Number(m.quantity) : 0),
    0,
  );

  return (
    <div>
      {/* Header row with KPIs + add buttons */}
      <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
        <div className="flex gap-4">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50">
              Materials
            </div>
            <div className="text-2xl font-black">{totalMaterialsCount}</div>
          </div>
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50">
              Equipment
            </div>
            <div className="text-2xl font-black">{totalEquipmentCount}</div>
          </div>
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50">
              Material value
            </div>
            <div className="text-2xl font-black">${totalValue.toLocaleString()}</div>
          </div>
        </div>
        <div className="flex gap-2">
          <a
            href={`/w/${workspaceSlug}/scan?code=&hint=material&projectId=${projectId}`}
            className="px-3 py-1.5 bg-orange text-paper text-[11px] font-extrabold uppercase tracking-[0.1em] hover:bg-orange-d"
          >
            + Material
          </a>
          <a
            href={`/w/${workspaceSlug}/scan?code=&hint=equipment&projectId=${projectId}`}
            className="px-3 py-1.5 bg-ink text-paper text-[11px] font-extrabold uppercase tracking-[0.1em] hover:bg-orange-d"
          >
            + Equipment
          </a>
        </div>
      </div>

      {totalMaterialsCount === 0 && totalEquipmentCount === 0 ? (
        <EmptyState projectName={project?.name ?? 'this project'} workspaceSlug={workspaceSlug} />
      ) : (
        <div className="space-y-6">
          {totalMaterialsCount > 0 ? (
            <MaterialTable rows={materials} />
          ) : null}
          {totalEquipmentCount > 0 ? (
            <EquipmentTable rows={equipment} />
          ) : null}
        </div>
      )}
    </div>
  );
}

function EmptyState({
  projectName,
  workspaceSlug,
}: {
  projectName: string;
  workspaceSlug: string;
}) {
  return (
    <div className="border border-line bg-paper p-8 md:p-12 text-center">
      <div className="text-4xl mb-3">📦</div>
      <h3 className="text-lg font-black mb-2">No inventory yet</h3>
      <p className="text-sm text-ink-70 max-w-md mx-auto mb-5">
        Scan a barcode or QR code to log a material delivery or equipment
        checkout on <strong>{projectName}</strong>. We&apos;ll link the code
        to this project automatically.
      </p>
      <a
        href={`/w/${workspaceSlug}/scan`}
        className="inline-block px-4 py-2 bg-orange text-paper text-xs font-extrabold uppercase tracking-[0.1em] hover:bg-orange-d"
      >
        Open scanner
      </a>
    </div>
  );
}

function MaterialTable({ rows }: { rows: Awaited<ReturnType<typeof listProjectMaterials>> }) {
  return (
    <div>
      <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-ink-50 mb-2">
        {'// Materials'}
      </div>
      <div className="border border-line bg-paper overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead className="bg-cream-2 text-ink-50 text-[10px] font-mono uppercase tracking-[0.1em]">
            <tr>
              <th className="text-left px-3 py-2">Code</th>
              <th className="text-left px-3 py-2">Name</th>
              <th className="text-left px-3 py-2">Unit</th>
              <th className="text-right px-3 py-2">Qty</th>
              <th className="text-right px-3 py-2">Unit $</th>
              <th className="text-right px-3 py-2">Total $</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((m) => {
              const total = m.unitCost ? Number(m.unitCost) * Number(m.quantity) : 0;
              return (
                <tr key={m.id}>
                  <td className="px-3 py-2 font-mono text-ink-70">{m.code}</td>
                  <td className="px-3 py-2 font-semibold text-ink">
                    {m.name}
                    {m.description ? (
                      <div className="text-[10px] text-ink-50 font-normal mt-0.5">
                        {m.description}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-ink-70 font-mono">{m.unit}</td>
                  <td className="px-3 py-2 text-right text-ink font-mono">
                    {Number(m.quantity).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right text-ink-70 font-mono">
                    {m.unitCost ? `$${Number(m.unitCost).toFixed(2)}` : '—'}
                  </td>
                  <td className="px-3 py-2 text-right text-ink font-mono font-semibold">
                    {total > 0 ? `$${total.toFixed(2)}` : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EquipmentTable({ rows }: { rows: Awaited<ReturnType<typeof listProjectEquipment>> }) {
  return (
    <div>
      <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-ink-50 mb-2">
        {'// Equipment'}
      </div>
      <div className="border border-line bg-paper overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead className="bg-cream-2 text-ink-50 text-[10px] font-mono uppercase tracking-[0.1em]">
            <tr>
              <th className="text-left px-3 py-2">Code</th>
              <th className="text-left px-3 py-2">Name</th>
              <th className="text-left px-3 py-2">Serial</th>
              <th className="text-left px-3 py-2">Condition</th>
              <th className="text-right px-3 py-2">Qty</th>
              <th className="text-right px-3 py-2">Unit $</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((e) => (
              <tr key={e.id}>
                <td className="px-3 py-2 font-mono text-ink-70">{e.code}</td>
                <td className="px-3 py-2 font-semibold text-ink">
                  {e.name}
                  {e.description ? (
                    <div className="text-[10px] text-ink-50 font-normal mt-0.5">
                      {e.description}
                    </div>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-ink-70 font-mono">
                  {e.serialNumber ?? '—'}
                </td>
                <td className="px-3 py-2 text-ink-70">
                  <ConditionPill condition={e.condition} />
                </td>
                <td className="px-3 py-2 text-right text-ink font-mono">{e.quantity}</td>
                <td className="px-3 py-2 text-right text-ink-70 font-mono">
                  {e.unitCost ? `$${Number(e.unitCost).toFixed(2)}` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ConditionPill({ condition }: { condition: string }) {
  const map: Record<string, string> = {
    NEW: 'bg-success/15 text-success',
    GOOD: 'bg-success/10 text-success',
    FAIR: 'bg-warning/15 text-warning',
    POOR: 'bg-error/15 text-error',
  };
  return (
    <span className={`text-[10px] font-mono uppercase tracking-[0.1em] px-1.5 py-0.5 ${map[condition] ?? 'bg-paper-2 text-ink-50'}`}>
      {condition}
    </span>
  );
}
