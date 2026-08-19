import { notFound } from 'next/navigation';
import { getPayAppByShareToken } from '@/lib/pay-apps/queries';
import { PublicPayAppView } from './PublicPayAppView';

export const dynamic = 'force-dynamic';

export default async function PublicPayAppPage({
  params,
}: {
  params: { token: string };
}) {
  const payApp = await getPayAppByShareToken(params.token);
  if (!payApp) notFound();

  // Convert Prisma Decimal -> number for the client component
  const data = {
    id: payApp.id,
    drawNumber: payApp.drawNumber,
    periodStart: payApp.periodStart,
    periodEnd: payApp.periodEnd,
    status: payApp.status,
    totalContract: Number(payApp.totalContract),
    totalPrevious: Number(payApp.totalPrevious),
    totalThisDraw: Number(payApp.totalThisDraw),
    totalBalance: Number(payApp.totalBalance),
    notes: payApp.notes,
    project: {
      name: payApp.project.name,
      code: payApp.project.code,
      client: payApp.project.client ? { name: payApp.project.client.name } : null,
    },
    allDraws: payApp.allDraws.map((d) => ({
      drawNumber: d.drawNumber,
      totalThisDraw: Number(d.totalThisDraw),
    })),
    divisions: payApp.divisions.map((d) => ({
      id: d.id,
      previousAmount: Number(d.previousAmount),
      thisDrawAmount: Number(d.thisDrawAmount),
      balanceAfter: Number(d.balanceAfter),
      budget: Number(d.projectDivision.budget),
      projectDivision: {
        code: d.projectDivision.code,
        trade: d.projectDivision.trade,
        subcontractorName: d.projectDivision.subcontractorName,
        linkedSubName: d.projectDivision.subLinks?.[0]?.assignment?.subcontractor?.name ?? null,
      },
    })),
  };

  return <PublicPayAppView payApp={data} shareToken={params.token} />;
}
