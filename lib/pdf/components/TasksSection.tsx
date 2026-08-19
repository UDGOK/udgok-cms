/**
 * Section 05 — Tasks.
 *
 * Tasks are grouped by status (In Progress → To Do → Done →
 * Cancelled). Within each group they're sorted by due date with
 * nulls last, so the most-urgent items are at the top.
 *
 * The "In Progress" group gets an orange accent to make it
 * pop — that's where attention is wanted. Done rows are
 * strike-through and dim.
 */
import { Text, View, StyleSheet } from '@react-pdf/renderer';
import { colors, font, spacing } from '../styles';
import { fmtDate, taskStatusInfo } from '../utils';
import { SectionTitle } from './shared/SectionTitle';
import type { ProjectData } from '../types';

type Group = {
  key: string;
  label: string;
  tasks: ProjectData['tasks'];
};

function groupTasks(tasks: ProjectData['tasks']): Group[] {
  const order: Array<{ key: string; label: string }> = [
    { key: 'IN_PROGRESS', label: 'In progress' },
    { key: 'TODO', label: 'To do' },
    { key: 'BLOCKED', label: 'Blocked' },
    { key: 'DONE', label: 'Done' },
    { key: 'CANCELLED', label: 'Cancelled' },
  ];
  return order
    .map((o) => ({
      ...o,
      tasks: tasks
        .filter((t) => t.status === o.key)
        .sort((a, b) => {
          const at = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
          const bt = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
          return at - bt;
        }),
    }))
    .filter((g) => g.tasks.length > 0);
}

function priorityLabel(priority: string): string {
  return priority.charAt(0).toUpperCase() + priority.slice(1).toLowerCase();
}

export function TasksSection({ data }: { data: ProjectData }) {
  const groups = groupTasks(data.tasks);
  const inProgress = data.tasks.filter((t) => t.status === 'IN_PROGRESS').length;
  const done = data.tasks.filter((t) => t.status === 'DONE' || t.status === 'CANCELLED').length;

  return (
    <View>
      <SectionTitle
        eyebrow="// SECTION 05 · TASKS"
        title={`${data.tasks.length} task${data.tasks.length === 1 ? '' : 's'} · ${done} done · ${inProgress} in progress`}
        subtitle="Sorted by due date, with the most-urgent at the top of each group"
      />

      {groups.length === 0 ? (
        <Text style={styles.empty}>No tasks yet. Add the first one from the Tasks tab.</Text>
      ) : null}

      {groups.map((g) => (
        <View key={g.key} style={styles.group}>
          <View style={styles.groupHead}>
            <Text style={[styles.groupLabel, taskStatusInfo(g.key).color === colors.orange ? { color: colors.orange } : {}]}>
              {g.label.toUpperCase()}
            </Text>
            <Text style={styles.groupCount}>{g.tasks.length}</Text>
          </View>
          {g.tasks.slice(0, 8).map((t) => {
            const isDone = t.status === 'DONE' || t.status === 'CANCELLED';
            return (
              <View key={t.id} style={styles.taskRow} wrap={false}>
                <View style={[styles.check, isDone ? styles.checkDone : {}]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.title, isDone ? styles.titleDone : {}]}>{t.title}</Text>
                  <Text style={styles.meta}>
                    {t.assignee?.name ?? 'Unassigned'} · {priorityLabel(t.priority)} priority
                    {t.dueDate ? ` · due ${fmtDate(t.dueDate)}` : ''}
                  </Text>
                </View>
              </View>
            );
          })}
          {g.tasks.length > 8 ? (
            <Text style={styles.more}>
              + {g.tasks.length - 8} more in this group
            </Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    fontSize: font.sizeMd,
    color: colors.ink50,
    fontStyle: 'italic',
  },
  group: {
    marginBottom: spacing.lg,
  },
  groupHead: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  groupLabel: {
    fontSize: font.sizeMd,
    color: colors.ink50,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 1.2,
    marginRight: spacing.sm,
  },
  groupCount: {
    fontSize: font.sizeMd,
    fontFamily: 'Helvetica-Bold',
    color: colors.ink,
    backgroundColor: colors.paper2,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing.sm,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.lineSoft,
  },
  check: {
    width: 12,
    height: 12,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.paper,
    marginRight: spacing.md,
    marginTop: 2,
  },
  checkDone: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  title: {
    fontSize: font.sizeMd,
    color: colors.ink,
  },
  titleDone: {
    color: colors.ink50,
    textDecoration: 'line-through',
  },
  meta: {
    fontSize: font.sizeSm,
    color: colors.ink50,
    marginTop: 2,
  },
  more: {
    fontSize: font.sizeSm,
    color: colors.ink50,
    fontStyle: 'italic',
    paddingVertical: spacing.sm,
  },
});
