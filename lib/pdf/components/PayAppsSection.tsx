/**
 * Section 04 — Pay Applications.
 *
 * Each pay app is rendered as a card with a header (draw number,
 * period, status pill) and a 4-column grid of numbers
 * (contract · previous · this draw · balance).
 *
 * The "This draw" cell uses a large serif number in orange
 * because that's the headline value — the client wants to see
 * the new draw amount pop.
 */
import { Text, View, StyleSheet } from '@react-pdf/renderer';
import { colors, font, spacing } from '../styles';
import { fmtUsd, fmtDate, num, payAppStatusColor, payAppStatusLabel } from '../utils';
import { SectionTitle } from './shared/SectionTitle';
import { Pill } from './shared/Pill';
import type { ProjectData } from '../types';

function formatPeriod(start: Date | string, end: Date | string): string {
  return `${fmtDate(start)} — ${fmtDate(end)}`;
}

export function PayAppsSection({ data }: { data: ProjectData }) {
  // Sort by drawNumber descending so the most recent draw is on top.
  const sorted = [...data.payApps].sort((a, b) => b.drawNumber - a.drawNumber);
  const cumulativeBilled = data.payApps
    .filter((p) => p.status === 'PAID' || p.status === 'ACKNOWLEDGED' || p.status === 'VIEWED' || p.status === 'SENT')
    .reduce((acc, p) => acc + num(p.totalThisDraw), 0);

  return (
    <View>
      <SectionTitle
        eyebrow="// SECTION 04 · PAY APPLICATIONS"
        title="Every draw, every status"
        subtitle={`${data.payApps.length} pay application${data.payApps.length === 1 ? '' : 's'} · ${fmtUsd(cumulativeBilled)} cumulative billed`}
      />

      {sorted.length === 0 ? (
        <Text style={styles.empty}>No pay applications yet. Generate the first draw from the project page.</Text>
      ) : (
        sorted.map((p) => {
          const contract = num(p.totalContract);
          const previous = num(p.totalPrevious);
          const thisDraw = num(p.totalThisDraw);
          const balance = Math.max(0, contract - previous - thisDraw);
          return (
            <View key={p.id} style={styles.card} wrap={false}>
              <View style={styles.cardHead}>
                <Text style={styles.cardTitle}>
                  <Text style={styles.drawNum}>DRAW #{p.drawNumber}</Text>
                  <Text>  {formatPeriod(p.periodStart, p.periodEnd)}</Text>
                </Text>
                <Pill label={payAppStatusLabel(p.status)} background={payAppStatusColor(p.status)} />
              </View>
              <View style={styles.grid}>
                <View style={styles.cell}>
                  <Text style={styles.lbl}>CONTRACT</Text>
                  <Text style={styles.val}>{fmtUsd(contract)}</Text>
                </View>
                <View style={styles.cell}>
                  <Text style={styles.lbl}>PREVIOUS</Text>
                  <Text style={styles.val}>{fmtUsd(previous)}</Text>
                </View>
                <View style={styles.cell}>
                  <Text style={styles.lbl}>THIS DRAW</Text>
                  <Text style={styles.valBig}>{fmtUsd(thisDraw)}</Text>
                </View>
                <View style={styles.cell}>
                  <Text style={styles.lbl}>BALANCE</Text>
                  <Text style={styles.val}>{fmtUsd(balance)}</Text>
                </View>
              </View>
              {p.acknowledgedByName ? (
                <Text style={styles.ackNote}>
                  Acknowledged by {p.acknowledgedByName} on {fmtDate(p.acknowledgedAt)}
                </Text>
              ) : null}
            </View>
          );
        })
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
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cardHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: spacing.sm,
    marginBottom: spacing.sm,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.lineSoft,
  },
  cardTitle: {
    fontSize: font.sizeLg,
    fontFamily: 'Helvetica-Bold',
    color: colors.ink,
  },
  drawNum: {
    fontFamily: 'Helvetica-Bold',
    fontSize: font.sizeMd,
    color: colors.ink50,
    marginRight: 6,
    letterSpacing: 1,
  },
  grid: {
    flexDirection: 'row',
  },
  cell: {
    flex: 1,
    paddingRight: spacing.md,
  },
  lbl: {
    fontSize: font.sizeXs,
    color: colors.ink50,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 1.2,
    marginBottom: 3,
  },
  val: {
    fontSize: font.sizeLg,
    fontFamily: 'Helvetica-Bold',
    color: colors.ink,
  },
  valBig: {
    fontSize: font.sizeXl,
    fontFamily: 'Times-Bold',
    color: colors.orange,
  },
  ackNote: {
    fontSize: font.sizeSm,
    color: colors.ink50,
    fontStyle: 'italic',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 0.5,
    borderTopColor: colors.lineSoft,
  },
});
