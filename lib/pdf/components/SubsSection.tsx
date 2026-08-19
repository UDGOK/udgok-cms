/**
 * Section 07 — Subcontractors.
 *
 * Table layout: code · subcontractor · primary trade · status ·
 * value (the sum of division budgets linked to this sub).
 *
 * Status uses a small pill so the eye can scan the column for
 * who is still "Contracted" vs who is "Active". The value
 * column gives the financial weight — useful for spotting the
 * largest trade partners at a glance.
 */
import { Text, View, StyleSheet } from '@react-pdf/renderer';
import { colors, font, spacing } from '../styles';
import { fmtUsd, num, subStatusColor, subStatusLabel } from '../utils';
import { SectionTitle } from './shared/SectionTitle';
import { Pill } from './shared/Pill';
import type { ProjectData } from '../types';

export function SubsSection({ data }: { data: ProjectData }) {
  // Compute the value each sub represents by summing the budgets
  // of the divisions linked to them. SubLink → assignment →
  // divisionLinks. We group by sub id to avoid double counting
  // when a sub is linked to multiple divisions.
  const valueBySub = new Map<string, number>();
  data.divisions.forEach((d) => {
    d.subLinks.forEach((link) => {
      const subId = link.assignment.subcontractor.id;
      const current = valueBySub.get(subId) ?? 0;
      valueBySub.set(subId, current + num(d.budget));
    });
  });

  return (
    <View>
      <SectionTitle
        eyebrow="// SECTION 07 · SUBCONTRACTORS"
        title="Trade partners"
        subtitle={`${data.subAssignments.length} subcontractor${data.subAssignments.length === 1 ? '' : 's'}`}
      />

      {data.subAssignments.length === 0 ? (
        <Text style={styles.empty}>No subcontractors yet.</Text>
      ) : (
        <View style={styles.table}>
          {/* Header */}
          <View style={[styles.row, styles.headerRow]}>
            <Text style={[styles.cell, styles.codeCol, styles.headerText]}>Code</Text>
            <Text style={[styles.cell, styles.nameCol, styles.headerText]}>Subcontractor</Text>
            <Text style={[styles.cell, styles.tradeCol, styles.headerText]}>Primary trade</Text>
            <Text style={[styles.cell, styles.statusCol, styles.headerText]}>Status</Text>
            <Text style={[styles.cell, styles.valueCol, styles.headerText, { textAlign: 'right' }]}>Value</Text>
          </View>
          {data.subAssignments.map((a) => {
            // The first division code (if any) is the "primary"
            // trade code; falls back to the sub's primaryTrade.
            const primaryCode = a.divisionLinks[0]?.division?.code ?? '';
            const primaryTrade = a.subcontractor.primaryTrade ?? '—';
            const value = valueBySub.get(a.subcontractor.id) ?? 0;
            return (
              <View key={a.id} style={styles.row}>
                <Text style={[styles.cell, styles.codeCol, styles.codeText]}>
                  {primaryCode}
                </Text>
                <Text style={[styles.cell, styles.nameCol, styles.nameText]}>
                  {a.subcontractor.name}
                </Text>
                <Text style={[styles.cell, styles.tradeCol]}>
                  {primaryTrade}
                </Text>
                <View style={[styles.cell, styles.statusCol]}>
                  <Pill label={subStatusLabel(a.status)} background={subStatusColor(a.status)} />
                </View>
                <Text style={[styles.cell, styles.valueCol, { textAlign: 'right' }]}>
                  {fmtUsd(value)}
                </Text>
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
  table: { width: '100%' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 0.5,
    borderBottomColor: colors.lineSoft,
    paddingVertical: spacing.sm,
  },
  headerRow: {
    backgroundColor: colors.paper2,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    paddingVertical: spacing.sm,
  },
  cell: {
    paddingHorizontal: spacing.sm,
    fontSize: font.sizeMd,
    color: colors.ink,
  },
  codeCol: { width: '10%' },
  nameCol: { width: '32%' },
  tradeCol: { width: '24%' },
  statusCol: { width: '18%' },
  valueCol: { width: '16%' },
  headerText: {
    fontSize: font.sizeXs,
    color: colors.ink50,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 1.2,
  },
  codeText: {
    fontFamily: 'Helvetica-Bold',
    color: colors.orange,
  },
  nameText: {
    fontFamily: 'Helvetica-Bold',
  },
});
