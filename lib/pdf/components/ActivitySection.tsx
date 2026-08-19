/**
 * Section 11 — Activity log.
 *
 * The 12 most recent activity rows for the project. We render
 * them as a compact timeline: timestamp · colored dot ·
 * human-readable description. The dot color hints at the
 * activity type (orange for uploads, green for completions,
 * neutral for everything else).
 */
import { Text, View, StyleSheet } from '@react-pdf/renderer';
import { colors, font, spacing } from '../styles';
import { fmtDateTime } from '../utils';
import { SectionTitle } from './shared/SectionTitle';
import type { ProjectData } from '../types';

const MAX_ROWS = 12;

function dotColor(action: string, entityType: string): string {
  // Upload-style events get orange; completion-style events get
  // green; warnings get warning yellow; everything else is ink.
  if (action === 'uploaded' || action === 'created' && entityType === 'photo') return colors.orange;
  if (action === 'updated' && entityType === 'task') return colors.success;
  if (action === 'sent') return colors.info;
  if (action === 'paid' || action === 'acknowledged') return colors.success;
  if (action === 'deleted') return colors.error;
  if (action === 'disputed') return colors.warning;
  return colors.ink;
}

function actorName(actor: { name: string | null; email: string } | null): string {
  if (!actor) return 'System';
  return actor.name ?? actor.email;
}

function humanize(action: string, entityName: string | null, details: string | null): string {
  // The activity details string is the human description the in-app
  // activity log already produces. We use it verbatim when present;
  // otherwise we fall back to a constructed string from the action.
  if (details && details.length > 0) return details;
  if (entityName) {
    return `${action} ${entityName}`;
  }
  return action;
}

export function ActivitySection({ data }: { data: ProjectData }) {
  const rows = data.activity.slice(0, MAX_ROWS);

  return (
    <View>
      <SectionTitle
        eyebrow="// SECTION 11 · ACTIVITY"
        title="Recent activity"
        subtitle={rows.length === 0 ? 'No activity yet' : `Last ${rows.length} events`}
      />

      {rows.length === 0 ? (
        <Text style={styles.empty}>No activity yet. Events appear here as the project is worked on.</Text>
      ) : (
        rows.map((r) => (
          <View key={r.id} style={styles.row} wrap={false}>
            <Text style={styles.date}>{fmtDateTime(r.createdAt)}</Text>
            <View style={[styles.dot, { backgroundColor: dotColor(r.action, r.entityType) }]} />
            <Text style={styles.text}>
              <Text style={{ fontFamily: 'Helvetica-Bold' }}>{actorName(r.actor)}</Text>
              {' '}
              {humanize(r.action, r.entityName, r.details)}
            </Text>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    fontSize: font.sizeMd,
    color: colors.ink50,
    fontStyle: 'italic',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.lineSoft,
  },
  date: {
    width: 100,
    fontSize: font.sizeSm,
    fontFamily: 'Helvetica-Bold',
    color: colors.ink50,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: spacing.sm,
  },
  text: {
    flex: 1,
    fontSize: font.sizeMd,
    color: colors.ink,
  },
});
