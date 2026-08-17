import { prisma } from '@/lib/db/client';
import { listTasks } from '@/lib/tasks/queries';
import { requireMembership } from '@/lib/auth/require-membership';
import { TaskBoard, type TaskCard } from './TaskBoard';

export default async function TasksPage({
  params,
}: {
  params: { workspace: string };
}) {
  const { workspace } = await requireMembership(params.workspace);

  const [tasks, team, projects, clients] = await Promise.all([
    listTasks(workspace.id),
    prisma.user.findMany({
      where: { memberships: { some: { workspaceId: workspace.id } } },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
    prisma.project.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
    prisma.client.findMany({
      where: { workspaceId: workspace.id, status: 'ACTIVE' },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div className="p-8">
      <div className="text-xs font-mono font-bold tracking-[0.2em] text-orange-d uppercase mb-5 flex items-center gap-3">
        <span className="w-8 h-8 bg-orange text-white rounded-full inline-flex items-center justify-center font-black text-sm">
          7
        </span>
        Tasks
      </div>
      <h1 className="text-display-lg mb-4">
        The <span className="font-serif italic text-orange-d">work,</span> visible.
      </h1>
      <p className="text-base text-ink-70 max-w-xl mb-7">
        {tasks.length} task{tasks.length === 1 ? '' : 's'} across the team. Move a card by clicking
        any of the status buttons on the card itself.
      </p>

      <TaskBoard
        workspaceSlug={params.workspace}
        tasks={tasks.map<TaskCard>((t) => ({
          id: t.id,
          title: t.title,
          description: t.description,
          status: t.status as 'TODO' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE' | 'CANCELLED',
          priority: t.priority as 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT',
          dueDate: t.dueDate,
          assignee: t.assignee,
          project: t.project,
          client: t.client,
        }))}
        team={team}
        projects={projects}
        clients={clients}
      />
    </div>
  );
}
