/**
 * Section 02 — Overview.
 *
 * Top half: 4 KPI tiles (Contract, Billed, Remaining, Days left).
 * Bottom half: meta grid + completion breakdown card.
 *
 * The KPI tiles share a single bordered box (one outer border
 * with internal vertical dividers) so the row reads as a unit
 * rather than 4 disconnected cards. The visual is closer to
 * a financial dashboard than a stack of stat blocks.
 */
import { Text, View, StyleSheet } from '@react-pdf/renderer';
import { colors, font, spacing } from '../styles';
import { fmtUsd } from '../utils';
import { SectionTitle } from './shared/SectionTitle';
import type { ProjectData } from '../types';

export function OverviewSection({ data }: { data: ProjectData }) {
  const c = data.completion;
  const totalBudget = data.divisions.reduce((acc, d) => acc + Number(d.budget), 0);
  return (
    <View>
      <SectionTitle
        eyebrow="// SECTION 02 · OVERVIEW"
        title="The project at a glance"
        subtitle="Key numbers · location · completion breakdown"
      />

      {/* KPI row */}
      <View style={styles.kpiRow}>
        <View style={styles.kpiCell}>
          <Text style={styles.lbl}>CONTRACT</Text>
          <Text style={styles.val}>{fmtUsd(c.contractValue)}</Text>
        </View>
        <View style={styles.kpiCell}>
          <Text style={styles.lbl}>BILLED</Text>
          <Text style={[styles.val, { color: colors.success }]}>{fmtUsd(c.totalBilled)}</Text>
          <Text style={styles.sub}>{c.financial}% of contract</Text>
        </View>
        <View style={styles.kpiCell}>
          <Text style={styles.lbl}>REMAINING</Text>
          <Text style={[styles.val, { color: colors.orangeD }]}>{fmtUsd(c.remaining)}</Text>
        </View>
        <View style={[styles.kpiCell, { borderRightWidth: 0 }]}>
          <Text style={styles.lbl}>DAYS LEFT</Text>
          <Text style={styles.val}>{c.daysRemaining ?? '—'}</Text>
          {c.daysTotal != null ? (
            <Text style={styles.sub}>of {c.daysTotal} day timeline</Text>
          ) : null}
        </View>
      </View>

      {/* Meta grid (project facts). */}
      <View style={styles.metaGrid}>
        <View style={styles.metaRow}>
          <Text style={styles.metaLbl}>PROJECT NAME</Text>
          <Text style={styles.metaVal}>{data.name}</Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaLbl}>CLIENT</Text>
          <Text style={styles.metaVal}>{data.client?.name ?? '—'}</Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaLbl}>START DATE</Text>
          <Text style={styles.metaVal}>{data.startDate ? new Date(data.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaLbl}>END DATE</Text>
          <Text style={styles.metaVal}>{data.endDate ? new Date(data.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</Text>
        </View>
        <View style={[styles.metaRow, { width: '100%' }]}>
          <Text style={styles.metaLbl}>ADDRESS</Text>
          <Text style={styles.metaVal}>
            {[data.address, data.city, data.state, data.zip].filter(Boolean).join(', ') || '—'}
          </Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaLbl}>LOCATION</Text>
          <Text style={styles.metaVal}>
            {data.latitude != null && data.longitude != null
              ? `${data.latitude.toFixed(4)}° N, ${data.longitude.toFixed(4)}° W · ${data.geocodeSource ?? 'manual'}`
              : 'Not geocoded'}
          </Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaLbl}>DIVISIONS</Text>
          <Text style={styles.metaVal}>
            {data.divisions.length} line items · {fmtUsd(totalBudget)} total budget
          </Text>
        </View>
      </View>

      {/* Completion breakdown card. */}
      <View style={styles.completionCard}>
        <Text style={styles.completionTitle}>{'// COMPLETION BREAKDOWN'}</Text>
        <View style={styles.completionGrid}>
          <View style={styles.ccell}>
            <Text style={styles.ccellLbl}>FINANCIAL</Text>
            <Text style={styles.ccellVal}>{c.financial}%</Text>
            <View style={styles.bar}>
              <View style={[styles.barFill, { width: `${c.financial}%`, backgroundColor: colors.success }]} />
            </View>
          </View>
          <View style={styles.ccell}>
            <Text style={styles.ccellLbl}>TASKS</Text>
            <Text style={styles.ccellVal}>{c.tasksDone} / {c.tasksTotal}</Text>
            <View style={styles.bar}>
              <View style={[styles.barFill, { width: `${c.tasks}%` }]} />
            </View>
          </View>
          <View style={styles.ccell}>
            <Text style={styles.ccellLbl}>SCHEDULE</Text>
            <Text style={styles.ccellVal}>{c.schedule}%</Text>
            <View style={styles.bar}>
              <View style={[styles.barFill, { width: `${c.schedule}%`, backgroundColor: colors.orange }]} />
            </View>
          </View>
          <View style={styles.ccell}>
            <Text style={styles.ccellLbl}>SUBS</Text>
            <Text style={styles.ccellVal}>{c.subsActive} / {c.subsTotal}</Text>
            <View style={styles.bar}>
              <View style={[styles.barFill, { width: `${c.subs}%`, backgroundColor: colors.success }]} />
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  kpiRow: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: spacing.lg,
  },
  kpiCell: {
    flex: 1,
    padding: spacing.md,
    borderRightWidth: 1,
    borderRightColor: colors.line,
  },
  lbl: {
    fontSize: font.sizeXs,
    color: colors.ink50,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 1.5,
  },
  val: {
    fontSize: font.sizeKpiBig,
    color: colors.ink,
    fontFamily: 'Helvetica-Bold',
    marginTop: spacing.xs,
  },
  sub: {
    fontSize: font.sizeSm,
    color: colors.ink50,
    marginTop: 2,
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: spacing.lg,
  },
  metaRow: {
    width: '50%',
    paddingBottom: spacing.sm,
    marginBottom: spacing.md,
    paddingRight: spacing.lg,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.lineSoft,
    borderBottomStyle: 'dashed',
  },
  metaLbl: {
    fontSize: font.sizeXs,
    color: colors.ink50,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 1.5,
  },
  metaVal: {
    fontSize: font.sizeMd,
    color: colors.ink,
    marginTop: 2,
  },
  completionCard: {
    backgroundColor: colors.paper2,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
  },
  completionTitle: {
    fontSize: font.sizeMd,
    color: colors.ink70,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 1.5,
    marginBottom: spacing.md,
  },
  completionGrid: {
    flexDirection: 'row',
  },
  ccell: {
    flex: 1,
    backgroundColor: colors.paper,
    borderWidth: 0.5,
    borderColor: colors.lineSoft,
    padding: spacing.md,
    marginRight: spacing.md,
  },
  ccellLbl: {
    fontSize: font.sizeXs,
    color: colors.ink50,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 1.2,
  },
  ccellVal: {
    fontSize: font.sizeKpi,
    color: colors.ink,
    fontFamily: 'Helvetica-Bold',
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  bar: {
    height: 4,
    backgroundColor: colors.lineSoft,
  },
  barFill: {
    height: '100%',
    backgroundColor: colors.ink,
  },
});
