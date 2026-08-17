import { prisma } from '@/lib/db/client';

export interface TeamWithMembers {
  id: string;
  name: string;
  color: string;
  icon: string;
  description: string | null;
  members: Array<{
    userId: string;
    name: string | null;
    email: string;
    role: 'LEAD' | 'MEMBER';
  }>;
}

export async function listTeams(workspaceId: string): Promise<TeamWithMembers[]> {
  const teams = await prisma.team.findMany({
    where: { workspaceId },
    orderBy: { name: 'asc' },
    include: {
      members: {
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: [{ role: 'asc' }, { user: { name: 'asc' } }],
      },
    },
  });
  return teams.map((t) => ({
    id: t.id,
    name: t.name,
    color: t.color,
    icon: t.icon,
    description: t.description,
    members: t.members.map((m) => ({
      userId: m.user.id,
      name: m.user.name,
      email: m.user.email,
      role: m.role as 'LEAD' | 'MEMBER',
    })),
  }));
}
