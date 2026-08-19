/**
 * Section 03 — Schedule of Values.
 *
 * A single table that lists every division in the project. The
 * table has a header row (light gray), one row per division, and
 * a totals row in dark ink at the bottom — the same visual
 * language as the in-app /sov page, so the PDF and the web
 * view feel like the same document.
 *
 * Sub rows whose `subLinks[0]` is the linked subcontractor show
 * the sub name; otherwise they show the manual `subcontractorName`
 * field (e.g. "Carpenters Union"); otherwise an em dash.
 */
import { Text, View, StyleSheet } from '@react-pdf/renderer';
import { colors, font, spacing } from '../styles';
import { fmtUsd, num } from '../utils';
import { SectionTitle } from './shared/SectionTitle';
import type { ProjectData } from '../types';

export function SovSection({ data }: { data: ProjectData }) {
  const totalBudget = data.divisions.reduce((acc, d) => acc + num(d.budget), 0);
  const totalBilled = data.payApps
    .filter((p) => p.status === 'PAID' || p.status === 'ACKNOWLEDGED' || p.status === 'VIEWED' || p.status === 'SENT')
    .reduce(
      (acc, p) => acc + num(p.totalThisDraw),
      0,
    );
  const totalRemaining = totalBudget - totalBilled;

  return (
    <View>
      <SectionTitle
        eyebrow="// SECTION 03 · SCHEDULE OF VALUES"
        title="Every line item"
        subtitle={`${fmtUsd(totalBudget)} budgeted across ${data.divisions.length} division${data.divisions.length === 1 ? '' : 's'}`}
      />

      <View style={styles.table}>
        {/* Header */}
        <View style={[styles.row, styles.headerRow]}>
          <Text style={[styles.cell, styles.cellCode, styles.headerText]}>Code</Text>
          <Text style={[styles.cell, styles.cellTrade, styles.headerText]}>Trade</Text>
          <Text style={[styles.cell, styles.cellSub, styles.headerText]}>Subcontractor</Text>
          <Text style={[styles.cell, styles.cellNum, styles.headerText, { textAlign: 'right' }]}>Budget</Text>
          <Text style={[styles.cell, styles.cellNum, styles.headerText, { textAlign: 'right' }]}>Billed</Text>
          <Text style={[styles.cell, styles.cellNum, styles.headerText, { textAlign: 'right' }]}>Remaining</Text>
        </View>
        {/* Body */}
        {data.divisions.map((d) => {
          // Billed = sum of all payAppLines on this division
          // across every pay app.
          const billed = d.payAppLines.reduce((acc, l) => acc + num(l.thisDrawAmount), 0);
          const budget = num(d.budget);
          const remaining = budget - billed;
          const linkedSub = d.subLinks?.[0]?.assignment?.subcontractor;
          const subDisplay = linkedSub?.name ?? d.subcontractorName ?? '—';
          return (
            <View key={d.id} style={styles.row}>
              <Text style={[styles.cell, styles.cellCode, styles.codeText]}>{d.code}</Text>
              <Text style={[styles.cell, styles.cellTrade]}>{d.trade}</Text>
              <Text style={[styles.cell, styles.cellSub]}>{subDisplay}</Text>
              <Text style={[styles.cell, styles.cellNum, { textAlign: 'right' }]}>{fmtUsd(budget)}</Text>
              <Text style={[styles.cell, styles.cellNum, { textAlign: 'right' }]}>{fmtUsd(billed)}</Text>
              <Text style={[styles.cell, styles.cellNum, { textAlign: 'right' }]}>{fmtUsd(remaining)}</Text>
            </View>
          );
        })}
        {/* Totals */}
        <View style={[styles.row, styles.totalRow]}>
          <Text style={[styles.cell, { color: colors.paper, fontFamily: 'Helvetica-Bold' }, { width: '40%' }]}>TOTALS</Text>
          <Text style={[styles.cell, styles.cellNum, { textAlign: 'right', color: colors.paper, fontFamily: 'Helvetica-Bold' }]}>{fmtUsd(totalBudget)}</Text>
          <Text style={[styles.cell, styles.cellNum, { textAlign: 'right', color: colors.paper, fontFamily: 'Helvetica-Bold' }]}>{fmtUsd(totalBilled)}</Text>
          <Text style={[styles.cell, styles.cellNum, { textAlign: 'right', color: colors.paper, fontFamily: 'Helvetica-Bold' }]}>{fmtUsd(totalRemaining)}</Text>
        </View>
      </View>
    </View>
  );
}

// Column widths sum to 100% of table width.
const styles = StyleSheet.create({
  table: {
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: colors.lineSoft,
  },
  headerRow: {
    backgroundColor: colors.paper2,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  totalRow: {
    backgroundColor: colors.ink,
    borderBottomWidth: 0,
  },
  cell: {
    padding: spacing.sm,
    fontSize: font.sizeMd,
    color: colors.ink,
  },
  cellCode: { width: '8%' },
  cellTrade: { width: '24%' },
  cellSub: { width: '24%' },
  cellNum: { width: '14%' },
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
});
