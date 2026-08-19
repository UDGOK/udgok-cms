/**
 * Section 06 — Team.
 *
 * Members displayed in a 2-column grid of avatar cards. Each
 * card has a 2-letter initial in a colored square plus the
 * member name and email. The colors rotate through the brand
 * palette so a 4-person team has visual variety without
 * competing for attention.
 */
import { Text, View, StyleSheet } from '@react-pdf/renderer';
import { colors, font, spacing } from '../styles';
import { initials } from '../utils';
import { SectionTitle } from './shared/SectionTitle';
import type { ProjectData } from '../types';

const AVATAR_COLORS = [colors.ink, colors.orange, colors.ink70, colors.warning, colors.info];

export function TeamSection({ data }: { data: ProjectData }) {
  return (
    <View>
      <SectionTitle
        eyebrow="// SECTION 06 · TEAM"
        title="The crew"
        subtitle={`${data.members.length} member${data.members.length === 1 ? '' : 's'}`}
      />

      {data.members.length === 0 ? (
        <Text style={styles.empty}>No team members assigned yet.</Text>
      ) : (
        <View style={styles.grid}>
          {data.members.map((m, idx) => {
            const avatarColor = AVATAR_COLORS[idx % AVATAR_COLORS.length];
            return (
              <View key={m.userId} style={styles.card}>
                <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
                  <Text style={styles.avatarText}>{initials(m.user.name)}</Text>
                </View>
                <View style={styles.info}>
                  <Text style={styles.name}>{m.user.name ?? 'Unknown'}</Text>
                  <Text style={styles.email}>{m.user.email}</Text>
                  {m.role ? <Text style={styles.role}>{m.role}</Text> : null}
                </View>
              </View>
            );
          })}
        </View>
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  card: {
    width: '50%',
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.paper2,
    borderWidth: 0.5,
    borderColor: colors.lineSoft,
    marginBottom: spacing.sm,
    paddingRight: spacing.lg,
  },
  avatar: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  avatarText: {
    color: colors.paper,
    fontSize: font.sizeMd,
    fontFamily: 'Helvetica-Bold',
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: font.sizeMd,
    fontFamily: 'Helvetica-Bold',
    color: colors.ink,
  },
  email: {
    fontSize: font.sizeSm,
    color: colors.ink50,
  },
  role: {
    fontSize: font.sizeXs,
    color: colors.orange,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 1,
    marginTop: 2,
  },
});
