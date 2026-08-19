/**
 * Section 10 — Notes.
 *
 * Quoted cards with author + date in the header and the body
 * below. The orange left-border ties back to the brand and
 * makes each note visually distinct from the table-style
 * sections.
 *
 * Notes are pre-sorted by the caller (route handler) so the
 * PDF just renders them in order. We cap at 5 to keep this
 * section a single page; the activity log right after captures
 * the longer-term history.
 */
import { Text, View, StyleSheet } from '@react-pdf/renderer';
import { colors, font, spacing } from '../styles';
import { fmtDate } from '../utils';
import { SectionTitle } from './shared/SectionTitle';
import type { ProjectData } from '../types';

const MAX_NOTES = 5;

export function NotesSection({ data }: { data: ProjectData }) {
  const notes = data.notes.slice(0, MAX_NOTES);

  return (
    <View>
      <SectionTitle
        eyebrow="// SECTION 10 · NOTES"
        title="Project notes"
        subtitle={notes.length === 0 ? 'No notes yet' : `${notes.length} most recent`}
      />

      {notes.length === 0 ? (
        <Text style={styles.empty}>No notes yet. The first one goes here.</Text>
      ) : (
        notes.map((n) => (
          <View key={n.id} style={styles.card} wrap={false}>
            <View style={styles.head}>
              <Text style={styles.author}>{n.user.name ?? n.user.email}</Text>
              <Text style={styles.date}>{fmtDate(n.createdAt)}</Text>
            </View>
            <Text style={styles.body}>{n.body}</Text>
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
  card: {
    backgroundColor: colors.paper2,
    borderLeftWidth: 3,
    borderLeftColor: colors.orange,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  author: {
    fontSize: font.sizeMd,
    fontFamily: 'Helvetica-Bold',
    color: colors.ink,
  },
  date: {
    fontSize: font.sizeSm,
    color: colors.ink50,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 0.5,
  },
  body: {
    fontSize: font.sizeMd,
    color: colors.ink,
    lineHeight: 1.5,
  },
});
